# stories-courses.md
Parent Epic: #298  
(Replace with actual epic issue number after creation)

---

## 13. Frontend: Clone tee configuration within a course

**As an admin**
I want to create a new tee configuration by duplicating an existing configuration from the same course
So that I can make small adjustments without re-entering all hole data from scratch.

**Size:** M  
**Estimate:** 3-5 days  
**Priority:** High  
**Target Date:** **24 August 2026**

### Acceptance Criteria
- [ ] From course detail and/or tee configuration editor, admin can choose an existing tee configuration as a clone source.
- [ ] Clone flow creates a new draft configuration prefilled with:
	- [ ] Configuration metadata (name, tee colour, ratings, hole count)
	- [ ] All hole rows (hole number, distance, par, stroke index)
- [ ] New cloned configuration is associated with the same course only.
- [ ] Admin can edit any cloned field before save.
- [ ] Saving a clone creates a new tee configuration record (new id), leaving the source configuration unchanged.
- [ ] Validation rules remain enforced (hole count consistency, stroke index uniqueness, required metadata).
- [ ] Success state shows confirmation and redirects to the course detail page.

### Dependencies
- Existing tee configuration create/edit frontend flow
- Tee configuration create API
- Course detail page actions/navigation

---

## 14. Frontend: Delete tee configuration

**As an admin**
I want to delete a tee configuration from the frontend
So that obsolete or incorrect tee setups can be removed from active use.

**Size:** M  
**Estimate:** 3-5 days  
**Priority:** High  
**Target Date:** **29 August 2026**

### Acceptance Criteria
- [ ] Course detail page shows a delete action for each tee configuration.
- [ ] Delete action requires explicit confirmation before execution.
- [ ] Frontend calls a tee configuration delete API endpoint.
- [ ] On success, deleted configuration is removed from UI lists without full page refresh.
- [ ] Deleted configurations are no longer selectable in round entry flows.
- [ ] Error responses are surfaced clearly (e.g., configuration in use, permission denied).
- [ ] Action is restricted to authorised admin users only.

### Dependencies
- Tee configuration delete backend API (soft delete preferred)
- Auth/authorisation middleware for admin-only actions
- Course detail page tee configuration list

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
- [x] `courses` table includes: id, name, address, city, country, phone, email, website, timestamps, deleted_at.  
- [x] Name is required and unique per country.  
- [x] Soft delete supported.  
- [x] Migrations apply and roll back cleanly.

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
- [x] `tee_configurations` includes: id, course_id, name, tee_colour, hole_count, course_rating, slope_rating, timestamps.  
- [x] `holes` includes: id, tee_configuration_id, hole_number, distance_yards, par, stroke_index.  
- [x] Hole numbers must be unique per configuration.  
- [x] Stroke index must be 1–18 and unique per configuration.  
- [x] Supports 9‑hole and 18‑hole configurations.

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
- [x] POST `/courses/:id/configurations` accepts configuration metadata + `holes[]`.  
- [x] Validates hole count, hole numbers, par, stroke index.  
- [x] Creates configuration + holes in a single transaction.  
- [x] Returns configuration with holes.  
- [x] Errors follow standard format.

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
- [x] PATCH `/configurations/:id` updates metadata.  
- [x] PATCH `/configurations/:id/holes` updates hole details.  
- [x] Validation rules enforced (hole count, stroke index uniqueness).  
- [x] Returns updated configuration + holes.

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
- [x] GET `/courses/:id` returns course + tee configurations.  
- [x] Includes hole_count, course_rating, slope_rating.  
- [x] Excludes soft‑deleted configurations unless explicitly requested.

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
- [x] GET `/courses` supports `search`, `country`, `page`, `limit`.  
- [x] Search matches name and city.  
- [x] Pagination metadata included.  
- [x] Soft‑deleted courses excluded.

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
- [x] DELETE `/courses/:id` sets `deleted_at`.  
- [x] Deleted courses excluded from search.  
- [x] Rounds referencing the course remain intact.  
- [x] Deletion logged.

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
- [x] `/courses` shows paginated list.  
- [x] Search + filters (country).  
- [x] Clicking a course opens detail page.  
- [x] Tailwind styling consistent with design system.

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
- [x] `/courses/:id` shows course details.  
- [x] Lists tee configurations with rating/slope.  
- [x] Links to configuration detail/edit pages.  
- [x] Responsive layout.

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
- [x] Form for configuration metadata.  
- [x] Editable table/grid for holes (distance, par, stroke index).  
- [x] Validation errors shown clearly.  
- [x] Save triggers appropriate API calls.  
- [x] Success shows toast + redirect.

