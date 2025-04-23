/*
 * Aggregated export of visual, layout, and filter definitions.
 * Consumed by pbitGenerator to embed in .pbit package.
 */

const defaultVisuals = require('./defaultVisuals.json');
const pageLayouts = require('./pageLayouts.json');
const pageFilters = require('./pageFilters.json');

module.exports = {
  defaultVisuals,
  pageLayouts,
  pageFilters,
};
