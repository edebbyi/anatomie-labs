# Designer BFF - Complete Setup Guide

## 🏗️ Multi-User Architecture Overview

### Tech Stack
- **Frontend**: React 18 (to be built)
- **Backend**: Node.js + Express
- **Database**: PostgreSQL 14+ (user data, metadata, analytics)
- **Cache/Sessions**: Redis (real-time features, job queues)
- **Image Storage**: Cloudflare R2 (S3-compatible, zero egress)
- **Real-time**: Socket.IO (live updates)

### Why This Stack?

**PostgreSQL**: 
- ACID compliance for user data
- JSONB for flexible metadata
- Strong indexing for performance
- Perfect for multi-user relational data

**Redis**:
- Fast session management
- Job queue for nightly generation
- Real-time pub/sub
- Caching layer

**Cloudflare R2**:
- **Zero egress fees** (unlimited downloads)
- $0.015/GB/month storage (75% cheaper than S3)
- S3-compatible API (easy integration)
- Global CDN included
- Perfect for Pinterest-style image browsing

## 📋 Prerequisites

```bash
# Required
- Node.js 18+ and npm 9+
- PostgreSQL 14+ 
- Redis 6+
- Cloudflare Account (for R2)

# Optional but recommended
- VLT API access
- OpenAI API key
- Google Cloud credentials (for speech-to-text)
```

## 🚀 Step-by-Step Setup

### 1. Install Core Dependencies

```bash
# Clone and navigate to project
cd anatomie-lab

# Install minimal dependencies (streamlined for speed)
npm install

# If npm install fails, try:
npm install --legacy-peer-deps
```

**Core Dependencies Installed:**
- `express` - Web framework
- `pg` - PostgreSQL client
- `redis` - Redis client
- `aws-sdk` - For R2 (S3-compatible)
- `socket.io` - Real-time features
- `winston` - Logging
- `multer` - File uploads
- `bcryptjs` & `jsonwebtoken` - Authentication

### 2. Set Up PostgreSQL

```bash
# Install PostgreSQL (Mac)
brew install postgresql@14
brew services start postgresql@14

# Create database
createdb designer_bff

# Run schema
psql designer_bff < database/schema.sql

# Verify
psql designer_bff -c "\\dt"
```

**Database Schema Includes:**
- ✅ Users & authentication
- ✅ Style profiles & preferences
- ✅ Voice commands history
- ✅ VLT specifications
- ✅ Generation jobs & images metadata
- ✅ User feedback & outliers
- ✅ Collections/galleries
- ✅ Cost tracking
- ✅ Global learning data
- ✅ Analytics snapshots

### 3. Set Up Redis

```bash
# Install Redis (Mac)
brew install redis
brew services start redis

# Test connection
redis-cli ping
# Should return: PONG
```

**Redis Usage:**
- Session storage (JWT tokens)
- Job queue (nightly generation)
- Real-time pub/sub (Socket.IO)
- Caching (VLT results, user prefs)

### 4. Set Up Cloudflare R2

#### Create R2 Bucket

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to R2 Object Storage
3. Click "Create bucket"
4. Name: `designer-bff-images`
5. Location: Automatic
6. Click "Create bucket"

#### Generate API Credentials

1. In R2 dashboard, click "Manage R2 API Tokens"
2. Create API token with permissions:
   - Object Read & Write
   - Bucket List & Read
3. Save:
   - Access Key ID
   - Secret Access Key
   - Endpoint URL (format: `https://<account-id>.r2.cloudflarestorage.com`)

#### Configure CDN (Optional but Recommended)

1. In your bucket settings, click "Connect Domain"
2. Add custom domain: `images.yourdomain.com`
3. Update DNS records as instructed
4. Enable "Public Access" for Pinterest-style browsing

**R2 Cost Estimate:**
```
Storage: $0.015/GB/month
Operations: $0.36 per million Class A, $0.04 per million Class B
Egress: $0 (FREE!)

Example for 10,000 images:
- Storage: ~30GB = $0.45/month
- Operations: ~$0.50/month
- Total: < $1/month vs $10-15 on S3
```

### 5. Configure Environment

```bash
# Copy example env
cp .env.example .env

# Edit .env with your credentials
nano .env
```

**Critical Environment Variables:**

```bash
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/designer_bff

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-super-secret-key-change-this-NOW

# VLT API
VLT_API_URL=https://visual-descriptor-516904417440.us-central1.run.app
VLT_API_KEY=your_vlt_api_key_here

# Cloudflare R2
R2_ENDPOINT=https://<your-account-id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_BUCKET_NAME=designer-bff-images
R2_CDN_URL=https://images.yourdomain.com

# Optional: OpenAI for enhanced processing
OPENAI_API_KEY=your_openai_api_key
```

### 6. Test the Setup

```bash
# Start the server
npm run dev

# In another terminal, test endpoints:

# Health check
curl http://localhost:5000/health

# VLT health check
curl http://localhost:5000/api/vlt/health

# Register a user
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User"
  }'

# Test voice command (get token from register response)
curl -X POST http://localhost:5000/api/voice/process-text \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "command": "make me 10 bohemian style dresses"
  }'
```

