from fastapi import APIRouter, HTTPException, Path
from typing import List
from schema.schemas import BoardBase, BoardUpdate
from database import supabase
import uuid

# Import sub-routers
from routes import board_nodes, board_edges, board_branches

router = APIRouter()

# Include sub-routers (they'll be nested under board routes)
router.include_router(board_nodes.router)
router.include_router(board_edges.router)
router.include_router(board_branches.router)

# ============================================================================
# BOARD OPERATIONS ONLY
# ============================================================================
# GET all boards
@router.get("/", response_model=List[BoardBase])
async def list_boards():
    """List all boards"""
    try:
        result = supabase.table("boards").select("*").execute()
        return result.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# CREATE a new board
@router.post("/", response_model=BoardBase)
async def create_board(board_data: BoardBase):
    """Create a new board"""
    try:
        board_id = f"board-{uuid.uuid4().hex[:8]}"
        insert_data = {
            "id": board_id,
            "name": board_data.name
        }
        result = supabase.table("boards").insert(insert_data).execute()
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create board")
        return result.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{board_id}", response_model=dict)
async def get_board(board_id: str = Path(..., description="Board ID")):
    """Get board with all its nodes and edges"""
    try:
        board_result = supabase.table("boards").select("*").eq("id", board_id).execute()
        if not board_result.data:
            raise HTTPException(status_code=404, detail="Board not found")
        
        nodes_result = supabase.table("nodes").select("*").eq("board_id", board_id).execute()
        edges_result = supabase.table("edges").select("*").eq("board_id", board_id).eq("is_deleted", False).execute()
        
        return {
            "board": board_result.data[0],
            "nodes": nodes_result.data or [],
            "edges": edges_result.data or []
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Rename a board
@router.patch("/{board_id}", response_model=BoardBase)
async def update_board(
    board_id: str = Path(..., description="Board ID"),
    board_data: BoardUpdate = None
):
    """Update board name"""
    try:
        update_data = {}
        if board_data.name is not None:
            update_data["name"] = board_data.name
        
        if not update_data:
            result = supabase.table("boards").select("*").eq("id", board_id).execute()
            if not result.data:
                raise HTTPException(status_code=404, detail="Board not found")
            return result.data[0]
        
        result = supabase.table("boards").update(update_data).eq("id", board_id).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Board not found")
        return result.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Delete a baord and all its nodes and edges
@router.delete("/{board_id}", response_model=dict)
async def delete_board(board_id: str = Path(..., description="Board ID")):
    """Delete board (cascades to nodes/edges)"""
    try:
        check = supabase.table("boards").select("id").eq("id", board_id).execute()
        if not check.data:
            raise HTTPException(status_code=404, detail="Board not found")
        
        supabase.table("boards").delete().eq("id", board_id).execute()
        return {"message": "Board deleted successfully", "board_id": board_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Reset a board and all its nodes and edge except for the root node - the root node should stay, but it should be wiped clean
@router.post("/{board_id}/reset", response_model=dict)
async def reset_board(board_id: str = Path(..., description="Board ID")):
    """Reset board - delete all nodes and edges except for the root node"""
    try:
        check = supabase.table("boards").select("id").eq("id", board_id).execute()
        if not check.data:
            raise HTTPException(status_code=404, detail="Board not found")
        
        # Delete edges
        supabase.table("edges").delete().eq("board_id", board_id).execute()

        # Delete nodes except for the root node
        supabase.table("nodes").delete().eq("board_id", board_id).neq("is_root", True).execute()
        
        return {"message": "Board reset successfully", "board_id": board_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))