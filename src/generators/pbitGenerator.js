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
  try {
    const mapped = mapProjectData(projectData);
    validateMappedData(mapped);

    const zip = new JSZip();
    // Mandatory parts for a valid PBIT/PBIX container
    // Version file tells Power BI which schema version the package conforms to.
    // Use a Desktop build number that is known to be accepted. Any non‑empty string works, but
    // sticking to an authentic-looking version avoids false positives during validation.
    zip.file('Version', '14.0.177.0');
    // Richer [Content_Types].xml
    zip.file('[Content_Types].xml',
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n' +
      '  <Default Extension="json" ContentType="application/json"/>\n' +
      '  <Default Extension="txt" ContentType="text/plain"/>\n' +
      '  <Default Extension="xml" ContentType="application/xml"/>\n' +
      '  <Override PartName="/DataModelSchema" ContentType="application/json"/>\n' +
      '  <Override PartName="/Report/Layout" ContentType="application/json"/>\n' +
      '  <Override PartName="/Version" ContentType="text/plain"/>\n' +
      '</Types>');

    // Root relationships file (required by OPC spec)
    zip.folder('_rels').file('.rels',
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>');

    // Empty SecurityBindings to avoid missing part error in some Desktop builds
    zip.file('SecurityBindings', '');

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

    // --- Minimal Power BI template structure placeholders ---
    // According to reverse‑engineered PBIX/PBIT structure, include DataModelSchema and empty layout
    zip.file('DataModelSchema', JSON.stringify({ tables: Object.keys(mapped) }));

    // Empty report layout JSON placeholder – real templates contain visual config
    zip.folder('Report').file('Layout', JSON.stringify({ sections: [] }));

    zip.file('README.txt', 'Auto‑generated minimal Power BI template. Replace with real model.');

    const buffer = await zip.generateAsync({ type: 'nodebuffer' });
    await fs.ensureDir(path.dirname(outputPath));
    await fs.writeFile(outputPath, buffer);

    // Quick validation – ensure file exists and not empty
    const stats = await fs.stat(outputPath);
    if (stats.size === 0) {
      throw new Error('Generated .pbit file is empty');
    }
  } catch (err) {
    // Re-throw with clearer context
    throw new Error(`PBIT generation failed: ${err.message || err}`);
  }
}

// Basic sanity checks on mapped data before packaging
function validateMappedData(mapped) {
  if (!mapped.tasks?.length) {
    throw new Error('No tasks found in project data – cannot generate template');
  }
  if (!mapped.resources?.length) {
    throw new Error('No resources found in project data');
  }
  // Additional checks can be added here (e.g., assignments integrity)
}

module.exports = { generatePbit };
