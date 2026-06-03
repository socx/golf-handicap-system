# stories-players.md
Parent Epic: #297  
(Replace with actual epic issue number after creation)

---

# Player Management — User Stories

This file contains all user stories for the Player Management epic, including:
- Story narrative  
- Acceptance criteria  
- Dependencies  
- Size (XS/S/M/L/XL)  
- Estimate (0.5–15 days)  
- Priority  
- Target date (sequential, 6‑hour days, weekdays only)

Start date for this epic (after Authentication epic ends): **28 May 2026**

---

## 1. Create players table & migrations

**As a developer**  
I want to create the `players` table and migrations  
So that player profiles are stored separately from authentication identities.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** High  
**Target Date:** **28 May 2026**

### Acceptance Criteria
- [ ] `players` table includes: id, first_name, last_name, middle_name, dob, gender, club, email, country, handicap_index, user_id (nullable), timestamps, deleted_at.  
- [ ] Email unique where applicable.  
- [ ] Soft delete supported.  
- [ ] Migrations apply and roll back cleanly.

### Dependencies
- Users table  
- Migration tooling

---

## 2. Implement create player API

**As a developer**  
I want to implement a create player endpoint  
So that admins (or self‑service flows) can add new players.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** High  
**Target Date:** **02 June 2026**

### Acceptance Criteria
- [ ] POST `/players` accepts required fields and validates them.  
- [ ] Duplicate player emails rejected.  
- [ ] Returns created player object.  
- [ ] Only authenticated users with correct role can create players.

### Dependencies
- Players table  
- Auth middleware

---

## 3. Implement update player API

**As a developer**  
I want to implement an update player endpoint  
So that player details can be corrected or updated over time.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** Medium  
**Target Date:** **04 June 2026**

### Acceptance Criteria
- [ ] PATCH `/players/:id` supports partial updates.  
- [ ] Validation rules enforced (country code, gender enum, DOB).  
- [ ] Returns updated player object.  
- [ ] Updating deleted players returns error.

### Dependencies
- Create player API

---

## 4. Implement player search & filtering

**As a developer**  
I want to implement player search and filtering  
So that admins can quickly find players by name, email, club, or country.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** Medium  
**Target Date:** **08 June 2026**

### Acceptance Criteria
- [ ] GET `/players` supports `search`, `club`, `country`, `page`, `limit`.  
- [ ] Search matches first/last name and email.  
- [ ] Pagination metadata included.  
- [ ] Soft‑deleted players excluded.

### Dependencies
- Players table  
- Basic CRUD endpoints

---

## 5. Implement player linking to user accounts

**As a developer**  
I want to link a player profile to a user account  
So that authenticated users can manage their own player data.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** Medium  
**Target Date:** **10 June 2026**

### Acceptance Criteria
- [ ] PATCH `/players/:id/link-user` links player to user_id.  
- [ ] Only admins can link/unlink.  
- [ ] A user cannot be linked to multiple players.  
- [ ] Linking logged in audit trail.

### Dependencies
- Users table  
- Player update API  
- Audit logging

---

## 6. Implement player deletion (soft delete)

**As a developer**  
I want to soft delete players  
So that player profiles can be removed without losing historical round data.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** Medium  
**Target Date:** **12 June 2026**

### Acceptance Criteria
- [ ] DELETE `/players/:id` sets `deleted_at`.  
- [ ] Deleted players excluded from search.  
- [ ] Rounds remain intact and queryable.  
- [ ] Deletion logged.

### Dependencies
- Player CRUD  
- Audit logging

---

## 7. Implement player detail API (with handicap summary)

**As a developer**  
I want an endpoint to fetch a player’s full profile with handicap summary  
So that the frontend can display player details and current index.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** High  
**Target Date:** **16 June 2026**

### Acceptance Criteria
- [x] GET `/players/:id` returns full profile.  
- [x] Includes current handicap index.  
- [x] Includes last handicap update date.  
- [x] Includes basic stats (round count, last round date).

### Dependencies
- Handicap calculation  
- Rounds table  
- Player CRUD

### Implementation Notes
- Extended `GET /api/players/:id` response to include `handicap_summary` and `round_stats` alongside the existing `player` object.
- Handicap summary is sourced from the most recent `handicap_records` entry per player, with fallback to the player table `handicap_index` when no records exist.
- Round stats include active round count (`deleted_at IS NULL`) and latest played date.
- Added e2e coverage in `apps/api/test/players-detail.e2e.test.mjs` for RBAC and enriched detail response fields.

---

## 8. Implement player list export (CSV/JSON)

