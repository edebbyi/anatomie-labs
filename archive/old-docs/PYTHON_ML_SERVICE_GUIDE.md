# Python ML Service - Complete Implementation Guide

## Overview

You're absolutely correct! The Designer BFF requires **Python-based ML services** to handle:

- **Stage 2**: GMM clustering for style profiles  
- **Stage 5**: RLHF prompt optimization
- **Stage 8**: Isolation Forest validation
- **Stage 9**: DPP diversity selection
- **Stage 10**: Online learning from feedback

I've started creating the Python ML service. Here's the complete architecture:

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Node.js Backend (Port 5000)               │
│  - API Routes                                                 │
│  - Business Logic                                             │
│  - Database (PostgreSQL)                                      │
│  - R2 Storage                                                 │
└───────────────────┬─────────────────────────────────────────┘
                    │ HTTP REST API
                    ↓
┌─────────────────────────────────────────────────────────────┐
│              Python ML Service (Port 8001)                    │
│  - FastAPI                                                    │
│  - scikit-learn (GMM, Isolation Forest, Random Forest)       │
│  - PyTorch (RLHF, embeddings)                                │
│  - DPPy (Determinantal Point Processes)                      │
│  - NumPy, Pandas                                              │
└─────────────────────────────────────────────────────────────┘
```

## What I've Created

### 1. Requirements (`requirements.txt`)
```python
# Core ML
numpy>=1.24.0
scikit-learn>=1.3.0  # GMM, Isolation Forest
scipy>=1.11.0

# Deep Learning (RLHF)
torch>=2.0.0
transformers>=4.30.0

# DPP for diversity
dppy>=0.3.0

# API
fastapi>=0.100.0
uvicorn>=0.23.0
```

### 2. Main Service (`main.py`)
FastAPI service with endpoints for:

#### Stage 2: Style Profiling
```python
POST /api/ml/style-profile/create
POST /api/ml/style-profile/update  
GET  /api/ml/style-profile/{user_id}
```

#### Stage 5: RLHF Optimization
```python
POST /api/ml/prompt/optimize
POST /api/ml/feedback/submit
POST /api/ml/rlhf/train
```

#### Stage 8: Validation
```python
POST /api/ml/validate
```

#### Stage 9: DPP Selection
```python
POST /api/ml/select/diverse
```

### 3. Style Profiler (`services/style_profiler.py`)
**Stage 2 Implementation** - Completed ✅

**Features:**
- GMM clustering of VLT records
- One-hot encoding of fashion attributes
- PCA dimensionality reduction
- Identifies 3-7 style "modes" per user
- Computes dominant attributes per cluster
- Feature importance analysis
- Online learning for profile updates

**Example Usage:**
```python
# Create initial profile from uploaded portfolio
profile = style_profiler.create_profile(
    user_id="user_123",
    vlt_records=[{
        'id': '1',
        'garment_type': 'dress',
        'attributes': {
            'silhouette': 'A-line',
            'neckline': 'V-neck',
            'sleeveLength': 'sleeveless',
            'length': 'midi'
        },
        'colors': {'primary': 'black', 'finish': 'matte'},
        'style': {'overall': 'elegant', 'mood': 'sophisticated'}
    }, ...],
    n_clusters=5
)

