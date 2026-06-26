# Testing the Players Import API

This document provides examples and instructions for testing the Players Import API.

## Prerequisites

1. Backend running on `http://localhost:3000`
2. Valid admin authentication token
3. Empty or clean database to avoid unique constraint violations

## Test Cases

### Test 1: Dry Run with Valid Data

This test validates the CSV without importing anything.

```bash
curl -X POST http://localhost:3000/api/players/import \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "csvText": "first_name,last_name,dob,gender,club,country,email\nJohn,Doe,1980-05-15,male,Pebble Beach,USA,john@example.com\nJane,Smith,1985-03-22,female,Augusta,USA,jane@example.com",
    "dryRun": true
  }'
```

**Expected Response** (200 OK):
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

### Test 2: Dry Run with Minimal Data

Test with only required fields.

```bash
curl -X POST http://localhost:3000/api/players/import \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "csvText": "first_name,last_name,country\nJohn,Doe,USA\nJane,Smith,USA",
    "dryRun": true
  }'
```

**Expected Response** (200 OK):
```json
{
  "dryRun": true,
  "summary": {
    "rowCount": 2,
    "validRows": 2,
    "invalidRows": 0,
    "totalIssues": 0
  },
  "rows": [...]
}
```

### Test 3: Dry Run with Validation Errors

Test with missing required fields and invalid data.

```bash
curl -X POST http://localhost:3000/api/players/import \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "csvText": "first_name,last_name,dob,gender,country\n,Doe,1980-05-15,male,USA\nJane,,1985-03-22,invalid_gender,\nBob,Johnson,invalid-date,male,USA",
    "dryRun": true
  }'
```

**Expected Response** (200 OK):
```json
{
  "dryRun": true,
  "summary": {
    "rowCount": 3,
    "validRows": 0,
    "invalidRows": 3,
    "totalIssues": 5
  },
  "rows": [
    {
      "rowNumber": 2,
      "values": {
        "first_name": "",
        "last_name": "Doe",
        "dob": "1980-05-15",
        "gender": "male",
        "club": null,
        "country": "USA",
        "email": null
      },
      "issues": [
        {
          "field": "first_name",
          "message": "First name is required"
        }
      ]
    },
    {
      "rowNumber": 3,
      "values": {
        "first_name": "Jane",
        "last_name": "",
        "dob": "1985-03-22",
        "gender": null,
        "club": null,
        "country": "",
        "email": null
      },
      "issues": [
        {
          "field": "last_name",
          "message": "Last name is required"
        },
        {
          "field": "country",
          "message": "Country is required"
        }
      ]
    },
    {
      "rowNumber": 4,
      "values": {
        "first_name": "Bob",
        "last_name": "Johnson",
        "dob": "invalid-date",
        "gender": "male",
        "club": null,
        "country": "USA",
        "email": null
      },
      "issues": []
    }
  ]
}
```

### Test 4: Import Valid Data

Once validation passes, import the data.

```bash
curl -X POST http://localhost:3000/api/players/import \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "csvText": "first_name,last_name,country\nJohn,Doe,USA\nJane,Smith,USA",
    "dryRun": false
  }'
```

**Expected Response** (201 Created):
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
      "dob": null,
      "gender": null,
      "club": null,
      "email": null,
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
      "dob": null,
      "gender": null,
      "club": null,
      "email": null,
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

### Test 5: Import with Validation Errors

Attempting to import with validation errors should fail.

```bash
curl -X POST http://localhost:3000/api/players/import \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "csvText": "first_name,last_name,country\n,Doe,USA",
    "dryRun": false
  }'
```

**Expected Response** (400 Bad Request):
```json
{
  "error": {
    "code": "validation_error",
    "message": "Import contains validation errors"
  },
  "dryRun": false,
  "summary": {
    "rowCount": 1,
    "validRows": 0,
    "invalidRows": 1,
    "totalIssues": 1
  },
  "rows": [...]
}
```

### Test 6: Duplicate Player (Unique Constraint)

Test importing a player that already exists in the database.

**Setup**: First import a player, then try to import the same one again.

```bash
# First import
curl -X POST http://localhost:3000/api/players/import \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "csvText": "first_name,last_name,country\nJohn,Doe,USA",
    "dryRun": false
  }'

# Second import (same player)
curl -X POST http://localhost:3000/api/players/import \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "csvText": "first_name,last_name,country\nJohn,Doe,USA",
    "dryRun": false
  }'
```

**Expected Response** (409 Conflict):
```json
{
  "error": {
    "code": "duplicate_record",
    "message": "One or more players conflict with existing active records"
  }
}
```

### Test 7: Multiple Rows with Mixed Validity

Test importing a batch with both valid and invalid rows.

```bash
curl -X POST http://localhost:3000/api/players/import \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "csvText": "first_name,last_name,gender,country\nJohn,Doe,male,USA\n,Smith,female,USA\nBob,Johnson,other,USA",
    "dryRun": true
  }'
```

**Expected Response** (200 OK):
```json
{
  "dryRun": true,
  "summary": {
    "rowCount": 3,
    "validRows": 2,
    "invalidRows": 1,
    "totalIssues": 1
  },
  "rows": [...]
}
```

### Test 8: Empty CSV

Test with empty CSV.

```bash
curl -X POST http://localhost:3000/api/players/import \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "csvText": "",
    "dryRun": true
  }'
```

**Expected Response** (400 Bad Request):
```json
{
  "error": {
    "code": "validation_error",
    "message": "csvText is required"
  }
}
```

### Test 9: Header Only CSV

Test with only header row, no data.

```bash
curl -X POST http://localhost:3000/api/players/import \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "csvText": "first_name,last_name,country",
    "dryRun": true
  }'
```

