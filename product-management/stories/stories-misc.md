# stories-misc.md
Parent Epic: #320  
(Replace with actual epic issue number after creation)

---

# Miscellaneous, Enhancements, Utilities & Platform Polish — User Stories

This file contains all user stories for the Miscellaneous epic, including:
- Story narrative  
- Acceptance criteria  
- Dependencies  
- Size (XS/S/M/L/XL)  
- Estimate (0.5–15 days)  
- Priority  
- Target date (sequential, 6‑hour days, weekdays only)
- Guided Links embedded as required

Start date for this epic (after Internationalisation epic ends): **03 June 2028**

## Implementation Status Snapshot (26 June 2026)

| Story | Status | Notes |
|---|---|---|
| 1. Dark mode | Partial | Theme context + system preference detection exist, but settings-page persistence path needs consolidation. |
| 2. Global search | Partial | Players/courses search exists separately; unified global search + autocomplete not implemented. |
| 3. Favourites | Not implemented | No favourites data model, API, or dashboard UI yet. |
| 4. Activity feed | Not implemented | No tenant activity feed endpoint/UI yet. |
| 5. User profile page | Partial | Settings page exists, but profile fields/avatar/language coverage is incomplete. |
| 6. Avatar upload + cropping | Not implemented | No upload/crop pipeline yet. |
| 7. What's New page | Implemented | Public What's New page plus admin markdown editor backed by API are implemented. |
| 8. In-app feedback form | Not implemented | No feedback API/table/admin viewer yet. |
| 9. Maintenance banner | Implemented | Public maintenance endpoint + configurable message + dismissible banner implemented. |
| 10. CSV import (players) | Not implemented | Player export exists; player import API is not implemented. |
| 11. CSV import (rounds) | Not implemented | Round CSV import is not implemented. |
| 12. Admin impersonation | Not implemented | No impersonation flow/API/audit events yet. |
| 13. Feature flags | Not implemented | No per-tenant/per-user/global feature-flag system yet. |
| 14. Bug reporting with logs | Not implemented | No bug report workflow/table/admin viewer yet. |
| 15. System health page | Partial | Health/status endpoints exist; admin UI page not implemented. |

---

## 1. Implement dark mode (frontend)

**As a developer**  
I want dark mode support  
So that users can choose a theme that suits their environment.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** Medium  
**Target Date:** **03 June 2028**

