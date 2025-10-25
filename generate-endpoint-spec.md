# /Generate Endpoint Specification
## Podna AI Design System - Power User Interface

---

## Vision & Philosophy

The `/generate` endpoint is **not** a duplicate of voice commands. It is the precision control center where designers leverage the full power of the AI system through visual interfaces and batch operations that would be impractical via voice.

### Core Principle
**Voice = Speed & Naturalness** (quick iterations, conversational)  
**Web Generate = Precision & Power** (complex controls, batch operations, fine-tuning)

---

## Architecture Overview

```
/generate endpoint components:
├── Intelligent Prompt Builder
├── Real-time Enhancement Preview
├── Visual Control Panel
├── Batch Generation Controller
├── Style Profile Integration
├── Historical Performance Analytics
└── Direct Pipeline Connection
```

---

## Feature Specifications

### 1. INTELLIGENT PROMPT BUILDER

#### 1.1 Enhanced Text Input
**Current State:** Simple textarea with smart interpretation  
**New State:** Smart prompt field with live interpretation and enhanced AI processing

**Requirements:**
- Main prompt textarea (expanded, comfortable for detailed descriptions)
- Real-time tokenization display showing how the system interprets input
- Weight visualization: show which terms get boosted (e.g., "architectural seaming" highlighted with weight indicator)
- Auto-suggestions from brand DNA vocabulary as user types
- Smart completion based on style profile
- Enhanced interpretation that combines user input with brand DNA

**Technical Implementation:**
```javascript
// As user types, show interpretation
const interpretPrompt = (userInput) => {
  // Call prompt enhancement agent
  // Display weighted tokens in real-time
  // Show confidence scores for key terms
  // Highlight brand-specific vocabulary matches
  // Combine with user's style profile for contextual enhancement
}
```

### 1.2 Enhanced Interpretation API

The `/generate` endpoint now supports enhanced interpretation of user prompts:

**Request:**
```http
POST /api/podna/generate
Content-Type: application/json
Authorization: Bearer <token>

{
  "prompt": "elegant black evening gown with silver accents",
  "mode": "exploratory",
  "provider": "imagen-4-ultra",
  "interpret": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Image generated successfully",
  "data": {
    "generation": {
      "id": "gen-xyz123",
      "url": "https://...",
      "promptText": "professional fashion photography, elegant black evening gown with silver accents, in the user's signature 'Modern Elegance' style, with structured silhouette, luxurious fabrics, soft lighting from front, 3/4 front angle at eye level, clean studio background, high detail, 8k, sharp focus, studio quality",
      "promptSpec": { /* detailed prompt metadata */ },
      "provider": "imagen-4-ultra",
      "costCents": 8,
      "createdAt": "2023-01-01T00:00:00Z"
    }
  }
}
```

**Parameters:**
- `prompt` (string, optional): User's design description for interpretation
- `mode` (string, optional): Generation mode (`exploratory`, `creative`, `precise`)
- `provider` (string, optional): AI provider to use
- `interpret` (boolean, optional): Enable enhanced interpretation (default: true)
- `constraints` (object, optional): Traditional constraints for backward compatibility

When `interpret` is true and a `prompt` is provided, the system:
1. Combines the user's input with their brand DNA
2. Enhances the prompt with contextual fashion attributes
3. Applies style-consistent weights to key elements
4. Ensures brand alignment while preserving user intent

#### 1.2 Reference Image Upload
**Purpose:** Visual input for "generate something like this"

**Requirements:**
- Drag-and-drop zone for reference images
- Multiple image support (up to 5 references)
- Smart image analysis agent extracts:
  - Silhouette type
  - Color palette
  - Styling elements
  - Mood/vibe
  - Composition structure
- Display extracted attributes with confidence scores
- Allow user to accept/reject/modify extracted attributes

**Technical Implementation:**
```python
# Image analysis pipeline
def analyze_reference_image(image_url):
    # Call visual descriptor agent
    # Extract key fashion attributes
    # Map to brand vocabulary
    # Return structured data:
    return {
        "silhouette": "relaxed tailoring",
        "colors": ["noir", "charcoal"],
        "mood": "confident minimalism",
        "composition": "full body studio",
        "confidence_scores": {...}
    }
```

---

### 2. REAL-TIME INTELLIGENCE DISPLAY

#### 2.1 Live Enhancement Preview
**Show the system working in real-time**

