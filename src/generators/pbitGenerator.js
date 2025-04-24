const fs = require('fs-extra');
const path = require('path');
const JSZip = require('jszip');
const crypto = require('crypto');
const { mapProjectData } = require('./dataMapper');
const daxDefs = require('./daxDefinitions');
const visualDefs = require('../visuals');

// Helper to create UTF‑16LE buffers without BOM
const toUtf16 = (v) => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v), 'utf16le');

class PbitGenerator {
  constructor(mapped, outputPath, daxDefinitions) {
    this.mapped = mapped;
    this.outputPath = outputPath;
    this.zip = new JSZip();
    this.tableLineageTags = {};
    this.daxDefinitions = daxDefinitions; // Store merged DAX defs
  }

  createLineageTags() {
    Object.keys(this.mapped)
      .filter(tableName => Array.isArray(this.mapped[tableName]) && this.mapped[tableName].length > 0)
      .forEach(tableName => {
        this.tableLineageTags[tableName] = crypto.randomUUID();
      });
  }

  addVersion() {
    const versionBuf = Buffer.from('1.28', 'utf16le');
    this.zip.file('Version', versionBuf, { compression: 'STORE' });
  }

  addContentTypes() {
    const contentTypesXml =
      '<?xml version="1.0" encoding="utf-8"?>\n' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n' +
      '  <Default Extension="json" ContentType=""/>\n' +
      '  <Override PartName="/Version" ContentType="" />\n' +
      '  <Override PartName="/DataModelSchema" ContentType="" />\n' +
      '  <Override PartName="/DiagramLayout" ContentType="" />\n' +
      '  <Override PartName="/Report/Layout" ContentType="" />\n' +
      '  <Override PartName="/Settings" ContentType="application/json" />\n' +
      '  <Override PartName="/Metadata" ContentType="application/json" />\n' +
      '  <Override PartName="/SecurityBindings" ContentType="" />\n' +
      '</Types>';
    const ctBuf = Buffer.from('\uFEFF' + contentTypesXml, 'utf8');
    this.zip.file('[Content_Types].xml', ctBuf, { compression: 'STORE' });
  }

  addRootRelationships() {
    this.zip
      .folder('_rels')
      .file(
        '.rels',
        '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>'
      );
  }

  async addSecurityBindings() {
    let securityBuf = null;
    try {
      const bpPath = path.join(__dirname, 'baseTemplate.pbit');
      const bpData = await fs.readFile(bpPath);
      const bpZip = await JSZip.loadAsync(bpData);
      const secFile = bpZip.file('SecurityBindings');
      if (secFile) securityBuf = await secFile.async('nodebuffer');
    } catch (_) {
      // fallback to empty
    }
    this.zip.file('SecurityBindings', securityBuf || '', { compression: 'STORE' });
  }

  addTables() {
    this.zip.file('tables/tasks.json', toUtf16(this.mapped.tasks));
    this.zip.file('tables/resources.json', toUtf16(this.mapped.resources));
    this.zip.file('tables/assignments.json', toUtf16(this.mapped.assignments));
    this.zip.file('tables/properties.json', toUtf16(this.mapped.properties));
  }

  addRelationships() {
    const rels = [
      // { fromTable: 'tasks', fromCol: 'id', toTable: 'assignments', toCol: 'taskID' },
      { name: this.tableLineageTags.resources, fromTable: 'resources', fromCol: 'id', toTable: 'assignments', toCol: 'resourceID' },
    ];
    this.zip.file('relationships.json', toUtf16(rels));
  }

  addDaxAndVisuals() {
    // Use the DAX definitions passed to the constructor
    this.zip.file('dax/measures.json', toUtf16(this.daxDefinitions));
    this.zip.file('Report/visuals.json', toUtf16(visualDefs));
  }

  addDataModelSchema() {
    // Pass the constructor's DAX definitions to buildDataModelSchema
    const schema = buildDataModelSchema(this.mapped, this.daxDefinitions, this.tableLineageTags);
    this.zip.file('DataModelSchema', toUtf16(schema));
  }

