# stories-frontend.md
Parent Epic: #301  
(Replace with actual epic issue number after creation)

---

# Frontend Application (React + Tailwind) — User Stories

This file contains all user stories for the Frontend Application epic, including:
- Story narrative  
- Acceptance criteria  
- Dependencies  
- Size (XS/S/M/L/XL)  
- Estimate (0.5–15 days)  
- Priority  
- Target date (sequential, 6‑hour days, weekdays only)

Start date for this epic (after Handicap epic ends): **22 September 2026**

---

## 1. Set up React application with Vite + Tailwind

**As a developer**  
I want to set up the React application with Vite and Tailwind  
So that I have a fast, modern, and maintainable frontend foundation.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** High  
**Target Date:** **22 September 2026**

### Acceptance Criteria
- [ ] Vite project created with React + TypeScript.  
- [ ] Tailwind configured with custom theme.  
- [ ] Base layout and folder structure established.  
- [ ] ESLint + Prettier configured.  
- [ ] Environment variable handling set up.

### Dependencies
- None (frontend foundation)

---

## 2. Implement global layout (header, sidebar, footer)

**As a developer**  
I want a global layout with navigation  
So that users can move between major sections of the app.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** High  
**Target Date:** **24 September 2026**

### Acceptance Criteria
- [ ] Header with app name + user menu.  
- [ ] Sidebar with navigation links (Players, Courses, Rounds, Handicap, Admin).  
- [ ] Responsive layout for mobile/tablet.  
- [ ] Tailwind styling consistent with design system.

### Dependencies
- React app setup

---

## 3. Implement authentication pages (login, register)

**As a developer**  
I want login and registration pages  
So that users can authenticate and access the system.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** High  
**Target Date:** **26 September 2026**

### Acceptance Criteria
- [x] Login form with email + password.  
- [x] Registration form (admin‑only access).  
- [x] Validation using React Hook Form + Zod.  
- [x] Error messages displayed clearly.  
- [x] Successful login stores tokens and redirects.

### Dependencies
- Auth APIs  
- Global layout

### Implementation Notes
- Added routed auth pages at `/auth/login` and `/auth/register` in `apps/web/src/App.tsx`.
- Implemented forms in `apps/web/src/pages/LoginPage.tsx` and `apps/web/src/pages/RegisterPage.tsx` using React Hook Form + Zod.
- Added clear inline and submit-level error messaging via `setError('root', ...)`.
- Implemented login success flow to persist tokens + user to localStorage and redirect to `/`.
- Registration page enforces admin-only access by checking the authenticated user role via `/auth/me`.

---



## 4. Implement authentication state management

**As a developer**  
I want to manage authentication state globally  
So that protected routes and user identity are handled correctly.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** High  
**Target Date:** **28 September 2026**

### Acceptance Criteria
- [ ] Access token stored securely (memory + refresh token strategy).  
- [ ] Auto‑refresh of tokens implemented.  
- [ ] `useAuth()` hook exposes user + role + login/logout.  
- [ ] Protected routes redirect to login.

### Dependencies
- Login API  
- Refresh token API

---

## 5. Implement API client (Axios + interceptors)

**As a developer**  
I want a reusable API client  
So that all API calls share consistent behaviour.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** High  
**Target Date:** **30 September 2026**

### Acceptance Criteria
- [ ] Axios instance with base URL + interceptors.  
- [ ] Automatically attaches access token.  
- [ ] Handles 401 → refresh token → retry.  
- [ ] Standardised error format.

### Dependencies
- Auth state management  
- Refresh token API

---

## 6. Implement dashboard shell (empty widgets)

**As a developer**  
I want a dashboard shell  
So that future widgets can be added incrementally.

**Size:** XS  
**Estimate:** 0.5 day  
**Priority:** Medium  
**Target Date:** **01 October 2026**

### Acceptance Criteria
- [ ] `/dashboard` route created.  
- [ ] Placeholder widgets for handicap summary, recent rounds, stats.  
- [ ] Responsive grid layout.

### Dependencies
- Global layout

---

## 7. Implement reusable UI components

**As a developer**  
I want reusable UI components  
So that the frontend is consistent and maintainable.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** High  
**Target Date:** **06 October 2026**

