from fastapi import APIRouter, HTTPException
from schema.schemas import BranchHighlight, BranchFull, BranchResponse
from database import supabase
import uuid

router = APIRouter()


@router.post("/highlight", response_model=BranchResponse)
async def branch_highlight(branch_data: BranchHighlight):
    """Branch to a new node from highlight - case 1"""
    try:
        # Generate new node ID
        new_node_id = f"node-{uuid.uuid4().hex[:8]}"
        new_edge_id = f"edge-{uuid.uuid4().hex[:8]}"
        
        # Get source node to extract position info
        source_node = supabase.table("nodes").select("*").eq("id", branch_data.source_node_id).execute()
        if not source_node.data:
            raise HTTPException(status_code=404, detail="Source node not found")
        
        source_node_data = source_node.data[0]
        board_id = source_node_data["board_id"]
        
        # Calculate position for new node (offset from source)
        position_x = branch_data.position.x if branch_data.position else source_node_data["x"] + 300
        position_y = branch_data.position.y if branch_data.position else source_node_data["y"] + 200
        
        # Prepare new node data
        new_node_data = branch_data.new_node_data or {}
        node_insert = {
            "id": new_node_id,
            "board_id": board_id,
            "x": position_x,
            "y": position_y,
            "width": 200.0,
            "height": 150.0,
            "type": "custom",
            "title": new_node_data.get("title", f"Branch from {branch_data.source_node_id}"),
            "content": new_node_data.get("content", ""),
            "role": new_node_data.get("role", "user"),
            "is_root": False,
            "is_collapsed": False,
            "is_starred": False,
            "color": new_node_data.get("color"),
            "icon": new_node_data.get("icon"),
            "model": new_node_data.get("model"),
            "temperature": new_node_data.get("temperature"),
            "metadata": new_node_data.get("metadata", {})
        }
        
        # Create new node
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
            "label": None,
            "is_deleted": False
        }
        
        edge_result = supabase.table("edges").insert(edge_insert).execute()
        if not edge_result.data:
            # Rollback: delete the node if edge creation fails
            supabase.table("nodes").delete().eq("id", new_node_id).execute()
            raise HTTPException(status_code=500, detail="Failed to create branch edge")
        
        return {
            "branch_id": new_edge_id,
            "source_node_id": branch_data.source_node_id,
            "new_node": node_result.data[0],
            "edge": edge_result.data[0],
            "message": "Branch created from highlight"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/full", response_model=BranchResponse)
async def branch_full(branch_data: BranchFull):
    """Branch to a new node completely - case 2"""
    try:
        # Generate new node ID
        new_node_id = f"node-{uuid.uuid4().hex[:8]}"
        new_edge_id = f"edge-{uuid.uuid4().hex[:8]}"
        
        # Get source node
        source_node = supabase.table("nodes").select("*").eq("id", branch_data.source_node_id).execute()
        if not source_node.data:
            raise HTTPException(status_code=404, detail="Source node not found")
        
        source_node_data = source_node.data[0]
        board_id = source_node_data["board_id"]
        
        # Calculate position for new node
        position_x = branch_data.position.x if branch_data.position else source_node_data["x"] + 300
        position_y = branch_data.position.y if branch_data.position else source_node_data["y"] + 200
        
        # Prepare new node data
        new_node_data = branch_data.new_node_data or {}
        node_insert = {
            "id": new_node_id,
            "board_id": board_id,
            "x": position_x,
            "y": position_y,
            "width": 200.0,
            "height": 150.0,
            "type": "custom",
            "title": new_node_data.get("title", f"Branch from {branch_data.source_node_id}"),
            "content": new_node_data.get("content", ""),
            "role": new_node_data.get("role", "user"),
            "is_root": False,
            "is_collapsed": False,
            "is_starred": False,
            "color": new_node_data.get("color"),
            "icon": new_node_data.get("icon"),
            "model": new_node_data.get("model"),
            "temperature": new_node_data.get("temperature"),
            "metadata": new_node_data.get("metadata", {})
        }
        
        # Create new node
        node_result = supabase.table("nodes").insert(node_insert).execute()
        if not node_result.data:
            raise HTTPException(status_code=500, detail="Failed to create branch node")
        
        # Create edge
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
            # Rollback: delete the node if edge creation fails
            supabase.table("nodes").delete().eq("id", new_node_id).execute()
            raise HTTPException(status_code=500, detail="Failed to create branch edge")
        
        return {
            "branch_id": new_edge_id,
            "source_node_id": branch_data.source_node_id,
            "new_node": node_result.data[0],
            "edge": edge_result.data[0],
            "message": "Full branch created"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))