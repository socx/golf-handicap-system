# Golf Handicap & Round Management System — Full Specification

> **Version:** 1.0  
> **Date:** May 2026  
> **Stack:** Node.js REST API · PostgreSQL · React · Tailwind CSS

---

## Table of Contents

1. [Recommended Additional Features](#1-recommended-additional-features)
2. [System Overview](#2-system-overview)
3. [System Architecture](#3-system-architecture)
4. [REST API Modules & Endpoint Groups](#4-rest-api-modules--endpoint-groups)
5. [Database Schema (PostgreSQL)](#5-database-schema-postgresql)
6. [API Contract Documentation](#6-api-contract-documentation)
7. [World Handicap System (WHS) Logic](#7-world-handicap-system-whs-logic)
8. [Frontend Architecture](#8-frontend-architecture)
9. [Infrastructure & DevOps](#9-infrastructure--devops)
10. [Security Considerations](#10-security-considerations)
11. [Project Directory Structure](#11-project-directory-structure)
12. [Implementation Roadmap](#12-implementation-roadmap)

---

## 1. Recommended Additional Features

Beyond the core requirements, the following features are strongly recommended to make the system production-ready and genuinely useful:

### 1.1 Handicap History & Trends
Track every handicap calculation over time so players can see their progression (or regression) across weeks, months and seasons. Include a chart showing handicap index movement.

### 1.2 Scorecard PDF / Image Export
Allow players to export a completed scorecard as a PDF or PNG for sharing or printing. Useful for official submissions and social sharing.

### 1.3 Leaderboard / Club Rankings
Display a club-level leaderboard sorted by handicap index. Add filters by gender, age group, or date range.

### 1.4 Round Statistics Dashboard
Per-player and per-course analytics: greens in regulation %, fairways hit %, average putts per hole, sand saves, average penalties per round, scoring average net/gross, best/worst holes.

### 1.5 Competition / Tournament Module
Allow creation of a competition event, associate multiple players with it, automatically apply playing handicaps, calculate net scores and produce a results table (Stableford, Stroke Play, Match Play).

### 1.6 Differential History & Best Differentials Panel
Show the 8 best score differentials used in the current handicap calculation, and the full list of differentials for the last 20 rounds, so players understand exactly how their index is derived.

### 1.7 Tee-Time Booking Stub / Integration Points
A lightweight tee-time request feature, or hooks to integrate with external booking systems at partner clubs.

### 1.8 Multi-language & Multi-currency Support
Clubs in different countries may need UI in local languages; the architecture should support i18n from day one.

### 1.9 Notifications & Reminders
Email/push notifications when a handicap is recalculated, when a new round is posted for the player, or when a competition result is published.

### 1.10 Admin Panel
A dedicated back-office UI for club administrators to manage members, approve rounds, override handicaps when required by WHS exceptional scoring rules, and configure club-level settings.

### 1.11 Mobile-First PWA
Progressive Web App capabilities (offline scorecard entry, push notifications, add-to-home-screen), since golfers are on the course without reliable connectivity.

### 1.12 Soft Delete / Audit Trail
All data mutations should be soft-deleted and logged (who changed what, and when) so there is a full audit trail — a common requirement in formal golf associations.

---

## 2. System Overview

This application is a full-featured golf club management system that:

- Manages player profiles and their **WHS Handicap Index**
- Manages golf courses and their **tee configurations**
- Records detailed **round scorecards** with per-hole statistics
- Calculates and tracks handicap indexes using the **World Handicap System (WHS)**
- Provides analytics and reporting for players and administrators

---

## 3. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT TIER                             │
│                                                                 │
│   ┌──────────────────────────────────────────────────────┐      │
│   │        React SPA  (Tailwind CSS + Vite)              │      │
│   │   Players · Courses · Rounds · Handicap · Stats      │      │
│   └────────────────────┬─────────────────────────────────┘      │
└────────────────────────┼────────────────────────────────────────┘
                         │  HTTPS / REST + JSON
┌────────────────────────▼────────────────────────────────────────┐
│                        API TIER                                 │
│                                                                 │
│   ┌──────────────────────────────────────────────────────┐      │
│   │  REST API (Express)                                  │      │
│   │  Modules: auth, players, courses, rounds, handicap   │      │
│   │  Shared middleware: auth, validation, rate limiting  │      │
│   └──────────────────────────────┬───────────────────────┘      │
└──────────────────────────────────┼───────────────────────────────┘
              │
┌──────────────────────────────────▼───────────────────────────────┐
│                     DATA TIER                                   │
│                                                                 │
│   ┌────────────────────────────────┐   ┌─────────────────┐     │
│   │    PostgreSQL (Primary DB)     │   │   Redis Cache   │     │
│   │  golf_db                       │   │  (Sessions,     │     │
│   │  - players                     │   │   rate limits,  │     │
│   │  - courses / tee_configs       │   │   leaderboard)  │     │
│   │  - rounds / hole_scores        │   └─────────────────┘     │
│   │  - handicap_records            │                           │
│   │  - users / audit_log           │                           │
│   └────────────────────────────────┘                           │
│                                                                 │
│   ┌────────────────────────────────┐                           │
│   │    S3-Compatible Object Store  │                           │
│   │    (avatars, PDF exports)      │                           │
│   └────────────────────────────────┘                           │
└────────────────────────────────────────────────────────────────┘
```

### Communication Pattern

| Communication | Protocol |
|---|---|
| Client → REST API | HTTPS REST/JSON |
| REST API → PostgreSQL | TCP (pg driver / connection pool) |
| REST API → Redis | TCP (ioredis) |
| Async events (e.g. handicap recalc) | Internal event emitter or lightweight message queue (e.g. BullMQ) |

---

## 4. REST API Modules & Endpoint Groups

### 4.1 Auth Module (`/auth`)
Handles user registration, login, JWT issuance and refresh. Users are linked to player profiles (a player is the golf entity; a user is the login identity).

### 4.2 Player Module (`/players`)
CRUD for player profiles. Validates uniqueness of email. Exposes search/filter endpoints. Returns current handicap index (fetched from handicap records or cached).

### 4.3 Course Module (`/courses`)
CRUD for golf courses and their tee/round configurations. Each configuration holds per-hole data (distance, par, HCP stroke index). Validates that hole count is exactly 9 or 18.

### 4.4 Round Module (`/rounds`)
Records completed rounds. Accepts per-hole scores and stat flags. Validates hole count against the linked course configuration. Computes per-round statistics (GIR%, FIR%, putts, etc.) on write. Triggers handicap recalculation event.

### 4.5 Handicap Module (`/handicap`)
Implements WHS Score Differential calculation and Handicap Index derivation. Exposes endpoints to calculate, retrieve and list handicap history for a player. Consumes round data within the same API application.

---

## 5. Database Schema (PostgreSQL)

```sql
-- ============================================================
--  EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";

-- ============================================================
--  USERS  (authentication identities)
-- ============================================================
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           CITEXT UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    role            TEXT NOT NULL DEFAULT 'player'   -- 'player' | 'admin'
                    CHECK (role IN ('player','admin')),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ                       -- soft delete
);

-- ============================================================
--  PLAYERS  (golf entity, linked 1:1 to a user)
-- ============================================================
CREATE TABLE players (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    first_name      TEXT NOT NULL,
    middle_name     TEXT,
    last_name1      TEXT NOT NULL,
    last_name2      TEXT,
    date_of_birth   DATE NOT NULL,
    gender          TEXT NOT NULL CHECK (gender IN ('male','female','non_binary','prefer_not_to_say')),
    club            TEXT,
    email           CITEXT UNIQUE NOT NULL,
    country         TEXT NOT NULL,                   -- ISO 3166-1 alpha-2
    handicap_index  NUMERIC(4,1),                    -- current WHS index; null until first calc
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

-- ============================================================
--  COURSES
-- ============================================================
CREATE TABLE courses (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT NOT NULL,
    address     TEXT,
    phone       TEXT,
    email       CITEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ
);

-- ============================================================
--  TEE CONFIGURATIONS  (one course has many configurations)
-- ============================================================
CREATE TABLE tee_configurations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id       UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,                   -- e.g. "Men's Yellow Tees"
    tee_colour      TEXT NOT NULL,                   -- e.g. "Yellow"
    hole_count      SMALLINT NOT NULL CHECK (hole_count IN (9, 18)),
    course_rating   NUMERIC(4,1) NOT NULL,           -- e.g. 71.4
    slope_rating    SMALLINT NOT NULL                -- 55–155 per WHS
                    CHECK (slope_rating BETWEEN 55 AND 155),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    UNIQUE (course_id, name, tee_colour)
);

-- ============================================================
--  HOLES  (per-hole config for each tee configuration)
-- ============================================================
CREATE TABLE holes (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tee_configuration_id UUID NOT NULL
                        REFERENCES tee_configurations(id) ON DELETE CASCADE,
    hole_number         SMALLINT NOT NULL CHECK (hole_number BETWEEN 1 AND 18),
    distance_yards      SMALLINT NOT NULL CHECK (distance_yards > 0),
    par                 SMALLINT NOT NULL CHECK (par BETWEEN 3 AND 6),
    stroke_index        SMALLINT NOT NULL,           -- handicap stroke index (HCP); 1–18 for 18 holes
    UNIQUE (tee_configuration_id, hole_number)
);

-- ============================================================
--  ROUNDS  (a completed round of golf)
-- ============================================================
CREATE TABLE rounds (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id               UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    tee_configuration_id    UUID NOT NULL REFERENCES tee_configurations(id),
    played_at               DATE NOT NULL,
    playing_handicap        NUMERIC(4,1),            -- handicap actually used; auto-calculated or manual
    adjusted_gross_score    SMALLINT,                -- sum of net double bogey adjusted scores
    score_differential      NUMERIC(5,2),            -- WHS: (113 / slope) * (adj_gross - course_rating - ph_adj)
    total_gross_score       SMALLINT,                -- raw total strokes
    total_putts             SMALLINT,
    fairways_hit            SMALLINT,
    fairways_applicable     SMALLINT,                -- holes with a fairway (excludes par 3s)
    greens_in_regulation    SMALLINT,
    sand_saves              SMALLINT,
    total_penalties         SMALLINT,
    is_away_round           BOOLEAN NOT NULL DEFAULT FALSE,
    notes                   TEXT,
    is_approved             BOOLEAN NOT NULL DEFAULT TRUE,  -- admin can unapprove
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at              TIMESTAMPTZ
);

-- ============================================================
--  HOLE SCORES  (per-hole result within a round)
-- ============================================================
CREATE TABLE hole_scores (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    round_id            UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
    hole_number         SMALLINT NOT NULL CHECK (hole_number BETWEEN 1 AND 18),
    strokes             SMALLINT NOT NULL CHECK (strokes >= 0),
    putts               SMALLINT CHECK (putts >= 0),
    green_in_regulation BOOLEAN NOT NULL DEFAULT FALSE,
    fairway_hit         BOOLEAN,                     -- NULL for par 3 holes
    in_sand             BOOLEAN NOT NULL DEFAULT FALSE,
    penalties           SMALLINT NOT NULL DEFAULT 0 CHECK (penalties >= 0),
    net_double_bogey_adjusted SMALLINT,              -- WHS adjusted score for this hole
    UNIQUE (round_id, hole_number)
);

-- ============================================================
--  HANDICAP RECORDS  (history of every handicap calculation)
-- ============================================================
CREATE TABLE handicap_records (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id           UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    handicap_index      NUMERIC(4,1) NOT NULL,
    calculation_date    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    rounds_used         UUID[],                      -- array of round IDs used in calculation
    num_differentials   SMALLINT NOT NULL,           -- how many differentials were averaged
    average_differential NUMERIC(5,2) NOT NULL,
    adjustment          NUMERIC(3,1) NOT NULL DEFAULT 0,  -- WHS soft cap / hard cap adjustment
    low_handicap_index  NUMERIC(4,1),                -- lowest in the 365-day lookback window
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
--  AUDIT LOG
-- ============================================================
CREATE TABLE audit_log (
    id          BIGSERIAL PRIMARY KEY,
    user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    action      TEXT NOT NULL,                       -- e.g. 'round.create'
    entity      TEXT NOT NULL,                       -- table name
    entity_id   UUID,
    diff        JSONB,                               -- before/after values
    ip_address  INET,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
--  INDEXES
-- ============================================================
CREATE INDEX idx_players_email ON players(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_rounds_player_date ON rounds(player_id, played_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_rounds_tee_config ON rounds(tee_configuration_id);
CREATE INDEX idx_hole_scores_round ON hole_scores(round_id);
CREATE INDEX idx_handicap_records_player ON handicap_records(player_id, calculation_date DESC);
CREATE INDEX idx_tee_configurations_course ON tee_configurations(course_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_holes_tee_config ON holes(tee_configuration_id);
CREATE INDEX idx_audit_log_entity ON audit_log(entity, entity_id);
```

---

## 6. API Contract Documentation

All endpoints return `application/json`. All timestamps are ISO 8601 UTC. Authentication uses Bearer JWT in the `Authorization` header unless noted.

**Base URL:** `https://api.yourdomain.com/api/v1`

**Standard error envelope:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human readable message",
    "details": []
  }
}
```

---

### 6.1 Auth Endpoints (`/auth`)

#### POST /auth/register
Create a user account.
```json
// Request
{
  "email": "john@example.com",
  "password": "Str0ngP@ss!",
  "role": "player"
}

// Response 201
{
  "user": { "id": "uuid", "email": "john@example.com", "role": "player" },
  "token": "jwt_access_token",
  "refreshToken": "jwt_refresh_token"
}
```

#### POST /auth/login
```json
// Request
{ "email": "john@example.com", "password": "Str0ngP@ss!" }

// Response 200
{ "token": "...", "refreshToken": "...", "expiresIn": 3600 }
```

#### POST /auth/refresh
```json
// Request
{ "refreshToken": "..." }
// Response 200 — new access token
```

#### POST /auth/logout
Invalidates the refresh token. Response 204.

---

### 6.2 Player Endpoints (`/players`)

#### GET /players
Query params: `page`, `limit`, `search` (name/email), `club`, `country`
```json
// Response 200
{
  "data": [
    {
      "id": "uuid",
      "firstName": "John",
      "middleName": null,
      "lastName1": "Smith",
      "lastName2": null,
      "dateOfBirth": "1985-07-14",
      "gender": "male",
      "club": "Royal Golf Club",
      "email": "john@example.com",
      "country": "GB",
      "handicapIndex": 12.4,
      "createdAt": "2026-01-01T10:00:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 143 }
}
```

#### POST /players
```json
// Request
{
  "firstName": "John",
  "middleName": null,
  "lastName1": "Smith",
  "lastName2": null,
  "dateOfBirth": "1985-07-14",
  "gender": "male",
  "club": "Royal Golf Club",
  "email": "john@example.com",
  "country": "GB"
}
// Response 201 — player object
```

#### GET /players/:id
Response 200 — full player object with current `handicapIndex`.

#### PATCH /players/:id
Partial update. Same fields as POST. Response 200 — updated player.

#### DELETE /players/:id
Soft delete. Response 204.

#### GET /players/:id/handicap-history
```json
// Response 200
{
  "currentIndex": 12.4,
  "history": [
    {
      "id": "uuid",
      "handicapIndex": 12.4,
      "calculationDate": "2026-05-10T00:00:00Z",
      "numDifferentials": 8,
      "averageDifferential": 13.5,
      "adjustment": 0,
      "roundsUsed": ["uuid1","uuid2","..."]
    }
  ]
}
```

---

### 6.3 Course Endpoints (`/courses`)

#### GET /courses
Query params: `page`, `limit`, `search`
```json
// Response 200
{
  "data": [
    {
      "id": "uuid",
      "name": "Pebble Beach Golf Links",
      "address": "1700 17-Mile Drive, Pebble Beach, CA",
      "phone": "+18314592000",
      "email": "golf@pebblebeach.com",
      "teeConfigurationCount": 3
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 5 }
}
```

#### POST /courses
```json
// Request
{
  "name": "Pebble Beach Golf Links",
  "address": "1700 17-Mile Drive, Pebble Beach, CA",
  "phone": "+18314592000",
  "email": "golf@pebblebeach.com"
}
// Response 201 — course object
```

#### GET /courses/:id
Full course object including `teeConfigurations[]` (without hole data).

#### PATCH /courses/:id  |  DELETE /courses/:id
Standard update/soft-delete.

---

#### GET /courses/:id/configurations
Lists all tee configurations for a course.

#### POST /courses/:id/configurations
Create a tee configuration with holes.
```json
// Request
{
  "name": "White Tees — 18 Holes",
  "teeColour": "White",
  "holeCount": 18,
  "courseRating": 74.9,
  "slopeRating": 143,
  "holes": [
    { "holeNumber": 1, "distanceYards": 380, "par": 4, "strokeIndex": 11 },
    { "holeNumber": 2, "distanceYards": 502, "par": 5, "strokeIndex": 7 },
    // ... up to 18 holes
  ]
}
// Response 201 — configuration object with holes[]
```
Validation rules:
- `holes` array length must equal `holeCount`
- `holeNumber` values must be 1 to `holeCount`, no duplicates
- `strokeIndex` values must be unique and in range 1–18 (or 1–9 for 9-hole configs)

#### GET /courses/:courseId/configurations/:configId
Full configuration with all hole data.

#### PATCH /courses/:courseId/configurations/:configId
Update configuration metadata. Holes are updated individually via sub-resource.

#### PUT /courses/:courseId/configurations/:configId/holes
Replace all holes for a configuration in one transaction.

#### DELETE /courses/:courseId/configurations/:configId
Soft delete. Response 204.

---

### 6.4 Round Endpoints (`/rounds`)

#### POST /rounds
Create a new round.
```json
// Request
{
  "playerId": "uuid",
  "teeConfigurationId": "uuid",
  "playedAt": "2026-05-10",
  "playingHandicap": null,         // null = auto-calculate from current handicap index
  "isAwayRound": false,
  "notes": "",
  "holeScores": [
    {
      "holeNumber": 1,
      "strokes": 5,
      "putts": 2,
      "greenInRegulation": false,
      "fairwayHit": true,
      "inSand": false,
      "penalties": 0
    },
    // ... one entry per hole
  ]
}

// Response 201
{
  "id": "uuid",
  "playerId": "uuid",
  "teeConfigurationId": "uuid",
  "playedAt": "2026-05-10",
  "playingHandicap": 14,
  "adjustedGrossScore": 89,
  "scoreDifferential": 17.3,
  "totalGrossScore": 91,
  "totalPutts": 34,
  "fairwaysHit": 8,
  "fairwaysApplicable": 14,
  "greensInRegulation": 5,
  "sandSaves": 1,
  "totalPenalties": 2,
  "holeScores": [ /* ... with netDoubleBogeyAdjusted per hole */ ],
  "createdAt": "2026-05-10T18:00:00Z"
}
```

#### GET /rounds
Query params: `playerId`, `courseId`, `teeConfigurationId`, `from` (date), `to` (date), `page`, `limit`

#### GET /rounds/:id
Full round with `holeScores[]` and embedded `teeConfiguration.holes[]`.

#### PATCH /rounds/:id
Limited update (notes, approval status, playing handicap). Recalculates differential on save.

#### DELETE /rounds/:id
Soft delete. Triggers handicap recalculation for the player.

#### GET /rounds/:id/scorecard
Returns a scorecard-formatted view of the round, including:
- Course info, tee config, player info
- Per-hole: par, distance, stroke index, gross score, stableford points (net)
- Totals: front 9, back 9, overall
- Handicap differential

---

### 6.5 Handicap Endpoints (`/handicap`)

#### POST /handicap/calculate
Calculate (and store) a new handicap index for a player.
```json
// Request
{
  "playerId": "uuid",
  "roundIds": ["uuid1", "uuid2"]   // optional; leave empty to use most recent eligible rounds
}

// Response 200
{
  "playerId": "uuid",
  "handicapIndex": 12.4,
  "previousIndex": 13.1,
  "numDifferentials": 8,
  "averageDifferential": 13.5,
  "adjustment": 0,
  "differentialsUsed": [
    { "roundId": "uuid", "playedAt": "2026-05-08", "scoreDifferential": 11.2, "course": "..." },
    // 8 lowest from the considered rounds
  ],
  "eligibilityStatus": "eligible",  // or "insufficient_holes" with explanation
  "calculationDate": "2026-05-10T18:10:00Z"
}
```

#### GET /handicap/playing-handicap
Calculate playing handicap (not stored) for display in score entry form.
```json
// Query params: playerId, teeConfigurationId
// Response 200
{
  "handicapIndex": 12.4,
  "courseHandicap": 14,
  "playingHandicap": 14,
  "calculation": "12.4 × (143/113) + (74.9 - 72) = 14.1 → 14"
}
```

#### GET /handicap/eligibility/:playerId
Check if a player has enough approved holes to be eligible for a handicap calculation.
```json
// Response 200
{
  "playerId": "uuid",
  "totalApprovedHoles": 72,
  "isEligible": true,
  "minimumRequired": 54,
  "roundCount": 4
}
```

---

## 7. World Handicap System (WHS) Logic

### 7.1 Score Differential Formula

```
Score Differential = (113 / Slope Rating) × (Adjusted Gross Score − Course Rating − Playing Handicap Adjustment)
```

Where **Adjusted Gross Score** uses **Net Double Bogey** limit per hole:
```
Net Double Bogey = Par + 2 + Handicap Strokes received on that hole
Adjusted Hole Score = MIN(actual strokes, net double bogey)
```

### 7.2 Playing Handicap Formula

```
Course Handicap  = Handicap Index × (Slope Rating / 113) + (Course Rating − Par)
Playing Handicap = Course Handicap × Allowance%   (100% for stroke play individual)
```

Round `Course Handicap` to nearest integer.

### 7.3 Handicap Index Calculation

WHS uses the **best** score differentials from the most recent rounds:

| Number of rounds available | Differentials used |
|---|---|
| 3 | Lowest 1 |
| 4 | Lowest 1 |
| 5 | Lowest 1 |
| 6 | Lowest 2 |
| 7 | Lowest 2 |
| 8 | Lowest 2 |
| 9 | Lowest 3 |
| 10 | Lowest 3 |
| 11 | Lowest 4 |
| 12 | Lowest 4 |
| 13 | Lowest 5 |
| 14 | Lowest 5 |
| 15 | Lowest 5 |
| 16 | Lowest 6 |
| 17 | Lowest 6 |
| 18 | Lowest 7 |
| 19 | Lowest 8 |
| 20 | Lowest 8 |

```
Handicap Index = Average of selected differentials × 0.96 (96% factor)
```

Truncated (not rounded) to 1 decimal place.

### 7.4 Minimum Eligibility

- A player needs **at least 54 holes** of approved rounds to receive a Handicap Index.
- For 9-hole rounds, two 9-hole differentials may be combined into an 18-hole equivalent before inclusion.
- If fewer than 54 eligible holes exist, the API returns `eligibilityStatus: "insufficient_holes"`.

### 7.5 Soft Cap & Hard Cap

After calculating the raw new index:
- **Soft cap**: If increase > 3.0 strokes above the Low Handicap Index (lowest in last 365 days), only 50% of the excess is applied.
- **Hard cap**: New index cannot exceed Low Handicap Index + 5.0.

### 7.6 Maximum Handicap Index

- Men: +54.0 to 54.0
- Women: +54.0 to 54.0 (WHS unified scale)

---

## 8. Frontend Architecture

### 8.1 Tech Stack
- **React 18** with functional components and hooks
- **Vite** for build tooling
- **Tailwind CSS 3** for styling
- **React Router 6** for client-side routing
- **React Query (TanStack Query)** for server state, caching and background refetching
- **React Hook Form + Zod** for form management and validation
- **Recharts** for statistics charts
- **Axios** for HTTP client with interceptors for auth token refresh

### 8.2 Route Map

```
/                        → Dashboard (recent rounds, handicap trend)
/login                   → Login page
/register                → Register page

/players                 → Player list
/players/new             → Create player
/players/:id             → Player profile (rounds, handicap history, stats)
/players/:id/edit        → Edit player

/courses                 → Course list
/courses/new             → Create course
/courses/:id             → Course detail (configurations list)
/courses/:id/edit        → Edit course
/courses/:id/configs/new → Add tee configuration
/courses/:id/configs/:configId/edit → Edit configuration

/rounds                  → Round history (filterable)
/rounds/new              → Enter new round (multi-step form)
/rounds/:id              → Round scorecard view
/rounds/:id/edit         → Edit round

/handicap                → Handicap calculator
/handicap/:playerId      → Player handicap detail + history

/admin                   → Admin dashboard
/admin/users             → User management
/admin/rounds            → Round approval queue
```

### 8.3 Key UI Components

**ScoreEntryForm** — multi-step wizard:
1. Select course configuration → auto-loads hole count, pars, distances
2. Select player → shows current handicap, calculates playing handicap
3. Enter per-hole scores (responsive grid, 9 holes per row)
4. Review & submit

**HandicapCalculator** — shows eligibility, differentials used, result with cap explanations

**ScorecardView** — printable card layout with hole-by-hole stats, totals, stableford points

**CourseConfigurationForm** — dynamic hole table (9 or 18 rows) with inline validation ensuring stroke indexes are unique

---

## 9. Infrastructure & DevOps

### 9.1 Local Development Setup (No Docker)

Run services directly on the host machine using package scripts and local dependencies.

Recommended local service ports:

| Component | Port | Notes |
|---|---|---|
| REST API | `3000` | Public API entry point |
| Frontend (Vite) | `5173` | Web UI |
| PostgreSQL | `5432` | Local install |
| Redis | `6379` | Local install |

Start local dependencies first (PostgreSQL and Redis), then run backend services and frontend using workspace scripts.

#### 9.1.1 Local Setup Checklist (Concrete)

1. Install prerequisites:
  - Node.js 20 LTS
  - npm 10+ (or pnpm 9+ if the repo standardises on pnpm)
  - PostgreSQL 16
  - Redis 7

2. Install dependencies from repository root:

```bash
npm install
```

3. Create local environment files (one per service and frontend). Minimum values:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/golf_db
REDIS_URL=redis://localhost:6379
JWT_SECRET=replace-with-long-random-secret
JWT_REFRESH_SECRET=replace-with-second-long-random-secret
JWT_EXPIRES_IN=1h
PORT=3000
```

4. Create local database and run migrations:

```bash
createdb golf_db
npm run db:migrate
```

5. Seed development data (optional but recommended):

```bash
npm run db:seed
```

6. Start all services and frontend:

```bash
npm run dev
```

7. Verify health checks and UI:
  - Gateway: `http://localhost:3000/health`
  - Frontend: `http://localhost:5173`

If a monorepo task runner is used, equivalent commands (for example `pnpm -r dev` or `turbo run dev`) are acceptable as long as the API and frontend start with the ports defined above.

#### 9.1.2 Quick Runbook (Local + Remote)

Local development runbook:
1. Start PostgreSQL and Redis.
2. Run migrations and optional seed data.
3. Start API and web apps.
4. Verify:
  - `GET /health` on `http://localhost:3000/health`
  - frontend on `http://localhost:5173`

Remote runtime runbook (DigitalOcean droplet with Nginx):
1. Deploy app processes so ports match the Nginx host config for `ghs.socx.org.uk`:
  - `ghs_web` -> `127.0.0.1:5175`
  - `ghs_api` -> `127.0.0.1:3005`
  - `ghs_worker` -> background worker process for async jobs
2. Ensure TLS certs are valid for `ghs.socx.org.uk`.
3. Confirm Nginx routing behavior:
  - `/` proxies to `ghs_web`
  - `/api/*` rewrites and proxies to `ghs_api`
4. Smoke test over HTTPS:
  - `https://ghs.socx.org.uk`
  - `https://ghs.socx.org.uk/api/health`
5. If health checks fail, rollback to the previous process release and reload Nginx.

### 9.2 Environment Variables (API application)

| Variable | Description |
|---|---|
| `DATABASE_URL` | `postgresql://user:pass@localhost:5432/golf_db` |
| `REDIS_URL` | `redis://localhost:6379` |
| `JWT_SECRET` | Access token signing secret |
| `JWT_REFRESH_SECRET` | Refresh token signing secret |
| `JWT_EXPIRES_IN` | e.g. `1h` |
| `PORT` | Service port |

### 9.3 Database Migrations

Use **node-pg-migrate** or **Flyway**. Keep migration files in `db/migrations/` with sequential names:
```
V001__initial_schema.sql
V002__add_audit_log.sql
V003__add_soft_delete_indexes.sql
```

---

## 10. Security Considerations

### 10.1 Authentication & Authorisation
- JWT access tokens (short-lived: 1h) + refresh tokens (7d), stored in HTTP-only cookies or memory (not localStorage)
- Role-based access: `admin` can manage all data; `player` can only read/write their own rounds and read courses/players
- The API validates JWT at middleware level and enforces route-level authorisation checks

### 10.2 Input Validation
- Validate all request bodies with **Joi** or **Zod** in the REST API request pipeline
- Slope rating: enforce 55–155; hole count: enforce 9 or 18; stroke index: unique per config, 1–N
- SQL injection: use parameterised queries always (pg `$1, $2` placeholders); never string-interpolate user input

### 10.3 Rate Limiting
- REST API: 100 req/min per IP for unauthenticated; 1000 req/min for authenticated users
- Login endpoint: 5 attempts / 15 min per IP (use Redis counter)

### 10.4 Data Privacy
- Passwords hashed with **bcrypt** (cost factor 12)
- PII fields (email, DOB) should be encrypted at rest in production using PostgreSQL's `pgcrypto`
- Soft deletes retain data for audit; hard deletion (GDPR right to erasure) should be implemented as an admin-only operation

### 10.5 HTTPS & CORS
- Enforce HTTPS in production (TLS termination at load balancer or nginx)
- Strict CORS: only allow the known frontend origin

---

## 11. Project Directory Structure

```
golf-handicap-system/
├── apps/
│   ├── api/                         # Single REST API (Express + TypeScript)
│   │   ├── src/
│   │   │   ├── app.ts
│   │   │   ├── routes/              # auth, players, courses, rounds, handicap
│   │   │   ├── middleware/          # auth, validation, rate-limiter, error-handler
│   │   │   ├── controllers/
│   │   │   ├── services/            # domain logic inside one API process
│   │   │   ├── lib/                 # logger, whs calculation helpers
│   │   │   └── env.ts
│   │   ├── tests/
│   │   └── package.json
│   └── web/                         # React + Vite frontend
│       ├── src/
│       │   ├── api/
│       │   ├── components/
│       │   ├── pages/
│       │   ├── hooks/
│       │   ├── store/
│       │   └── utils/
│       └── package.json
├── packages/
│   ├── db/                          # Prisma schema, migrations, seeds
│   ├── types/                       # shared TS types and Zod schemas
│   └── config/                      # shared lint/tsconfig/env helpers
├── infra/
│   ├── nginx/
│   └── pm2/
├── dev/
│   └── stop.sh
├── .github/
│   └── workflows/
└── README.md
```

---

## 12. Implementation Roadmap

### Phase 1 — Core Foundation (Weeks 1–4)
- [ ] Local development environment: PostgreSQL and Redis installed, API + frontend scaffolded with run scripts
- [ ] Database schema applied via migrations
- [ ] Auth module: register, login, JWT
- [ ] Player module: full CRUD
- [ ] Course module: full CRUD including tee configurations with holes
- [ ] Frontend: auth flow, player management, course management

### Phase 2 — Round Entry & Calculation (Weeks 5–8)
- [ ] Round module: create round, per-hole scores, NDB adjustment, stat aggregation
- [ ] Handicap module: WHS differential calculation, handicap index derivation (including soft/hard cap)
- [ ] Frontend: multi-step score entry form, scorecard view, handicap calculator

### Phase 3 — Analytics & Polish (Weeks 9–12)
- [ ] Dashboard: recent rounds, handicap trend chart, GIR/FIR averages
- [ ] Player statistics page with Recharts visualisations
- [ ] Admin panel: round approval queue, handicap override, user management
- [ ] PDF scorecard export
- [ ] Leaderboard / club rankings page
- [ ] Notifications (email via Nodemailer/Resend on handicap recalculation)

### Phase 4 — Production Hardening (Weeks 13–16)
- [ ] End-to-end and integration tests (Vitest + Playwright)
- [ ] HTTPS, strict CORS, security headers (Helmet.js)
- [ ] Deployment manifests/runbooks for the chosen platform (for example Kubernetes, VM, or PaaS)
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Monitoring: Prometheus metrics endpoint per service, Grafana dashboard
- [ ] Logging: structured JSON logs (Pino), centralised with Loki or Datadog

---

*End of Specification — Golf Handicap & Round Management System v1.0*
