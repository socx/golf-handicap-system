# stories-rounds.md
Parent Epic: #299  
(Replace with actual epic issue number after creation)

---

# Round Entry & Score Processing — User Stories

This file contains all user stories for the Round Entry & Score Processing epic, including:
- Story narrative  
- Acceptance criteria  
- Dependencies  
- Size (XS/S/M/L/XL)  
- Estimate (0.5–15 days)  
- Priority  
- Target date (sequential, 6‑hour days, weekdays only)

Start date for this epic (after Courses epic ends): **15 July 2026**

---

## 1. Create rounds and hole_scores tables & migrations

**As a developer**  
I want to create the `rounds` and `hole_scores` tables  
So that detailed round data can be stored per player and tee configuration.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** High  
**Target Date:** **15 July 2026**

### Acceptance Criteria
- [x] `rounds` table includes: id, player_id, tee_configuration_id, played_at, playing_handicap, adjusted_gross_score, score_differential, totals, flags, timestamps.  
- [x] `hole_scores` table includes: id, round_id, hole_number, strokes, putts, GIR, fairway_hit, in_sand, penalties, net_double_bogey_adjusted.  
- [x] Hole numbers unique per round.  
- [x] Indexes on player/date and tee_configuration_id.  
- [x] Migrations apply and roll back cleanly.

### Dependencies
- Players table  
- Tee configurations & holes  
- Migration tooling

### Implementation Notes
- Added `009_rounds_and_hole_scores.sql` to `db/migrations` (deploy/CI path) and `packages/db/migrations` (local migration script path).
- `rounds` schema includes core round metadata, aggregate totals, flags, soft-delete column, and timestamps.
- `hole_scores` schema includes per-hole scoring fields and adjustment columns.
- Enforced unique hole number per round via `idx_hole_scores_round_hole_unique`.
- Added indexes for `rounds(player_id, played_at)` and `rounds(tee_configuration_id)` plus `hole_scores(round_id)`.
- Foreign key constraints are added conditionally to avoid migration failures in partially-provisioned environments.
- Added `apps/api/test/rounds-migrations.e2e.test.mjs` to validate schema creation, unique/index presence, and transaction rollback behavior.

---

## 2. API: Enter round with per‑hole scores

**As a developer**  
I want an endpoint to enter a round with per‑hole scores  
So that players can record their performance in detail.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** High  
**Target Date:** **22 July 2026**

### Acceptance Criteria
- [x] POST `/rounds` accepts playerId, teeConfigurationId, playedAt, playingHandicap (optional), and `holeScores[]`.  
- [x] Validates holeScores length matches configuration hole_count.  
- [x] Stores round + hole_scores in a transaction.  
- [x] Returns computed totals and per‑hole data.  
- [x] Validation errors follow standard format.

### Dependencies
- Rounds & hole_scores tables  
- Player and configuration APIs

### Implementation Notes
- Added `apps/api/src/routes/rounds.ts` with `handleCreateRound` to implement `POST /api/rounds` (also exposed as `/rounds`).
- Request payload supports `playerId`, `teeConfigurationId`, `playedAt`, optional `playingHandicap`, and `holeScores[]`.
- Validation includes UUID checks, playedAt parsing, per-hole field checks, unique `holeNumber`, and standard `validation_error` responses with field details.
- Validates `holeScores.length` against `tee_configurations.hole_count` before insert.
- Persists `rounds` and `hole_scores` within a DB transaction.
- Computes and stores totals (`gross_score`, `adjusted_gross_score`, `total_putts`, `total_gir`, `total_fairways_hit`, `total_penalties`) and returns per-hole data sorted by hole number.
- Wired route in `apps/api/src/app.ts` and added e2e coverage in `apps/api/test/rounds-create.e2e.test.mjs`.

---

## 3. Implement Net Double Bogey adjustment per hole

**As a developer**  
I want to compute Net Double Bogey adjusted scores per hole  
So that WHS calculations and scoring summaries are accurate.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** High  
**Target Date:** **29 July 2026**

### Acceptance Criteria
- [x] For each hole, compute Net Double Bogey using stroke index + playing handicap.  
- [x] Store `net_double_bogey_adjusted` in hole_scores.  
- [x] Unit tests cover typical and edge cases.  
- [x] Logic supports 9‑hole and 18‑hole rounds.

### Dependencies
- Round entry API  
- Tee configuration hole data

---

