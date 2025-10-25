const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

// Create a proper ZIP file with enough images (at least 50)
const sourceDir = './anatomie_test_10';
const zipPath = './anatomie_test_50.zip';

console.log('🔧 Creating ZIP file with 50+ images...');

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

  // Add images to reach at least 50
  const targetCount = 50;
  let addedCount = 0;
  
  while (addedCount < targetCount) {
    for (const file of imageFiles) {
      if (addedCount >= targetCount) break;
      
      const filePath = path.join(sourceDir, file);
      const fileData = fs.readFileSync(filePath);
      
      // Create a unique name for each duplicate
      const newName = addedCount < imageFiles.length 
        ? file 
        : `duplicate_${addedCount}_${file}`;
      
      zip.addFile(newName, fileData);
      addedCount++;
      
      if (addedCount <= 5 || addedCount % 10 === 0) {
        console.log(`  📎 Added (${addedCount}): ${newName}`);
      }
    }
  }

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
    console.log(`  ✅ Sufficient images for upload (${rootImages} images)`);
  } else {
    console.log(`  ⚠️  Only ${rootImages} images (need at least 50)`);
  }

} catch (error) {
  console.error('❌ Error creating ZIP:', error.message);
  process.exit(1);
}