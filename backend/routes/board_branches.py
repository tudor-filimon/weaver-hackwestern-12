from fastapi import APIRouter, HTTPException, Path
from schema.schemas import BranchHighlightRequest, BranchFullRequest, BranchCreateResponse
from database import supabase
import uuid

router = APIRouter()

@router.post("/{board_id}/branches/highlight", response_model=BranchCreateResponse)
async def branch_highlight(
    board_id: str = Path(..., description="Board ID"),
    branch_data: BranchHighlightRequest = None
):
    """Create branch from highlight"""
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
            "title": new_data.get("title", f"Branch from {branch_data.source_node_id}"),
            "content": new_data.get("content", branch_data.highlighted_text or ""),
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
            "label": None,
            "is_deleted": False
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
            "label": None,
            "is_deleted": False
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