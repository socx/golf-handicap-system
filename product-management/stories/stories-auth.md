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
- [ ] POST `/auth/register` accepts email, password, role.  
- [ ] Passwords hashed using bcrypt or Argon2.  
- [ ] Duplicate emails rejected with clear error.  
- [ ] Returns user object + tokens (if auto‑login enabled).  
- [ ] Validation errors follow standard error format.

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
- [ ] POST `/auth/login` validates credentials.  
- [ ] Returns access token + refresh token + expiry.  
- [ ] Invalid credentials return 401 with generic error.  
- [ ] JWT secret + expiry configurable via environment variables.  
- [ ] Refresh token stored/managed according to strategy.

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
- [ ] POST `/auth/refresh` accepts refresh token.  
- [ ] Validates token and issues new access token.  
- [ ] Invalid/expired tokens return 401.  
- [ ] Supports refresh token rotation (optional).  
- [ ] Security considerations documented.

### Dependencies
- Login & JWT issuance  
- Token storage/blacklist strategy

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
- [ ] POST `/auth/logout` invalidates refresh token.  
- [ ] Subsequent use of token fails.  
- [ ] Endpoint requires valid access token.  
- [ ] Logout event logged for audit.

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
- [ ] Middleware checks user role against required permissions.  
- [ ] Roles: `admin`, `player`, `viewer` (configurable).  
- [ ] Unauthorized access returns 403.  
- [ ] RBAC rules documented and test‑covered.

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
- [ ] PATCH `/users/:id/activate` and `/deactivate`.  
- [ ] Deactivated users cannot log in.  
- [ ] Deactivation logged in audit trail.  
- [ ] Admin‑only access enforced.

### Dependencies
- RBAC  
- Users table

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
- [ ] DELETE `/users/:id` sets `deleted_at`.  
- [ ] Deleted users cannot authenticate.  
- [ ] Deleted users excluded from queries unless explicitly included.  
- [ ] Audit log entry created.

### Dependencies
- Users table  
- RBAC  
- Audit logging

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
- [ ] Logs: login success, login failure, logout, refresh, deactivation, deletion.  
- [ ] Stored in `audit_logs` table with timestamp, user_id, IP, event type.  
- [ ] Admin UI can view logs (future epic).  
- [ ] Sensitive data never logged.

### Dependencies
- Login, logout, refresh  
- Users table  
- Audit_logs table (from Security epic)

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
- [ ] POST `/auth/password-reset/request` sends reset token to email.  
- [ ] POST `/auth/password-reset/confirm` validates token and sets new password.  
- [ ] Tokens expire after configurable duration.  
- [ ] Reset events logged.  
- [ ] No user enumeration (same response for valid/invalid email).

### Dependencies
- Email delivery module  
- Token generation  
- Users table

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
- [ ] GET `/auth/me` returns user id, email, role, is_active.  
- [ ] Requires valid access token.  
- [ ] Returns 401 if token invalid or expired.

### Dependencies
- JWT middleware  
- Users table

---

# End of stories-auth.md
