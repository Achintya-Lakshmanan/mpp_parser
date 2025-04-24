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
  constructor(mapped, outputPath) {
    this.mapped = mapped;
    this.outputPath = outputPath;
    this.zip = new JSZip();
    this.tableLineageTags = {};
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
      { name: tableLineageTags.resources, fromTable: 'resources', fromCol: 'id', toTable: 'assignments', toCol: 'resourceID' },
    ];
    this.zip.file('relationships.json', toUtf16(rels));
  }

  addDaxAndVisuals() {
    this.zip.file('dax/measures.json', toUtf16(daxDefs));
    this.zip.file('Report/visuals.json', toUtf16(visualDefs));
  }

  addDataModelSchema() {
    const schema = buildDataModelSchema(this.mapped, daxDefs, this.tableLineageTags);
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
          visualContainers: [],
          config: '{}',
          displayOption: 1,
          width: 1280,
          height: 720,
        },
      ],
      config:
        '{"version":"5.59","themeCollection":{"baseTheme":{"name":"CY24SU10","version":"5.62","type":2}},"activeSectionIndex":0,"defaultDrillFilterOtherVisuals":true,"settings":{"useNewFilterPaneExperience":true,"allowChangeFilterTypes":true,"useStylableVisualContainerHeader":true,"queryLimitOption":6,"useEnhancedTooltips":true,"exportDataMode":1,"useDefaultAggregateDisplayName":true},"objects":{"section":[{"properties":{"verticalAlignment":{"expr":{"Literal":{"Value":"\'Top\'"}}}}}]}}',
      layoutOptimization: 0,
    };
    const layoutBuf = Buffer.from(JSON.stringify(layout), 'utf16le');
    reportFolder.file('Layout', layoutBuf, { compression: 'STORE' });

    reportFolder.folder('StaticResources').folder('SharedResources').folder('BaseThemes')
      .file('CY24SU10.json', JSON.stringify({
        "name": "CY24SU10",
        "dataColors": ["#118DFF", "#12239E", "#E66C37", "#6B007B", "#E044A7", "#744EC2", "#D9B300", "#D64550", "#197278", "#1AAB40", "#15C6F4", "#4092FF", "#FFA058", "#BE5DC9", "#F472D0", "#B5A1FF", "#C4A200", "#FF8080", "#00DBBC", "#5BD667", "#0091D5", "#4668C5", "#FF6300", "#99008A", "#EC008C", "#533285", "#99700A", "#FF4141", "#1F9A85", "#25891C", "#0057A2", "#002050", "#C94F0F", "#450F54", "#B60064", "#34124F", "#6A5A29", "#1AAB40", "#BA141A", "#0C3D37", "#0B511F"],
        "foreground": "#252423",
        "foregroundNeutralSecondary": "#605E5C",
        "foregroundNeutralTertiary": "#B3B0AD",
        "background": "#FFFFFF",
        "backgroundLight": "#F3F2F1",
        "backgroundNeutral": "#C8C6C4",
        "tableAccent": "#118DFF",
        "good": "#1AAB40",
        "neutral": "#D9B300",
        "bad": "#D64554",
        "maximum": "#118DFF",
        "center": "#D9B300",
        "minimum": "#DEEFFF",
        "null": "#FF7F48",
        "hyperlink": "#0078d4",
        "visitedHyperlink": "#0078d4",
        "textClasses": {
          "callout": { "fontSize": 45, "fontFace": "DIN", "color": "#252423" },
          "title": { "fontSize": 12, "fontFace": "DIN", "color": "#252423" },
          "header": { "fontSize": 12, "fontFace": "Segoe UI Semibold", "color": "#252423" },
          "label": { "fontSize": 10, "fontFace": "Segoe UI", "color": "#252423" }
        },
        "visualStyles": {
          "*": {
            "*": {
              "*": [{ "wordWrap": true }], "line": [{ "transparency": 0 }],
              "outline": [{ "transparency": 0 }], "plotArea": [{ "transparency": 0 }],
              "categoryAxis": [{ "showAxisTitle": true, "gridlineStyle": "dotted", "concatenateLabels": false }],
              "valueAxis": [{ "showAxisTitle": true, "gridlineStyle": "dotted" }],
              "y2Axis": [{ "show": true }], "title": [{ "titleWrap": true }], "lineStyles": [{ "strokeWidth": 3 }],
              "wordWrap": [{ "show": true }],
              "background": [{ "show": true, "transparency": 0 }],
              "border": [{ "width": 1 }],
              "outspacePane": [{ "backgroundColor": { "solid": { "color": "#ffffff" } }, "transparency": 0, "border": true, "borderColor": { "solid": { "color": "#B3B0AD" } } }],
              "filterCard": [{ "$id": "Applied", "transparency": 0, "foregroundColor": { "solid": { "color": "#252423" } }, "border": true }, { "$id": "Available", "transparency": 0, "foregroundColor": { "solid": { "color": "#252423" } }, "border": true }]
            }
          }, "scatterChart": { "*": { "bubbles": [{ "bubbleSize": -10, "markerRangeType": "auto" }], "general": [{ "responsive": true }], "fillPoint": [{ "show": true }], "legend": [{ "showGradientLegend": true }] } },
          "lineChart": { "*": { "general": [{ "responsive": true }], "smallMultiplesLayout": [{ "backgroundTransparency": 0, "gridLineType": "inner" }], "forecast": [{ "matchSeriesInterpolation": true }] } }, "map": { "*": { "bubbles": [{ "bubbleSize": -10, "markerRangeType": "auto" }] } },
          "azureMap": { "*": { "bubbleLayer": [{ "bubbleRadius": 8, "minBubbleRadius": 8, "maxRadius": 40 }], "barChart": [{ "barHeight": 3, "thickness": 3 }] } }, "pieChart": {
            "*": {
              "legend": [{ "show": true, "position": "RightCenter" }],
              "labels": [{ "labelStyle": "Data value, percent of total" }]
            }
          }, "donutChart": { "*": { "legend": [{ "show": true, "position": "RightCenter" }], "labels": [{ "labelStyle": "Data value, percent of total" }] } },
          "pivotTable": { "*": { "rowHeaders": [{ "showExpandCollapseButtons": true, "legacyStyleDisabled": true }] } }, "multiRowCard": { "*": { "card": [{ "outlineWeight": 2, "barShow": true, "barWeight": 2 }] } }, "kpi": { "*": { "trendline": [{ "transparency": 20 }] } },
          "cardVisual": { "*": { "layout": [{ "maxTiles": 3 }], "overflow": [{ "type": 0 }], "image": [{ "fixedSize": false }, { "imageAreaSize": 50 }] } }, "advancedSlicerVisual": { "*": { "layout": [{ "maxTiles": 3 }] } }, "slicer": {
            "*": {
              "general": [{ "responsive": true }], "date": [{ "hideDatePickerButton": false }],
              "items": [{ "padding": 4, "accessibilityContrastProperties": true }]
            }
          }, "waterfallChart": { "*": { "general": [{ "responsive": true }] } }, "columnChart": { "*": { "general": [{ "responsive": true }], "legend": [{ "showGradientLegend": true }], "smallMultiplesLayout": [{ "backgroundTransparency": 0, "gridLineType": "inner" }] } }, "clusteredColumnChart": { "*": { "general": [{ "responsive": true }], "legend": [{ "showGradientLegend": true }], "smallMultiplesLayout": [{ "backgroundTransparency": 0, "gridLineType": "inner" }] } },
          "hundredPercentStackedColumnChart": { "*": { "general": [{ "responsive": true }], "legend": [{ "showGradientLegend": true }], "smallMultiplesLayout": [{ "backgroundTransparency": 0, "gridLineType": "inner" }] } }, "barChart": { "*": { "general": [{ "responsive": true }], "legend": [{ "showGradientLegend": true }], "smallMultiplesLayout": [{ "backgroundTransparency": 0, "gridLineType": "inner" }] } }, "clusteredBarChart": {
            "*": {
              "general": [{ "responsive": true }], "legend": [{ "showGradientLegend": true }],
              "smallMultiplesLayout": [{ "backgroundTransparency": 0, "gridLineType": "inner" }]
            }
          },
          "hundredPercentStackedBarChart": { "*": { "general": [{ "responsive": true }], "legend": [{ "showGradientLegend": true }], "smallMultiplesLayout": [{ "backgroundTransparency": 0, "gridLineType": "inner" }] } }, "areaChart": { "*": { "general": [{ "responsive": true }], "smallMultiplesLayout": [{ "backgroundTransparency": 0, "gridLineType": "inner" }] } }, "stackedAreaChart": {
            "*": {
              "general": [{ "responsive": true }],
              "smallMultiplesLayout": [{ "backgroundTransparency": 0, "gridLineType": "inner" }]
            }
          }, "lineClusteredColumnComboChart": { "*": { "general": [{ "responsive": true }], "smallMultiplesLayout": [{ "backgroundTransparency": 0, "gridLineType": "inner" }] } }, "lineStackedColumnComboChart": { "*": { "general": [{ "responsive": true }], "smallMultiplesLayout": [{ "backgroundTransparency": 0, "gridLineType": "inner" }] } }, "ribbonChart": {
            "*": {
              "general": [{ "responsive": true }],
              "smallMultiplesLayout": [{ "backgroundTransparency": 0, "gridLineType": "inner" }], "valueAxis": [{ "show": true }]
            }
          }, "hundredPercentStackedAreaChart": { "*": { "general": [{ "responsive": true }], "smallMultiplesLayout": [{ "backgroundTransparency": 0, "gridLineType": "inner" }] } }, "group": { "*": { "background": [{ "show": false }] } }, "basicShape": { "*": { "background": [{ "show": false }], "general": [{ "keepLayerOrder": true }], "visualHeader": [{ "show": false }] } }, "shape": { "*": { "background": [{ "show": false }], "general": [{ "keepLayerOrder": true }], "visualHeader": [{ "show": false }] } }, "image": { "*": { "background": [{ "show": false }], "general": [{ "keepLayerOrder": true }], "visualHeader": [{ "show": false }], "lockAspect": [{ "show": true }] } }, "actionButton": { "*": { "background": [{ "show": false }], "visualHeader": [{ "show": false }] } }, "pageNavigator": { "*": { "background": [{ "show": false }], "visualHeader": [{ "show": false }] } }, "bookmarkNavigator": { "*": { "background": [{ "show": false }], "visualHeader": [{ "show": false }] } }, "textbox": { "*": { "general": [{ "keepLayerOrder": true }], "visualHeader": [{ "show": false }] } }, "page": { "*": { "outspace": [{ "color": { "solid": { "color": "#FFFFFF" } } }], "background": [{ "transparency": 100 }] } }
        }
      }));

    this.zip.file('README.txt', 'Auto-generated minimal Power BI template. Replace with real model.');
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
 */
