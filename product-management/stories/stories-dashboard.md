# stories-dashboard.md
Parent Epic: #DASHBOARD_EPIC_PLACEHOLDER  
(Replace with actual epic issue number after creation)

---

# Dashboard & Analytics — User Stories

This file contains all user stories for the Dashboard & Analytics epic, including:
- Story narrative  
- Acceptance criteria  
- Dependencies  
- Size (XS/S/M/L/XL)  
- Estimate (0.5–15 days)  
- Priority  
- Target date (sequential, 6‑hour days, weekdays only)
- Guided Links embedded as required

Start date for this epic (after Frontend epic ends): **26 October 2026**

---

## 1. Implement player dashboard API

**As a developer**  
I want an API that returns a player’s dashboard summary  
So that the frontend can display recent rounds, handicap trend, and key stats.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** High  
**Target Date:** **26 October 2026**

### Acceptance Criteria
- [ ] **[GET dashboard summary](ca://s?q=Explain_dashboard_summary_endpoint)** returns:
  - recent rounds (last 5)
  - current handicap index
  - handicap trend (last 10 records)
  - GIR %, FIR %, average putts, penalties
- [ ] Excludes deleted rounds.
- [ ] Returns data in <200ms for typical player.

### Dependencies
- **[Rounds API](ca://s?q=Explain_rounds_API)**  
- **[Handicap calculation](ca://s?q=Explain_handicap_calculation)**  
- **[Player detail API](ca://s?q=Explain_player_detail_API)**

---

## 2. Implement admin dashboard API

**As a developer**  
I want an admin dashboard API  
So that admins can see system‑wide metrics.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** Medium  
**Target Date:** **28 October 2026**

### Acceptance Criteria
- [ ] **[GET admin dashboard](ca://s?q=Explain_admin_dashboard_endpoint)** returns:
  - total players
  - total rounds
  - rounds pending approval
  - average handicap distribution
  - recent activity log (last 20 events)
- [ ] Admin‑only access enforced.

### Dependencies
- **[RBAC](ca://s?q=Explain_RBAC)**  
- **[Rounds search](ca://s?q=Explain_round_search)**  
- **[Audit logs](ca://s?q=Explain_audit_logs)**

---

## 3. Implement analytics service (backend)

**As a developer**  
I want a backend analytics service  
So that complex metrics can be computed efficiently and reused across endpoints.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** High  
**Target Date:** **02 November 2026**

### Acceptance Criteria
- [ ] **[Analytics service](ca://s?q=Explain_analytics_service)** computes:
  - GIR %, FIR %, average putts, penalties
  - scoring averages (front/back/overall)
  - handicap trend data
- [ ] Optimised SQL queries with indexes.
- [ ] Unit tests for all metrics.

### Dependencies
- **[Rounds table](ca://s?q=Explain_rounds_table)**  
- **[Hole scores](ca://s?q=Explain_hole_scores)**

---

## 4. Frontend: Player dashboard page

**As a developer**  
I want a player dashboard page  
So that players can see their performance at a glance.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** High  
**Target Date:** **07 November 2026**

### Acceptance Criteria
- [ ] `/dashboard` shows:
  - handicap summary widget
  - recent rounds widget
  - stats widget (GIR, FIR, putts, penalties)
  - handicap trend chart
- [ ] Uses responsive grid layout.
- [ ] Uses analytics API.

### Dependencies
- **[Player dashboard API](ca://s?q=Explain_dashboard_summary_endpoint)**  
- **[UI components](ca://s?q=Explain_UI_components)**  
- **[Charting library](ca://s?q=Explain_charting_library)**

---

## 5. Frontend: Handicap trend chart

**As a developer**  
I want a handicap trend chart  
So that players can visualise their handicap progression.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** Medium  
**Target Date:** **09 November 2026**

### Acceptance Criteria
- [ ] Line chart with:
  - index value
  - date
  - tooltip showing rounds used
- [ ] Supports date range filters.
- [ ] Responsive layout.

### Dependencies
- **[Handicap history API](ca://s?q=Explain_handicap_history_API)**  
- **[Charting library](ca://s?q=Explain_charting_library)**

---

## 6. Frontend: Recent rounds widget

**As a developer**  
I want a recent rounds widget  
So that players can quickly access their latest rounds.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** Medium  
**Target Date:** **11 November 2026**

### Acceptance Criteria
- [ ] Shows last 5 rounds with:
  - date
  - course
  - gross score
  - adjusted score
- [ ] Clicking opens scorecard.
- [ ] Skeleton loading state included.

### Dependencies
- **[Rounds search API](ca://s?q=Explain_round_search)**  
- **[Scorecard view](ca://s?q=Explain_scorecard_view)**

---

## 7. Frontend: Stats widget (GIR, FIR, putts, penalties)

**As a developer**  
I want a stats widget  
So that players can see their key performance metrics.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** Medium  
**Target Date:** **13 November 2026**

### Acceptance Criteria
- [ ] Displays:
  - GIR %
  - FIR %
  - average putts
  - average penalties
- [ ] Uses analytics service.
- [ ] Responsive layout.

### Dependencies
- **[Analytics service](ca://s?q=Explain_analytics_service)**

---

## 8. Frontend: Course performance analytics

**As a developer**  
I want course‑specific analytics  
So that players can see how they perform on different courses.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** Medium  
**Target Date:** **18 November 2026**

### Acceptance Criteria
- [ ] `/analytics/courses/:courseId` shows:
  - scoring average
  - GIR/FIR %
  - penalties
  - best/worst holes
- [ ] Supports 9‑hole and 18‑hole courses.
- [ ] Uses backend analytics service.

### Dependencies
- **[Course detail API](ca://s?q=Explain_course_detail_API)**  
- **[Analytics service](ca://s?q=Explain_analytics_service)**

---

## 9. Admin: System analytics page

**As a developer**  
I want a system analytics page  
So that admins can see global system metrics.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** Medium  
**Target Date:** **23 November 2026**

### Acceptance Criteria
- [ ] `/admin/analytics` shows:
  - total players
  - total rounds
  - rounds pending approval
  - handicap distribution chart
  - activity log
- [ ] Admin‑only access enforced.

### Dependencies
- **[Admin dashboard API](ca://s?q=Explain_admin_dashboard_endpoint)**  
- **[RBAC](ca://s?q=Explain_RBAC)**

---

## 10. Implement caching for dashboard endpoints

**As a developer**  
I want caching for dashboard endpoints  
So that performance remains fast even with large datasets.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** Low  
**Target Date:** **25 November 2026**

### Acceptance Criteria
- [ ] Cache player dashboard for 5 minutes.  
- [ ] Cache admin dashboard for 1 minute.  
- [ ] Cache invalidated on round creation, approval, or deletion.  
- [ ] Cache layer documented.

### Dependencies
- **[Dashboard APIs](ca://s?q=Explain_dashboard_summary_endpoint)**  
- **[Caching layer](ca://s?q=Explain_caching_layer)**

---

# End of stories-dashboard.md