**As a developer**  
I want to export player lists  
So that admins can download player data for reporting or migration.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** Low  
**Target Date:** **23 June 2026**

### Acceptance Criteria
- [x] GET `/players/export?format=csv|json`.  
- [x] Includes all visible fields.  
- [x] Respects filters (club, country, search).  
- [x] Excludes soft‑deleted players unless explicitly included.

### Dependencies
- Player search  
- RBAC

### Implementation Notes
- Added `GET /api/players/export` and `GET /players/export` with `format=json|csv` validation and admin RBAC enforcement.
- Export uses shared player filter parsing (`search`, `club`, `country`) so behavior matches list/search semantics.
- Soft-deleted players are excluded by default and can be explicitly included with `include_deleted=true` (also supports `includeDeleted=true`).
- Added e2e coverage in `apps/api/test/players-export.e2e.test.mjs` for auth protection, filter behavior, JSON payload fields, CSV output, and soft-delete handling.

---

## 9. Frontend: Player list page

**As a developer**  
I want a player list page in React  
So that admins and users can browse players.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** High  
**Target Date:** **30 June 2026**

### Acceptance Criteria
- [x] `/players` shows paginated list.  
- [x] Search and filters (club, country).  
- [x] Clicking a player opens profile page.  
- [x] Tailwind styling consistent with design system.

### Dependencies
- Player search API  
- Frontend layout shell

### Implementation Notes
- Replaced `/players` placeholder route with a real list page wired to the existing player search/list API.
- Implemented paginated table UI with search, club, and country filters and design-system-consistent Tailwind styling.
- Added player profile navigation from the list (`View Profile`) and introduced a route target at `/players/:playerId` for profile navigation handoff.
- Added frontend tests for list rendering, filter query behavior, API query normalization, and profile-route navigation.

---

## 10. Frontend: Player profile page

**As a developer**  
I want a player profile page  
So that users can view player details and handicap history.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** High  
**Target Date:** **05 July 2026**

### Acceptance Criteria
- [x] `/players/:id` shows full profile.  
- [x] Shows handicap index + last update.  
- [x] Shows basic stats (round count, last round date).  
- [x] Responsive layout.

### Dependencies
- Player detail API  
- Handicap history API (from Handicap epic)

### Implementation Notes
- Extended `playersApi.get()` in `apps/web/src/api/players.ts` to consume enriched player detail response fields (`player`, `handicap_summary`, `round_stats`) with backward-safe defaults.
- Updated `apps/web/src/pages/PlayerProfilePage.tsx` to render a dedicated `Performance Snapshot` panel showing current handicap index, handicap last update date, total rounds recorded, and last round date.
- Preserved the existing handicap widget and responsive 1/3-column layout so profile details and history remain accessible on desktop and mobile.
- Updated `apps/web/src/pages/PlayerEditPage.tsx` to use the adjusted `playersApi.get()` response shape.
- Added frontend tests in `apps/web/src/test/PlayerProfilePage.test.tsx` for enriched profile rendering, fallback values, API call wiring, and error state.
- Updated `apps/web/src/test/PlayerEditPage.test.tsx` mocks for the new player detail API response shape.

---

## 11. Frontend: Player edit form

**As a developer**  
I want a player edit form  
So that admins can update player details.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** Medium  
**Target Date:** **10 July 2026**

### Acceptance Criteria
- [x] Form supports editing all fields.  
- [x] Validation errors shown clearly.  
- [x] Save triggers PATCH `/players/:id`.  
- [x] Success shows toast + redirect.

### Dependencies
- Update player API  
- Frontend routing

### Implementation Notes
- Added `handleGetPlayer` handler to `apps/api/src/routes/players.ts` exposing `GET /players/:id` (admin auth required).
- Wired `GET /players/:id` in `apps/api/src/app.ts`.
- Extended `apps/web/src/api/players.ts`: added `dob`/`gender` to `Player` type, `PlayerUpdatePayload` interface, `playersApi.get()` and `playersApi.update()` methods.
- Created `apps/web/src/pages/PlayerEditPage.tsx` with form for all player fields, client-side validation, success toast + redirect to `/players`, server error display.
- Wired `/players/:playerId/edit` route in `App.tsx`; added Edit button on `PlayersPage`.
- Extended `InputProps` to accept `step`, `min`, `max`, `aria-describedby` for numeric inputs.
- Tests: `apps/web/src/test/PlayerEditPage.test.tsx` — 5 tests covering load/populate, required validation, PATCH on submit, server error display, cancel navigation.

---

# End of stories-players.md
