# Database Schema Fix Guide

## Problem
The application was missing critical database tables:
- `portfolios`
- `portfolio_images`
- `image_embeddings`
- `image_descriptors`
- `style_profiles`
- `ultra_detailed_descriptors`
- `descriptor_quality_log`
- `descriptor_corrections`
- `prompts`
- `generations`
- `feedback`
- `learning_events`
- `prompt_history`

This caused onboarding errors: `relation "portfolios" does not exist`

## Solution
All missing tables have been added to `/database/schema.sql`

## How to Apply the Fix

### Option 1: On Render (Recommended for Production)

1. After pushing this code, connect to your Render database:
   ```bash
   # Get your DATABASE_URL from Render dashboard
   # Then run:
   psql $DATABASE_URL -f database/schema.sql
   ```

2. Or use the Node.js script:
   ```bash
   node scripts/apply-schema.js
   ```

### Option 2: Local Development

```bash
# Make sure your .env is configured with database credentials
./apply-schema.sh
```

## Verification

After applying the schema, verify all tables exist:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND table_name IN (
    'portfolios',
    'portfolio_images',
    'style_profiles',
    'ultra_detailed_descriptors'
  )
ORDER BY table_name;
```

## What Changed

1. **Updated** `database/schema.sql` - Added all missing tables
2. **Created** `scripts/apply-schema.js` - Node.js script to apply schema
3. **Created** `apply-schema.sh` - Shell script to apply schema

## Next Steps

1. Push this code to your repository
2. Deploy to Render (or it will auto-deploy)
3. Run the schema application script on Render
4. Test the onboarding flow