  addDiagramLayout() {
    this.zip.file(
      'DiagramLayout',
      toUtf16({
        version: '1.1.0',
        diagrams: [
          {
            ordinal: 0,
            scrollPosition: { x: 0, y: 0 },
            nodes: Object.keys(this.mapped)
              .filter(t => Array.isArray(this.mapped[t]) && this.mapped[t].length)
              .map((t, i) => ({
                location: { x: i * 250, y: 0 },
                nodeIndex: t,
                nodeLineageTag: this.tableLineageTags[t],
                size: { height: 300, width: 234 },
                zIndex: 0,
              })),
            name: 'All tables',
            zoomValue: 100,
            pinKeyFieldsToTop: false,
            showExtraHeaderInfo: false,
            hideKeyFieldsWhenCollapsed: false,
            tablesLocked: false,
          },
        ],
        selectedDiagram: 'All tables',
        defaultDiagram: 'All tables',
      })
    );
  }

  addSettings() {
    const settingsObj = {
      Version: 4,
      ReportSettings: {},
      QueriesSettings: { TypeDetectionEnabled: true, RelationshipImportEnabled: true, RunBackgroundAnalysis: true, Version: '2.141.602.0' },
    };
    this.zip.file('Settings', Buffer.from(JSON.stringify(settingsObj), 'utf16le'), { compression: 'STORE' });
  }

  addMetadata() {
    this.zip.file(
      'Metadata',
      toUtf16({
        Version: 5,
        AutoCreatedRelationships: [],
        FileDescription: 'Created by MPP Parser',
        CreatedFrom: 'Cloud',
        CreatedFromRelease: '2025.03',
      })
    );
  }

  addCustomVisuals() {
    const customVisualsPath = path.join(__dirname, 'CustomVisuals');

    // Add Inforiver Charts custom visual
    const inforiverPath = path.join(customVisualsPath, 'InforiverCharts582F6C55AB6442EF8FA129089285CB47');

    // Read and add package.json
    const packageJsonPath = path.join(inforiverPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = fs.readFileSync(packageJsonPath);
      this.zip.file('Report/CustomVisuals/InforiverCharts582F6C55AB6442EF8FA129089285CB47/package.json', packageJson);
    }

    // Read and add resources
    const resourcesPath = path.join(inforiverPath, 'resources');
    if (fs.existsSync(resourcesPath)) {
      const files = fs.readdirSync(resourcesPath);
      files.forEach(file => {
        const filePath = path.join(resourcesPath, file);
        if (fs.statSync(filePath).isFile()) {
          const fileData = fs.readFileSync(filePath);
          this.zip.file(`Report/CustomVisuals/InforiverCharts582F6C55AB6442EF8FA129089285CB47/resources/${file}`, fileData);
        }
      });
    }
  }

