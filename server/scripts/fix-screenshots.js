const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Check if ImageMagick is installed
function checkImageMagick() {
  try {
    execSync('magick -version', { stdio: 'ignore' });
    return true;
  } catch (e) {
    try {
      execSync('convert -version', { stdio: 'ignore' });
      return true;
    } catch (e2) {
      // Check common Windows installation paths
      if (process.platform === 'win32') {
        const commonPaths = [
          'C:\\Program Files\\ImageMagick-7.1.1-Q16-HDRI\\magick.exe',
          'C:\\Program Files\\ImageMagick-7.1.0-Q16-HDRI\\magick.exe',
          'C:\\Program Files (x86)\\ImageMagick-7.1.1-Q16-HDRI\\magick.exe',
          'C:\\Program Files (x86)\\ImageMagick-7.1.0-Q16-HDRI\\magick.exe',
        ];
        
        for (const imgPath of commonPaths) {
          if (fs.existsSync(imgPath)) {
            return true;
          }
        }
      }
      return false;
    }
  }
}

// Get ImageMagick command (magick or convert)
function getImageMagickCommand() {
  try {
    const output = execSync('magick -version', { encoding: 'utf8', stdio: 'pipe' });
    if (output.includes('ImageMagick')) {
      return 'magick';
    }
  } catch (e) {
    // Ignore
  }
  
  // Check if convert is ImageMagick (not Windows convert)
  try {
    const output = execSync('convert -version', { encoding: 'utf8', stdio: 'pipe' });
    if (output.includes('ImageMagick')) {
      return 'convert';
    }
  } catch (e) {
    // Ignore
  }
  
  return null;
}

// Function to process a single image
function fixImage(inputPath, outputPath, cmd) {
  try {
    // Use ImageMagick to remove alpha channel by flattening on white background
    // -flatten removes alpha and composites on white
    // -alpha off ensures no alpha channel remains
    execSync(
      `"${cmd}" "${inputPath}" -flatten -alpha off "${outputPath}"`,
      { stdio: 'pipe' }
    );
    return true;
  } catch (error) {
    console.error(`❌ Error processing ${inputPath}:`, error.message);
    return false;
  }
}

// Main function
function main() {
  console.log('🔍 Checking for ImageMagick...\n');
  
  const cmd = getImageMagickCommand();
  
  if (!cmd || !checkImageMagick()) {
    console.error('❌ ImageMagick is not installed or not in PATH');
    console.log('\n📦 Please install ImageMagick:');
    console.log('\n   Windows:');
    console.log('   1. Download from: https://imagemagick.org/script/download.php#windows');
    console.log('   2. Choose: ImageMagick-7.x.x-Q16-HDRI-x64-dll.exe');
    console.log('   3. During install, check: "Add application directory to your system path"');
    console.log('   4. Restart your terminal after installation');
    console.log('\n   macOS:   brew install imagemagick');
    console.log('   Linux:   sudo apt-get install imagemagick');
    console.log('\n   After installation, verify with: magick -version');
    console.log('\n   Then run: npm run fix-screenshots');
    process.exit(1);
  }
  
  console.log(`✅ Found ImageMagick (using: ${cmd})\n`);
  
  const SERVER_DIR = path.join(__dirname, '..');
  const ASSETS_DIR = path.join(SERVER_DIR, 'assets');
  
  // Find iPhone and iPad screenshot directories
  const IPHONE_DIR = path.join(ASSETS_DIR, 'iphonescreenshots');
  const IPAD_DIR = path.join(ASSETS_DIR, 'ipadscreenshots - medping');
  
  // Check if assets directory exists
  if (!fs.existsSync(ASSETS_DIR)) {
    console.log('❌ Assets directory not found:', ASSETS_DIR);
    process.exit(1);
  }
  
  const directories = [
    { name: 'iPhone', path: IPHONE_DIR },
    { name: 'iPad', path: IPAD_DIR }
  ];
  
  let totalFixed = 0;
  let totalSkipped = 0;
  
  for (const dir of directories) {
    if (!fs.existsSync(dir.path)) {
      console.log(`⏭️  ${dir.name} directory not found: ${dir.path}\n`);
      continue;
    }
    
    console.log(`📸 Processing ${dir.name} screenshots...\n`);
    
    // Find all PNG files
    const files = fs.readdirSync(dir.path)
      .filter(file => file.toLowerCase().endsWith('.png'))
      .map(file => path.join(dir.path, file));
    
    if (files.length === 0) {
      console.log(`   ⚠️  No PNG files found in ${dir.name} directory\n`);
      continue;
    }
    
    console.log(`   Found ${files.length} PNG file(s)\n`);
    
    let fixedCount = 0;
    let skippedCount = 0;
    
    // Process each file
    for (const filePath of files) {
      const fileName = path.basename(filePath);
      const outputPath = path.join(path.dirname(filePath), fileName);
      
      console.log(`   🔄 Processing: ${fileName}...`);
      
      // Check if file has alpha channel first (optional check)
      try {
        const checkCmd = getImageMagickCommand();
        const identifyOutput = execSync(
          `"${checkCmd}" identify -format "%[channels]" "${filePath}"`,
          { encoding: 'utf8', stdio: 'pipe' }
        );
        
        if (identifyOutput.includes('rgba') || identifyOutput.includes('srgba')) {
          const wasFixed = fixImage(filePath, outputPath, cmd);
          if (wasFixed) {
            fixedCount++;
            totalFixed++;
            console.log(`   ✅ Fixed: ${fileName}\n`);
          } else {
            skippedCount++;
            totalSkipped++;
            console.log(`   ❌ Failed: ${fileName}\n`);
          }
        } else {
          skippedCount++;
          totalSkipped++;
          console.log(`   ⏭️  Skipped: ${fileName} (no alpha channel)\n`);
        }
      } catch (error) {
        // If identify fails, try to fix anyway
        const wasFixed = fixImage(filePath, outputPath, cmd);
        if (wasFixed) {
          fixedCount++;
          totalFixed++;
          console.log(`   ✅ Fixed: ${fileName}\n`);
        } else {
          skippedCount++;
          totalSkipped++;
          console.log(`   ❌ Failed: ${fileName}\n`);
        }
      }
    }
    
    console.log(`   ${dir.name} Summary: ${fixedCount} fixed, ${skippedCount} skipped\n`);
  }
  
  console.log('='.repeat(60));
  console.log(`✅ Total Fixed: ${totalFixed} file(s)`);
  console.log(`⏭️  Total Skipped: ${totalSkipped} file(s)`);
  console.log('='.repeat(60));
  console.log('\n✨ Your screenshots are now ready for App Store submission!');
}

main();

