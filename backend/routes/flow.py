from fastapi import APIRouter, HTTPException
from schema.schemas import FlowSave, FlowResponse, FlowReset
from database import supabase

router = APIRouter()


@router.post("/save", response_model=FlowResponse)
async def save_flow(flow_data: FlowSave):
    """Save a flow (board) - saves all nodes and edges"""
    try:
        # flow_id is actually board_id (TEXT)
        board_id = flow_data.flow_id if flow_data.flow_id else "default"
        
        # Check if board exists, create if not
        board_check = supabase.table("boards").select("id").eq("id", board_id).execute()
        if not board_check.data:
            # Create board if it doesn't exist
            supabase.table("boards").insert({
                "id": board_id,
                "name": f"Board {board_id}"
            }).execute()
        
        nodes_saved = 0
        edges_saved = 0
        
        # Save nodes
        if flow_data.nodes:
            for node in flow_data.nodes:
                try:
                    # Extract data from React Flow node format
                    node_data = {
                        "id": node.id,
                        "board_id": board_id,
                        "x": node.position.x,
                        "y": node.position.y,
                        "width": node.width,
                        "height": node.height,
                        "type": node.type or "custom",
                        "data": node.data or {}
                    }
                    
                    # Try update first, then insert if not exists
                    existing = supabase.table("nodes").select("id").eq("id", node.id).execute()
                    if existing.data:
                        supabase.table("nodes").update(node_data).eq("id", node.id).execute()
                    else:
                        supabase.table("nodes").insert(node_data).execute()
                    nodes_saved += 1
                except Exception as e:
                    print(f"Error saving node {node.id}: {e}")
        
        # Save edges
        if flow_data.edges:
            for edge in flow_data.edges:
                try:
                    edge_data = {
                        "id": edge.id,
                        "board_id": board_id,
                        "source_node_id": edge.source,
                        "target_node_id": edge.target,
                        "edge_type": edge.type or "default",
                        "label": edge.label,
                        "is_deleted": False
                    }
                    
                    # Try update first, then insert if not exists
                    existing = supabase.table("edges").select("id").eq("id", edge.id).execute()
                    if existing.data:
                        supabase.table("edges").update(edge_data).eq("id", edge.id).execute()
                    else:
                        supabase.table("edges").insert(edge_data).execute()
                    edges_saved += 1
                except Exception as e:
                    print(f"Error saving edge {edge.id}: {e}")
        
        return {
            "flow_id": board_id,
            "message": "Flow saved successfully",
            "nodes": flow_data.nodes,
            "edges": flow_data.edges,
            "metadata": flow_data.metadata or {}
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{flow_id}", response_model=FlowResponse)
async def get_flow(flow_id: str):
    """Get a flow (board) by ID - returns nodes and edges"""
    try:
        # Check if board exists
        board_check = supabase.table("boards").select("*").eq("id", flow_id).execute()
        if not board_check.data:
            raise HTTPException(status_code=404, detail="Flow not found")
        
        # Get all nodes for this board
        nodes_result = supabase.table("nodes").select("*").eq("board_id", flow_id).execute()
        nodes = nodes_result.data or []
        
        # Get all edges for this board
        edges_result = supabase.table("edges").select("*").eq("board_id", flow_id).eq("is_deleted", False).execute()
        edges = edges_result.data or []
        
        # Convert to React Flow format (you may need to adjust this based on your schema)
        react_flow_nodes = []
        react_flow_edges = []
        
        # This is a simplified conversion - you may need to adjust based on your exact React Flow schema
        for node in nodes:
            react_flow_nodes.append({
                "id": node["id"],
                "position": {"x": node["x"], "y": node["y"]},
                "type": node.get("type", "custom"),
                "width": node.get("width"),
                "height": node.get("height"),
                "data": node.get("data", {})
            })
        
        for edge in edges:
            react_flow_edges.append({
                "id": edge["id"],
                "source": edge["source_node_id"],
                "target": edge["target_node_id"],
                "type": edge.get("edge_type", "default"),
                "label": edge.get("label")
            })
        
        return {
            "flow_id": flow_id,
            "nodes": react_flow_nodes,
            "edges": react_flow_edges,
            "metadata": {}
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reset", response_model=dict)
async def reset_flow(reset_data: FlowReset):
    """Reset a flow (board) - deletes all nodes and edges"""
    try:
        flow_id = reset_data.flow_id
        
        # Check if board exists
        board_check = supabase.table("boards").select("id").eq("id", flow_id).execute()
        if not board_check.data:
            raise HTTPException(status_code=404, detail="Flow not found")
        
        # Delete all edges first (due to foreign key constraints)
        supabase.table("edges").delete().eq("board_id", flow_id).execute()
        
        # Delete all nodes (will cascade delete chat_messages)
        supabase.table("nodes").delete().eq("board_id", flow_id).execute()
        
        return {
            "flow_id": flow_id,
            "message": "Flow reset successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))