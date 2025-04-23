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
  // --- Added standard project management KPIs ---
  {
    table: 'tasks',
    name: 'Total Duration Days',
    expression: 'SUM(tasks[duration])',
  },
  {
    table: 'tasks',
    name: 'Project Completion %',
    expression: 'DIVIDE(SUM(tasks[percentComplete]), COUNTROWS(tasks))',
  },
  {
    table: 'resources',
    name: 'Total Resource Cost',
    expression: 'SUM(resources[cost])',
  },
  {
    table: 'assignments',
    name: 'Average Resource Utilization',
    expression: 'AVERAGE(assignments[units])',
  },
  {
    table: 'tasks',
    name: 'Cost per Task',
    expression: 'DIVIDE(SUM(resources[cost]), COUNTROWS(tasks))',
  },
];
