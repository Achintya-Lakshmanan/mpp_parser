const fs = require('fs');
const path = require('path');
const https = require('https');
const { exec } = require('child_process');

// Create lib directory if it doesn't exist
const libDir = path.join(__dirname, 'lib');
if (!fs.existsSync(libDir)) {
  fs.mkdirSync(libDir, { recursive: true });
}

// Function to download a file
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      file.on('finish', () => {
        file.close(() => resolve(dest));
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

// Alternative: Try to copy from Maven local repository if exists
function copyFromMavenRepo() {
  return new Promise((resolve, reject) => {
    try {
      const userHome = process.env.HOME || process.env.USERPROFILE;
      const mavenRepo = path.join(userHome, '.m2', 'repository');
      
      // Check for MPXJ jar
      const mpxjPath = path.join(mavenRepo, 'net', 'sf', 'mpxj', 'mpxj', '10.15.0', 'mpxj-10.15.0.jar');
      const mpxjDest = path.join(libDir, 'mpxj.jar');
      
      // Check for POI jar
      const poiPath = path.join(mavenRepo, 'org', 'apache', 'poi', 'poi', '5.2.3', 'poi-5.2.3.jar');
      const poiDest = path.join(libDir, 'poi.jar');
      
      let copiedFiles = [];
      
      if (fs.existsSync(mpxjPath)) {
        fs.copyFileSync(mpxjPath, mpxjDest);
        copiedFiles.push(mpxjDest);
        console.log(`Copied MPXJ JAR to ${mpxjDest}`);
      }
      
      if (fs.existsSync(poiPath)) {
        fs.copyFileSync(poiPath, poiDest);
        copiedFiles.push(poiDest);
        console.log(`Copied POI JAR to ${poiDest}`);
      }
      
      resolve(copiedFiles);
    } catch (err) {
      console.log('Error copying from Maven repository:', err);
      resolve([]);
    }
  });
}

// Try to download files with Maven
function downloadWithMaven() {
  return new Promise((resolve, reject) => {
    // Run Maven command to download dependencies
    const mvnCommand = `mvn dependency:get -Dartifact=net.sf.mpxj:mpxj:10.15.0 && ` + 
                      `mvn dependency:get -Dartifact=org.apache.poi:poi:5.2.3`;
    
    exec(mvnCommand, (err, stdout, stderr) => {
      if (err) {
        console.error('Error running Maven command:', err);
        resolve(false);
        return;
      }
      
      console.log('Maven download output:', stdout);
      
      // Now copy from .m2 repository
      copyFromMavenRepo()
        .then(files => resolve(files.length > 0))
        .catch(err => {
          console.error('Error copying files:', err);
          resolve(false);
        });
    });
  });
}

// URLs for direct download
const mpxjUrl = 'https://repo1.maven.org/maven2/net/sf/mpxj/mpxj/10.15.0/mpxj-10.15.0.jar';
const poiUrl = 'https://repo1.maven.org/maven2/org/apache/poi/poi/5.2.3/poi-5.2.3.jar';

// Main function
async function downloadJars() {
  try {
    console.log('Checking for existing JAR files...');
    
    // Check if files already exist
    const mpxjJar = path.join(libDir, 'mpxj.jar');
    const poiJar = path.join(libDir, 'poi.jar');
    
    if (fs.existsSync(mpxjJar) && fs.existsSync(poiJar)) {
      console.log('JAR files already exist.');
      return;
    }
    
    // First try to copy from Maven repository
    console.log('Trying to copy from local Maven repository...');
    const copiedFiles = await copyFromMavenRepo();
    
    if (copiedFiles.length === 2) {
      console.log('All JAR files copied successfully from Maven repository.');
      return;
    }
    
    // If not all files were copied, try Maven download
    console.log('Trying to download with Maven...');
    const mavenSuccess = await downloadWithMaven();
    
    if (mavenSuccess) {
      console.log('All JAR files downloaded and copied successfully with Maven.');
      return;
    }
    
    // If Maven failed, download directly from URLs
    console.log('Downloading JAR files directly...');
    
    const downloadPromises = [];
    
    if (!fs.existsSync(mpxjJar)) {
      console.log(`Downloading MPXJ from ${mpxjUrl}...`);
      downloadPromises.push(downloadFile(mpxjUrl, mpxjJar));
    }
    
    if (!fs.existsSync(poiJar)) {
      console.log(`Downloading POI from ${poiUrl}...`);
      downloadPromises.push(downloadFile(poiUrl, poiJar));
    }
    
    await Promise.all(downloadPromises);
    console.log('All JAR files downloaded successfully.');
    
  } catch (error) {
    console.error('Error downloading JAR files:', error);
    process.exit(1);
  }
}

// Run the download
downloadJars(); 