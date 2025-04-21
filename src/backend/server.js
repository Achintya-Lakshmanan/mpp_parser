const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const { exec } = require('child_process');
const os = require('os');
const https = require('https');

const app = express();
const port = process.env.PORT || 3001;

// At the top of the file, after require statements
const execPromise = promisify(exec);

// Function to download a file from a URL
const downloadFile = (url, dest) => {
  return new Promise((resolve, reject) => {
    console.log(`Downloading ${url}`);
    const file = fs.createWriteStream(dest);
    
    https.get(url, (response) => {
      if (response.statusCode === 404) {
        file.close();
        fs.unlink(dest, () => {});
        console.error(`File not found (404): ${url}`);
        reject(new Error(`File not found (404): ${url}`));
        return;
      }
      
      if (response.statusCode !== 200) {
        file.close();
        fs.unlink(dest, () => {});
        reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      file.on('finish', () => {
        file.close(() => {
          console.log(`Successfully downloaded ${url}`);
          resolve(dest);
        });
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      console.error(`Error downloading ${url}: ${err.message}`);
      reject(err);
    });
  });
};

// Enable CORS
app.use(cors());

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.mpp' && ext !== '.mpx') {
      return cb(new Error('Only .mpp and .mpx files are allowed'));
    }
    cb(null, true);
  }
});