**Display Elements:**
- Original user prompt
- Enhanced prompt with all tokenization
- Style profile elements being applied
- Brand DNA keywords activated
- Validation agent feedback BEFORE generation

**UI Layout:**
```
┌─ Your Prompt ──────────────────────────┐
│ black blazer strong shoulders          │
└────────────────────────────────────────┘
          ↓ Enhancement in progress...
┌─ System Enhancement ───────────────────┐
│ Ultra-luxury black tailored blazer     │
│ featuring architectural strong         │
│ shoulders, modern power silhouette,    │
│ ultra-feminine fit proportions,        │
│ photographed in Mario Testino style... │
│                                        │
│ Applied Brand DNA:                     │
│ ✓ Architectural seaming                │
│ ✓ Ultra-feminine proportions          │
│ ✓ Performance luxury aesthetic        │
└────────────────────────────────────────┘
```

#### 2.2 Validation Agent Pre-Check
**Catch issues BEFORE wasting generations**

**Checks:**
- Prompt clarity score
- Potential ambiguity warnings
- Conflicting attribute detection
- Brand alignment score
- Estimated quality prediction

**Display:**
```
┌─ Pre-Generation Validation ────────────┐
│ ✓ Prompt clarity: 92%                  │
│ ✓ Brand alignment: 88%                 │
│ ⚠ Suggestion: Consider adding lighting │
│   direction for better results         │
│ ✓ Estimated output quality: High       │
└────────────────────────────────────────┘
```

---

### 3. VISUAL CONTROL PANEL

#### 3.1 Style Dimension Sliders
**Purpose:** Fine-tune brand aesthetic balance

**Sliders (0-100 scale):**
- **Femininity** → Ultra-feminine ↔ Neutral
- **Structure** → Architectural ↔ Fluid
- **Luxury Level** → Accessible ↔ Ultra-luxury
- **Tech Integration** → Subtle ↔ Prominent
- **Mood** → Confident power ↔ Relaxed ease

**Technical Implementation:**
```javascript
const styleControls = {
  femininity: 85,    // default from style profile
  structure: 78,
  luxury: 90,
  tech: 45,
  mood: 70
}

// Convert slider values to prompt modifiers
const applyStyleModifiers = (basePrompt, controls) => {
  // Inject weighted terms based on slider positions
  // High femininity → boost "ultra-feminine", "elegant curves"
  // High structure → boost "architectural", "sharp lines"
  // etc.
}
```

#### 3.2 Composition Presets
**Quick selection for output type**

**Options:**
- Full body studio
- 3/4 length editorial
- Detail/close-up shot
- Flat lay product
- Lifestyle/in-context
- Back view
- Side profile
- Movement/action shot

**Each preset includes:**
- Camera angle specifications
- Lighting recommendations
- Background style
- Model pose guidelines

#### 3.3 Lighting & Environment
**Pre-configured professional setups**

**Lighting Presets:**
- Mario Testino glamour
- Natural window light
- Studio high-key
- Dramatic single-source
- Soft editorial
- Golden hour outdoor

**Environment Options:**
- Clean studio (white/gray/black)
- Architectural interior
- Urban exterior
- Natural landscape
- Minimal texture backdrop

#### 3.4 Model Selection
**Choose generation type**

**Options:**
- Front-facing model (primary)
- Back view model
- Profile view model
- Multiple angles (generates set)
- Flat lay (no model)
- Detail shots only

---

### 4. SMART GENERATION OPTIONS

#### 4.1 Generation Modes

**SINGLE MODE** (default)
- Generate 1-10 images
- Standard quality control
- Fastest turnaround

**COLLECTION MODE**
- Generate coordinating set (4, 6, 8, or 12 pieces)
- System ensures visual cohesion
- Varied but harmonious outputs
- Automatic styling consistency

**CAMPAIGN MODE**
- Hero image + supporting shots
- 1 primary + 5-8 variations
- Consistent mood across set
- Different compositions/angles

**EXPLORATION MODE**
- Wide variation using Thompson Sampling
- Slider control: Exploitation ↔ Exploration
- More diverse creative directions
- Higher risk/higher reward outputs

#### 4.2 Batch Generation Controller
**For serious production needs**

**Batch Sizes:**
- Small: 10-25 images
- Medium: 50 images
- Large: 100 images
- Production: 200+ images

