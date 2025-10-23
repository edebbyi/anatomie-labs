# Designer's BFF - AI Agents Integration Guide

## 🎯 Overview

Your existing Node.js backend has been enhanced with a **5-agent Python microservice** that provides advanced AI capabilities for fashion image generation. This creates a **hybrid architecture** that preserves your existing system while adding powerful new features.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Node.js Backend (Port 5000)               │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐   │
│  │ Existing    │  │ New Agents   │  │ Hybrid            │   │
│  │ Routes      │  │ Routes       │  │ Generation        │   │
│  │ /api/images │  │ /api/agents  │  │ /api/agents/      │   │
│  └─────────────┘  └──────────────┘  │ generate/hybrid   │   │
│                                     └───────────────────┘   │
└───────────────────────┬─────────────────────────────────────┘
                        │ HTTP Calls
┌───────────────────────▼─────────────────────────────────────┐
│             Python AI Agents Service (Port 8000)           │
│  ┌──────────────┐ ┌─────────────┐ ┌────────────────────┐   │
│  │ Visual       │ │ Prompt      │ │ Image Renderer     │   │
│  │ Analyst      │ │ Architect   │ │ Quality Curator    │   │
│  └──────────────┘ └─────────────┘ └────────────────────┘   │
│                    ┌─────────────────────┐                  │
│                    │ Coordinator Agent   │                  │
│                    └─────────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### 1. Start Your Existing Node.js Backend

```bash
# Terminal 1 - Your existing system
npm start
# Runs on http://localhost:5000
```

### 2. Start the AI Agents Service

```bash
# Terminal 2 - New Python service
cd agents-service
./start-dev.sh
# Runs on http://localhost:8000
```

### 3. Test the Integration

```bash
# Check both services are running
curl http://localhost:5000/health
curl http://localhost:8000/health
```

## 📡 New API Endpoints

### Portfolio Analysis
```bash
POST /api/agents/portfolio/analyze
Content-Type: application/json
Authorization: Bearer <jwt-token>

{
  "imageUrls": [
    "https://example.com/image1.jpg",
    "https://example.com/image2.jpg"
    // 5-20 images required
  ]
}
```

### AI Generation
```bash
POST /api/agents/generate
Content-Type: application/json
Authorization: Bearer <jwt-token>

{
  "prompt": "elegant evening dress with flowing silhouette",
  "mode": "specific",  // or "batch"
  "quantity": 4
}
```

### Hybrid Generation (Smart Fallback)
```bash
POST /api/agents/generate/hybrid
Content-Type: application/json
Authorization: Bearer <jwt-token>

{
  "prompt": "casual summer outfit",
  "useAgents": true,     // Try AI agents first
  "mode": "specific",
  "quantity": 2
}
```

### Style Profile
```bash
GET /api/agents/portfolio/profile
Authorization: Bearer <jwt-token>
```

### Feedback Learning
```bash
POST /api/agents/feedback
Content-Type: application/json
Authorization: Bearer <jwt-token>

{
  "feedback": [
    {
      "image_id": "img-123",
      "overall_rating": 5,
      "selected": true,
      "comments": "Perfect style match!"
    }
  ]
}
```

## 🔄 Workflow Examples

### 1. New User Onboarding
```javascript
// Step 1: User uploads portfolio
const portfolioResponse = await fetch('/api/agents/portfolio/analyze', {
  method: 'POST',
  headers: { 
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    imageUrls: userPortfolioImages
  })
});

// Step 2: System creates personalized style profile
const profile = await portfolioResponse.json();
console.log('Style Profile:', profile.data.profile);
```

### 2. Personalized Generation
```javascript
// Automatic style-aware generation
const genResponse = await fetch('/api/agents/generate', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    prompt: "business casual blazer",
    mode: "specific",
    quantity: 4
  })
});

const result = await genResponse.json();
if (result.success) {
  console.log('Generated images:', result.data.results);
}
```

