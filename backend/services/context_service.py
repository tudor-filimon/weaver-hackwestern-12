"""
Context service for building LLM context from parent nodes
"""
from typing import Optional, List, Dict
from database import supabase


def get_parent_nodes(node_id: str, board_id: str) -> List[Dict]:
    """
    Get all parent nodes of a given node by traversing edges.
    Returns a list of parent node data.
    """
    try:
        # Find all edges where this node is the target
        edges_result = supabase.table("edges")\
            .select("source_node_id")\
            .eq("target_node_id", node_id)\
            .eq("board_id", board_id)\
            .execute()
        
        if not edges_result.data:
            return []
        
        # Get all parent node IDs
        parent_ids = [edge["source_node_id"] for edge in edges_result.data]
        
        # Fetch parent node data
        parents_result = supabase.table("nodes")\
            .select("id, title, prompt, response, context")\
            .in_("id", parent_ids)\
            .execute()
        
        return parents_result.data if parents_result.data else []
    
    except Exception as e:
        print(f"Error getting parent nodes: {e}")
        return []


def build_context_from_parents(node_id: str, board_id: str) -> Optional[str]:
    """
    Build context string from parent nodes.
    
    Format:
    === Parent Context ===
    
    [Parent Title]
    User: [parent prompt]
    Assistant: [parent response]
    
    [Parent's Context (if exists)]
    
    =====================
    """
    parents = get_parent_nodes(node_id, board_id)
    
    if not parents:
        return None
    
    context_parts = ["=== Context from Parent Nodes ===\n"]
    
    for parent in parents:
        # Add parent's conversation
        if parent.get("title"):
            context_parts.append(f"\n[{parent['title']}]")
        
        if parent.get("prompt"):
            context_parts.append(f"User: {parent['prompt']}")
        
        if parent.get("response"):
            context_parts.append(f"Assistant: {parent['response']}")
        
        # Add parent's context (which may include grandparents)
        if parent.get("context"):
            context_parts.append(f"\n{parent['context']}")
        
        context_parts.append("\n" + "-" * 50 + "\n")
    
    context_parts.append("=================================\n")
    
    return "\n".join(context_parts)


def update_node_context(node_id: str, board_id: str) -> Optional[str]:
    """
    Build and update the context for a node based on its parents.
    Returns the built context string.
    """
    try:
        context = build_context_from_parents(node_id, board_id)
        
        if context:
            # Update the node's context in the database
            supabase.table("nodes")\
                .update({"context": context})\
                .eq("id", node_id)\
                .execute()
        
        return context
    
    except Exception as e:
        print(f"Error updating node context: {e}")
        return None

# Add this function to handle highlighted text in context
def build_context_with_highlight(parent_node_id: str, highlighted_text: str, board_id: str) -> str:
    """
    Build context that emphasizes highlighted text from parent.
    """
    # Get parent node's full conversation
    parent_result = supabase.table("nodes").select("prompt, response, context").eq("id", parent_node_id).execute()
    
    if not parent_result.data:
        return None
    
    parent = parent_result.data[0]
    
    context_parts = []
    
    # Add parent's existing context (if any)
    if parent.get("context"):
        context_parts.append(parent["context"])
        context_parts.append("\n" + "=" * 50 + "\n")
    
    # Add parent's conversation
    if parent.get("prompt"):
        context_parts.append(f"Parent Node - User: {parent['prompt']}")
    if parent.get("response"):
        context_parts.append(f"Parent Node - Assistant: {parent['response']}")
    
    # Emphasize the highlighted portion
    context_parts.append("\n" + "=" * 50)
    context_parts.append("=== HIGHLIGHTED TEXT (Focus on this) ===")
    context_parts.append(f'"{highlighted_text}"')
    context_parts.append("=" * 50 + "\n")
    
    return "\n".join(context_parts)
