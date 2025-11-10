# JWT Configuration Setup Guide

## Problem

If you encounter the error: `secretOrPrivateKey must have a value` during user signup or login, it means the JWT_SECRET environment variable is not properly configured.

## Solution

### For Local Development

1. **Create a `.env` file** (if it doesn't exist):
   ```bash
   cp .env.example .env
   ```

2. **Generate a secure JWT secret**:
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```

3. **Update the `.env` file** with the generated secret:
   ```env
   JWT_SECRET=<your-generated-secret-here>
   JWT_EXPIRE_TIME=7d
   ```

4. **Restart your server** to load the new environment variables

### For Production (Render)

1. **Check if JWT_SECRET exists** in Render Dashboard:
   - Go to your service in Render Dashboard
   - Navigate to "Environment" tab
   - Look for `JWT_SECRET` in the environment variables list

2. **If JWT_SECRET is missing**:
   - Click "Add Environment Variable"
   - Key: `JWT_SECRET`
   - Value: Generate using the command above
   - Click "Save Changes"

3. **Trigger a redeploy**:
   - Render should automatically redeploy when environment variables change
   - Or manually trigger a deploy from the Dashboard

### Verification

Run the verification script to ensure JWT is configured correctly:

```bash
node verify-jwt-config.js
```

Expected output:
```
✅ JWT_SECRET is defined and has sufficient length
✅ JWT_EXPIRE_TIME is set to: 7d
✅ JWT configuration is valid!
```

## Important Notes

- **Never commit `.env` files** to version control (already in `.gitignore`)
- **Use different JWT secrets** for development and production
- **JWT_SECRET should be at least 32 characters** for security
- **Keep JWT_SECRET private** - it's used to sign authentication tokens

## Troubleshooting

### Error persists after setting JWT_SECRET

1. Verify the environment variable is loaded:
   ```javascript
   console.log('JWT_SECRET exists:', !!process.env.JWT_SECRET);
   ```

2. Check if `dotenv` is loading correctly in `server.js`:
   ```javascript
   require('dotenv').config();
   ```

3. Restart your development server completely

### Production deployment on Render

If `render.yaml` has `generateValue: true` for JWT_SECRET but it's still not working:

1. Check Render Dashboard Environment Variables
2. Manually set the JWT_SECRET if auto-generation didn't work
3. Ensure the service has been redeployed after adding the variable

## Files Modified

- `.env` - Created with secure JWT_SECRET
- `verify-jwt-config.js` - Verification script to check JWT configuration
- `JWT_SETUP_GUIDE.md` - This guide

## Related Files

- `src/api/routes/auth.js:50` - JWT signing in registration
- `src/api/routes/auth.js:131` - JWT signing in login
- `src/api/routes/auth.js:305` - JWT signing in token refresh
- `render.yaml:30-31` - Production JWT configuration
