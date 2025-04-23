import React, { useState } from 'react';
import './FileUploader.css';

const FileUploader = ({ onFileUpload }) => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      // Check if file is MPP or MPX
      const fileExtension = selectedFile.name.split('.').pop().toLowerCase();
      if (fileExtension !== 'mpp' && fileExtension !== 'mpx') {
        setError('Please select a valid Microsoft Project file (.mpp or .mpx)');
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

    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('projectFile', file);

      const response = await fetch('http://localhost:3001/api/parse', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      onFileUpload(data);
    } catch (err) {
      setError(`Error uploading file: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="file-uploader">
      <h2>Upload Microsoft Project File</h2>
      <form onSubmit={handleSubmit}>
        <div className="file-input-container">
          <input type="file" onChange={handleFileChange} accept=".mpp,.mpx" id="file-input" />
          <label htmlFor="file-input" className="file-input-label">
            {file ? file.name : 'Choose a file'}
          </label>
        </div>

        {error && <div className="error-message">{error}</div>}

        <button type="submit" className="upload-button" disabled={!file || loading}>
          {loading ? 'Processing...' : 'Parse Project File'}
        </button>
      </form>
    </div>
  );
};

export default FileUploader;
