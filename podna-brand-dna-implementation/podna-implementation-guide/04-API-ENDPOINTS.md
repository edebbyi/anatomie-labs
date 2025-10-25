# 04: API Endpoints Reference
## Complete API Documentation for Brand DNA System

---

## Base URL

```
Development: http://localhost:3001/api
Production: https://api.podna.com/api
```

All endpoints require authentication via Bearer token unless otherwise specified.

---

## Authentication

```http
Authorization: Bearer <token>
```

Get token from login/signup endpoints.

---

## Endpoints Overview

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/podna/portfolio/upload` | POST | Upload portfolio ZIP |
| `/podna/portfolio/analyze` | POST | Trigger analysis |
| `/podna/profile` | GET | Get style profile + brand DNA |
| `/podna/generate-with-dna` | POST | Generate with brand DNA |
| `/podna/feedback` | POST | Submit feedback |
| `/podna/brand-consistency/:id` | GET | Get consistency score |

---

## 1. Portfolio Upload

### `POST /api/podna/portfolio/upload`

Upload a ZIP file containing portfolio images for analysis.

**Request:**
```http
POST /api/podna/portfolio/upload
Content-Type: multipart/form-data
Authorization: Bearer <token>

portfolio: <ZIP file>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "portfolioId": "portfolio-abc123",
    "imageCount": 23,
    "status": "analyzing",
    "estimatedTime": "5-10 minutes"
  }
}
```

**Status Codes:**
- `200`: Upload successful
- `400`: Invalid file format or size
- `401`: Unauthorized
- `413`: File too large (max 50MB)

---

## 2. Get Style Profile

### `GET /api/podna/profile`

Get enhanced style profile including brand DNA.

**Request:**
```http
GET /api/podna/profile
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "profile": {
      "id": "profile-xyz789",
      "userId": "user-123",
      "portfolioId": "portfolio-abc123",
      "totalImages": 23,
      "summaryText": "Your style signature is sporty-chic with equestrian influences...",
      "aestheticThemes": [
        {
          "name": "sporty-chic",
          "strength": 0.67,
          "frequency": "67%",
          "description": "Athletic influences elevated with sophisticated styling",
          "examples": ["blazer with athletic details"],
          "garment_types": ["blazer", "dress", "coat"],
          "construction_details": ["princess seams", "welt pockets"]
        }
      ],
      "signaturePieces": [
        {
          "image_id": "img-001",
          "garment_type": "blazer",
          "description": "Navy wool blazer with structured shoulders",
          "standout_detail": "equestrian-inspired gold hardware",
          "confidence": 0.94
        }
      ],
      "constructionPatterns": [
        {
          "name": "princess seams",
          "count": 15,
          "frequency": "65%",
          "garment_types": ["blazer", "dress"],
          "aesthetics": ["sporty-chic"]
        }
      ],
      "distributions": {
        "garments": { "blazer": 0.34, "dress": 0.28 },
        "colors": { "navy": 0.35, "white": 0.28 },
        "fabrics": { "wool": 0.42, "cotton": 0.31 },
        "silhouettes": { "structured": 0.56 }
      },
      "avgConfidence": "0.87",
      "avgCompleteness": "85.3"
    },
    "brandDNA": {
      "primaryAesthetic": "sporty-chic",
      "secondaryAesthetics": ["equestrian", "minimalist"],
      "signatureColors": [
        { "name": "navy", "weight": 0.35, "hex": "#1a2b4c" },
        { "name": "white", "weight": 0.28, "hex": "#ffffff" },
        { "name": "camel", "weight": 0.18, "hex": "#c19a6b" }
      ],
      "signatureFabrics": [
        {
          "name": "wool",
          "weight": 0.42,
          "properties": {
            "texture": "smooth",
            "drape": "structured",
            "weight": "medium"
          }
        }
      ],
      "signatureConstruction": [
        { "detail": "princess seams", "frequency": 0.67 },
        { "detail": "welt pockets", "frequency": 0.54 }
      ],
      "preferredPhotography": {
        "shotTypes": [
          { "type": "three-quarter length", "frequency": 0.58 }
        ],
        "lighting": [
          { "type": "soft natural", "frequency": 0.64 }
        ],
        "angles": [
          { "angle": "3/4 front", "frequency": 0.72 }
        ]
      },
      "primaryGarments": [
        { "type": "blazer", "weight": 0.34 },
        { "type": "dress", "weight": 0.28 }
      ],
      "confidence": {
        "aesthetic": 0.92,
        "overall": 0.87
      },
      "metadata": {
        "totalImages": 23,
        "lastUpdated": "2025-10-24T10:30:00Z",
        "driftScore": 0.12
      }
    }
  }
}
```

**Status Codes:**
- `200`: Success
- `404`: No profile found (user needs to upload portfolio)
- `401`: Unauthorized

---

## 3. Generate with Brand DNA

### `POST /api/podna/generate-with-dna`

Generate images using brand DNA-enhanced prompts.

**Request:**
```http
POST /api/podna/generate-with-dna
Content-Type: application/json
Authorization: Bearer <token>

