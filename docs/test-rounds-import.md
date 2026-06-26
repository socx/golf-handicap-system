# Testing the Rounds Import API

This document provides examples and instructions for testing the Rounds Import API.

## Prerequisites

1. Backend running on `http://localhost:3000`
2. Valid admin authentication token
3. Records exist in the database for:
   - At least one player (or create test players)
   - At least one course with tee configurations
   - At least one tee configuration with a color

## Quick Test Setup

### Create Test Data

If you don't have test data, create it first:

```bash
# Create a player
curl -X POST http://localhost:3000/api/players \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{
    "first_name": "John",
    "last_name": "Doe",
    "email": "john@example.com"
  }'

# Create a course
curl -X POST http://localhost:3000/api/courses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{
    "name": "Pebble Beach Golf Links",
    "location": "Pebble Beach, CA"
  }'

# Create a tee configuration
curl -X POST http://localhost:3000/api/courses/{courseId}/configurations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{
    "tee_colour": "Blue",
    "course_rating": 73.5,
    "slope_rating": 146,
    "holes": [...]
  }'
```

## Test Cases

### Test 1: Dry Run with Valid Data

This test validates the CSV without importing anything.

```bash
curl -X POST http://localhost:3000/api/rounds/import \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "csvText": "player_name,course_name,tee_colour,played_at,h1_strokes,h2_strokes,h3_strokes,h4_strokes,h5_strokes,h6_strokes,h7_strokes,h8_strokes,h9_strokes,h10_strokes,h11_strokes,h12_strokes,h13_strokes,h14_strokes,h15_strokes,h16_strokes,h17_strokes,h18_strokes\nJohn Doe,Pebble Beach Golf Links,Blue,2024-06-01,4,3,5,4,5,3,4,5,4,4,4,3,5,4,3,4",
    "dryRun": true
  }'
```

**Expected Response** (200 OK):
```json
{
  "dryRun": true,
  "summary": {
    "rowCount": 1,
    "validRows": 1,
    "invalidRows": 0,
    "totalIssues": 0
  },
  "rows": [
    {
      "rowNumber": 2,
      "values": {
        "player_name": "John Doe",
        "course_name": "Pebble Beach Golf Links",
        "tee_colour": "Blue",
        "played_at": "2024-06-01",
        "hole_strokes": [4, 3, 5, 4, 5, 3, 4, 5, 4, 4, 4, 3, 5, 4, 3, 4, 3, 4]
      },
      "issues": [],
      "lookupWarnings": []
    }
  ]
}
```

### Test 2: Dry Run with Validation Errors

Test with missing required fields and invalid data.

```bash
curl -X POST http://localhost:3000/api/rounds/import \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "csvText": "player_name,course_name,tee_colour,played_at,h1_strokes,h2_strokes,h3_strokes,h4_strokes,h5_strokes,h6_strokes,h7_strokes,h8_strokes,h9_strokes,h10_strokes,h11_strokes,h12_strokes,h13_strokes,h14_strokes,h15_strokes,h16_strokes,h17_strokes,h18_strokes\n,Pebble Beach Golf Links,Blue,2024-06-01,4,3,5,4,5,3,4,5,4,4,4,3,5,4,3,4\nJohn Doe,,,2024-06-02,4,3,5,4,5,3,4,5,4,4,4,3,5,4,3,invalid\nJane Smith,Pebble Beach Golf Links,Blue,invalid-date,4,3,5,4,5,3,4,5,4,4,4,3,5,4,3,4",
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
    "totalIssues": 8
  },
  "rows": [
    {
      "rowNumber": 2,
      "values": { ... },
      "issues": [
        {
          "field": "player_name",
          "message": "Player name is required"
        }
      ],
      "lookupWarnings": []
    },
    {
      "rowNumber": 3,
      "values": { ... },
      "issues": [
        {
          "field": "course_name",
          "message": "Course name is required"
        },
        {
          "field": "tee_colour",
          "message": "Tee colour is required"
        },
        {
          "field": "h18_strokes",
          "message": "Hole 18 strokes must be an integer >= 1"
        }
      ],
      "lookupWarnings": []
    },
    {
      "rowNumber": 4,
      "values": { ... },
      "issues": [
        {
          "field": "played_at",
          "message": "Played at must be a valid date (YYYY-MM-DD or ISO format)"
        }
      ],
      "lookupWarnings": []
    }
  ]
}
```

### Test 3: Import Valid Data

Once validation passes, import the data.

```bash
curl -X POST http://localhost:3000/api/rounds/import \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "csvText": "player_name,course_name,tee_colour,played_at,h1_strokes,h2_strokes,h3_strokes,h4_strokes,h5_strokes,h6_strokes,h7_strokes,h8_strokes,h9_strokes,h10_strokes,h11_strokes,h12_strokes,h13_strokes,h14_strokes,h15_strokes,h16_strokes,h17_strokes,h18_strokes\nJohn Doe,Pebble Beach Golf Links,Blue,2024-06-01,4,3,5,4,5,3,4,5,4,4,4,3,5,4,3,4",
    "dryRun": false
  }'
```

**Expected Response** (201 Created):
```json
{
  "dryRun": false,
  "summary": {
    "rowCount": 1,
    "importedRows": 1
  },
  "importedRoundIds": ["550e8400-e29b-41d4-a716-446655440000"]
}
```

### Test 4: Import with Validation Errors

Attempting to import with validation errors should fail.

