# stories-auth.md
Parent Epic: #296  
(Replace with actual epic issue number after creation)

---

# Authentication & User Management — User Stories

This file contains all user stories for the Authentication & User Management epic, including:
- Story narrative  
- Acceptance criteria  
- Dependencies  
- Size (XS/S/M/L/XL)  
- Estimate (0.5–15 days)  
- Priority  
- Target date (sequential, 6‑hour days, weekdays only)

Start date for this epic: **15 May 2026**

---

## 1. Create users table & migrations

**As a developer**  
I want to create the `users` table and migrations  
So that authentication identities are persisted according to the system specification.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** High  
**Target Date:** **18 May 2026**

### Acceptance Criteria
- [x] `users` table includes: id (UUID), email (citext), password_hash, role, is_active, timestamps, deleted_at.  
- [x] Email is unique and case‑insensitive.  
- [x] Migrations apply and roll back cleanly.  
- [x] DB constraints enforce required fields.

### Dependencies
- PostgreSQL connection  
- Migration tooling (Prisma/Knex/TypeORM)

---

## 2. Implement user registration API

**As a developer**  
I want to implement a secure user registration API  
So that new users can create accounts and access the system.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** High  
**Target Date:** **19 May 2026**

### Acceptance Criteria
- [x] POST `/auth/register` accepts email, password, role.  
- [x] Passwords hashed using bcrypt or Argon2.  
- [x] Duplicate emails rejected with clear error.  
- [x] Returns user object + tokens (if auto‑login enabled).  
- [x] Validation errors follow standard error format.

### Dependencies
- Users table  
- Password hashing library  
- Validation schema

---

## 3. Implement login & JWT issuance

**As a developer**  
I want to implement a login endpoint that issues JWT access and refresh tokens  
So that authenticated users can securely access protected APIs.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** High  
**Target Date:** **21 May 2026**

### Acceptance Criteria
- [x] POST `/auth/login` validates credentials.  
- [x] Returns access token + refresh token + expiry.  
- [x] Invalid credentials return 401 with generic error.  
- [x] JWT secret + expiry configurable via environment variables.  
- [x] Refresh token stored/managed according to strategy.

### Dependencies
- Registration API  
- JWT library  
- Token configuration

---

## 4. Implement refresh token endpoint

**As a developer**  
I want a refresh token endpoint  
So that users can obtain new access tokens without re‑entering credentials.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** Medium  
**Target Date:** **25 May 2026**

### Acceptance Criteria
- [x] POST `/auth/refresh` accepts refresh token.  
- [x] Validates token and issues new access token.  
- [x] Invalid/expired tokens return 401.  
- [x] Supports refresh token rotation (optional).  
- [x] Security considerations documented.

### Dependencies
- Login & JWT issuance  
- Token storage/blacklist strategy

### Security Notes
### Implementation Details

**RBAC Middleware (`verifyAndAuthorize`):**
- Extracts bearer token from Authorization header
- Verifies JWT token using jwt.verify() with JWT secret
- Validates token type is "access" and contains required claims (sub, role, tokenType)
- Validates user role is one of: admin, player, viewer
- Checks if user role is in endpoint's required roles list
- Returns 401 for missing/invalid token
- Returns 403 for insufficient permissions
- Returns authenticated request context on success with userId, role, and claims

**Protected Endpoints Implemented:**
- `GET /api/profile` — All authenticated users (admin, player, viewer)
- `GET /api/admin/status` — Admin only; returns system status (Redis ready, DB pool ready)
- `GET /api/admin/users` — Admin only; returns list of recent users from database

**JWT Claims Structure:**
Access tokens include role field:
```json
{
	"sub": "user-id",
	"role": "admin|player|viewer",
	"tokenType": "access",
	"iat": 1234567890,
	"exp": 1234571490
}
```

**Test Coverage:**
- Admin accessing admin-only endpoint: ✅ 200 OK
- Player accessing admin-only endpoint: ✅ 403 Forbidden
- Player accessing general endpoint: ✅ 200 OK
- Admin accessing general endpoint: ✅ 200 OK
- Missing authorization header: ✅ 401 Unauthorized


---

## 5. Implement logout endpoint

**As a developer**  
I want a logout endpoint that invalidates refresh tokens  
So that users can explicitly end their sessions.

**Size:** XS  
**Estimate:** 0.5 day  
**Priority:** Medium  
**Target Date:** **26 May 2026**

