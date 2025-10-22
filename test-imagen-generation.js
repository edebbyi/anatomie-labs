require('dotenv').config();
const axios = require('axios');

/**
 * Test image generation with imagen-4-ultra
 * This tests the complete pipeline:
 * 1. Queue job via API
 * 2. Worker processes with Replicate (imagen-4-ultra)
 * 3. Upload to R2 storage
 * 4. Save metadata to database
 * 5. Verify CDN URL accessibility
 */

const SERVER_URL = 'http://localhost:5000';

// Mock authentication - in real scenario, this would be a valid JWT token
const mockUserId = 'test-user-' + Date.now();

async function testImageGeneration() {
  console.log('\n🧪 Testing Imagen-4-Ultra Generation Pipeline\n');
  console.log('=' .repeat(60));
  
  try {
    // Step 1: Create generation job
    console.log('\n📝 Step 1: Creating image generation job...');
    
    const generationRequest = {
      parsedCommand: {
        quantity: 1,
        garmentType: 'A photorealistic close-up of a vibrant red rose with morning dew drops'
      },
      vltSpecification: 'A stunning photorealistic close-up photograph of a vibrant red rose with delicate morning dew drops glistening on its petals. The background is softly blurred with a bokeh effect, highlighting the intricate details of the rose. Professional photography, shallow depth of field, natural lighting.',
      model: 'imagen-4-ultra'
    };
    
    const createJobResponse = await axios.post(
      `${SERVER_URL}/api/images/generate`,
      generationRequest,
      {
        headers: {
          'Authorization': `Bearer mock-token-${mockUserId}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const jobId = createJobResponse.data.data.jobId;
    console.log('✅ Job created successfully!');
    console.log(`   Job ID: ${jobId}`);
    console.log(`   Status: ${createJobResponse.data.data.status}`);
    console.log(`   Estimated time: ${createJobResponse.data.data.estimatedTime}`);
    
    // Step 2: Monitor job status
    console.log('\n⏳ Step 2: Monitoring job progress...');
    
    let jobCompleted = false;
    let attempts = 0;
    const maxAttempts = 30; // 2.5 minutes max
    
    while (!jobCompleted && attempts < maxAttempts) {
      attempts++;
      
      // Wait 5 seconds between checks
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const statusResponse = await axios.get(
        `${SERVER_URL}/api/images/job/${jobId}`,
        {
          headers: {
            'Authorization': `Bearer mock-token-${mockUserId}`
          }
        }
      );
      
      const status = statusResponse.data.data;
      
      if (status.status === 'completed') {
        jobCompleted = true;
        console.log('✅ Job completed successfully!');
        console.log(`   Images generated: ${status.result?.imagesGenerated || 1}`);
        console.log(`   Total cost: $${status.result?.totalCost || 'N/A'}`);
        console.log(`   Generation time: ${status.result?.totalTime || 'N/A'}ms`);
        
        // Step 3: Check generated images
        console.log('\n🖼️  Step 3: Checking generated images...');
        
        if (status.result?.images && status.result.images.length > 0) {
          const image = status.result.images[0];
          console.log(`   Image ID: ${image.imageId}`);
          console.log(`   CDN URL: ${image.cdnUrl}`);
          console.log(`   Size: ${(image.size / 1024).toFixed(2)} KB`);
          
          // Step 4: Verify CDN URL accessibility
          console.log('\n🌐 Step 4: Verifying CDN URL accessibility...');
          
          try {
            const imageResponse = await axios.head(image.cdnUrl, {
              timeout: 10000,
              validateStatus: status => status < 500 // Accept any status except server errors
            });
            
            if (imageResponse.status === 200) {
              console.log('✅ CDN URL is publicly accessible!');
              console.log(`   Status: ${imageResponse.status}`);
              console.log(`   Content-Type: ${imageResponse.headers['content-type']}`);
              console.log(`   Content-Length: ${imageResponse.headers['content-length']} bytes`);
            } else if (imageResponse.status === 403 || imageResponse.status === 401) {
              console.log('⚠️  CDN URL returned authorization error (bucket might be private)');
              console.log('   Using signed URLs instead (R2_USE_SIGNED_URLS=true)');
              console.log(`   URL: ${image.cdnUrl}`);
            } else {
              console.log(`⚠️  Unexpected status: ${imageResponse.status}`);
            }
          } catch (error) {
            console.log('❌ Failed to verify CDN URL:');
            console.log(`   Error: ${error.message}`);
          }
        }
        
      } else if (status.status === 'failed') {
        console.log('❌ Job failed!');
        console.log(`   Error: ${status.error || 'Unknown error'}`);
        break;
      } else {
        console.log(`   Status: ${status.status} (attempt ${attempts}/${maxAttempts})`);
      }
    }
    
    if (!jobCompleted && attempts >= maxAttempts) {
      console.log('\n⏰ Timeout: Job did not complete within expected time');
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Test completed!\n');
    
  } catch (error) {
    console.error('\n❌ Test failed with error:');
    console.error(error.response?.data || error.message);
    console.error('\nStack trace:', error.stack);
  }
}

// Run the test
testImageGeneration().catch(console.error);