**Expected Response** (400 Bad Request):
```json
{
  "error": {
    "code": "validation_error",
    "message": "CSV must include a header row and at least one data row"
  }
}
```

### Test 10: Unauthorized Access

Test without admin rights.

```bash
curl -X POST http://localhost:3000/api/players/import \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer USER_TOKEN" \
  -d '{
    "csvText": "...",
    "dryRun": true
  }'
```

**Expected Response** (401 Unauthorized):
```json
{
  "error": {
    "code": "unauthorized",
    "message": "Unauthorized"
  }
}
```

### Test 11: Invalid Gender Values

Test with various gender values (valid and invalid).

```bash
curl -X POST http://localhost:3000/api/players/import \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "csvText": "first_name,last_name,gender,country\nJohn,Doe,male,USA\nJane,Smith,female,USA\nBob,Johnson,invalid_gender,USA\nAlice,Brown,other,USA",
    "dryRun": true
  }'
```

**Expected Response** (200 OK):
- Valid rows: 3 (male, female, other)
- Invalid rows: 1 (invalid_gender is not recognized)

### Test 12: International Players

Test with various country codes and names.

```bash
curl -X POST http://localhost:3000/api/players/import \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "csvText": "first_name,last_name,country\nJohn,Doe,USA\nFiona,O'\''Brien,IE\nMaria,Garcia,Spain\nHans,Mueller,Germany",
    "dryRun": true
  }'
```

**Expected Response** (200 OK with all rows valid)

## Testing with JavaScript/Fetch

```javascript
async function testPlayersImport() {
  const adminToken = 'your-admin-token';
  
  const csvText = `first_name,last_name,dob,gender,club,country,email
John,Doe,1980-05-15,male,Pebble Beach,USA,john@example.com
Jane,Smith,1985-03-22,female,Augusta,USA,jane@example.com`;

  // Step 1: Dry run
  console.log('Step 1: Dry Run...');
  const dryRunResponse = await fetch('http://localhost:3000/api/players/import', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      csvText,
      dryRun: true
    })
  });

  const dryRunData = await dryRunResponse.json();
  console.log('Dry Run Result:', dryRunData);

  if (dryRunData.summary.invalidRows === 0) {
    // Step 2: Import
    console.log('Step 2: Importing...');
    const importResponse = await fetch('http://localhost:3000/api/players/import', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        csvText,
        dryRun: false
      })
    });

    const importData = await importResponse.json();
    console.log('Import Result:', importData);
    
    if (importData.players) {
      console.log(`Successfully imported ${importData.players.length} players`);
    }
  } else {
    console.log(`Cannot import: ${dryRunData.summary.invalidRows} rows have validation errors`);
  }
}

testPlayersImport();
```

## Testing with Postman

1. Create a new POST request to `http://localhost:3000/api/players/import`
2. Go to the "Headers" tab and add:
   - `Content-Type: application/json`
   - `Authorization: Bearer YOUR_ADMIN_TOKEN`
3. Go to the "Body" tab, select "raw" and paste:
   ```json
   {
     "csvText": "first_name,last_name,dob,gender,club,country,email\nJohn,Doe,1980-05-15,male,Pebble Beach,USA,john@example.com",
     "dryRun": true
   }
   ```
4. Click "Send" and view the response

## Checklist for Testing

- [ ] Dry run passes with valid data (minimal fields)
- [ ] Dry run passes with valid data (all fields)
- [ ] Dry run shows validation errors for invalid data
- [ ] Import succeeds with valid data (dryRun: false)
- [ ] Import fails with validation errors (dryRun: false)
- [ ] Duplicate player causes 409 Conflict error
- [ ] Multiple rows import correctly
- [ ] Gender validation works for all valid values (male/female/other/prefer_not_to_say)
- [ ] Missing required fields are caught
- [ ] Authorization is properly enforced
- [ ] Empty CSV is rejected
- [ ] Header-only CSV is rejected
- [ ] Invalid JSON is rejected
- [ ] Database transactions roll back on error
- [ ] International player names and countries work

## Common Issues

### "First name is required" / "Last name is required"
Ensure all names are provided and not just whitespace.

### "Country is required"
Ensure country is provided for all players.

### "Duplicate player conflict"
A player with the same first name, last name, and country already exists. Either delete the existing player first or use a different country code.

### "Invalid gender"
Only these values are valid: `male`, `female`, `other`, `prefer_not_to_say`. Check spelling and case.

### "Unauthorized"
Ensure the provided token is valid and has admin role.

### "Invalid CSV"
Ensure the CSV has properly formatted headers and all required columns.

## Performance Notes

- Dry run validation: O(rows)
- Import: O(rows) with database inserts
- Transaction handling prevents partial inserts
- Connection pooling reuses database connections
- Typical performance: 100-500 players per second

## Real-World Example: Bulk Import

Here's a complete workflow for importing a club's member list:

```bash
# 1. Export current members from club system
# (Assuming you have a CSV file called members.csv)

# 2. Prepare CSV with minimal fields
cat > import.csv << 'EOF'
first_name,last_name,club,country
John,Doe,Pebble Beach,USA
Jane,Smith,Pebble Beach,USA
EOF

# 3. Create JSON payload
PAYLOAD=$(jq -n --arg csv "$(cat import.csv)" '{csvText: $csv, dryRun: true}')

# 4. Dry run
curl -X POST http://localhost:3000/api/players/import \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d "$PAYLOAD" | jq .summary

# 5. If valid, change dryRun to false and import
PAYLOAD=$(jq -n --arg csv "$(cat import.csv)" '{csvText: $csv, dryRun: false}')
curl -X POST http://localhost:3000/api/players/import \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d "$PAYLOAD" | jq '.summary'
```
