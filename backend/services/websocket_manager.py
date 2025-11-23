from typing import Dict, Set
from fastapi import WebSocket
import json

class ConnectionManager:
    """
    Manages WebSocket connections for real-time collaboration.
    
    Uses FastAPI's built-in WebSocket class (from Starlette).
    """
    
    def __init__(self):
        # Dictionary mapping board_id → set of WebSocket connections
        # Example: {"board-001": {websocket1, websocket2}, "board-002": {websocket3}}
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        
        # Dictionary mapping WebSocket → board_id (for cleanup)
        self.connection_boards: Dict[WebSocket, str] = {}
        
        # Dictionary mapping WebSocket → user info (optional, for showing who's online)
        self.connection_users: Dict[WebSocket, dict] = {}
    
    async def connect(self, websocket: WebSocket, board_id: str, user_info: dict = None):
        """
        Add a new WebSocket connection to a board's room.
        
        Args:
            websocket: FastAPI WebSocket connection
            board_id: Which board this user is viewing
            user_info: Optional user information (name, color, etc.)
        """
        await websocket.accept()
        
        # Initialize board room if it doesn't exist
        if board_id not in self.active_connections:
            self.active_connections[board_id] = set()
        
        # Add this connection to the board's room
        self.active_connections[board_id].add(websocket)
        self.connection_boards[websocket] = board_id
        
        if user_info:
            self.connection_users[websocket] = user_info
        
        # Notify others in the room that someone joined
        await self.broadcast_to_room(
            board_id,
            {
                "type": "user_joined",
                "board_id": board_id,
                "user_count": len(self.active_connections[board_id])
            },
            exclude=websocket  # Don't send to the person who just joined
        )
        
        print(f"User connected to board {board_id}. Total users: {len(self.active_connections[board_id])}")
    
    def disconnect(self, websocket: WebSocket):
        """
        Remove a WebSocket connection from its room.
        """
        if websocket not in self.connection_boards:
            return
        
        board_id = self.connection_boards[websocket]
        
        # Remove from the room
        if board_id in self.active_connections:
            self.active_connections[board_id].discard(websocket)
            
            # If room is empty, clean it up
            if len(self.active_connections[board_id]) == 0:
                del self.active_connections[board_id]
        
        # Clean up tracking dictionaries
        self.connection_boards.pop(websocket, None)
        self.connection_users.pop(websocket, None)
        
        print(f"User disconnected from board {board_id}")
    
    async def send_personal_message(self, message: dict, websocket: WebSocket):
        """
        Send a message to a specific WebSocket connection.
        
        Args:
            message: Dictionary with message data
            websocket: Target WebSocket connection
        """
        try:
            await websocket.send_json(message)
        except Exception as e:
            print(f"Error sending message: {e}")
            self.disconnect(websocket)
    
    async def broadcast_to_room(self, board_id: str, message: dict, exclude: WebSocket = None):
        """
        Send a message to ALL connections in a board's room.
        
        Args:
            board_id: Which board's room to broadcast to
            message: Dictionary with message data
            exclude: Optional WebSocket to exclude from broadcast
        """
        if board_id not in self.active_connections:
            return
        
        # Create a list of connections to send to (excluding the sender)
        connections = self.active_connections[board_id]
        if exclude:
            connections = connections - {exclude}
        
        # Send to all connections (in parallel)
        disconnected = []
        for connection in connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                print(f"Error broadcasting to connection: {e}")
                disconnected.append(connection)
        
        # Clean up disconnected connections
        for conn in disconnected:
            self.disconnect(conn)
    
    def get_room_size(self, board_id: str) -> int:
        """Get number of users in a board's room."""
        return len(self.active_connections.get(board_id, set()))


# Create a singleton instance (shared across the app)
manager = ConnectionManager()