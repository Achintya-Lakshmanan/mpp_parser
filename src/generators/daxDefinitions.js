/**
 * Static DAX measure definitions for the minimal template.
 * In a real-world scenario these would be generated dynamically based on
 * project specifics. For now we ship common measures as examples.
 */
module.exports = [
  {
    table: 'tasks',
    name: 'Total Work Hours',
    expression: 'SUM(tasks[work])',
  },
  {
    table: 'tasks',
    name: 'Average Percent Complete',
    expression: 'AVERAGE(tasks[percentComplete])',
  },
  {
    table: 'assignments',
    name: 'Total Units',
    expression: 'SUM(assignments[units])',
  },
];