### Implementation Notes
- `apps/api/src/routes/rounds.ts` now computes `net_double_bogey_adjusted` server-side using tee hole `par` + `stroke_index` and rounded `playingHandicap` stroke allocation per hole.
- Net Double Bogey cap formula implemented as `par + 2 + strokes_received_on_hole`, with support for both handicap and plus-handicap allocation.
- Client-provided `netDoubleBogeyAdjusted` input is ignored for persistence; adjusted scores are always derived by server logic.
- Added e2e coverage in `apps/api/test/rounds-create.e2e.test.mjs` for:
	- 9-hole typical case (`playingHandicap: 12.4`) with per-hole adjusted caps.
	- 18-hole edge case for plus handicap (`playingHandicap: -2`).

---

## 4. Compute per‑round aggregates

**As a developer**  
I want to compute per‑round aggregates  
So that the system can display totals and feed WHS calculations.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** High  
**Target Date:** **31 July 2026**

### Acceptance Criteria
- [x] Compute totals: gross score, adjusted gross score, putts, GIR count, fairways hit, penalties.  
- [x] Store aggregates in `rounds` table.  
- [x] Aggregates returned in round detail API.  
- [x] Unit tests included.

### Dependencies
- Net Double Bogey logic  
- Round entry API

### Implementation Notes
- Aggregates are computed during round creation in `apps/api/src/routes/rounds.ts` from submitted hole scores and persisted to the `rounds` table (`gross_score`, `adjusted_gross_score`, `total_putts`, `total_gir`, `total_fairways_hit`, `total_penalties`).
- Added round detail handler `handleGetRound` in `apps/api/src/routes/rounds.ts` and route wiring in `apps/api/src/app.ts` for `GET /api/rounds/:id` (also supports `/rounds/:id`).
- Round detail response now includes persisted aggregate totals and hole scores, enabling downstream scorecard and WHS-related summary reads from stored values.
- Extended e2e coverage in `apps/api/test/rounds-create.e2e.test.mjs`:
	- `GET /api/rounds/:id returns round aggregates and hole scores`
	- `GET /api/rounds/:id returns 404 for unknown rounds`

---

## 5. API: Get round detail (with hole scores)

**As a developer**  
I want an endpoint to fetch a round with all hole scores  
So that the frontend can display a complete scorecard.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** High  
**Target Date:** **02 August 2026**

### Acceptance Criteria
- [x] GET `/rounds/:id` returns round + hole_scores.  
- [x] Includes aggregates and flags.  
- [x] Includes tee configuration metadata.  
- [x] Returns 404 for deleted or missing rounds.

### Dependencies
- Rounds & hole_scores tables  
- Aggregation logic

### Implementation Notes
- Implemented round detail retrieval in `apps/api/src/routes/rounds.ts` via `handleGetRound` for `GET /api/rounds/:id` (also `/rounds/:id`).
- Response includes:
	- Round core fields
	- Aggregates and flags (`grossScore`, `adjustedGrossScore`, totals, tournament/9-hole flags)
	- Tee configuration metadata (`id`, `courseId`, `courseName`, `name`, `teeColour`, `holeCount`, `courseRating`, `slopeRating`)
	- Ordered per-hole `holeScores`
- Returns `404 not_found` for missing/deleted rounds and when referenced tee configuration metadata is unavailable.
- Extended e2e coverage in `apps/api/test/rounds-create.e2e.test.mjs` to assert tee metadata presence in round detail responses.

---

## 6. API: Search rounds (player, date range, course)

**As a developer**  
I want to search and filter rounds  
So that users and admins can find rounds quickly.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** Medium  
**Target Date:** **05 August 2026**

### Acceptance Criteria
- [x] GET `/rounds` supports: `playerId`, `courseId`, `from`, `to`, `page`, `limit`.  
- [x] Pagination metadata included.  
- [x] Soft‑deleted rounds excluded.  
- [x] Sorting by date (desc) by default.

### Dependencies
- Rounds table  
- Player & course APIs

### Implementation Notes
- Added `handleListRounds` in `apps/api/src/routes/rounds.ts` and route wiring in `apps/api/src/app.ts` for `GET /api/rounds` (also `/rounds`).
- Supported query filters:
	- `playerId`
	- `courseId`
	- `from`
	- `to`
	- `page`
	- `limit`
