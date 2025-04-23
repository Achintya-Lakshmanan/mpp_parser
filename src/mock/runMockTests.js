/* eslint-disable no-console */
const { loadMock, listScenarios } = require('./mockLoader');
const { generatePbit } = require('../generators/pbitGenerator');
const path = require('path');
const fs = require('fs');

(async () => {
  const scenarios = listScenarios();
  if (scenarios.length === 0) {
    console.error('No mock scenarios found');
    process.exit(1);
  }
  console.log('Running template generation tests for scenarios:', scenarios.join(', '));

  for (const name of scenarios) {
    try {
      const data = loadMock(name, true);
      const outPath = path.join(__dirname, `../../mock/output/${name}.pbit`);
      await generatePbit(data, outPath);
      const size = fs.statSync(outPath).size;
      if (size === 0) throw new Error('File empty');
      console.log(`✅  ${name} -> ${path.relative(process.cwd(), outPath)} (${size} bytes)`);
    } catch (err) {
      console.error(`❌  Scenario ${name} failed:`, err.message || err);
      process.exitCode = 1;
    }
  }
})();
