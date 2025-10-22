# Designer BFF - AI-Powered Design Platform

Transform voice commands into stunning fashion designs with AI-powered image generation and intelligent feedback loops.

## 🚀 Features

- **Voice Commands**: Say "make me 40 dresses" and watch AI create them
- **VLT Integration**: Advanced Vision Language Transformer analysis  
- **Multi-Model Generation**: Route to optimal AI models (Imagen, DALL-E, Stable Diffusion)
- **Smart Enhancement**: GFPGAN face enhancement + Real-ESRGAN upscaling
- **Pinterest/Tinder UI**: Intuitive browsing and feedback interface
- **Nightly Generation**: Automated batch creation of ~200 images daily
- **Global Learning**: System improves from all user feedback
- **Analytics & Insights**: VLT-powered analytics dashboard with actionable recommendations
- **Cost Optimization**: Intelligent routing and enhancement pipeline

## 🛠️ Quick Start

### Installation
```bash
npm install
cp .env.example .env
# Edit .env with your API keys
npm run dev
```

### VLT API Configuration
```bash
# Add to .env
VLT_API_URL=https://visual-descriptor-516904417440.us-central1.run.app
VLT_API_KEY=your_api_key_here
```

Visit http://localhost:5000 for the API and http://localhost:3000 for the frontend.

## 📊 Architecture

Designer BFF implements an 11-stage AI pipeline from voice commands to high-quality fashion images with intelligent feedback loops and continuous learning.

### Pipeline Stages

1. **Voice Processing**: Convert voice commands to actionable requests
2. **VLT Analysis**: Vision Language Transformer attribute extraction
3. **Model Routing**: Intelligent routing to optimal AI providers
4. **Image Generation**: Multi-model fashion image creation
5. **Enhancement**: GFPGAN + Real-ESRGAN quality improvement
6. **RLHF Feedback**: Reinforcement Learning from Human Feedback
7. **Style Clustering**: Identify and track style preferences
8. **Outlier Detection**: Identify high-quality outlier generations
9. **Coverage Analysis**: Gap detection in style coverage
10. **Prompt Templates**: Dynamic prompt generation with learning
11. **Analytics & Insights**: Comprehensive analytics dashboard with personalized recommendations

📚 **Detailed Documentation**: See [STAGE_11_ANALYTICS.md](STAGE_11_ANALYTICS.md) for complete Stage 11 documentation.

## 🎯 Usage Examples

- "Make me 10 bohemian style dresses"
- "Create 5 minimalist black tops" 
- "Generate 20 silk evening gowns"

## 💰 Cost Structure

~$0.047 per image (full pipeline including generation, enhancement, and analysis)

See full documentation for detailed setup, API integration, and development guidelines.
