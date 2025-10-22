"""
Designer BFF ML Service
Python-based ML service for style profiling, RLHF, and prompt optimization
"""
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional, Any
import logging

from services.style_profiler import StyleProfiler
from services.rlhf_optimizer import RLHFOptimizer
from services.prompt_optimizer import PromptOptimizer
from services.validation_service import ValidationService
from services.dpp_selector import DPPSelector

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Designer BFF ML Service",
    description="ML service for fashion image generation optimization",
    version="1.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
style_profiler = StyleProfiler()
rlhf_optimizer = RLHFOptimizer()
prompt_optimizer = PromptOptimizer()
validation_service = ValidationService()
dpp_selector = DPPSelector()


# ==================== Request/Response Models ====================

class VLTRecord(BaseModel):
    """VLT analysis record"""
    id: str
    garment_type: str
    attributes: Dict[str, Any]
    colors: Dict[str, Any]
    style: Dict[str, Any]
    embedding: Optional[List[float]] = None


class StyleProfileRequest(BaseModel):
    """Request to create/update style profile"""
    user_id: str
    vlt_records: List[VLTRecord]
    n_clusters: Optional[int] = 5


class PromptOptimizationRequest(BaseModel):
    """Request to optimize a prompt"""
    user_id: str
    base_prompt: str
    vlt_spec: Dict[str, Any]
    style_profile: Optional[Dict[str, Any]] = None
    feedback_history: Optional[List[Dict[str, Any]]] = None


class FeedbackRequest(BaseModel):
    """User feedback on generated image"""
    user_id: str
    generation_id: str
    asset_id: str
    feedback_type: str  # 'like', 'dislike', 'outlier'
    prompt_used: str
    vlt_spec: Dict[str, Any]
    quality_score: Optional[float] = None


class ValidationRequest(BaseModel):
    """Request to validate generated images"""
    generation_id: str
    images: List[Dict[str, Any]]
    target_vlt: Dict[str, Any]


class DPPSelectionRequest(BaseModel):
    """Request for DPP-based image selection"""
    images: List[Dict[str, Any]]
    target_count: int
    diversity_weight: float = 0.7
    quality_weight: float = 0.3


# ==================== Stage 2: Style Profile Clustering ====================

@app.post("/api/ml/style-profile/create")
async def create_style_profile(request: StyleProfileRequest):
    """
    Stage 2: Create style profile using GMM clustering
    Clusters VLT records to identify user's style modes
    """
    try:
        logger.info(f"Creating style profile for user {request.user_id}")
        
        profile = style_profiler.create_profile(
            user_id=request.user_id,
            vlt_records=[r.dict() for r in request.vlt_records],
            n_clusters=request.n_clusters
        )
        
        return {
            "success": True,
            "profile": profile,
            "message": f"Style profile created with {len(profile['clusters'])} style modes"
        }
        
    except Exception as e:
        logger.error(f"Style profile creation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/ml/style-profile/update")
async def update_style_profile(request: StyleProfileRequest):
    """
    Update existing style profile with new data
    Uses online learning to adapt to user's evolving style
    """
    try:
        logger.info(f"Updating style profile for user {request.user_id}")
        
        profile = style_profiler.update_profile(
            user_id=request.user_id,
            new_vlt_records=[r.dict() for r in request.vlt_records]
        )
        
        return {
            "success": True,
            "profile": profile,
            "message": "Style profile updated"
        }
        
    except Exception as e:
        logger.error(f"Style profile update failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/ml/style-profile/{user_id}")
