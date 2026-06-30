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
| 10. CSV import (players) | Implemented | Admin CSV import UI plus admin-only dry-run/import API are implemented for player bulk upload. |
| 11. CSV import (rounds) | Implemented | Admin rounds CSV import API with dry-run validation, row-level error reporting, and transactional bulk insert is implemented. |
| 12. Admin impersonation | Not implemented | No impersonation flow/API/audit events yet. |
| 13. Feature flags | Not implemented | No per-tenant/per-user/global feature-flag system yet. |
| 14. Bug reporting with logs | Not implemented | No bug report workflow/table/admin viewer yet. |
| 15. System health page | Implemented | Added super-admin-only API and admin page showing DB/cache/object storage/queue/API uptime status. |

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
- [x] Stored in user preferences.

### Implementation Notes
- Added `theme_mode` persistence to user notification preferences and API responses in `apps/api/src/routes/auth/settings.ts`.
- Added DB migration `packages/db/migrations/021_user_preferences_feedback.sql` to store `theme_mode` with validation (`light|dark|system`).
- Updated theme provider in `apps/web/src/context/ThemeContext.tsx` to load and persist theme preference through the API.
- Updated settings page to use shared theme context toggle in `apps/web/src/pages/SettingsPage.tsx`.

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
- [x] **[Global search API](ca://s?q=Explain_global_search_API)** supports:
  - players  
  - rounds  
  - courses  
- [x] Autocomplete suggestions.  
- [x] Tenant‑scoped.

### Implementation Notes
- Implemented global search endpoint in `apps/api/src/routes/search.ts`.
- Added API routing for `GET /api/search` in `apps/api/src/app.ts`.
- Search covers players, rounds, and courses with scoped behavior for player users.
- Added autocomplete UI component `apps/web/src/components/layout/GlobalSearch.tsx`.
- Added frontend API client in `apps/web/src/api/search.ts` and integrated into app header layout.

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
- [x] **[Feedback form](ca://s?q=Explain_feedback_form_design)** supports:
  - category  
  - message  
  - screenshot upload  
- [x] Stored in feedback table.  
- [x] Admin UI for viewing.

### Implementation Notes
- Added feedback storage migration and table in `packages/db/migrations/021_user_preferences_feedback.sql`.
- Implemented submit/list APIs in `apps/api/src/routes/feedback.ts`.
- Added routes in `apps/api/src/app.ts` for `POST /api/feedback` and `GET /api/admin/feedback`.
- Implemented user feedback form page in `apps/web/src/pages/FeedbackPage.tsx`.
- Implemented admin feedback inbox page in `apps/web/src/pages/AdminFeedbackPage.tsx`.
- Added frontend feedback API client in `apps/web/src/api/feedback.ts`.

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
- [x] **[CSV import API](ca://s?q=Explain_player_CSV_import)** supports:
  - name  
  - DOB  
  - gender  
  - club  
- [x] Validation errors returned.  
- [x] Dry‑run mode supported.

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
- [x] **[Round CSV import](ca://s?q=Explain_round_CSV_import)** supports:
  - date  
  - course  
  - tee  
  - hole scores  
  - player  
- [x] Validation + error reporting.  
- [x] Bulk insert optimised.

### Implementation Notes
- Implemented rounds import endpoint in `apps/api/src/routes/rounds.ts` via `handleImportRounds`.
- Endpoint supports admin-only `POST /api/rounds/import` with CSV payload and `dryRun` mode.
- Validation covers required columns, player/course/tee resolution, played date, and hole-score integrity.
- Dry-run response returns row-level validation issues and lookup warnings.
- Non-dry-run import performs transactional bulk insert and returns imported round IDs.
- Added detailed API reference in `docs/rounds-import.md`.

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
- [x] **[Impersonation mode](ca://s?q=Explain_admin_impersonation_feature)** for tenant admins + super‑admins.  
- [x] Audit logged.  
- [x] Clear exit button.

### Implementation Notes
- Implemented impersonation start/stop endpoints in `apps/api/src/routes/admin/impersonation.ts`.
- Wired admin impersonation routes in `apps/api/src/app.ts`.
- Extended token creation with optional claims in `apps/api/src/lib/tokens.ts` for impersonation metadata.
- Exposed impersonation context in auth-me response via `apps/api/src/routes/auth/me.ts`.
- Added impersonate action in admin users UI (`apps/web/src/pages/AdminUsersPage.tsx`).
- Added clear exit button in app header (`apps/web/src/components/layout/AppLayout.tsx`).
- Added auth API methods for impersonation (`apps/web/src/api/auth.ts`).

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
- [x] **[Health page](ca://s?q=Explain_system_health_page)** shows:
  - DB status  
  - cache status  
  - object storage  
  - queue  
  - API uptime  
- [x] Super‑admin only.

### Implementation Notes
- Added super-admin allowlist support via `SUPER_ADMIN_EMAILS` in `apps/api/src/config/validate-env.ts`.
- Added `verifySuperAdminAndLog` middleware in `apps/api/src/middleware/auth.ts` and exposed `is_super_admin` in `GET /api/auth/me`.
- Implemented `GET /api/admin/system-health` in `apps/api/src/routes/admin/systemHealth.ts` and wired route in `apps/api/src/app.ts`.
- Added admin UI page `apps/web/src/pages/AdminSystemHealthPage.tsx` plus API client `apps/web/src/api/adminSystemHealth.ts`.
- Added super-admin-only navigation filtering in `apps/web/src/components/layout/navigationItems.ts` and admin home card visibility guard.

### Dependencies
- **[Monitoring system](ca://s?q=Explain_monitoring_dashboards)**

---

# End of stories-misc.md