{
  "prompt": "black blazer with structured shoulders",
  "enforceBrandDNA": true,
  "brandDNAStrength": 0.8,
  "creativity": 0.3,
  "count": 4
}
```

**Parameters:**
- `prompt` (string, required): User's design description
- `enforceBrandDNA` (boolean, optional): Enable brand DNA enforcement (default: true)
- `brandDNAStrength` (number, optional): Brand influence 0.5-1.0 (default: 0.8)
- `creativity` (number, optional): Exploration rate 0.0-1.0 (default: 0.3)
- `count` (number, optional): Number of images to generate (default: 4, max: 20)

**Response:**
```json
{
  "success": true,
  "data": {
    "generations": [
      {
        "id": "gen-xyz789",
        "url": "https://cdn.podna.ai/images/gen-xyz789.jpg",
        "width": 1024,
        "height": 1024,
        "provider": "imagen-4-ultra",
        "brand_consistency_score": 0.89,
        "brand_dna_applied": true,
        "generation_confidence": 0.91,
        "cost_cents": 2,
        "created_at": "2025-10-24T10:35:00Z",
        "metadata": {
          "matched_brand_elements": [
            "wool fabric",
            "structured shoulders",
            "3/4 front angle",
            "soft natural lighting"
          ],
          "diverged_elements": [
            "color: black vs. preferred navy"
          ]
        }
      }
    ],
    "prompt": {
      "id": "prompt-abc123",
      "positive_prompt": "(in the designer's signature 'sporty-chic' aesthetic:1.3), (black wool blazer:1.3), (structured shoulders:1.2)...",
      "negative_prompt": "blurry, low quality, back view, rear view...",
      "metadata": {
        "brand_dna_applied": true,
        "brand_consistency_score": 0.89,
        "thompson_selection": { /* ... */ }
      }
    },
    "brandDNA": {
      "primaryAesthetic": "sporty-chic",
      "signatureElements": {
        "colors": ["navy", "white", "camel"],
        "fabrics": ["wool", "cotton", "silk"],
        "construction": ["princess seams", "welt pockets"]
      },
      "confidence": 0.87
    },
    "avgBrandConsistency": 0.89
  }
}
```

**Status Codes:**
- `200`: Generation successful
- `400`: Invalid parameters or no style profile
- `401`: Unauthorized
- `429`: Rate limit exceeded
- `500`: Generation failed

---

## 4. Submit Feedback

### `POST /api/podna/feedback`

Submit user feedback on a generated image to improve future generations.

**Request:**
```http
POST /api/podna/feedback
Content-Type: application/json
Authorization: Bearer <token>

