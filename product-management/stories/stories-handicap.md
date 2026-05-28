# stories-handicap.md
Parent Epic: #300  
(Replace with actual epic issue number after creation)

---

# Handicap Calculation (WHS) — User Stories

This file contains all user stories for the Handicap Calculation epic, including:
- Story narrative  
- Acceptance criteria  
- Dependencies  
- Size (XS/S/M/L/XL)  
- Estimate (0.5–15 days)  
- Priority  
- Target date (sequential, 6‑hour days, weekdays only)

Start date for this epic (after Rounds epic ends): **14 September 2026**

---

## 1. Implement score differential calculation

**As a developer**  
I want to implement WHS score differential calculation  
So that each round has a differential used for handicap index.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** High  
**Target Date:** **17 September 2026**

### Acceptance Criteria
- [x] Differential formula implemented:  
  `113 / slope_rating × (Adjusted Gross Score − Course Rating − PCC Adjustment)`  
- [x] Stored in `rounds.score_differential`.  
- [x] Supports 9‑hole and 18‑hole rounds.  
- [x] Unit tests verify calculations against known WHS examples.

### Dependencies
- Adjusted gross score  
- Tee configuration ratings  
- Rounds table

### Implementation Notes
- Implemented score differential calculation in `apps/api/src/routes/rounds.ts` during round creation.
- Formula applied as: `113 / slope_rating * (adjusted_gross_score - course_rating - pcc_adjustment)`.
- Result is stored in `rounds.score_differential` at insert time.
- Current implementation uses `pcc_adjustment = 0` until story 2 (PCC) is implemented.
- Differential remains `null` when course rating or slope rating is unavailable.
- Added known-example API test coverage for both 18-hole and 9-hole rounds in `apps/api/test/rounds-create.e2e.test.mjs`.

---

## 2. Implement PCC (Playing Conditions Calculation)

**As a developer**  
I want to implement PCC adjustments  
So that differentials reflect abnormal playing conditions.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** Medium  
**Target Date:** **24 September 2026**

### Acceptance Criteria
- [x] PCC calculated daily per course/tee configuration.  
- [x] PCC values: -1, 0, +1, +2, +3.  
- [x] Applied automatically to differential calculation.  
- [x] PCC stored in `rounds.pcc`.  
- [x] Admin override available.

### Dependencies
- Differential calculation  
- Rounds table  
- Admin RBAC

### Implementation Notes
- Added `rounds.pcc` and `tee_configuration_daily_pcc` in `db/migrations/011_pcc.sql`.
- Round creation now reuses the daily PCC record for the tee configuration and played date.
- Admin `PATCH /api/admin/tee-configurations/:configId/pcc` can calculate or override PCC for a given date and backfill affected rounds.
- The score differential formula now uses the stored PCC value when a round is created or when daily PCC is recalculated.
- Added API e2e coverage for default PCC storage and admin override backfill behavior in `apps/api/test/rounds-create.e2e.test.mjs`.

---

## 3. Implement WHS differential selection logic (3–20 rounds)

**As a developer**  
I want to implement WHS rules for selecting differentials  
So that the correct number of lowest differentials are used.

**Size:** L  
**Estimate:** 6–10 days  
**Priority:** High  
**Target Date:** **04 October 2026**

### Acceptance Criteria
- [x] Uses WHS table for number of differentials based on rounds available.  
- [x] Selects lowest differentials.  
- [x] Applies 0.96 multiplier.  
- [x] Truncates to 1 decimal place.  
- [x] Supports 9‑hole round pairing rules.  
- [x] Fully unit tested.

### Dependencies
- Differential calculation  
- Rounds table  
- Handicap_records table

### Implementation Notes
- Added WHS 3–20 differential selection logic in `apps/api/src/services/handicap.ts`.
- Implemented 9-hole pairing into 18-hole equivalents before applying WHS selection.
- Added `POST /api/handicap/calculate/:playerId` in `apps/api/src/routes/handicap.ts` and wired it in `apps/api/src/app.ts`.
- Calculation applies WHS count table, selects lowest differentials, applies 0.96 multiplier, and truncates to one decimal.
- Added `handicap_records` schema in `db/migrations/012_handicap_records.sql` and persist calculation results there.
- Added API e2e coverage for WHS selection/truncation and 9-hole pairing in `apps/api/test/rounds-create.e2e.test.mjs`.

---

## 4. Implement eligibility check (minimum 54 holes)

**As a developer**  
I want an eligibility check for handicap calculation  
So that players without enough holes are clearly informed.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** Medium  
**Target Date:** **06 October 2026**

### Acceptance Criteria
- [x] Endpoint `/handicap/eligibility/:playerId` returns total eligible holes.  
- [x] If fewer than 54 holes, handicap calculation returns `eligibilityStatus: "insufficient_holes"`.  
- [x] 9‑hole rounds combined appropriately.  
- [x] Frontend displays clear messaging.

### Dependencies
- Rounds table  
- Differential calculation

### Implementation Notes
- Added `GET /api/handicap/eligibility/:playerId` in `apps/api/src/routes/handicap.ts` and wired it in `apps/api/src/app.ts`.
- Eligibility now reports `totalEligibleHoles` using effective differentials, where two 9-hole rounds are paired into one 18-hole equivalent and unpaired 9-hole rounds are not counted.
- `POST /api/handicap/calculate/:playerId` now returns `eligibilityStatus: "insufficient_holes"` when fewer than 54 eligible holes exist.
- Added shared eligibility constants/helpers in `apps/api/src/services/handicap.ts`.
- Added e2e coverage for eligibility endpoint behavior and insufficient-hole calculation responses in `apps/api/test/rounds-create.e2e.test.mjs`.

