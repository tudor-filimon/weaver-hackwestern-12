from fastapi import APIRouter, HTTPException, Path
from typing import List, Optional
from schema.schemas import NodeCreate, NodeBase, NodeUpdate
from database import supabase

router = APIRouter()

# Get all nodes for a board
@router.get("/{board_id}/nodes", response_model=List[NodeBase])
async def get_board_nodes(board_id: str = Path(..., description="Board ID")):
    """Get all nodes for a board"""
    try:
        result = supabase.table("nodes").select("*").eq("board_id", board_id).execute()
        return result.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{board_id}/nodes", response_model=NodeBase)
async def create_node(
    board_id: str = Path(..., description="Board ID"),
    node_data: NodeCreate = None
):
    """Create a node in this board"""
    try:
        board_check = supabase.table("boards").select("id").eq("id", board_id).execute()
        if not board_check.data:
            raise HTTPException(status_code=404, detail="Board not found")
        
        insert_data = {
            "id": node_data.id,
            "board_id": board_id,
            "x": node_data.x,
            "y": node_data.y,
            "width": node_data.width,
            "height": node_data.height,
            "title": node_data.title,
            "prompt": node_data.prompt,
            "response": None,
            "context": node_data.context,  # NEW
            "role": node_data.role or "user",
            "is_collapsed": node_data.is_collapsed,
            "is_starred": node_data.is_starred,
            "model": node_data.model,
            "is_root": node_data.is_root,
        }
        
        result = supabase.table("nodes").insert(insert_data).execute()
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create node")
        return result.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{board_id}/nodes/{id}", response_model=NodeBase)
async def get_node(
    board_id: str = Path(..., description="Board ID"),
    id: str = Path(..., description="Node ID")
):
    """Get a specific node"""
    try:
        result = supabase.table("nodes").select("*").eq("id", id).eq("board_id", board_id).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Node not found")
        return result.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{board_id}/nodes/{id}", response_model=NodeBase)
async def update_node(
    board_id: str = Path(..., description="Board ID"),
    id: str = Path(..., description="Node ID"),
    node_data: NodeUpdate = None
):
    """Update a node"""
    try:
        check = supabase.table("nodes").select("*").eq("id", id).eq("board_id", board_id).execute()
        if not check.data:
            raise HTTPException(status_code=404, detail="Node not found in this board")
        
        # Handle LLM calls if prompt provided
        if node_data and hasattr(node_data, 'prompt') and node_data.prompt:
            from services.llm_service import llm_service
            from schema.schemas import LLMServiceRequest
            
            llm_request = LLMServiceRequest(
                node_id=id,
                prompt=node_data.prompt,
                context=node_data.context,
            )
            
            llm_response = await llm_service.generate_content(llm_request)
            if not llm_response.success:
                raise HTTPException(status_code=500, detail=f"LLM call failed: {llm_response.error}")
            
            update_data = {
                "response": llm_response.generated_content,
                "role": "assistant"
            }
            result = supabase.table("nodes").update(update_data).eq("id", id).execute()
            if not result.data:
                raise HTTPException(status_code=500, detail="Failed to update node")
            return result.data[0]
        
        # Regular update
        if not node_data:
            return check.data[0]
            
        update_data = {}
        if node_data.x is not None:
            update_data["x"] = node_data.x
        if node_data.y is not None:
            update_data["y"] = node_data.y
        if node_data.width is not None:
            update_data["width"] = node_data.width
        if node_data.height is not None:
            update_data["height"] = node_data.height
        if node_data.title is not None:
            update_data["title"] = node_data.title
        if node_data.prompt is not None:
            update_data["prompt"] = node_data.prompt
        if node_data.response is not None:
            update_data["response"] = node_data.response
        if node_data.context is not None:  # NEW
            update_data["context"] = node_data.context
        if node_data.role is not None:
            update_data["role"] = node_data.role
        if node_data.is_root is not None:
            update_data["is_root"] = node_data.is_root
        if node_data.is_collapsed is not None:
            update_data["is_collapsed"] = node_data.is_collapsed
        if node_data.is_starred is not None:
            update_data["is_starred"] = node_data.is_starred
        if node_data.model is not None:
            update_data["model"] = node_data.model

        
        if not update_data:
            return check.data[0]
        
        result = supabase.table("nodes").update(update_data).eq("id", id).execute()
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to update node")
        return result.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{board_id}/nodes/{id}", response_model=dict)
async def delete_node(
    board_id: str = Path(..., description="Board ID"),
    id: str = Path(..., description="Node ID")
):
    """Delete a node"""
    try:
        check = supabase.table("nodes").select("id").eq("id", id).eq("board_id", board_id).execute()
        if not check.data:
            raise HTTPException(status_code=404, detail="Node not found in this board")
        
        supabase.table("nodes").delete().eq("id", id).execute()
        return {"message": "Node deleted successfully", "id": id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{board_id}/nodes/bulk", response_model=dict)
async def bulk_update_nodes(
    board_id: str = Path(..., description="Board ID"),
    bulk_data: List[NodeBase] = None
):
    """Bulk update multiple nodes in this board"""
    updated_nodes = []
    not_found_ids = []
    errors = []

    if not bulk_data: #error handling
        return {
            "updated_count": 0,
            "updated_nodes": [],
            "not_found_ids": [],
            "errors": []
        }
    
    for node_update in bulk_data:
        try:
            check = supabase.table("nodes").select("id").eq("id", node_update.id).eq("board_id", board_id).execute()
            if not check.data:
                not_found_ids.append(node_update.id)
                continue
            
            update_data = {}
            if node_update.x is not None:
                update_data["x"] = node_update.x
            if node_update.y is not None:
                update_data["y"] = node_update.y
            if node_update.width is not None:
                update_data["width"] = node_update.width
            if node_update.height is not None:
                update_data["height"] = node_update.height
            if node_update.title is not None:
                update_data["title"] = node_update.title
            if node_update.prompt is not None:
                update_data["prompt"] = node_update.prompt
            if node_update.response is not None:
                update_data["response"] = node_update.response            if node_update.context is not None:  # NEW
                update_data["context"] = node_update.context
            if node_update.role is not None:
                update_data["role"] = node_update.role
            if node_update.is_root is not None:
                update_data["is_root"] = node_update.is_root
            if node_update.is_collapsed is not None:
                update_data["is_collapsed"] = node_update.is_collapsed
            if node_update.is_starred is not None:
                update_data["is_starred"] = node_update.is_starred
            if node_update.model is not None:
                update_data["model"] = node_update.model
            
            if update_data:
                result = supabase.table("nodes").update(update_data).eq("id", node_update.id).execute()
                if result.data:
                    updated_nodes.append(result.data[0])
                else:
                    errors.append(node_update.id)
            else:
                existing = supabase.table("nodes").select("*").eq("id", node_update.id).execute()
                if existing.data:
                    updated_nodes.append(existing.data[0])
        except Exception as e:
            errors.append(f"{node_update.id}: {str(e)}")
    
    return {
        "updated_count": len(updated_nodes),
        "updated_nodes": updated_nodes,
        "not_found_ids": not_found_ids,
        "errors": errors
    }