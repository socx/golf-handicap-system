# stories-competitions.md
Parent Epic: #307
(Replace with actual epic issue number after creation)

---

# Competitions & Tournaments - User Stories

This file contains all user stories for the Competitions epic.

Start date for this epic (after core rounds and handicap capabilities): **15 March 2027**

---

## 1. Create competitions and participants tables

**As a developer**
I want to create competition data tables and migrations
So that events and participating players are persisted.

**Size:** M
**Estimate:** 3-5 days
**Priority:** High
**Target Date:** **19 March 2027**

### Acceptance Criteria
- [ ] `competitions` table includes: id, name, format, start_date, end_date, status, created_by, timestamps.
- [ ] `competition_participants` table links players to competitions.
- [ ] Supports event formats: stableford, stroke_play, match_play.
- [ ] Migrations apply and roll back cleanly.

### Dependencies
- Players table
- Rounds table

---

## 2. API: Create and manage competitions

**As a developer**
I want APIs to create and manage competitions
So that admins can schedule and configure tournaments.

**Size:** M
**Estimate:** 3-5 days
**Priority:** High
**Target Date:** **26 March 2027**

### Acceptance Criteria
- [ ] POST `/competitions` creates a competition with format and dates.
- [ ] PATCH `/competitions/:id` updates metadata and status.
- [ ] GET `/competitions` supports status/date filtering.
- [ ] Admin-only access enforced.

### Dependencies
- Competition tables
- RBAC

---

## 3. API: Enroll players and validate eligibility

**As a developer**
I want to enroll players in competitions with validation
So that only eligible players can participate.

**Size:** S
**Estimate:** 1-2 days
**Priority:** High
**Target Date:** **30 March 2027**

### Acceptance Criteria
- [ ] POST `/competitions/:id/participants` enrolls one or many players.
- [ ] Prevents duplicate enrollment.
- [ ] Validates player is active and has eligible handicap where required.
- [ ] Returns participant list with enrollment status.

### Dependencies
- Competition management APIs
- Players API
- Handicap eligibility API

---

## 4. Calculate competition scores with handicaps

**As a developer**
I want competition scoring logic using playing handicap
So that net results and standings are WHS-compliant.

**Size:** L
**Estimate:** 6-10 days
**Priority:** High
**Target Date:** **10 April 2027**

### Acceptance Criteria
- [ ] Stableford, stroke play, and match play scoring rules implemented.
- [ ] Playing handicap applied per player and tee config.
- [ ] Net and gross results stored with calculation trace.
- [ ] Unit tests cover tie and edge scenarios.

### Dependencies
- Handicap module
- Rounds data
- Competition participants

---

## 5. Publish competition results and leaderboard view

**As a developer**
I want a competition results endpoint and UI view
So that players and admins can review final standings.

**Size:** M
**Estimate:** 3-5 days
**Priority:** Medium
**Target Date:** **17 April 2027**

### Acceptance Criteria
- [ ] GET `/competitions/:id/results` returns ranked standings.
- [ ] UI page shows score breakdown and tie handling.
- [ ] Exportable summary supported (PDF hook).
- [ ] Competition closure locks results from editing.

### Dependencies
- Competition scoring logic
- Leaderboard components
- PDF export pipeline

---

# End of stories-competitions.md