  addReportLayout() {
    const reportFolder = this.zip.folder('Report');
    const layout = {
      id: 0,
      resourcePackages: [
        {
          resourcePackage: {
            name: 'SharedResources',
            type: 2,
            items: [
              { type: 202, path: 'BaseThemes/CY24SU10.json', name: 'CY24SU10' },
            ],
            disabled: false,
          },
        },
      ],
      sections: [
        {
          id: 0,
          name: 'd885cb602cde7588d3f8',
          displayName: 'Page 1',
          filters: '[]',
          ordinal: 0,
          visualContainers: [(() => {
            try {
              // Load the base visual containers structure from the JS module
              const visualContainersBase = require(path.join(__dirname, '../config/VisualContainersBase.json'));
              // Deep clone to avoid modifying the original module cache
              return JSON.parse(JSON.stringify(visualContainersBase));
            } catch (error) {
              console.error("Error loading VisualContainersBase.js:", error);
              // Return an empty array or handle the error appropriately
              return [];
            }
          })()],
          config: (() => { // Use an IIFE to load and handle errors
            try {
              const reportConfig = require(path.join(__dirname, '../config/reportConfigBase.json'));
              // Since the content is already a string containing JSON, we just return it.
              // If it were a JS object, we'd use JSON.stringify(reportConfig)
              // Correction: require automatically parses JSON, so we need to stringify it.
              return JSON.stringify(reportConfig); 
            } catch (error) {
              console.error("Error loading reportConfigBase.json:", error);
              // Return a default empty config string on error
              return '{}';
            }
          })(),
          layoutOptimization: 0,
          publicCustomVisuals: [
            "InforiverCharts582F6C55AB6442EF8FA129089285CB47"
          ],
          theme: (() => {
            try {
              const themeConfig = require(path.join(__dirname, '../config/themeBase.json'));
              // Stringify the loaded JSON object for the PBIX file
              return JSON.stringify(themeConfig);
            } catch (error) {
              console.error("Error loading themeBase.json:", error);
              // Return a default empty theme string on error
              return '{}'; // Or a minimal valid theme JSON string if necessary
            }
          })()
        },
      ],
      config: (() => { // Use an IIFE to load and handle errors
        try {
          const reportConfig = require(path.join(__dirname, '../config/reportConfigBase.json'));
          // Since the content is already a string containing JSON, we just return it.
          // If it were a JS object, we'd use JSON.stringify(reportConfig)
          // Correction: require automatically parses JSON, so we need to stringify it.
          return JSON.stringify(reportConfig); 
        } catch (error) {
          console.error("Error loading reportConfigBase.json:", error);
          // Return a default empty config string on error
          return '{}';
        }
      })(),
      layoutOptimization: 0,
      publicCustomVisuals: [
        "InforiverCharts582F6C55AB6442EF8FA129089285CB47"
      ]
    };
    const layoutBuf = Buffer.from(JSON.stringify(layout), 'utf16le');
    reportFolder.file('Layout', layoutBuf, { compression: 'STORE' });

    // this.zip.file('Report/StaticResources/SharedResources/BaseThemes/CY24SU10.json', toUtf16(
    //   JSON.stringify({ ... })
    // ));
  }

  async build() {
    this.createLineageTags();
    this.addVersion();
    this.addContentTypes();
    this.addRootRelationships();
    await this.addSecurityBindings();
    this.addTables();
    // this.addRelationships();
    this.addDaxAndVisuals();
    this.addDataModelSchema();
    this.addDiagramLayout();
    this.addSettings();
    this.addMetadata();
    this.addCustomVisuals();
    this.addReportLayout();
  }

  async save() {
    const buffer = await this.zip.generateAsync({ type: 'nodebuffer' });
    await fs.ensureDir(path.dirname(this.outputPath));
    await fs.writeFile(this.outputPath, buffer);
    const stats = await fs.stat(this.outputPath);
    if (stats.size === 0) throw new Error('Generated .pbit file is empty');
  }
}

/**
 * Generate a basic .pbit (Power BI template) file from project data JSON.
 * This is a minimal placeholder implementation: it packages the raw JSON and a README into a zip
 * with .pbit extension. Real-world templates require additional layout and DataModel files.
 *
 * @param {object} projectData - Parsed project JSON.
 * @param {string} outputPath - Absolute path where the .pbit file will be written.
 * @param {string} [customDaxPath] - Optional absolute path to a JSON file containing custom DAX definitions.
 */
