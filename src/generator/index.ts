import fs from 'fs';
import path from 'path';

console.log('Power BI Template Generator bootstrap');
// Placeholder implementation – will iterate through JSON files and create .pbit

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node dist/generator/index.js <input-json> [output-pbit]');
  process.exit(1);
}

const inputJson = path.resolve(args[0]);
const outputPbit = args[1] ? path.resolve(args[1]) : path.resolve(process.cwd(), 'output.pbit');

if (!fs.existsSync(inputJson)) {
  console.error(`Input JSON not found: ${inputJson}`);
  process.exit(1);
}

console.log(`Reading JSON from ${inputJson}`);
const jsonData = JSON.parse(fs.readFileSync(inputJson, 'utf-8'));
console.log('JSON keys:', Object.keys(jsonData));

// TODO: Transform and package into .pbit
console.log(`Will write PBIT to ${outputPbit}`);
