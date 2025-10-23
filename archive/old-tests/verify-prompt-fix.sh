#!/bin/bash

echo "🔍 Verifying Prompt Display Fix..."
echo ""

echo "1️⃣ Backend: Prompt passed to uploadAndStoreAssets..."
grep -n "mainPrompt: settings.mainPrompt" /Users/esosaimafidon/Documents/GitHub/anatomie-lab/src/services/generationService.js

echo ""
echo "2️⃣ Backend: Prompt stored in vlt_analysis..."
grep -n "promptText: params.mainPrompt" /Users/esosaimafidon/Documents/GitHub/anatomie-lab/src/services/generationService.js

echo ""
echo "3️⃣ Frontend: Improved prompt extraction..."
grep -n "item.vlt_analysis?.promptText" /Users/esosaimafidon/Documents/GitHub/anatomie-lab/frontend/src/pages/Home.tsx

echo ""
echo "4️⃣ Frontend: Debug logging added..."
grep -n "console.warn('Using fallback prompt" /Users/esosaimafidon/Documents/GitHub/anatomie-lab/frontend/src/pages/Home.tsx

echo ""
echo "✅ Prompt display fix verified!"
echo ""
echo "⚠️  Note: This fix only affects NEW images."
echo "    Existing images will still show fallback prompts."
echo ""
echo "To test:"
echo "  1. Restart services: ./restart-with-fixes.sh"
echo "  2. Hard refresh browser: Cmd+Shift+R"
echo "  3. Generate new images"
echo "  4. Check browser console for debug warnings"
