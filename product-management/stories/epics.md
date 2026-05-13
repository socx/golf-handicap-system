# Epics

## Epic: Authentication & User Management

Provide secure registration, login, and session management so only authorised users can access the system and their data.

**Goals:**
- User registration with email/password and role.
- Secure login with JWT access/refresh tokens.
- Token refresh and logout.
- Basic account lifecycle (activation, soft delete).

---

## Epic: Player Management

Manage player profiles as the core golf entities in the system, including identity, contact details, and current handicap index.

**Goals:**
- CRUD for players (first/middle/last names, DOB, gender, club, email, country).
- Link players to auth users (1:1 where applicable).
- Search and filter players by name, email, club, country.
- Store and expose current handicap index and history.

---

## Epic: Course & Tee Configuration Management

Model golf courses, tee configurations, and per‑hole data to support accurate scoring and WHS calculations.

**Goals:**
- CRUD for courses (name, address, phone, email).
- CRUD for tee configurations (name, tee colour, hole count, course rating, slope rating).
- CRUD for holes (distance, par, stroke index) per configuration.
- Validation of 9/18‑hole configurations and stroke index uniqueness.

---

## Epic: Round Entry & Score Processing

Allow detailed round entry with per‑hole stats and compute derived metrics needed for analytics and WHS.

**Goals:**
- Store rounds linked to players and tee configurations.
- Store per‑hole scores (strokes, putts, GIR, fairway hit, sand, penalties).
- Compute Net Double Bogey adjusted scores per hole.
- Aggregate per‑round stats (totals, GIR/FIR %, penalties, etc.).

---

## Epic: Handicap Calculation (WHS)

Implement WHS‑compliant handicap index calculation, including differentials, eligibility, caps, and history.

**Goals:**
- Compute score differentials per round using WHS formula.
- Apply WHS rules for selecting lowest differentials (3–20 rounds).
- Enforce minimum 54 eligible holes for initial index.
- Implement soft cap/hard cap and store handicap history.

---

## Epic: Frontend Application (React + Tailwind)

Deliver a responsive SPA for players and admins to manage data, enter rounds, and view handicaps and stats.

**Goals:**
- React SPA with routing for players, courses, rounds, handicap, admin.
- Tailwind‑based design system and layout.
- Integration with backend APIs via Axios/React Query.
- Form handling and validation with React Hook Form + Zod.

---

## Epic: Dashboard & Analytics

Provide dashboards and analytics to help players and admins understand performance and trends over time.

**Goals:**
- Player dashboard with recent rounds and handicap trend.
- Per‑player stats: GIR %, FIR %, average putts, penalties, scoring averages.
- Course/club‑level stats where applicable.
- Visualisations using charts (e.g., Recharts).

---

## Epic: Admin Panel

Provide admin‑only tools for managing users, players, rounds, handicaps, and audit logs.

**Goals:**
- Admin authentication and role‑based access control.
- Round approval/unapproval workflow.
- Handicap overrides and exceptional scoring adjustments.
- Audit log viewer for key data changes.

---

## Epic: Notifications

Notify players and admins about important events such as handicap changes, new rounds, and competition results.

**Goals:**
- Email notifications on handicap recalculation.
- Optional notifications on new round submissions and approvals.
- Configurable notification preferences per user.
- Extensible design for future channels (e.g., push).

---

## Epic: PDF/Scorecard Export

Generate printable and shareable scorecards and related documents for rounds and competitions.

**Goals:**
- Generate PDF/PNG scorecards for individual rounds.
- Include course, tee configuration, player, and per‑hole details.
- Provide download links from the UI.
- Store or stream generated files via object storage.

---

## Epic: Leaderboard & Rankings

Provide leaderboards and rankings at club or course level based on handicap and performance.

**Goals:**
- Leaderboards by club, gender, age group, or date range.
- Sorting by handicap index, scoring average, or other metrics.
- Basic competition/season standings (where applicable).
- Efficient queries and caching for leaderboard data.

---

## Epic: Infrastructure & DevOps

Provide robust infrastructure, deployment, and observability for the system.

**Goals:**
- Dockerised services and Docker Compose for local dev.
- CI/CD pipeline for automated build, test, and deploy.
- Monitoring (metrics, health checks) and alerting.
- Centralised logging and log retention strategy.

---

## Epic: Security & Compliance

Enforce security best practices and protect user and player data, including PII.

**Goals:**
- Input validation and sanitisation across all APIs.
- Rate limiting and basic API protection at gateway level.
- HTTPS, secure headers, and CORS configuration.
- Encryption of sensitive data at rest and in transit, plus audit trail.

---

## Epic: PWA & Mobile Enhancements

Provide PWA capabilities and mobile‑friendly features for on‑course usage with unreliable connectivity.

**Goals:**
- PWA manifest and service worker for offline support.
- Offline score entry and sync when back online.
- Add‑to‑home‑screen support on mobile devices.
- Push notifications for key events (where supported).
