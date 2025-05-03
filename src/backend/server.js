const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const { exec } = require('child_process');
const os = require('os');
const https = require('https');
const { generatePbit } = require('../generators/pbitGenerator');
require('dotenv').config();
const winston = require('winston');
const Ajv = require('ajv');


// Logger setup
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ level, message, timestamp }) => {
      return `${timestamp} ${level}: ${message}`;
    })
  ),
  transports: [new winston.transports.Console()],
});

// Add custom log level handlers to ensure all log calls are properly formatted
const originalLog = logger.log;
logger.log = function(message, ...args) {
  // If message is a string and no additional args, convert to object format
  if (typeof message === 'string' && args.length === 0) {
    return originalLog.call(this, { level: 'info', message });
  }
  // Otherwise, proceed with normal logging
  return originalLog.call(this, message, ...args);
};

const app = express();

// Load environment-specific configuration
const ENV = process.env.NODE_ENV || 'dev';
let config = {};
try {
  const configPath = path.join(__dirname, '..', '..', 'config', `config.${ENV}.json`);
  if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    logger.info(`Loaded configuration for ${ENV} from ${configPath}`);
  } else {
    logger.warn(`Config file not found for ENV=${ENV} at ${configPath}. Using defaults.`);
  }
} catch (err) {
  logger.error('Failed to load configuration:', err);
}

const port = process.env.PORT || config.port || 3001;

// Directories derived from configuration (fallbacks included)
const UPLOAD_DIR_NAME = config.uploadDir || 'uploads';
const GENERATOR_DIR_REL = config.generatorDir || 'generator';  // Removed extra 'src' from path
const MAX_JSON_SIZE = config.maxJsonSize || 10 * 1024 * 1024; // 10 MB

// At the top of the file, after require statements
const execPromise = promisify(exec);

// AJV setup & schema
const ajv = new Ajv({ allErrors: true,
  allowUnionTypes: true,
  strictTypes: "log"
 });
let validateProject;
try {
  const schemaPath = path.join(__dirname, 'schemas', 'project-schema.json');
  if (fs.existsSync(schemaPath)) {
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
    validateProject = ajv.compile(schema);
    logger.info('Project schema loaded for validation');
  } else {
    logger.warn('Project schema not found; validation disabled');
  }
} catch (err) {
  logger.error('Failed to load/compile schema:', err);
}

// Function to download a file from a URL
const downloadFile = (url, dest) => {
  return new Promise((resolve, reject) => {
    logger.log(`Downloading ${url}`);
    const file = fs.createWriteStream(dest);

    https
      .get(url, (response) => {
        if (response.statusCode === 404) {
          file.close();
          fs.unlink(dest, () => {});
          logger.error(`File not found (404): ${url}`);
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
            logger.log(`Successfully downloaded ${url}`);
            resolve(dest);
          });
        });
      })
      .on('error', (err) => {
        fs.unlink(dest, () => {});
        logger.error(`Error downloading ${url}: ${err.message}`);
        reject(err);
      });
  });
};

// Enable CORS
app.use(cors({
  origin: function(origin, callback) {
    // In production, allow any origin
    if (process.env.NODE_ENV === 'production') {
      callback(null, true);
      return;
    }
    
    // In development, allow localhost and replit domains
    const allowedOrigins = ['http://localhost:3000', 'http://localhost:3001', 'https://replit.com', 'https://sp.replit.com'];
    
    // Add Azure domains
    const azureDomains = [
      'https://lmtmpp-parserapp.azurewebsites.net',
      'https://lmtmpp-parserapp-hqhtcpfghvavgfed.centralus-01.azurewebsites.net'
    ];
    
    const allAllowedOrigins = [...allowedOrigins, ...azureDomains];
    
    if (!origin) {
      // Allow requests with no origin (like mobile apps, curl requests, etc)
      callback(null, true);
    } else if (allAllowedOrigins.indexOf(origin) !== -1) {
      // Allow specific origins
      callback(null, true);
    } else if (origin.endsWith('.azurewebsites.net')) {
      // Allow any Azure websites domain
      callback(null, true);
    } else {
      // Block other origins
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true // Allow cookies and credentials to be sent
}));

// Serve static files from the React build directory
const staticFilesPath = path.join(__dirname, '..', 'build');
logger.info(`Serving static files from: ${staticFilesPath}`);
app.use(express.static(staticFilesPath));

// Health-check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Configure multer for MPP/MPX uploads (legacy)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, UPLOAD_DIR_NAME);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.mpp' && ext !== '.mpx' && ext !== '.mpt' && ext !== '.xer') {
      return cb(new Error('Only .mpp, .mpx, .mpt and .xer files are allowed'));
    }
    cb(null, true);
  },
});

