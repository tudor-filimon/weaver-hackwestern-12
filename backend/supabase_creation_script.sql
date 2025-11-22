-- ============================================================================
-- Supabase Database Schema
-- Tables: boards, nodes, edges, chat_messages
-- ============================================================================

-- ============================================================================
-- BOARDS TABLE
-- ============================================================================
CREATE TABLE boards (
    id TEXT PRIMARY KEY, -- React Flow string ID from frontend
    name TEXT NOT NULL
);

-- ============================================================================
-- NODES TABLE (Fully Normalized)
-- ============================================================================
CREATE TABLE nodes (
    id TEXT PRIMARY KEY, -- React Flow string ID from frontend
    board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    
    -- Position
    x FLOAT NOT NULL,
    y FLOAT NOT NULL,
    width FLOAT,
    height FLOAT,
    
    -- Content / behavior
    title TEXT, -- nodeChatTitle
    content TEXT, -- main text (latest message / summary)
    role TEXT NOT NULL CHECK (role IN ('system', 'user', 'assistant')),
    is_root BOOLEAN DEFAULT FALSE,
    is_collapsed BOOLEAN DEFAULT FALSE,
    is_starred BOOLEAN DEFAULT FALSE,
    
    -- Visual / AI config
    color TEXT, -- node colour / tree colour
    icon TEXT,
    model TEXT, -- e.g. gpt-4.1, gemini-2.0-flash-exp, etc.
    temperature FLOAT,
    metadata JSONB DEFAULT '{}'::jsonb -- extra stuff (kept as JSONB for flexibility)
);

-- ============================================================================
-- EDGES TABLE
-- ============================================================================
CREATE TABLE edges (
    id TEXT PRIMARY KEY, -- React Flow string ID from frontend
    board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    source_node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    target_node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    
    -- Semantics
    edge_type TEXT DEFAULT 'default' CHECK (edge_type IN ('default', 'merge', 'ref')),
    label TEXT,
    is_deleted BOOLEAN DEFAULT FALSE
);

-- ============================================================================
-- CHAT_MESSAGES TABLE (One message per node)
-- ============================================================================
CREATE TABLE chat_messages (
    id TEXT PRIMARY KEY, -- React Flow string ID from frontend
    board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    node_id TEXT NOT NULL UNIQUE REFERENCES nodes(id) ON DELETE CASCADE, -- UNIQUE ensures one message per node
    
    -- Message data
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    model TEXT, -- AI model used
    temperature FLOAT,
    meta JSONB DEFAULT '{}'::jsonb -- token usage, latency, etc. (kept as JSONB for flexibility)
);

-- ============================================================================
-- INDEXES for Performance
-- ============================================================================

-- Board indexes
-- (No indexes needed for boards unless you query by name frequently)

-- Node indexes
CREATE INDEX idx_nodes_board_id ON nodes(board_id);
CREATE INDEX idx_nodes_board_position ON nodes(board_id, x, y);
CREATE INDEX idx_nodes_role ON nodes(role);
CREATE INDEX idx_nodes_is_root ON nodes(is_root) WHERE is_root = TRUE;

-- Edge indexes
CREATE INDEX idx_edges_board_id ON edges(board_id);
CREATE INDEX idx_edges_source_node ON edges(source_node_id);
CREATE INDEX idx_edges_target_node ON edges(target_node_id);
CREATE INDEX idx_edges_type ON edges(edge_type);
CREATE INDEX idx_edges_not_deleted ON edges(board_id) WHERE is_deleted = FALSE;

-- Chat message indexes
CREATE INDEX idx_chat_messages_node_id ON chat_messages(node_id);
CREATE INDEX idx_chat_messages_board_id ON chat_messages(board_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) - Disabled since no auth
-- ============================================================================
ALTER TABLE boards DISABLE ROW LEVEL SECURITY;
ALTER TABLE nodes DISABLE ROW LEVEL SECURITY;
ALTER TABLE edges DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- HELPER FUNCTIONS (Optional - for easier queries)
-- ============================================================================

-- Get all nodes for a board with their chat messages
CREATE OR REPLACE FUNCTION get_board_with_nodes(board_id_param TEXT)
RETURNS TABLE (
    node_id TEXT,
    node_x FLOAT,
    node_y FLOAT,
    node_title TEXT,
    node_content TEXT,
    node_role TEXT,
    chat_content TEXT,
    chat_role TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        n.id,
        n.x,
        n.y,
        n.title,
        n.content,
        n.role,
        cm.content,
        cm.role
    FROM nodes n
    LEFT JOIN chat_messages cm ON n.id = cm.node_id
    WHERE n.board_id = board_id_param;
END;
$$ LANGUAGE plpgsql;

-- Get all edges for a board
CREATE OR REPLACE FUNCTION get_board_edges(board_id_param TEXT)
RETURNS TABLE (
    edge_id TEXT,
    source_node_id TEXT,
    target_node_id TEXT,
    edge_type TEXT,
    label TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.id,
        e.source_node_id,
        e.target_node_id,
        e.edge_type,
        e.label
    FROM edges e
    WHERE e.board_id = board_id_param
    AND e.is_deleted = FALSE;
END;
$$ LANGUAGE plpgsql;