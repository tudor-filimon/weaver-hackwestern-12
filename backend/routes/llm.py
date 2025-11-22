from fastapi import APIRouter, HTTPException
from schema.schemas import LLMServiceRequest, LLMServiceResponse
from services.llm_service import llm_service

router = APIRouter()

@router.post("/test", response_model=dict)
async def test_gemini_basic():
    from google import genai
    import os
    from dotenv import load_dotenv
    load_dotenv()
    api_key = os.environ.get("GEMINI_API_KEY")

    if not api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY is not set")

    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model="gemini-2.5-flash-lite",
            contents="Hello, world!"
        )
        return {"message": response.text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate", response_model=LLMServiceResponse)
async def generate_content(request: LLMServiceRequest):
    return await llm_service.generate_content(request)