import React, { useState } from 'react';
import FileUploader from './components/FileUploader';
import ProjectViewer from './components/ProjectViewer';
import './App.css';

const App = () => {
  const [projectData, setProjectData] = useState(null);

  const handleFileUpload = (data) => {
    console.log('File upload data received in App.js:', JSON.stringify(data).substring(0, 500) + '...');
    
    // Make sure we're passing valid data to the ProjectViewer
    if (!data) {
      console.error('No data received from FileUploader');
      return;
    }

    // Check for Docker-specific data structure that might wrap the content
    if (data.result && typeof data.result === 'object') {
      console.log('Found Docker-style wrapped data in "result" property');
      data = data.result;
    }
    
    // Try to locate the tasks array in various possible structures
    let finalData = null;
    
    if (data.projectData && data.projectData.tasks) {
      console.log('Found nested projectData with tasks');
      finalData = data.projectData;
    } else if (data.tasks && Array.isArray(data.tasks)) {
      console.log('Found top-level tasks array');
      finalData = data;
    } else if (data.data && data.data.tasks) {
      console.log('Found tasks inside data property');
      finalData = data.data;
    } else if (typeof data === 'string') {
      // Sometimes Docker APIs return stringified JSON
      try {
        console.log('Got string data, attempting to parse JSON');
        const parsedData = JSON.parse(data);
        return handleFileUpload(parsedData); // Recursively handle the parsed data
      } catch (err) {
        console.error('Failed to parse string data as JSON:', err);
      }
    } else {
      // Last resort - scan all properties for a tasks array
      console.log('Scanning all properties for tasks array');
      for (const key in data) {
        if (data[key] && typeof data[key] === 'object') {
          if (Array.isArray(data[key].tasks)) {
            console.log(`Found tasks array in property "${key}"`);
            finalData = data[key];
            break;
          } else if (data[key].tasks) {
            console.log(`Found tasks in property "${key}"`);
            finalData = data[key];
            break;
          }
        }
      }
      
      // If we still haven't found it, just use the original data
      if (!finalData) {
        console.log('Using original data structure as fallback');
        finalData = data;
      }
    }
    
    console.log('Final data structure being set:', {
      hasProperties: !!(finalData && finalData.properties),
      hasTasks: !!(finalData && finalData.tasks && Array.isArray(finalData.tasks)),
      taskCount: finalData && finalData.tasks ? finalData.tasks.length : 0
    });
    
    setProjectData(finalData);
  };

  return (
    <div className="app-container">
      <header>
        <h1>Microsoft Project to PBIX</h1>
        <p>Upload and parse MPP and MPX files</p>
      </header>

      <main>
        <FileUploader onFileUpload={handleFileUpload} />

        {projectData && <ProjectViewer projectData={projectData} />}
      </main>

      <footer>
        <p>Powered by MPXJ and React</p>
      </footer>
    </div>
  );
};

export default App;
