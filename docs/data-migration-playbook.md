# Data Migration Playbook

This playbook contains exact command recipes for user and course data migration and cleanup.

## Prerequisites

- Node and npm installed
- Source and destination databases reachable
- UUID(s) for target user(s) or course(s)

## 1) Export a single user bundle from source

```bash
SOURCE_DATABASE_URL="postgresql://user:pass@host:5432/source_db" \
npm run db:export:user-bundle -- \
  --user-id "USER_UUID" \
  --output "./tmp/user-bundle.json"
```

Equivalent env-var usage:

```bash
SOURCE_DATABASE_URL="postgresql://user:pass@host:5432/source_db" \
USER_ID="USER_UUID" \
EXPORT_PATH="./tmp/user-bundle.json" \
npm run db:export:user-bundle
```

## 2) Import a user bundle into destination

```bash
DESTINATION_DATABASE_URL="postgresql://user:pass@host:5432/dest_db" \
npm run db:import:user-bundle -- \
  --input "./tmp/user-bundle.json"
```

Equivalent env-var usage:

```bash
DESTINATION_DATABASE_URL="postgresql://user:pass@host:5432/dest_db" \
IMPORT_PATH="./tmp/user-bundle.json" \
npm run db:import:user-bundle
```

Notes:

- User import expects referenced tee configurations to exist for imported rounds.

## 3) Hard delete users by id list

Dry run first (recommended):

```bash
DATABASE_URL="postgresql://user:pass@host:5432/target_db" \
npm run db:hard-delete:users -- \
  --user-ids "UUID_1,UUID_2" \
  --dry-run
```

Execute real delete:

```bash
DATABASE_URL="postgresql://user:pass@host:5432/target_db" \
npm run db:hard-delete:users -- \
  --user-ids "UUID_1,UUID_2"
```

Use input file instead of CSV:

```json
["UUID_1", "UUID_2"]
```

or

```json
{ "userIds": ["UUID_1", "UUID_2"] }
```

```bash
DATABASE_URL="postgresql://user:pass@host:5432/target_db" \
npm run db:hard-delete:users -- \
  --input "./tmp/user-ids.json" \
  --dry-run
```

## 4) Export a single course bundle from source

Course export includes:

- courses
- tee_configurations
- holes
- rounds tied to tee configurations
- hole_scores for those rounds

```bash
SOURCE_DATABASE_URL="postgresql://user:pass@host:5432/source_db" \
npm run db:export:course-bundle -- \
  --course-id "COURSE_UUID" \
  --output "./tmp/course-bundle.json"
```

Equivalent env-var usage:

```bash
SOURCE_DATABASE_URL="postgresql://user:pass@host:5432/source_db" \
COURSE_ID="COURSE_UUID" \
EXPORT_PATH="./tmp/course-bundle.json" \
npm run db:export:course-bundle
```

## 5) Import a course bundle into destination

```bash
DESTINATION_DATABASE_URL="postgresql://user:pass@host:5432/dest_db" \
npm run db:import:course-bundle -- \
  --input "./tmp/course-bundle.json"
```

Equivalent env-var usage:

```bash
DESTINATION_DATABASE_URL="postgresql://user:pass@host:5432/dest_db" \
IMPORT_PATH="./tmp/course-bundle.json" \
npm run db:import:course-bundle
```

Notes:

- Course import expects referenced players to exist for imported rounds.

## 6) Hard delete courses by id list

Dry run first (recommended):

```bash
DATABASE_URL="postgresql://user:pass@host:5432/target_db" \
npm run db:hard-delete:courses -- \
  --course-ids "COURSE_UUID_1,COURSE_UUID_2" \
  --dry-run
```

Execute real delete:

```bash
DATABASE_URL="postgresql://user:pass@host:5432/target_db" \
npm run db:hard-delete:courses -- \
  --course-ids "COURSE_UUID_1,COURSE_UUID_2"
```

Use input file instead of CSV:

```json
["COURSE_UUID_1", "COURSE_UUID_2"]
```

or

```json
{ "courseIds": ["COURSE_UUID_1", "COURSE_UUID_2"] }
```

```bash
DATABASE_URL="postgresql://user:pass@host:5432/target_db" \
npm run db:hard-delete:courses -- \
  --input "./tmp/course-ids.json" \
  --dry-run
```

## Suggested migration sequence

1. Export from source.
2. Import into destination.
3. Validate in destination.
4. Run hard-delete dry run in source.
5. Run real hard delete in source.
