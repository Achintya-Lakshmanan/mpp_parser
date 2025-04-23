const _ = require('lodash');

/**
 * Convert project JSON into simple table arrays suitable for Power BI ingestion.
 * Accepts projectData that may be streaming iterators to avoid high memory usage.
 *
 * @param {object} projectData
 * @returns {{tasks: object[], resources: object[], assignments: object[], properties: object[]}}
 */
function mapProjectData(projectData) {
  if (!projectData) {
    throw new Error('No project data provided');
  }

  const tasks = [];
  for (const t of projectData.tasks) {
    tasks.push({
      id: t.id,
      uniqueID: t.uniqueID,
      name: t.name,
      outlineNumber: t.outlineNumber,
      outlineLevel: t.outlineLevel,
      start: t.start,
      finish: t.finish,
      duration: t.duration,
      work: t.work,
      percentComplete: t.percentComplete,
      summary: t.summary,
      type: t.type,
      constraint: t.constraint,
      predecessors: t.predecessors,
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
    });
  }

  const assignments = [];
  for (const a of projectData.assignments) {
    assignments.push({
      taskID: a.taskID,
      resourceID: a.resourceID,
      units: a.units,
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
