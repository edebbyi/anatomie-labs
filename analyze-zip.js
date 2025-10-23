const fs = require('fs');
const AdmZip = require('adm-zip');
const path = require('path');

const zipPath = './anatomie-zip.zip';

console.log('🔍 Analyzing ZIP file structure...\n');

try {
  // Check if file exists
  if (!fs.existsSync(zipPath)) {
    console.log('❌ File not found:', zipPath);
    console.log('\n📁 Files in current directory:');
    const files = fs.readdirSync('.');
    files.filter(f => f.includes('zip') || f.includes('anatomie')).forEach(f => {
      const stats = fs.statSync(f);
      console.log(`  ${stats.isDirectory() ? '[DIR]' : '[FILE]'} ${f}`);
    });
    process.exit(1);
  }

  const stats = fs.statSync(zipPath);
  console.log(`✅ Found: ${zipPath}`);
  console.log(`📦 Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB\n`);

  // Load ZIP
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();

  console.log(`📊 Total entries in ZIP: ${entries.length}\n`);

  const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
  let rootImages = 0;
  let subfolderImages = 0;
  let otherFiles = 0;

  console.log('📋 First 20 entries:');
  console.log('─'.repeat(80));

  entries.slice(0, 20).forEach((entry, idx) => {
    const ext = path.extname(entry.entryName).toLowerCase();
    const isImage = validExtensions.includes(ext);
    const hasPath = entry.entryName.includes('/');
    const isDir = entry.isDirectory;

    let type = '📄';
    if (isDir) type = '📁';
    else if (isImage && !hasPath) { type = '🖼️ '; rootImages++; }
    else if (isImage && hasPath) { type = '📂🖼️'; subfolderImages++; }
    else otherFiles++;

    console.log(`${(idx + 1).toString().padStart(2)}. ${type} ${entry.entryName}`);
  });

  console.log('─'.repeat(80));

  // Count all entries
  entries.forEach(entry => {
    const ext = path.extname(entry.entryName).toLowerCase();
    const isImage = validExtensions.includes(ext);
    const hasPath = entry.entryName.includes('/');
    
    if (!entry.isDirectory && isImage) {
      if (!hasPath) rootImages++;
      else subfolderImages++;
    }
  });

  console.log('\n📊 Summary:');
  console.log(`  🖼️  Images at ROOT level: ${rootImages}`);
  console.log(`  📁 Images in SUBFOLDERS: ${subfolderImages}`);
  console.log(`  📄 Other files: ${otherFiles}`);

  console.log('\n');
  if (rootImages >= 50) {
    console.log('✅ PERFECT! Your ZIP has enough images at root level.');
    console.log('   Upload this file through the frontend onboarding.');
  } else if (subfolderImages > 0) {
    console.log('❌ PROBLEM: Images are in subfolders, not at root level.');
    console.log('   Run ./create-portfolio-zip.sh to fix this.');
  } else {
    console.log('❌ ERROR: No valid images found in ZIP.');
  }

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
