const { mapProjectData } = require('../src/generators/dataMapper');

describe('mapProjectData', () => {
  test('should return empty arrays for empty input', () => {
    const input = { tasks: [], resources: [], assignments: [], properties: {} };
    const expected = { tasks: [], resources: [], assignments: [], properties: [] };
    expect(mapProjectData(input)).toEqual(expected);
  });

  test('should throw error for null or undefined input', () => {
    expect(() => mapProjectData(null)).toThrow('No project data provided');
    expect(() => mapProjectData(undefined)).toThrow('No project data provided');
  });

  test('should correctly map basic project data', () => {
    const input = {
      tasks: [{ id: 1, uniqueID: 10, name: 'Task 1', outlineLevel: 1, start: '2024-01-01', finish: '2024-01-05', duration: 5, work: 40, percentComplete: 50, summary: false, type: 'Fixed Duration', constraint: null, predecessors: [] }],
      resources: [{ id: 1, uniqueID: 100, name: 'Res 1', type: 'Work', maxUnits: 100 }],
      assignments: [{ taskID: 1, resourceID: 1, units: 100 }],
      properties: { Author: 'Test User', CreationDate: '2024-01-01' }
    };
    const expected = {
      tasks: [{ id: 1, uniqueID: 10, name: 'Task 1', outlineNumber: undefined, outlineLevel: 1, start: '2024-01-01', finish: '2024-01-05', duration: 5, work: 40, percentComplete: 50, summary: false, type: 'Fixed Duration', constraint: null, predecessors: [] }],
      resources: [{ id: 1, uniqueID: 100, name: 'Res 1', type: 'Work', maxUnits: 100 }],
      assignments: [{ taskID: 1, resourceID: 1, units: 100 }],
      properties: [{ key: 'Author', value: 'Test User' }, { key: 'CreationDate', value: '2024-01-01' }]
    };
    expect(mapProjectData(input)).toEqual(expected);
  });

  // TODO: Add more tests for edge cases, different data types, missing fields, etc.
});
