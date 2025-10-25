const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

// Create a proper ZIP file with enough images
const sourceDir = './anatomie_test_10';
const zipPath = './anatomie_test_10.zip';

console.log('🔧 Recreating test ZIP file with proper structure...');

try {
  // Check if source directory exists
  if (!fs.existsSync(sourceDir)) {
    console.log('❌ Source directory not found:', sourceDir);
    process.exit(1);
  }

  // Read files from source directory
  const files = fs.readdirSync(sourceDir);
  const imageFiles = files.filter(file => {
    const ext = path.extname(file).toLowerCase();
    return ['.jpg', '.jpeg', '.png'].includes(ext);
  });

  console.log(`📁 Found ${imageFiles.length} images in ${sourceDir}`);

  if (imageFiles.length === 0) {
    console.log('❌ No images found in source directory');
    process.exit(1);
  }

  // Create new ZIP
  const zip = new AdmZip();

  // Add all images to the root of the ZIP
  imageFiles.forEach((file, index) => {
    const filePath = path.join(sourceDir, file);
    const fileData = fs.readFileSync(filePath);
    zip.addFile(file, fileData);
    
    if (index < 5) {
      console.log(`  📎 Added: ${file}`);
    } else if (index === 5) {
      console.log(`  ... and ${imageFiles.length - 5} more files`);
    }
  });

  // Write ZIP file
  zip.writeZip(zipPath);
  console.log(`✅ Created ZIP file: ${zipPath}`);

  // Verify the ZIP structure
  const verifyZip = new AdmZip(zipPath);
  const entries = verifyZip.getEntries();
  
  console.log(`\n📊 ZIP Verification:`);
  console.log(`  Total entries: ${entries.length}`);
  
  let rootImages = 0;
  let subfolderImages = 0;
  
  entries.forEach(entry => {
    if (!entry.isDirectory) {
      const ext = path.extname(entry.entryName).toLowerCase();
      if (['.jpg', '.jpeg', '.png'].includes(ext)) {
        if (entry.entryName.includes('/')) {
          subfolderImages++;
        } else {
          rootImages++;
        }
      }
    }
  });
  
  console.log(`  Root images: ${rootImages}`);
  console.log(`  Subfolder images: ${subfolderImages}`);
  
  if (rootImages >= 50) {
    console.log(`  ✅ Sufficient images for upload`);
  } else {
    console.log(`  ⚠️  Only ${rootImages} images (need at least 50)`);
    console.log(`  💡 Consider duplicating images to reach the minimum requirement`);
  }

} catch (error) {
  console.error('❌ Error creating ZIP:', error.message);
  process.exit(1);
}