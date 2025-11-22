from typing import Optional
from dotenv import load_dotenv
from google import genai
from schema.schemas import LLMServiceRequest, LLMServiceResponse, LLMNodeContext
from database import supabase
from datetime import datetime
import os
load_dotenv() # this must exist before genai.configure()


class LLMService:
    """Service layer for LLM operations"""
    
    def __init__(self):
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY must be set in environment variables")
        self.client = genai.Client(api_key=api_key)  # Pass API key here
        self.default_model = "gemini-2.5-flash-lite"
        self.default_temperature = 0.5
        self.default_max_tokens = 1024
        
    def _get_node_context(self, node_id: str) -> Optional[LLMNodeContext]:
        """Fetch node data from database to use as context"""
        try:
            result = supabase.table("nodes").select("*").eq("id", node_id).execute()
            
            if result.data and len(result.data) > 0:
                node = result.data[0]
                
                return LLMNodeContext(
                    node_id=node_id,
                    title=node.get("title"),
                    role=node.get("role"),
                    prompt=node.get("prompt"),  # CHANGED: was content, now prompt (from database)
                    model=node.get("model"),
                    metadata=node.get("metadata")
                )
            return None
        except Exception as e:
            print(f"Error fetching node context: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    def _build_prompt(self, request: LLMServiceRequest, node_context: Optional[LLMNodeContext]) -> str:
        """Build the full prompt with node context"""
        prompt_parts = []
        
        # NEW: Get stored context from database (parent nodes)
        try:
            node_result = supabase.table("nodes").select("context").eq("id", request.node_id).execute()
            stored_context = node_result.data[0].get("context") if node_result.data else None
            
            if stored_context:
                prompt_parts.append(stored_context)
                prompt_parts.append("\n" + "=" * 50 + "\n")
        except Exception as e:
            print(f"Error fetching stored context: {e}")
        
        # Add current node information
        if node_context:
            context_text = f"Current Node Information:\n"
            if node_context.title:
                context_text += f"- Title: {node_context.title}\n"
            if node_context.role:
                context_text += f"- Role: {node_context.role}\n"
            if node_context.prompt:
                context_text += f"- Prompt: {node_context.prompt}\n"
            prompt_parts.append(context_text)
            prompt_parts.append("\n---\n\n")

        # Add user prompt
        prompt_parts.append(request.prompt)
        
        return "\n".join(prompt_parts)
    
    async def generate_content(self, request: LLMServiceRequest) -> LLMServiceResponse:
        """
        Main method to generate content using LLM with node context
        
        Args:
            request: LLMServiceRequest with node_id and prompt
            
        Returns:
            LLMServiceResponse with generated content or error
        """
        try:
            # Get node context
            node_context = self._get_node_context(request.node_id)
            
            if not node_context:
                return LLMServiceResponse(
                    success=False,
                    node_id=request.node_id,
                    error=f"Node {request.node_id} not found",
                    timestamp=datetime.now()
                )
            
            # Build prompt with context
            full_prompt = self._build_prompt(request, node_context)
            
            
            response = self.client.models.generate_content(
                model=self.default_model,
                contents=full_prompt,
            )
            
            # Extract metadata if available
            metadata = {}
            if hasattr(response, 'usage_metadata'):
                usage = response.usage_metadata
                metadata = {
                    "prompt_tokens": getattr(usage, 'prompt_token_count', None),
                    "completion_tokens": getattr(usage, 'candidates_token_count', None),
                    "total_tokens": getattr(usage, 'total_token_count', None),
                    "model": self.default_model
                }
            
            return LLMServiceResponse(
                success=True,
                node_id=request.node_id,
                generated_content=response.text,
                metadata=metadata,
                timestamp=datetime.now()
            )
            
        except Exception as e:
            return LLMServiceResponse(
                success=False,
                node_id=request.node_id,
                error=str(e),
                timestamp=datetime.now()
            )
    
    async def enhance_node_content(self, node_id: str, prompt: str, operation_type: str = "enhance") -> LLMServiceResponse:
        """
        Convenience method for enhancing node content
        
        Args:
            node_id: ID of the node to enhance
            prompt: User's prompt/instruction
            operation_type: Type of operation (e.g., "expand", "summarize", "enhance")
        """
        request = LLMServiceRequest(
            node_id=node_id,
            prompt=prompt,
            operation_type=operation_type
        )
        return await self.generate_content(request)


# Create singleton instance
llm_service = LLMService()

