import React, { useState } from 'react';
import FileUploader from './components/FileUploader';
import ProjectViewer from './components/ProjectViewer';
import './App.css';

const App = () => {
  const [projectData, setProjectData] = useState(null);

  const handleFileUpload = (data) => {
    setProjectData(data);
  };

  return (
    <div className="app-container">
      <header>
        <h1>Microsoft Project Parser</h1>
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
