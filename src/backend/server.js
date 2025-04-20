const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const java = require('node-java-maven');

const app = express();
const port = process.env.PORT || 3001;

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

// Initialize Java bridge with MPXJ
const initializeJava = async () => {
  try {
    await java.classpath.addJar(path.join(__dirname, 'lib', 'mpxj.jar'));
    await java.classpath.addJar(path.join(__dirname, 'lib', 'poi.jar'));
    
    console.log('Java bridge initialized with MPXJ');
    return true;
  } catch (error) {
    console.error('Failed to initialize Java bridge:', error);
    return false;
  }
};

// Parse MPP/MPX file using MPXJ
const parseProjectFile = async (filePath) => {
  try {
    const fileExt = path.extname(filePath).toLowerCase();
    
    // Create appropriate reader based on file extension
    let reader;
    if (fileExt === '.mpp') {
      reader = java.newInstanceSync('net.sf.mpxj.mpp.MPPReader');
    } else if (fileExt === '.mpx') {
      reader = java.newInstanceSync('net.sf.mpxj.mpx.MPXReader');
    } else {
      throw new Error('Unsupported file format');
    }
    
    // Read the project file
    const file = java.newInstanceSync('java.io.File', filePath);
    const project = reader.readSync(file);
    
    // Extract project properties
    const properties = {
      name: project.getNameSync(),
      startDate: project.getStartDateSync().toStringSync(),
      finishDate: project.getFinishDateSync().toStringSync(),
      statusDate: project.getStatusDateSync() ? project.getStatusDateSync().toStringSync() : 'Not set',
      currentDate: project.getCurrentDateSync() ? project.getCurrentDateSync().toStringSync() : 'Not set',
      calendar: project.getCalendarSync().getNameSync(),
      defaultTaskType: project.getDefaultTaskTypeSync().toStringSync(),
      taskCount: project.getTaskCountSync(),
      resourceCount: project.getResourceCountSync()
    };
    
    // Extract tasks
    const tasks = [];
    const taskList = project.getTasksSync();
    const taskIterator = taskList.iteratorSync();
    
    while (taskIterator.hasNextSync()) {
      const task = taskIterator.nextSync();
      
      // Skip summary tasks if needed
      // if (task.getSummarySync()) continue;
      
      // Get predecessors
      const predecessors = [];
      const relations = task.getPredecessorsSync();
      const relationsIterator = relations.iteratorSync();
      
      while (relationsIterator.hasNextSync()) {
        const relation = relationsIterator.nextSync();
        const predecessor = relation.getSourceTaskSync();
        predecessors.push(predecessor.getIDSync().toString());
      }
      
      tasks.push({
        id: task.getIDSync(),
        uniqueID: task.getUniqueIDSync(),
        name: task.getNameSync(),
        outlineLevel: task.getOutlineNumberSync() ? task.getOutlineNumberSync().length() / 2 : 0,
        summary: task.getSummarySync(),
        start: task.getStartSync() ? task.getStartSync().toStringSync() : 'Not set',
        finish: task.getFinishSync() ? task.getFinishSync().toStringSync() : 'Not set',
        duration: task.getDurationSync() ? task.getDurationSync().toStringSync() : 'Not set',
        percentComplete: task.getPercentCompleteSync() ? task.getPercentCompleteSync().toString() : '0',
        predecessors: predecessors.join(', ')
      });
    }
    
    // Extract resources
    const resources = [];
    const resourceList = project.getResourcesSync();
    const resourceIterator = resourceList.iteratorSync();
    
    while (resourceIterator.hasNextSync()) {
      const resource = resourceIterator.nextSync();
      resources.push({
        id: resource.getIDSync(),
        uniqueID: resource.getUniqueIDSync(),
        name: resource.getNameSync(),
        type: resource.getTypeSync().toStringSync(),
        email: resource.getEmailAddressSync() || '',
        maxUnits: resource.getMaxUnitsSync() ? (resource.getMaxUnitsSync() * 100) + '%' : '100%',
        cost: resource.getCostSync() ? resource.getCostSync().toString() : '0'
      });
    }
    
    // Extract assignments
    const assignments = [];
    const assignmentList = project.getAssignmentsSync();
    const assignmentIterator = assignmentList.iteratorSync();
    
    while (assignmentIterator.hasNextSync()) {
      const assignment = assignmentIterator.nextSync();
      const task = assignment.getTaskSync();
      const resource = assignment.getResourceSync();
      
      if (task && resource) {
        assignments.push({
          taskID: task.getIDSync(),
          taskName: task.getNameSync(),
          resourceID: resource.getIDSync(),
          resourceName: resource.getNameSync(),
          units: assignment.getUnitsSync() ? (assignment.getUnitsSync() * 100) : 100,
          work: assignment.getWorkSync() ? assignment.getWorkSync().toStringSync() : 'Not set',
          start: assignment.getStartSync() ? assignment.getStartSync().toStringSync() : 'Not set',
          finish: assignment.getFinishSync() ? assignment.getFinishSync().toStringSync() : 'Not set'
        });
      }
    }
    
    return {
      properties,
      tasks,
      resources,
      assignments
    };
  } catch (error) {
    console.error('Error parsing project file:', error);
    throw error;
  }
};

// API endpoint to parse project file
app.post('/api/parse', upload.single('projectFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // Initialize Java if not already initialized
    const javaInitialized = await initializeJava();
    if (!javaInitialized) {
      return res.status(500).json({ error: 'Failed to initialize Java bridge' });
    }
    
    // Parse the project file
    const projectData = await parseProjectFile(req.file.path);
    
    // Clean up the uploaded file
    fs.unlinkSync(req.file.path);
    
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