# Returns:
{
    'user_id': 'user_123',
    'n_clusters': 5,
    'clusters': [
        {
            'id': 0,
            'size': 25,
            'percentage': 50.0,
            'dominant_attributes': {
                'silhouette': ('A-line', 15),
                'color': ('black', 18),
                'style_overall': ('elegant', 20)
            },
            'style_summary': 'elegant, A-line silhouette, black tones'
        },
        ...
    ],
    'statistics': {
        'garment_distribution': {'dress': 30, 'top': 15, ...},
        'color_distribution': {'black': 20, 'navy': 15, ...},
        'style_distribution': {'elegant': 25, 'minimalist': 15, ...}
    }
}
```

## Still Need to Implement

### 4. RLHF Optimizer (`services/rlhf_optimizer.py`)
**Stage 5 & 10** - TODO

```python
class RLHFOptimizer:
    """
    Reinforcement Learning from Human Feedback
    Optimizes prompts based on user likes/dislikes
    """
    
    def __init__(self):
        # Reward model (small transformer or linear model)
        self.reward_model = self._init_reward_model()
        # Policy model for prompt adjustment
        self.policy_model = self._init_policy_model()
        
    def process_feedback(
        self,
        user_id: str,
        feedback_type: str,  # 'like', 'dislike', 'outlier'
        prompt_used: str,
        vlt_spec: dict,
        quality_score: float
    ):
        """
        Process single feedback event
        Updates reward model weights
        """
        # Extract prompt features
        features = self._extract_prompt_features(prompt_used, vlt_spec)
        
        # Compute reward signal
        reward = self._compute_reward(feedback_type, quality_score)
        
        # Update reward model (online learning)
        self._update_reward_model(features, reward)
        
    def optimize_prompt(
        self,
        base_prompt: str,
        vlt_spec: dict,
        style_profile: dict,
        feedback_history: list
    ) -> dict:
        """
        Optimize prompt using learned preferences
        """
        # Extract features
        features = self._extract_prompt_features(base_prompt, vlt_spec)
        
        # Get predicted reward for current prompt
        current_reward = self.reward_model.predict(features)
        
        # Generate prompt variations
        variations = self._generate_prompt_variations(
            base_prompt, 
            vlt_spec,
            style_profile
        )
        
        # Score all variations
        scores = [self.reward_model.predict(self._extract_prompt_features(v, vlt_spec)) 
                  for v in variations]
        
        # Select best
        best_idx = np.argmax(scores)
        
        return {
            'prompt': variations[best_idx],
            'confidence': float(scores[best_idx]),
            'improvement': float(scores[best_idx] - current_reward),
            'adjustments': self._explain_adjustments(base_prompt, variations[best_idx])
        }
```

**Key ML Techniques:**
- Reward modeling with small transformer or linear regression
- Policy gradient for prompt optimization
- Online learning for continuous improvement
- Feature extraction from prompts + VLT specs

### 5. Prompt Optimizer (`services/prompt_optimizer.py`)
**Combines Style Profile + RLHF** - TODO

```python
class PromptOptimizer:
    """
    High-level prompt optimization
    Combines style profile clustering with RLHF
    """
    
    def optimize(
        self,
        user_id: str,
        base_prompt: str,
        vlt_spec: dict,
        style_profile: dict,
        feedback_history: list
    ) -> dict:
        """
        Stage 5: Multi-factor prompt optimization
        """
        # 1. Match to style cluster
        cluster_id = self._match_to_cluster(vlt_spec, style_profile)
        cluster_preferences = style_profile['clusters'][cluster_id]
        
        # 2. Apply cluster-specific adjustments
        cluster_adjusted = self._apply_cluster_preferences(
            base_prompt,
            cluster_preferences
        )
        
        # 3. Apply RLHF optimization
        rlhf_optimized = self.rlhf.optimize_prompt(
            cluster_adjusted,
            vlt_spec,
            style_profile,
            feedback_history
        )
        
        # 4. Apply persona matching (if available)
        final_prompt = self._apply_persona(
            rlhf_optimized['prompt'],
            user_id
        )
        
        return {
            'prompt': final_prompt,
            'confidence': rlhf_optimized['confidence'],
            'adjustments': {
                'cluster': cluster_id,
                'rlhf': rlhf_optimized['adjustments'],
                'persona': '...'
            },
            'metadata': {
                'cluster_used': cluster_id,
                'style_mode': cluster_preferences['style_summary']
            }
        }
```

### 6. Validation Service (`services/validation_service.py`)
**Stage 8: Isolation Forest** - TODO

```python
class ValidationService:
    """
    Validate generated images using Isolation Forest
    Detects outliers that don't match user's style
    """
    
    def validate_images(
        self,
        images: list,
        target_vlt: dict
    ) -> dict:
        """
        Re-analyze generated images and compare to target
        """
        # 1. Run VLT on generated images (call Node.js VLT service)
        generated_vlts = self._analyze_generated_images(images)
        
        # 2. Extract features
        target_features = self._extract_vlt_features(target_vlt)
        generated_features = [self._extract_vlt_features(v) for v in generated_vlts]
        
        # 3. Compare attributes (consistency scores)
        consistency_scores = [
            self._compute_consistency(target_features, gen_features)
            for gen_features in generated_features
        ]
        
        # 4. Isolation Forest for outlier detection
        iso_forest = IsolationForest(contamination=0.1, random_state=42)
        all_features = np.vstack([target_features.reshape(1, -1)] + 
                                  [gf.reshape(1, -1) for gf in generated_features])
        outlier_labels = iso_forest.fit_predict(all_features)[1:]  # Skip target
        
        # 5. Combine scores
        results = []
        for i, (img, vlt, score, outlier) in enumerate(zip(
            images, generated_vlts, consistency_scores, outlier_labels
        )):
            results.append({
                'image_id': img['id'],
                'consistency_score': float(score),
                'is_outlier': bool(outlier == -1),
                'is_rejected': score < 0.6 or outlier == -1,
                'vlt_analysis': vlt
            })
        
        return {
            'validations': results,
            'summary': {
                'total': len(results),
                'passed': sum(1 for r in results if not r['is_rejected']),
                'rejected': sum(1 for r in results if r['is_rejected']),
                'avg_consistency': np.mean([r['consistency_score'] for r in results])
            },
            'outliers': [r for r in results if r['is_outlier']]
        }
