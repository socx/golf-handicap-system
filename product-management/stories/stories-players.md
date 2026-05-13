# stories-players.md
Parent Epic: #PLAYERS_EPIC_PLACEHOLDER  
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
- [ ] GET `/players/:id` returns full profile.  
- [ ] Includes current handicap index.  
- [ ] Includes last handicap update date.  
- [ ] Includes basic stats (round count, last round date).

### Dependencies
- Handicap calculation  
- Rounds table  
- Player CRUD

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
- [ ] GET `/players/export?format=csv|json`.  
- [ ] Includes all visible fields.  
- [ ] Respects filters (club, country, search).  
- [ ] Excludes soft‑deleted players unless explicitly included.

### Dependencies
- Player search  
- RBAC

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
- [ ] `/players` shows paginated list.  
- [ ] Search and filters (club, country).  
- [ ] Clicking a player opens profile page.  
- [ ] Tailwind styling consistent with design system.

### Dependencies
- Player search API  
- Frontend layout shell

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
- [ ] `/players/:id` shows full profile.  
- [ ] Shows handicap index + last update.  
- [ ] Shows basic stats (round count, last round date).  
- [ ] Responsive layout.

### Dependencies
- Player detail API  
- Handicap history API (from Handicap epic)

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
- [ ] Form supports editing all fields.  
- [ ] Validation errors shown clearly.  
- [ ] Save triggers PATCH `/players/:id`.  
- [ ] Success shows toast + redirect.

### Dependencies
- Update player API  
- Frontend routing

---

# End of stories-players.md
