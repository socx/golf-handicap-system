# stories-notifications.md
Parent Epic: #304  
(Replace with actual epic issue number after creation)

---

# Notifications — User Stories

This file contains all user stories for the Notifications epic, including:
- Story narrative  
- Acceptance criteria  
- Dependencies  
- Size (XS/S/M/L/XL)  
- Estimate (0.5–15 days)  
- Priority  
- Target date (sequential, 6‑hour days, weekdays only)
- Guided Links embedded as required

Start date for this epic (after Admin epic ends): **28 December 2026**

---

## 1. Implement notification preferences table

**As a developer**  
I want a notification preferences table  
So that users can control which notifications they receive.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** High  
**Target Date:** **28 December 2026**

### Acceptance Criteria
- [ ] **[notification_preferences table](ca://s?q=Explain_notification_preferences_table)** includes:
  - user_id  
  - handicap_updates_enabled  
  - round_submitted_enabled  
  - round_approved_enabled  
  - marketing_enabled  
- [ ] Defaults applied for new users.  
- [ ] Linked to users table.

### Dependencies
- **[Users table](ca://s?q=Explain_users_table)**

---

## 2. Implement email delivery module wrapper

**As a developer**  
I want an email delivery module wrapper  
So that the system can send emails through a unified interface.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** High  
**Target Date:** **30 December 2026**

### Acceptance Criteria
- [ ] **[Email delivery module](ca://s?q=Explain_email_delivery_module_design)** supports:
  - sendEmail(to, subject, body)
  - templating
  - error handling  
- [ ] Supports provider abstraction (SendGrid, SES, SMTP).  
- [ ] Logs failures.

### Dependencies
- **[Notification preferences](ca://s?q=Explain_notification_preferences_table)**  
- Email provider credentials

---

## 3. Implement handicap update notification

**As a developer**  
I want to send notifications when a handicap index changes  
So that players are informed of updates.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** High  
**Target Date:** **02 January 2027**

### Acceptance Criteria
- [ ] Triggered after handicap calculation.  
- [ ] **[Email template](ca://s?q=Explain_email_template_structure)** includes:
  - old index  
  - new index  
  - rounds used  
- [ ] Respects user notification preferences.  
- [ ] Logged in notification history.

### Dependencies
- **[Handicap calculation](ca://s?q=Explain_handicap_calculation)**  
- **[Email delivery module](ca://s?q=Explain_email_delivery_module_design)**

---

## 4. Implement round submitted notification

**As a developer**  
I want to notify admins when a round is submitted  
So that they can review and approve it.

**Size:** XS  
**Estimate:** 0.5 day  
**Priority:** Medium  
**Target Date:** **03 January 2027**

### Acceptance Criteria
- [ ] Triggered on round creation.  
- [ ] Sent only to admins with preference enabled.  
- [ ] Includes player, course, date.  
- [ ] Logged in notification history.

### Dependencies
- **[Round entry API](ca://s?q=Explain_round_entry_API)**  
- **[Admin RBAC](ca://s?q=Explain_RBAC)**

---

## 5. Implement round approved notification

**As a developer**  
I want to notify players when their round is approved  
So that they know it now affects their handicap.

**Size:** XS  
**Estimate:** 0.5 day  
**Priority:** Medium  
**Target Date:** **04 January 2027**

### Acceptance Criteria
- [ ] Triggered on round approval.  
- [ ] Includes approval date + admin name.  
- [ ] Respects player preferences.  
- [ ] Logged in notification history.

### Dependencies
- **[Round approval workflow](ca://s?q=Explain_round_approval_workflow)**  
- **[Email delivery module](ca://s?q=Explain_email_delivery_module_design)**

---

## 6. Implement notification history table

**As a developer**  
I want to store notification history  
So that users and admins can audit what was sent.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** Medium  
**Target Date:** **06 January 2027**

### Acceptance Criteria
- [ ] **[notification_history table](ca://s?q=Explain_notification_history_table)** includes:
  - id  
  - user_id  
  - type  
  - payload  
  - sent_at  
  - status  
- [ ] Queryable by user and date range.

### Dependencies
- **[Email delivery module](ca://s?q=Explain_email_delivery_module_design)**

---

## 7. API: Get notification history

**As a developer**  
I want an endpoint to fetch notification history  
So that users can review past notifications.

**Size:** XS  
**Estimate:** 0.5 day  
**Priority:** Low  
**Target Date:** **07 January 2027**

### Acceptance Criteria
- [ ] **[GET /notifications/history](ca://s?q=Explain_notification_history_endpoint)** returns paginated list.  
- [ ] Filters: type, date range.  
- [ ] User can only see their own history.

### Dependencies
- **[Notification history table](ca://s?q=Explain_notification_history_table)**

---

## 8. Frontend: Notification preferences UI

**As a developer**  
I want a UI for notification preferences  
So that users can control what they receive.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** Medium  
**Target Date:** **09 January 2027**

### Acceptance Criteria
- [ ] `/settings/notifications` page.  
- [ ] Toggles for each notification type.  
- [ ] Saves via PATCH `/notifications/preferences`.  
- [ ] Shows success toast.

### Dependencies
- **[Notification preferences API](ca://s?q=Explain_notification_preferences_API)**  
- **[Settings page](ca://s?q=Explain_settings_page)**

---

## 9. Frontend: Notification history UI

**As a developer**  
I want a notification history UI  
So that users can see what notifications were sent.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** Low  
**Target Date:** **11 January 2027**

### Acceptance Criteria
- [ ] `/notifications/history` page.  
- [ ] Paginated list with type, date, status.  
- [ ] Expand row to view payload.  
- [ ] Responsive layout.

### Dependencies
- **[Notification history API](ca://s?q=Explain_notification_history_endpoint)**  
- **[UI components](ca://s?q=Explain_UI_components)**

---

## 10. Implement future-ready notification channels (push-ready architecture)

**As a developer**  
I want a notification architecture that supports future channels  
So that push notifications can be added later.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** Low  
**Target Date:** **16 January 2027**

### Acceptance Criteria
- [ ] Channel abstraction layer:
  - email  
  - push (future)  
  - SMS (future)  
- [ ] Channel selection based on preferences.  
- [ ] Documentation for adding new channels.

### Dependencies
- **[Email delivery module](ca://s?q=Explain_email_delivery_module_design)**  
- **[Notification preferences](ca://s?q=Explain_notification_preferences_table)**

---

# End of stories-notifications.md
