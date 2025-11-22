from fastapi import APIRouter, HTTPException, Path
from typing import List
from schema.schemas import NodeCreate, NodeUpdate, NodeResponse, NodeBulkUpdate
from database import supabase

router = APIRouter()

@router.get("/{board_id}/nodes", response_model=List[NodeResponse])
async def get_board_nodes(board_id: str = Path(..., description="Board ID")):
    """Get all nodes for a board"""
    try:
        result = supabase.table("nodes").select("*").eq("board_id", board_id).execute()
        return result.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{board_id}/nodes", response_model=NodeResponse)
async def create_node(
    board_id: str = Path(..., description="Board ID"),
    node_data: NodeCreate = None
):
    """Create a node in this board"""
    try:
        board_check = supabase.table("boards").select("id").eq("id", board_id).execute()
        if not board_check.data:
            raise HTTPException(status_code=404, detail="Board not found")
        
        data = node_data.data or {}
        insert_data = {
            "id": node_data.node_id,
            "board_id": board_id,
            "x": node_data.x,
            "y": node_data.y,
            "width": node_data.width,
            "height": node_data.height,
            "type": node_data.node_type or "custom",
            "data": data,
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


@router.get("/{board_id}/nodes/{node_id}", response_model=NodeResponse)
async def get_node(
    board_id: str = Path(..., description="Board ID"),
    node_id: str = Path(..., description="Node ID")
):
    """Get a specific node"""
    try:
        result = supabase.table("nodes").select("*").eq("id", node_id).eq("board_id", board_id).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Node not found")
        return result.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{board_id}/nodes/{node_id}", response_model=NodeResponse)
async def update_node(
    board_id: str = Path(..., description="Board ID"),
    node_id: str = Path(..., description="Node ID"),
    node_data: NodeUpdate = None
):
    """Update a node"""
    try:
        check = supabase.table("nodes").select("*").eq("id", node_id).eq("board_id", board_id).execute()
        if not check.data:
            raise HTTPException(status_code=404, detail="Node not found in this board")
        
        # Handle LLM calls if prompt provided
        if hasattr(node_data, 'prompt') and node_data.prompt:
            from services.llm_service import llm_service
            from schema.schemas import LLMServiceRequest
            
            llm_request = LLMServiceRequest(
                node_id=node_id,
                prompt=node_data.prompt,
                temperature=node_data.temperature if hasattr(node_data, 'temperature') else None,
                max_tokens=node_data.max_tokens if hasattr(node_data, 'max_tokens') else None
            )
            
            llm_response = await llm_service.generate_content(llm_request)
            if not llm_response.success:
                raise HTTPException(status_code=500, detail=f"LLM call failed: {llm_response.error}")
            
            update_data = {
                "content": llm_response.generated_content,
                "role": "assistant"
            }
            result = supabase.table("nodes").update(update_data).eq("id", node_id).execute()
            if not result.data:
                raise HTTPException(status_code=500, detail="Failed to update node")
            return result.data[0]
        
        # Regular update
        update_data = {}
        if node_data.x is not None:
            update_data["x"] = node_data.x
        if node_data.y is not None:
            update_data["y"] = node_data.y
        if node_data.width is not None:
            update_data["width"] = node_data.width
        if node_data.height is not None:
            update_data["height"] = node_data.height
        if node_data.node_type is not None:
            update_data["type"] = node_data.node_type
        if node_data.data is not None:
            update_data["data"] = node_data.data
        
        if not update_data:
            return check.data[0]
        
        result = supabase.table("nodes").update(update_data).eq("id", node_id).execute()
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to update node")
        return result.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{board_id}/nodes/{node_id}", response_model=dict)
async def delete_node(
    board_id: str = Path(..., description="Board ID"),
    node_id: str = Path(..., description="Node ID")
):
    """Delete a node"""
    try:
        check = supabase.table("nodes").select("id").eq("id", node_id).eq("board_id", board_id).execute()
        if not check.data:
            raise HTTPException(status_code=404, detail="Node not found in this board")
        
        supabase.table("nodes").delete().eq("id", node_id).execute()
        return {"message": "Node deleted successfully", "node_id": node_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{board_id}/nodes/bulk", response_model=dict)
async def bulk_update_nodes(
    board_id: str = Path(..., description="Board ID"),
    bulk_data: NodeBulkUpdate = None
):
    """Bulk update multiple nodes in this board"""
    updated_nodes = []
    not_found_ids = []
    errors = []
    
    for node_update in bulk_data.nodes:
        try:
            check = supabase.table("nodes").select("id").eq("id", node_update.node_id).eq("board_id", board_id).execute()
            if not check.data:
                not_found_ids.append(node_update.node_id)
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
            if node_update.node_type is not None:
                update_data["type"] = node_update.node_type
            if node_update.data is not None:
                update_data["data"] = node_update.data
            
            if update_data:
                result = supabase.table("nodes").update(update_data).eq("id", node_update.node_id).execute()
                if result.data:
                    updated_nodes.append(result.data[0])
                else:
                    errors.append(node_update.node_id)
            else:
                existing = supabase.table("nodes").select("*").eq("id", node_update.node_id).execute()
                if existing.data:
                    updated_nodes.append(existing.data[0])
        except Exception as e:
            errors.append(f"{node_update.node_id}: {str(e)}")
    
    return {
        "updated_count": len(updated_nodes),
        "updated_nodes": updated_nodes,
        "not_found_ids": not_found_ids,
        "errors": errors
    }