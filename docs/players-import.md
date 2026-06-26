# Players Import API

## Overview

The Players Import API allows administrators to bulk import golf players from a CSV file. The import process validates data and provides detailed feedback on errors before committing to the database.

## Endpoint

- **Method**: `POST`
- **Path**: `/api/players/import`
- **Authentication**: Required (admin role)
- **Content-Type**: `application/json`

## Request Format

```json
{
  "csvText": "first_name,last_name,dob,gender,club,country,email\nJohn,Doe,1980-05-15,male,Pebble Beach,USA,john@example.com",
  "dryRun": true
}
```

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `csvText` | string | Yes | CSV text with player data |
| `dryRun` | boolean | No | If true (default), validates without importing. If false, commits valid data. |

### CSV Format

The CSV must include the following columns (case-insensitive, whitespace-trimmed):

| Column | Type | Required | Description | Example |
|--------|------|----------|-------------|---------|
| `first_name` | string | Yes | Player's first name | John |
| `last_name` | string | Yes | Player's last name | Doe |
| `dob` | date | No | Date of birth (ISO format or YYYY-MM-DD) | 1980-05-15 |
| `gender` | string | No | Gender (male, female, other, prefer_not_to_say) | male |
| `club` | string | No | Golf club affiliation | Pebble Beach |
| `country` | string | Yes | Country code or name (e.g., USA, GB) | USA |
| `email` | string | No | Email address | john@example.com |

### Example CSV

```csv
first_name,last_name,dob,gender,club,country,email
John,Doe,1980-05-15,male,Pebble Beach,USA,john@example.com
Jane,Smith,1985-03-22,female,Augusta,USA,jane@example.com
Bob,Johnson,,other,Torrey Pines,USA,bob@example.com
Maria,Garcia,,,,Spain,maria@example.com
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
        "first_name": "John",
        "last_name": "Doe",
        "dob": "1980-05-15",
        "gender": "male",
        "club": "Pebble Beach",
        "country": "USA",
        "email": "john@example.com"
      },
      "issues": []
    },
    {
      "rowNumber": 3,
      "values": {
        "first_name": "Jane",
        "last_name": "Smith",
        "dob": "1985-03-22",
        "gender": "female",
        "club": "Augusta",
        "country": "USA",
        "email": "jane@example.com"
      },
      "issues": []
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
  "players": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "first_name": "John",
      "last_name": "Doe",
      "middle_name": null,
      "dob": "1980-05-15",
      "gender": "male",
      "club": "Pebble Beach",
      "email": "john@example.com",
      "country": "USA",
      "handicap_index": null,
      "user_id": null,
      "created_at": "2024-06-27T12:00:00Z",
      "updated_at": "2024-06-27T12:00:00Z",
      "deleted_at": null
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "first_name": "Jane",
      "last_name": "Smith",
      "middle_name": null,
      "dob": "1985-03-22",
      "gender": "female",
      "club": "Augusta",
      "email": "jane@example.com",
      "country": "USA",
      "handicap_index": null,
      "user_id": null,
      "created_at": "2024-06-27T12:00:00Z",
      "updated_at": "2024-06-27T12:00:00Z",
      "deleted_at": null
    }
  ]
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
    "totalIssues": 2
  },
  "rows": [
    {
      "rowNumber": 2,
      "values": { ... },
      "issues": []
    },
    {
      "rowNumber": 3,
      "values": { ... },
      "issues": [
        {
          "field": "first_name",
          "message": "First name is required"
        },
        {
          "field": "country",
          "message": "Country is required"
        }
      ]
    }
  ]
}
```

### Duplicate Error Response - 409 Conflict

```json
{
  "error": {
    "code": "duplicate_record",
    "message": "One or more players conflict with existing active records"
  }
}
```

## Validation Rules

1. **first_name** - Required; non-empty string
2. **last_name** - Required; non-empty string
3. **dob** - Optional; must be valid date (ISO 8601 or YYYY-MM-DD format)
4. **gender** - Optional; one of: `male`, `female`, `other`, `prefer_not_to_say`
5. **club** - Optional; any string value
6. **country** - Required; country code or name
7. **email** - Optional; valid email format

## Workflow

### Step 1: Validate with Dry Run

First, always perform a dry run to validate the data:

```bash
curl -X POST http://localhost:3000/api/players/import \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "csvText": "first_name,last_name,dob,gender,club,country,email\nJohn,Doe,1980-05-15,male,Pebble Beach,USA,john@example.com",
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
curl -X POST http://localhost:3000/api/players/import \
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
| `duplicate_record` | 409 | Player already exists in database (unique constraint violation) |
| `player_import_failed` | 500 | Database error during import |

## Important Notes

1. **Atomic Transactions**: The import uses database transactions. If any row fails during actual import (not dry run), all changes are rolled back.

2. **Unique Constraint**: The database enforces a unique constraint on the combination of (first_name, last_name, country). If you attempt to import a player that already exists, the import will fail.

3. **Field Matching**: Use exact case for gender values. The system converts them to lowercase for validation.

4. **Optional Fields**: Fields like `dob`, `gender`, `club`, and `email` are optional and can be empty in the CSV.

5. **Country Format**: Country can be a code (e.g., "USA", "GB") or full name (e.g., "United States", "Great Britain").

6. **Row Numbers**: In error responses, `rowNumber` refers to the CSV row number (1-indexed, where row 1 is the header).

## Example Workflows

### Simple Player Import

```csv
first_name,last_name,country
John,Doe,USA
Jane,Smith,USA
```

### Complete Player Data Import

```csv
first_name,last_name,dob,gender,club,country,email
John,Doe,1980-05-15,male,Pebble Beach,USA,john@example.com
Jane,Smith,1985-03-22,female,Augusta,USA,jane@example.com
Bob,Johnson,1975-08-10,male,Torrey Pines,USA,bob@example.com
```

## Differences from Rounds Import

| Aspect | Players | Rounds |
|--------|---------|--------|
| Endpoint | `POST /api/players/import` | `POST /api/rounds/import` |
| CSV Columns | 7 columns | 22 columns (18 holes + metadata) |
| Dry-run Default | true | true |
| Transaction Scope | All-or-nothing | All-or-nothing |
| Response on Import | Player objects | Round IDs |
| Unique Constraint | (first_name, last_name, country) | (player_id, tee_config_id, played_at) |

## Related Endpoints

- `GET /api/players` - List all players
- `GET /api/players/{id}` - Get player details
- `POST /api/players` - Create single player
- `PATCH /api/players/{id}` - Update player
- `DELETE /api/players/{id}` - Delete player (soft delete)
- `GET /api/players/export` - Export players as CSV

## Testing

See [test-players-import.md](./test-players-import.md) for testing instructions and examples.
