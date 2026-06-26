# Rounds Import API

## Overview

The Rounds Import API allows admins to bulk import golf rounds from a CSV file. The import process validates data and provides detailed feedback on errors before committing to the database.

## Endpoint

- **Method**: `POST`
- **Path**: `/api/rounds/import`
- **Authentication**: Required (admin role)
- **Content-Type**: `application/json`

## Request Format

```json
{
  "csvText": "player_name,course_name,tee_colour,played_at,h1_strokes,h2_strokes,...,h18_strokes\nJohn Doe,Pebble Beach,Blue,2024-06-01,4,3,5,...,4",
  "dryRun": true
}
```

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `csvText` | string | Yes | CSV text with round data |
| `dryRun` | boolean | No | If true (default), validates without importing. If false, commits valid data. |

### CSV Format

The CSV must include the following columns (case-insensitive, whitespace-trimmed):

- `player_name` - Full name of the player (first and last name preferred)
- `course_name` - Name of the golf course
- `tee_colour` - Tee configuration colour (e.g., "Blue", "White", "Red")
- `played_at` - Date round was played (ISO 8601 format: YYYY-MM-DD or timestamp)
- `h1_strokes` through `h18_strokes` - Number of strokes on each hole (integers >= 1)

### Example CSV

```csv
player_name,course_name,tee_colour,played_at,h1_strokes,h2_strokes,h3_strokes,h4_strokes,h5_strokes,h6_strokes,h7_strokes,h8_strokes,h9_strokes,h10_strokes,h11_strokes,h12_strokes,h13_strokes,h14_strokes,h15_strokes,h16_strokes,h17_strokes,h18_strokes
John Doe,Pebble Beach,Blue,2024-06-01,4,3,5,4,5,3,4,5,4,4,4,3,5,4,3,4
Jane Smith,Pebble Beach,Blue,2024-06-02,5,4,4,4,4,3,4,4,5,4,5,4,4,5,4,3
```

## Response Format

### Dry Run Response (Success) - 200 OK

```json
{
  "dryRun": true,
  "summary": {
    "rowCount": 2,
    "validRows": 2,
    "invalidRows": 0,
    "totalIssues": 0
  },
  "rows": [
    {
      "rowNumber": 2,
      "values": {
        "player_name": "John Doe",
        "course_name": "Pebble Beach",
        "tee_colour": "Blue",
        "played_at": "2024-06-01",
        "hole_strokes": [4, 3, 5, 4, 5, 3, 4, 5, 4, 4, 4, 3, 5, 4, 3, 4, 4, 3]
      },
      "issues": [],
      "lookupWarnings": []
    },
    {
      "rowNumber": 3,
      "values": {
        "player_name": "Jane Smith",
        "course_name": "Pebble Beach",
        "tee_colour": "Blue",
        "played_at": "2024-06-02",
        "hole_strokes": [5, 4, 4, 4, 4, 3, 4, 4, 5, 4, 5, 4, 4, 5, 4, 3, 4, 5]
      },
      "issues": [],
      "lookupWarnings": []
    }
  ]
}
```

### Import Response (Success) - 201 Created

```json
{
  "dryRun": false,
  "summary": {
    "rowCount": 2,
    "importedRows": 2
  },
  "importedRoundIds": ["uuid-1", "uuid-2"]
}
```

### Validation Error Response - 400 Bad Request

```json
{
  "error": {
    "code": "validation_error",
    "message": "Import contains validation errors"
  },
  "dryRun": false,
  "summary": {
    "rowCount": 2,
    "validRows": 1,
    "invalidRows": 1,
    "totalIssues": 3
  },
  "rows": [
    {
      "rowNumber": 2,
      "values": { ... },
      "issues": [],
      "lookupWarnings": []
    },
    {
      "rowNumber": 3,
      "values": { ... },
      "issues": [
        {
          "field": "player_name",
          "message": "Player name is required"
        },
        {
          "field": "h5_strokes",
          "message": "Hole 5 strokes must be an integer >= 1"
        }
      ],
      "lookupWarnings": []
    }
  ]
}
```

## Validation Rules

1. **player_name** - Required; matched against first name, last name, or combination (case-insensitive)
2. **course_name** - Required; matched against course name (case-insensitive)
3. **tee_colour** - Required; matched against tee configuration for the course (case-insensitive)
4. **played_at** - Required; must be a valid date (YYYY-MM-DD or ISO format)
5. **hole_strokes** - Required for all 18 holes; must be integers >= 1

## Workflow

### Step 1: Validate with Dry Run

First, always perform a dry run to validate the data:

```bash
curl -X POST http://localhost:3000/api/rounds/import \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "csvText": "player_name,course_name,tee_colour,played_at,h1_strokes,h2_strokes,...,h18_strokes",
    "dryRun": true
  }'
```

### Step 2: Review Validation Results

Check the response for:
- Number of valid rows (`validRows`)
- Number of invalid rows (`invalidRows`)
- Total issues found (`totalIssues`)
- Detailed issues for each row

### Step 3: Import Valid Data

Once validation passes (`invalidRows === 0` and `totalIssues === 0`), perform the actual import:

```bash
curl -X POST http://localhost:3000/api/rounds/import \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "csvText": "...",
    "dryRun": false
  }'
```

## Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `validation_error` | 400 | CSV or validation errors (dry run or with errors) |
| `invalid_json` | 400 | Malformed JSON request |
| `unauthorized` | 401 | Missing or invalid admin authorization |
| `round_import_failed` | 500 | Database error during import |

## Important Notes

1. **Atomic Transactions**: The import uses database transactions. If any row fails during actual import (not dry run), all changes are rolled back.

2. **Status**: Imported rounds start with `pending` status (not automatically approved).

3. **Player Matching**: Players are matched using case-insensitive ILIKE queries on first/last names. If multiple matches exist, the first one found is used.

4. **Course Matching**: Courses and tee configurations are matched case-insensitively.

5. **Row Numbers**: In error responses, `rowNumber` refers to the CSV row number (1-indexed, where row 1 is the header).

## Example: Complete Workflow

### 1. Prepare CSV

```csv
player_name,course_name,tee_colour,played_at,h1_strokes,h2_strokes,h3_strokes,h4_strokes,h5_strokes,h6_strokes,h7_strokes,h8_strokes,h9_strokes,h10_strokes,h11_strokes,h12_strokes,h13_strokes,h14_strokes,h15_strokes,h16_strokes,h17_strokes,h18_strokes
John Doe,Pebble Beach,Blue,2024-06-01,4,3,5,4,5,3,4,5,4,4,4,3,5,4,3,4
```

### 2. Dry Run

```bash
curl -X POST http://localhost:3000/api/rounds/import \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer admin_token" \
  -d '{
    "csvText": "player_name,course_name,tee_colour,played_at,h1_strokes,...",
    "dryRun": true
  }'
```

Response: `validRows: 1, invalidRows: 0, totalIssues: 0`

### 3. Import

```bash
curl -X POST http://localhost:3000/api/rounds/import \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer admin_token" \
  -d '{
    "csvText": "player_name,course_name,tee_colour,played_at,h1_strokes,...",
    "dryRun": false
  }'
```

Response: `importedRows: 1, importedRoundIds: ["uuid-123"]`

## Testing

See [test-rounds-import.md](./test-rounds-import.md) for testing instructions and examples.
