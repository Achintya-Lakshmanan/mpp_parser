import React, { useState } from 'react';
import './FileUploader.css';

// Get the API URL from the runtime configuration
const API_BASE_URL = window.MPP_CONFIG ? window.MPP_CONFIG.API_URL : window.location.origin;

console.log('FileUploader using API_BASE_URL:', API_BASE_URL);

const FileUploader = ({ onFileUpload }) => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [startDate, setStartDate] = useState('');
  const [pbitFile, setPbitFile] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      const fileExtension = selectedFile.name.split('.').pop().toLowerCase();
      if (fileExtension !== 'mpp' && fileExtension !== 'mpx' && fileExtension !== 'mpt' && fileExtension !== 'xer') {
        setError('Please select a valid Microsoft Project file (.mpp, .mpx, .mpt, .xer)');
        setFile(null);
        return;
      }
      setFile(selectedFile);
      setError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!file) {
      setError('Please select a file first');
      return;
    }

    if (!startDate) {
      setError('Please enter a start date');
      return;
    }

    setLoading(true);
    setError('');
    setPbitFile(null);

    try {
      const formData = new FormData();
      formData.append('projectFile', file);
      formData.append('startDate', startDate);

      console.log(`Submitting to API URL: ${API_BASE_URL}/api/parse`);
      
      const response = await fetch(`${API_BASE_URL}/api/parse`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Raw API response:', JSON.stringify(data));
      
      // For debugging - log the data structure before passing it up
      console.log('API response structure:', {
        hasProjectData: !!data.projectData,
        hasTasks: !!(data.tasks || (data.projectData && data.projectData.tasks)),
        hasData: !!data.data,
        topLevelKeys: Object.keys(data)
      });
      
      // Handle Docker behavior: If we receive a success message but no project data
      if (data.message && data.message.includes("successfully") && !data.tasks && !data.projectData) {
        console.log('Received success message without data - getting data from project-data.json');
        try {
          // Make a second request to fetch the project data JSON file
          const dataResponse = await fetch(`${API_BASE_URL}/api/data`, {
            method: 'GET',
          });
          
          if (!dataResponse.ok) {
            throw new Error('Failed to fetch project data');
          }
          
          const projectData = await dataResponse.json();
          console.log('Retrieved project data from secondary request:', projectData);
          onFileUpload(projectData);
        } catch (fetchError) {
          console.error('Error fetching project data:', fetchError);
          // If secondary request fails, still pass through the original data
          onFileUpload(data);
        }
      } else {
        // Normal case - API returned the data directly
        onFileUpload(data);
      }
      
      // Extract PBIT filename from path
      if (data.files && data.files.pbit) {
        const pbitPath = data.files.pbit;
        const pbitFilename = pbitPath.split('\\').pop();
        setPbitFile(pbitFilename);
      }
    } catch (err) {
      setError(`Error uploading file: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!pbitFile) return;
    
    try {
      // Extract filename from the full path
      const filename = pbitFile.split('/').pop();
      if (!filename) {
        throw new Error('Could not extract filename from path');
      }
      // Use only the filename in the download URL
      const response = await fetch(`${API_BASE_URL}/api/download/${filename}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/octet-stream',
        },
      });

      if (!response.ok) {
        throw new Error('Download failed');
      }

      // Create a blob from the response
      const blob = await response.blob();
      
      // Create a download link and click it
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = pbitFile;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(`Error downloading file: ${err.message}`);
    }
  };

  return (
    <div className="file-uploader">
      <form onSubmit={handleSubmit}>
        <div className="file-input-container">
          <input 
            type="file" 
            onChange={handleFileChange} 
            accept=".mpp,.mpx,.mpt,.xer" 
            id="file-input" 
          />
          <label htmlFor="file-input" className="file-input-label">
            {file ? file.name : 'Choose a file'}
          </label>
        </div>

        <div>
          <label htmlFor="start-date">Start Date:</label>
          <input
            type="date"
            id="start-date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>

        {error && <div className="error-message">{error}</div>}

        <button type="submit" className="upload-button" disabled={!file || loading}>
          {loading ? 'Processing...' : 'Convert to PBIT'}
        </button>

        {pbitFile && (
          <button type="button" className="download-button" onClick={handleDownload}>
            Download PBIT File
          </button>
        )}
      </form>
    </div>
  );
};

export default FileUploader;
