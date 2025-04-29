const fs = require('fs');
const path = require('path');
const https = require('https');
const { exec } = require('child_process');

// Create downloads directory if it doesn't exist
const downloadsDir = path.join(__dirname, '..', '..', 'downloads');
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
}

// Also maintain lib directory for backward compatibility
const libDir = path.join(__dirname, 'lib');
if (!fs.existsSync(libDir)) {
  fs.mkdirSync(libDir, { recursive: true });
}

// Function to download a file
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
          return;
        }

        response.pipe(file);
        file.on('finish', () => {
          file.close(() => resolve(dest));
        });
      })
      .on('error', (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
  });
}

// URLs for direct download
const dependencies = [
  {
    name: 'MPXJ',
    url: 'https://repo1.maven.org/maven2/net/sf/mpxj/mpxj/10.15.0/mpxj-10.15.0.jar',
    filename: 'mpxj.jar'
  },
  {
    name: 'POI',
    url: 'https://repo1.maven.org/maven2/org/apache/poi/poi/5.2.3/poi-5.2.3.jar',
    filename: 'poi.jar'
  }
];

// Main function
async function downloadJars() {
  try {
    console.log('Checking for existing JAR files...');
    
    for (const dep of dependencies) {
      const downloadPath = path.join(downloadsDir, dep.filename);
      const libPath = path.join(libDir, dep.filename);
      
      // Check if file exists in downloads directory
      if (!fs.existsSync(downloadPath)) {
        console.log(`${dep.name} not found in downloads folder, downloading from ${dep.url}...`);
        await downloadFile(dep.url, downloadPath);
        console.log(`${dep.name} downloaded successfully to downloads folder`);
      } else {
        console.log(`${dep.name} found in downloads folder`);
      }
      
      // Copy from downloads to lib (if different or doesn't exist)
      if (!fs.existsSync(libPath) || 
          fs.statSync(downloadPath).size !== fs.statSync(libPath).size) {
        fs.copyFileSync(downloadPath, libPath);
        console.log(`${dep.name} copied to lib directory`);
      }
    }
    
    console.log('All JAR files are ready');
  } catch (error) {
    console.error('Error managing JAR files:', error);
    process.exit(1);
  }
}

// Run the download
downloadJars();
