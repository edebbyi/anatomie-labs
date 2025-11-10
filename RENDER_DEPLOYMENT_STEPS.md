# How to Apply Database Schema on Render

## Quick Fix (Recommended)

In your Render web service shell, run these commands:

```bash
# Navigate to project root
cd ~/project/src
cd ..

# Apply schema using psql (easiest method)
psql $DATABASE_URL -f database/schema.sql
```

## Alternative Method: Using the Node.js Script

```bash
# Navigate to project root
cd ~/project/src
cd ..

# Run the migration script
node scripts/apply-schema.js
```

## Verify Tables Were Created

```bash
psql $DATABASE_URL -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('portfolios', 'portfolio_images', 'style_profiles', 'ultra_detailed_descriptors') ORDER BY table_name;"
```

Expected output:
```
     table_name
--------------------
 portfolio_images
 portfolios
 style_profiles
 ultra_detailed_descriptors
(4 rows)
```

## Troubleshooting

### If you get "relation already exists" errors
This is normal! The schema uses `CREATE TABLE IF NOT EXISTS`, so it's safe to run multiple times.

### If you get permission errors
Make sure you're using the correct DATABASE_URL. You can check it with:
```bash
echo $DATABASE_URL | head -c 50
```

### If psql is not found
The Node.js script should work:
```bash
cd ~/project/src/..
node scripts/apply-schema.js
```

## After Applying Schema

1. Restart your web service (if needed)
2. Test the onboarding flow at your frontend URL
3. The error `relation "portfolios" does not exist` should be gone!
