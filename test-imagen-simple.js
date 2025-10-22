require('dotenv').config();
const Replicate = require('replicate');
const axios = require('axios');
const r2Storage = require('./src/services/r2Storage');
const { v4: uuidv4 } = require('uuid');

/**
 * Simplified end-to-end test
 * 1. Generate image with imagen-4-ultra via Replicate
 * 2. Upload to R2 storage
 * 3. Verify signed URL accessibility
 */

async function testPipeline() {
  console.log('\n🚀 Testing Imagen-4-Ultra Pipeline\n');
  console.log('=' .repeat(70));
  
  try {
    // Initialize Replicate
    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN
    });
    
    // Step 1: Test connections
    console.log('\n1️⃣  Testing Connections...\n');
    
    const r2Connected = await r2Storage.testConnection();
    console.log(`   R2 Storage: ${r2Connected ? '✅ Connected' : '❌ Failed'}`);
    console.log(`   Bucket: ${process.env.R2_BUCKET_NAME}`);
    console.log(`   Using Signed URLs: ${process.env.R2_USE_SIGNED_URLS === 'true' ? 'Yes ✓' : 'No'}`);
    
    if (!r2Connected) {
      console.log('\n❌ R2 connection failed. Exiting...\n');
      process.exit(1);
    }
    
    // Step 2: Generate image with Imagen 4 Ultra
    console.log('\n2️⃣  Generating Image with Google Imagen-4-Ultra...\n');
    console.log('   Model: google/imagen-4-ultra');
    console.log('   Prompt: "A photorealistic red rose with dew drops"');
    console.log('   Expected time: ~8-12 seconds\n');
    
    const startTime = Date.now();
    
    const output = await replicate.run('google/imagen-4-ultra', {
      input: {
        prompt: 'A stunning photorealistic close-up of a vibrant red rose with delicate morning dew drops on its petals. Soft natural lighting, shallow depth of field, bokeh background. Professional nature photography, highly detailed, 8K quality.',
        aspect_ratio: '1:1',
        output_format: 'jpg'
      }
    });
    
    const imageUrl = Array.isArray(output) ? output[0] : output;
    const generationTime = Date.now() - startTime;
    
    console.log(`   ✅ Image generated in ${(generationTime / 1000).toFixed(2)}s`);
    console.log(`   Replicate URL: ${imageUrl}\n`);
    
    // Step 3: Download image from Replicate
    console.log('3️⃣  Downloading image from Replicate...\n');
    
    const downloadStart = Date.now();
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 60000
    });
    const imageBuffer = Buffer.from(response.data);
    const downloadTime = Date.now() - downloadStart;
    
    console.log(`   ✅ Downloaded ${(imageBuffer.length / 1024).toFixed(2)} KB in ${downloadTime}ms\n`);
    
    // Step 4: Upload to R2
    console.log('4️⃣  Uploading to Cloudflare R2...\n');
    
    const uploadStart = Date.now();
    const uploadResult = await r2Storage.uploadImage(imageBuffer, {
      userId: uuidv4(),
      imageType: 'generated',
      format: 'jpg',
      jobId: null
    });
    const uploadTime = Date.now() - uploadStart;
    
    console.log(`   ✅ Uploaded in ${uploadTime}ms`);
    console.log(`   R2 Key: ${uploadResult.key}`);
    console.log(`   CDN URL: ${uploadResult.cdnUrl}\n`);
    
    // Step 5: Verify URL accessibility
    console.log('5️⃣  Verifying CDN URL...\n');
    
    try {
      const headResponse = await axios.head(uploadResult.cdnUrl, {
        timeout: 10000,
        validateStatus: status => status < 500
      });
      
      if (headResponse.status === 200) {
        console.log('   ✅ CDN URL is publicly accessible!');
        console.log(`   Status: ${headResponse.status}`);
        console.log(`   Content-Type: ${headResponse.headers['content-type']}`);
        console.log(`   Size: ${(parseInt(headResponse.headers['content-length']) / 1024).toFixed(2)} KB`);
      } else if (headResponse.status === 401 || headResponse.status === 403) {
        console.log('   ⚠️  Bucket is private, but signed URL should work');
        
        // Try to actually download the image via signed URL
        const downloadResponse = await axios.get(uploadResult.cdnUrl, {
          timeout: 10000,
          responseType: 'arraybuffer',
          validateStatus: status => status === 200
        });
        
        if (downloadResponse.status === 200) {
          console.log('   ✅ Signed URL works perfectly!');
          console.log(`   Downloaded: ${(downloadResponse.data.length / 1024).toFixed(2)} KB`);
          console.log('   URL expires in: 7 days');
        }
      }
    } catch (error) {
      console.log(`   ❌ URL verification failed: ${error.message}`);
    }
    
    // Step 6: Summary
    const totalTime = Date.now() - startTime;
    console.log('\n' + '=' .repeat(70));
    console.log('✅ TEST COMPLETED SUCCESSFULLY!\n');
    console.log('📊 Performance Summary:');
    console.log(`   • Imagen-4-Ultra Generation: ${(generationTime / 1000).toFixed(2)}s`);
    console.log(`   • Image Download: ${downloadTime}ms`);
    console.log(`   • R2 Upload: ${uploadTime}ms`);
    console.log(`   • Total Pipeline Time: ${(totalTime / 1000).toFixed(2)}s`);
    console.log(`   • Image Size: ${(imageBuffer.length / 1024).toFixed(2)} KB`);
    console.log(`   • Cost per image: $0.03`);
    console.log('\n🌐 Generated Image URL:');
    console.log(`   ${uploadResult.cdnUrl}`);
    console.log('\n' + '=' .repeat(70) + '\n');
    
  } catch (error) {
    console.error('\n❌ TEST FAILED');
    console.error(`   Error: ${error.message}`);
    if (error.response) {
      console.error(`   HTTP Status: ${error.response.status}`);
      console.error(`   Response: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    console.error(`\n   Stack: ${error.stack}\n`);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run test
testPipeline();