## 🎨 Multi-User Features

### User Isolation
- Each user has separate galleries
- Images stored in R2 with user-specific paths: `{userId}/{date}/{type}/{imageId}.jpg`
- PostgreSQL ensures data isolation with foreign keys
- Redis sessions prevent cross-user access

### Concurrent Generation
- Job queue handles multiple users simultaneously
- Each generation job tracked independently
- Real-time Socket.IO updates per user
- Cost tracking per user

### Global Learning
- Aggregate feedback across all users
- Update `global_learning` table with success rates
- Influence prompt optimization for everyone
- Privacy-preserving (no personal data shared)

### Scalability
- PostgreSQL: Handles millions of records
- R2: Unlimited storage, global CDN
- Redis: Sub-millisecond responses
- Horizontal scaling ready

## 📊 Database Management

### Common Queries

```sql
-- Get user stats
SELECT 
  u.name,
  COUNT(DISTINCT i.id) as total_images,
  COUNT(DISTINCT i.id) FILTER (WHERE i.is_outlier = true) as outliers,
  SUM(i.generation_cost + i.enhancement_cost) as total_cost
FROM users u
LEFT JOIN images i ON u.id = i.user_id
GROUP BY u.id, u.name;

-- Top performing styles globally
SELECT 
  attribute_value,
  success_rate,
  user_count
FROM global_learning
WHERE attribute_type = 'style'
ORDER BY success_rate DESC
LIMIT 10;

-- User's recent generations
SELECT 
  gj.id,
  gj.status,
  gj.quantity,
  gj.model_provider,
  COUNT(i.id) as images_generated
FROM generation_jobs gj
LEFT JOIN images i ON gj.id = i.job_id
WHERE gj.user_id = 'USER_UUID_HERE'
GROUP BY gj.id
ORDER BY gj.created_at DESC
LIMIT 10;
```

### Backup Strategy

```bash
# Daily backup
pg_dump designer_bff > backups/designer_bff_$(date +%Y%m%d).sql

# Automated backup script (add to cron)
0 2 * * * pg_dump designer_bff | gzip > /backups/designer_bff_$(date +\%Y\%m\%d).sql.gz
```

## 🚀 Production Deployment

### Recommended Services

**Database**: 
- Heroku Postgres ($9/month starter)
- Neon (serverless PostgreSQL, generous free tier)
- Railway ($5/month)

**Redis**:
- Upstash (serverless Redis, free tier)
- Redis Cloud (free 30MB)

**App Hosting**:
- Railway (easy deployment)
- Render (auto-scaling)
- Fly.io (edge deployment)

**R2**:
- Already on Cloudflare (no additional service needed)

### Environment Variables for Production

```bash
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://user:pass@host:5432/dbname?ssl=true
REDIS_URL=rediss://user:pass@host:6379
JWT_SECRET=use-a-very-strong-random-secret
R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
# ... other vars
```

### Deploy Commands

```bash
# Build for production
npm run build

# Start production server
npm start

# Or with PM2 for process management
npm install -g pm2
pm2 start server.js --name designer-bff
pm2 save
pm2 startup
```

## 🎯 Next Steps

1. **Test VLT Integration**: Upload a test image to verify VLT API works
2. **Configure R2**: Set up your bucket and test image upload
3. **Build Frontend**: Create React components (next task)
4. **Add Image Generation**: Integrate DALL-E/Stable Diffusion
5. **Set Up Nightly Jobs**: Configure cron for automated generation
6. **Monitor Costs**: Set up alerts in Cloudflare dashboard

## 🆘 Troubleshooting

### PostgreSQL Connection Issues
```bash
# Check if PostgreSQL is running
brew services list | grep postgresql

# Check connection
psql designer_bff -c "SELECT 1"
```

### Redis Connection Issues
```bash
# Check Redis
redis-cli ping

# Check logs
tail -f /usr/local/var/log/redis.log
```

### R2 Upload Issues
- Verify account ID in endpoint URL
- Check API token permissions
- Test with AWS CLI: `aws s3 ls --endpoint-url YOUR_R2_ENDPOINT`

### VLT API Issues
- Verify API key is correct
- Check endpoint: `curl https://visual-descriptor-516904417440.us-central1.run.app/healthz`
- Review rate limits

## 📈 Performance Optimization

### PostgreSQL
- Run `VACUUM ANALYZE` weekly
- Monitor slow queries with `pg_stat_statements`
- Add indexes as needed

### Redis
- Monitor memory usage: `redis-cli INFO memory`
- Set maxmemory policy: `maxmemory-policy allkeys-lru`

### R2
- Use WebP format for 30% smaller files
- Generate thumbnails (256x256) for gallery views
- Implement lazy loading in frontend

## 📝 Development Workflow

```bash
# Start all services
brew services start postgresql@14
brew services start redis
npm run dev

# Watch logs
tail -f logs/combined.log

# Run database migrations (when schema changes)
psql designer_bff < database/schema.sql

# Test API endpoints
# (use Postman or create test scripts)
```

---

**You're all set!** 🎉 

The infrastructure is ready for multi-user support with scalable image storage, real-time features, and comprehensive analytics.