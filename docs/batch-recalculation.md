# Batch Handicap Recalculation API

## Overview

The Batch Recalculation API allows administrators to trigger bulk handicap recalculation for all players in the system. This is useful after rule changes, data imports, or system maintenance.

## Endpoints

### 1. Start Batch Recalculation

**Trigger a new batch recalculation job**

- **Method**: `POST`
- **Path**: `/api/admin/batch/recalculate-all`
- **Authentication**: Required (admin role)
- **Response**: 202 Accepted

#### Request

```bash
curl -X POST http://localhost:3000/api/admin/batch/recalculate-all \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

#### Response (202 Accepted)

```json
{
  "jobId": "batch_1719496800000_a1b2c3d4e",
  "status": "started",
  "totalPlayers": 250,
  "message": "Batch recalculation job started. You can track progress using /admin/batch/jobs/batch_1719496800000_a1b2c3d4e"
}
```

### 2. Get Job Status

**Retrieve the status and progress of a batch job**

- **Method**: `GET`
- **Path**: `/api/admin/batch/jobs/{jobId}`
- **Authentication**: Required (admin role)
- **Response**: 200 OK

#### Request

```bash
curl -X GET http://localhost:3000/api/admin/batch/jobs/batch_1719496800000_a1b2c3d4e \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

#### Response (200 OK)

```json
{
  "jobId": "batch_1719496800000_a1b2c3d4e",
  "status": "in_progress",
  "totalPlayers": 250,
  "processedPlayers": 127,
  "successfulRecalculations": 125,
  "failedRecalculations": 2,
  "progressPercent": 51,
  "estimatedTimeRemaining": 45000,
  "startedAt": "2024-06-27T12:00:00Z",
  "completedAt": null,
  "errors": [
    {
      "playerId": "550e8400-e29b-41d4-a716-446655440001",
      "error": "Player not found"
    }
  ]
}
```

### 3. List Batch Jobs

**View all batch recalculation jobs**

- **Method**: `GET`
- **Path**: `/api/admin/batch/jobs`
- **Authentication**: Required (admin role)
- **Response**: 200 OK

#### Request

```bash
curl -X GET http://localhost:3000/api/admin/batch/jobs \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

#### Response (200 OK)

```json
{
  "total": 3,
  "jobs": [
    {
      "jobId": "batch_1719496800000_a1b2c3d4e",
      "status": "completed",
      "totalPlayers": 250,
      "processedPlayers": 250,
      "progressPercent": 100,
      "startedAt": "2024-06-27T12:00:00Z",
      "completedAt": "2024-06-27T12:15:30Z"
    },
    {
      "jobId": "batch_1719496700000_x7y8z9a1b",
      "status": "in_progress",
      "totalPlayers": 200,
      "processedPlayers": 85,
      "progressPercent": 42,
      "startedAt": "2024-06-27T13:00:00Z",
      "completedAt": null
    }
  ]
}
```

## How It Works

### Flow

1. **Admin triggers** POST `/api/admin/batch/recalculate-all`
2. **Server returns immediately** with 202 Accepted and a jobId
3. **Background process starts** recalculating all player handicaps
4. **Admin polls** GET `/api/admin/batch/jobs/{jobId}` for progress
5. **Job completes** with results and error list

### Technical Details

- **Execution**: Background/non-blocking (setTimeout with setImmediate)
- **Job Tracking**: In-memory Map (lost on server restart)
- **Processing**: Sequential (one player at a time)
- **Error Handling**: Continues on errors; collects all errors
- **Notifications**: Disabled (sendNotifications: false) to avoid email spam
- **Progress Logging**: Console logs every 10 players and at completion

## Response Statuses

### Job Status

| Status | Meaning |
|--------|---------|
| `started` | Job created, processing about to begin |
| `in_progress` | Job is actively recalculating players |
| `completed` | Job finished (may have errors) |
| `failed` | Job encountered fatal error |

### Result Statuses (per player)

- `eligible` - Handicap recalculated successfully
- `insufficient_holes` - Player has < 54 holes (still recorded)
- `not_approved` - Round status prevents calculation
- Error messages captured for failures

## Response Fields

| Field | Type | Description |
|-------|------|-------------|
| jobId | string | Unique job identifier |
| status | string | current job status |
| totalPlayers | number | Total players to process |
| processedPlayers | number | Players processed so far |
| successfulRecalculations | number | Players with successful/valid results |
| failedRecalculations | number | Players with errors |
| progressPercent | number | 0-100% progress |
| estimatedTimeRemaining | number | Milliseconds until completion (null if done) |
| startedAt | ISO string | Job start timestamp |
| completedAt | ISO string \| null | Job completion timestamp |
| errors | array | Array of {playerId, error} objects |

## Use Cases

### After Data Import

When bulk importing rounds, trigger recalculation to update all affected players:

```bash
# 1. Import rounds
curl -X POST http://localhost:3000/api/rounds/import ...

