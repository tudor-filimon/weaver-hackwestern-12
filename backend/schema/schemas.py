from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID
from enum import Enum


# ---------------------------- Enums --------------------------------------------#

class NodeRole(str, Enum):
    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"


class EdgeType(str, Enum):
    DEFAULT = "default"
    MERGE = "merge"
    REF = "ref"


# ---------------------------- React Flow Core Schemas ----------------------------------#

class Position(BaseModel):
    # React Flow position object
    x: float
    y: float


class ReactFlowNode(BaseModel):
    # React Flow node structure - matches React Flow exactly
    id: str  # React Flow uses strings for IDs
    position: Position
    type: Optional[str] = "custom"  # Your custom node type
    width: Optional[float] = None
    height: Optional[float] = None
    data: Dict[str, Any] = Field(default_factory=dict)  # All custom data goes here
    selected: Optional[bool] = False
    dragging: Optional[bool] = False


class ReactFlowEdge(BaseModel):
    # React Flow edge structure - matches React Flow exactly
    id: str  # React Flow uses strings for IDs
    source: str  # Source node ID
    target: str  # Target node ID
    type: Optional[str] = "default"
    label: Optional[str] = None
    data: Optional[Dict[str, Any]] = None
    animated: Optional[bool] = False
    selected: Optional[bool] = False
    sourceHandle: Optional[str] = None
    targetHandle: Optional[str] = None
    markerEnd: Optional[Dict[str, Any]] = None


# ---------------------------- Node Data Schema (what goes inside node.data) ----------------------------------#

class NodeData(BaseModel):
    # Structure for data inside ReactFlowNode.data
    label: Optional[str] = None  # Display label
    title: str  # Node chat title
    content: str = ""  # Main text (latest message / summary)
    role: NodeRole = NodeRole.USER
    is_root: bool = False
    is_collapsed: bool = False
    is_starred: bool = False
    color: Optional[str] = None  # Node colour / tree colour
    icon: Optional[str] = None
    model: Optional[str] = None  # AI model e.g. gpt-4, gemini-pro, etc.
    temperature: Optional[float] = None
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)
    board_id: Optional[str] = None  # Store as string for React Flow compatibility


# ---------------------------- Edge Data Schema (what goes inside ReactFlowEdge.data) ----------------------------------#

class EdgeData(BaseModel):
    # Structure for data inside ReactFlowEdge.data
    edge_type: EdgeType = EdgeType.DEFAULT
    label: Optional[str] = None
    is_deleted: bool = False
    board_id: Optional[str] = None


# ---------------------------- Board Schemas (for database) ----------------------------------#

class BoardBase(BaseModel):
    id: UUID
    name: str

class BoardUpdate(BaseModel):
    name: Optional[str] = None


# ---------------------------- Database Node Schemas (for Supabase storage) ----------------------------------#

class NodeBase(BaseModel):
    # Database node schema - stores React Flow node data
    board_id: UUID
    node_id: str  # React Flow node ID (string)
    x: float
    y: float
    width: Optional[float] = None
    height: Optional[float] = None
    node_type: Optional[str] = "custom"
    is_root: bool
    # Store all React Flow data as JSONB
    data: Dict[str, Any] = Field(default_factory=dict)


class NodeCreate(NodeBase):
    pass

class NodeUpdate(BaseModel):
    node_id: str  # Required - TEXT ID from frontend
    prompt: Optional[str] = None  # If provided, triggers LLM call
    temperature: Optional[float] = None  # For LLM call
    max_tokens: Optional[int] = None  # For LLM call
    # Regular update fields
    board_id: Optional[str] = None  # TEXT, not UUID based on your SQL schema
    x: Optional[float] = None
    y: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None
    node_type: Optional[str] = None
    data: Optional[Dict[str, Any]] = None


class NodeDelete(BaseModel):
    node_id: str  # React Flow uses string IDs
    board_id: Optional[UUID] = None


class NodePosition(BaseModel):
    node_id: str
    board_id: Optional[UUID] = None
    x: float
    y: float


class NodeBulkUpdate(BaseModel):
    nodes: List[NodeUpdate]


class NodeResponse(NodeBase):
    id: UUID  # Database primary key
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ---------------------------- Database Edge Schemas (for Supabase storage) ----------------------------------#

class EdgeBase(BaseModel):
    # Database edge schema - stores React Flow edge data
    board_id: UUID
    edge_id: str  # React Flow edge ID (string)
    source: str  # Source node ID (string)
    target: str  # Target node ID (string)
    edge_type: Optional[str] = "default"
    label: Optional[str] = None
    # Store all React Flow edge data as JSONB
    data: Optional[Dict[str, Any]] = None
    is_deleted: bool = False


class EdgeCreate(EdgeBase):
    pass


class EdgeUpdate(BaseModel):
    board_id: Optional[UUID] = None
    source: Optional[str] = None
    target: Optional[str] = None
    edge_type: Optional[str] = None
    label: Optional[str] = None
    data: Optional[Dict[str, Any]] = None
    is_deleted: Optional[bool] = None


