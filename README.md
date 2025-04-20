# Microsoft Project Parser - Documentation

## Overview
This application provides a React-based solution for parsing Microsoft Project files (.mpp and .mpx formats). It consists of a React frontend for file uploading and data visualization, and a Node.js backend that uses the MPXJ Java library to parse the project files.

## Architecture
The solution is built with the following components:

1. **React Frontend**
   - File upload component
   - Project data visualization with tabs for tasks, resources, assignments, and properties
   - Responsive design for both desktop and mobile

2. **Node.js Backend**
   - REST API for file processing
   - Integration with MPXJ Java library via node-java-maven
   - Extraction of project data including tasks, resources, timelines, and dependencies

3. **MPXJ Integration**
   - Java-based library for parsing Microsoft Project files
   - Accessed through Node.js using Java bridge

## Installation

### Prerequisites
- Node.js (v14 or higher)
- Java Runtime Environment (JRE) 8 or higher

### Setup Instructions

1. Clone the repository or extract the provided files
```
git clone <repository-url>
cd mpp_parser
```

2. Install dependencies
```
npm install
```

3. Ensure Java libraries are in place
```
mkdir -p src/backend/lib
# Download MPXJ and POI libraries if not already present
```

## Usage

### Development Mode

1. Start the backend server
```
npm run server
```

2. In a separate terminal, start the frontend development server
```
npm run start
```

3. Access the application at http://localhost:3000

### Testing Mode

For testing without Java integration:
```
npm run test
```

This will start both the frontend and a mock backend server.

### Production Build

1. Build the frontend
```
npm run build
```

2. The compiled files will be available in the `dist` directory

## API Reference

### POST /api/parse
Parses an uploaded Microsoft Project file.

**Request:**
- Content-Type: multipart/form-data
- Body: Form data with 'projectFile' field containing the .mpp or .mpx file

**Response:**
```json
{
  "properties": {
    "name": "Project Name",
    "startDate": "2023-01-01",
    "finishDate": "2023-12-31",
    "statusDate": "2023-04-15",
    "currentDate": "2023-04-15",
    "calendar": "Standard",
    "defaultTaskType": "Fixed Units",
    "taskCount": 25,
    "resourceCount": 10
  },
  "tasks": [
    {
      "id": 1,
      "uniqueID": 1,
      "name": "Task Name",
      "outlineLevel": 0,
      "summary": true,
      "start": "2023-01-01",
      "finish": "2023-01-15",
      "duration": "15d",
      "percentComplete": "50",
      "predecessors": ""
    }
  ],
  "resources": [
    {
      "id": 1,
      "uniqueID": 1,
      "name": "Resource Name",
      "type": "WORK",
      "email": "resource@example.com",
      "maxUnits": "100%",
      "cost": "75.00"
    }
  ],
  "assignments": [
    {
      "taskID": 1,
      "taskName": "Task Name",
      "resourceID": 1,
      "resourceName": "Resource Name",
      "units": 100,
      "work": "40h",
      "start": "2023-01-01",
      "finish": "2023-01-15"
    }
  ]
}
```

## Component Reference

### FileUploader
Handles file selection and uploading to the backend.

**Props:**
- `onFileUpload`: Function to handle the parsed project data

### ProjectViewer
Displays the parsed project data in a tabbed interface.

**Props:**
- `projectData`: Object containing the parsed project data

## Customization

### Styling
The application uses CSS files for styling. You can modify the following files to customize the appearance:
- `src/App.css`: Main application styles
- `src/components/FileUploader.css`: File upload component styles
- `src/components/ProjectViewer.css`: Project data visualization styles

### Backend Configuration
The backend server configuration can be modified in `src/backend/server.js`.

## Troubleshooting

### Common Issues

1. **Java Bridge Initialization Failure**
   - Ensure Java is installed and properly configured
   - Check that the MPXJ and POI JAR files are in the correct location
   - https://github.com/joniles/mpxj
   - https://poi.apache.org/download.html

2. **File Upload Errors**
   - Verify that the file is a valid .mpp or .mpx format
   - Check server logs for detailed error messages

3. **Frontend Build Issues**
   - Ensure all dependencies are installed
   - Check webpack configuration in webpack.config.js

## Integration with Larger Applications

To integrate this parser into a larger application:

1. **As a Component**
   - Import the React components into your existing React application
   - Pass the necessary props and handle the parsed data

2. **As a Service**
   - Use the backend as a standalone service
   - Make API calls to the parser endpoint from your application

## License
This project is licensed under the ISC License.
