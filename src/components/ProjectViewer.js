import React, { useState, useEffect } from 'react';
import './ProjectViewer.css';

const ProjectViewer = ({ projectData }) => {
  const [activeTab, setActiveTab] = useState('tasks');
  const [dataStructure, setDataStructure] = useState({});

  // Enhanced debugging for Docker environments
  useEffect(() => {
    if (!projectData) {
      console.log('ProjectViewer: No project data received');
      return;
    }

    // Log detailed information about the data structure
    const structure = {
      type: typeof projectData,
      hasProjectData: !!(projectData.projectData),
      hasData: !!(projectData.data),
      topLevelKeys: Object.keys(projectData),
      hasTasks: !!(projectData.tasks && Array.isArray(projectData.tasks)),
      taskCount: projectData.tasks && Array.isArray(projectData.tasks) ? projectData.tasks.length : 0,
    };
    
    console.log('ProjectViewer data structure:', structure);
    console.log('First 500 chars of projectData:', JSON.stringify(projectData).substring(0, 500) + '...');
    
    setDataStructure(structure);
  }, [projectData]);

  if (!projectData) {
    return <div className="project-viewer-empty">No project data available</div>;
  }

  // More robust destructuring for Docker environments
  let tasks = [], resources = [], assignments = [], properties = {};
  
  try {
    // Try multiple possible data structures
    if (projectData.tasks && Array.isArray(projectData.tasks)) {
      console.log('Using top-level tasks array with', projectData.tasks.length, 'tasks');
      tasks = projectData.tasks;
      resources = projectData.resources || [];
      assignments = projectData.assignments || [];
      properties = projectData.properties || {};
    } else if (projectData.projectData && projectData.projectData.tasks) {
      console.log('Using nested projectData.tasks with', projectData.projectData.tasks.length, 'tasks');
      tasks = projectData.projectData.tasks;
      resources = projectData.projectData.resources || [];
      assignments = projectData.projectData.assignments || [];
      properties = projectData.projectData.properties || {};
    } else if (projectData.data && projectData.data.tasks) {
      console.log('Using data.tasks with', projectData.data.tasks.length, 'tasks');
      tasks = projectData.data.tasks;
      resources = projectData.data.resources || [];
      assignments = projectData.data.assignments || [];
      properties = projectData.data.properties || {};
    } else if (Array.isArray(projectData)) {
      // Handle case where the entire projectData is an array of tasks
      console.log('ProjectData is an array with', projectData.length, 'items');
      if (projectData.length > 0 && (projectData[0].id !== undefined || projectData[0].name)) {
        console.log('Array appears to be tasks');
        tasks = projectData;
      }
    } else {
      // Last resort - scan properties for tasks array
      console.log('Scanning for tasks array in properties');
      for (const key in projectData) {
        if (projectData[key] && Array.isArray(projectData[key]) && 
            projectData[key].length > 0 && 
            projectData[key][0] && 
            (projectData[key][0].id !== undefined || projectData[key][0].name)) {
          console.log(`Found potential tasks array in property "${key}" with ${projectData[key].length} items`);
          tasks = projectData[key];
          break;
        }
      }
      
      // Special case: the data might be the success message while the data was saved to a file
      if (tasks.length === 0 && projectData.message && projectData.message.includes("successfully")) {
        console.log('Found success message - tasks may be available via /api/data endpoint');
      }
    }
  } catch (err) {
    console.error('Error extracting data structure:', err);
  }

  const renderTasks = () => {
    if (!tasks || tasks.length === 0) {
      console.log('No tasks found in extracted data structure');
      return (
        <div>
          <p>No tasks found in this project.</p>
          <div className="debug-info" style={{fontSize: '12px', margin: '20px 0', padding: '10px', backgroundColor: '#f5f5f5', border: '1px solid #ddd'}}>
            <h4>Debug Information:</h4>
            <pre>{JSON.stringify(dataStructure, null, 2)}</pre>
          </div>
        </div>
      );
    }

    return (
      <div className="tasks-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Start Date</th>
              <th>Finish Date</th>
              <th>Duration</th>
              <th>% Complete</th>
              <th>Resources</th>
              <th>Predecessors</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id} className={task.summary ? 'summary-task' : ''}>
                <td>{task.id}</td>
                <td className="task-name" style={{ paddingLeft: `${task.outlineLevel * 20}px` }}>
                  {task.name}
                </td>
                <td>{task.start}</td>
                <td>{task.finish}</td>
                <td>{task.duration}</td>
                <td>{task.percentComplete}%</td>
                <td>{task.resourceNames}</td>
                <td>
                  {Array.isArray(task.predecessors)
                    ? task.predecessors.map((pred, i) => (
                        <div key={i}>
                          {pred.taskName} ({pred.type}
                          {pred.lag !== '0.0d' ? ', ' + pred.lag : ''})
                          {i < task.predecessors.length - 1 ? ', ' : ''}
                        </div>
                      ))
                    : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderResources = () => {
    if (!resources || resources.length === 0) {
      return <p>No resources found in this project.</p>;
    }

    return (
      <div className="resources-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Type</th>
              <th>Max Units</th>
            </tr>
          </thead>
          <tbody>
            {resources.map((resource) => (
              <tr key={resource.id}>
                <td>{resource.id}</td>
                <td>{resource.name}</td>
                <td>{resource.type}</td>
                <td>{resource.maxUnits}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderAssignments = () => {
    if (!assignments || assignments.length === 0) {
      return <p>No assignments found in this project.</p>;
    }

    return (
      <div className="assignments-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Task</th>
              <th>Resource</th>
              <th>Units</th>
              <th>Work</th>
            </tr>
          </thead>
          <tbody>
            {assignments.map((assignment, index) => (
              <tr key={index}>
                <td>{assignment.taskName}</td>
                <td>{assignment.resourceName}</td>
                <td>{assignment.units}%</td>
                <td>{assignment.work}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderProperties = () => {
    if (!properties || Object.keys(properties).length === 0) {
      return <p>No project properties found.</p>;
    }

    return (
      <div className="properties-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Property</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(properties).map(([key, value]) => (
              <tr key={key}>
                <td>{key}</td>
                <td>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="project-viewer">
      <h2>Project Data</h2>

      <div className="tabs">
        <button
          className={activeTab === 'tasks' ? 'active' : ''}
          onClick={() => setActiveTab('tasks')}
        >
          Tasks
        </button>
        <button
          className={activeTab === 'resources' ? 'active' : ''}
          onClick={() => setActiveTab('resources')}
        >
          Resources
        </button>
        <button
          className={activeTab === 'assignments' ? 'active' : ''}
          onClick={() => setActiveTab('assignments')}
        >
          Assignments
        </button>
        <button
          className={activeTab === 'properties' ? 'active' : ''}
          onClick={() => setActiveTab('properties')}
        >
          Properties
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'tasks' && renderTasks()}
        {activeTab === 'resources' && renderResources()}
        {activeTab === 'assignments' && renderAssignments()}
        {activeTab === 'properties' && renderProperties()}
      </div>
    </div>
  );
};

export default ProjectViewer;
