# ANATOMIE Image Upload Testing Guide

## 🚀 Quick Start - First Time User

Your dev servers are now running! 

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **Health Check**: http://localhost:3001/health

## 📸 Upload Your ANATOMIE Images

### Option 1: Through the Onboarding Flow (Recommended for First-Time Users)

1. **Open the app**: http://localhost:3000
2. **Navigate to Onboarding**: Click "Get Started" or go to http://localhost:3000/onboarding
3. **Complete Step 1**: Enter your details
   - Name: ANATOMIE Team
   - Email: team@anatomie.com
   - Company: ANATOMIE
4. **Prepare Your Images**:
   - Collect 50-500 ANATOMIE product images in a folder
   - **Create a ZIP file** from the folder:
     - **macOS**: Right-click folder → "Compress [folder name]"
     - **Windows**: Right-click folder → "Send to" → "Compressed (zipped) folder"
     - **Linux**: `zip -r anatomie-images.zip /path/to/folder`
5. **Upload Portfolio (Step 2)**:
   - Click "Select ZIP File" button
   - **Upload the ZIP file containing 50-500 ANATOMIE images**
   - ⚠️ **IMPORTANT**: VLT API requires ZIP format, not individual files or folders
6. **Wait for Processing**: 
   - VLT will extract and analyze each image
   - Tags each image with style attributes
   - System generates initial style profile
   - First batch of 100 images will be generated

### Option 2: Direct API Upload (For Testing)

Use this method to directly test the backend and VLT tagging:

```bash
# First, create a ZIP file with your images
zip -r anatomie-batch.zip /path/to/your/image/folder/

# Upload ZIP file for batch VLT analysis
curl -X POST http://localhost:3001/api/vlt/batch-analyze \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@anatomie-batch.zip" \
  -F "model=gemini" \
  -F "passes=A,B,C"

# Or upload a single image (for quick testing)
curl -X POST http://localhost:3001/api/images/test-upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "image=@/path/to/anatomie/image.jpg"
```

### Option 3: Through the Profile Page

1. Go to http://localhost:3000/profile
2. Upload a company logo
3. This tests basic image upload functionality

## 🔍 What Happens When You Upload Images

### Stage 1-3: VLT Analysis Pipeline
When you upload ANATOMIE images, the system will:

1. **Upload to R2 Storage** (Cloudflare)
   - Images stored in cloud storage
   - CDN URLs generated

2. **VLT Analysis** (Visual Language Transformer)
   - Analyzes each image for style attributes
   - Tags: silhouette, fabric, color, aesthetic
   - Creates structured style profile

3. **Style Profile Generation**
   - Aggregates tags across all images
   - Identifies your brand's unique style signatures
   - Stores in Pinecone vector database

### Stage 4-6: Generation & Enhancement
4. **Prompt Generation**
   - Creates diverse prompts based on your style
   - Uses GPT-4 with your style context

5. **Image Generation**
   - Routes to optimal AI model (Imagen/DALL-E/SD)
   - Generates images matching your style profile

6. **Enhancement Pipeline**
   - GFPGAN: Face enhancement
   - Real-ESRGAN: 4x upscaling
   - Quality verification

## 🧪 Testing the Complete Workflow

### Test Case 1: Upload & Tag
**Goal**: Verify VLT properly tags ANATOMIE images

1. Upload 10-20 ANATOMIE product images
2. Check the console/logs for VLT responses
3. Verify tags make sense for ANATOMIE style:
   - Minimalist
   - Clean lines
   - Functional design
   - Premium fabrics
   - Neutral colors

**Check Backend Logs**:
```bash
tail -f /Users/esosaimafidon/Documents/GitHub/anatomie-lab/logs/app.log
```

### Test Case 2: Style Profile Creation
**Goal**: Ensure accurate style profile

1. After uploading images, go to http://localhost:3000/style-profile
2. Review the generated style attributes
3. Verify they match ANATOMIE's aesthetic:
   - Modern minimalism
   - Travel-ready
   - Wrinkle-resistant focus
   - Versatile designs

### Test Case 3: Image Generation
**Goal**: Generate new designs that match ANATOMIE style

1. Go to http://localhost:3000/generation
2. Try voice or text command:
   - "Generate 10 minimalist travel dresses"
   - "Create 20 wrinkle-resistant pants"
3. Review generated images
4. Check if they match ANATOMIE aesthetic

### Test Case 4: Feedback Loop
**Goal**: Verify the system learns from feedback

1. Go to http://localhost:3000/feedback
2. Swipe through generated images
3. Like images that match ANATOMIE style
4. Discard ones that don't
5. Generate a new batch - should be more aligned

## 📊 Monitoring & Verification

