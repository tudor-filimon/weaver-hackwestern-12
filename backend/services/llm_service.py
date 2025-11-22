from typing import Optional
from google import genai
from schema.schemas import LLMServiceRequest, LLMServiceResponse, LLMNodeContext
from database import supabase
from datetime import datetime
import os

class LLMService:
    """Service layer for LLM operations"""
    
    def __init__(self):
        self.client = genai.Client()
        self.default_model = "gemini-2.5-flash-lite"
        self.default_temperature = 0.2
        self.default_max_tokens = 2048
    
    def _get_node_context(self, node_id: int) -> Optional[LLMNodeContext]:
        """Fetch node data from database to use as context"""
        try:
            result = supabase.table("nodes").select("*").eq("id", node_id).execute()
            if result.data and len(result.data) > 0:
                node = result.data[0]
                return LLMNodeContext(
                    node_id=node_id,
                    name=node.get("name"),
                    type=node.get("type"),
                    content=node.get("data", {}).get("content") if isinstance(node.get("data"), dict) else None,
                    data=node.get("data")
                )
            return None
        except Exception as e:
            print(f"Error fetching node context: {e}")
            return None
    
    def _build_prompt(self, request: LLMServiceRequest, node_context: Optional[LLMNodeContext]) -> str:
        """Build the full prompt with node context"""
        prompt_parts = []
        
        # Add node context if available
        if node_context:
            context_text = f"Node Information:\n"
            if node_context.name:
                context_text += f"- Name: {node_context.name}\n"
            if node_context.type:
                context_text += f"- Type: {node_context.type}\n"
            if node_context.content:
                context_text += f"- Content: {node_context.content}\n"
            
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
            
            # Prepare generation config
            generation_config = {
                "temperature": request.temperature or self.default_temperature,
                "max_output_tokens": request.max_tokens or self.default_max_tokens
            }
            
            # Call Gemini API
            response = self.client.models.generate_content(
                model=self.default_model,
                contents=full_prompt,
                generation_config=generation_config
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
    
    async def enhance_node_content(self, node_id: int, prompt: str, operation_type: str = "enhance") -> LLMServiceResponse:
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