---

## 5. Implement soft cap / hard cap logic

**As a developer**  
I want to implement WHS soft and hard caps  
So that handicap increases are controlled according to WHS rules.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** Medium  
**Target Date:** **11 October 2026**

### Acceptance Criteria
- [x] Soft cap: limits upward movement beyond 3 strokes.  
- [x] Hard cap: absolute limit of 5 strokes above low‑handicap index.  
- [x] Low‑handicap index stored and updated.  
- [x] Cap effects logged in handicap history.

### Dependencies
- Differential selection  
- Handicap history table

### Implementation Notes
- Added `applyWhsCaps` in `apps/api/src/services/handicap.ts` to enforce WHS soft cap (+3 threshold with 50% reduction above threshold) and hard cap (+5 absolute ceiling).
- Updated `POST /api/handicap/calculate/:playerId` in `apps/api/src/routes/handicap.ts` to apply cap logic after differential selection and before persisting results.
- Added `low_handicap_index` persistence/update behavior on `players` and included cap metadata in API response.
- Logged cap effects in `handicap_records.cap_adjustments` (raw vs applied index, soft/hard trigger flags, thresholds, and low-handicap reference value).
- Added migration `db/migrations/013_player_low_handicap_index.sql` for `players.low_handicap_index`.
- Added e2e coverage for soft cap and hard cap behavior in `apps/api/test/rounds-create.e2e.test.mjs`.

---

## 6. Implement handicap index calculation endpoint

**As a developer**  
I want an endpoint to calculate and return a player’s handicap index  
So that the frontend can display up‑to‑date handicap information.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** High  
**Target Date:** **13 October 2026**

### Acceptance Criteria
- [x] POST `/handicap/calculate/:playerId` triggers full WHS calculation.  
- [x] Returns:  
  - current index  
  - differentials used  
  - PCC values  
  - cap adjustments  
  - eligibility status  
- [x] Updates `players.handicap_index`.  
- [x] Creates new record in `handicap_records`.

### Dependencies
- Differential selection  
- Soft/hard caps  
- Eligibility check

### Implementation Notes
- Finalized `POST /api/handicap/calculate/:playerId` response contract in `apps/api/src/routes/handicap.ts` to include `currentIndex`, selected differentials, `pccValues`, cap adjustments, and eligibility status.
- `pccValues` are now built from selected rounds and persisted into `handicap_records.pcc_values`.
- Kept cap-adjusted index persistence (`players.handicap_index`) and history creation (`handicap_records`) as part of the endpoint transaction.
- Added e2e assertions in `apps/api/test/rounds-create.e2e.test.mjs` to validate response fields and persisted `pcc_values`/`cap_adjustments`.

---

## 7. Implement handicap history table & migrations

**As a developer**  
I want to store handicap calculation history  
So that players can see how their index has changed over time.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** Medium  
**Target Date:** **15 October 2026**

### Acceptance Criteria
- [ ] `handicap_records` includes: id, player_id, index_value, date, differentials_used, pcc_values, cap_adjustments.  
- [ ] Linked to rounds used.  
- [ ] Queryable by date range.

### Dependencies
- Handicap calculation  
- Rounds table

---

## 8. API: Get handicap history

**As a developer**  
I want an endpoint to fetch handicap history  
So that the frontend can display trends.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** Medium  
**Target Date:** **18 October 2026**

### Acceptance Criteria
- [ ] GET `/handicap/history/:playerId` returns list of handicap_records.  
- [ ] Supports date range filters.  
- [ ] Includes rounds used for each calculation.

### Dependencies
- Handicap history table

---

## 9. Frontend: Handicap summary widget

**As a developer**  
I want a handicap summary widget  
So that players can quickly see their current index.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** Medium  
**Target Date:** **20 October 2026**

### Acceptance Criteria
- [ ] Shows current index + last update date.  
- [ ] Shows eligibility status if insufficient holes.  
- [ ] Links to full handicap history page.

### Dependencies
- Handicap calculation API  
- Player profile page

---

## 10. Frontend: Handicap history chart

**As a developer**  
I want a handicap history chart  
So that players can visualise their handicap trend over time.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** Medium  
**Target Date:** **25 October 2026**

### Acceptance Criteria
- [ ] Line chart showing index over time.  
- [ ] Hover shows date + index + rounds used.  
- [ ] Supports date range filters.  
- [ ] Responsive layout.

### Dependencies
- Handicap history API  
- Charting library

---

## 11. Admin: Handicap override

**As a developer**  
I want an admin override for handicap index  
So that exceptional scoring adjustments can be applied.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** Low  
**Target Date:** **30 October 2026**

### Acceptance Criteria
- [ ] POST `/handicap/override/:playerId` sets manual index.  
- [ ] Reason required.  
- [ ] Override logged in handicap history.  
- [ ] Admin‑only access enforced.

### Dependencies
- RBAC  
- Handicap history table

---

## 12. Admin: Recalculate handicap for all players

**As a developer**  
I want a batch recalculation job  
So that all players’ handicaps can be updated after rule changes or data imports.

**Size:** L  
**Estimate:** 6–10 days  
**Priority:** Low  
**Target Date:** **10 November 2026**

### Acceptance Criteria
- [ ] Background job recalculates all players.  
- [ ] Progress logged.  
- [ ] Errors captured and reported.  
- [ ] Admin endpoint triggers job.

### Dependencies
- Handicap calculation  
- Job scheduler  
- Logging

---

# End of stories-handicap.md
