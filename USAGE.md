# Microsoft Project Parser - Usage Guide

## Quick Start

This guide will help you get started with the Microsoft Project Parser application.

### Installation

1. Clone or download the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Start the application in test mode:
   ```
   npm run test
   ```
   This will start both the frontend and a mock backend server.

### Using the Application

1. Open your browser and navigate to http://localhost:3000
2. Click "Choose a file" to select your Microsoft Project file (.mpp or .mpx)
3. Click "Parse Project File" to upload and process the file
4. View the parsed project data in the tabbed interface:
   - Tasks: View all project tasks with their details
   - Resources: View all resources assigned to the project
   - Assignments: View task-resource assignments
   - Properties: View general project properties

## Integration Guide

### Integrating with Your React Application

To integrate this parser into your existing React application:

1. Copy the components from `src/components/` to your project
2. Set up the backend server from `src/backend/`
3. Use the `FileUploader` component to handle file uploads
4. Use the `ProjectViewer` component to display parsed data

Example:
```jsx
import React, { useState } from 'react';
import FileUploader from './components/FileUploader';
import ProjectViewer from './components/ProjectViewer';

function YourApp() {
  const [projectData, setProjectData] = useState(null);

  const handleFileUpload = (data) => {
    setProjectData(data);
    // Do something with the parsed data in your application
  };

  return (
    <div>
      <FileUploader onFileUpload={handleFileUpload} />
      {projectData && <ProjectViewer projectData={projectData} />}
    </div>
  );
}
```

### Using the Backend API Separately

If you want to use just the backend API:

1. Start the server:
   ```
   npm run server
   ```

2. Make POST requests to `http://localhost:3001/api/parse` with your MPP/MPX file in a form with field name 'projectFile'

3. Process the JSON response in your application

## Customization Options

### Styling

The application uses modular CSS files that can be easily customized:

- `src/App.css`: Main application styles
- `src/components/FileUploader.css`: File upload component styles
- `src/components/ProjectViewer.css`: Project data visualization styles

### Backend Configuration

You can modify the backend server in `src/backend/server.js`:

- Change the port number (default: 3001)
- Modify the file upload directory
- Customize the data extraction logic

## Troubleshooting

If you encounter issues:

1. Check that your MPP/MPX file is valid and not corrupted
2. Ensure all dependencies are properly installed
3. Check the console for error messages
4. Verify that the backend server is running

For more detailed information, refer to the README.md file.