- Search excludes rows where `rounds.deleted_at IS NOT NULL` and orders results by `played_at DESC, created_at DESC`.
- Response includes pagination metadata: `page`, `limit`, `total`, `totalPages`.
- Each round list item includes round aggregates/flags plus course and tee summary fields to support downstream UI list rendering.
- Extended e2e coverage in `apps/api/test/rounds-create.e2e.test.mjs`:
	- `GET /api/rounds filters by player/date and sorts by playedAt descending`
	- `GET /api/rounds filters by course and excludes soft-deleted rounds with pagination`

---

## 7. API: Delete round (soft delete)

**As a developer**  
I want to soft delete rounds  
So that incorrect or duplicate rounds can be removed without losing audit history.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** Medium  
**Target Date:** **07 August 2026**

### Acceptance Criteria
- [x] DELETE `/rounds/:id` sets `deleted_at`.  
- [x] Deleted rounds excluded from search.  
- [x] Deletion logged.  
- [x] Handicap recalculation triggered if needed.

### Dependencies
- Rounds table  
- Audit logging  
- Handicap calculation

### Implementation Notes
- Added `DELETE /api/rounds/:id` with the existing admin authorization model, soft-deleting only active rounds and returning `404` for unknown or already deleted records.
- Reused the rounds list/query `deleted_at IS NULL` behavior from story 6 so deleted rounds disappear from search and detail reads immediately after deletion.
- Persisted a `round_deleted` audit event and, when a deleted round had a stored score differential, emitted a `handicap_recalculation_requested` application event to trigger downstream handicap recomputation once the handicap module consumes these events.
- Added e2e coverage for delete success, audit event persistence, search exclusion, and repeated-delete `404` handling.

---

## 8. Frontend: Round entry form

**As a developer**  
I want a guided round entry form in React  
So that users can easily input round data.

**Size:** L  
**Estimate:** 6–10 days  
**Priority:** High  
**Target Date:** **17 August 2026**

### Acceptance Criteria
- [x] Select player + tee configuration.  
- [x] Per‑hole grid for strokes, putts, GIR, fairway, sand, penalties.  
- [x] Validation errors shown clearly.  
- [x] Save triggers POST `/rounds`.  
- [x] Success shows toast + redirect to scorecard.

### Dependencies
- Round entry API  
- Player & course selectors  
- Frontend layout

---

## 9. Frontend: Scorecard view

**As a developer**  
I want a scorecard view  
So that users can review round details and per‑hole performance.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** High  
**Target Date:** **22 August 2026**

### Acceptance Criteria
- [x] `/rounds/:id` shows per‑hole grid.  
- [x] Shows totals (gross, adjusted, putts, GIR, FIR, penalties).  
- [x] Shows tee configuration metadata.  
- [x] Responsive layout.

### Dependencies
- Round detail API  
- Aggregation logic

---

## 10. Frontend: Round list page

**As a developer**  
I want a round list page  
So that users can browse their historical rounds.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** Medium  
**Target Date:** **27 August 2026**

### Acceptance Criteria
- [x] `/rounds` shows paginated list.  
- [x] Filters: date range, course, tee configuration.  
- [x] Clicking a round opens scorecard.  
- [x] Tailwind styling consistent with design system.

### Dependencies
- Round search API  
- Frontend routing

---

## 11. API: Round approval workflow (admin)

**As a developer**  
I want an approval workflow for rounds  
So that admins can validate rounds before they affect handicap.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** Medium  
**Target Date:** **03 September 2026**

### Acceptance Criteria
- [ ] Rounds have `status`: pending, approved, rejected.  
- [ ] POST `/rounds/:id/approve` and `/reject`.  
- [ ] Approved rounds included in handicap calculation.  
- [ ] Rejection reason stored.  
- [ ] Admin‑only access enforced.

### Dependencies
- Rounds table  
- RBAC  
- Handicap calculation

---

## 12. API: Bulk round import (CSV)

**As a developer**  
I want to import rounds from CSV  
So that admins can migrate historical data.

**Size:** L  
**Estimate:** 6–10 days  
**Priority:** Low  
**Target Date:** **13 September 2026**

### Acceptance Criteria
- [ ] Upload CSV with round + hole score data.  
- [ ] Validates structure and required fields.  
- [ ] Creates rounds + hole_scores in a transaction.  
- [ ] Errors shown clearly in response.

### Dependencies
- Round entry API  
- File upload support  
- Validation schemas

---

# End of stories-rounds.md
