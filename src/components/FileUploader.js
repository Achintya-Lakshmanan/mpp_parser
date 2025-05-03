import React, { useState } from 'react';
import './FileUploader.css';

// Use window.location.origin to dynamically get the host
const API_BASE_URL = 'http://localhost:3001';
// //process.env.REACT_APP_API_URL || window.location.origin;
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

      const response = await fetch(`${API_BASE_URL}/api/parse`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      onFileUpload(data);
      
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
