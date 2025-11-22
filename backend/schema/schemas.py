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
    id: str
    name: str

class BoardCreate(BaseModel):
    name: str

class BoardUpdate(BaseModel):
    name: Optional[str] = None

# ---------------------------- Database Node Schemas (for Supabase storage) ----------------------------------#

class NodeBase(BaseModel):
    # Database node schema - stores React Flow node data
    id: str  # React Flow node ID (string)
    board_id: str
    x: float
    y: float
    width: Optional[float] = None
    height: Optional[float] = None
    title: Optional[str] = None
    prompt: Optional[str] = None  # CHANGED: was content (user input)
    response: Optional[str] = None  # NEW: Gemini generated content
    context: Optional[str] = None  # NEW: Context information for the node
    role: Optional[str] = None
    is_root: bool = False
    is_collapsed: bool = False
    is_starred: bool = False
    model: Optional[str] = None

class NodeCreate(NodeBase):
    id: str  # React Flow node ID (string)
    board_id: str
    x: float
    y: float
    width: Optional[float] = None
    height: Optional[float] = None
    title: Optional[str] = None
    prompt: Optional[str] = None
    context: Optional[str] = None  # NEW
    role: Optional[str] = None
    is_root: bool = False
    is_collapsed: bool = False
    is_starred: bool = False

# Add this after NodeCreate (around line 124)
class NodeUpdate(BaseModel):
    # All fields optional for updates
    id: Optional[str] = None  # Not used in updates
    board_id: Optional[str] = None
    x: Optional[float] = None
    y: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None
    title: Optional[str] = None
    prompt: Optional[str] = None  # User input / prompt
    response: Optional[str] = None  # ADD: Gemini generated response
    context: Optional[str] = None  # NEW: Context information
    role: Optional[str] = None
    is_root: Optional[bool] = None
    is_collapsed: Optional[bool] = None
    is_starred: Optional[bool] = None
    model: Optional[str] = None

# ---------------------------- Database Edge Schemas (for Supabase storage) ----------------------------------#

class EdgeBase(BaseModel):
    # Database edge schema - stores React Flow edge data
    id: str  # React Flow edge ID (string)
    board_id: str
    source_node_id: str  # Source node ID (string)
    target_node_id: str  # Target node ID (string)
    edge_type: Optional[str] = "default"
    label: Optional[str] = None

# ============================================================================
# ---------------------------- Chat Message Schemas ----------------------------------#

class ChatMessageBase(BaseModel):
    board_id: UUID
    node_id: str  # React Flow node ID (string)
    role: NodeRole
    content: str
    model: Optional[str] = None
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


# ---------------------------- GPT Schemas - MIGHT BE REDUNDANT ----------------------------------#  
class GPTRequest(BaseModel):
    prompt: str
    context: Optional[Dict[str, Any]] = None
    parameters: Optional[Dict[str, Any]] = None


class GPTResponse(BaseModel):
    response: str
    status: str
    metadata: Optional[Dict[str, Any]] = None

# ---------------------------- LLM Service Schemas (for Gemini API) ----------------------------------#
class LLMNodeContext(BaseModel):
    """Context information from a node for LLM processing"""
    node_id: str
    title: Optional[str] = None
    role: Optional[str] = None  # Will be NodeRole enum value as string
    prompt: Optional[str] = None  # CHANGED: was content
    model: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class LLMServiceRequest(BaseModel):
    """Request to generate content using LLM with node context"""
    node_id: str  # React Flow node ID (string)
    prompt: str
    operation_type: Optional[str] = None  # e.g., "enhance", "expand", "summarize"


class LLMServiceResponse(BaseModel):
    """Response from LLM service"""
    success: bool
    node_id: str
    generated_content: Optional[str] = None
    error: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    timestamp: datetime