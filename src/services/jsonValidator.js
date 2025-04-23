/**
 * JSON schema validation service for project files exported from Microsoft Project.
 * Uses AJV to validate against project-schema.json located under backend/schemas.
 */
const path = require('path');
const Ajv = require('ajv');

// Load schema once at startup
const schemaPath = path.join(__dirname, '../../src/backend/schemas/project-schema.json');
// eslint-disable-next-line import/no-dynamic-require, global-require
const schema = require(schemaPath);

const ajv = new Ajv({ allErrors: true, strict: false });
const validateFn = ajv.compile(schema);

/**
 * Validate a parsed project JSON object. Throws on validation error.
 * @param {object} data Parsed project JSON
 */
function validateProjectJson(data) {
  const valid = validateFn(data);
  if (!valid) {
    // Build readable error string
    const message = ajv.errorsText(validateFn.errors, { separator: '\n' });
    throw new Error(`Project JSON schema validation failed:\n${message}`);
  }
}

module.exports = { validateProjectJson };
