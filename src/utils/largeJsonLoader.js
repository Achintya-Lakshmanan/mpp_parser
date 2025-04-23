/**
 * Efficiently load large JSON files using streaming to avoid high memory spikes.
 * Returns a fully parsed object but avoids reading the entire file into memory
 * at once. Works well for project JSON with top‑level keys tasks, resources, assignments, properties.
 *
 * Implementation uses the `stream-json` package to iterate through the file.
 */
const fs = require('fs');
const { chain } = require('stream-chain');
const { parser } = require('stream-json');
const { pick } = require('stream-json/filters/Pick');
const { streamArray } = require('stream-json/streamers/StreamArray');
const { Writable } = require('stream');

/**
 * Load a project JSON file of arbitrary size.
 * @param {string} filePath Absolute path to JSON file
 * @returns {Promise<object>} Parsed project data object
 */
function loadProjectJsonStream(filePath) {
  return new Promise((resolve, reject) => {
    const project = {
      tasks: [],
      resources: [],
      assignments: [],
      properties: {},
    };

    const topLevelKeys = ['tasks', 'resources', 'assignments', 'properties'];

    let finishedParts = 0;

    // For each array key, set up an independent pipeline so we can stream arrays individually
    const pipelines = topLevelKeys.map((key) => {
      const pipeline = chain([
        fs.createReadStream(filePath),
        parser(),
        pick({ filter: key }),
        streamArray(),
        new Writable({
          objectMode: true,
          write({ value }, enc, cb) {
            if (key === 'properties') {
              Object.assign(project.properties, value);
            } else {
              project[key].push(value);
            }
            cb();
          },
        }),
      ]);

      pipeline.on('error', reject);
      pipeline.on('finish', () => {
        finishedParts += 1;
        if (finishedParts === topLevelKeys.length) {
          resolve(project);
        }
      });

      return pipeline;
    });
  });
}

module.exports = { loadProjectJsonStream };
