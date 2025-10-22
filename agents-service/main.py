"""
FastAPI Agents Microservice for Designer's BFF
This service provides the 5 specialized AI agents as HTTP endpoints
to be consumed by the existing Node.js backend.
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import logging
import sys
from datetime import datetime
import uuid
import asyncio
import httpx
import json
import os
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Designer's BFF - AI Agents Service",
    description="Multi-agent system for fashion image generation",
    version="1.0.0"
)

# CORS for Node.js backend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5000", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Persistent storage setup
STORAGE_DIR = Path("./data")
STORAGE_DIR.mkdir(exist_ok=True)
PROFILES_FILE = STORAGE_DIR / "style_profiles.json"
BATCH_JOBS_FILE = STORAGE_DIR / "batch_jobs.json"

# Load from disk or initialize
def load_storage():
    """Load data from disk"""
    profiles = {}
    jobs = {}
    
    if PROFILES_FILE.exists():
        try:
            with open(PROFILES_FILE, 'r') as f:
                profiles = json.load(f)
            logger.info(f"Loaded {len(profiles)} style profiles from disk")
        except Exception as e:
            logger.error(f"Error loading profiles: {e}")
    
    if BATCH_JOBS_FILE.exists():
        try:
            with open(BATCH_JOBS_FILE, 'r') as f:
                jobs = json.load(f)
            logger.info(f"Loaded {len(jobs)} batch jobs from disk")
        except Exception as e:
            logger.error(f"Error loading batch jobs: {e}")
    
    return profiles, jobs

def save_profiles(profiles):
    """Save profiles to disk"""
    try:
        with open(PROFILES_FILE, 'w') as f:
            json.dump(profiles, f, indent=2)
        logger.debug(f"Saved {len(profiles)} profiles to disk")
    except Exception as e:
        logger.error(f"Error saving profiles: {e}")

def save_batch_jobs(jobs):
    """Save batch jobs to disk"""
    try:
        with open(BATCH_JOBS_FILE, 'w') as f:
            json.dump(jobs, f, indent=2)
        logger.debug(f"Saved {len(jobs)} batch jobs to disk")
    except Exception as e:
        logger.error(f"Error saving batch jobs: {e}")

# Load from disk on startup
style_profiles, batch_jobs = load_storage()
generated_images = {}

# ============= REQUEST/RESPONSE MODELS =============

class PortfolioAnalysisRequest(BaseModel):
    designer_id: str
    images: List[str]  # Base64 encoded images or URLs

class StyleProfile(BaseModel):
    designer_id: str
    version: int
    profile_data: Dict[str, Any]
    confidence_score: float

class GenerationRequest(BaseModel):
    designer_id: str
    prompt: str
    mode: str = "specific"  # "specific" or "batch"
    quantity: Optional[int] = 1

class FeedbackInput(BaseModel):
    image_id: str
    designer_id: str
    overall_rating: Optional[int] = None
    selected: bool = False
    rejected: bool = False
    comments: Optional[str] = None

# ============= AGENT IMPLEMENTATIONS =============

class VisualAnalystAgent:
    """Simplified Visual Analyst for integration"""
    
    async def analyze_portfolio(self, images: List[str], designer_id: str) -> Dict[str, Any]:
        """Analyze portfolio and create style profile"""
        logger.info(f"Analyzing {len(images)} images for designer {designer_id}")
        
        # Simulate GPT-4 Vision analysis
        await asyncio.sleep(2)  # Simulate processing time
        
        # Mock analysis result
        profile_data = {
            "version": 1,
            "designer_id": designer_id,
            "signature_elements": {
                "colors": ["#2C3E50", "#E74C3C", "#ECF0F1"],
                "silhouettes": ["A-line", "Fitted", "Oversized"],
                "materials": ["Cotton", "Silk", "Leather"],
                "patterns": ["Minimal", "Geometric", "Solid"]
            },
            "aesthetic_profile": {
                "primary_style": "Contemporary Minimalist",
                "formality_range": {"min": 3, "max": 8, "avg": 6},
                "color_palette_type": "Neutral with accent colors"
            },
            "attribute_weights": {
                "color": 0.8,
                "silhouette": 0.9,
                "material": 0.7,
                "details": 0.6
            },
            "generation_guidelines": {
                "must_maintain": ["Clean lines", "Quality fabrics", "Balanced proportions"],
                "allow_variation": ["Seasonal colors", "Texture details", "Accessories"],
                "avoid": ["Overly busy patterns", "Poor construction", "Clashing colors"]
            },
            "confidence_score": 0.85,
            "images_analyzed": len(images),
            "created_at": datetime.utcnow().isoformat()
        }
        
        return profile_data

class PromptArchitectAgent:
    """Simplified Prompt Architect for integration"""
    
    async def optimize_prompt(self, user_request: str, style_profile: Dict, mode: str = "specific") -> Dict[str, Any]:
        """Optimize prompt based on style profile"""
        logger.info(f"Optimizing prompt for {mode} generation")
        
        # Simulate prompt optimization
        await asyncio.sleep(1)
        
        base_prompt = f"{user_request}, in the style of {style_profile.get('aesthetic_profile', {}).get('primary_style', 'contemporary fashion')}"
        
        if mode == "batch":
            # Generate multiple prompt variations
            prompts = []
            for i in range(20):  # Smaller batch for demo
                variation = f"{base_prompt}, variation {i+1}, professional fashion photography"
                prompts.append({
                    "prompt_id": str(uuid.uuid4()),
                    "prompt": variation,
                    "category": f"batch_item_{i+1}",
                    "parameters": {
                        "quality": "hd",
                        "size": "1024x1792",
                        "style": "natural"
                    }
                })
        else:
            prompts = [{
                "prompt_id": str(uuid.uuid4()),
                "prompt": f"{base_prompt}, professional fashion photography, high quality",
                "category": "specific_request",
                "parameters": {
                    "quality": "hd",
                    "size": "1024x1024",
                    "style": "natural"
                }
            }]
        
        return {
            "mode": mode,
            "total_prompts": len(prompts),
            "prompts": prompts,
            "optimization_applied": True
        }

class ImageRendererAgent:
    """Simplified Image Renderer - calls your existing generation system"""
    
    async def generate_images(self, prompts: List[Dict], batch_id: str, designer_id: str) -> Dict[str, Any]:
        """Generate images using DALL-E 3 (or your existing system)"""
        logger.info(f"Generating {len(prompts)} images for batch {batch_id}")
        
        results = []
        successful = 0
        
        for i, prompt_data in enumerate(prompts):
            try:
                # Simulate image generation
                await asyncio.sleep(0.5)  # Simulate generation time
                
                # Mock successful generation
                if i < len(prompts) * 0.8:  # 80% success rate
                    image_url = f"https://mock-cdn.com/generated/{uuid.uuid4()}.jpg"
                    successful += 1
                    
                    results.append({
                        "prompt_id": prompt_data.get("prompt_id"),
                        "success": True,
                        "image_url": image_url,
                        "category": prompt_data.get("category"),
                        "generation_cost": 0.08,
                        "processing_cost": 0.002,
                        "metadata": {
                            "original_prompt": prompt_data.get("prompt"),
                            "generated_at": datetime.utcnow().isoformat()
                        }
                    })
                else:
                    results.append({
                        "prompt_id": prompt_data.get("prompt_id"),
                        "success": False,
                        "error": "Generation failed (simulated)"
                    })
                    
            except Exception as e:
                logger.error(f"Error generating image {i}: {e}")
                results.append({
                    "prompt_id": prompt_data.get("prompt_id"),
                    "success": False,
                    "error": str(e)
                })
        
        total_cost = successful * 0.082
        
        return {
            "batch_id": batch_id,
            "designer_id": designer_id,
            "total_requested": len(prompts),
            "successful": successful,
            "failed": len(prompts) - successful,
            "results": results,
            "total_cost": total_cost,
            "success_rate": successful / len(prompts) if prompts else 0
        }

class QualityCuratorAgent:
    """Simplified Quality Curator for learning from feedback"""
    
    async def process_feedback(self, feedback_data: List[Dict], designer_id: str, current_profile: Dict) -> Dict[str, Any]:
        """Process feedback and update style profile"""
        logger.info(f"Processing {len(feedback_data)} feedback samples for designer {designer_id}")
        
        # Simulate learning from feedback
        await asyncio.sleep(1)
        
        positive_samples = [f for f in feedback_data if f.get("selected") or f.get("overall_rating", 0) >= 4]
        negative_samples = [f for f in feedback_data if f.get("rejected") or f.get("overall_rating", 0) <= 2]
        
        # Update profile (simplified)
        updated_profile = current_profile.copy()
        updated_profile["version"] = current_profile.get("version", 1) + 1
        updated_profile["feedback_samples"] = current_profile.get("feedback_samples", 0) + len(feedback_data)
        
        # Mock performance metrics
        avg_rating = sum(f.get("overall_rating", 3) for f in feedback_data) / len(feedback_data) if feedback_data else 3
        selection_rate = len(positive_samples) / len(feedback_data) if feedback_data else 0
        
        updated_profile["performance_metrics"] = {
            "average_rating": float(avg_rating),
            "selection_rate": float(selection_rate),
            "rejection_rate": float(len(negative_samples) / len(feedback_data)) if feedback_data else 0,
            "aesthetic_alignment_score": float(avg_rating / 5.0),
            "total_feedback_processed": updated_profile["feedback_samples"]
        }
        
        logger.info(f"Profile updated to version {updated_profile['version']}, avg rating: {avg_rating:.2f}")
        
        return updated_profile

# ============= AGENT INSTANCES =============
visual_analyst = VisualAnalystAgent()
prompt_architect = PromptArchitectAgent()
image_renderer = ImageRendererAgent()
quality_curator = QualityCuratorAgent()

# ============= API ENDPOINTS =============

@app.post("/portfolio/analyze")
async def analyze_portfolio(request: PortfolioAnalysisRequest):
    """Analyze portfolio and create style profile"""
    try:
        profile_data = await visual_analyst.analyze_portfolio(
            request.images, 
            request.designer_id
        )
        
        # Store in memory and persist to disk
        profile_key = f"{request.designer_id}_v{profile_data['version']}"
        style_profiles[profile_key] = profile_data
        save_profiles(style_profiles)
        
        return {
            "success": True,
            "profile_data": profile_data,
            "message": f"Style profile created for designer {request.designer_id}"
        }
        
    except Exception as e:
        logger.error(f"Error analyzing portfolio: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/portfolio/profile/{designer_id}")
async def get_style_profile(designer_id: str, version: Optional[int] = None):
    """Get designer's style profile"""
    try:
        if version:
            profile_key = f"{designer_id}_v{version}"
        else:
            # Get latest version
            keys = [k for k in style_profiles.keys() if k.startswith(f"{designer_id}_v")]
            if not keys:
                raise HTTPException(status_code=404, detail="Style profile not found")
            profile_key = sorted(keys)[-1]  # Latest version
        
        if profile_key not in style_profiles:
            raise HTTPException(status_code=404, detail="Style profile not found")
        
        return {
            "success": True,
            "profile_data": style_profiles[profile_key]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching profile: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.patch("/portfolio/profile/{designer_id}")
async def update_style_profile(designer_id: str, updates: Dict[str, Any]):
    """Update style profile with enriched data (e.g., style tags from Node.js)"""
    try:
        # Get latest profile
        keys = [k for k in style_profiles.keys() if k.startswith(f"{designer_id}_v")]
        if not keys:
            raise HTTPException(status_code=404, detail="Style profile not found")
        
        profile_key = sorted(keys)[-1]
        profile = style_profiles[profile_key]
        
        # Update profile with new data
        profile.update(updates)
        profile["updated_at"] = datetime.utcnow().isoformat()
        save_profiles(style_profiles)
        
        logger.info(f"Updated profile for {designer_id} with keys: {list(updates.keys())}")
        
        return {
            "success": True,
            "profile_data": profile,
            "message": "Profile updated successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating profile: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/generation/generate")
async def generate_images(request: GenerationRequest, background_tasks: BackgroundTasks):
    """Generate images with AI agents"""
    try:
        # Get style profile
        profile_keys = [k for k in style_profiles.keys() if k.startswith(f"{request.designer_id}_v")]
        if not profile_keys:
            raise HTTPException(status_code=404, detail="Style profile not found. Please analyze portfolio first.")
        
        latest_profile = style_profiles[sorted(profile_keys)[-1]]
        
        # Optimize prompt
        prompt_package = await prompt_architect.optimize_prompt(
            request.prompt,
            latest_profile,
            request.mode
        )
        
        if request.mode == "batch":
            # Create batch job
            batch_id = str(uuid.uuid4())
            batch_jobs[batch_id] = {
                "batch_id": batch_id,
                "designer_id": request.designer_id,
                "status": "processing",
                "total_images": len(prompt_package.get("prompts", [])),
                "completed_images": 0,
                "created_at": datetime.utcnow().isoformat()
            }
            
            # Process in background
            background_tasks.add_task(
                process_batch_generation,
                batch_id,
                request.designer_id,
                prompt_package
            )
            
            return {
                "success": True,
                "mode": "batch",
                "batch_id": batch_id,
                "total_images": batch_jobs[batch_id]["total_images"],
                "status": "processing",
                "message": f"Batch generation started. Check status at /generation/batch/{batch_id}/status"
            }
        else:
            # Immediate generation
            results = await image_renderer.generate_images(
                prompt_package.get("prompts", []),
                "specific",
                request.designer_id
            )
            
            return {
                "success": True,
                "mode": "specific",
                "results": results,
                "message": "Generation complete"
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating images: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/generation/batch/{batch_id}/status")
async def get_batch_status(batch_id: str):
    """Get batch generation status"""
    if batch_id not in batch_jobs:
        raise HTTPException(status_code=404, detail="Batch not found")
    
    batch = batch_jobs[batch_id]
    progress = (batch["completed_images"] / batch["total_images"]) * 100 if batch["total_images"] > 0 else 0
    
    return {
        "success": True,
        "batch_id": batch_id,
        "status": batch["status"],
        "progress_percentage": round(progress, 2),
        "total_images": batch["total_images"],
        "completed_images": batch["completed_images"],
        "created_at": batch["created_at"]
    }

@app.post("/feedback/submit")
async def submit_feedback(feedback_list: List[FeedbackInput]):
    """Submit feedback for learning"""
    try:
        if not feedback_list:
            raise HTTPException(status_code=400, detail="Feedback list cannot be empty")
        
        designer_id = feedback_list[0].designer_id
        
        # Convert to dict format
        feedback_data = [
            {
                "image_id": fb.image_id,
                "designer_id": fb.designer_id,
                "overall_rating": fb.overall_rating,
                "selected": fb.selected,
                "rejected": fb.rejected,
                "comments": fb.comments
            }
            for fb in feedback_list
        ]
        
        # Get current profile
        profile_keys = [k for k in style_profiles.keys() if k.startswith(f"{designer_id}_v")]
        if profile_keys:
            current_profile = style_profiles[sorted(profile_keys)[-1]]
            
            # Process feedback
            updated_profile = await quality_curator.process_feedback(
                feedback_data,
                designer_id,
                current_profile
            )
            
            # Store updated profile and persist
            new_profile_key = f"{designer_id}_v{updated_profile['version']}"
            style_profiles[new_profile_key] = updated_profile
            save_profiles(style_profiles)
            
            return {
                "success": True,
                "feedback_count": len(feedback_list),
                "profile_updated": True,
                "new_version": updated_profile["version"],
                "message": "Feedback processed and profile updated"
            }
        else:
            return {
                "success": True,
                "feedback_count": len(feedback_list),
                "profile_updated": False,
                "message": "Feedback received but no profile found to update"
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing feedback: {e}")
        raise HTTPException(status_code=500, detail=str(e))

async def process_batch_generation(batch_id: str, designer_id: str, prompt_package: Dict):
    """Background task for batch generation"""
    try:
        logger.info(f"Starting batch generation {batch_id}")
        
        # Generate images
        results = await image_renderer.generate_images(
            prompt_package.get("prompts", []),
            batch_id,
            designer_id
        )
        
        # Update batch status
        if batch_id in batch_jobs:
            batch_jobs[batch_id].update({
                "status": "completed",
                "completed_images": results.get("successful", 0),
                "failed_images": results.get("failed", 0),
                "results": results
            })
        
        logger.info(f"Batch {batch_id} completed")
        
    except Exception as e:
        logger.error(f"Error in batch generation {batch_id}: {e}")
        if batch_id in batch_jobs:
            batch_jobs[batch_id].update({
                "status": "failed",
                "error": str(e)
            })

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "AI Agents Service",
        "agents": ["Visual Analyst", "Prompt Architect", "Image Renderer", "Quality Curator", "Coordinator"],
        "timestamp": datetime.utcnow().isoformat()
    }

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Designer's BFF - AI Agents Service",
        "version": "1.0.0",
        "agents": 5,
        "endpoints": {
            "portfolio": "/portfolio/*",
            "generation": "/generation/*", 
            "feedback": "/feedback/*",
            "docs": "/docs"
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)