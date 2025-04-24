const _ = require('lodash');

/**
 * Convert project JSON into simple table arrays suitable for Power BI ingestion.
 * Accepts projectData that may be streaming iterators to avoid high memory usage.
 *
 * @param {object} projectData
 * @returns {{tasks: object[], resources: object[], assignments: object[], properties: object[]}}
 */
function mapProjectData(projectData) {
  if (!projectData || !projectData.tasks || !projectData.resources || !projectData.assignments) {
    // Added more checks for core data arrays
    throw new Error('Project data is missing tasks, resources, or assignments');
  }

  // Pre-process for lookups
  const taskMap = new Map(projectData.tasks.map(t => [t.id, t]));
  const resourceMap = new Map(projectData.resources.map(r => [r.id, r]));
  const assignmentsByTask = _.groupBy(projectData.assignments, 'taskID');

  const tasks = [];
  for (const t of projectData.tasks) {
    // Determine status
    let status = 'Not Started';
    if (t.percentComplete > 0 && t.percentComplete < 100) {
      status = 'In Progress';
    } else if (t.percentComplete === 100) {
      status = 'Completed';
    }

    // Get resource names for the task
    const taskAssignments = assignmentsByTask[t.id] || [];
    const resourceNames = taskAssignments
        .map(a => resourceMap.get(a.resourceID)?.name)
        .filter(name => !!name) // Filter out undefined names if resource not found
        .join(', ');

    tasks.push({
      id: t.id,
      uniqueID: t.uniqueID,
      name: t.name,
      outlineNumber: t.outlineNumber,
      outlineLevel: t.outlineLevel,
      start: t.start,
      finish: t.finish,
      duration: t.duration,
      work: t.work, // Original task work
      percentComplete: t.percentComplete,
      summary: t.summary,
      type: t.type,
      constraint: t.constraint,
      predecessors: t.predecessors,
      status: status, // Added status
      resourceNames: resourceNames, // Added resource names string
    });
  }

  const resources = [];
  for (const r of projectData.resources) {
    resources.push({
      id: r.id,
      uniqueID: r.uniqueID,
      name: r.name,
      type: r.type,
      maxUnits: r.maxUnits,
      // Attempt to add cost - defaults if not present
      cost: r.cost || 0, // Added cost (assuming 'cost' field exists, else 0)
      standardRate: r.standardRate || 0,
      overtimeRate: r.overtimeRate || 0,
    });
  }

  const assignments = [];
  for (const a of projectData.assignments) {
    const task = taskMap.get(a.taskID);
    const resource = resourceMap.get(a.resourceID);
    assignments.push({
      taskID: a.taskID,
      resourceID: a.resourceID,
      units: a.units,
      taskName: task ? task.name : 'Unknown Task',       // Added task name
      resourceName: resource ? resource.name : 'Unknown Resource', // Added resource name
      work: a.work || 0, // Added assignment work (assuming 'work' field exists, else 0)
    });
  }

  const propertiesArray = [];
  if (projectData.properties && typeof projectData.properties === 'object') {
    for (const [key, value] of Object.entries(projectData.properties)) {
      propertiesArray.push({ key, value });
    }
  }

  return { tasks, resources, assignments, properties: propertiesArray };
}

module.exports = { mapProjectData };
