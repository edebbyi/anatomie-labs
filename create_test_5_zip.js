#!/usr/bin/env node
/**
 * Create a ZIP file with 5 images from the anatomie_test_10 directory
 * for testing the onboarding process
 */

const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const SOURCE_DIR = './anatomie_test_10';
const OUTPUT_ZIP = './anatomie_test_5.zip';

async function createTestZip() {
  try {
    // Check if source directory exists
    if (!fs.existsSync(SOURCE_DIR)) {
      console.error(`❌ Source directory ${SOURCE_DIR} not found`);
      process.exit(1);
    }

    // Read files from source directory
    const files = fs.readdirSync(SOURCE_DIR);
    console.log(`📁 Found ${files.length} files in ${SOURCE_DIR}`);

    // Filter for image files
    const imageFiles = files.filter(file => 
      file.endsWith('.jpg') || file.endsWith('.jpeg') || file.endsWith('.png')
    );

    if (imageFiles.length < 5) {
      console.error(`❌ Not enough images found. Need at least 5, found ${imageFiles.length}`);
      process.exit(1);
    }

    // Take first 5 images
    const selectedImages = imageFiles.slice(0, 5);
    console.log(`✅ Selected ${selectedImages.length} images for ZIP`);

    // Create ZIP file
    const zip = new AdmZip();

    // Add each selected image to the ZIP
    for (const image of selectedImages) {
      const imagePath = path.join(SOURCE_DIR, image);
      const imageBuffer = fs.readFileSync(imagePath);
      zip.addFile(image, imageBuffer);
      console.log(`   📎 Added ${image}`);
    }

    // Write ZIP file
    zip.writeZip(OUTPUT_ZIP);
    console.log(`\n✅ Created ${OUTPUT_ZIP} with ${selectedImages.length} images`);

    // Show ZIP info
    const stats = fs.statSync(OUTPUT_ZIP);
    console.log(`📊 File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

    // List contents
    const zipContents = new AdmZip(OUTPUT_ZIP);
    const entries = zipContents.getEntries();
    console.log('\n📋 ZIP contents:');
    entries.forEach(entry => {
      if (!entry.isDirectory) {
        console.log(`   📄 ${entry.entryName}`);
      }
    });

  } catch (error) {
    console.error('❌ Error creating ZIP file:', error.message);
    process.exit(1);
  }
}

// Run the script
createTestZip();