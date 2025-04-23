const _ = require('lodash');

/**
 * Convert project JSON into simple table arrays suitable for Power BI ingestion.
 * This does NOT attempt to replicate full PBIX data model; it simply prepares
 * flat arrays for Tasks, Resources, Assignments and Properties that can later
 * be turned into model tables.
 *
 * @param {object} projectData Validated project JSON
 * @returns {{tasks: object[], resources: object[], assignments: object[], properties: object[]}}
 */
function mapProjectData(projectData) {
  if (!projectData) {
    throw new Error('No project data provided');
  }

  const tasks = (projectData.tasks || []).map((t) => ({
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
  }));

  const resources = (projectData.resources || []).map((r) => ({
    id: r.id,
    uniqueID: r.uniqueID,
    name: r.name,
    type: r.type,
    maxUnits: r.maxUnits,
  }));

  const assignments = (projectData.assignments || []).map((a) => ({
    taskID: a.taskID,
    resourceID: a.resourceID,
    units: a.units,
  }));

  // Flatten properties into key/value rows for easier consumption
  const propertiesArray = [];
  if (projectData.properties && typeof projectData.properties === 'object') {
    for (const [key, value] of Object.entries(projectData.properties)) {
      propertiesArray.push({ key, value });
    }
  }

  return { tasks, resources, assignments, properties: propertiesArray };
}

module.exports = { mapProjectData };