```bash
curl -X POST http://localhost:3000/api/rounds/import \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "csvText": "player_name,course_name,tee_colour,played_at,h1_strokes,h2_strokes,h3_strokes,h4_strokes,h5_strokes,h6_strokes,h7_strokes,h8_strokes,h9_strokes,h10_strokes,h11_strokes,h12_strokes,h13_strokes,h14_strokes,h15_strokes,h16_strokes,h17_strokes,h18_strokes\n,Pebble Beach Golf Links,Blue,2024-06-01,4,3,5,4,5,3,4,5,4,4,4,3,5,4,3,4",
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
  "rows": [
    {
      "rowNumber": 2,
      "values": { ... },
      "issues": [
        {
          "field": "player_name",
          "message": "Player name is required"
        }
      ],
      "lookupWarnings": []
    }
  ]
}
```

### Test 5: Multiple Rows (Batch Import)

Test importing multiple valid rows at once.

```bash
curl -X POST http://localhost:3000/api/rounds/import \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "csvText": "player_name,course_name,tee_colour,played_at,h1_strokes,h2_strokes,h3_strokes,h4_strokes,h5_strokes,h6_strokes,h7_strokes,h8_strokes,h9_strokes,h10_strokes,h11_strokes,h12_strokes,h13_strokes,h14_strokes,h15_strokes,h16_strokes,h17_strokes,h18_strokes\nJohn Doe,Pebble Beach Golf Links,Blue,2024-06-01,4,3,5,4,5,3,4,5,4,4,4,3,5,4,3,4\nJane Smith,Pebble Beach Golf Links,Blue,2024-06-02,5,4,4,4,4,3,4,4,5,4,5,4,4,5,4,3\nBob Johnson,Pebble Beach Golf Links,Blue,2024-06-03,4,3,4,5,4,4,3,5,4,3,4,3,5,3,4,4",
    "dryRun": false
  }'
```

**Expected Response** (201 Created):
```json
{
  "dryRun": false,
  "summary": {
    "rowCount": 3,
    "importedRows": 3
  },
  "importedRoundIds": [
    "550e8400-e29b-41d4-a716-446655440001",
    "550e8400-e29b-41d4-a716-446655440002",
    "550e8400-e29b-41d4-a716-446655440003"
  ]
}
```

### Test 6: Empty CSV

Test with empty CSV.

```bash
curl -X POST http://localhost:3000/api/rounds/import \
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

### Test 7: Header Only CSV

Test with only header row, no data.

```bash
curl -X POST http://localhost:3000/api/rounds/import \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "csvText": "player_name,course_name,tee_colour,played_at,h1_strokes,h2_strokes,h3_strokes,h4_strokes,h5_strokes,h6_strokes,h7_strokes,h8_strokes,h9_strokes,h10_strokes,h11_strokes,h12_strokes,h13_strokes,h14_strokes,h15_strokes,h16_strokes,h17_strokes,h18_strokes",
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

### Test 8: Unauthorized Access

Test without admin rights.

```bash
curl -X POST http://localhost:3000/api/rounds/import \
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

## Testing with JavaScript/Fetch

```javascript
async function testRoundsImport() {
  const adminToken = 'your-admin-token';
  
  const csvText = `player_name,course_name,tee_colour,played_at,h1_strokes,h2_strokes,h3_strokes,h4_strokes,h5_strokes,h6_strokes,h7_strokes,h8_strokes,h9_strokes,h10_strokes,h11_strokes,h12_strokes,h13_strokes,h14_strokes,h15_strokes,h16_strokes,h17_strokes,h18_strokes
John Doe,Pebble Beach Golf Links,Blue,2024-06-01,4,3,5,4,5,3,4,5,4,4,4,3,5,4,3,4`;

  // Step 1: Dry run
  console.log('Step 1: Dry Run...');
  const dryRunResponse = await fetch('http://localhost:3000/api/rounds/import', {
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
    const importResponse = await fetch('http://localhost:3000/api/rounds/import', {
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
  }
}

testRoundsImport();
```

## Testing with Postman

1. Create a new POST request to `http://localhost:3000/api/rounds/import`
2. Go to the "Headers" tab and add:
   - `Content-Type: application/json`
   - `Authorization: Bearer YOUR_ADMIN_TOKEN`
3. Go to the "Body" tab, select "raw" and paste:
   ```json
   {
     "csvText": "player_name,course_name,tee_colour,played_at,h1_strokes,h2_strokes,h3_strokes,h4_strokes,h5_strokes,h6_strokes,h7_strokes,h8_strokes,h9_strokes,h10_strokes,h11_strokes,h12_strokes,h13_strokes,h14_strokes,h15_strokes,h16_strokes,h17_strokes,h18_strokes\nJohn Doe,Pebble Beach Golf Links,Blue,2024-06-01,4,3,5,4,5,3,4,5,4,4,4,3,5,4,3,4",
     "dryRun": true
   }
   ```
4. Click "Send" and view the response

## Checklist for Testing

- [ ] Dry run passes with valid data
- [ ] Dry run shows validation errors for invalid data
- [ ] Import succeeds with valid data (dryRun: false)
- [ ] Import fails with validation errors (dryRun: false)
- [ ] Multiple rows import correctly
- [ ] Authorization is properly enforced
- [ ] Empty CSV is rejected
- [ ] Header-only CSV is rejected
- [ ] Invalid JSON is rejected
- [ ] Database transactions roll back on error
- [ ] Imported rounds have "pending" status

## Common Issues

### "Player not found"
Ensure the player exists in the database with a matching name (case-insensitive).

### "Course not found"
Ensure the course exists with a matching name.

### "Tee configuration not found"
Ensure the tee configuration exists for the course with the specified colour.

### "Unauthorized"
Ensure the provided token is valid and has admin role.

### "Invalid CSV"
Ensure the CSV has properly formatted headers and all required columns.
