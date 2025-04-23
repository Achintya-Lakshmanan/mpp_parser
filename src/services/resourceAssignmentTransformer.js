/**
 * Resource & Assignment transformation helpers.
 * Converts raw project JSON arrays into flat Power BI‑ready tables.
 */

/**
 * Transform resources array to Power BI table definition.
 * @param {Array} resources raw project resources
 * @returns {Array}
 */
function transformResources(resources = []) {
  return resources.map((r) => ({
    id: r.id,
    uniqueID: r.uniqueID,
    name: r.name,
    type: r.type,
    email: r.email ?? null,
    maxUnits: r.maxUnits ?? null,
    cost: r.cost ?? null,
  }));
}

/**
 * Transform assignments array to Power BI table definition.
 * Adds composite primary key and preserves references.
 * @param {Array} assignments raw project assignments
 * @returns {Array}
 */
function transformAssignments(assignments = []) {
  return assignments.map((a, idx) => ({
    id: idx + 1, // synthetic PK
    taskID: a.taskID,
    taskUniqueID: a.taskUniqueID ?? null,
    taskName: a.taskName ?? null,
    resourceID: a.resourceID,
    resourceUniqueID: a.resourceUniqueID ?? null,
    resourceName: a.resourceName ?? null,
    units: a.units ?? null,
    work: a.work ?? null,
    start: a.start ?? null,
    finish: a.finish ?? null,
  }));
}

module.exports = { transformResources, transformAssignments };
