require('dotenv').config();
const r2Storage = require('./src/services/r2Storage');
const fs = require('fs');
const path = require('path');

async function testR2() {
  console.log('🪣 Testing Cloudflare R2 Storage...\n');

  // Check configuration
  console.log('📋 Configuration:');
  console.log(`   Endpoint: ${process.env.R2_ENDPOINT}`);
  console.log(`   Bucket: ${process.env.R2_BUCKET_NAME}`);
  console.log(`   Access Key: ${process.env.R2_ACCESS_KEY_ID ? '✅ Configured' : '❌ Missing'}`);
  console.log(`   Secret Key: ${process.env.R2_SECRET_ACCESS_KEY ? '✅ Configured' : '❌ Missing'}`);

  if (!r2Storage.isConfigured()) {
    console.error('\n❌ R2 is not properly configured!');
    return false;
  }

  // Test 1: Connection Test
  console.log('\n🔍 Test 1: Connection Test');
  try {
    const connected = await r2Storage.testConnection();
    if (connected) {
      console.log('✅ Successfully connected to R2 bucket');
    } else {
      console.log('❌ Failed to connect to R2 bucket');
      return false;
    }
  } catch (error) {
    console.log('❌ Connection test failed:', error.message);
    return false;
  }

  // Test 2: Upload a test image
  console.log('\n📤 Test 2: Upload Test Image');
  try {
    // Create a simple test image buffer (1x1 pixel PNG)
    const testImageBuffer = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
      0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00,
      0x00, 0x03, 0x01, 0x01, 0x00, 0x18, 0xDD, 0x8D, 0xB4, 0x00, 0x00, 0x00,
      0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
    ]);

    const result = await r2Storage.uploadImage(testImageBuffer, {
      userId: 'test-user-123',
      jobId: 'test-job-456',
      imageType: 'test',
      format: 'png',
      originalFilename: 'test-image.png'
    });

    console.log('✅ Image uploaded successfully!');
    console.log(`   Key: ${result.key}`);
    console.log(`   CDN URL: ${result.cdnUrl}`);
    console.log(`   Size: ${result.size} bytes`);
    console.log(`   Upload time: ${result.uploadTime}ms`);

    // Store the key for cleanup
    global.testImageKey = result.key;
  } catch (error) {
    console.log('❌ Upload failed:', error.message);
    return false;
  }

  // Test 3: Retrieve the image
  console.log('\n📥 Test 3: Retrieve Test Image');
  try {
    const imageData = await r2Storage.getImage(global.testImageKey);
    console.log('✅ Image retrieved successfully!');
    console.log(`   Size: ${imageData.length} bytes`);
  } catch (error) {
    console.log('❌ Retrieval failed:', error.message);
    return false;
  }

  // Test 4: List images for test user
  console.log('\n📋 Test 4: List User Images');
  try {
    const listing = await r2Storage.listUserImages('test-user-123', {
      maxKeys: 10
    });
    console.log('✅ Image listing successful!');
    console.log(`   Found ${listing.images.length} image(s)`);
    listing.images.forEach((img, i) => {
      console.log(`   ${i + 1}. ${img.key} (${img.size} bytes)`);
    });
  } catch (error) {
    console.log('❌ Listing failed:', error.message);
    return false;
  }

  // Test 5: Storage statistics
  console.log('\n📊 Test 5: Storage Statistics');
  try {
    const stats = await r2Storage.getUserStorageStats('test-user-123');
    console.log('✅ Statistics retrieved!');
    console.log(`   Total images: ${stats.totalCount}`);
    console.log(`   Total size: ${stats.totalSizeGB} GB`);
    console.log(`   Estimated monthly cost: $${stats.estimatedMonthlyCost}`);
  } catch (error) {
    console.log('❌ Statistics failed:', error.message);
    return false;
  }

  // Test 6: Cleanup - Delete test image
  console.log('\n🗑️  Test 6: Delete Test Image');
  try {
    await r2Storage.deleteImage(global.testImageKey);
    console.log('✅ Test image deleted successfully!');
  } catch (error) {
    console.log('❌ Deletion failed:', error.message);
    console.log('   (This is not critical - test image may need manual cleanup)');
  }

  console.log('\n' + '='.repeat(50));
  console.log('🎉 All R2 tests passed successfully!');
  console.log('\n💡 R2 Storage is ready for:');
  console.log('   • Uploading generated images');
  console.log('   • Storing thumbnails');
  console.log('   • Enhanced images (GFPGAN + Real-ESRGAN)');
  console.log('   • Multi-user image galleries');
  console.log('\n📈 Cost estimate for 10,000 images (~30GB):');
  console.log('   • Storage: $0.45/month');
  console.log('   • Egress: $0.00 (FREE!)');
  console.log('   • Total: ~$0.50/month');
  
  return true;
}

testR2()
  .then(success => {
    if (success) {
      console.log('\n✅ R2 storage is fully configured and operational!');
      process.exit(0);
    } else {
      console.log('\n❌ R2 storage tests failed.');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('\n❌ R2 test error:', error.message);
    console.error(error.stack);
    process.exit(1);
  });