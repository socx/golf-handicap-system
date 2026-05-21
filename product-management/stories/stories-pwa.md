# stories-pwa.md
Parent Epic: #311  
(Replace with actual epic issue number after creation)

---

# Progressive Web App (PWA) — User Stories

This file contains all user stories for the PWA epic, including:
- Story narrative  
- Acceptance criteria  
- Dependencies  
- Size (XS/S/M/L/XL)  
- Estimate (0.5–15 days)  
- Priority  
- Target date (sequential, 6‑hour days, weekdays only)
- Guided Links embedded as required

Start date for this epic (after Security epic ends): **06 June 2027**

---

## 1. Implement PWA manifest

**As a developer**  
I want a PWA manifest  
So that the app can be installed on mobile and desktop devices.

**Size:** XS  
**Estimate:** 0.5 day  
**Priority:** High  
**Target Date:** **06 June 2027**

### Acceptance Criteria
- [ ] **[Web manifest](ca://s?q=Explain_PWA_manifest)** includes:
  - name + short_name  
  - icons (192, 512)  
  - theme_color + background_color  
  - display: standalone  
- [ ] Manifest served at `/manifest.json`.  
- [ ] Verified by Lighthouse.

### Dependencies
- **[Frontend build](ca://s?q=Explain_frontend_build_process)**

---

## 2. Implement service worker (offline shell)

**As a developer**  
I want a service worker  
So that the app loads even when offline.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** High  
**Target Date:** **09 June 2027**

### Acceptance Criteria
- [ ] **[Service worker](ca://s?q=Explain_service_worker)** caches:
  - app shell  
  - static assets  
  - fonts  
- [ ] Uses stale‑while‑revalidate strategy.  
- [ ] Auto‑updates when new version deployed.  
- [ ] Lighthouse PWA score ≥ 90.

### Dependencies
- **[PWA manifest](ca://s?q=Explain_PWA_manifest)**  
- **[Frontend build](ca://s?q=Explain_frontend_build_process)**

---

## 3. Implement offline round entry (local storage queue)

**As a developer**  
I want offline round entry  
So that users can record rounds even without internet.

**Size:** L  
**Estimate:** 6–10 days  
**Priority:** High  
**Target Date:** **19 June 2027**

### Acceptance Criteria
- [ ] **[Offline queue](ca://s?q=Explain_offline_queue_design)** stores:
  - round metadata  
  - hole scores  
- [ ] Syncs automatically when online.  
- [ ] Conflict resolution rules documented.  
- [ ] UI shows “Pending sync” state.

### Dependencies
- **[Round entry form](ca://s?q=Explain_round_entry_form)**  
- **[Service worker](ca://s?q=Explain_service_worker)**

---

## 4. Implement background sync

**As a developer**  
I want background sync  
So that queued rounds upload automatically when connectivity returns.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** Medium  
**Target Date:** **21 June 2027**

### Acceptance Criteria
- [ ] **[Background sync](ca://s?q=Explain_background_sync)** registered in service worker.  
- [ ] Sync triggered when network restored.  
- [ ] Errors logged + retried.  
- [ ] User notified when sync completes.

### Dependencies
- **[Offline queue](ca://s?q=Explain_offline_queue_design)**  
- **[Service worker](ca://s?q=Explain_service_worker)**

---

## 5. Implement add‑to‑home‑screen prompt

**As a developer**  
I want an add‑to‑home‑screen prompt  
So that users can install the app easily.

**Size:** XS  
**Estimate:** 0.5 day  
**Priority:** Medium  
**Target Date:** **22 June 2027**

### Acceptance Criteria
- [ ] **[A2HS prompt](ca://s?q=Explain_add_to_home_screen_prompt)** triggered on eligible devices.  
- [ ] Custom UI for install banner.  
- [ ] Works on iOS + Android + desktop.  
- [ ] Install event tracked.

### Dependencies
- **[PWA manifest](ca://s?q=Explain_PWA_manifest)**  
- **[Service worker](ca://s?q=Explain_service_worker)**

---

## 6. Implement offline course + tee configuration caching

**As a developer**  
I want offline caching of course data  
So that users can select courses even without internet.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** Medium  
**Target Date:** **24 June 2027**

### Acceptance Criteria
- [ ] **[Course caching](ca://s?q=Explain_course_data_caching)** stores:
  - course list  
  - tee configurations  
  - hole data  
- [ ] Cache updated when online.  
- [ ] Expiry rules documented.

### Dependencies
- **[Course APIs](ca://s?q=Explain_course_detail_API)**  
- **[Service worker](ca://s?q=Explain_service_worker)**

---

## 7. Implement offline player list caching

**As a developer**  
I want offline caching of player data  
So that round entry works offline.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** Medium  
**Target Date:** **26 June 2027**

### Acceptance Criteria
- [ ] **[Player caching](ca://s?q=Explain_player_data_caching)** stores:
  - player list  
  - basic profile fields  
- [ ] Cache updated when online.  
- [ ] Works with autocomplete.

### Dependencies
- **[Player search API](ca://s?q=Explain_player_search_API)**  
- **[Service worker](ca://s?q=Explain_service_worker)**

---

## 8. Implement offline scorecard viewer

**As a developer**  
I want an offline scorecard viewer  
So that users can view recently opened rounds offline.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** Low  
**Target Date:** **28 June 2027**

### Acceptance Criteria
- [ ] **[Scorecard caching](ca://s?q=Explain_scorecard_caching)** stores last 10 viewed rounds.  
- [ ] Works offline.  
- [ ] Shows “Offline mode” banner.

### Dependencies
- **[Round detail API](ca://s?q=Explain_round_detail_API)**  
- **[Service worker](ca://s?q=Explain_service_worker)**

---

## 9. Implement PWA‑specific UI states

**As a developer**  
I want PWA‑specific UI states  
So that users understand when they are offline or syncing.

**Size:** XS  
**Estimate:** 0.5 day  
**Priority:** Low  
**Target Date:** **29 June 2027**

### Acceptance Criteria
- [ ] **[Offline indicator](ca://s?q=Explain_offline_indicator_UI)** in header.  
- [ ] Sync status indicator.  
- [ ] Error banner for failed sync.

### Dependencies
- **[Offline queue](ca://s?q=Explain_offline_queue_design)**

---

## 10. Implement PWA performance optimisation

**As a developer**  
I want PWA performance optimisation  
So that the app loads instantly and feels native.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** Low  
**Target Date:** **04 July 2027**

### Acceptance Criteria
- [ ] **[Code splitting](ca://s?q=Explain_code_splitting)** implemented.  
- [ ] **[Asset preloading](ca://s?q=Explain_asset_preloading)** for critical routes.  
- [ ] Lighthouse PWA score ≥ 95.  
- [ ] First load < 2 seconds on 4G.

### Dependencies
- **[Frontend build](ca://s?q=Explain_frontend_build_process)**  
- **[Service worker](ca://s?q=Explain_service_worker)**

---

# End of stories-pwa.md