```

### 7. DPP Selector (`services/dpp_selector.py`)
**Stage 9: Diversity Selection** - TODO

```python
class DPPSelector:
    """
    Determinantal Point Process for diverse image selection
    Ensures coverage across style attributes
    """
    
    def select_diverse(
        self,
        images: list,
        target_count: int,
        diversity_weight: float = 0.7,
        quality_weight: float = 0.3
    ) -> dict:
        """
        Select most diverse subset using DPP
        """
        from dppy.finite_dpps import FiniteDPP
        
        # 1. Extract VLT features for each image
        features = [self._extract_vlt_features(img['vlt']) for img in images]
        features_matrix = np.vstack(features)
        
        # 2. Compute similarity matrix
        similarity = self._compute_similarity_matrix(features_matrix)
        
        # 3. Compute quality scores
        quality_scores = np.array([img.get('quality_score', 0.5) for img in images])
        
        # 4. Construct DPP kernel
        # L = Q^T S Q where Q is quality, S is similarity
        Q = np.diag(quality_scores ** quality_weight)
        S = similarity ** diversity_weight
        L = Q @ S @ Q
        
        # 5. Sample from DPP
        dpp = FiniteDPP('likelihood', **{'L': L})
        dpp.sample_exact()
        selected_indices = dpp.list_of_samples[0][:target_count]
        
        # 6. Compute coverage metrics
        selected_features = features_matrix[selected_indices]
        coverage = self._compute_coverage_metrics(selected_features)
        
        return {
            'selected': [images[i] for i in selected_indices],
            'rejected': [images[i] for i in range(len(images)) if i not in selected_indices],
            'diversity_score': float(self._compute_diversity_score(selected_features)),
            'coverage': coverage
        }
```

## Integration with Node.js

### Node.js Service Calls Python ML Service:

```javascript
// src/services/mlService.js

const axios = require('axios');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8001';

class MLService {
  // Stage 2: Create style profile
  async createStyleProfile(userId, vltRecords) {
    const response = await axios.post(`${ML_SERVICE_URL}/api/ml/style-profile/create`, {
      user_id: userId,
      vlt_records: vltRecords,
      n_clusters: 5
    });
    return response.data.profile;
  }
  
  // Stage 5: Optimize prompt with RLHF
  async optimizePrompt(userId, basePrompt, vltSpec, styleProfile, feedbackHistory) {
    const response = await axios.post(`${ML_SERVICE_URL}/api/ml/prompt/optimize`, {
      user_id: userId,
      base_prompt: basePrompt,
      vlt_spec: vltSpec,
      style_profile: styleProfile,
      feedback_history: feedbackHistory
    });
    return response.data;
  }
  
  // Stage 8: Validate generated images
  async validateImages(generationId, images, targetVlt) {
    const response = await axios.post(`${ML_SERVICE_URL}/api/ml/validate`, {
      generation_id: generationId,
      images: images,
      target_vlt: targetVlt
    });
    return response.data;
  }
  
  // Stage 9: Select diverse images
  async selectDiverse(images, targetCount) {
    const response = await axios.post(`${ML_SERVICE_URL}/api/ml/select/diverse`, {
      images: images,
      target_count: targetCount,
      diversity_weight: 0.7,
      quality_weight: 0.3
    });
    return response.data;
  }
  
  // Stage 10: Submit feedback
  async submitFeedback(userId, generationId, assetId, feedbackType, promptUsed, vltSpec) {
    const response = await axios.post(`${ML_SERVICE_URL}/api/ml/feedback/submit`, {
      user_id: userId,
      generation_id: generationId,
      asset_id: assetId,
      feedback_type: feedbackType,
      prompt_used: promptUsed,
      vlt_spec: vltSpec
    });
    return response.data;
  }
}

module.exports = new MLService();
```

## Setup & Installation

### 1. Install Python Environment

```bash
cd python-ml-service

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Start ML Service

```bash
# In python-ml-service directory
python main.py

# Or with uvicorn directly
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

### 3. Update .env

```bash
# Add to your .env file
ML_SERVICE_URL=http://localhost:8001
```

### 4. Test ML Service

```bash
# Health check
curl http://localhost:8001/health

