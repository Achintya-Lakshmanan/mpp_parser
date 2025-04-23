/**
 * Utilities for transforming hierarchical task structures into flat tables
 * suitable for Power BI.
 */

/**
 * Recursively flatten a task hierarchy. Adds `parentId` and `path` fields to maintain
 * hierarchical information.
 *
 * @param {Array} tasks Array of task objects which may include a `children` array.
 * @param {string|number|null} parentId Parent task ID or null for root‐level tasks.
 * @param {string} parentPath Outline path prefix used to build a breadcrumb path.
 * @returns {Array} flat list of tasks
 */
function flattenTasks(tasks = [], parentId = null, parentPath = '') {
  const flat = [];

  for (const t of tasks) {
    const currentPath = parentPath ? `${parentPath}/${t.id}` : String(t.id);
    // Clone task to avoid mutating original & strip children
    const { children, subTasks, ...rest } = t;
    const record = {
      ...rest,
      parentId,
      path: currentPath,
    };
    flat.push(record);

    const kids = children || subTasks || [];
    if (Array.isArray(kids) && kids.length) {
      flat.push(...flattenTasks(kids, t.id, currentPath));
    }
  }

  return flat;
}

module.exports = { flattenTasks };
