# stories-admin.md
Parent Epic: #303  
(Replace with actual epic issue number after creation)

---

# Admin Panel — User Stories

This file contains all user stories for the Admin Panel epic, including:
- Story narrative  
- Acceptance criteria  
- Dependencies  
- Size (XS/S/M/L/XL)  
- Estimate (0.5–15 days)  
- Priority  
- Target date (sequential, 6‑hour days, weekdays only)
- Guided Links embedded as required

Start date for this epic (after Dashboard epic ends): **25 November 2026**

---

## 1. Implement admin-only access middleware

**As a developer**  
I want admin-only access middleware  
So that only authorised users can access admin endpoints.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** High  
**Target Date:** **25 November 2026**

### Acceptance Criteria
- [x] **[Admin middleware](ca://s?q=Explain_admin_middleware)** checks JWT + role.  
- [x] Returns 403 for non-admin users.  
- [x] Logs access attempts.  
- [x] Reusable across all admin routes.

### Implementation Notes
- `verifyAdminAndLog(req)` in `apps/api/src/middleware/auth.ts` — wraps `verifyAndAuthorize` with `['admin']` role requirement
- Logs `admin_access_allowed` and `admin_access_denied` audit events via `logAuthAuditEvent`
- Used by all admin route handlers throughout `apps/api/src/routes/admin/`
- Commit: `0ffe237`

### Dependencies
- **[RBAC](ca://s?q=Explain_RBAC)**  
- **[JWT middleware](ca://s?q=Explain_JWT_middleware)**

---

## 2. Admin: User management list API

**As a developer**  
I want an API to list all users  
So that admins can manage accounts.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** High  
**Target Date:** **27 November 2026**

### Acceptance Criteria
- [x] **[GET /admin/users](ca://s?q=Explain_admin_users_endpoint)** returns paginated list.  
- [x] Supports search by email, role, status.  
- [x] Excludes soft-deleted users unless `includeDeleted=true`.  
- [x] Admin-only access enforced.

### Dependencies
- **[Users table](ca://s?q=Explain_users_table)**  
- **[Admin middleware](ca://s?q=Explain_admin_middleware)**

### Implementation Notes
- Extended `GET /api/admin/users` to support pagination (`page`, `limit`) with metadata (`total`, `totalPages`).
- Added filters: `search` (email), `role`, and `status` (`active|inactive`).
- Preserved soft-delete behavior, excluding deleted users by default and including them when `includeDeleted=true`.
- Enforced admin-only access through the admin middleware wrapper with audit logging for allowed/denied access attempts.
- Added E2E coverage in `apps/api/test/admin-users-list.e2e.test.mjs` for pagination, filtering, includeDeleted, and non-admin access rejection.

---

## 3. Admin: Update user role

**As a developer**  
I want to update a user’s role  
So that admins can promote or restrict access.

**Size:** XS  
**Estimate:** 0.5 day  
**Priority:** High  
**Target Date:** **28 November 2026**

### Acceptance Criteria
### Acceptance Criteria
- [x] **[PATCH /admin/users/:id/role](ca://s?q=Explain_update_user_role)** updates role.  
- [x] Cannot demote last remaining admin.  
- [x] Change logged in audit trail.


### Implementation Notes
- `PATCH /api/admin/users/:id/role` implemented in `apps/api/src/routes/admin/users.ts` (`handleUpdateUserRole`)
- Last-admin guard counts active, non-deleted admins excluding the target; returns 409 `last_admin_required` if demoting would leave zero admins
- Emits `auth_user_role_updated` audit event with `old_role`/`new_role` in metadata
- Route wired in `app.ts` via `parseUserRoleRoute`; requires admin JWT (`verifyAdminAndLog`)
- E2e tests: `apps/api/test/admin-user-role-update.e2e.test.mjs` (3/3 passing)
- **[RBAC](ca://s?q=Explain_RBAC)**

---

## 4. Admin: Round approval queue API

**As a developer**  
I want an API to fetch rounds pending approval  
So that admins can review and approve them.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** High  
**Target Date:** **30 November 2026**

### Acceptance Criteria
- [x] **[GET /admin/rounds/pending](ca://s?q=Explain_pending_rounds_endpoint)** returns list of unapproved rounds.  
- [x] Includes player, course, date, gross score.  
- [x] Sorted by date (oldest first).

### Dependencies
- **[Rounds table](ca://s?q=Explain_rounds_table)**  
- **[Round approval workflow](ca://s?q=Explain_round_approval_workflow)**

### Implementation Notes
- Added admin endpoint handler `handleListPendingRounds` in `apps/api/src/routes/admin/rounds.ts`.
- Wired route in `apps/api/src/app.ts` for `GET /api/admin/rounds/pending` (and `/admin/rounds/pending`).
- Endpoint is admin-only via `verifyAdminAndLog`.
- Query returns pending, non-deleted rounds and includes player name, course, played date, and gross score.
- Results are sorted oldest first by `played_at` ascending.
- Added e2e coverage in `apps/api/test/admin-rounds-pending.e2e.test.mjs` for payload fields, ordering, and non-admin access rejection.

---

## 5. Admin: Approve or reject round

**As a developer**  
I want endpoints to approve or reject rounds  
So that admins can validate scoring before handicap updates.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** High  
**Target Date:** **02 December 2026**

### Acceptance Criteria
- [x] **[POST /admin/rounds/:id/approve](ca://s?q=Explain_approve_round)**  
- [x] **[POST /admin/rounds/:id/reject](ca://s?q=Explain_reject_round)**  
- [x] Rejection requires reason.  
- [x] Approved rounds trigger handicap recalculation.  
- [x] Logged in audit trail.

### Dependencies
- **[Handicap calculation](ca://s?q=Explain_handicap_calculation)**  
- **[Audit logs](ca://s?q=Explain_audit_logs)**

### Implementation Notes
- `POST /api/admin/rounds/:id/approve` and `POST /api/admin/rounds/:id/reject` are supported via route parsing in `apps/api/src/app.ts`.
- Existing moderation handlers in `apps/api/src/routes/rounds.ts` are reused, enforcing admin-only access and writing audit events.
- Reject endpoint validates `rejectionReason` and returns `400 validation_error` when missing.
- Approve flow emits `round_approved` and conditionally emits `handicap_recalculation_requested` when `score_differential` exists.
- Reject flow emits `round_rejected` and conditionally emits `handicap_recalculation_requested` when `score_differential` exists.
- Added dedicated e2e coverage in `apps/api/test/admin-rounds-moderation.e2e.test.mjs`.

---

## 6. Admin: View audit logs

**As a developer**  
I want an audit log viewer  
So that admins can track important system events.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** Medium  
**Target Date:** **07 December 2026**

### Acceptance Criteria
- [x] **[GET /admin/audit-logs](ca://s?q=Explain_audit_logs_endpoint)** returns paginated logs.  
- [x] Filters: user, event type, date range.  
- [x] Includes IP address + timestamp.  
- [x] Sensitive data never shown.

### Dependencies
- **[Audit logs table](ca://s?q=Explain_audit_logs)**  
- **[Admin middleware](ca://s?q=Explain_admin_middleware)**

### Implementation Notes
- Added `GET /api/admin/audit-logs` endpoint in `apps/api/src/routes/admin/auditLogs.ts`.
- Wired route in `apps/api/src/app.ts` for both `/api/admin/audit-logs` and `/admin/audit-logs`.
- Endpoint is admin-only via `verifyAdminAndLog`.
- Supports pagination (`page`, `limit`) and filters (`userId`, `eventType`, `from`, `to`).
- Returns `ip_address` and `created_at` for each log entry.
- Sanitizes metadata recursively to remove sensitive keys (`password`, `token`, `secret`, `authorization`, etc.).
- Added e2e tests in `apps/api/test/admin-audit-logs.e2e.test.mjs` for pagination/filters, date range, redaction, and non-admin access rejection.

---

## 7. Admin: Player management UI

**As a developer**  
I want an admin UI for managing players  
So that admins can edit, delete, and link players.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** Medium  
**Target Date:** **12 December 2026**

### Acceptance Criteria
- [x] `/admin/players` shows list with search + filters.  
- [x] Edit player opens form.  
- [x] Delete triggers soft delete.  
- [x] Link/unlink user supported.

### Dependencies
- **[Player CRUD APIs](ca://s?q=Explain_player_CRUD)**  
- **[UI components](ca://s?q=Explain_UI_components)**

### Implementation Notes
- Added `AdminPlayersPage` at `apps/web/src/pages/AdminPlayersPage.tsx` with searchable and filterable players list.
- Wired route in `apps/web/src/App.tsx` for `/admin/players`.
- Reused existing player edit flow by routing edit actions to `/players/:playerId/edit`.
- Added delete confirmation modal that calls `DELETE /players/:id` (soft delete endpoint).
- Added link/unlink modal that calls `PATCH /players/:id/link-user`.
- Extended `playersApi` in `apps/web/src/api/players.ts` with `delete` and `linkUser` helpers.
- Added test coverage for new API helpers in `apps/web/src/api/players.test.ts`.

---

## 8. Admin: Round management UI

**As a developer**  
I want an admin UI for managing rounds  
So that admins can inspect, approve, or reject rounds.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** Medium  
**Target Date:** **17 December 2026**

### Acceptance Criteria
- [x] `/admin/rounds` shows list with filters.  
- [x] Clicking a round opens scorecard.  
- [x] Approve/reject buttons available.  
- [x] Rejection reason modal.

### Dependencies
- **[Round detail API](ca://s?q=Explain_round_detail_API)**  
- **[Round approval API](ca://s?q=Explain_approve_round)**

### Implementation Notes
- Added `AdminRoundsPage` in `apps/web/src/pages/AdminRoundsPage.tsx` and routed it from `/admin/rounds`.
- Reused the existing rounds list API with course, tee, and date filters, plus a client-side status filter for admin moderation views.
- Added row and card navigation to the existing scorecard page at `/rounds/:roundId`.
- Added approve and reject actions wired to the existing admin moderation endpoints.
- Implemented a rejection-reason modal before submitting round rejections.
- Extended `apps/web/src/api/rounds.ts` with moderation helpers and moderation response types.
- Added focused page coverage in `apps/web/src/test/AdminRoundsPage.test.tsx` for filtering, scorecard navigation, approval, and rejection flows.

---

## 9. Admin: Handicap override UI

**As a developer**  
I want a UI for handicap overrides  
So that admins can apply exceptional adjustments.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** Low  
**Target Date:** **19 December 2026**

### Acceptance Criteria
- [x] `/admin/handicap-override/:playerId` page.  
- [x] Form for manual index + reason.  
- [x] Shows history of overrides.  
- [x] Admin-only access enforced.

### Dependencies
- **[Handicap override API](ca://s?q=Explain_handicap_override)**  
- **[Handicap history API](ca://s?q=Explain_handicap_history_API)**

### Implementation Notes
- Added DB migration `016_handicap_overrides.sql` for the `handicap_overrides` table.
- Added `handleCreateHandicapOverride` and `handleListHandicapOverrides` to `apps/api/src/routes/handicap.ts`.
- Wired `POST /api/admin/handicap-override/:playerId` and `GET /api/admin/handicap-override/:playerId` in `apps/api/src/app.ts`.
- Extended `apps/web/src/api/handicap.ts` with `createHandicapOverride` and `listHandicapOverrides`.
- Created `AdminHandicapOverridePage` at `apps/web/src/pages/AdminHandicapOverridePage.tsx` with override form and history table.
- Wired `/admin/handicap-override/:playerId` route in `apps/web/src/App.tsx`.
- Added e2e API tests in `apps/api/test/admin-handicap-override.e2e.test.mjs` (4/4).
- Added frontend page tests in `apps/web/src/test/AdminHandicapOverridePage.test.tsx` (3/3).

---

## 10. Admin: System settings page

**As a developer**  
I want a system settings page  
So that admins can configure global options.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** Low  
**Target Date:** **24 December 2026**

### Acceptance Criteria
- [x] Settings include:
  - PCC override  
  - Notification settings  
  - Maintenance mode  
- [x] Stored in settings table.  
- [x] Changes logged.

### Dependencies
- **[Settings table](ca://s?q=Explain_settings_table)**  
- **[Admin middleware](ca://s?q=Explain_admin_middleware)**

### Implementation Notes
- Added `system_settings` persistence with singleton row semantics in `packages/db/migrations/017_system_settings.sql`.
- Implemented admin-only settings endpoints in `apps/api/src/routes/admin/settings.ts` and wired them in `apps/api/src/app.ts`:
  - `GET /api/admin/settings`
  - `PATCH /api/admin/settings`
- Added audit logging for settings updates via `admin_system_settings_updated` events.
- Added frontend API client in `apps/web/src/api/adminSettings.ts` and shipped the admin UI at `apps/web/src/pages/AdminSettingsPage.tsx`.
- Wired `/admin/settings` route in `apps/web/src/App.tsx` and added an `Admin Settings` navigation item in `apps/web/src/components/layout/AppLayout.tsx`.
- Added automated coverage:
  - API e2e: `apps/api/test/admin-settings.e2e.test.mjs`
  - Frontend: `apps/web/src/test/AdminSettingsPage.test.tsx`

---

## 11. Admin: Maintenance mode toggle

**As a developer**  
I want a maintenance mode toggle  
So that admins can temporarily disable user access.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** Low  
**Target Date:** **28 December 2026**

### Acceptance Criteria
- [ ] **[PATCH /admin/settings/maintenance](ca://s?q=Explain_maintenance_mode)** toggles mode.  
- [ ] Non-admin users see maintenance screen.  
- [ ] Logged in audit trail.

### Dependencies
- **[System settings page](ca://s?q=Explain_system_settings_page)**  
- **[RBAC](ca://s?q=Explain_RBAC)**

---

# End of stories-admin.md