# 2. Recalculate all handicaps
curl -X POST http://localhost:3000/api/admin/batch/recalculate-all \
  -H "Authorization: Bearer ADMIN_TOKEN"

# 3. Track progress
curl -X GET http://localhost:3000/api/admin/batch/jobs/batch_xxx \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### After WHS Rule Update

If handicap calculation rules change, recalculate all players:

```bash
# Update rules in code, then:
curl -X POST http://localhost:3000/api/admin/batch/recalculate-all \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### Scheduled Maintenance

Run periodic recalculations (e.g., daily at midnight):

```javascript
// Example cron job
cron.schedule('0 0 * * *', async () => {
  await fetch('http://localhost:3000/api/admin/batch/recalculate-all', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
});
```

## Performance Characteristics

- **Speed**: ~2-5 players per second (typical)
- **Memory**: Minimal (processes one at a time)
- **CPU**: Moderate (database queries + calculations)
- **For 1000 players**: ~5-8 minutes typical
- **Scalability**: Performance depends on:
  - Number of approved rounds per player
  - Database query speed
  - Available system resources

## Limitations & Notes

1. **In-Memory Storage**: Jobs are lost if server restarts. For production, consider moving to Redis or database.
2. **No Persistence**: No audit trail of batch operations (consider adding).
3. **Sequential Processing**: Could be optimized to parallel processing for faster completion.
4. **No Pause/Resume**: Cannot pause a running job; must wait for completion.
5. **Notifications Disabled**: Players don't receive individual emails during bulk recalculation.

## Error Handling

### Job-Level Errors

If the job fails to start (e.g., database connection lost):

```json
{
  "error": {
    "code": "batch_recalculation_failed",
    "message": "Unable to start batch recalculation job"
  }
}
```

### Player-Level Errors

Captured and reported in the job status:

```json
{
  "errors": [
    {
      "playerId": "550e8400-e29b-41d4-a716-446655440001",
      "error": "Player not found"
    },
    {
      "playerId": "550e8400-e29b-41d4-a716-446655440002",
      "error": "Database connection timeout"
    }
  ]
}
```

## Authorization

- **Required Role**: `admin`
- **Enforcement**: Via `verifyAndAuthorize` middleware
- **Unauthorized Response**: 401 Unauthorized

## Testing

### Quick Test Workflow

```bash
# 1. Start batch job
JOB_ID=$(curl -s -X POST http://localhost:3000/api/admin/batch/recalculate-all \
  -H "Authorization: Bearer ADMIN_TOKEN" | jq -r '.jobId')

# 2. Poll status every second (sample)
for i in {1..30}; do
  curl -s -X GET http://localhost:3000/api/admin/batch/jobs/$JOB_ID \
    -H "Authorization: Bearer ADMIN_TOKEN" | jq '.progressPercent, .status'
  sleep 1
done

# 3. Check final results
curl -s -X GET http://localhost:3000/api/admin/batch/jobs/$JOB_ID \
  -H "Authorization: Bearer ADMIN_TOKEN" | jq '.'
```

### Example Responses at Different Stages

**Just Started (0% progress)**
```json
{
  "status": "started",
  "progressPercent": 0,
  "processedPlayers": 0
}
```

**In Progress (50%)**
```json
{
  "status": "in_progress",
  "progressPercent": 50,
  "processedPlayers": 125,
  "estimatedTimeRemaining": 75000
}
```

**Complete**
```json
{
  "status": "completed",
  "progressPercent": 100,
  "processedPlayers": 250,
  "successfulRecalculations": 248,
  "failedRecalculations": 2,
  "estimatedTimeRemaining": null
}
```

## Future Enhancements

1. **Persistence**: Store jobs in PostgreSQL for durability
2. **Async Processing**: Use job queue (Bull, RabbitMQ) for scalability
3. **Email Reports**: Send completion summary to admin
4. **Pause/Resume**: Allow pausing and resuming long-running jobs
5. **Selective Recalculation**: Filter by date range, handicap range, etc.
6. **Webhooks**: Notify external systems of job completion
7. **Progress Callbacks**: Client-side progress tracking
8. **Bulk Player Groups**: Recalculate specific clubs/regions only

## Related Features

- [Auto-recalculate after round submission](../docs/stories-handicap.md#13) (Story 13)
- [Handicap calculation endpoint](../docs/stories-handicap.md#6) (Story 6)
- [Handicap eligibility check](../docs/stories-handicap.md#4) (Story 4)
- [Admin override endpoint](../docs/stories-handicap.md#11) (Story 11)
