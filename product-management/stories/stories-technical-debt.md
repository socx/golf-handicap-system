# stories-technical-debt.md
Parent Epic: #TBD  
(Replace with actual epic issue number after creation)

---

# Technical Debt, Frontend Polish & API Foundations — User Stories

This file contains technical debt and UX consistency stories that cut across the platform, including:
- API runtime and structure cleanup
- Frontend iconography improvements
- Frontend motion and transition polish

Start date for this epic: **TBD**

---

## 1. Introduce Express for the API

**As a developer**  
I want the API to use Express with a clearer folder structure  
So that HTTP concerns, domain logic, and infrastructure code are easier to maintain and extend.

**Size:** L  
**Estimate:** 5–8 days  
**Priority:** High  
**Target Date:** **TBD**

### Acceptance Criteria
- [x] API bootstrapping uses Express as the HTTP framework.
- [x] Folder structure is organized along clear boundaries, similar to:
  - `src/config/`
  - `src/database/`
  - `src/middlewares/`
  - `src/modules/`
  - `src/app.ts`
  - `src/server.ts`
- [x] Environment validation is centralized.
- [x] PostgreSQL connection pool initialization is isolated from request handling.
- [x] Error handling is centralized in middleware.
- [ ] Feature modules own their routes, controllers, services, repositories, and schemas.
- [x] Existing API routes continue to pass their current test coverage.

### Dependencies
- Existing API route behavior
- Database access layer
- Environment configuration approach

### Implementation Notes
- This is a refactor story, not a feature story.
- The desired outcome is a maintainable HTTP layer with clearer separation of concerns.
- The new structure should preserve current API behavior while reducing coupling between routes and business logic.
- Completed in issue #523 with Express app/server split, centralized env validation, isolated DB pool setup, and centralized error middleware.
- Validation evidence: `npm run build --workspace apps/api`, `npm run lint --workspace apps/api`, `node --test apps/api/test/courses.e2e.test.mjs` (5/5 pass), `node --test apps/api/test/rounds-create.e2e.test.mjs` (24/24 pass).

---

## 2. Frontend: Add consistent icons across the UI

**As a developer**  
I want relevant icons throughout the frontend  
So that navigation, page headers, and common actions are easier to scan and feel more polished.

**Size:** M  
**Estimate:** 2–4 days  
**Priority:** Medium  
**Target Date:** **TBD**

### Acceptance Criteria
- [ ] Navigation items include relevant icons.
- [ ] Page headers include relevant icons where appropriate.
- [ ] Action buttons use appropriate icons for common actions such as:
  - create
  - update
  - delete
  - go back
  - export to CSV
  - export to PDF
- [ ] Any other appropriate icon use is applied consistently.
- [ ] Icon usage does not reduce accessibility or clarity.

### Dependencies
- Frontend component library / icon set
- Existing layout and button components

### Implementation Notes
- Icons should reinforce meaning, not add noise.
- The selected icon set should remain consistent across the app.

---

## 3. Frontend: Add transitions and motion polish

**As a developer**  
I want subtle transitions and animations in the frontend  
So that the application feels sleeker and more responsive without becoming distracting.

**Size:** M  
**Estimate:** 2–4 days  
**Priority:** Medium  
**Target Date:** **TBD**

### Acceptance Criteria
- [ ] Page transitions or entry animations are applied where appropriate.
- [ ] Component hover/focus states use smoother transitions.
- [ ] Loading and state changes feel intentional rather than abrupt.
- [ ] Motion is subtle, performant, and respectful of reduced-motion preferences.
- [ ] Existing UX remains usable on desktop and mobile.

### Dependencies
- Frontend layout and component system
- CSS animation / transition approach

### Implementation Notes
- Motion should support readability and hierarchy.
- Avoid decorative animation that does not improve comprehension.
