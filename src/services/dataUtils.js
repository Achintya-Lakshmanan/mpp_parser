/**
 * Common data‑formatting and validation helpers for transformed tables.
 */

/**
 * Convert any dateish value (string, Date) to ISO‐8601 date string (YYYY‑MM‑DD).
 * Returns null if invalid.
 * @param {string|Date|null|undefined} v
 */
function formatDate(v) {
  if (!v) return null;
  const d = typeof v === 'string' ? new Date(v) : v;
  if (Number.isNaN(d?.getTime?.())) return null;
  return d.toISOString().split('T')[0];
}

/**
 * Ensure numeric value (float). Null if not parseable.
 * @param {any} v
 */
function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Ensure integer value (ID).
 * @param {any} v
 */
function toInt(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Basic table validation – checks required columns are non‑null.
 * @param {Array} table
 * @param {string[]} requiredCols
 */
function validateTable(table, requiredCols) {
  for (const row of table) {
    for (const c of requiredCols) {
      if (row[c] === null || row[c] === undefined) {
        throw new Error(`Validation failed – column ${c} missing/null in row ${JSON.stringify(row)}`);
      }
    }
  }
}

module.exports = { formatDate, toNumber, toInt, validateTable };