// Multer instance for JSON uploads
const jsonUpload = multer({
  storage,
  limits: { fileSize: MAX_JSON_SIZE },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.json') {
      return cb(new Error('Only .json files are allowed'));
    }
    cb(null, true);
  },
});

// Execute Java command to parse the MPP/MPX file
const parseWithJava = async (filePath, startDate) => {
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
        logger.info('Copying JAR files from:', sourceLibDir);

        // Get list of JAR files in the source directory
        const jarFiles = fs.readdirSync(sourceLibDir).filter((file) => file.endsWith('.jar'));

        if (jarFiles.length === 0) {
          throw new Error('No JAR files found in the lib directory');
        }

        // Copy each JAR file to the temp lib directory
        for (const jarFile of jarFiles) {
          const sourcePath = path.join(sourceLibDir, jarFile);
          const destPath = path.join(libDir, jarFile);
          await fs.promises.copyFile(sourcePath, destPath);
          logger.info(`Copied ${jarFile}`);
        }

        logger.info('JAR files copied successfully');

        // 2. Download additional required dependencies
        const DOWNLOADS_DIR = path.join(__dirname, '..', '..', 'downloads');
        if (!fs.existsSync(DOWNLOADS_DIR)) {
          fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
        }

        const dependencies = [
          {
            name: 'Jackson Core',
            url: 'https://repo1.maven.org/maven2/com/fasterxml/jackson/core/jackson-core/2.14.2/jackson-core-2.14.2.jar',
            filename: 'jackson-core-2.14.2.jar'
          },
          {
            name: 'Jakarta XML Bind API',
            url: 'https://repo1.maven.org/maven2/jakarta/xml/bind/jakarta.xml.bind-api/4.0.0/jakarta.xml.bind-api-4.0.0.jar',
            filename: 'jakarta.xml.bind-api-4.0.0.jar'
          },
          {
            name: 'Jakarta XML Bind Runtime',
            url: 'https://repo1.maven.org/maven2/com/sun/xml/bind/jaxb-impl/4.0.3/jaxb-impl-4.0.3.jar',
            filename: 'jaxb-impl-4.0.3.jar'
          },
          {
            name: 'Jakarta Activation',
            url: 'https://repo1.maven.org/maven2/jakarta/activation/jakarta.activation-api/2.1.0/jakarta.activation-api-2.1.0.jar',
            filename: 'jakarta.activation-api-2.1.0.jar'
          },
          {
            name: 'Jackson Databind',
            url: 'https://repo1.maven.org/maven2/com/fasterxml/jackson/core/jackson-databind/2.14.2/jackson-databind-2.14.2.jar',
            filename: 'jackson-databind-2.14.2.jar'
          },
          {
            name: 'Jackson Annotations',
            url: 'https://repo1.maven.org/maven2/com/fasterxml/jackson/core/jackson-annotations/2.14.2/jackson-annotations-2.14.2.jar',
            filename: 'jackson-annotations-2.14.2.jar'
          },
          {
            name: 'Commons IO',
            url: 'https://repo1.maven.org/maven2/commons-io/commons-io/2.11.0/commons-io-2.11.0.jar',
            filename: 'commons-io-2.11.0.jar'
          },
          {
            name: 'Log4j API',
            url: 'https://repo1.maven.org/maven2/org/apache/logging/log4j/log4j-api/2.17.2/log4j-api-2.17.2.jar',
            filename: 'log4j-api-2.17.2.jar'
          },
          {
            name: 'Log4j Core',
            url: 'https://repo1.maven.org/maven2/org/apache/logging/log4j/log4j-core/2.17.2/log4j-core-2.17.2.jar',
            filename: 'log4j-core-2.17.2.jar'
          },
          {
            name: 'Commons Collections',
            url: 'https://repo1.maven.org/maven2/org/apache/commons/commons-collections4/4.4/commons-collections4-4.4.jar',
            filename: 'commons-collections4-4.4.jar'
          },
          {
            name: 'RTF Parser Kit',
            url: 'https://repo1.maven.org/maven2/com/github/joniles/rtfparserkit/1.16.0/rtfparserkit-1.16.0.jar',
            filename: 'rtfparserkit-1.16.0.jar'
          }
        ];

        // Download each dependency, but continue if some fail
        const downloadDependencies = async (libDir) => {
          logger.info('Checking dependencies...');
          const downloadResults = [];

          for (const dep of dependencies) {
            const downloadPath = path.join(DOWNLOADS_DIR, dep.filename);
            const libPath = path.join(libDir, dep.filename);
            
            if (!fs.existsSync(downloadPath)) {
              logger.info(`Downloading ${dep.name} from ${dep.url}...`);
              try {
                await downloadFile(dep.url, downloadPath);
                logger.info(`Successfully downloaded ${dep.name}`);
              } catch (err) {
                logger.error(`Failed to download ${dep.name}: ${err.message}`);
                downloadResults.push({ status: 'rejected', url: dep.url, reason: err.message });
                continue;
              }
            } else {
              logger.info(`${dep.name} found in downloads folder`);
            }

            // Copy from downloads to lib
            try {
              await fs.promises.copyFile(downloadPath, libPath);
              downloadResults.push({ status: 'fulfilled' });
            } catch (err) {
              logger.error(`Failed to copy ${dep.name} to lib: ${err.message}`);
              downloadResults.push({ status: 'rejected', url: dep.url, reason: err.message });
            }
          }

          return downloadResults;
        };

        const downloadResults = await downloadDependencies(libDir);

        // Check results and report failed downloads
        const failedDownloads = downloadResults
          .filter((result) => result.status === 'rejected')
          .map((result, index) => ({
            url: dependencies[index].url,
            reason: result.reason,
          }));

        if (failedDownloads.length > 0) {
          logger.warn(`${failedDownloads.length} dependencies failed to download:`);
          failedDownloads.forEach((failure) => logger.warn(`- ${failure.url}: ${failure.reason}`));

          // Only throw if all critical Jackson libraries failed
          const allJacksonFailed = [
            'jackson-core',
            'jackson-databind',
            'jackson-annotations',
          ].every((lib) => failedDownloads.some((failure) => failure.url.includes(lib)));

          if (allJacksonFailed) {
            throw new Error('Failed to download critical Jackson libraries');
          }
        }

        logger.info(
          `Downloaded ${downloadResults.filter((r) => r.status === 'fulfilled').length} dependencies successfully`
        );
      } catch (err) {
        logger.error('Error preparing JAR files:', err);
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
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.io.File;

public class MPPParser {
    public static void main(String[] args) {
        try {
            if (args.length != 2) {
                System.err.println("Usage: java MPPParser <project_file> <start_date>");
                System.exit(1);
            }

            String filePath = args[0];
            String newStartDateStr = args[1];
            
            File file = new File(filePath);
            
            if (!file.exists()) {
                System.err.println("File not found: " + filePath);
                System.exit(1);
            }
            
            // Read the project file
            UniversalProjectReader reader = new UniversalProjectReader();
            ProjectFile project = reader.read(file);
            
            // Parse the new start date
            LocalDateTime newStartDate = LocalDateTime.parse(newStartDateStr + "T00:00");
            
            // Calculate the difference between original and new start dates
            LocalDateTime originalStartDate = project.getProjectProperties().getStartDate();
            long daysDifference = 0;
            if (originalStartDate != null) {
                // Ensure we compare dates at midnight to avoid time-based offsets
                originalStartDate = originalStartDate.withHour(0).withMinute(0).withSecond(0).withNano(0);
                daysDifference = ChronoUnit.DAYS.between(originalStartDate, newStartDate);
            }
            
            // Set up Jackson for JSON output
            ObjectMapper mapper = new ObjectMapper();
            ObjectNode rootNode = mapper.createObjectNode();
            
            // Create a date formatter for LocalDateTime that only includes the date portion
            DateTimeFormatter dateFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd");
            
            // Extract project properties
            ObjectNode propertiesNode = mapper.createObjectNode();
            propertiesNode.put("name", project.getProjectProperties().getName());
            propertiesNode.put("author", project.getProjectProperties().getAuthor());
            propertiesNode.put("company", project.getProjectProperties().getCompany());
            
            // Set the new start date in project properties
            propertiesNode.put("startDate", newStartDate.format(dateFormatter));
            
            // Adjust finish date if available
            try {
                LocalDateTime finishDate = project.getProjectProperties().getFinishDate();
                if (finishDate != null) {
                    // Ensure consistent time portion when adjusting dates
                    finishDate = finishDate.withHour(0).withMinute(0).withSecond(0).withNano(0);
                    finishDate = finishDate.plusDays(daysDifference);
                    propertiesNode.put("finishDate", finishDate.format(dateFormatter));
                } else {
                    propertiesNode.put("finishDate", "Not set");
                }
            } catch (Exception e) {
                propertiesNode.put("finishDate", "Not set");
            }
            
            // Other project properties
            propertiesNode.put("taskCount", project.getTasks().size());
            propertiesNode.put("resourceCount", project.getResources().size());
            propertiesNode.put("assignmentCount", project.getResourceAssignments().size());
            
            rootNode.set("properties", propertiesNode);
            
            // Extract tasks with adjusted dates
            ArrayNode tasksNode = mapper.createArrayNode();
            
            for (Task task : project.getTasks()) {
                if (task != null) {
                    ObjectNode taskNode = mapper.createObjectNode();
                    
                    taskNode.put("id", task.getID());
                    taskNode.put("uniqueID", task.getUniqueID());
                    taskNode.put("name", task.getName());
                    taskNode.put("outlineNumber", task.getOutlineNumber());
                    taskNode.put("outlineLevel", task.getOutlineLevel());
                    
                    // Adjust task dates by the difference
                    try {
                        LocalDateTime taskStart = task.getStart();
                        if (taskStart != null) {
                            // Normalize time portion to midnight
                            taskStart = taskStart.withHour(0).withMinute(0).withSecond(0).withNano(0);
                            taskStart = taskStart.plusDays(daysDifference);
                            taskNode.put("start", taskStart.format(dateFormatter));
                        } else {
                            taskNode.put("start", "");
                        }
                    } catch (Exception e) {
                        taskNode.put("start", "");
                    }
                    
                    try {
                        LocalDateTime taskFinish = task.getFinish();
                        if (taskFinish != null) {
                            // Normalize time portion to midnight
                            taskFinish = taskFinish.withHour(0).withMinute(0).withSecond(0).withNano(0);
                            taskFinish = taskFinish.plusDays(daysDifference);
                            taskNode.put("finish", taskFinish.format(dateFormatter));
                        } else {
                            taskNode.put("finish", "");
                        }
                    } catch (Exception e) {
                        taskNode.put("finish", "");
                    }
                    
                    // Keep original durations and other properties
                    taskNode.put("duration", task.getDuration() != null ? task.getDuration().toString() : null);
                    taskNode.put("work", task.getWork() != null ? task.getWork().toString() : null);
                    taskNode.put("percentComplete", task.getPercentageComplete() != null ? task.getPercentageComplete().doubleValue() : 0.0);
                    taskNode.put("type", task.getType() != null ? task.getType().toString() : "Normal");
                    taskNode.put("constraint", task.getConstraintType() != null ? task.getConstraintType().toString() : "As Soon As Possible");
                    
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
                    
                    tasksNode.add(taskNode);
                }
            }
            
            rootNode.set("tasks", tasksNode);
            
            // Extract resources
            ArrayNode resourcesNode = mapper.createArrayNode();
            
            // Initialize default resource if none exists
            if (project.getResources().isEmpty()) {
                ObjectNode defaultResource = mapper.createObjectNode();
                defaultResource.put("id", 1);
                defaultResource.put("uniqueID", 1);
                defaultResource.put("name", "Unassigned");
                defaultResource.put("type", "Work");
                defaultResource.put("maxUnits", "100%");
                resourcesNode.add(defaultResource);
            } else {
                for (Resource resource : project.getResources()) {
                    if (resource != null && resource.getID() != null) {
                        ObjectNode resourceNode = mapper.createObjectNode();
                        resourceNode.put("id", resource.getID());
                        resourceNode.put("uniqueID", resource.getUniqueID());
                        resourceNode.put("name", resource.getName());
                        resourceNode.put("type", resource.getType() != null ? resource.getType().toString() : "Work");
                        
                        Number maxUnits = resource.getMaxUnits();
                        String maxUnitsStr = "100%";
                        if (maxUnits != null) {
                            double maxUnitsValue = maxUnits.doubleValue() * 100;
                            maxUnitsStr = maxUnitsValue + "%";
                        }
                        resourceNode.put("maxUnits", maxUnitsStr);
                        resourcesNode.add(resourceNode);
                    }
                }
            }
            
            rootNode.set("resources", resourcesNode);
            
            // Extract assignments
            ArrayNode assignmentsNode = mapper.createArrayNode();
            
            // Create default assignment for tasks if none exists
            if (project.getResourceAssignments().isEmpty()) {
                for (Task task : project.getTasks()) {
                    if (task != null && !task.getSummary()) {  // Only create assignments for non-summary tasks
                        ObjectNode defaultAssignment = mapper.createObjectNode();
                        defaultAssignment.put("taskID", task.getID());
                        defaultAssignment.put("taskUniqueID", task.getUniqueID());
                        defaultAssignment.put("taskName", task.getName());
                        defaultAssignment.put("resourceID", 1);  // Default resource ID
                        defaultAssignment.put("resourceUniqueID", 1);
                        defaultAssignment.put("resourceName", "Unassigned");
                        defaultAssignment.put("units", 100.0);
                        assignmentsNode.add(defaultAssignment);
                    }
                }
            } else {
                for (ResourceAssignment assignment : project.getResourceAssignments()) {
                    if (assignment != null && assignment.getTaskUniqueID() != null) {
                        ObjectNode assignmentNode = mapper.createObjectNode();
                        assignmentNode.put("taskID", assignment.getTask().getID());
                        assignmentNode.put("taskUniqueID", assignment.getTaskUniqueID());
                        assignmentNode.put("taskName", assignment.getTask().getName());
                        assignmentNode.put("resourceID", assignment.getResource().getID());
                        assignmentNode.put("resourceUniqueID", assignment.getResourceUniqueID());
                        assignmentNode.put("resourceName", assignment.getResource().getName());
                        
                        Number units = assignment.getUnits();
                        double unitsValue = 100.0;
                        if (units != null) {
                            unitsValue = units.doubleValue() * 100;
                        }
                        assignmentNode.put("units", unitsValue);
                        assignmentsNode.add(assignmentNode);
                    }
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
      logger.info('Compiling Java code...');
      const classpath = `"${mpxjJarPath}${pathSeparator}${poiJarPath}${pathSeparator}${libDir}/*"`;

      try {
        await execPromise(`javac -cp ${classpath} ${javaFilePath}`);
      } catch (err) {
        logger.error('Error executing Java parser:', err);
        await fs.promises.rm(tempDir, { recursive: true, force: true });
        reject(new Error(`Error compiling Java code: ${err.message}`));
        return;
      }

      // Execute the Java program
      try {
        const allJars = fs.readdirSync(libDir)
          .filter(file => file.endsWith('.jar'))
          .map(file => path.join(libDir, file));
        
        // Include temp directory in classpath for finding the MPPParser class
        const fullClasspath = [tempDir, mpxjJarPath, poiJarPath, ...allJars]
          .join(pathSeparator);

        // Execute the Java program with complete module configuration
        const javaCommand = `cd "${tempDir}" && java -Djava.util.logging.config.file=/dev/null --add-modules ALL-SYSTEM --add-exports java.base/jdk.internal.loader=ALL-UNNAMED --add-opens java.base/java.lang=ALL-UNNAMED --add-opens java.base/java.util=ALL-UNNAMED -cp "${fullClasspath}" MPPParser "${filePath}" "${startDate}" 2>&1`;
        
        logger.info('Executing Java command:', javaCommand);
        const { stdout, stderr } = await execPromise(javaCommand);

        // Log complete output for debugging
        if (stdout) logger.info('Java stdout:', stdout);
        if (stderr) logger.error('Java stderr:', stderr);

        // Debug the stdout before parsing
        logger.info('Java stdout type:', typeof stdout);
        if (stdout) {
          logger.info('Java stdout length:', stdout.length);
          logger.info(
            'Java stdout preview:',
            stdout.substring(0, 200) + (stdout.length > 200 ? '...' : '')
          );
        } else {
          logger.info('Java stdout is empty or null');
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
          logger.error('JSON parsing error:', parseError);
          logger.error('Attempted to parse:', jsonStr);

          // Try one more approach - look for obvious JSON structure
          try {
            const match = stdout.match(/\{[\s\S]*\}/);
            if (match) {
              parsedData = JSON.parse(match[0]);
              logger.info('Successfully parsed JSON using regex extraction');
            } else {
              throw new Error('No JSON object found in output');
            }
          } catch (secondError) {
            logger.error('Second parsing attempt failed:', secondError);
            logger.error('Full raw stdout:', stdout);
            throw new Error(`Failed to parse Java output as JSON: ${parseError.message}`);
          }
        }

        // Clean up temp directory
        await fs.promises.rm(tempDir, { recursive: true, force: true });

        resolve(parsedData);
      } catch (err) {
        logger.error('Error executing Java program:', err);
        await fs.promises.rm(tempDir, { recursive: true, force: true });
        reject(new Error(`Error executing Java program: ${err.message}`));
      }
    } catch (err) {
      logger.error('Error in parseWithJava:', err);
      reject(err);
    }
  });
};

// Helper to format AJV validation errors into user‑friendly objects
function formatValidationErrors(errors) {
  return errors.map((err) => ({
    field: err.instancePath ? err.instancePath.replace(/^\//, '') : err.params?.missingProperty || '',
    message: err.message,
  }));
}

// API endpoint to parse project file
app.post('/api/parse', upload.single('projectFile'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (!req.body.startDate) {
      return res.status(400).json({ error: 'Start date is required' });
    }

    // Check if the required JAR files exist
    const mpxjJar = path.join(__dirname, 'lib', 'mpxj.jar');
    const poiJar = path.join(__dirname, 'lib', 'poi.jar');

    if (!fs.existsSync(mpxjJar) || !fs.existsSync(poiJar)) {
      return res.status(500).json({ error: 'Required JAR files are missing' });
    }

    // Parse the project file using Java with the provided start date
    const projectData = await parseWithJava(req.file.path, req.body.startDate);

    // Validate parsed data if schema available
    if (validateProject) {
      const valid = validateProject(projectData);
      if (!valid) {
        logger.error('Project data failed schema validation', validateProject.errors);
        return res.status(400).json({
          error: 'JSON validation failed',
          details: formatValidationErrors(validateProject.errors || []),
        });
      }
    }

    // Generate output paths
    const timestamp = Date.now();
    const fileName = path.basename(req.file.originalname, path.extname(req.file.originalname));
    const outputDir = path.join(__dirname, '..', 'generator');
    await fs.promises.mkdir(outputDir, { recursive: true });

    // Save JSON (for reference/debugging)
    const jsonPath = path.join(outputDir, 'project-data.json');
    await fs.promises.writeFile(jsonPath, JSON.stringify(projectData, null, 2), 'utf-8');
    logger.info(`Saved project data JSON to ${jsonPath}`);

    res.status(200).json({ message: 'Project data parsed and saved successfully' });
  } catch (err) {
    logger.error('Error parsing project file:', err);
    res.status(500).json({ error: 'Failed to parse project file' });
  }
});

app.listen(port, () => {
  logger.info(`Server is running on port ${port}`);
});
