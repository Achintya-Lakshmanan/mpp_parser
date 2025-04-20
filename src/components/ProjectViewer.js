import React, { useState } from 'react';
import './ProjectViewer.css';

const ProjectViewer = ({ projectData }) => {
  const [activeTab, setActiveTab] = useState('tasks');
  
  if (!projectData) {
    return <div className="project-viewer-empty">No project data available</div>;
  }

  const { tasks, resources, assignments, properties } = projectData;

  const renderTasks = () => {
    if (!tasks || tasks.length === 0) {
      return <p>No tasks found in this project.</p>;
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
              <th>Predecessors</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map(task => (
              <tr key={task.id} className={task.summary ? 'summary-task' : ''}>
                <td>{task.id}</td>
                <td className="task-name" style={{ paddingLeft: `${task.outlineLevel * 20}px` }}>
                  {task.name}
                </td>
                <td>{task.start}</td>
                <td>{task.finish}</td>
                <td>{task.duration}</td>
                <td>{task.percentComplete}%</td>
                <td>{task.predecessors}</td>
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
              <th>Email</th>
              <th>Max Units</th>
              <th>Cost</th>
            </tr>
          </thead>
          <tbody>
            {resources.map(resource => (
              <tr key={resource.id}>
                <td>{resource.id}</td>
                <td>{resource.name}</td>
                <td>{resource.type}</td>
                <td>{resource.email}</td>
                <td>{resource.maxUnits}</td>
                <td>{resource.cost}</td>
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
              <th>Start</th>
              <th>Finish</th>
            </tr>
          </thead>
          <tbody>
            {assignments.map((assignment, index) => (
              <tr key={index}>
                <td>{assignment.taskName}</td>
                <td>{assignment.resourceName}</td>
                <td>{assignment.units}%</td>
                <td>{assignment.work}</td>
                <td>{assignment.start}</td>
                <td>{assignment.finish}</td>
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