### 3. Batch Processing
```javascript
// Large batch for overnight processing
const batchResponse = await fetch('/api/agents/generate', {
  method: 'POST',
  body: JSON.stringify({
    prompt: "summer collection exploration",
    mode: "batch",
    quantity: 50
  })
});

const batch = await batchResponse.json();
const batchId = batch.data.batch_id;

// Monitor progress
const statusResponse = await fetch(`/api/agents/batch/${batchId}/status`);
const status = await statusResponse.json();
console.log('Progress:', status.data.progress_percentage + '%');
```

## 🔧 Environment Setup

### Node.js Environment Variables
Add to your existing `.env`:
```bash
# AI Agents Service URL
AGENTS_SERVICE_URL=http://localhost:8000
```

### Python Service Environment
Create `agents-service/.env`:
```bash
OPENAI_API_KEY=your-openai-api-key
REPLICATE_API_KEY=your-replicate-api-key
PORT=8000
DEBUG=true
```

## 🧪 Testing the Integration

### Health Check
```bash
# Test both services
curl http://localhost:5000/health
curl http://localhost:8000/health

# Test agent service from Node.js
curl http://localhost:5000/api/agents/health
```

### Portfolio Analysis Test
```bash
curl -X POST http://localhost:5000/api/agents/portfolio/analyze \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "imageUrls": [
      "https://example.com/fashion1.jpg",
      "https://example.com/fashion2.jpg",
      "https://example.com/fashion3.jpg",
      "https://example.com/fashion4.jpg",
      "https://example.com/fashion5.jpg"
    ]
  }'
```

## 🎛️ Configuration Options

### Smart Routing
The system automatically routes requests based on user state:

- **Has Style Profile** → Use AI Agents (personalized)
- **No Style Profile** → Use Legacy System (generic)
- **AI Agents Fail** → Fallback to Legacy System

### Generation Modes
- **Specific Mode**: 1-10 images, immediate generation
- **Batch Mode**: 10-100 images, background processing

## 📊 Monitoring

### Real-time Updates (WebSocket)
```javascript
// Your existing Socket.IO client receives new events:
socket.on('generation-started', (data) => {
  console.log('AI generation started:', data);
});

socket.on('generation-progress', (data) => {
  console.log('Batch progress:', data.progress + '%');
});
```

### Performance Metrics
```javascript
// Check system performance
const healthResponse = await fetch('/api/agents/health');
const health = await healthResponse.json();

console.log('Agents Status:', health.data.status);
console.log('Available Agents:', health.data.agents);
```

## 🚨 Error Handling

The integration includes robust fallback mechanisms:

1. **Agent Service Down** → Falls back to legacy system
2. **No Style Profile** → Uses generic generation
3. **Generation Fails** → Retries with different parameters
4. **Network Issues** → Graceful degradation

## 🔄 Migration Strategy

### Phase 1: Parallel Operation
- Keep both systems running
- Route new users to AI agents
- Existing users continue with legacy system

### Phase 2: Gradual Migration
- Encourage existing users to create style profiles
- Use hybrid generation for smooth transition

### Phase 3: Full AI Integration
- All users use personalized generation
- Legacy system becomes backup only

## 📈 Benefits

### For Users
- ✅ **Personalized Generation**: Images match their style
- ✅ **Continuous Learning**: Gets better with feedback
- ✅ **Batch Processing**: Generate 100+ images overnight
- ✅ **Higher Quality**: Enhanced with GFPGAN + Real-ESRGAN

### For Developers
- ✅ **Modular Architecture**: Easy to maintain/scale
- ✅ **Language Strengths**: Node.js for API, Python for AI
- ✅ **Graceful Degradation**: Always has fallback
- ✅ **Independent Scaling**: Scale services separately

## 🎯 Next Steps

1. **Test the Integration**: Run both services and try the endpoints
2. **Update Frontend**: Add portfolio upload UI
3. **Configure APIs**: Add your OpenAI/Replicate keys
4. **Monitor Performance**: Check health endpoints regularly
5. **Scale as Needed**: Add load balancing when ready

The system is designed to enhance your existing capabilities while maintaining full backward compatibility. Users get better results, but the system never breaks! 🚀