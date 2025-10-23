#!/bin/bash
# Create a properly structured ZIP file from the anatomie-zip folder

echo "🔧 Creating portfolio ZIP file..."

# Navigate into the folder and zip just the images
cd anatomie-zip
zip -r ../anatomie-portfolio.zip *.jpg *.png

cd ..

echo "✅ Created anatomie-portfolio.zip"
echo "📊 Verifying structure..."

# Show the structure
unzip -l anatomie-portfolio.zip | head -20

echo ""
echo "✨ Done! Upload anatomie-portfolio.zip through the frontend."
