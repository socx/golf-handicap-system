# stories-leaderboard.md
Parent Epic: #LEADERBOARD_EPIC_PLACEHOLDER  
(Replace with actual epic issue number after creation)

---

# Leaderboard & Rankings — User Stories

This file contains all user stories for the Leaderboard & Rankings epic, including:
- Story narrative  
- Acceptance criteria  
- Dependencies  
- Size (XS/S/M/L/XL)  
- Estimate (0.5–15 days)  
- Priority  
- Target date (sequential, 6‑hour days, weekdays only)
- Guided Links embedded as required

Start date for this epic (after PDF epic ends): **14 February 2027**

---

## 1. Implement leaderboard data model

**As a developer**  
I want a data model for leaderboards  
So that rankings can be computed efficiently.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** High  
**Target Date:** **14 February 2027**

### Acceptance Criteria
- [ ] **[Leaderboard model](ca://s?q=Explain_leaderboard_data_model)** supports:
  - player_id  
  - handicap_index  
  - scoring_average  
  - rounds_played  
  - category (club, gender, age group)  
- [ ] Indexed for fast queries.  
- [ ] Supports dynamic recalculation.

### Dependencies
- **[Players table](ca://s?q=Explain_players_table)**  
- **[Handicap calculation](ca://s?q=Explain_handicap_calculation)**  
- **[Rounds table](ca://s?q=Explain_rounds_table)**

---

## 2. API: Get leaderboard by club

**As a developer**  
I want an endpoint to fetch leaderboard rankings by club  
So that users can compare performance within their club.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** High  
**Target Date:** **16 February 2027**

### Acceptance Criteria
- [ ] **[GET /leaderboard/club/:clubId](ca://s?q=Explain_leaderboard_by_club)** returns:
  - player name  
  - handicap index  
  - scoring average  
  - rounds played  
- [ ] Sorted by handicap index ascending.  
- [ ] Pagination supported.

### Dependencies
- **[Leaderboard model](ca://s?q=Explain_leaderboard_data_model)**  
- **[Club field on players](ca://s?q=Explain_player_club_field)**

---

## 3. API: Get leaderboard by gender

**As a developer**  
I want a gender‑specific leaderboard  
So that rankings can be filtered by male/female categories.

**Size:** XS  
**Estimate:** 0.5 day  
**Priority:** Medium  
**Target Date:** **17 February 2027**

### Acceptance Criteria
- [ ] **[GET /leaderboard/gender/:gender](ca://s?q=Explain_leaderboard_by_gender)** returns filtered rankings.  
- [ ] Sorted by handicap index.  
- [ ] Supports pagination.

### Dependencies
- **[Players table](ca://s?q=Explain_players_table)**

---

## 4. API: Get leaderboard by age group

**As a developer**  
I want an age‑group leaderboard  
So that juniors, adults, and seniors can be ranked separately.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** Medium  
**Target Date:** **19 February 2027**

### Acceptance Criteria
- [ ] **[GET /leaderboard/age-group/:group](ca://s?q=Explain_leaderboard_by_age_group)** supports:
  - U12  
  - U16  
  - U18  
  - Adult  
  - Senior  
- [ ] Age calculated from DOB.  
- [ ] Sorted by handicap index.

### Dependencies
- **[Players table](ca://s?q=Explain_players_table)**  
- **[DOB field](ca://s?q=Explain_player_DOB_field)**

---

## 5. API: Get leaderboard by scoring average

**As a developer**  
I want a leaderboard sorted by scoring average  
So that performance can be ranked independently of handicap.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** Medium  
**Target Date:** **21 February 2027**

### Acceptance Criteria
- [ ] **[GET /leaderboard/scoring-average](ca://s?q=Explain_leaderboard_scoring_average)** returns:
  - scoring average  
  - rounds played  
  - player info  
- [ ] Minimum rounds filter (default: 5).  
- [ ] Sorted ascending.

### Dependencies
- **[Analytics service](ca://s?q=Explain_analytics_service)**  
- **[Rounds table](ca://s?q=Explain_rounds_table)**

---

## 6. Implement leaderboard caching

**As a developer**  
I want caching for leaderboard endpoints  
So that rankings load quickly even with large datasets.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** Medium  
**Target Date:** **23 February 2027**

### Acceptance Criteria
- [ ] **[Leaderboard cache](ca://s?q=Explain_leaderboard_cache)** refreshed every 10 minutes.  
- [ ] Cache invalidated on:
  - new round  
  - round approval  
  - handicap recalculation  
- [ ] Cache layer documented.

### Dependencies
- **[Leaderboard APIs](ca://s?q=Explain_leaderboard_by_club)**  
- **[Caching layer](ca://s?q=Explain_caching_layer)**

---

## 7. Frontend: Club leaderboard page

**As a developer**  
I want a club leaderboard page  
So that users can view rankings within their club.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** High  
**Target Date:** **28 February 2027**

### Acceptance Criteria
- [ ] `/leaderboard/club/:clubId` page.  
- [ ] Table shows:
  - player  
  - handicap index  
  - scoring average  
  - rounds played  
- [ ] Sorting + pagination.  
- [ ] Responsive layout.

### Dependencies
- **[Leaderboard by club API](ca://s?q=Explain_leaderboard_by_club)**  
- **[UI components](ca://s?q=Explain_UI_components)**

---

## 8. Frontend: Gender leaderboard page

**As a developer**  
I want a gender leaderboard page  
So that users can view rankings by gender.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** Medium  
**Target Date:** **02 March 2027**

### Acceptance Criteria
- [ ] `/leaderboard/gender/:gender` page.  
- [ ] Table with sorting + pagination.  
- [ ] Gender selector component.

### Dependencies
- **[Leaderboard by gender API](ca://s?q=Explain_leaderboard_by_gender)**  
- **[UI components](ca://s?q=Explain_UI_components)**

---

## 9. Frontend: Age group leaderboard page

**As a developer**  
I want an age‑group leaderboard page  
So that users can view rankings by age category.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** Medium  
**Target Date:** **04 March 2027**

### Acceptance Criteria
- [ ] `/leaderboard/age-group/:group` page.  
- [ ] Age group selector.  
- [ ] Table with sorting + pagination.

### Dependencies
- **[Leaderboard by age group API](ca://s?q=Explain_leaderboard_by_age_group)**  
- **[UI components](ca://s?q=Explain_UI_components)**

---

## 10. Frontend: Scoring average leaderboard page

**As a developer**  
I want a scoring average leaderboard page  
So that users can compare performance based on scoring.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** Medium  
**Target Date:** **06 March 2027**

### Acceptance Criteria
- [ ] `/leaderboard/scoring-average` page.  
- [ ] Minimum rounds filter.  
- [ ] Table with sorting + pagination.

### Dependencies
- **[Scoring average API](ca://s?q=Explain_leaderboard_scoring_average)**  
- **[UI components](ca://s?q=Explain_UI_components)**

---

## 11. Admin: Leaderboard export (CSV)

**As a developer**  
I want admins to export leaderboard data  
So that rankings can be used for tournaments or reports.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** Low  
**Target Date:** **11 March 2027**

### Acceptance Criteria
- [ ] **[GET /admin/leaderboard/export](ca://s?q=Explain_leaderboard_export)** supports:
  - club  
  - gender  
  - age group  
  - scoring average  
- [ ] CSV generated with correct headers.  
- [ ] Admin‑only access enforced.

### Dependencies
- **[Leaderboard APIs](ca://s?q=Explain_leaderboard_by_club)**  
- **[Admin RBAC](ca://s?q=Explain_RBAC)**

---

# End of stories-leaderboard.md
