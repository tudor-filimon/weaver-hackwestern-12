from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import board

# Fast API App
app = FastAPI(title="bn.AI")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],  # Add your frontend URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(board.router, prefix="/api/boards")


@app.get("/")
async def root():
    return {"message": "Welcome to the Backend"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)