### Acceptance Criteria
- [x] **[Dark mode theme](ca://s?q=Explain_dark_mode_theme)** implemented.  
- [x] Auto‑detect system preference.  
- [x] Toggle in settings.  
- [ ] Stored in user preferences.

### Dependencies
- **[Theme system](ca://s?q=Explain_theme_support)**

---

## 2. Implement global search (players, rounds, courses)

**As a developer**  
I want a global search bar  
So that users can quickly find players, rounds, and courses.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** Medium  
**Target Date:** **08 June 2028**

### Acceptance Criteria
- [ ] **[Global search API](ca://s?q=Explain_global_search_API)** supports:
  - players  
  - rounds  
  - courses  
- [ ] Autocomplete suggestions.  
- [ ] Tenant‑scoped.

### Dependencies
- **[Search indexes](ca://s?q=Explain_search_indexing_strategy)**

---

## 3. Implement favourites (players, courses)

**As a developer**  
I want favourites  
So that users can quickly access frequently used items.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** Medium  
**Target Date:** **10 June 2028**

### Acceptance Criteria
- [ ] **[Favourites system](ca://s?q=Explain_favourites_system)** supports:
  - favourite players  
  - favourite courses  
- [ ] Stored per user.  
- [ ] Displayed in dashboard.

### Dependencies
- **[User settings API](ca://s?q=Explain_settings_page)**

---

## 4. Implement activity feed (recent events)

**As a developer**  
I want an activity feed  
So that users can see recent events across their tenant.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** Medium  
**Target Date:** **15 June 2028**

### Acceptance Criteria
- [ ] **[Activity feed API](ca://s?q=Explain_activity_feed_API)** returns:
  - new rounds  
  - approvals  
  - handicap updates  
  - new players  
- [ ] Tenant‑scoped.  
- [ ] Pagination supported.

### Dependencies
- **[Analytics events](ca://s?q=Explain_analytics_event_pipeline)**

---

## 5. Implement user profile page

**As a developer**  
I want a user profile page  
So that users can manage their personal information.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** Medium  
**Target Date:** **17 June 2028**

### Acceptance Criteria
- [ ] **[Profile page](ca://s?q=Explain_user_profile_page)** includes:
  - name  
  - email  
  - avatar  
  - language  
  - theme  
- [ ] Avatar upload supported.

### Dependencies
- **[Object storage](ca://s?q=Explain_object_storage_bucket)**

---

## 6. Implement avatar upload + cropping

**As a developer**  
I want avatar upload and cropping  
So that users can personalise their profile.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** Low  
**Target Date:** **19 June 2028**

### Acceptance Criteria
- [ ] **[Avatar upload](ca://s?q=Explain_avatar_upload_flow)** supports:
  - cropping  
  - resizing  
  - compression  
- [ ] Stored in object storage.  
- [ ] URL saved in user profile.

### Dependencies
- **[Profile page](ca://s?q=Explain_user_profile_page)**

---

## 7. Implement “What’s New” release notes page

**As a developer**  
I want a “What’s New” page  
So that users can see recent updates.

**Size:** XS  
**Estimate:** 0.5 day  
**Priority:** Low  
**Target Date:** **20 June 2028**

### Acceptance Criteria
- [x] **[Release notes page](ca://s?q=Explain_release_notes_page)** shows:
  - new features  
  - improvements  
  - bug fixes  
- [x] Markdown‑based.  
- [x] Admin‑editable.

### Dependencies
- None

---

## 8. Implement in‑app feedback form

**As a developer**  
I want an in‑app feedback form  
So that users can submit suggestions and issues.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** Low  
**Target Date:** **22 June 2028**

### Acceptance Criteria
- [ ] **[Feedback form](ca://s?q=Explain_feedback_form_design)** supports:
  - category  
  - message  
  - screenshot upload  
- [ ] Stored in feedback table.  
- [ ] Admin UI for viewing.

### Dependencies
- **[Object storage](ca://s?q=Explain_object_storage_bucket)**

---

## 9. Implement maintenance banner (frontend)

**As a developer**  
I want a maintenance banner  
So that users are notified of upcoming downtime.

**Size:** XS  
**Estimate:** 0.5 day  
**Priority:** Low  
**Target Date:** **23 June 2028**

### Acceptance Criteria
- [x] **[Maintenance banner](ca://s?q=Explain_maintenance_banner_UI)** appears when maintenance mode is enabled.  
- [x] Message configurable.  
- [x] Dismissible.

### Dependencies
- **[Maintenance mode](ca://s?q=Explain_maintenance_mode)**

---

## 10. Implement CSV import for players

**As a developer**  
I want CSV import for players  
So that admins can bulk‑upload player data.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** Low  
**Target Date:** **28 June 2028**

### Acceptance Criteria
- [ ] **[CSV import API](ca://s?q=Explain_player_CSV_import)** supports:
  - name  
  - DOB  
  - gender  
  - club  
- [ ] Validation errors returned.  
- [ ] Dry‑run mode supported.

### Dependencies
- **[Players table](ca://s?q=Explain_players_table)**  
- **[Admin RBAC](ca://s?q=Explain_RBAC)**

---

## 11. Implement CSV import for rounds

**As a developer**  
I want CSV import for rounds  
So that admins can migrate historical data.

**Size:** L  
**Estimate:** 6–10 days  
**Priority:** Low  
**Target Date:** **08 July 2028**

### Acceptance Criteria
- [ ] **[Round CSV import](ca://s?q=Explain_round_CSV_import)** supports:
  - date  
  - course  
  - tee  
  - hole scores  
  - player  
- [ ] Validation + error reporting.  
- [ ] Bulk insert optimised.

### Dependencies
- **[Rounds table](ca://s?q=Explain_rounds_table)**  
- **[Handicap calculation](ca://s?q=Explain_handicap_calculation)**

---

## 12. Implement admin “impersonate user” feature

**As a developer**  
I want an impersonation feature  
So that admins can troubleshoot user issues.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** Low  
**Target Date:** **10 July 2028**

### Acceptance Criteria
- [ ] **[Impersonation mode](ca://s?q=Explain_admin_impersonation_feature)** for tenant admins + super‑admins.  
- [ ] Audit logged.  
- [ ] Clear exit button.

### Dependencies
- **[RBAC](ca://s?q=Explain_RBAC)**  
- **[Audit logs](ca://s?q=Explain_audit_logs)**

---

## 13. Implement system‑wide feature flags

**As a developer**  
I want feature flags  
So that new features can be rolled out gradually.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** Low  
**Target Date:** **12 July 2028**

### Acceptance Criteria
- [ ] **[Feature flag system](ca://s?q=Explain_feature_flag_system)** supports:
  - per‑tenant flags  
  - per‑user flags  
  - global flags  
- [ ] Admin UI for toggling.

### Dependencies
- **[Settings table](ca://s?q=Explain_settings_table)**

---

## 14. Implement bug reporting with logs attached

**As a developer**  
I want bug reports with logs  
So that issues can be diagnosed quickly.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** Low  
**Target Date:** **14 July 2028**

### Acceptance Criteria
- [ ] **[Bug report API](ca://s?q=Explain_bug_report_API)** accepts:
  - message  
  - screenshot  
  - client logs  
- [ ] Stored in bug_reports table.  
- [ ] Admin UI for viewing.

### Dependencies
- **[Logging system](ca://s?q=Explain_logging_system)**

---

## 15. Implement “system health” page

**As a developer**  
I want a system health page  
So that admins can see the status of core platform modules.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** Low  
**Target Date:** **16 July 2028**

### Acceptance Criteria
- [ ] **[Health page](ca://s?q=Explain_system_health_page)** shows:
  - DB status  
  - cache status  
  - object storage  
  - queue  
  - API uptime  
- [ ] Super‑admin only.

### Dependencies
- **[Monitoring system](ca://s?q=Explain_monitoring_dashboards)**

---

# End of stories-misc.md