**Batch Configuration:**
```
┌─ Batch Generation Setup ───────────────────────┐
│                                                 │
│ Batch Size: [█████████░] 100 images            │
│                                                 │
│ Variation Strategy:                             │
│ ○ Consistent (tight variations)                │
│ ● Diverse (explore creative space)             │
│ ○ Structured (systematic variations)           │
│                                                 │
│ Variation Parameters:                           │
│ ☑ Vary poses                                   │
│ ☑ Vary lighting                                │
│ ☑ Vary styling details                         │
│ ☐ Vary color palette                           │
│ ☑ Vary composition                             │
│                                                 │
│ Processing:                                     │
│ ● Real-time (as generated)                     │
│ ○ Background batch (overnight)                 │
│                                                 │
│ Estimated completion: ~45 minutes               │
│ Cost estimate: $XX.XX                           │
│                                                 │
│ [Start Batch Generation]                        │
└─────────────────────────────────────────────────┘
```

**Technical Implementation:**
```python
class BatchGenerator:
    def __init__(self, batch_size, variation_strategy):
        self.batch_size = batch_size
        self.strategy = variation_strategy
        self.queue = []
        
    def configure_variations(self, base_prompt, params):
        """
        Create batch queue with intelligent variations
        """
        if self.strategy == "consistent":
            # Generate tight variations around base prompt
            variations = self.generate_tight_variations(base_prompt)
            
        elif self.strategy == "diverse":
            # Use Thompson Sampling for exploration
            variations = self.generate_diverse_variations(base_prompt)
            
        elif self.strategy == "structured":
            # Systematic parameter sweeps
            variations = self.generate_structured_grid(base_prompt, params)
            
        return variations
    
    def generate_structured_grid(self, base_prompt, params):
        """
        Systematic variation across specified parameters
        Example: if vary_lighting=True and vary_poses=True
        Generate grid of all combinations
        """
        variations = []
        
        lighting_options = ["natural", "studio", "dramatic", "soft"]
        pose_options = ["standing", "walking", "seated", "dynamic"]
        
        for light in lighting_options:
            for pose in pose_options:
                modified_prompt = self.inject_parameters(
                    base_prompt, 
                    lighting=light, 
                    pose=pose
                )
                variations.append(modified_prompt)
                
        return variations[:self.batch_size]
    
    async def process_batch(self, variations):
        """
        Process batch with progress tracking
        """
        results = []
        for i, prompt in enumerate(variations):
            # Generate image
            result = await self.generate_single(prompt)
            results.append(result)
            
            # Update progress
            progress = (i + 1) / len(variations) * 100
            self.update_progress(progress)
            
            # Optional: Real-time display
            if self.realtime_mode:
                self.display_result(result)
                
        return results
```

**Batch Progress Display:**
```
┌─ Batch Generation Progress ────────────────────┐
│                                                 │
│ Processing: 47 / 100 images                    │
│ [████████████████░░░░░░░░░░] 47%              │
│                                                 │
│ Time elapsed: 21m 34s                          │
│ Estimated remaining: 24m 12s                   │
│                                                 │
│ Success rate: 94% (44/47)                      │
│ In enhancement pipeline: 3                      │
│                                                 │
│ Latest results: [thumbnail gallery]            │
│                                                 │
│ [Pause] [Cancel] [View All]                    │
└─────────────────────────────────────────────────┘
```

#### 4.3 Intelligent Diversity Control

**The Problem:** When generating batches, avoid repetitive/identical outputs

**Solution:** Smart variation injection

**Parameters:**
- **Diversity Level:** Low (consistent) → High (varied)
- **Which elements to vary:**
  - Camera angle
  - Model pose
  - Lighting direction
  - Styling details
  - Background/environment
  - Color temperature
  - Crop/framing

**Technical Approach:**
```python
def inject_diversity(base_prompt, diversity_params):
    """
    Intelligently vary prompts while maintaining core concept
    """
    variations = {
        "camera_angles": [
            "straight on", "slightly angled", "3/4 view", 
            "profile", "from above", "eye level"
        ],
        "poses": [
            "standing confidently", "mid-stride", "relaxed stance",
            "dynamic movement", "seated elegantly"
        ],
        "lighting": [
            "soft natural light", "dramatic side lighting",
            "bright even studio light", "golden hour glow"
        ]
    }
    
    # Randomly select variations based on enabled parameters
    modified_prompt = base_prompt
    
    if diversity_params.vary_camera:
        angle = random.choice(variations["camera_angles"])
        modified_prompt += f", shot from {angle}"
        
    # ... etc for other parameters
    
    return modified_prompt
```

