# 🚀 Quick Fix for "portfolios does not exist" Error

## Run This in Your Render Shell

Copy and paste these commands one by one:

### Step 1: Navigate to correct directory
```bash
cd ~/project/src
```

### Step 2: Apply the schema using psql (simplest method)
```bash
psql $DATABASE_URL -f database/schema.sql
```

**That's it!** ✅

---

## Verify It Worked

Run this to confirm the tables were created:
```bash
psql $DATABASE_URL -c "\dt portfolios"
```

You should see:
```
          List of relations
 Schema |    Name    | Type  |     Owner
--------+------------+-------+---------------
 public | portfolios | table | anatomie_user
```

---

## Alternative: If psql doesn't work

Use the Node.js script:
```bash
cd ~/project/src
node scripts/apply-schema.js
```

---

## Expected Output

When the schema is applied successfully, you'll see:
```
======================================
🗄️  Applying Database Schema
======================================

Reading schema from: /path/to/database/schema.sql
✅ Schema file loaded

Connecting to database...
✅ Connected to database

Applying schema...
✅ Schema applied successfully

Verifying tables...
Tables found:
  ✓ image_descriptors
  ✓ image_embeddings
  ✓ portfolio_images
  ✓ portfolios
  ✓ style_profiles
  ✓ ultra_detailed_descriptors

======================================
✅ Schema application complete!
======================================
```

Now test your onboarding flow - the error should be gone! 🎉
