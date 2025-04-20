const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');

// Mock implementation for testing without Java
const mockParseProjectFile = (filePath) => {
  console.log(`Mock parsing file: ${filePath}`);
  
  // Return mock data based on the sample file
  return {
    properties: {
      name: "B4UBuild Sample Project",
      startDate: "2023-01-02",
      finishDate: "2023-06-30",
      statusDate: "2023-04-20",
      currentDate: "2023-04-20",
      calendar: "Standard",
      defaultTaskType: "Fixed Units",
      taskCount: 25,
      resourceCount: 10
    },
    tasks: [
      {
        id: 1,
        uniqueID: 1,
        name: "Project Initiation",
        outlineLevel: 0,
        summary: true,
        start: "2023-01-02",
        finish: "2023-01-20",
        duration: "15d",
        percentComplete: "100",
        predecessors: ""
      },
      {
        id: 2,
        uniqueID: 2,
        name: "Define Project Scope",
        outlineLevel: 1,
        summary: false,
        start: "2023-01-02",
        finish: "2023-01-06",
        duration: "5d",
        percentComplete: "100",
        predecessors: ""
      },
      {
        id: 3,
        uniqueID: 3,
        name: "Secure Project Funding",
        outlineLevel: 1,
        summary: false,
        start: "2023-01-09",
        finish: "2023-01-13",
        duration: "5d",
        percentComplete: "100",
        predecessors: "2"
      },
      {
        id: 4,
        uniqueID: 4,
        name: "Project Kickoff Meeting",
        outlineLevel: 1,
        summary: false,
        start: "2023-01-16",
        finish: "2023-01-20",
        duration: "5d",
        percentComplete: "100",
        predecessors: "3"
      },
      {
        id: 5,
        uniqueID: 5,
        name: "Planning Phase",
        outlineLevel: 0,
        summary: true,
        start: "2023-01-23",
        finish: "2023-02-17",
        duration: "20d",
        percentComplete: "100",
        predecessors: "1"
      },
      {
        id: 6,
        uniqueID: 6,
        name: "Site Analysis",
        outlineLevel: 1,
        summary: false,
        start: "2023-01-23",
        finish: "2023-01-27",
        duration: "5d",
        percentComplete: "100",
        predecessors: "4"
      }
    ],
    resources: [
      {
        id: 1,
        uniqueID: 1,
        name: "Project Manager",
        type: "WORK",
        email: "pm@example.com",
        maxUnits: "100%",
        cost: "75.00"
      },
      {
        id: 2,
        uniqueID: 2,
        name: "Architect",
        type: "WORK",
        email: "architect@example.com",
        maxUnits: "100%",
        cost: "65.00"
      },
      {
        id: 3,
        uniqueID: 3,
        name: "Civil Engineer",
        type: "WORK",
        email: "civil@example.com",
        maxUnits: "100%",
        cost: "60.00"
      }
    ],
    assignments: [
      {
        taskID: 2,
        taskName: "Define Project Scope",
        resourceID: 1,
        resourceName: "Project Manager",
        units: 100,
        work: "40h",
        start: "2023-01-02",
        finish: "2023-01-06"
      },
      {
        taskID: 3,
        taskName: "Secure Project Funding",
        resourceID: 1,
        resourceName: "Project Manager",
        units: 100,
        work: "40h",
        start: "2023-01-09",
        finish: "2023-01-13"
      },
      {
        taskID: 6,
        taskName: "Site Analysis",
        resourceID: 2,
        resourceName: "Architect",
        units: 100,
        work: "40h",
        start: "2023-01-23",
        finish: "2023-01-27"
      }
    ]
  };
};

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

// API endpoint to parse project file
app.post('/api/parse', upload.single('projectFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // Use mock implementation for testing
    const projectData = mockParseProjectFile(req.file.path);
    
    // Clean up the uploaded file (optional for testing)
    // fs.unlinkSync(req.file.path);
    
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