// Execute Java command to parse the MPP/MPX file
const parseWithJava = async (filePath) => {
  return new Promise(async (resolve, reject) => {
    try {
      // Create a temp directory for Java output
      const tempDir = path.join(os.tmpdir(), `mpp_parser_${Date.now()}`);
      await fs.promises.mkdir(tempDir, { recursive: true });
      
      // Create lib directory for JAR files
      const libDir = path.join(tempDir, 'lib');
      await fs.promises.mkdir(libDir, { recursive: true });
      
      try {
        // 1. Copy required JAR files from local lib directory to temp lib directory
        const sourceLibDir = path.join(__dirname, 'lib');
        console.log('Copying JAR files from:', sourceLibDir);
        
        // Get list of JAR files in the source directory
        const jarFiles = fs.readdirSync(sourceLibDir).filter(file => file.endsWith('.jar'));
        
        if (jarFiles.length === 0) {
          throw new Error('No JAR files found in the lib directory');
        }
        
        // Copy each JAR file to the temp lib directory
        for (const jarFile of jarFiles) {
          const sourcePath = path.join(sourceLibDir, jarFile);
          const destPath = path.join(libDir, jarFile);
          await fs.promises.copyFile(sourcePath, destPath);
          console.log(`Copied ${jarFile}`);
        }
        
        console.log('JAR files copied successfully');
        
        // 2. Download additional required dependencies
        console.log('Downloading additional dependencies...');
        const dependencyUrls = [
          'https://repo1.maven.org/maven2/com/fasterxml/jackson/core/jackson-core/2.14.2/jackson-core-2.14.2.jar',
          'https://repo1.maven.org/maven2/com/fasterxml/jackson/core/jackson-databind/2.14.2/jackson-databind-2.14.2.jar',
          'https://repo1.maven.org/maven2/com/fasterxml/jackson/core/jackson-annotations/2.14.2/jackson-annotations-2.14.2.jar',
          'https://repo1.maven.org/maven2/commons-io/commons-io/2.11.0/commons-io-2.11.0.jar',
          'https://repo1.maven.org/maven2/org/apache/logging/log4j/log4j-api/2.17.2/log4j-api-2.17.2.jar',
          'https://repo1.maven.org/maven2/org/apache/logging/log4j/log4j-core/2.17.2/log4j-core-2.17.2.jar',
          'https://repo1.maven.org/maven2/org/apache/commons/commons-collections4/4.4/commons-collections4-4.4.jar',
          'https://repo1.maven.org/maven2/com/rtfparserkit/rtfparserkit/1.10.0/rtfparserkit-1.10.0.jar'
        ];
        
        // Download each dependency, but continue if some fail
        const downloadResults = await Promise.allSettled(dependencyUrls.map(url => {
          const fileName = url.substring(url.lastIndexOf('/') + 1);
          const filePath = path.join(libDir, fileName);
          return downloadFile(url, filePath);
        }));
        
        // Check results and report failed downloads
        const failedDownloads = downloadResults
          .filter(result => result.status === 'rejected')
          .map((result, index) => ({ 
            url: dependencyUrls[index], 
            reason: result.reason.message 
          }));
          
        if (failedDownloads.length > 0) {
          console.warn(`${failedDownloads.length} dependencies failed to download:`);
          failedDownloads.forEach(failure => console.warn(`- ${failure.url}: ${failure.reason}`));
          
          // Only throw if all critical Jackson libraries failed
          const allJacksonFailed = ['jackson-core', 'jackson-databind', 'jackson-annotations']
            .every(lib => failedDownloads.some(failure => failure.url.includes(lib)));
            
          if (allJacksonFailed) {
            throw new Error('Failed to download critical Jackson libraries');
          }
        }
        
        console.log(`Downloaded ${downloadResults.filter(r => r.status === 'fulfilled').length} dependencies successfully`);
      } catch (err) {
        console.error('Error preparing JAR files:', err);
        await fs.promises.rm(tempDir, { recursive: true, force: true });
        reject(new Error(`Error preparing JAR files: ${err.message}`));
        return;
      }
      
      // Write Java code to a temporary file
      const javaFilePath = path.join(tempDir, 'MPPParser.java');
      const javaCode = `
import net.sf.mpxj.*;
import net.sf.mpxj.reader.UniversalProjectReader;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import java.text.SimpleDateFormat;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Date;
import java.io.File;

public class MPPParser {
    public static void main(String[] args) {
        try {
            if (args.length != 1) {
                System.err.println("Usage: java MPPParser <project_file>");
                System.exit(1);
            }

            String filePath = args[0];
            File file = new File(filePath);
            
            if (!file.exists()) {
                System.err.println("File not found: " + filePath);
                System.exit(1);
            }
            
            // Read the project file
            UniversalProjectReader reader = new UniversalProjectReader();
            ProjectFile project = reader.read(file);
            
            // Set up Jackson for JSON output
            ObjectMapper mapper = new ObjectMapper();
            ObjectNode rootNode = mapper.createObjectNode();
            
            // Create a date formatter for LocalDateTime
            DateTimeFormatter dateFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd");
            
            // Extract project properties
            ObjectNode propertiesNode = mapper.createObjectNode();
            propertiesNode.put("name", project.getProjectProperties().getName());
            propertiesNode.put("author", project.getProjectProperties().getAuthor());
            propertiesNode.put("company", project.getProjectProperties().getCompany());
            
            // Extract dates using ProjectProperties with extra null checks
            ProjectProperties props = project.getProjectProperties();
            
            // Handle dates safely with LocalDateTime
            try {
                LocalDateTime startDate = props.getStartDate();
                propertiesNode.put("startDate", startDate != null ? startDate.format(dateFormatter) : "Not set");
            } catch (Exception e) {
                propertiesNode.put("startDate", "Not set");
            }
            
            try {
                LocalDateTime finishDate = props.getFinishDate();
                propertiesNode.put("finishDate", finishDate != null ? finishDate.format(dateFormatter) : "Not set");
            } catch (Exception e) {
                propertiesNode.put("finishDate", "Not set");
            }
            
            try {
                LocalDateTime statusDate = props.getStatusDate();
                propertiesNode.put("statusDate", statusDate != null ? statusDate.format(dateFormatter) : "Not set");
            } catch (Exception e) {
                propertiesNode.put("statusDate", "Not set");
            }
            
            try {
                LocalDateTime currentDate = props.getCurrentDate();
                propertiesNode.put("currentDate", currentDate != null ? currentDate.format(dateFormatter) : "Not set");
            } catch (Exception e) {
                propertiesNode.put("currentDate", "Not set");
            }
            
            // Other project properties
            propertiesNode.put("taskCount", project.getTasks().size());
            propertiesNode.put("resourceCount", project.getResources().size());
            propertiesNode.put("assignmentCount", project.getResourceAssignments().size());
            
            rootNode.set("properties", propertiesNode);
            
            // Extract tasks
            ArrayNode tasksNode = mapper.createArrayNode();
            
            for (Task task : project.getTasks()) {
                if (task != null) {
                    ObjectNode taskNode = mapper.createObjectNode();
                    
                    taskNode.put("id", task.getID());
                    taskNode.put("uniqueID", task.getUniqueID());
                    taskNode.put("name", task.getName());
                    taskNode.put("outlineNumber", task.getOutlineNumber());
                    taskNode.put("outlineLevel", task.getOutlineLevel());
                    
                    // Handle dates with LocalDateTime
                    try {
                        LocalDateTime start = task.getStart();
                        taskNode.put("start", start != null ? start.format(dateFormatter) : "");
                    } catch (Exception e) {
                        taskNode.put("start", "");
                    }
                    
                    try {
                        LocalDateTime finish = task.getFinish();
                        taskNode.put("finish", finish != null ? finish.format(dateFormatter) : "");
                    } catch (Exception e) {
                        taskNode.put("finish", "");
                    }
                    
                    // Handle durations
                    taskNode.put("duration", task.getDuration() != null ? task.getDuration().toString() : null);
                    
                    // Handle work
                    taskNode.put("work", task.getWork() != null ? task.getWork().toString() : null);
                    
                    // Handle percentages
                    Number percentComplete = task.getPercentageComplete();
                    taskNode.put("percentComplete", percentComplete != null ? percentComplete.doubleValue() : 0.0);
                    
                    // Handle task type
                    taskNode.put("type", task.getType() != null ? task.getType().toString() : "Normal");
                    
                    // Handle constraints
                    ConstraintType constraintType = task.getConstraintType();
                    taskNode.put("constraint", constraintType != null ? constraintType.toString() : "As Soon As Possible");
                    
                    // Handle predecessors
                    ArrayNode predecessorsNode = mapper.createArrayNode();
                    for (Relation relation : task.getPredecessors()) {
                        if (relation != null) {
                            ObjectNode relationNode = mapper.createObjectNode();
                            relationNode.put("taskID", relation.getTargetTask().getID());
                            relationNode.put("taskUniqueID", relation.getTargetTask().getUniqueID());
                            relationNode.put("taskName", relation.getTargetTask().getName());
                            relationNode.put("type", relation.getType().toString());
                            relationNode.put("lag", relation.getLag().toString());
                            predecessorsNode.add(relationNode);
                        }
                    }
                    taskNode.set("predecessors", predecessorsNode);
                    
                    // Add more task properties as needed
                    
                    tasksNode.add(taskNode);
                }
            }
            
            rootNode.set("tasks", tasksNode);
            
            // Extract resources
            ArrayNode resourcesNode = mapper.createArrayNode();
            
            for (Resource resource : project.getResources()) {
                if (resource != null && resource.getID() != null) {
                    ObjectNode resourceNode = mapper.createObjectNode();
                    
                    resourceNode.put("id", resource.getID());
                    resourceNode.put("uniqueID", resource.getUniqueID());
                    resourceNode.put("name", resource.getName());
                    resourceNode.put("type", resource.getType() != null ? resource.getType().toString() : "Work");
                    
                    // Convert Number to double for calculations
                    Number maxUnits = resource.getMaxUnits();
                    String maxUnitsStr = "100%";
                    if (maxUnits != null) {
                        double maxUnitsValue = maxUnits.doubleValue() * 100;
                        maxUnitsStr = maxUnitsValue + "%";
                    }
                    resourceNode.put("maxUnits", maxUnitsStr);
                    
                    // Add more resource properties as needed
                    
                    resourcesNode.add(resourceNode);
                }
            }
            
            rootNode.set("resources", resourcesNode);
            
            // Extract assignments
            ArrayNode assignmentsNode = mapper.createArrayNode();
            
            for (ResourceAssignment assignment : project.getResourceAssignments()) {
                if (assignment != null && assignment.getTaskUniqueID() != null && assignment.getResourceUniqueID() != null) {
                    ObjectNode assignmentNode = mapper.createObjectNode();
                    
                    assignmentNode.put("taskID", assignment.getTask().getID());
                    assignmentNode.put("taskUniqueID", assignment.getTaskUniqueID());
                    assignmentNode.put("taskName", assignment.getTask().getName());
                    
                    assignmentNode.put("resourceID", assignment.getResource().getID());
                    assignmentNode.put("resourceUniqueID", assignment.getResourceUniqueID());
                    assignmentNode.put("resourceName", assignment.getResource().getName());
                    
                    // Convert Number to double for calculations
                    Number units = assignment.getUnits();
                    double unitsValue = 100.0;
                    if (units != null) {
                        unitsValue = units.doubleValue() * 100;
                    }
                    assignmentNode.put("units", unitsValue);
                    
                    // Add more assignment properties as needed
                    
                    assignmentsNode.add(assignmentNode);
                }
            }
            
            rootNode.set("assignments", assignmentsNode);
            
            // Output the JSON
            System.out.println(mapper.writerWithDefaultPrettyPrinter().writeValueAsString(rootNode));
            System.out.flush();
            
        } catch (Exception e) {
            System.err.println("Error parsing project file: " + e.getMessage());
            e.printStackTrace();
            System.exit(1);
        }
    }
}
`;
      await fs.promises.writeFile(javaFilePath, javaCode);
      
      // Define paths for JAR files
      const mpxjJarPath = path.join(__dirname, 'lib', 'mpxj.jar');
      const poiJarPath = path.join(__dirname, 'lib', 'poi.jar');
      
      // Define classpath separator based on platform
      const pathSeparator = process.platform === 'win32' ? ';' : ':';
      
      // Compile the Java code
      console.log('Compiling Java code...');
      const classpath = `"${mpxjJarPath}${pathSeparator}${poiJarPath}${pathSeparator}${libDir}/*"`;
      
      try {
        await execPromise(`javac -cp ${classpath} ${javaFilePath}`);
      } catch (err) {
        console.error('Error executing Java parser:', err);
        await fs.promises.rm(tempDir, { recursive: true, force: true });
        reject(new Error(`Error compiling Java code: ${err.message}`));
        return;
      }
      
      // Execute the Java program
      try {
        const { stdout, stderr } = await execPromise(`java -cp ${classpath}${pathSeparator}"${tempDir}" MPPParser "${filePath}"`);
        
        // If stderr exists, log it but continue unless it indicates a critical error
        if (stderr && typeof stderr === 'string') {
          console.error('Java execution stderr:', stderr);
          
          // Check for fatal errors that should stop execution
          if (stderr.includes('Exception in thread "main"') || 
              stderr.includes('Error: Could not find or load main class') ||
              stderr.includes('NoClassDefFoundError')) {
            throw new Error(`Java execution error: ${stderr}`);
          }
        }
        
        // Debug the stdout before parsing
        console.log('Java stdout type:', typeof stdout);
        if (stdout) {
          console.log('Java stdout length:', stdout.length);
          console.log('Java stdout preview:', stdout.substring(0, 200) + (stdout.length > 200 ? '...' : ''));
        } else {
          console.log('Java stdout is empty or null');
        }
        
        // Ensure we have valid JSON before parsing
        if (!stdout || typeof stdout !== 'string' || stdout.trim() === '') {
          throw new Error('Empty or invalid output from Java program');
        }
        
        // Try to extract JSON part if there's extra output
        let jsonStr = stdout.trim();
        
        // Find the beginning and end of JSON
        const jsonStartIndex = jsonStr.indexOf('{');
        const jsonEndIndex = jsonStr.lastIndexOf('}');
        
        if (jsonStartIndex >= 0 && jsonEndIndex > jsonStartIndex) {
          // Extract just the JSON portion
          jsonStr = jsonStr.substring(jsonStartIndex, jsonEndIndex + 1);
        }
        
        let parsedData;
        try {
          parsedData = JSON.parse(jsonStr);
        } catch (parseError) {
          console.error('JSON parsing error:', parseError);
          console.error('Attempted to parse:', jsonStr);
          
          // Try one more approach - look for obvious JSON structure
          try {
            const match = stdout.match(/\{[\s\S]*\}/);
            if (match) {
              parsedData = JSON.parse(match[0]);
              console.log('Successfully parsed JSON using regex extraction');
            } else {
              throw new Error('No JSON object found in output');
            }
          } catch (secondError) {
            console.error('Second parsing attempt failed:', secondError);
            console.error('Full raw stdout:', stdout);
            throw new Error(`Failed to parse Java output as JSON: ${parseError.message}`);
          }
        }
        
        // Clean up temp directory
        await fs.promises.rm(tempDir, { recursive: true, force: true });
        
        resolve(parsedData);
      } catch (err) {
        console.error('Error executing Java program:', err);
        await fs.promises.rm(tempDir, { recursive: true, force: true });
        reject(new Error(`Error executing Java program: ${err.message}`));
      }
    } catch (err) {
      console.error('Error in parseWithJava:', err);
      reject(err);
    }
  });
};

// API endpoint to parse project file
app.post('/api/parse', upload.single('projectFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // Check if the required JAR files exist
    const mpxjJar = path.join(__dirname, 'lib', 'mpxj.jar');
    const poiJar = path.join(__dirname, 'lib', 'poi.jar');
    
    if (!fs.existsSync(mpxjJar) || !fs.existsSync(poiJar)) {
      return res.status(500).json({ error: 'Required JAR files are missing' });
    }
    
    // Parse the project file using Java
    const projectData = await parseWithJava(req.file.path);
    
    // Clean up the uploaded file
    fs.unlinkSync(req.file.path);
    
    // Return the parsed data
    res.json(projectData);
    
  } catch (error) {
    console.error('Error processing file:', error);
    res.status(500).json({ error: error.message || 'Failed to process file' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