---

### 5. INTEGRATION LEVERAGE

#### 5.1 Style Profile Auto-Apply
**Seamlessly integrate user's brand DNA**

**Display:**
```
┌─ Active Style Profile ─────────────────────────┐
│ Your Brand DNA (Applied automatically)         │
│                                                 │
│ • Ultra-feminine proportions                   │
│ • Architectural seaming                        │
│ • Performance luxury aesthetic                 │
│ • Confident, accomplished woman POV            │
│ • Tom Ford / Prada luxury level                │
│                                                 │
│ [Edit Profile] [Disable for this session]      │
└─────────────────────────────────────────────────┘
```

**Toggle:** Allow users to disable profile for experimentation

#### 5.2 Historical Performance Analytics
**Learn from what worked**

**Display Top Performers:**
```
┌─ High-Performing Prompts ──────────────────────┐
│ Based on your enhancement pipeline approvals   │
│                                                 │
│ 1. "Black tailored blazer, strong shoulders"   │
│    → 92% approval rate (23/25)                 │
│    [Use as template]                           │
│                                                 │
│ 2. "Ivory silk blouse, fluid draping"          │
│    → 88% approval rate (22/25)                 │
│    [Use as template]                           │
│                                                 │
│ 3. "Charcoal wide-leg trousers..."             │
│    → 86% approval rate (19/22)                 │
│    [Use as template]                           │
└─────────────────────────────────────────────────┘
```

**Features:**
- Click to pre-fill prompt
- Show what worked (colors, styles, compositions)
- Display trends over time
- Identify most successful combinations

#### 5.3 Quick Actions

**One-Click Operations:**
- → Send to enhancement pipeline
- → Generate campaign set (1 hero + 5 supporting)
- → Create collection (8 coordinating pieces)
- → Add to style profile examples
- → Schedule for overnight batch
- → Export to design board

**UI:**
```
After generation completes:

[Image Gallery Display]

Actions for selected images:
☑ Image 1, 3, 5, 7 selected (4 images)

[Enhance] [Create Campaign] [Add to Collection] 
[Schedule More] [Export] [Delete]
```

---

### 6. PIPELINE CONNECTIONS

#### 6.1 Direct Enhancement Pipeline
**Seamless handoff to your existing enhancement system**

**Integration Points:**
- Generated images automatically tagged with source prompt
- One-click send to enhancement queue
- Track which enhanced images came from this generation session
- Feedback loop: enhancement approvals inform future generations

**Technical:**
```python
# After generation
def send_to_enhancement_pipeline(images, metadata):
    """
    Tag and queue images for enhancement
    """
    for img in images:
        pipeline_payload = {
            "image_url": img.url,
            "source_prompt": img.original_prompt,
            "enhanced_prompt": img.enhanced_prompt,
            "generation_params": img.params,
            "timestamp": now(),
            "session_id": img.session_id
        }
        enhancement_queue.add(pipeline_payload)
```

#### 6.2 Campaign Builder
**Turn single concepts into full campaigns**

**Workflow:**
1. User generates concept they love
2. Click "Build Campaign"
3. System generates:
   - 1 hero shot (main image, high impact)
   - 2 detail shots (close-ups of key features)
   - 2 styled variations (different angles/moods)
   - 3 supporting pieces (coordinating items)

**Auto-consistency:** All campaign images maintain coherent style

#### 6.3 Collection Generator
**Create coordinating sets**

**Process:**
1. User describes collection concept
2. System generates 8-12 coordinating pieces
3. Maintains visual harmony through:
   - Consistent color palette
   - Unified design language
   - Complementary silhouettes
   - Cohesive styling

**Technical:**
```python
def generate_collection(core_concept, num_pieces=8):
    """
    Create coordinating collection from core concept
    """
    # Extract design elements from core concept
    palette = extract_color_palette(core_concept)
    mood = extract_mood(core_concept)
    style_elements = extract_style_elements(core_concept)
    
    # Generate diverse but harmonious pieces
    piece_types = [
        "blazer", "blouse", "wide-leg trousers", "pencil skirt",
        "dress", "coat", "accessories", "shoes"
    ]
    
    collection = []
    for piece_type in piece_types[:num_pieces]:
        # Inject color palette and mood consistency
        prompt = build_coordinated_prompt(
            piece_type=piece_type,
            palette=palette,
            mood=mood,
            style_elements=style_elements
        )
        collection.append(generate_image(prompt))
        
    return collection
```

