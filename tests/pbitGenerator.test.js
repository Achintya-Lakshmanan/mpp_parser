// This extracts validateMappedData for testing. It's not ideal as it copies code.
// A better approach would be to refactor validateMappedData into a separate module.
const fs = require('fs');
const path = require('path');

let validateMappedData;
try {
  const pbitGeneratorCode = fs.readFileSync(path.join(__dirname, '../src/generators/pbitGenerator.js'), 'utf8');
  // VERY simplified extraction - assumes function definition is isolated
  const match = pbitGeneratorCode.match(/function\s+validateMappedData\s*\([^)]*\)\s*{[\s\S]*?^}/m);
  if (match) {
    // Use eval carefully or Function constructor for safer execution
    validateMappedData = new Function(`return ${match[0]}`)();
  } else {
    throw new Error('Could not extract validateMappedData function.');
  }
} catch (error) {
  console.error('Failed to load validateMappedData for testing:', error);
  // Define a dummy function so tests don't completely crash
  validateMappedData = () => { throw new Error('validateMappedData could not be loaded'); };
}


describe('validateMappedData', () => {

  test('should pass for valid minimal data', () => {
    const mapped = {
      tasks: [{ id: 1, name: 'Task 1', start: '2024-01-01', finish: '2024-01-05', predecessors: [] }],
      resources: [{ id: 10, name: 'Res 1' }],
      assignments: [{ taskID: 1, resourceID: 10 }]
    };
    // Expect no error to be thrown
    expect(() => validateMappedData(mapped)).not.toThrow();
  });

  test('should throw error if no tasks are provided', () => {
    const mapped = {
      tasks: [],
      resources: [{ id: 10, name: 'Res 1' }],
      assignments: []
    };
    expect(() => validateMappedData(mapped)).toThrow('No tasks found in project data');
  });

  test('should throw error if no resources are provided', () => {
    const mapped = {
      tasks: [{ id: 1, name: 'Task 1' }],
      resources: [],
      assignments: []
    };
    expect(() => validateMappedData(mapped)).toThrow('No resources found in project data');
  });

  test('should throw error for duplicate task IDs', () => {
    const mapped = {
      tasks: [{ id: 1, name: 'Task 1' }, { id: 1, name: 'Task 2' }],
      resources: [{ id: 10, name: 'Res 1' }],
      assignments: []
    };
    expect(() => validateMappedData(mapped)).toThrow(/Duplicate Task ID found/);
  });

  test('should throw error for duplicate resource IDs', () => {
    const mapped = {
      tasks: [{ id: 1, name: 'Task 1' }],
      resources: [{ id: 10, name: 'Res 1' }, { id: 10, name: 'Res 2' }],
      assignments: []
    };
    expect(() => validateMappedData(mapped)).toThrow(/Duplicate Resource ID found/);
  });

  test('should throw error for invalid task start date', () => {
    const mapped = {
      tasks: [{ id: 1, name: 'Task 1', start: 'invalid-date' }],
      resources: [{ id: 10, name: 'Res 1' }],
      assignments: []
    };
    expect(() => validateMappedData(mapped)).toThrow(/Invalid 'start' date format/);
  });

  test('should throw error for invalid task finish date', () => {
    const mapped = {
      tasks: [{ id: 1, name: 'Task 1', finish: 'invalid-date' }],
      resources: [{ id: 10, name: 'Res 1' }],
      assignments: []
    };
    expect(() => validateMappedData(mapped)).toThrow(/Invalid 'finish' date format/);
  });

  test('should throw error for assignment referencing non-existent task ID', () => {
    const mapped = {
      tasks: [{ id: 1, name: 'Task 1' }],
      resources: [{ id: 10, name: 'Res 1' }],
      assignments: [{ taskID: 2, resourceID: 10 }]
    };
    expect(() => validateMappedData(mapped)).toThrow(/References non-existent Task ID 2/);
  });

  test('should throw error for assignment referencing non-existent resource ID', () => {
    const mapped = {
      tasks: [{ id: 1, name: 'Task 1' }],
      resources: [{ id: 10, name: 'Res 1' }],
      assignments: [{ taskID: 1, resourceID: 11 }]
    };
    expect(() => validateMappedData(mapped)).toThrow(/References non-existent Resource ID 11/);
  });

  test('should throw error for predecessor referencing non-existent task ID', () => {
     const mapped = {
       tasks: [
         { id: 1, name: 'Task 1', predecessors: [{ taskID: 2 }] },
         { id: 3, name: 'Task 3' }
        ],
       resources: [{ id: 10, name: 'Res 1' }],
       assignments: []
     };
     expect(() => validateMappedData(mapped)).toThrow(/References non-existent Task ID 2/);
   });

   test('should pass validation with valid predecessors', () => {
     const mapped = {
       tasks: [
         { id: 1, name: 'Task 1' },
         { id: 2, name: 'Task 2', predecessors: [{ taskID: 1, type: 'FS' }] }
        ],
       resources: [{ id: 10, name: 'Res 1' }],
       assignments: [{ taskID: 1, resourceID: 10 }, { taskID: 2, resourceID: 10 }]
     };
     expect(() => validateMappedData(mapped)).not.toThrow();
   });
  
  // TODO: Add more tests for missing IDs, null values, complex structures etc.
});


