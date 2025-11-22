from fastapi import APIRouter, HTTPException
from schema.schemas import EdgeCreate, EdgeDelete, EdgeUpdate, EdgeResponse
from database import supabase

router = APIRouter()


@router.post("/create", response_model=EdgeResponse)
async def create_edge(edge_data: EdgeCreate):
    """Create a new edge"""
    try:
        insert_data = {
            "id": edge_data.edge_id,  # TEXT ID from frontend
            "board_id": edge_data.board_id,
            "source_node_id": edge_data.source,
            "target_node_id": edge_data.target,
            "edge_type": edge_data.edge_type or "default",
            "label": edge_data.label,
            "is_deleted": edge_data.is_deleted or False
        }
        
        result = supabase.table("edges").insert(insert_data).execute()
        
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create edge")
        
        return result.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/delete", response_model=dict)
async def delete_edge(edge_data: EdgeDelete):
    """Delete an edge"""
    try:
        # Check if edge exists
        check_result = supabase.table("edges").select("id").eq("id", edge_data.edge_id).execute()
        if not check_result.data:
            raise HTTPException(status_code=404, detail="Edge not found")
        
        # Delete edge
        result = supabase.table("edges").delete().eq("id", edge_data.edge_id).execute()
        
        return {
            "id": edge_data.edge_id,
            "message": "Edge deleted successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/update", response_model=EdgeResponse)
async def update_edge(edge_data: EdgeUpdate):
    """Update an edge - case 1: relationship is deleted"""
    try:
        # Check if edge exists
        check_result = supabase.table("edges").select("*").eq("id", edge_data.edge_id).execute()
        if not check_result.data:
            raise HTTPException(status_code=404, detail="Edge not found")
        
        # Build update data
        update_data = {}
        if edge_data.board_id is not None:
            update_data["board_id"] = edge_data.board_id
        if edge_data.source is not None:
            update_data["source_node_id"] = edge_data.source
        if edge_data.target is not None:
            update_data["target_node_id"] = edge_data.target
        if edge_data.edge_type is not None:
            update_data["edge_type"] = edge_data.edge_type
        if edge_data.label is not None:
            update_data["label"] = edge_data.label
        if edge_data.is_deleted is not None:
            update_data["is_deleted"] = edge_data.is_deleted
        if edge_data.data is not None:
            update_data["data"] = edge_data.data
        
        # Handle relationship deletion case
        if edge_data.is_deleted:
            update_data["is_deleted"] = True
        
        if not update_data:
            return check_result.data[0]
        
        result = supabase.table("edges").update(update_data).eq("id", edge_data.edge_id).execute()
        
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to update edge")
        
        return result.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))