async def get_style_profile(user_id: str):
    """Get user's current style profile"""
    try:
        profile = style_profiler.get_profile(user_id)
        
        if not profile:
            raise HTTPException(status_code=404, detail="Style profile not found")
        
        return {
            "success": True,
            "profile": profile
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to retrieve style profile: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Stage 5: RLHF Prompt Optimization ====================

@app.post("/api/ml/prompt/optimize")
async def optimize_prompt(request: PromptOptimizationRequest):
    """
    Stage 5: Optimize prompt using RLHF
    Uses user feedback history to improve prompt generation
    """
    try:
        logger.info(f"Optimizing prompt for user {request.user_id}")
        
        optimized = prompt_optimizer.optimize(
            user_id=request.user_id,
            base_prompt=request.base_prompt,
            vlt_spec=request.vlt_spec,
            style_profile=request.style_profile,
            feedback_history=request.feedback_history or []
        )
        
        return {
            "success": True,
            "optimized_prompt": optimized['prompt'],
            "confidence": optimized['confidence'],
            "adjustments": optimized['adjustments'],
            "metadata": optimized['metadata']
        }
        
    except Exception as e:
        logger.error(f"Prompt optimization failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/ml/feedback/submit")
async def submit_feedback(request: FeedbackRequest):
    """
    Stage 10: Submit user feedback for RLHF training
    Updates reward model based on user preferences
    """
    try:
        logger.info(f"Processing feedback for user {request.user_id}")
        
        result = rlhf_optimizer.process_feedback(
            user_id=request.user_id,
            generation_id=request.generation_id,
            asset_id=request.asset_id,
            feedback_type=request.feedback_type,
            prompt_used=request.prompt_used,
            vlt_spec=request.vlt_spec,
            quality_score=request.quality_score
        )
        
        return {
            "success": True,
            "feedback_processed": True,
            "model_updated": result['model_updated'],
            "new_weights": result.get('weights_summary')
        }
        
    except Exception as e:
        logger.error(f"Feedback processing failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/ml/rlhf/train")
async def train_rlhf_model(user_id: str):
    """
    Trigger RLHF model retraining with accumulated feedback
    Should be called periodically (e.g., after N feedbacks)
    """
    try:
        logger.info(f"Training RLHF model for user {user_id}")
        
        result = rlhf_optimizer.train_model(user_id)
        
        return {
            "success": True,
            "training_completed": True,
            "metrics": result['metrics'],
            "iterations": result['iterations']
        }
        
    except Exception as e:
        logger.error(f"RLHF training failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Stage 8: Validation & Quality Control ====================

@app.post("/api/ml/validate")
async def validate_generation(request: ValidationRequest):
    """
    Stage 8: Validate generated images against target VLT spec
    Uses Isolation Forest for outlier detection
    """
    try:
        logger.info(f"Validating generation {request.generation_id}")
        
        results = validation_service.validate_images(
            images=request.images,
            target_vlt=request.target_vlt
        )
        
        return {
            "success": True,
            "validation_results": results['validations'],
            "summary": results['summary'],
            "outliers": results['outliers']
        }
        
    except Exception as e:
        logger.error(f"Validation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Stage 9: DPP Selection for Diversity ====================

@app.post("/api/ml/select/diverse")
async def select_diverse_images(request: DPPSelectionRequest):
    """
    Stage 9: Select most diverse subset using DPP
    Ensures coverage across style attributes
    """
    try:
        logger.info(f"Selecting {request.target_count} diverse images from {len(request.images)}")
        
        selection = dpp_selector.select_diverse(
            images=request.images,
            target_count=request.target_count,
            diversity_weight=request.diversity_weight,
            quality_weight=request.quality_weight
        )
        
        return {
            "success": True,
            "selected_images": selection['selected'],
            "rejected_images": selection['rejected'],
            "diversity_score": selection['diversity_score'],
            "coverage_metrics": selection['coverage']
        }
        
    except Exception as e:
        logger.error(f"DPP selection failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Health & Status ====================

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "Designer BFF ML Service",
        "version": "1.0.0",
        "components": {
            "style_profiler": style_profiler.is_ready(),
            "rlhf_optimizer": rlhf_optimizer.is_ready(),
            "prompt_optimizer": prompt_optimizer.is_ready(),
            "validation_service": validation_service.is_ready(),
            "dpp_selector": dpp_selector.is_ready()
        }
    }


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "Designer BFF ML Service",
        "status": "running",
        "docs": "/docs"
    }


if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv("ML_SERVICE_PORT", 8001))
    
    logger.info(f"Starting ML Service on port {port}")
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=True,
        log_level="info"
    )
