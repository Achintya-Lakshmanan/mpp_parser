const fs = require('fs');
const path = require('path');

const scenariosDir = path.join(__dirname, '../../mock/data');

/**
 * List available mock scenarios (basename without .json).
 * @returns {string[]} array of scenario names
 */
function listScenarios() {
  if (!fs.existsSync(scenariosDir)) return [];
  return fs
    .readdirSync(scenariosDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => path.basename(f, '.json'));
}

/**
 * Load mock JSON data. If inMemory is true, returns parsed object without disk read caching issues.
 * @param {string} name Scenario name (without .json). If omitted, first scenario is used.
 * @param {boolean} [inMemory=false] Whether to load via require (cached) or fs.readFile.
 * @returns {object} project JSON compliant with project-schema.json
 */
function loadMock(name, inMemory = false) {
  const file = path.join(scenariosDir, `${name}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(`Mock scenario file not found: ${file}`);
  }
  if (inMemory) {
    delete require.cache[require.resolve(file)];
    return require(file);
  }
  const str = fs.readFileSync(file, 'utf-8');
  return JSON.parse(str);
}

module.exports = { listScenarios, loadMock, scenariosDir };