### Dependencies
- Create/update configuration APIs  
- Frontend routing

### Implementation Notes
- Added a dedicated tee configuration editor page at `apps/web/src/pages/CourseTeeConfigEditorPage.tsx` supporting both create and edit modes.
- Added routes in `apps/web/src/App.tsx`:
	- `/courses/:courseId/configurations/new`
	- `/courses/:courseId/configurations/:configId/edit`
- Extended `coursesApi` in `apps/web/src/api/courses.ts` with:
	- `createConfiguration(courseId, payload)`
	- `updateConfiguration(configId, payload)`
	- `updateConfigurationHoles(configId, holes)`
- Updated `CourseDetailPage` to include navigation actions:
	- Add Tee Configuration button
	- Edit Configuration button per tee configuration card
- Editor includes metadata form fields (name, tee colour, course rating, slope rating) and an editable holes table (hole number, distance, par, stroke index).
- Validation errors are shown in a clear error summary list and block save when invalid.
- Save behavior:
	- Create mode calls configuration create API.
	- Edit mode calls metadata update API and holes update API.
	- Both show success toast and redirect back to course detail page.
- Added tests:
	- `apps/web/src/test/CourseTeeConfigEditorPage.test.tsx` (create, edit, validation)
	- Extended `apps/web/src/api/courses.test.ts` for new API helpers.

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

## 12. Frontend: Course create/edit form

**As an admin**  
I want a form in the frontend to create and edit courses  
So that I can manage course details manually without using CSV import.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** High  
**Target Date:** **20 August 2026**

### Acceptance Criteria
- [x] `/courses/new` and `/courses/:id/edit` routes are available and accessible from the course list/detail pages.  
- [x] Form captures required/optional course fields (name, address, city, country, phone, email, website).  
- [x] Client-side validation mirrors API constraints (required name, country format, URL/email format where provided).  
- [x] Create mode calls the course creation API and edit mode calls the course update API, with validation/server errors shown clearly.  
- [x] Success shows confirmation toast and redirects to the relevant course detail page.

### Dependencies
- Course creation and update APIs (`POST /courses`, `PATCH /courses/:id`)  
- Frontend routing  
- Shared form components / validation utilities

### Implementation Notes
- Added a shared create/edit page at `apps/web/src/pages/CourseFormPage.tsx` with mode-based loading and submit behavior.
- Added routes in `apps/web/src/App.tsx`:
	- `/courses/new`
	- `/courses/:courseId/edit`
- Extended `coursesApi` in `apps/web/src/api/courses.ts` with:
	- `create(payload)`
	- `update(courseId, payload)`
- Updated navigation entry points:
	- `apps/web/src/pages/CoursesPage.tsx` includes a Create Course action.
	- `apps/web/src/pages/CourseDetailPage.tsx` includes an Edit Course action.
- Validation covers required name, 2-letter country code, email format, and website URL format.
- Successful create/update actions show success toasts and redirect to the relevant course detail page.
- Added tests:
	- `apps/web/src/test/CourseFormPage.test.tsx` (create, edit, validation)
	- Extended `apps/web/src/api/courses.test.ts` for create/update API helpers.

---