# Test style profile creation
curl -X POST http://localhost:8001/api/ml/style-profile/create \
  -H "Content-Type: application/json" \
  -d @test_data/style_profile_request.json
```

## Prompt Template System

### Initial Prompt Templates (Stored in DB)

You asked about initial prompt templates. Here's my recommendation:

```javascript
// src/templates/fashionPrompts.js

module.exports = {
  // Base template structure
  baseTemplate: {
    quality: ["high fashion photography", "professional product shot", "studio quality", "8k resolution"],
    composition: ["full body", "3/4 angle", "professional fashion model"],
    lighting: ["sophisticated studio lighting", "subtle shadows"],
    background: ["clean minimal background", "soft gray or white"],
    finishing: ["centered composition", "sharp focus", "detailed texture"]
  },
  
  // Style-specific templates
  styleTemplates: {
    elegant: {
      mood: ["sophisticated", "refined", "graceful"],
      lighting: ["sophisticated studio lighting", "soft dramatic lighting"],
      composition: ["poised stance", "elegant posture"]
    },
    minimalist: {
      mood: ["clean", "simple", "understated"],
      lighting: ["even studio lighting", "bright and clean"],
      composition: ["simple pose", "straight on"]
    },
    romantic: {
      mood: ["soft", "dreamy", "feminine"],
      lighting: ["soft natural window light", "gentle shadows"],
      composition: ["flowing movement", "gentle pose"]
    },
    dramatic: {
      mood: ["bold", "striking", "powerful"],
      lighting: ["dramatic side lighting", "deep shadows"],
      composition: ["dynamic pose", "confident stance"]
    }
  },
  
  // Garment-specific modifiers
  garmentModifiers: {
    dress: {
      shots: ["full body", "emphasize drape and movement"],
      details: ["fabric flow", "silhouette emphasis"]
    },
    top: {
      shots: ["3/4 body", "waist up"],
      details: ["neckline detail", "sleeve construction"]
    },
    pants: {
      shots: ["full body", "emphasis on lower half"],
      details: ["fit and tailoring", "leg line"]
    }
  }
};
```

### Prompt Evolution System

The templates improve through **3 mechanisms**:

1. **RLHF (Stage 5 & 10)**
   - User likes/dislikes adjust keyword weights
   - Learns which descriptions lead to "outliers" (successful generations)
   - Updates reward model continuously

2. **Style Profile Learning (Stage 2)**
   - GMM clusters identify user's style modes
   - Each cluster has dominant attributes
   - Prompts automatically emphasize cluster preferences

3. **Coverage Analysis (Stage 9)**
   - Tracks which attributes are underrepresented
   - Next generation cycle automatically boosts those attributes
   - Ensures diverse portfolio

### Example Evolution:

```
Initial Prompt (Template):
"high fashion photography, professional model, elegant dress, 
black color, studio lighting"

After 10 "likes" on similar images:
"high fashion photography, professional model, sophisticated 
elegant evening dress, deep black matte finish, subtle 
dramatic studio lighting, refined composition"

After Style Profile identifies "Minimalist" cluster:
"high fashion photography, professional model, clean minimalist 
evening dress, pure black matte finish, even studio lighting, 
simple centered composition, understated elegance"

After RLHF learns user prefers specific details:
"high fashion photography, professional model, clean minimalist 
evening dress with architectural silhouette, pure black matte 
finish, bright even studio lighting, simple centered composition, 
sharp lines, understated elegance, precise tailoring"
```

## Next Steps

### Immediate (Do First):
1. ✅ Install Python environment
2. ✅ Start ML service (Port 8001)
3. ✅ Test style profiler with your portfolio data
4. ⏳ Implement RLHF optimizer
5. ⏳ Implement validation service
6. ⏳ Implement DPP selector

### Integration:
1. Add ML service calls to Node.js generation pipeline
2. Call style profiler after portfolio upload (onboarding)
3. Call prompt optimizer before image generation
4. Call validation after generation
5. Call DPP selector for final image selection

### Testing:
1. Upload portfolio → Create style profile
2. Generate images → Optimize with RLHF
3. Validate outputs → Filter with Isolation Forest
4. Select diverse → DPP selection
5. Submit feedback → Update RLHF model

Would you like me to:
1. Complete the remaining ML services (RLHF, Validation, DPP)?
2. Create initial prompt templates for your specific use case?
3. Set up the integration layer between Node.js and Python?
4. Create test data and scripts?

Let me know what's most urgent! 🚀