async function generatePbit(projectData, outputPath, customDaxPath) {
  try {
    const mapped = mapProjectData(projectData);
    validateMappedData(mapped);
    // validateVisualDefs(mapped, visualDefs);

    // --- Load and Merge DAX Definitions --- 
    let finalDaxDefs = [...daxDefs]; // Start with standard definitions

    if (customDaxPath) {
      try {
        if (await fs.pathExists(customDaxPath)) {
          const customDaxStr = await fs.readFile(customDaxPath, 'utf8');
          const customDax = JSON.parse(customDaxStr);
          if (!Array.isArray(customDax)) {
            throw new Error('Custom DAX file must contain a JSON array.');
          }
          
          // Merge/Override logic
          const daxMap = new Map();
          // Add standard definitions first
          finalDaxDefs.forEach(def => daxMap.set(`${def.table}::${def.name}`, def));
          // Add/override with custom definitions
          customDax.forEach(def => {
            if (def.table && def.name && def.expression) {
              daxMap.set(`${def.table}::${def.name}`, def);
            } else {
              console.warn(`Skipping invalid custom DAX definition: ${JSON.stringify(def)}`);
            }
          });
          finalDaxDefs = Array.from(daxMap.values());
          console.log(`Loaded and merged ${customDax.length} custom DAX definitions from ${customDaxPath}`);
        } else {
          console.warn(`Custom DAX file not found: ${customDaxPath}`);
        }
      } catch (err) {
        console.error(`Error loading or merging custom DAX definitions from ${customDaxPath}:`, err);
        // Decide if we should proceed with standard DAX or throw error
        // For now, proceed with standard DAX
        finalDaxDefs = [...daxDefs];
      }
    }
    // --- End DAX Loading/Merging ---

    const generator = new PbitGenerator(mapped, outputPath, finalDaxDefs);
    await generator.build();
    await generator.save();

  } catch (err) {
    throw new Error(`PBIT generation failed: ${err.message || err}`);
  }
}

// Enhanced data validation for mapped data
function validateMappedData(mapped) {
  const errors = [];
  const taskIds = new Set();
  const resourceIds = new Set();

  // 1. Basic Existence Checks
  if (!mapped.tasks?.length) {
    errors.push('No tasks found in project data – cannot generate template.');
    // Cannot proceed with further validation if tasks are missing
    if (errors.length > 0) throw new Error(`Data validation failed:\n- ${errors.join('\n- ')}`);
  }
  if (!mapped.resources?.length) {
    // Allow generation without resources, but log a warning? Or error? Let's error for now.
    errors.push('No resources found in project data.');
  }

  // 2. Task Validation (IDs, Dates)
  mapped.tasks.forEach((task, index) => {
    const taskIdDesc = `Task (ID: ${task.id}, Name: "${task.name}", Index: ${index})`;
    // Check ID uniqueness
    if (task.id == null) {
      errors.push(`${taskIdDesc}: Missing 'id'.`);
    } else if (taskIds.has(task.id)) {
      errors.push(`${taskIdDesc}: Duplicate Task ID found.`);
    } else {
      taskIds.add(task.id);
    }
    // Check Date Formats (simple check for now)
    if (task.start && new Date(task.start).toString() === 'Invalid Date') {
      errors.push(`${taskIdDesc}: Invalid 'start' date format: ${task.start}.`);
    }
    if (task.finish && new Date(task.finish).toString() === 'Invalid Date') {
      errors.push(`${taskIdDesc}: Invalid 'finish' date format: ${task.finish}.`);
    }
    // Check Predecessor Task IDs exist (if predecessors array exists)
    if (Array.isArray(task.predecessors)) {
      task.predecessors.forEach((pred, pIndex) => {
         if (pred.taskID == null) {
            errors.push(`${taskIdDesc}, Predecessor ${pIndex}: Missing 'taskID'.`);
         }
         // Note: Cannot check if pred.taskID exists in taskIds *yet*, need to collect all taskIds first.
         // This check is moved after the loop.
      });
    }
  });

  // 3. Resource Validation (IDs)
  mapped.resources.forEach((res, index) => {
    const resIdDesc = `Resource (ID: ${res.id}, Name: "${res.name}", Index: ${index})`;
    if (res.id == null) {
       errors.push(`${resIdDesc}: Missing 'id'.`);
    } else if (resourceIds.has(res.id)) {
      errors.push(`${resIdDesc}: Duplicate Resource ID found.`);
    } else {
      resourceIds.add(res.id);
    }
  });

  // 4. Assignment Validation (Relationship Integrity)
  if (mapped.assignments?.length) {
    mapped.assignments.forEach((assignment, index) => {
      const assignDesc = `Assignment (Index: ${index}, TaskID: ${assignment.taskID}, ResourceID: ${assignment.resourceID})`;
      if (assignment.taskID == null) {
         errors.push(`${assignDesc}: Missing 'taskID'.`);
      } else if (!taskIds.has(assignment.taskID)) {
        errors.push(`${assignDesc}: References non-existent Task ID ${assignment.taskID}.`);
      }
      if (assignment.resourceID == null) {
         errors.push(`${assignDesc}: Missing 'resourceID'.`);
      } else if (!resourceIds.has(assignment.resourceID)) {
        // Only flag if resources exist
        if (mapped.resources?.length) {
          errors.push(`${assignDesc}: References non-existent Resource ID ${assignment.resourceID}.`);
        }
      }
    });
  }

  // 5. Predecessor Validation (Relationship Integrity - Part 2)
   mapped.tasks.forEach((task, index) => {
     if (Array.isArray(task.predecessors)) {
       const taskIdDesc = `Task (ID: ${task.id}, Name: "${task.name}", Index: ${index})`;
       task.predecessors.forEach((pred, pIndex) => {
         if (pred.taskID != null && !taskIds.has(pred.taskID)) {
            errors.push(`${taskIdDesc}, Predecessor ${pIndex} (ID: ${pred.taskID}): References non-existent Task ID ${pred.taskID}.`);
         }
       });
     }
   });

  // Final Error Check
  if (errors.length > 0) {
    throw new Error(`Data validation failed:\n- ${errors.join('\n- ')}`);
  }

  // If we reach here, basic validation passed
  console.log("Data validation passed successfully.");
}

