# AI Agents Frontend Integration Guide

## 🎯 Overview

Your React frontend has been enhanced with AI agents integration! Here's how to use the new components and services.

## 📦 New Files Added

### Services
- `src/services/agentsAPI.ts` - Complete API client for Python agents service
- `.env.development` - Environment configuration

### Components
- `src/components/AgentsOnboarding.tsx` - Portfolio analysis onboarding
- `src/components/AgentsGeneration.tsx` - Enhanced image generation
- `src/components/AgentsFeedback.tsx` - Feedback system for AI learning

## 🚀 Quick Integration

### 1. Update your App.tsx routes

```tsx
import AgentsOnboarding from './components/AgentsOnboarding';
import AgentsGeneration from './components/AgentsGeneration';
import AgentsFeedback from './components/AgentsFeedback';

// Add these routes
<Route path="/agents/onboarding" element={<AgentsOnboarding />} />
<Route path="/agents/generate" element={<AgentsGeneration />} />
```

### 2. Update your navigation

```tsx
// Add to your main navigation
<NavLink to="/agents/onboarding">AI Portfolio Analysis</NavLink>
<NavLink to="/agents/generate">Personalized Generation</NavLink>
```

### 3. Enhance existing components

```tsx
import { portfolioAPI, generationAPI, feedbackAPI } from '../services/agentsAPI';

// In your existing generation component, add:
const handlePersonalizedGeneration = async (prompt: string) => {
  try {
    const result = await generationAPI.smartGenerate(userId, prompt);
    // Handle result...
  } catch (error) {
    // Handle error...
  }
};
```

## 🔧 Environment Setup

Make sure your `.env.development` is configured:
```bash
REACT_APP_AGENTS_API_URL=http://localhost:8000
```

## 📊 Usage Examples

### Check if user has style profile
```tsx
import { portfolioAPI } from '../services/agentsAPI';

const hasProfile = await portfolioAPI.hasProfile(userId);
if (!hasProfile) {
  // Redirect to onboarding
  navigate('/agents/onboarding');
}
```

### Generate personalized images
```tsx
import { generationAPI } from '../services/agentsAPI';

const generateImages = async () => {
  const result = await generationAPI.smartGenerate(
    userId, 
    'elegant evening dress',
    { mode: 'specific', quantity: 4 }
  );
  
  if (result.success && result.results) {
    setImages(result.results.results);
  }
};
```

### Submit feedback for learning
```tsx
import AgentsFeedback from '../components/AgentsFeedback';

<AgentsFeedback
  imageId={image.id}
  imageUrl={image.url}
  prompt={image.prompt}
  designerId={userId}
  onFeedbackSubmitted={(feedback) => {
    console.log('Feedback submitted:', feedback);
    // Handle feedback submission
  }}
/>
```

## 🎨 UI Components

### AgentsOnboarding
- **Purpose**: Complete portfolio analysis workflow
- **Features**: System check, image upload, style profile creation, first generation
- **Usage**: Route users here for initial setup

### AgentsGeneration
- **Purpose**: Enhanced generation with personalization
- **Features**: System status, profile display, personalized generation, batch mode
- **Usage**: Main generation interface

### AgentsFeedback
- **Purpose**: Collect feedback for AI learning
- **Features**: Simple/detailed feedback, star ratings, comments
- **Usage**: Add to generated image displays

## 🔄 Workflow Integration

### New User Flow
```
1. User signs up → Login
2. Redirect to /agents/onboarding
3. Upload portfolio → Create style profile
4. Generate first images
5. Redirect to main dashboard
```

### Existing User Flow
```
1. Check if user has style profile
2. If yes → Enhanced generation with personalization
3. If no → Option to analyze portfolio
4. Collect feedback on all generated images
```

### Gradual Migration
You can roll this out gradually:
```tsx
const useAgents = process.env.REACT_APP_USE_AGENTS === 'true';

if (useAgents && hasProfile) {
  // Use AI agents for personalized generation
  return <AgentsGeneration />;
} else {
  // Use existing generation system
  return <ExistingGeneration />;
}
```

## 🚨 Error Handling

The agents API includes robust error handling:

```tsx
import { systemAPI } from '../services/agentsAPI';

// Check if agents are available
const agentsAvailable = await systemAPI.isAvailable();
if (!agentsAvailable) {
  // Fall back to existing system
  showMessage('AI agents temporarily unavailable. Using basic generation.');
}
```

## 📱 Mobile Responsiveness

All new components are fully responsive:
- Grid layouts adapt to screen size
- Touch-friendly interface
- Mobile-optimized image upload
- Swipe-friendly feedback system

## 🎯 Key Benefits

### For Users
- **Personalized Generation**: Images match their unique style
- **Continuous Learning**: Gets better with every feedback
- **Professional Quality**: Enhanced with GFPGAN + Real-ESRGAN
- **Batch Processing**: Generate 100+ images overnight

### For Developers
- **Modular Components**: Easy to integrate piece by piece
- **Type Safety**: Full TypeScript support
- **Error Handling**: Graceful fallbacks to existing system
- **Performance**: Optimized API calls and caching

## 🔧 Development Setup

1. **Start Python Agents Service**:
   ```bash
   cd ../agents-service
   ./start-dev.sh
   ```

2. **Start React App**:
   ```bash
   npm start
   ```

3. **Test Integration**:
   - Visit `/agents/onboarding`
   - Upload 5+ design images
   - Test personalized generation
   - Provide feedback on results

## 🎨 Customization

### Styling
All components use Tailwind CSS classes. Customize by:
```tsx
// Update color scheme
className="bg-purple-600" → className="bg-blue-600"

// Update component layout
className="grid grid-cols-3" → className="grid grid-cols-4"
```

### Features
Enable/disable features via environment variables:
```bash
REACT_APP_ENABLE_PORTFOLIO_ANALYSIS=false
REACT_APP_ENABLE_FEEDBACK_LEARNING=false
```

## 🚀 Next Steps

1. **Integrate Components**: Add routes and navigation
2. **Test Workflow**: Complete user journey end-to-end  
3. **Customize Styling**: Match your brand colors
4. **Monitor Performance**: Track usage and feedback
5. **Scale**: Add more agents and features

The AI agents system is fully integrated and ready to enhance your fashion generation platform! 🎉