### Check Backend Health
```bash
curl http://localhost:3001/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-10-11T21:50:52.076Z",
  "version": "1.0.0",
  "environment": "development",
  "services": {
    "database": true,
    "redis": true,
    "r2Storage": true,
    "pinecone": true
  }
}
```

### Check Image Upload Status
```bash
# Get your gallery
curl http://localhost:3001/api/images/gallery \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Check VLT Service
```bash
# Test VLT API directly
curl -X POST http://localhost:3001/api/vlt/analyze \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "imageUrl": "YOUR_IMAGE_URL",
    "model": "gemini",
    "passes": ["A", "B", "C"]
  }'
```

## 🐛 Troubleshooting

### Issue: Upload fails
**Check**:
1. File is a valid ZIP file (not RAR, 7z, etc.)
2. ZIP file size < 500MB
3. ZIP contains image files (jpg, png, webp, etc.)
4. R2 Storage configured in `.env`
5. Images are not nested in multiple folders within ZIP

### Issue: VLT tagging not working
**Check**:
1. Uploaded file is a ZIP (VLT API requirement)
2. VLT_API_URL in `.env` is correct
3. VLT_API_KEY is valid
4. ZIP file extracted successfully
5. Check backend logs: `tail -f logs/app.log`

### Issue: No images generated
**Check**:
1. Image generation API keys configured
2. Check job queue status
3. Review backend logs for errors

### Issue: Style profile looks wrong
**Solution**:
1. Upload more images (minimum 50 recommended)
2. Ensure images are representative of ANATOMIE style
3. Clear old profile and regenerate

## 📁 Recommended Test Images

For best results, prepare your ANATOMIE images:

### Creating Your ZIP File

1. **Organize Images in a Folder**:
   ```
   anatomie-portfolio/
   ├── dress-001.jpg
   ├── dress-002.jpg
   ├── pants-001.jpg
   ├── pants-002.jpg
   └── ... (50-500 total images)
   ```

2. **Create the ZIP File**:
   - **macOS**: Right-click folder → "Compress anatomie-portfolio"
   - **Windows**: Right-click → "Send to" → "Compressed (zipped) folder"
   - **Command line**: `zip -r anatomie-portfolio.zip anatomie-portfolio/`

3. **Verify ZIP Contents**:
   - Check file size (should be reasonable for image count)
   - Ensure images are in common formats (JPG, PNG, WEBP)
   - No nested folders (images should be at root of ZIP)

### What to Include

1. **Product Photos**:
   - Front view
   - Back view
   - Detail shots
   - Styled on models

2. **Style Variety**:
   - Dresses
   - Pants
   - Tops
   - Outerwear
   - Accessories

3. **Different Settings**:
   - Studio shots
   - Lifestyle photos
   - Travel contexts
   - Urban environments

## 🎯 Success Criteria

You'll know the system is working when:

✅ Images upload successfully to R2
✅ VLT returns structured tags for each image
✅ Style profile shows ANATOMIE-relevant attributes
✅ Generated images have similar aesthetic to uploaded images
✅ System improves based on your feedback
✅ New batches are more aligned with your preferences

## 📝 API Endpoints Reference

### Image Upload
- `POST /api/images/test-upload` - Upload single image
- `GET /api/images/gallery` - Get your image gallery

### VLT Analysis
- `POST /api/vlt/analyze` - Analyze single image
- `POST /api/vlt/batch-analyze` - Analyze multiple images

### Generation
- `POST /api/generate` - Generate images
- `GET /api/generate/status/:jobId` - Check generation status

### Profile
- `GET /api/persona/profile` - Get your style profile
- `POST /api/persona/update` - Update preferences

## 🔄 Next Steps After Testing

Once you've verified the upload and tagging works:

1. **Batch Upload**: Upload your full ANATOMIE catalog (200-500 images)
2. **Refine Profile**: Review and adjust style attributes
3. **Generate Test Batch**: Create 50-100 test images
4. **Provide Feedback**: Like/discard to train the system
5. **Schedule Nightly Generation**: Set up automated batch creation
6. **Monitor Quality**: Track generation quality metrics

## 💡 Tips for Best Results

- **Upload High-Quality Images**: Better input = better style understanding
- **Variety Matters**: Upload different garment types and styles
- **Consistent Aesthetic**: Make sure images represent ANATOMIE's brand
- **Give Feedback**: The more you interact, the better it learns
- **Be Patient**: Initial processing may take 5-10 minutes for 100+ images

## 📧 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review backend logs: `tail -f logs/app.log`
3. Check frontend console: Browser DevTools → Console
4. Verify `.env` configuration is complete

---

**Ready to test?** Open http://localhost:3000 and start uploading your ANATOMIE images! 🚀