---

### 7. UI/UX DESIGN PRINCIPLES

#### 7.1 Layout Structure

**Desktop Layout:**
```
┌─────────────────────────────────────────────────────────┐
│ [Header: Podna / Generate / Style Profile / Settings]  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─── Left Panel (40%) ────┐  ┌─ Right Panel (60%) ──┐│
│  │                          │  │                       ││
│  │ Intelligent Prompt       │  │                       ││
│  │ Builder                  │  │                       ││
│  │                          │  │   Preview/Results     ││
│  │ Visual Controls          │  │   Display             ││
│  │ - Style Sliders          │  │                       ││
│  │ - Composition            │  │                       ││
│  │ - Lighting               │  │                       ││
│  │                          │  │                       ││
│  │ Generation Options       │  │                       ││
│  │ - Mode selection         │  │                       ││
│  │ - Batch config           │  │                       ││
│  │                          │  │                       ││
│  │ [Generate Button]        │  │                       ││
│  │                          │  │                       ││
│  └──────────────────────────┘  └───────────────────────┘│
│                                                         │
│  ┌──── Bottom Panel: Recent Generations ───────────────┐│
│  │ [thumbnail] [thumbnail] [thumbnail] [thumbnail] ... ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

#### 7.2 Progressive Disclosure
**Don't overwhelm initially**

**Default View:** Simple
- Prompt input
- Basic generation button
- Number of images slider

**Expanded View:** Power user
- All visual controls visible
- Batch configuration
- Advanced options
- Analytics panel

**Toggle:** "Simple Mode" ↔ "Advanced Mode"

#### 7.3 Real-time Feedback
**Keep users informed**

- Prompt enhancement shows live
- Validation feedback appears inline
- Generation progress updates continuously
- Batch processing shows real-time results
- Cost estimates update as options change

---

### 8. TECHNICAL IMPLEMENTATION NOTES

#### 8.1 API Structure

**Endpoint:** `POST /api/generate`

**Request Payload:**
```json
{
  "prompt": "user's text description",
  "reference_images": ["url1", "url2"],
  "style_controls": {
    "femininity": 85,
    "structure": 78,
    "luxury": 90,
    "tech": 45,
    "mood": 70
  },
  "composition_preset": "full_body_studio",
  "lighting_preset": "mario_testino_glamour",
  "model_type": "front_facing",
  "generation_mode": "collection",
  "batch_config": {
    "size": 100,
    "variation_strategy": "diverse",
    "vary_params": ["pose", "lighting", "composition"],
    "processing_mode": "realtime"
  },
  "apply_style_profile": true,
  "send_to_pipeline": true
}
```

**Response:**
```json
{
  "session_id": "gen_xyz123",
  "enhanced_prompt": "full weighted prompt string",
  "validation": {
    "clarity_score": 92,
    "brand_alignment": 88,
    "warnings": ["consider adding lighting direction"],
    "estimated_quality": "high"
  },
  "cost_estimate": 12.50,
  "batch_info": {
    "total_images": 100,
    "estimated_time_minutes": 45,
    "progress_webhook": "/api/batch/xyz123/progress"
  },
  "images": [
    {
      "id": "img_001",
      "url": "https://...",
      "thumbnail_url": "https://...",
      "prompt_used": "specific prompt for this image",
      "metadata": {...}
    }
  ]
}
```

#### 8.2 WebSocket for Real-time Updates

**For batch processing:**
```javascript
// Client-side
const ws = new WebSocket('ws://localhost:3000/batch/xyz123');

