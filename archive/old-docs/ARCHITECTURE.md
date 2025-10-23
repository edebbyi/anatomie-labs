# Designer BFF - Architecture Overview

## 🏛️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Voice   │  │ Gallery  │  │Feedback  │  │Analytics │   │
│  │ Command  │  │(Pinterest│  │ (Heart/  │  │Dashboard │   │
│  │  Input   │  │  Style)  │  │ Comment) │  │          │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │ REST API + WebSocket
┌────────────────────────┴────────────────────────────────────┐
│                    Backend (Node.js + Express)               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              API Routes & Controllers                 │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │  /auth  /voice  /vlt  /images  /feedback /analytics │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                  Service Layer                        │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │  VLT   │  R2Storage  │ ImageGen │  RLHF  │  Voice   │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────┬────────────┬────────────┬────────────┬────────────┘
          │            │            │            │
    ┌─────▼─────┐ ┌───▼───┐  ┌────▼────┐  ┌───▼──────┐
    │PostgreSQL │ │ Redis │  │   R2    │  │  VLT API │
    │  (Users,  │ │(Cache,│  │(Images) │  │(Analysis)│
    │Metadata,  │ │Queue, │  │  CDN    │  │          │
    │Analytics) │ │Session│  │         │  │          │
    └───────────┘ └───────┘  └─────────┘  └──────────┘
```

## 📊 Data Flow

### Image Generation Pipeline (11 Stages)

```
1. Voice Command → Parse → VLT Spec
2. VLT Spec → GPT/Claude Enhancement
3. Enhanced Prompt → Persona Matching
4. Routing → Best AI Model Selection
5. Prompt → RLHF Optimization
6. Generate → 4 Images per Prompt
7. Post-Process → GFPGAN + Real-ESRGAN
8. Quality Control → VLT Validation
9. Selection → DPP Sampling (Best 100)
10. User Feedback → Heart/Comment
11. Analytics → Global Learning Update
```

### Multi-User Request Flow

```
User A                    User B                    User C
  │                        │                         │
  ├─ POST /voice/command   ├─ GET /gallery          ├─ POST /feedback
  │                        │                         │
  ▼                        ▼                         ▼
┌────────────────────────────────────────────────────────┐
│              Express Server (Port 5000)                │
├────────────────────────────────────────────────────────┤
│  Auth Middleware → Verify JWT → req.user = {id, ...}  │
└────────────────────────────────────────────────────────┘
  │                        │                         │
  ├─ Save to PostgreSQL   ├─ Query PostgreSQL      ├─ Update PostgreSQL
  │  (user_id: A)         │  (user_id: B)          │  (user_id: C)
  │                        │                         │
  ├─ Queue Job in Redis   ├─ Fetch from R2         ├─ Update global_learning
  │  (job_id: uuid-A)     │  (prefix: B/*)         │  (aggregate all users)
  │                        │                         │
  ▼                        ▼                         ▼
User A gets job_id       User B gets images       User C feedback recorded
```

## 🗄️ Database Schema (PostgreSQL)

### Core Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `users` | Authentication & profiles | id, email, password_hash, role |
| `user_profiles` | Style preferences | user_id, style_preference, favorite_colors |
| `voice_commands` | Command history | user_id, original_text, parsed_command |
| `vlt_specifications` | Generated specs | user_id, garment_type, prompt_text |
| `generation_jobs` | Image gen tracking | user_id, status, quantity, model_provider |
| `images` | Image metadata | user_id, r2_key, cdn_url, is_outlier |
| `image_feedback` | User ratings | image_id, user_id, feedback_type, rating |
| `global_learning` | Aggregate insights | attribute_type, success_rate, user_count |
| `cost_tracking` | Per-user costs | user_id, service_type, cost |

### Key Relationships

```sql
users (1) ──── (*) voice_commands
users (1) ──── (*) generation_jobs
generation_jobs (1) ──── (*) images
images (1) ──── (*) image_feedback
users (*) ──── (*) images (through image_feedback)
```

## 💾 Storage Strategy

### Cloudflare R2 Structure

```
designer-bff-images/
├── {userId-1}/
│   ├── 2025-01-15/
│   │   ├── generated/
│   │   │   ├── uuid-1.jpg
│   │   │   └── uuid-2.jpg
│   │   ├── thumbnail/
│   │   │   ├── uuid-1-thumb.jpg
│   │   │   └── uuid-2-thumb.jpg
│   │   └── enhanced/
│   │       ├── uuid-1-enhanced.jpg
│   │       └── uuid-2-enhanced.jpg
│   └── 2025-01-16/
│       └── ...
└── {userId-2}/
    └── ...
```

### Cost Breakdown

**Per Image (Full Pipeline):**
- Generation: ~$0.040
- GFPGAN: $0.003
- Real-ESRGAN: $0.004
- R2 Storage: $0.000015/month
- **Total: ~$0.047 one-time + $0.000015/month**

**Monthly for Active User (200 images):**
- Generation: $9.40
- Storage: $0.003
- **Total: ~$9.50/month**

## 🔐 Security Model

### Authentication Flow

```
1. User registers → Password hashed (bcrypt)
2. Server generates JWT token
3. Token stored in Redis (session)
4. Client includes token in Authorization header
5. Middleware verifies token on each request
6. req.user populated with {id, email, role}
```

### Data Isolation

- **Database**: Foreign keys ensure user data separation
- **R2 Storage**: User ID in path prevents cross-user access
- **API**: Middleware validates user ownership before access
- **Real-time**: Socket.IO rooms per user ID

## 📈 Scalability Considerations

### Current Limits (Single Instance)

- **Concurrent Users**: ~1000
- **Requests/sec**: ~500
- **Database Connections**: 100
- **Redis Connections**: 50
- **Image Storage**: Unlimited (R2)

### Horizontal Scaling (Future)

```
┌──────────────────────────────────────────┐
│         Load Balancer (nginx)            │
└─────┬────────┬────────┬────────┬─────────┘
      │        │        │        │
  ┌───▼───┐┌───▼───┐┌───▼───┐┌───▼───┐
  │Server1││Server2││Server3││Server4│
  └───┬───┘└───┬───┘└───┬───┘└───┬───┘
      │        │        │        │
      └────────┴────────┴────────┘
               │
      ┌────────┴────────┐
      │                 │
  ┌───▼──────┐   ┌─────▼─────┐
  │PostgreSQL│   │  Redis    │
  │ Primary  │   │  Cluster  │
  └──────────┘   └───────────┘
```

## 🚀 Performance Benchmarks

### Target Metrics

| Operation | Target | Current |
|-----------|--------|---------|
| User Registration | <200ms | ✅ TBD |
| Voice Command Parse | <500ms | ✅ TBD |
| VLT Analysis | <2s | ✅ TBD |
| Image Generation | 30-60s | ✅ TBD |
| Gallery Load (20 items) | <1s | ✅ TBD |
| Feedback Submit | <100ms | ✅ TBD |

### Optimization Strategy

1. **Database**: Proper indexing, query optimization
2. **Caching**: Redis for frequently accessed data
3. **CDN**: R2 global distribution
4. **Job Queue**: Async processing for heavy tasks
5. **Connection Pooling**: Reuse DB/Redis connections

## 🎯 API Endpoints Summary

### Authentication
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Get JWT token
- `GET /api/auth/profile` - User info
- `PUT /api/auth/profile` - Update profile

### Voice Commands
- `POST /api/voice/process-text` - Parse text command
- `POST /api/voice/process-audio` - Transcribe audio
- `GET /api/voice/commands/examples` - Get examples

### VLT Integration
- `GET /api/vlt/health` - Check VLT status
- `POST /api/vlt/analyze/single` - Analyze one image
- `POST /api/vlt/analyze/batch` - Analyze ZIP
- `POST /api/vlt/enhance-prompt` - Get enhanced prompt

### Images
- `POST /api/images/generate` - Start generation
- `GET /api/images/gallery` - List user images
- `GET /api/images/:id` - Get single image

### Feedback
- `POST /api/feedback/outlier` - Mark as favorite
- `POST /api/feedback/comment` - Add comment

### Analytics
- `GET /api/analytics/dashboard` - User stats

## 🔄 Real-Time Features (Socket.IO)

### Events

**Client → Server:**
- `join-room` - Subscribe to user updates
- `voice-command` - Live voice processing

**Server → Client:**
- `generation-started` - Job queued
- `generation-progress` - {current, total}
- `generation-complete` - {job_id, images}
- `error` - Error notification

## 📝 Monitoring & Logging

### Winston Log Levels

```
error: Critical failures
warn: Potential issues
info: General operations
debug: Detailed diagnostics
```

### Key Metrics to Track

- Request latency (p50, p95, p99)
- Error rates by endpoint
- Database query times
- R2 upload/download times
- VLT API response times
- Cost per user per day
- Active users count
- Images generated per day

---

**This architecture supports:**
- ✅ Multi-user with data isolation
- ✅ Scalable image storage (R2)
- ✅ Real-time features (Socket.IO)
- ✅ Cost-effective operations
- ✅ Global learning from all users
- ✅ High availability ready