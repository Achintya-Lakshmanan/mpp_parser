const fs = require('fs-extra');
const path = require('path');
const JSZip = require('jszip');
const { mapProjectData } = require('./dataMapper');
const daxDefs = require('./daxDefinitions');

/**
 * Generate a basic .pbit (Power BI template) file from project data JSON.
 * This is a minimal placeholder implementation: it packages the raw JSON and a README into a zip
 * with .pbit extension. Real-world templates require additional layout and DataModel files.
 *
 * @param {object} projectData - Parsed project JSON.
 * @param {string} outputPath - Absolute path where the .pbit file will be written.
 */
async function generatePbit(projectData, outputPath) {
  const mapped = mapProjectData(projectData);

  const zip = new JSZip();
  // Simple tables JSON
  zip.file('tables/tasks.json', JSON.stringify(mapped.tasks));
  zip.file('tables/resources.json', JSON.stringify(mapped.resources));
  zip.file('tables/assignments.json', JSON.stringify(mapped.assignments));
  zip.file('tables/properties.json', JSON.stringify(mapped.properties));

  // Relationships placeholder (tasks.id -> assignments.taskID etc.)
  const relationships = [
    { fromTable: 'tasks', fromCol: 'id', toTable: 'assignments', toCol: 'taskID' },
    { fromTable: 'resources', fromCol: 'id', toTable: 'assignments', toCol: 'resourceID' },
  ];
  zip.file('relationships.json', JSON.stringify(relationships));

  // DAX measures
  zip.file('dax/measures.json', JSON.stringify(daxDefs));

  zip.file('README.txt', 'Auto‑generated minimal Power BI template. Replace with real model.');

  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  await fs.ensureDir(path.dirname(outputPath));
  await fs.writeFile(outputPath, buffer);
}

module.exports = { generatePbit };