async function generatePbit(projectData, outputPath) {
  try {
    const mapped = mapProjectData(projectData);
    validateMappedData(mapped);
    const generator = new PbitGenerator(mapped, outputPath);
    await generator.build();
    await generator.save();
  } catch (err) {
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
    dataType: (tableName === 'assignments' && c === 'units') ? 'int64' : 'string', 
    sourceColumn: c, 
    summarizeBy: "none",
    annotations: [
      {
        name: "SummarizationSetBy",
        value: "Automatic"
      }
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
    #"Expanded predecessors1" = Table.ExpandRecordColumn(#"Expanded predecessors", "predecessors", {"taskID", "taskUniqueID", "taskName", "type", "lag"}, {"predecessors.taskID", "predecessors.taskUniqueID", "predecessors.taskName", "predecessors.type", "predecessors.lag"})
in
    #"Expanded predecessors1"`;
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
      // relationships: [ 
      //   { 
      //     name: tableLineageTags.assignments,
      //     fromTable: "assignments",
      //     fromColumn: "resourceID",
      //     toTable: "resources",
      //     toColumn: "id",
      //   },
      // ],
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
          value: "2.141.1253.0 (25.03)+74f9999a1e95f78c739f3ea2b96ba340e9ba8729"
        }
      ]
    },
  };
}

module.exports = { generatePbit };
