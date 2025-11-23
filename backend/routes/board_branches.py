from fastapi import APIRouter, HTTPException, Path
from schema.schemas import BranchHighlightRequest, BranchFullRequest, BranchCreateResponse
from database import supabase
from services.context_service import update_node_context
import uuid

router = APIRouter()

@router.post("/{board_id}/branches/highlight", response_model=BranchCreateResponse)
async def branch_highlight(
    board_id: str = Path(..., description="Board ID"),
    branch_data: BranchHighlightRequest = None
):
    """
    Create a new node from highlighted text in a parent node.
    
    Flow:
    1. Create new node connected to source node
    2. Store highlighted text in node's context (or metadata)
    3. Store user's question as prompt
    4. Optionally call LLM immediately to generate response
    """
    try:
        # Validate board exists
        board_check = supabase.table("boards").select("id").eq("id", board_id).execute()
        if not board_check.data:
            raise HTTPException(status_code=404, detail="Board not found")
        
        # Get source node to copy some properties
        source_node_result = supabase.table("nodes").select("*").eq("id", branch_data.source_node_id).eq("board_id", board_id).execute()
        if not source_node_result.data:
            raise HTTPException(status_code=404, detail="Source node not found")
        
        source_node = source_node_result.data[0]
        
        # Calculate position for new node (to the right of source)
        pos_x = branch_data.position.x if branch_data.position else source_node["x"] + 500
        pos_y = branch_data.position.y if branch_data.position else source_node["y"]
        
        # Generate IDs
        new_node_id = f"node-{uuid.uuid4().hex[:8]}"
        new_edge_id = f"edge-{uuid.uuid4().hex[:8]}"
        
        # Build context that includes the highlighted text
        # The highlighted text should be emphasized in the context
        highlighted_context = f"""=== Highlighted Text from Parent Node ===
"{branch_data.highlighted_text}"

=== User's Question ===
{branch_data.user_question}
"""
        
        # Create new node
        node_insert = {
            "id": new_node_id,
            "board_id": board_id,
            "x": pos_x,
            "y": pos_y,
            "width": source_node.get("width", 400),
            "height": source_node.get("height"),
            "title": "New Branch",  # Frontend can update this
            "prompt": branch_data.user_question,  # User's question
            "response": None,  # Will be filled if auto_generate is True
            "context": highlighted_context,  # Store highlighted text as initial context
            "role": "user",
            "is_root": False,
            "is_collapsed": False,
            "is_starred": False,
            "model": source_node.get("model", "gemini-2.5-flash-lite"),
        }
        
        # Insert node
        node_result = supabase.table("nodes").insert(node_insert).execute()
        if not node_result.data:
            raise HTTPException(status_code=500, detail="Failed to create branch node")
        
        # Create edge connecting source to new node
        edge_insert = {
            "id": new_edge_id,
            "board_id": board_id,
            "source_node_id": branch_data.source_node_id,
            "target_node_id": new_node_id,
            "edge_type": "default",
            "label": None
        }
        
        edge_result = supabase.table("edges").insert(edge_insert).execute()
        if not edge_result.data:
            # Rollback: delete the node if edge creation fails
            supabase.table("nodes").delete().eq("id", new_node_id).execute()
            raise HTTPException(status_code=500, detail="Failed to create branch edge")
        
        # Build full context from parent nodes (includes parent's conversation)
        # This will merge the highlighted text context with parent's context
        full_context = update_node_context(new_node_id, board_id)
        
        # If auto_generate is True, call LLM immediately
        if branch_data.auto_generate:
            from services.llm_service import llm_service
            from schema.schemas import LLMServiceRequest
            
            # Build prompt that emphasizes the highlighted text
            enhanced_prompt = f"""Based on this highlighted text from the parent conversation:

"{branch_data.highlighted_text}"

{branch_data.user_question}"""
            
            llm_request = LLMServiceRequest(
                node_id=new_node_id,
                prompt=enhanced_prompt,
            )
            
            llm_response = await llm_service.generate_content(llm_request)
            
            if llm_response.success:
                # Update node with LLM response
                supabase.table("nodes").update({
                    "response": llm_response.generated_content,
                    "role": "assistant"
                }).eq("id", new_node_id).execute()
                
                # Refresh node data to return updated version
                updated_node = supabase.table("nodes").select("*").eq("id", new_node_id).execute()
                if updated_node.data:
                    node_result.data[0] = updated_node.data[0]
        
        return {
            "node": node_result.data[0],
            "edge": edge_result.data[0]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{board_id}/branches/full", response_model=BranchCreateResponse)
async def branch_full(
    board_id: str = Path(..., description="Board ID"),
    branch_data: BranchFullRequest = None
):
    """Create full branch"""
    try:
        board_check = supabase.table("boards").select("id").eq("id", board_id).execute()
        if not board_check.data:
            raise HTTPException(status_code=404, detail="Board not found")
        
        new_node_id = f"node-{uuid.uuid4().hex[:8]}"
        new_edge_id = f"edge-{uuid.uuid4().hex[:8]}"
        
        source_node = supabase.table("nodes").select("*").eq("id", branch_data.source_node_id).eq("board_id", board_id).execute()
        if not source_node.data:
            raise HTTPException(status_code=404, detail="Source node not found")
        
        source = source_node.data[0]
        pos_x = branch_data.position.x if branch_data.position else source["x"] + 300
        pos_y = branch_data.position.y if branch_data.position else source["y"] + 200
        
        new_data = branch_data.new_node_data or {}
        node_insert = {
            "id": new_node_id,
            "board_id": board_id,
            "x": pos_x,
            "y": pos_y,
            "width": 200.0,
            "height": 150.0,
            "type": "custom",
            "title": new_data.get("title", f"Full branch from {branch_data.source_node_id}"),
            "content": new_data.get("content", ""),
            "role": new_data.get("role", "user"),
            "is_root": False,
            "is_collapsed": False,
            "is_starred": False,
            "color": new_data.get("color"),
            "icon": new_data.get("icon"),
            "model": new_data.get("model"),
            "temperature": new_data.get("temperature"),
            "metadata": new_data.get("metadata", {})
        }
        
        node_result = supabase.table("nodes").insert(node_insert).execute()
        if not node_result.data:
            raise HTTPException(status_code=500, detail="Failed to create branch node")
        
        edge_insert = {
            "id": new_edge_id,
            "board_id": board_id,
            "source_node_id": branch_data.source_node_id,
            "target_node_id": new_node_id,
            "edge_type": "default",
            "label": None
        }
        
        edge_result = supabase.table("edges").insert(edge_insert).execute()
        if not edge_result.data:
            supabase.table("nodes").delete().eq("id", new_node_id).execute()
            raise HTTPException(status_code=500, detail="Failed to create branch edge")
        
        return {
            "node": node_result.data[0],
            "edge": edge_result.data[0]
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))