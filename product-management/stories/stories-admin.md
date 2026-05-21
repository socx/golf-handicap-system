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
- [ ] **[Admin middleware](ca://s?q=Explain_admin_middleware)** checks JWT + role.  
- [ ] Returns 403 for non-admin users.  
- [ ] Logs access attempts.  
- [ ] Reusable across all admin routes.

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
- [ ] **[GET /admin/users](ca://s?q=Explain_admin_users_endpoint)** returns paginated list.  
- [ ] Supports search by email, role, status.  
- [ ] Excludes soft-deleted users unless `includeDeleted=true`.  
- [ ] Admin-only access enforced.

### Dependencies
- **[Users table](ca://s?q=Explain_users_table)**  
- **[Admin middleware](ca://s?q=Explain_admin_middleware)**

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
- [ ] **[PATCH /admin/users/:id/role](ca://s?q=Explain_update_user_role)** updates role.  
- [ ] Cannot demote last remaining admin.  
- [ ] Change logged in audit trail.

### Dependencies
- **[Audit logs](ca://s?q=Explain_audit_logs)**  
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
- [ ] **[GET /admin/rounds/pending](ca://s?q=Explain_pending_rounds_endpoint)** returns list of unapproved rounds.  
- [ ] Includes player, course, date, gross score.  
- [ ] Sorted by date (oldest first).

### Dependencies
- **[Rounds table](ca://s?q=Explain_rounds_table)**  
- **[Round approval workflow](ca://s?q=Explain_round_approval_workflow)**

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
- [ ] **[POST /admin/rounds/:id/approve](ca://s?q=Explain_approve_round)**  
- [ ] **[POST /admin/rounds/:id/reject](ca://s?q=Explain_reject_round)**  
- [ ] Rejection requires reason.  
- [ ] Approved rounds trigger handicap recalculation.  
- [ ] Logged in audit trail.

### Dependencies
- **[Handicap calculation](ca://s?q=Explain_handicap_calculation)**  
- **[Audit logs](ca://s?q=Explain_audit_logs)**

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
- [ ] **[GET /admin/audit-logs](ca://s?q=Explain_audit_logs_endpoint)** returns paginated logs.  
- [ ] Filters: user, event type, date range.  
- [ ] Includes IP address + timestamp.  
- [ ] Sensitive data never shown.

### Dependencies
- **[Audit logs table](ca://s?q=Explain_audit_logs)**  
- **[Admin middleware](ca://s?q=Explain_admin_middleware)**

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
- [ ] `/admin/players` shows list with search + filters.  
- [ ] Edit player opens form.  
- [ ] Delete triggers soft delete.  
- [ ] Link/unlink user supported.

### Dependencies
- **[Player CRUD APIs](ca://s?q=Explain_player_CRUD)**  
- **[UI components](ca://s?q=Explain_UI_components)**

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
- [ ] `/admin/rounds` shows list with filters.  
- [ ] Clicking a round opens scorecard.  
- [ ] Approve/reject buttons available.  
- [ ] Rejection reason modal.

### Dependencies
- **[Round detail API](ca://s?q=Explain_round_detail_API)**  
- **[Round approval API](ca://s?q=Explain_approve_round)**

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
- [ ] `/admin/handicap-override/:playerId` page.  
- [ ] Form for manual index + reason.  
- [ ] Shows history of overrides.  
- [ ] Admin-only access enforced.

### Dependencies
- **[Handicap override API](ca://s?q=Explain_handicap_override)**  
- **[Handicap history API](ca://s?q=Explain_handicap_history_API)**

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
- [ ] Settings include:
  - PCC override  
  - Notification settings  
  - Maintenance mode  
- [ ] Stored in settings table.  
- [ ] Changes logged.

### Dependencies
- **[Settings table](ca://s?q=Explain_settings_table)**  
- **[Admin middleware](ca://s?q=Explain_admin_middleware)**

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
