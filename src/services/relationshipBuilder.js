/**
 * Relationship and ID‑mapping utilities.
 * Produces metadata compatible with Power BI template generator.
 */

/**
 * Build relationship definitions between tasks, assignments and resources tables.
 * @returns {Array} relationship objects with from/to table+column
 */
function buildCoreRelationships() {
  return [
    {
      fromTable: 'tasks',
      fromCol: 'id',
      toTable: 'assignments',
      toCol: 'taskID',
      crossFilteringBehavior: 'bothDirections',
    },
    {
      fromTable: 'resources',
      fromCol: 'id',
      toTable: 'assignments',
      toCol: 'resourceID',
      crossFilteringBehavior: 'bothDirections',
    },
  ];
}

/**
 * Create mapping dictionaries for quick lookup.
 * @param {Array} table array with `id` field
 * @returns {Map<id, row>}
 */
function buildIdMap(table) {
  const map = new Map();
  for (const row of table) {
    map.set(row.id, row);
  }
  return map;
}

module.exports = { buildCoreRelationships, buildIdMap };
