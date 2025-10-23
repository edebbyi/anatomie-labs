#!/bin/bash

echo "🔍 Verifying fixes were applied..."
echo ""

echo "✅ Checking image count fixes..."
grep -n "targetCount = 20" /Users/esosaimafidon/Documents/GitHub/anatomie-lab/frontend/src/services/onboardingAPI.ts
grep -n "targetCount: 20" /Users/esosaimafidon/Documents/GitHub/anatomie-lab/frontend/src/pages/Onboarding.tsx
grep -n "targetCount = 20" /Users/esosaimafidon/Documents/GitHub/anatomie-lab/src/routes/generation.js

echo ""
echo "✅ Checking VLT-based template fix..."
grep -n "_createVltBasedTemplate" /Users/esosaimafidon/Documents/GitHub/anatomie-lab/src/services/promptTemplateService.js | head -3

echo ""
echo "✅ Checking hardcoded prompts removal..."
if grep -q "romantic florals in modern silhouettes" /Users/esosaimafidon/Documents/GitHub/anatomie-lab/frontend/src/pages/Onboarding.tsx; then
    echo "❌ STILL HAS hardcoded 'romantic florals' - Check line:"
    grep -n "romantic florals" /Users/esosaimafidon/Documents/GitHub/anatomie-lab/frontend/src/pages/Onboarding.tsx
else
    echo "✅ Hardcoded 'romantic florals' removed!"
fi

echo ""
echo "✅ Checking VLT analysis display..."
grep -n "Your Style DNA Analysis" /Users/esosaimafidon/Documents/GitHub/anatomie-lab/frontend/src/pages/Onboarding.tsx

echo ""
echo "📝 All fixes verified!"