### Acceptance Criteria
- [x] POST `/auth/logout` invalidates refresh token.  
- [x] Subsequent use of token fails.  
- [x] Endpoint requires valid access token.  
- [x] Logout event logged for audit.

### Dependencies
- Refresh token mechanism

---

## 6. Implement role‑based access control (RBAC)

**As a developer**  
I want to implement role‑based access control  
So that only authorised users can access admin‑level or restricted endpoints.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** High  
**Target Date:** **31 May 2026**

### Acceptance Criteria
- [x] Middleware checks user role against required permissions.
- [x] Roles: `admin`, `player`, `viewer` (configurable).
- [x] Unauthorized access returns 403.
- [x] RBAC rules documented and test‑covered.

### Dependencies
- Login & JWT middleware  
- Users table (role field)

---

## 7. Implement account activation & deactivation

**As a developer**  
I want to activate or deactivate user accounts  
So that admins can control access without deleting data.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** Medium  
**Target Date:** **03 June 2026**

### Acceptance Criteria
- [x] PATCH `/users/:id/activate` and `/deactivate`.  
- [x] Deactivated users cannot log in.  
- [x] Deactivation logged in audit trail.  
- [x] Admin‑only access enforced.

### Dependencies
- RBAC  
- Users table

### Implementation Notes
- Added admin-only `PATCH /users/:id/activate` and `PATCH /users/:id/deactivate` routes.
- Added equivalent `/api/users/:id/activate` and `/api/users/:id/deactivate` support for API namespace parity.
- User activation status updates `is_active` and `updated_at` on `users`.
- Deactivated users are denied at login by existing `is_active` login check.
- Deactivation and activation emit structured audit trail events: `auth_user_deactivated` and `auth_user_activated`.

---

## 8. Implement soft delete for users

**As a developer**  
I want to soft delete users  
So that accounts can be removed without losing historical data.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** Medium  
**Target Date:** **05 June 2026**

### Acceptance Criteria
- [x] DELETE `/users/:id` sets `deleted_at`.  
- [x] Deleted users cannot authenticate.  
- [x] Deleted users excluded from queries unless explicitly included.  
- [x] Audit log entry created.

### Dependencies
- Users table  
- RBAC  
- Audit logging

### Implementation Notes
- Added admin-only soft-delete endpoints: `DELETE /users/:id` and `DELETE /api/users/:id`.
- Soft delete updates `deleted_at`, `updated_at`, and forces `is_active = false`.
- Authentication already excludes soft-deleted users via `deleted_at IS NULL` in auth lookups.
- Admin users list now excludes soft-deleted users by default; pass `includeDeleted=true` to include them explicitly.
- Soft-delete emits structured audit event `auth_user_deleted` with actor and target user ids.

---

## 9. Implement audit logging for authentication events

**As a developer**  
I want to log authentication‑related events  
So that security and compliance requirements are met.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** Medium  
**Target Date:** **10 June 2026**

### Acceptance Criteria
- [x] Logs: login success, login failure, logout, refresh, deactivation, deletion.  
- [x] Stored in `audit_logs` table with timestamp, user_id, IP, event type.  
- [x] Admin UI can view logs (future epic).  
- [x] Sensitive data never logged.

### Dependencies
- Login, logout, refresh  
- Users table  
- Audit_logs table (from Security epic)

### Implementation Notes
- `logAuthAuditEvent()` upgraded to async DB-persistent function inserting into `audit_logs`.
- `getClientIp()` helper reads `x-forwarded-for`, `x-real-ip`, and `socket.remoteAddress`.
- Events: `auth_login_success`, `auth_login_failure`, `auth_logout`, `auth_refresh`, `auth_user_activated`, `auth_user_deactivated`, `auth_user_deleted`.
- Migration: `packages/db/migrations/003_auth_audit_logs.sql`.
- E2E verified: all 6 event types persisted with IP; no passwords/tokens in metadata.

---

## 10. Implement password reset (request + confirm)

**As a developer**  
I want to implement password reset functionality  
So that users can recover access securely.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** Medium  
**Target Date:** **17 June 2026**

### Acceptance Criteria
- [x] POST `/auth/password-reset/request` sends reset token to email.  
- [x] POST `/auth/password-reset/confirm` validates token and sets new password.  
- [x] Tokens expire after configurable duration.  
- [x] Reset events logged.  
- [x] No user enumeration (same response for valid/invalid email).

