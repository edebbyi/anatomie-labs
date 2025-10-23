#!/bin/bash
# Create sample fashion images for testing using placeholder service

echo "🎨 Creating sample fashion images for E2E test..."

mkdir -p anatomie-zip

# Download sample fashion images using placeholder images
# Using unsplash for fashion/clothing images or creating simple colored images

# Create simple colored placeholder images (if curl/download fails)
for i in {1..8}; do
  # Use ImageMagick if available, otherwise download from placeholder service
  if command -v convert &> /dev/null; then
    convert -size 512x512 xc:"rgb($((RANDOM%256)),$((RANDOM%256)),$((RANDOM%256)))" \
      -pointsize 48 -gravity center -annotate +0+0 "Fashion Design $i" \
      anatomie-zip/design-$i.jpg
  else
    # Use curl to download placeholder images
    curl -s -o anatomie-zip/design-$i.jpg \
      "https://via.placeholder.com/512x512/$(printf '%06X' $((RANDOM%16777216)))/FFFFFF?text=Fashion+Design+$i"
  fi
done

echo "✅ Created 8 sample images in anatomie-zip/"
ls -lh anatomie-zip/

echo ""
echo "📦 Creating ZIP file..."
cd anatomie-zip && zip -r ../test-portfolio.zip *.jpg && cd ..

echo "✅ test-portfolio.zip created!"
ls -lh test-portfolio.zip