// Validate visuals against mapped table schema
function validateVisualDefs(mapped, defs) {
  const tableFields = {
    tasks: mapped.tasks.length ? Object.keys(mapped.tasks[0]) : [],
    resources: mapped.resources.length ? Object.keys(mapped.resources[0]) : [],
    assignments: mapped.assignments.length ? Object.keys(mapped.assignments[0]) : [],
    properties: mapped.properties.length ? Object.keys(mapped.properties[0]) : [],
  };

  const errors = [];
  for (const page of defs.defaultVisuals.pages) {
    for (const vis of page.visuals) {
      if (!tableFields[vis.table]) {
        errors.push(`Unknown table ${vis.table} in visual ${vis.id}`);
        continue;
      }
      const fields = Array.isArray(vis.fields)
        ? vis.fields
        : Object.values(vis.fields || {});
      for (const f of fields) {
        if (!tableFields[vis.table].includes(f) && f !== 'count' && f !== 'totalWork') {
          errors.push(`Field ${f} not found in table ${vis.table} (visual ${vis.id})`);
        }
      }
    }
  }
  if (errors.length) {
    throw new Error(`Visual definition validation failed:\n${errors.join('\n')}`);
  }
}

// Build DataModelSchema with tables, columns, and measures
function buildDataModelSchema(mapped, measuresArr, tableLineageTags) {
  const mkColumns = (row, tableName) => Object.keys(row).map((c) => ({
    name: c,
    dataType: (tableName === 'assignments' && c === 'units') || (tableName === 'tasks' && c === 'percentComplete') ? 'int64' :
      (tableName === 'tasks' && (c === 'start' || c === 'finish')) ? 'dateTime' : 'string',
    ...(tableName === 'tasks' && (c === 'start' || c === 'finish') ? { formatString: 'Long Date' } : {}),
    sourceColumn: c,
    summarizeBy: "none",
    annotations: [
      {
        name: "SummarizationSetBy",
        value: "Automatic"
      },
      ...(tableName === 'tasks' && (c === 'start' || c === 'finish') ? [{
        name: "UnderlyingDateTimeDataType",
        value: "Date"
      }] : [])
    ]
  }));

  const tables = [];
  for (const [tblName, rows] of Object.entries(mapped)) {
    if (!Array.isArray(rows) || !rows.length) continue;
    const tblMeasures = measuresArr.filter((m) => m.table === tblName).map((m) => ({
      name: m.name,
      expression: m.expression,
      formatString: '',
    }));

    // Generate table-specific M expression
    let mExpression;

    // Special handling for tasks table to expand predecessors
    if (tblName === 'tasks') {
      mExpression = `let
    // Step 1: Embed JSON string from actual table data
    RawJson = "${JSON.stringify(rows).replace(/"/g, '""')}",
 
    // Step 2: Parse JSON
    ParsedJson = Json.Document(RawJson),
 
    // Step 3: Convert to table
    TableData = Table.FromRecords(ParsedJson),
 
    // Step 4: Ensure proper types - could be enhanced with actual type detection
    TypedTable = Table.TransformColumnTypes(TableData, {}, null),
    #"Expanded predecessors" = Table.ExpandListColumn(TypedTable, "predecessors"),
    #"Expanded predecessors1" = Table.ExpandRecordColumn(#"Expanded predecessors", "predecessors", {"taskID", "taskUniqueID", "taskName", "type", "lag"}, {"predecessors.taskID", "predecessors.taskUniqueID", "predecessors.taskName", "predecessors.type", "predecessors.lag"}),
    #"Changed Type" = Table.TransformColumnTypes(#"Expanded predecessors1",{{"start", type date}, {"finish", type date}}),
    #"Added Custom" = Table.AddColumn(#"Changed Type", "Custom", each [finish]-[start]),
    #"Inserted Total Days" = Table.AddColumn(#"Added Custom", "Total Days", each Duration.TotalDays([Custom]), type number)
in
    #"Inserted Total Days"`;
    } else {
      // Dynamic M expression that uses the actual table data for each table
      mExpression = `let
    // Step 1: Embed JSON string from actual table data
    RawJson = "${JSON.stringify(rows).replace(/"/g, '""')}",
 
    // Step 2: Parse JSON
    ParsedJson = Json.Document(RawJson),
 
    // Step 3: Convert to table
    TableData = Table.FromRecords(ParsedJson),
 
    // Step 4: Ensure proper types - could be enhanced with actual type detection
    TypedTable = Table.TransformColumnTypes(TableData, {}, null)
in
    TypedTable
`;
    }

    tables.push({
      name: tblName,
      columns: mkColumns(rows[0], tblName),
      measures: tblMeasures,
      partitions: [
        {
          name: 'Partition',
          mode: 'import',
          source: {
            type: 'm',
            expression: mExpression,
          },
        },
      ],
      annotations: [
        {
          name: "PBI_NavigationStepName",
          value: "Navigation"
        },
        {
          name: 'PBI_ResultType',
          value: 'Table',
        },
      ],
    });
  }
  return {
    name: crypto.randomUUID(),
    compatibilityLevel: 1567,
    model: {
      culture: 'en-US',
      dataAccessOptions: {
        legacyRedirects: true,
        returnErrorValuesAsNull: true
      },
      defaultPowerBIDataSourceVersion: "powerBI_V3",
      sourceQueryCulture: "en-US",
      tables, 
      cultures: [
        {
          name: "en-US",
          linguisticMetadata: {
            content: {
              Version: "1.0.0",
              Language: "en-US"
            },
            contentType: "json"
          },
        },
      ],
      annotations: [
        {
          name: "PBI_QueryOrder",
          value: "[\"tasks\",\"resources\",\"assignments\",\"properties\"]"
        },
        {
          name: "__PBI_TimeIntelligenceEnabled",
          value: "1"
        },
        {
          name: "PBIDesktopVersion",
          value: "2.141.1451.0"
        }
      ]
    },
  };
}

module.exports = { generatePbit };
