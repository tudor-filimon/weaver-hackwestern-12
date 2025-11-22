from fastapi import APIRouter, HTTPException
from typing import List
from schema.schemas import (
    NodeCreate, NodeUpdate, NodeDelete, NodePosition, 
    NodeBulkUpdate, NodeResponse
)
from database import supabase

router = APIRouter()


@router.post("/create", response_model=NodeResponse)
async def create_node(node_data: NodeCreate):
    """Create a new node"""
    try:
        # Map schema to database fields
        insert_data = {
            "id": node_data.node_id,  # TEXT ID from frontend
            "board_id": node_data.board_id,
            "x": node_data.x,
            "y": node_data.y,
            "width": node_data.width,
            "height": node_data.height,
            "type": node_data.node_type or "custom",
            "data": node_data.data or {}
        }
        
        result = supabase.table("nodes").insert(insert_data).execute()
        
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create node")
        
        return result.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/update", response_model=NodeResponse)
async def update_node(node_data: NodeUpdate):
    """Update a node"""
    try:
        # First check if node exists
        check_result = supabase.table("nodes").select("*").eq("id", node_data.node_id).execute()
        if not check_result.data:
            raise HTTPException(status_code=404, detail="Node not found")
        
        # Build update data (only include fields that are provided)
        update_data = {}
        if node_data.board_id is not None:
            update_data["board_id"] = node_data.board_id
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
            # No fields to update, return existing node
            return check_result.data[0]
        
        result = supabase.table("nodes").update(update_data).eq("id", node_data.node_id).execute()
        
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to update node")
        
        return result.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/delete", response_model=dict)
async def delete_node(node_data: NodeDelete):
    """Delete a node"""
    try:
        # Check if node exists
        check_result = supabase.table("nodes").select("id").eq("id", node_data.node_id).execute()
        if not check_result.data:
            raise HTTPException(status_code=404, detail="Node not found")
        
        # Delete node (cascade will handle chat_messages and edges)
        result = supabase.table("nodes").delete().eq("id", node_data.node_id).execute()
        
        return {
            "id": node_data.node_id,
            "message": "Node deleted successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/position", response_model=NodeResponse)
async def update_node_position(position_data: NodePosition):
    """Update node position (for moving it around)"""
    try:
        # Check if node exists
        check_result = supabase.table("nodes").select("id").eq("id", position_data.node_id).execute()
        if not check_result.data:
            raise HTTPException(status_code=404, detail="Node not found")
        
        result = supabase.table("nodes").update({
            "x": position_data.x,
            "y": position_data.y
        }).eq("id", position_data.node_id).execute()
        
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to update node position")
        
        return result.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/bulk-update", response_model=dict)
async def bulk_update_nodes(bulk_data: NodeBulkUpdate):
    """Bulk update multiple nodes"""
    updated_nodes = []
    not_found_ids = []
    errors = []
    
    for node_update in bulk_data.nodes:
        try:
            # Check if node exists
            check_result = supabase.table("nodes").select("id").eq("id", node_update.node_id).execute()
            if not check_result.data:
                not_found_ids.append(node_update.node_id)
                continue
            
            # Build update data
            update_data = {}
            if node_update.board_id is not None:
                update_data["board_id"] = node_update.board_id
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
                # No updates, get existing node
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