{
  "generationId": "gen-xyz789",
  "type": "like",
  "note": "Love the shoulder structure"
}
```

**Parameters:**
- `generationId` (string, required): ID of the generation
- `type` (enum, required): `like | dislike | swipe_right | swipe_left`
- `note` (string, optional): Optional text feedback

**Response:**
```json
{
  "success": true,
  "data": {
    "feedbackId": "feedback-123",
    "learningEventId": "event-456",
    "delta": {
      "fabric.wool": 0.1,
      "construction.structured_shoulders": 0.15
    },
    "thompsonParamsUpdated": true
  }
}
```

**Status Codes:**
- `200`: Feedback processed
- `400`: Invalid feedback type
- `401`: Unauthorized
- `404`: Generation not found

---

## 5. Get Brand Consistency Score

### `GET /api/podna/brand-consistency/:generationId`

Get detailed brand consistency breakdown for a generation.

**Request:**
```http
GET /api/podna/brand-consistency/gen-xyz789
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "generationId": "gen-xyz789",
    "overallScore": 0.89,
    "breakdown": {
      "aesthetic": {
        "score": 0.95,
        "matched": "sporty-chic",
        "expected": "sporty-chic"
      },
      "colors": {
        "score": 0.75,
        "matched": ["black", "white"],
        "expected": ["navy", "white", "camel"],
        "note": "Black is close to preferred navy"
      },
      "fabric": {
        "score": 1.0,
        "matched": "wool",
        "expected": ["wool", "cotton"]
      },
      "construction": {
        "score": 0.85,
        "matched": ["structured shoulders"],
        "expected": ["princess seams", "welt pockets", "structured shoulders"]
      },
      "photography": {
        "score": 0.90,
        "matched": {
          "shotType": "three-quarter length",
          "angle": "3/4 front",
          "lighting": "soft natural"
        },
        "expected": {
          "shotType": "three-quarter length",
          "angle": "3/4 front",
          "lighting": "soft natural"
        }
      }
    }
  }
}
```

**Status Codes:**
- `200`: Success
- `401`: Unauthorized
- `404`: Generation not found

---

## Error Responses

All endpoints may return these error formats:

### Standard Error
```json
{
  "success": false,
  "message": "Error description",
  "code": "ERROR_CODE"
}
```

### Common Error Codes
- `NO_STYLE_PROFILE`: User hasn't uploaded portfolio
- `INVALID_TOKEN`: Authentication failed
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `GENERATION_ERROR`: Image generation failed
- `VALIDATION_ERROR`: Invalid input parameters

---

## Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/generate-with-dna` | 100 | 1 hour |
| `/feedback` | 1000 | 1 hour |
| `/profile` | 60 | 1 minute |

When rate limited:
```json
{
  "success": false,
  "message": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 3600
}
```

---

## Webhooks (Future)

For async portfolio analysis completion:

```http
POST https://your-webhook-url.com/podna-analysis-complete
Content-Type: application/json

{
  "event": "portfolio.analysis.complete",
  "portfolioId": "portfolio-abc123",
  "userId": "user-123",
  "timestamp": "2025-10-24T10:40:00Z",
  "data": {
    "totalImages": 23,
    "analyzed": 23,
    "failed": 0,
    "avgConfidence": 0.87,
    "profileId": "profile-xyz789"
  }
}
```

---

## SDK Examples

### JavaScript/TypeScript

```typescript
import { PodnaClient } from '@podna/sdk';

const client = new PodnaClient({
  apiKey: 'your-api-key'
});

// Get profile
const profile = await client.getProfile();

// Generate with brand DNA
const result = await client.generate({
  prompt: 'black blazer',
  enforceBrandDNA: true,
  brandDNAStrength: 0.8,
  count: 4
});

// Submit feedback
await client.submitFeedback(result.generations[0].id, 'like');
```

### Python

```python
from podna import PodnaClient

client = PodnaClient(api_key='your-api-key')

# Get profile
profile = client.get_profile()

# Generate with brand DNA
result = client.generate(
    prompt='black blazer',
    enforce_brand_dna=True,
    brand_dna_strength=0.8,
    count=4
)

# Submit feedback
client.submit_feedback(result['generations'][0]['id'], 'like')
```

---

## Testing Endpoints

Use these test credentials in development:

```
Email: test@podna.com
Password: test123
```

Test portfolio: Download from `/examples/test-portfolio.zip`

---

**Next:** Read `05-TESTING-GUIDE.md` for comprehensive testing procedures.
