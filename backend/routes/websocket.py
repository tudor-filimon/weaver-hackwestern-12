from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from services.websocket_manager import manager
from database import supabase
import json

router = APIRouter()

@router.websocket("/ws/{board_id}")
async def websocket_endpoint(websocket: WebSocket, board_id: str):
    """
    WebSocket endpoint for real-time collaboration on a board.
    
    Uses FastAPI's built-in WebSocket support (no external packages needed).
    
    How it works:
    1. Client connects to ws://localhost:8000/ws/board-001
    2. Server accepts connection and adds to room
    3. Client can send messages (node moved, edge created, etc.)
    4. Server broadcasts to all other users in the room
    5. When client disconnects, server removes from room
    """
    # VALIDATION WE DON'T NEED FOR NOW
    # await websocket.accept()
    # # Verify board exists
    # try:
    #     board_check = supabase.table("boards").select("id").eq("id", board_id).execute()
    #     if not board_check.data:
    #         await websocket.close(code=1008, reason="Board not found")
    #         return
    # except Exception as e:
    #     await websocket.close(code=1011, reason="Database error")
    #     return
    
    # Connect the user to the board's room
    await manager.connect(websocket, board_id)
    
    try:
        # Keep connection alive and listen for messages
        while True:
            # Wait for a message from the client
            # FastAPI's WebSocket has receive_text() and receive_json() methods
            data = await websocket.receive_text()
            
            try:
                # Parse the JSON message
                message = json.loads(data)
                message_type = message.get("type")
                
                # Handle different message types
                if message_type == "node_moved":
                    await handle_node_moved(board_id, message, websocket)
                
                elif message_type == "node_created":
                    await handle_node_created(board_id, message, websocket)
                
                elif message_type == "node_updated":
                    await handle_node_updated(board_id, message, websocket)
                
                elif message_type == "node_deleted":
                    await handle_node_deleted(board_id, message, websocket)
                
                elif message_type == "edge_created":
                    await handle_edge_created(board_id, message, websocket)
                
                elif message_type == "edge_deleted":
                    await handle_edge_deleted(board_id, message, websocket)
                
                elif message_type == "cursor_moved":
                    await handle_cursor_moved(board_id, message, websocket)
                
                else:
                    # Unknown message type
                    await manager.send_personal_message({
                        "type": "error",
                        "message": f"Unknown message type: {message_type}"
                    }, websocket)
            
            except json.JSONDecodeError:
                await manager.send_personal_message({
                    "type": "error",
                    "message": "Invalid JSON"
                }, websocket)
            
            except Exception as e:
                print(f"Error handling message: {e}")
                await manager.send_personal_message({
                    "type": "error",
                    "message": str(e)
                }, websocket)
    
    except WebSocketDisconnect:
        # User disconnected (closed browser, navigated away, etc.)
        manager.disconnect(websocket)
        
        # Notify others that someone left
        await manager.broadcast_to_room(
            board_id,
            {
                "type": "user_left",
                "board_id": board_id,
                "user_count": manager.get_room_size(board_id)
            }
        )


# ============================================================================
# Message Handlers
# ============================================================================

async def handle_node_moved(board_id: str, message: dict, sender_websocket: WebSocket):
    """Handle when a user moves a node."""
    node_id = message.get("node_id")
    x = message.get("x")
    y = message.get("y")
    
    if not node_id or x is None or y is None:
        return
    
    # Update in database
    try:
        supabase.table("nodes").update({
            "x": x,
            "y": y
        }).eq("id", node_id).eq("board_id", board_id).execute()
    except Exception as e:
        print(f"Error updating node position: {e}")
    
    # Broadcast to all other users in the room
    await manager.broadcast_to_room(
        board_id,
        {
            "type": "node_moved",
            "node_id": node_id,
            "x": x,
            "y": y
        },
        exclude=sender_websocket  # Don't send back to sender
    )


async def handle_node_created(board_id: str, message: dict, sender_websocket: WebSocket):
    """Handle when a user creates a new node."""
    node_data = message.get("node_data")
    
    if not node_data:
        return
    
    # The node should already be created via REST API
    # We just broadcast it to others
    await manager.broadcast_to_room(
        board_id,
        {
            "type": "node_created",
            "node_data": node_data
        },
        exclude=sender_websocket
    )


async def handle_node_updated(board_id: str, message: dict, sender_websocket: WebSocket):
    """Handle when a user updates node content (e.g., LLM response)."""
    node_id = message.get("node_id")
    updates = message.get("updates", {})
    
    if not node_id:
        return
    
    # Broadcast to all other users
    await manager.broadcast_to_room(
        board_id,
        {
            "type": "node_updated",
            "node_id": node_id,
            "updates": updates
        },
        exclude=sender_websocket
    )


async def handle_node_deleted(board_id: str, message: dict, sender_websocket: WebSocket):
    """Handle when a user deletes a node."""
    node_id = message.get("node_id")
    
    if not node_id:
        return
    
    # Broadcast to all other users
    await manager.broadcast_to_room(
        board_id,
        {
            "type": "node_deleted",
            "node_id": node_id
        },
        exclude=sender_websocket
    )


async def handle_edge_created(board_id: str, message: dict, sender_websocket: WebSocket):
    """Handle when a user creates an edge."""
    edge_data = message.get("edge_data")
    
    if not edge_data:
        return
    
    # Broadcast to all other users
    await manager.broadcast_to_room(
        board_id,
        {
            "type": "edge_created",
            "edge_data": edge_data
        },
        exclude=sender_websocket
    )


async def handle_edge_deleted(board_id: str, message: dict, sender_websocket: WebSocket):
    """Handle when a user deletes an edge."""
    edge_id = message.get("edge_id")
    
    if not edge_id:
        return
    
    # Broadcast to all other users
    await manager.broadcast_to_room(
        board_id,
        {
            "type": "edge_deleted",
            "edge_id": edge_id
        },
        exclude=sender_websocket
    )


async def handle_cursor_moved(board_id: str, message: dict, sender_websocket: WebSocket):
    """Handle when a user moves their cursor (for showing other users' cursors)."""
    cursor_data = message.get("cursor_data")
    
    if not cursor_data:
        return
    
    # Broadcast to all other users (so they can see this user's cursor)
    await manager.broadcast_to_room(
        board_id,
        {
            "type": "cursor_moved",
            "cursor_data": cursor_data
        },
        exclude=sender_websocket
    )