"""
Minimal Designer BFF ML Service
Python-based ML service for style profiling
"""
import os
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional, Any
import logging

from services.style_profiler import StyleProfiler

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Designer BFF ML Service",
    description="ML service for fashion style profiling",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
style_profiler = StyleProfiler()

# Request/Response models
class VLTRecord(BaseModel):
    garmentType: Optional[str] = None
    silhouette: Optional[str] = None
    fabric: Optional[Dict] = None
    colors: Optional[Dict] = None
    style: Optional[Dict] = None
    attributes: Optional[Dict] = None

class StyleProfileRequest(BaseModel):
    userId: str
    records: List[VLTRecord]
    options: Optional[Dict] = {}

# Routes
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "ml-service",
        "version": "1.0.0",
        "timestamp": None
    }

@app.post("/api/style-profile")
async def generate_style_profile(request: StyleProfileRequest):
    """
    Generate style profile with GMM clustering
    """
    try:
        logger.info(f"Generating style profile for user {request.userId}")
        logger.info(f"Received {len(request.records)} records")
        
        # Convert records to dict format
        records_data = [record.dict() for record in request.records]
        
        # Generate profile using GMM
        profile = style_profiler.create_profile(
            user_id=request.userId,
            vlt_records=records_data,
            n_clusters=request.options.get('n_clusters', 3)
        )
        
        return {
            "success": True,
            "userId": request.userId,
            "profile": profile
        }
        
    except Exception as e:
        logger.error(f"Style profile generation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/style-profile/{userId}")
async def get_style_profile(userId: str):
    """
    Retrieve existing style profile for a user
    """
    try:
        logger.info(f"Fetching style profile for user {userId}")
        
        profile = style_profiler.get_profile(userId)
        
        if not profile:
            raise HTTPException(status_code=404, detail=f"No profile found for user {userId}")
        
        return {
            "success": True,
            "userId": userId,
            "profile": profile
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch style profile: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
async def root():
    return {
        "service": "Designer BFF ML Service",
        "status": "running",
        "endpoints": [
            "/health",
            "/api/style-profile (POST)",
            "/api/style-profile/{userId} (GET)"
        ]
    }

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8001))
    logger.info(f"Starting ML Service on port {port}")
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        log_level="info"
    )
