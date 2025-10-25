const fs = require('fs');
const { Client } = require('pg');
require('dotenv').config();

async function finalVerification() {
  console.log('🔍 Final Verification of Numeric Overflow Fix');
  console.log('=============================================');
  
  // Check 1: Verify the ZIP file exists
  console.log('\n1️⃣ Checking ZIP file...');
  if (fs.existsSync('./anatomie_test_50.zip')) {
    const stats = fs.statSync('./anatomie_test_50.zip');
    console.log(`   ✅ ZIP file found (${(stats.size / 1024 / 1024).toFixed(1)} MB)`);
  } else {
    console.log(`   ❌ ZIP file not found. Run: node create_sufficient_zip.js`);
    return;
  }
  
  // Check 2: Verify database connection and column definitions
  console.log('\n2️⃣ Checking database schema...');
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'designer_bff',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || ''
  });
  
  try {
    await client.connect();
    console.log('   ✅ Database connection successful');
    
    // Check column definitions
    const columnQuery = `
      SELECT column_name, data_type, numeric_precision, numeric_scale
      FROM information_schema.columns
      WHERE table_name = 'style_profiles'
      AND column_name IN ('avg_confidence', 'avg_completeness')
    `;
    
    const columnResult = await client.query(columnQuery);
    const columns = {};
    columnResult.rows.forEach(row => {
      columns[row.column_name] = row;
    });
    
    // Verify avg_confidence column
    if (columns.avg_confidence && 
        columns.avg_confidence.numeric_precision == 4 && 
        columns.avg_confidence.numeric_scale == 3) {
      console.log(`   ✅ avg_confidence: DECIMAL(4,3) - Correct`);
    } else {
      console.log(`   ❌ avg_confidence: Incorrect definition`);
      return;
    }
    
    // Verify avg_completeness column
    if (columns.avg_completeness && 
        columns.avg_completeness.numeric_precision == 5 && 
        columns.avg_completeness.numeric_scale == 2) {
      console.log(`   ✅ avg_completeness: DECIMAL(5,2) - Correct`);
    } else {
      console.log(`   ❌ avg_completeness: Incorrect definition`);
      return;
    }
    
  } catch (error) {
    console.log(`   ❌ Database connection failed: ${error.message}`);
    return;
  } finally {
    await client.end();
  }
  
  // Check 3: Verify code fixes are in place
  console.log('\n3️⃣ Checking code fixes...');
  
  // Check trendAnalysisAgent.js
  try {
    const trendAnalysisContent = fs.readFileSync('./src/services/trendAnalysisAgent.js', 'utf8');
    if (trendAnalysisContent.includes('Math.min(Math.max(validatedAvgConfidence, 0), 9.999)') &&
        trendAnalysisContent.includes('Math.min(Math.max(validatedAvgCompleteness, 0), 999.99)')) {
      console.log(`   ✅ trendAnalysisAgent.js - Validation logic fixed`);
    } else {
      console.log(`   ❌ trendAnalysisAgent.js - Validation logic not fixed`);
      return;
    }
  } catch (error) {
    console.log(`   ❌ Could not read trendAnalysisAgent.js: ${error.message}`);
    return;
  }
  
  // Check improvedTrendAnalysisAgent.js
  try {
    const improvedTrendContent = fs.readFileSync('./fix_style_profile/improvedTrendAnalysisAgent.js', 'utf8');
    if (improvedTrendContent.includes('Math.min(Math.max(avg, 0), 9.999)') &&
        improvedTrendContent.includes('Math.min(Math.max(avg, 0), 999.99)')) {
      console.log(`   ✅ improvedTrendAnalysisAgent.js - Calculation functions fixed`);
    } else {
      console.log(`   ❌ improvedTrendAnalysisAgent.js - Calculation functions not fixed`);
      return;
    }
  } catch (error) {
    console.log(`   ❌ Could not read improvedTrendAnalysisAgent.js: ${error.message}`);
    return;
  }
  
  console.log('\n🎉 All checks passed!');
  console.log('\n📋 To test the complete fix:');
  console.log('1. Start the application server');
  console.log('2. Navigate to the onboarding page');
  console.log('3. Upload anatomie_test_50.zip');
  console.log('4. The process should complete without "numeric field overflow" errors');
  
  console.log('\n✅ Numeric overflow fix verification complete!');
}

finalVerification();