### Acceptance Criteria
- [ ] Buttons (primary, secondary, danger).  
- [ ] Inputs, selects, date pickers.  
- [ ] Cards, modals, tables, pagination.  
- [ ] Tailwind variants for sizes + states.  
- [ ] Storybook or component preview page.

### Dependencies
- Tailwind setup  
- Global layout

### Implementation Notes
- Added class-driven dark mode variant binding for Tailwind v4 in `apps/web/src/index.css`.
- Corrected root selector to `:root.dark` so global dark colors apply when the theme toggle sets the `dark` class.

---

## 8. Implement player selectors (autocomplete)

**As a developer**  
I want a player selector component  
So that round entry and admin tools can easily select players.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** Medium  
**Target Date:** **08 October 2026**

### Acceptance Criteria
- [ ] Autocomplete search hitting `/players?search=`.  
- [ ] Shows name, club, country.  
- [ ] Keyboard navigation supported.  
- [ ] Reusable across forms.

### Dependencies
- Player search API  
- UI components

---

## 9. Implement course + tee configuration selectors

**As a developer**  
I want selectors for courses and tee configurations  
So that round entry flows are smooth.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** Medium  
**Target Date:** **10 October 2026**

### Acceptance Criteria
- [ ] Course dropdown with search.  
- [ ] Tee configuration dropdown filtered by course.  
- [ ] Shows rating/slope.  
- [ ] Reusable across forms.

### Dependencies
- Course search API  
- Tee configuration API

---

## 10. Implement error boundary + global error handling

**As a developer**  
I want global error handling  
So that the app gracefully handles unexpected failures.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** Medium  
**Target Date:** **12 October 2026**

### Acceptance Criteria
- [x] Error boundary wraps main app.  
- [x] Friendly error screen displayed.  
- [x] API errors surfaced via toast notifications.  
- [x] Logging to backend (optional).

### Dependencies
- API client  
- UI components

---

## 11. Implement loading states + skeletons

**As a developer**  
I want loading skeletons  
So that the UI feels responsive and polished.

**Size:** XS  
**Estimate:** 0.5 day  
**Priority:** Low  
**Target Date:** **13 October 2026**

### Acceptance Criteria
- [x] Skeleton components for lists, forms, cards.  
- [x] Used across player, course, round pages.  
- [x] Tailwind animations enabled.

### Dependencies
- UI components

---

## 12. Implement theme support (light/dark mode)

**As a developer**  
I want theme support  
So that users can choose light or dark mode.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** Low  
**Target Date:** **15 October 2026**

### Acceptance Criteria
- [x] Light/dark mode toggle.  
- [x] Tailwind dark mode classes configured.  
- [x] Theme stored in localStorage.  
- [x] Smooth transitions.

### Dependencies
- Tailwind setup  
- Global layout

---

## 13. Implement notifications UI (toast system)

**As a developer**  
I want a toast notification system  
So that the app can provide feedback for actions.

**Size:** XS  
**Estimate:** 0.5 day  
**Priority:** Medium  
**Target Date:** **16 October 2026**

### Acceptance Criteria
- [x] Toasts for success, error, warning, info.  
- [x] Auto‑dismiss + manual close.  
- [x] Accessible (ARIA roles).  
- [x] Reusable across app.

### Dependencies
- UI components

---

## 14. Implement settings page (profile + preferences)

**As a developer**  
I want a settings page  
So that users can update their profile and preferences.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** Medium  
**Target Date:** **21 October 2026**

### Acceptance Criteria
- [ ] Update email, password, notification preferences.  
- [ ] Update theme preference.  
- [ ] Validation + error handling.  
- [ ] Save triggers appropriate APIs.

### Dependencies
- Auth APIs  
- Notification preferences API

---

## 15. Implement mobile‑responsive layout

**As a developer**  
I want the app to be mobile‑responsive  
So that users can access it on phones and tablets.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** Medium  
**Target Date:** **26 October 2026**

### Acceptance Criteria
- [x] Sidebar collapses into mobile drawer.  
- [x] Tables scroll horizontally.  
- [x] Forms adapt to small screens.  
- [x] Scorecard view optimised for mobile.

### Dependencies
- Global layout  
- UI components

---

# End of stories-frontend.md
