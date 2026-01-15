"""
Smart Inbox - Email Classification API
Auto-label emails by content/subject/sender
"""
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import router
from app.models import init_db

# Create FastAPI app
app = FastAPI(
    title="Smart Inbox API",
    description="Email Classification & Smart Inbox - Auto-label emails by content/subject/sender",
    version="1.0.0"
)

# CORS middleware for frontend
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:8080",
    "http://localhost:5000",
    "http://localhost:9000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:8080",
    "http://161.97.74.232",
    "http://161.97.74.232:80",
    "http://161.97.74.232:5173",
    "http://161.97.74.232:5174",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(router, prefix="/api")


@app.on_event("startup")
async def startup():
    """Initialize database and default labels on startup"""
    from app.models import get_db, Label, DEFAULT_LABELS
    from sqlalchemy.orm import Session

    init_db()

    # Initialize default labels
    db = next(get_db())
    try:
        for label_data in DEFAULT_LABELS:
            existing = db.query(Label).filter(Label.name == label_data["name"]).first()
            if not existing:
                label = Label(**label_data)
                db.add(label)
        db.commit()
    finally:
        db.close()


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "name": "Smart Inbox API",
        "version": "1.0.0",
        "description": "Email Classification & Auto-labeling",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
