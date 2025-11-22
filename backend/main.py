from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import branch, edge, flow, node

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
app.include_router(branch.router, prefix="/api/branches", tags=["branches"])
app.include_router(edge.router, prefix="/api/edges", tags=["edges"])
app.include_router(flow.router, prefix="/api/flows", tags=["flows"])
app.include_router(node.router, prefix="/api/nodes", tags=["nodes"])


@app.get("/")
async def root():
    return {"message": "Welcome to the Backend"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)