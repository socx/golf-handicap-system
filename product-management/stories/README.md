# Stories Folder Guide

This folder contains epic-scoped user story files used as the source of truth for planning and GitHub issue synchronization.

## Core Platform Epics
- stories-auth.md
- stories-players.md
- stories-courses.md
- stories-rounds.md
- stories-handicap.md
- stories-dashboard.md
- stories-notifications.md
- stories-pdf.md
- stories-leaderboard.md
- stories-competitions.md
- stories-admin.md

## Infrastructure and Operations
- stories-devops.md
- stories.security.md
- stories-architecture.md
- stories-testing.md
- stories-analytics.md

## Extensions
- stories-pwa.md
- stories-multitenancy.md
- stories-billing.md
- stories-ai.md
- stories-mobile.md
- stories-internationalisation.md
- stories-misc.md

## Supporting Files
- epics.md
- stories-index.md

## Story Format
Each story follows this structure:

As a <role>
I want <capability>
So that <value>

**Size:** XS | S | M | L | XL
**Estimate:** effort in days
**Priority:** High | Medium | Low
**Target Date:** date

### Acceptance Criteria
- [ ] ...

### Dependencies
- ...

## Sync Notes
- Story files are synchronized to GitHub issues by workflow automation.
- Each issue includes hidden markers that map it back to the originating file and story heading.
- Update story files first when making planning changes; issue updates are then synchronized automatically.
