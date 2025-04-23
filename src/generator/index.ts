import fs from 'fs';
import path from 'path';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { generatePbit } from '../generators/pbitGenerator';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { loadProjectJsonStream } = require('../utils/largeJsonLoader');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { validateProjectJson } = require('../services/jsonValidator');

console.log('Power BI Template Generator bootstrap');

(async () => {
  const args = process.argv.slice(2);
  // Quick health/status check for CLI usage
  if (args[0] === '--status') {
    console.log('Power BI generator CLI is operational.');
    process.exit(0);
  }
  if (args.length === 0) {
    console.error(
      'Usage: node dist/generator/index.js <input-json> [output-pbit]\n       node dist/generator/index.js --status',
    );
    process.exit(1);
  }

  const inputJson = path.resolve(args[0]);
  const outputPbit = args[1] ? path.resolve(args[1]) : path.resolve(process.cwd(), 'output.pbit');

  if (!fs.existsSync(inputJson)) {
    console.error(`Input JSON not found: ${inputJson}`);
    process.exit(1);
  }

  console.log(`Streaming and validating JSON from ${inputJson}`);
  try {
    const jsonData = await loadProjectJsonStream(inputJson);
    validateProjectJson(jsonData);
    console.log('JSON validated. Keys:', Object.keys(jsonData));

    console.log(`Generating PBIT to ${outputPbit}`);
    await generatePbit(jsonData, outputPbit);
    console.log('PBIT template generated.');
  } catch (err) {
    console.error('Failed:', err.message || err);
    process.exit(1);
  }
})();