ws.onmessage = (event) => {
  const update = JSON.parse(event.data);
  
  if (update.type === 'progress') {
    // Update progress bar
    updateProgress(update.completed, update.total);
  }
  
  if (update.type === 'image_ready') {
    // Display new image in real-time
    addImageToGallery(update.image);
  }
  
  if (update.type === 'batch_complete') {
    // Show completion notification
    showBatchComplete(update.stats);
  }
};
```

#### 8.3 State Management

**Frontend State:**
```
const generateState = {
  prompt: "",
  enhancedPrompt: "",
  referenceImages: [],
  styleControls: {
    femininity: 85,
    structure: 78,
    // ...defaults from style profile
  },
  compositionPreset: "full_body_studio",
  lightingPreset: "mario_testino_glamour",
  generationMode: "single",
  batchConfig: {
    size: 4,
    strategy: "consistent"
  },
  validationResults: null,
  generatedImages: [],
  isGenerating: false,
  batchProgress: {
    current: 0,
    total: 0,
    status: "idle"
  }
}
```

#### 8.4 Performance Considerations

**Optimization strategies:**
- Lazy load historical performance data
- Thumbnail generation for all results
- Progressive image loading for batches
- Cache style profile data
- Debounce real-time prompt enhancement
- Background processing for large batches
- Queue management for multiple concurrent generations

---

### 9. FUTURE ENHANCEMENTS

**Phase 2 Features:**
- Save generation sessions (bookmarkable URLs)
- Share generation configurations with team
- A/B testing mode (generate variants, compare)
- Custom preset saving (save favorite configurations)
- Integration with fabric library (match real materials)
- Color palette extraction from brand assets
- Video generation (animated fashion content)

---

### 10. SUCCESS METRICS

**Track:**
- Generations per user session
- Batch generation adoption rate
- Average batch size
- Enhancement pipeline conversion (gen → enhanced)
- Most-used presets and controls
- Time-to-first-generation
- Approval rate by generation mode
- User return rate to /generate vs voice

**Goals:**
- 70%+ of power users adopt batch generation
- 85%+ satisfaction with generated quality
- 50%+ reduction in re-generation attempts
- 30%+ increase in pipeline throughput

---

## Implementation Priority

### Phase 1 (MVP+)
1. Enhanced prompt builder with live interpretation
2. Visual style control sliders
3. Composition & lighting presets
4. Basic batch generation (10, 50, 100)
5. Style profile integration

### Phase 2
1. Reference image upload & analysis
2. Advanced batch strategies (diverse, structured)
3. Real-time batch progress display
4. Historical performance analytics
5. Collection & campaign modes

### Phase 3
1. Advanced variation controls
2. Custom preset saving
3. Team collaboration features
4. A/B testing capabilities
5. Analytics dashboard

---

## Development Notes

**For Esosa:**

Key architectural decisions:
- Use WebSockets for real-time batch updates (don't poll)
- Separate batch processing into background jobs (Redis queue)
- Cache style profile data in Redis (don't hit DB every generation)
- Store batch configurations for repeat sessions
- Implement proper rate limiting (especially for batch generations)
- Log all generation parameters for analytics
- Create proper indexes on image metadata for search/filter

**Dependencies:**
- WebSocket library (Socket.io or similar)
- Job queue (Bull/Redis)
- Image processing (Sharp for thumbnails)
- Progress tracking (Redis or in-memory if small scale)

**Database schema updates needed:**
```sql
-- Generation sessions
CREATE TABLE generation_sessions (
  id VARCHAR PRIMARY KEY,
  user_id VARCHAR,
  config JSONB,
  created_at TIMESTAMP,
  status VARCHAR,
  results_count INT
);

-- Batch jobs
CREATE TABLE batch_jobs (
  id VARCHAR PRIMARY KEY,
  session_id VARCHAR REFERENCES generation_sessions(id),
  total_count INT,
  completed_count INT,
  failed_count INT,
  status VARCHAR,
  created_at TIMESTAMP,
  completed_at TIMESTAMP
);

-- Image generations
CREATE TABLE generated_images (
  id VARCHAR PRIMARY KEY,
  session_id VARCHAR REFERENCES generation_sessions(id),
  url TEXT,
  prompt TEXT,
  enhanced_prompt TEXT,
  metadata JSONB,
  sent_to_pipeline BOOLEAN,
  approved BOOLEAN,
  created_at TIMESTAMP
);
```

---

## Questions for Shawn

Before implementation, clarify:
1. Cost limits for batch generation? (prevent runaway costs)
2. Max batch size allowed? (200 seems reasonable, or higher?)
3. Should batches auto-enhance or manual selection?
4. Priority: speed vs cost vs quality for batch processing?
5. Storage strategy for 100+ image batches? (S3, CDN, etc.)
6. User permissions - who can access batch generation?

---

*This specification transforms /generate from a simple prompt interface into a precision control center that complements voice commands rather than duplicates them.*
