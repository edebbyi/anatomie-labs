#!/bin/bash

# Test script for /api/podna/generate endpoint with prompt interpretation
# This tests the full integration of the prompt enhancement fix

echo "=== TESTING /api/podna/generate ENDPOINT ==="
echo ""

# Configuration
API_URL="http://localhost:3000"
# You need to replace this with a valid user token
# Get it from: localStorage.getItem('token') in browser console
TEST_TOKEN="${TEST_TOKEN:-your-token-here}"

if [ "$TEST_TOKEN" = "your-token-here" ]; then
  echo "⚠️  WARNING: Using placeholder token. Set TEST_TOKEN environment variable with a real token."
  echo "   Example: export TEST_TOKEN='your-actual-token'"
  echo ""
fi

# Test 1: Vague prompt (low specificity) - should use high creativity and brand DNA
echo "TEST 1: Vague prompt (low specificity)"
echo "Input: 'something elegant for evening'"
echo "Expected: High creativity, strong brand DNA influence"
echo ""

curl -s -X POST "$API_URL/api/podna/generate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -d '{
    "prompt": "something elegant for evening",
    "interpret": true,
    "provider": "imagen-4-ultra"
  }' | jq '{
    success: .success,
    interpretation: {
      specificity: .data.interpretation.parsedAttributes.specificity,
      garmentType: .data.interpretation.parsedAttributes.garmentType,
      creativityLevel: .data.interpretation.creativityLevel,
      brandDNAApplied: .data.interpretation.brandDNAApplied,
      enhancedSuggestion: .data.interpretation.enhancedSuggestion
    },
    promptPreview: .data.generation.promptText[:150]
  }'

echo ""
echo "---"
echo ""

# Test 2: Specific prompt (high specificity) - should respect user intent
echo "TEST 2: Specific prompt (high specificity)"
echo "Input: 'navy wool double-breasted blazer with peak lapels'"
echo "Expected: Low creativity, literal interpretation"
echo ""

curl -s -X POST "$API_URL/api/podna/generate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -d '{
    "prompt": "navy wool double-breasted blazer with peak lapels",
    "interpret": true,
    "provider": "imagen-4-ultra"
  }' | jq '{
    success: .success,
    interpretation: {
      specificity: .data.interpretation.parsedAttributes.specificity,
      garmentType: .data.interpretation.parsedAttributes.garmentType,
      colors: .data.interpretation.parsedAttributes.colors,
      fabrics: .data.interpretation.parsedAttributes.fabrics,
      creativityLevel: .data.interpretation.creativityLevel,
      brandDNAApplied: .data.interpretation.brandDNAApplied
    },
    promptPreview: .data.generation.promptText[:150]
  }'

echo ""
echo "---"
echo ""

# Test 3: Medium specificity
echo "TEST 3: Medium specificity"
echo "Input: 'elegant black evening gown'"
echo "Expected: Balanced creativity and brand DNA"
echo ""

curl -s -X POST "$API_URL/api/podna/generate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -d '{
    "prompt": "elegant black evening gown",
    "interpret": true,
    "provider": "imagen-4-ultra"
  }' | jq '{
    success: .success,
    interpretation: {
      specificity: .data.interpretation.parsedAttributes.specificity,
      garmentType: .data.interpretation.parsedAttributes.garmentType,
      colors: .data.interpretation.parsedAttributes.colors,
      styleAdjectives: .data.interpretation.parsedAttributes.styleAdjectives,
      creativityLevel: .data.interpretation.creativityLevel,
      enhancedSuggestion: .data.interpretation.enhancedSuggestion
    },
    promptPreview: .data.generation.promptText[:150]
  }'

echo ""
echo "---"
echo ""

# Test 4: Literal prompt (no interpretation)
echo "TEST 4: Literal prompt (interpret=false)"
echo "Input: 'minimalist structured blazer'"
echo "Expected: No interpretation, direct use of prompt"
echo ""

curl -s -X POST "$API_URL/api/podna/generate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -d '{
    "prompt": "minimalist structured blazer",
    "interpret": false,
    "provider": "imagen-4-ultra"
  }' | jq '{
    success: .success,
    hasInterpretation: (.data.interpretation != null),
    promptPreview: .data.generation.promptText[:150]
  }'

echo ""
echo "---"
echo ""

# Test 5: No prompt (Thompson sampling)
echo "TEST 5: No prompt (Thompson sampling)"
echo "Expected: Generate from user's style profile"
echo ""

curl -s -X POST "$API_URL/api/podna/generate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -d '{
    "mode": "exploratory",
    "provider": "imagen-4-ultra"
  }' | jq '{
    success: .success,
    hasInterpretation: (.data.interpretation != null),
    promptPreview: .data.generation.promptText[:150]
  }'

echo ""
echo "=== TEST SUITE COMPLETE ==="
echo ""
echo "VERIFICATION CHECKLIST:"
echo "✓ Test 1 should show specificity='low', creativityLevel=0.8, brandDNAApplied=true"
echo "✓ Test 2 should show specificity='high', creativityLevel=0.2, colors=['navy'], fabrics=['wool']"
echo "✓ Test 3 should show specificity='medium', creativityLevel=0.5, colors=['black']"
echo "✓ Test 4 should show hasInterpretation=false (no interpretation object)"
echo "✓ Test 5 should show hasInterpretation=false (Thompson sampling)"
echo ""
echo "All prompts should include weighted tokens like [token:1.3]"
echo ""

