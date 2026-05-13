# stories-courses.md
Parent Epic: #COURSES_EPIC_PLACEHOLDER  
(Replace with actual epic issue number after creation)

---

# Course & Tee Configuration Management — User Stories

This file contains all user stories for the Course & Tee Configuration Management epic, including:
- Story narrative  
- Acceptance criteria  
- Dependencies  
- Size (XS/S/M/L/XL)  
- Estimate (0.5–15 days)  
- Priority  
- Target date (sequential, 6‑hour days, weekdays only)

Start date for this epic (after Player Management epic ends): **18 June 2026**

---

## 1. Create courses table & migrations

**As a developer**  
I want to create the `courses` table and migrations  
So that golf courses can be stored with their essential details.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** High  
**Target Date:** **18 June 2026**

### Acceptance Criteria
- [ ] `courses` table includes: id, name, address, city, country, phone, email, website, timestamps, deleted_at.  
- [ ] Name is required and unique per country.  
- [ ] Soft delete supported.  
- [ ] Migrations apply and roll back cleanly.

### Dependencies
- Migration tooling  
- DB connection

---

## 2. Create tee_configurations and holes tables & migrations

**As a developer**  
I want to create `tee_configurations` and `holes` tables  
So that each course can have multiple tee sets with per‑hole data.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** High  
**Target Date:** **24 June 2026**

### Acceptance Criteria
- [ ] `tee_configurations` includes: id, course_id, name, tee_colour, hole_count, course_rating, slope_rating, timestamps.  
- [ ] `holes` includes: id, tee_configuration_id, hole_number, distance_yards, par, stroke_index.  
- [ ] Hole numbers must be unique per configuration.  
- [ ] Stroke index must be 1–18 and unique per configuration.  
- [ ] Supports 9‑hole and 18‑hole configurations.

### Dependencies
- Courses table  
- Migration tooling

---

## 3. API: Create tee configuration with holes

**As a developer**  
I want an endpoint to create a tee configuration with its holes in one request  
So that admins can define playable setups efficiently.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** High  
**Target Date:** **01 July 2026**

### Acceptance Criteria
- [ ] POST `/courses/:id/configurations` accepts configuration metadata + `holes[]`.  
- [ ] Validates hole count, hole numbers, par, stroke index.  
- [ ] Creates configuration + holes in a single transaction.  
- [ ] Returns configuration with holes.  
- [ ] Errors follow standard format.

### Dependencies
- Tee configuration & holes tables  
- Course existence validation

---

## 4. API: Update tee configuration & holes

**As a developer**  
I want to update tee configuration metadata and hole details  
So that admins can correct or refine course data.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** Medium  
**Target Date:** **08 July 2026**

### Acceptance Criteria
- [ ] PATCH `/configurations/:id` updates metadata.  
- [ ] PATCH `/configurations/:id/holes` updates hole details.  
- [ ] Validation rules enforced (hole count, stroke index uniqueness).  
- [ ] Returns updated configuration + holes.

### Dependencies
- Create tee configuration API  
- Tee configuration & holes tables

---

## 5. API: Get course with tee configurations

**As a developer**  
I want an endpoint to fetch a course with its tee configurations  
So that the frontend can display course details and available tees.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** High  
**Target Date:** **10 July 2026**

### Acceptance Criteria
- [ ] GET `/courses/:id` returns course + tee configurations.  
- [ ] Includes hole_count, course_rating, slope_rating.  
- [ ] Excludes soft‑deleted configurations unless explicitly requested.

### Dependencies
- Courses table  
- Tee configuration table

---

## 6. API: Search courses

**As a developer**  
I want to search and filter courses  
So that users can quickly find the course they need.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** Medium  
**Target Date:** **12 July 2026**

### Acceptance Criteria
- [ ] GET `/courses` supports `search`, `country`, `page`, `limit`.  
- [ ] Search matches name and city.  
- [ ] Pagination metadata included.  
- [ ] Soft‑deleted courses excluded.

### Dependencies
- Courses table  
- Basic CRUD

---

## 7. API: Delete course (soft delete)

**As a developer**  
I want to soft delete courses  
So that outdated or incorrect courses can be removed without losing historical round data.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** Medium  
**Target Date:** **15 July 2026**

### Acceptance Criteria
- [ ] DELETE `/courses/:id` sets `deleted_at`.  
- [ ] Deleted courses excluded from search.  
- [ ] Rounds referencing the course remain intact.  
- [ ] Deletion logged.

### Dependencies
- Courses table  
- Audit logging

---

## 8. Frontend: Course list page

**As a developer**  
I want a course list page in React  
So that users can browse available courses.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** High  
**Target Date:** **20 July 2026**

### Acceptance Criteria
- [ ] `/courses` shows paginated list.  
- [ ] Search + filters (country).  
- [ ] Clicking a course opens detail page.  
- [ ] Tailwind styling consistent with design system.

### Dependencies
- Course search API  
- Frontend layout shell

---

## 9. Frontend: Course detail page (with tee configurations)

**As a developer**  
I want a course detail page  
So that users can view course information and available tee sets.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** High  
**Target Date:** **25 July 2026**

### Acceptance Criteria
- [ ] `/courses/:id` shows course details.  
- [ ] Lists tee configurations with rating/slope.  
- [ ] Links to configuration detail/edit pages.  
- [ ] Responsive layout.

### Dependencies
- Course detail API  
- Tee configuration API

---

## 10. Frontend: Tee configuration editor

**As a developer**  
I want a UI for creating and editing tee configurations  
So that admins can manage course setups visually.

**Size:** L  
**Estimate:** 6–10 days  
**Priority:** High  
**Target Date:** **05 August 2026**

### Acceptance Criteria
- [ ] Form for configuration metadata.  
- [ ] Editable table/grid for holes (distance, par, stroke index).  
- [ ] Validation errors shown clearly.  
- [ ] Save triggers appropriate API calls.  
- [ ] Success shows toast + redirect.

### Dependencies
- Create/update configuration APIs  
- Frontend routing

---

## 11. Frontend: Course import (CSV)

**As a developer**  
I want to import course and tee configuration data from CSV  
So that admins can bulk‑load course data.

**Size:** L  
**Estimate:** 6–10 days  
**Priority:** Medium  
**Target Date:** **15 August 2026**

### Acceptance Criteria
- [ ] Upload CSV containing course + tee configuration + holes.  
- [ ] Validates structure and required fields.  
- [ ] Creates course + configurations + holes in a transaction.  
- [ ] Errors shown clearly in UI.

### Dependencies
- Course creation APIs  
- File upload support  
- Validation schemas

---

# End of stories-courses.md
