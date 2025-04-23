# Mock Project Data Scenarios

This document defines the structure of mock JSON files representing various Microsoft Project (MPP) export scenarios. All mock data must **conform to the existing `src/backend/schemas/project-schema.json`** so that it passes backend validation.

## 1 · Simple Project
Minimal project with only a handful of tasks and one resource.

```jsonc
{
  "properties": {
    "name": "Simple Project",
    "createdDate": "2025-01-01T00:00:00Z",
    "author": "Mock User",
    "taskCount": 3,
    "resourceCount": 1,
    "assignmentCount": 3
  },
  "tasks": [
    { "id": 1, "uniqueID": 1, "name": "Task 1", "outlineNumber": "1", "outlineLevel": 1, "start": "2025-01-02", "finish": "2025-01-05", "duration": "3d", "work": 24, "percentComplete": 0 }
  ],
  "resources": [
    { "id": 1, "uniqueID": 1, "name": "Resource A", "type": "Work", "maxUnits": 1 }
  ],
  "assignments": [
    { "taskID": 1, "resourceID": 1, "units": 1 }
  ]
}
```

## 2 · Complex Project
Large project (~100 tasks, multiple resources, sub‑tasks) that stresses mapping and relationship generation. Key constructs:

* Nested `outlineNumber` hierarchy ("1.1.1" etc.)
* Milestones (duration = 0)
* Split assignments (same task + resource multiple times with different start/finish)
* Multiple calendar exceptions in `properties` (if schema expands)

## 3 · Edge‑Case Project
Designed to surface edge conditions:

* Tasks without resources (unassigned)
* Resources without assignments
* Circular predecessors (should still pass schema but flagged in later logic)
* Extremely long task name, special characters
* Zero‑duration and 100 percent‑complete tasks

---

### Directory Layout

```
mock/
├── data/
│   ├── simple-project.json
│   ├── complex-project.json
│   └── edge-case-project.json
└── SCENARIOS.md  ← this file
```

Each mock JSON file **must**:
1. Validate against `project-schema.json`.
2. Keep within 200 KB to keep repo size reasonable.

---

### Next Steps
1. Generate actual mock JSON files according to the above scenarios (`task 5.2`).
2. Add loader utility to switch application into mock mode (`task 5.3`).
