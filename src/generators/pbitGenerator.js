const fs = require('fs-extra');
const path = require('path');
const JSZip = require('jszip');

/**
 * Generate a basic .pbit (Power BI template) file from project data JSON.
 * This is a minimal placeholder implementation: it packages the raw JSON and a README into a zip
 * with .pbit extension. Real-world templates require additional layout and DataModel files.
 *
 * @param {object} projectData - Parsed project JSON.
 * @param {string} outputPath - Absolute path where the .pbit file will be written.
 */
async function generatePbit(projectData, outputPath) {
  const zip = new JSZip();
  zip.file('ProjectData.json', JSON.stringify(projectData, null, 2));
  zip.file('README.txt', 'This .pbit was generated automatically from project JSON.');

  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  await fs.ensureDir(path.dirname(outputPath));
  await fs.writeFile(outputPath, buffer);
}

module.exports = { generatePbit };