class EdgeDelete(BaseModel):
    edge_id: str  # React Flow uses string IDs
    board_id: Optional[UUID] = None


class EdgeResponse(EdgeBase):
    id: UUID  # Database primary key
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# ---------------------------- Chat Message Schemas ----------------------------------#

class ChatMessageBase(BaseModel):
    board_id: UUID
    node_id: str  # React Flow node ID (string)
    role: NodeRole
    content: str
    model: Optional[str] = None
    temperature: Optional[float] = None
    meta: Optional[Dict[str, Any]] = Field(default_factory=dict)


class ChatMessageCreate(ChatMessageBase):
    pass


class ChatMessageResponse(ChatMessageBase):
    id: UUID
    created_at: datetime

    class Config:
        from_attributes = True


# ---------------------------- API Request/Response Schemas ----------------------------------#

# ---------------------------- Board API Schemas ----------------------------------#
class BoardGetResponse(BaseModel):
    # GET /api/boards/:boardId response
    
    board: BoardBase
    nodes: List[ReactFlowNode]  # Return React Flow format
    edges: List[ReactFlowEdge]  # Return React Flow format


class BoardSaveRequest(BaseModel):
    # POST /api/boards/:boardId/save request
    
    nodes: List[ReactFlowNode]  # Accept React Flow format
    edges: List[ReactFlowEdge]  # Accept React Flow format


class BoardSaveResponse(BaseModel):
    # POST /api/boards/:boardId/save response
    
    message: str
    nodes_saved: int
    edges_saved: int


# ---------------------------- Chat API Schemas ----------------------------------#
class ChatMessageDTO(BaseModel):
    role: NodeRole
    content: str
    model: Optional[str] = None
    temperature: Optional[float] = None


class ChatMessagesResponse(BaseModel):
    # GET /api/boards/:boardId/chat?limit=50 response
    
    messages: List[ChatMessageResponse]


class ChatRequest(BaseModel):
    # POST /api/boards/:boardId/chat request
    
    node_id: str  # React Flow node ID
    message: ChatMessageDTO
    context_node_ids: Optional[List[str]] = None  # Parent node IDs for context


class ChatResponse(BaseModel):
    # POST /api/boards/:boardId/chat response
    
    message: ChatMessageResponse
    assistant_reply: ChatMessageResponse


# ---------------------------- Branch API Schemas ----------------------------------#
class BranchHighlightRequest(BaseModel):
    # POST /api/boards/:boardId/nodes/branch/highlight
    
    board_id: UUID
    source_node_id: str  # React Flow node ID
    highlighted_text: str
    new_node_data: Optional[Dict[str, Any]] = None
    position: Optional[Position] = None


class BranchFullRequest(BaseModel):
    # POST /api/boards/:boardId/nodes/branch/full
    
    board_id: UUID
    source_node_id: str  # React Flow node ID
    new_node_data: Optional[Dict[str, Any]] = None
    position: Optional[Position] = None


class BranchCreateResponse(BaseModel):
    node: ReactFlowNode
    edge: ReactFlowEdge


# ---------------------------- Merge API Schema ----------------------------------#
class MergeNodesRequest(BaseModel):
    # POST /api/boards/:boardId/nodes/merge
    
    board_id: UUID
    source_node_ids: List[str]  # React Flow node IDs
    target_node_id: str  # React Flow node ID
    new_node_data: Optional[Dict[str, Any]] = None


# Node Update API (for highlighting/starring)
class NodeUpdateRequest(BaseModel):
    # PATCH /api/boards/:boardId/nodes/:nodeId

    node_id: str  # React Flow node ID
    board_id: UUID
    data: Optional[Dict[str, Any]] = None  # Update node.data
    position: Optional[Position] = None
    width: Optional[float] = None
    height: Optional[float] = None


# ---------------------------- Flow API Schemas (legacy support) ----------------------------------#
class FlowSave(BaseModel):
    # Legacy flow save - accepts React Flow format

    flow_id: Optional[UUID] = None
    nodes: List[ReactFlowNode] = []
    edges: List[ReactFlowEdge] = []
    metadata: Optional[Dict[str, Any]] = {}


class FlowResponse(BaseModel):
    # Legacy flow response - returns React Flow format

    flow_id: UUID
    nodes: List[ReactFlowNode] = []
    edges: List[ReactFlowEdge] = []
    metadata: Optional[Dict[str, Any]] = {}
    message: Optional[str] = None


class FlowReset(BaseModel):
    flow_id: UUID


# ---------------------------- GPT Schemas ----------------------------------#  
class GPTRequest(BaseModel):
    prompt: str
    context: Optional[Dict[str, Any]] = None
    parameters: Optional[Dict[str, Any]] = None


class GPTResponse(BaseModel):
    response: str
    status: str
    metadata: Optional[Dict[str, Any]] = None