### Dependencies
- Email delivery module  
- Token generation  
- Users table

### Implementation Notes
- Added `password_reset_tokens` persistence with one-time-use token hashes and expiry (`packages/db/migrations/004_password_reset_tokens.sql`).
- Added endpoints: `POST /auth/password-reset/request` and `POST /auth/password-reset/confirm`.
- Local dev uses Mailpit by default (`EMAIL_TRANSPORT=mailpit`); production defaults to SMTP (`EMAIL_TRANSPORT=smtp` or `NODE_ENV=production`).
- Added auth audit events: `auth_password_reset_requested`, `auth_password_reset_completed`.
- E2E validated with Mailpit: reset email delivery, non-enumerating request response, successful reset, old-password rejection, and used-token replay rejection.

---

## 11. Implement session introspection endpoint

**As a developer**  
I want an endpoint to introspect the current session  
So that the frontend can determine the user’s identity and role.

**Size:** XS  
**Estimate:** 0.5 day  
**Priority:** Low  
**Target Date:** **18 June 2026**

### Acceptance Criteria
- [x] GET `/auth/me` returns user id, email, role, is_active.  
- [x] Requires valid access token.  
- [x] Returns 401 if token invalid or expired.

### Dependencies
- JWT middleware  
- Users table

### Implementation Notes
- Added session introspection endpoint support for both `GET /auth/me` and `GET /api/auth/me`.
- Endpoint is enforced by JWT access-token validation and returns `401` for missing, invalid, or expired tokens.
- Response includes authenticated user identity fields required by frontend session bootstrapping (`id`, `email`, `role`, `is_active`).
- Linked implementation commit: `dacb559` (`#58 feat(auth): implement GET /auth/me session introspection endpoint`).

---

## 12. Self-registration creates linked player profile

**As a self-registering player**  
I want signup to create both my user account and a linked player profile  
So that I can immediately access player-scoped pages after activation without manual admin linking.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** High  
**Target Date:** **19 June 2026**

### Acceptance Criteria
- [ ] When self-registration is enabled on backend and frontend, `POST /auth/register` creates a `users` row and a linked `players` row for player registrations.
- [ ] New player profile is linked via `players.user_id = users.id`.
- [ ] Auto-created player profile uses safe default values and remains editable by admins/users later.
- [ ] Existing admin registration path remains unchanged.
- [ ] Duplicate-email and linkage errors return clear responses and do not leave partial inconsistent state.

### Dependencies
- User registration API
- Players table
- Player linking constraints

---

## 13. Frontend: Forgot password and reset password flow

**As a user**  
I want a forgot-password path from the login screen and a reset form  
So that I can recover account access without admin intervention.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** High  
**Target Date:** **TBD**

### Acceptance Criteria
- [x] Login page includes a clear "Forgot password?" link.
- [x] Link routes to a password reset request page where user submits email.
- [x] Request page calls `POST /auth/password-reset/request` and shows non-enumerating success feedback.
- [x] Reset page accepts token and new password, calls `POST /auth/password-reset/confirm`, and handles success/error states.
- [x] Reset flow supports token passed via URL query string.
- [x] On successful reset, user is redirected to login with confirmation messaging.
- [x] Frontend tests cover request and confirm flows, including error handling.

### Dependencies
- Password reset APIs (`/auth/password-reset/request`, `/auth/password-reset/confirm`)
- Email delivery module
- Auth frontend routing

### Implementation Notes
- Added frontend auth routes in `apps/web/src/App.tsx`:
	- `/auth/forgot-password`
	- `/auth/reset-password`
	- `/reset-password` (compatibility with reset-link URLs)
- Added login-page recovery entry point in `apps/web/src/pages/LoginPage.tsx` with a `Forgot password?` link.
- Added `ForgotPasswordPage` in `apps/web/src/pages/ForgotPasswordPage.tsx` calling `POST /auth/password-reset/request`.
- Added `ResetPasswordPage` in `apps/web/src/pages/ResetPasswordPage.tsx` using token query param and calling `POST /auth/password-reset/confirm`.
- Extended `authApi` in `apps/web/src/api/auth.ts` with `requestPasswordReset` and `confirmPasswordReset` helpers.
- Added frontend coverage in `apps/web/src/test/ForgotResetPasswordPages.test.tsx` for request and confirm flows.

---

# End of stories-auth.md
