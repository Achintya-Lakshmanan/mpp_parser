# MPP JSON to Power BI Template Generator (`mpp-json-to-pbit`)

## Overview
This project provides a command-line interface (CLI) tool and library to convert Microsoft Project data, previously exported to a specific JSON format, into a Power BI template file (`.pbit`). This allows for rapid visualization and analysis of project data within Power BI without manual setup.

The tool takes a JSON file containing project tasks, resources, and assignments as input and generates a `.pbit` file containing:
- Mapped data tables (Tasks, Resources, Assignments, Properties)
- Predefined DAX measures and calculations
- Default report visuals and page layouts

## Prerequisites
- Node.js (v14 or higher suggested)

## Installation

```bash
npm install -g mpp-json-to-pbit # Or install locally within your project
```

## Usage

```bash
mpp-json-to-pbit --input <path/to/your/project.json> --output <path/to/your/template.pbit> [--custom-dax <path/to/custom-dax.json>]
```

**Arguments:**

*   `--input` / `-i`: (Required) Path to the input JSON file exported from Microsoft Project (using a compatible exporter).
*   `--output` / `-o`: (Required) Path where the generated `.pbit` file should be saved.
*   `--custom-dax` / `-d`: (Optional) Path to a JSON file containing custom DAX measures to merge with or override the standard definitions.

### Input JSON Format
The input JSON file should adhere to the structure expected by the tool, typically including arrays for `tasks`, `resources`, `assignments`, and an object for `properties`.

*(Note: A formal JSON schema definition or link to the exporting tool generating this format should ideally be provided here.)*

### Custom DAX Definitions
The `--custom-dax` option allows you to provide a JSON file containing an array of DAX definitions. Each definition object should have `name`, `table`, and `expression` properties. If a custom measure has the same name and table as a standard measure, the custom one will override it.

Example `custom-dax.json`:
```json
[
  {
    "name": "Total Cost Custom",
    "table": "Resources",
    "expression": "SUMX(Resources, Resources[cost] * 1.1) /* 10% overhead */"
  }
]
```


## Usage

### Development Mode

1. Start the backend server
```
npm run server
```

2. In a separate terminal, start the frontend development server
```
npm run start
```

3. Access the application at http://localhost:3000


## Development

To contribute or run the tool from the source:

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd mpp_parser
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Run the tool (example):**
    ```bash
    node src/cli.js -i src/mock/data/project-data.json -o test-output.pbit
    ```

## Testing

Run the available test suites:

*   **Unit Tests:** Test individual functions (data mapping, validation, etc.).
    ```bash
    npm run test:unit
    ```
*   **Mock Generation Tests:** Perform end-to-end tests using mock JSON data to generate `.pbit` files.
    ```bash
    npm run test:mock
    ```

## License
This project is licensed under the ISC License.
