-- ============================================================================
-- Mock Data Insert Script for Supabase
-- Inserts: 1 board, 5 nodes, 4 edges, 5 chat_messages
-- ============================================================================

-- Clear existing data (optional - uncomment if you want to reset)
-- DELETE FROM chat_messages;
-- DELETE FROM edges;
-- DELETE FROM nodes;
-- DELETE FROM boards;

-- ============================================================================
-- INSERT BOARDS
-- ============================================================================
INSERT INTO boards (id, name)
VALUES ('board-001', 'Product Planning Canvas');

-- ============================================================================
-- INSERT NODES
-- ============================================================================
INSERT INTO nodes (
    id, board_id, x, y, width, height, title, content, role,
    is_root, is_collapsed, is_starred, color, icon, model, temperature, metadata
) VALUES
    (
        'node-001',
        'board-001',
        250.0,
        100.0,
        200.0,
        150.0,
        'Initial Idea',
        'We want to build a new AI-powered note-taking app',
        'user',
        TRUE,
        FALSE,
        TRUE,
        '#3b82f6',
        '💡',
        'gemini-2.0-flash-exp',
        0.7,
        '{}'::jsonb
    ),
    (
        'node-002',
        'board-001',
        100.0,
        300.0,
        200.0,
        150.0,
        'Features',
        'Key features: voice notes, auto-summarization, smart tags',
        'assistant',
        FALSE,
        FALSE,
        FALSE,
        '#10b981',
        '✨',
        'gemini-2.0-flash-exp',
        0.7,
        '{}'::jsonb
    ),
    (
        'node-003',
        'board-001',
        400.0,
        300.0,
        200.0,
        150.0,
        'Target Users',
        'Primary users: students, researchers, knowledge workers',
        'assistant',
        FALSE,
        FALSE,
        FALSE,
        '#8b5cf6',
        '👥',
        'gemini-2.0-flash-exp',
        0.7,
        '{}'::jsonb
    ),
    (
        'node-004',
        'board-001',
        100.0,
        500.0,
        200.0,
        150.0,
        'Tech Stack',
        'React + FastAPI + Supabase + Gemini API',
        'user',
        FALSE,
        FALSE,
        FALSE,
        '#f59e0b',
        '⚙️',
        'gemini-2.0-flash-exp',
        0.7,
        '{}'::jsonb
    ),
    (
        'node-005',
        'board-001',
        400.0,
        500.0,
        200.0,
        150.0,
        'MVP Timeline',
        'Phase 1: Core note-taking (4 weeks), Phase 2: AI features (6 weeks)',
        'assistant',
        FALSE,
        FALSE,
        FALSE,
        '#ef4444',
        '📅',
        'gemini-2.0-flash-exp',
        0.7,
        '{}'::jsonb
    );

-- ============================================================================
-- INSERT EDGES
-- ============================================================================
INSERT INTO edges (
    id, board_id, source_node_id, target_node_id, edge_type, label, is_deleted
) VALUES
    (
        'edge-001',
        'board-001',
        'node-001',
        'node-002',
        'default',
        'explores',
        FALSE
    ),
    (
        'edge-002',
        'board-001',
        'node-001',
        'node-003',
        'default',
        'defines',
        FALSE
    ),
    (
        'edge-003',
        'board-001',
        'node-002',
        'node-004',
        'default',
        'requires',
        FALSE
    ),
    (
        'edge-004',
        'board-001',
        'node-003',
        'node-005',
        'default',
        'informs',
        FALSE
    );

-- ============================================================================
-- INSERT CHAT_MESSAGES
-- ============================================================================
INSERT INTO chat_messages (
    id, board_id, node_id, role, content, model, temperature, meta
) VALUES
    (
        'chat-001',
        'board-001',
        'node-001',
        'user',
        'We want to build a new AI-powered note-taking app',
        'gemini-2.0-flash-exp',
        0.7,
        '{}'::jsonb
    ),
    (
        'chat-002',
        'board-001',
        'node-002',
        'assistant',
        'Key features: voice notes, auto-summarization, smart tags',
        'gemini-2.0-flash-exp',
        0.7,
        '{"tokens_used": 150, "latency_ms": 1200}'::jsonb
    ),
    (
        'chat-003',
        'board-001',
        'node-003',
        'assistant',
        'Primary users: students, researchers, knowledge workers',
        'gemini-2.0-flash-exp',
        0.7,
        '{"tokens_used": 120, "latency_ms": 980}'::jsonb
    ),
    (
        'chat-004',
        'board-001',
        'node-004',
        'user',
        'React + FastAPI + Supabase + Gemini API',
        'gemini-2.0-flash-exp',
        0.7,
        '{}'::jsonb
    ),
    (
        'chat-005',
        'board-001',
        'node-005',
        'assistant',
        'Phase 1: Core note-taking (4 weeks), Phase 2: AI features (6 weeks)',
        'gemini-2.0-flash-exp',
        0.7,
        '{"tokens_used": 180, "latency_ms": 1500}'::jsonb
    );

-- ============================================================================
-- VERIFICATION QUERIES (Optional - run these to verify the data)
-- ============================================================================

-- Check board count
-- SELECT COUNT(*) as board_count FROM boards;

-- Check node count
-- SELECT COUNT(*) as node_count FROM nodes;

-- Check edge count
-- SELECT COUNT(*) as edge_count FROM edges;

-- Check chat message count
-- SELECT COUNT(*) as chat_count FROM chat_messages;

-- View full board structure
-- SELECT 
--     b.id as board_id,
--     b.name as board_name,
--     n.id as node_id,
--     n.title as node_title,
--     cm.content as chat_content
-- FROM boards b
-- LEFT JOIN nodes n ON n.board_id = b.id
-- LEFT JOIN chat_messages cm ON cm.node_id = n.id
-- WHERE b.id = 'board-001'
-- ORDER BY n.x, n.y;