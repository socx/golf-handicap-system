# stories-integrations.md
Parent Epic: #INTEGRATIONS_EPIC_PLACEHOLDER
(Replace with actual epic issue number after creation)

---

# Integrations & Tee-Time Booking — User Stories

This file contains all user stories for the Integrations epic, covering tee-time booking features and integration hooks for external systems.

Start date for this epic (after Multitenancy and Billing**: **10 September 2027**

---

## 1. Design tee-time request data schema

**As a developer**
I want to design and migrate tee-time request tables
So that booking requests can be stored and tracked.

**Size:** S
**Estimate:** 1–2 days
**Priority:** High
**Target Date:** **12 September 2027**

### Acceptance Criteria
- [ ] `tee_time_requests` table includes: id, player_id, course_id, requested_date, preferred_time, group_size, status, created_at, updated_at.
- [ ] `tee_time_slots` table stores course-level availability windows.
- [ ] Foreign keys and indexes on course/player/date.
- [ ] Migrations apply and roll back cleanly.

### Dependencies
- Players table
- Courses table

---

## 2. Implement tee-time request API

**As a developer**
I want APIs to request and manage tee-time bookings
So that players can request slots at partner clubs.

**Size:** M
**Estimate:** 3–5 days
**Priority:** High
**Target Date:** **19 September 2027**

### Acceptance Criteria
- [ ] POST `/tee-times/request` accepts player_id, course_id, date, time, group_size.
- [ ] Validates course capacity and availability.
- [ ] Returns request status (pending, approved, rejected).
- [ ] GET `/tee-times/requests` lists user's booking history.
- [ ] DELETE `/tee-times/requests/:id` for cancellations.

### Dependencies
- Tee-time tables
- Players and courses APIs
- Availability scheduling logic

---

## 3. Build tee-time request UI

**As a developer**
I want a UI for tee-time requests
So that players can easily book times at courses.

**Size:** M
**Estimate:** 3–5 days
**Priority:** High
**Target Date:** **26 September 2027**

### Acceptance Criteria
- [ ] `/tee-times` page shows available courses and time slots.
- [ ] Date picker + time picker for slot selection.
- [ ] Group size input.
- [ ] Form submission triggers POST `/tee-times/request`.
- [ ] Confirmation and request history displayed.

### Dependencies
- Tee-time request API
- Course listing
- Frontend components

---

## 4. Implement third-party integration framework

**As a developer**
I want a pluggable integration framework
So that external booking systems can be connected.

**Size:** L
**Estimate:** 6–10 days
**Priority:** Medium
**Target Date:** **07 October 2027**

### Acceptance Criteria
- [ ] Draft integration adapter interface/base class.
- [ ] Webhook receiver for external system callbacks.
- [ ] OAuth 2.0 or API key credential store.
- [ ] Integration registry and provisioning endpoints (admin-only).
- [ ] Unit tests for adapter pattern.

### Dependencies
- Settings/configuration tables
- Admin RBAC

---

## 5. Build external booking system adapter (example)

**As a developer**
I want a sample integration with a popular booking system
So that operators can see the pattern for connecting their own systems.

**Size:** M
**Estimate:** 3–5 days
**Priority:** Medium
**Target Date:** **14 October 2027**

### Acceptance Criteria
- [ ] Sample adapter implemented and documented.
- [ ] Maps external booking slots to internal schema.
- [ ] Syncs confirmations back to our system.
- [ ] Error handling and retry logic included.
- [ ] README with integration setup steps.

### Dependencies
- Integration framework
- Third-party API documentation

---

## 6. Admin panel for tee-time management

**As a developer**
I want admin endpoints and UI for booking oversight
So that club operators can manage tee-time inventory.

**Size:** M
**Estimate:** 3–5 days
**Priority:** Low
**Target Date:** **21 October 2027**

### Acceptance Criteria
- [ ] Admin page shows all pending/approved/rejected requests.
- [ ] Approve/reject/modify endpoints.
- [ ] Bulk time slot uploads (CSV).
- [ ] Availability calendar view.
- [ ] Admin-only access enforced.

### Dependencies
- Admin RBAC
- Tee-time request & slot tables

---

## 7. Notifications for booking status changes

**As a developer**
I want email notifications on booking request updates
So that players and admins stay informed.

**Size:** S
**Estimate:** 1–2 days
**Priority:** Medium
**Target Date:** **23 October 2027**

### Acceptance Criteria
- [ ] Email sent when request submitted, approved, rejected, or cancelled.
- [ ] Template parameterizes course, player, date, time.
- [ ] Integrates with existing email delivery module.
- [ ] Notification preferences respected.

### Dependencies
- Notification system
- Tee-time request API

---

## 8. API rate limiting for booking endpoints

**As a developer**
I want rate limiting on tee-time booking endpoints
So that abuse and spam requests are prevented.

**Size:** S
**Estimate:** 1–2 days
**Priority:** Medium
**Target Date:** **25 October 2027**

### Acceptance Criteria
- [ ] Rate limiter applied to tee-time request endpoints.
- [ ] Per-player limits (e.g., 10 requests/day).
- [ ] Per-course limits (e.g., total slots/day).
- [ ] Returns 429 when exceeded.
- [ ] Configurable thresholds.

### Dependencies
- Rate limiting middleware
- Redis cache

---

# End of stories-integrations.md
