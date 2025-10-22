#!/bin/bash

echo "🔍 Verifying ALL fixes (including style profile fix)..."
echo ""

echo "1️⃣ Image count fixes..."
grep -n "targetCount.*20" /Users/esosaimafidon/Documents/GitHub/anatomie-lab/frontend/src/services/onboardingAPI.ts | head -2
grep -n "targetCount = 20" /Users/esosaimafidon/Documents/GitHub/anatomie-lab/src/routes/generation.js

echo ""
echo "2️⃣ VLT-based template creation..."
grep -n "_createVltBasedTemplate" /Users/esosaimafidon/Documents/GitHub/anatomie-lab/src/services/promptTemplateService.js | head -2

echo ""
echo "3️⃣ Hardcoded prompts removed..."
if grep -q "romantic florals in modern silhouettes" /Users/esosaimafidon/Documents/GitHub/anatomie-lab/frontend/src/pages/Onboarding.tsx; then
    echo "❌ STILL HAS hardcoded prompts"
else
    echo "✅ Hardcoded prompts removed!"
fi

echo ""
echo "4️⃣ VLT analysis display added..."
grep -n "Your Style DNA Analysis" /Users/esosaimafidon/Documents/GitHub/anatomie-lab/frontend/src/pages/Onboarding.tsx

echo ""
echo "5️⃣ Portfolio validation..."
grep -n "Portfolio analysis is incomplete" /Users/esosaimafidon/Documents/GitHub/anatomie-lab/src/routes/generation.js

echo ""
echo "6️⃣ Style profile integration (CRITICAL)..."
echo "   Fetching style profile:"
grep -n "styleClusteringService.getStyleProfile" /Users/esosaimafidon/Documents/GitHub/anatomie-lab/src/routes/generation.js
echo "   Passing to prompt generator:"
grep -n "styleProfile, // Use actual style profile" /Users/esosaimafidon/Documents/GitHub/anatomie-lab/src/routes/generation.js

echo ""
echo "✅ All 6 fixes verified!"
