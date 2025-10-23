# Image Generation Endpoint

## Overview
The `/generate` endpoint now supports real AI image generation using multiple providers.

## Frontend URL
http://localhost:3000/generate

## Backend API Endpoint
`POST http://localhost:5001/api/generate/generate`

## Request Format
```json
{
  "userId": "optional-uuid",
  "description": "elegant white summer dress with flowing fabric",
  "model": "google-imagen",
  "count": 1
}
```

## Parameters
- `description` (required): Text description of the image to generate
- `model` (optional): AI model to use
  - `google-imagen` (default) - Google Imagen 4 Ultra via Replicate
  - `stable-diffusion-xl` - Stable Diffusion XL
  - `openai-dalle3` - DALL-E 3
- `count` (optional): Number of images to generate (1-10, default: 1)
- `userId` (optional): User ID (must be valid UUID if provided)

## Response Format
```json
{
  "success": true,
  "assets": [
    {
      "id": "asset-uuid",
      "url": "https://...",
      "filename": "r2-key",
      "metadata": {}
    }
  ],
  "generation": {
    "id": "generation-uuid",
    "status": "completed"
  },
  "metadata": {
    "totalGenerated": 1,
    "requested": 1,
    "returned": 1,
    "provider": "Google Imagen 4 Ultra",
    "cost": 0.08
  }
}
```

## UI Features
- Text description input
- Model selector dropdown (Imagen, Stable Diffusion, DALL-E)
- Image count selector (1-10 images)
- Quick batch options (10, 50, 100 images)
- Real-time generation progress
- Generated images gallery with preview

## Configuration
- Backend uses Replicate API token: `REPLICATE_API_TOKEN`
- Configured in `.env` file
- Default provider: Google Imagen 4 Ultra (highest quality for fashion)

## Testing
To test the endpoint directly:
```bash
curl -X POST http://localhost:5001/api/generate/generate \
  -H "Content-Type: application/json" \
  -d '{
    "description": "elegant white summer dress with flowing fabric",
    "model": "google-imagen",
    "count": 1
  }'
```

## Notes
- Generation time varies by model and count
- Imagen 4 Ultra: ~10-30 seconds per image
- Stable Diffusion XL: ~5-15 seconds per image
- DALL-E 3: ~10-20 seconds per image
- Images are automatically uploaded to R2 storage
- All generations are tracked in the database with metadata
