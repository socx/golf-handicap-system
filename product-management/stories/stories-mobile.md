# stories-mobile.md
Parent Epic: #315  
(Replace with actual epic issue number after creation)

---

# Native Mobile App (iOS & Android) — User Stories

This file contains all user stories for the Mobile App epic, including:
- Story narrative  
- Acceptance criteria  
- Dependencies  
- Size (XS/S/M/L/XL)  
- Estimate (0.5–15 days)  
- Priority  
- Target date (sequential, 6‑hour days, weekdays only)
- Guided Links embedded as required

Start date for this epic (after AI epic ends): **30 October 2027**

---

## 1. Set up React Native project (Expo)

**As a developer**  
I want a React Native project using Expo  
So that the mobile app can be built quickly for iOS and Android.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** High  
**Target Date:** **30 October 2027**

### Acceptance Criteria
- [ ] **[Expo project setup](ca://s?q=Explain_Expo_project_setup)** with TypeScript.  
- [ ] Folder structure aligned with web frontend.  
- [ ] ESLint + Prettier configured.  
- [ ] iOS + Android builds run locally.

### Dependencies
- **[Frontend architecture](ca://s?q=Explain_frontend_architecture)**

---

## 2. Implement authentication screens (login, register)

**As a developer**  
I want mobile authentication screens  
So that users can log in from the app.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** High  
**Target Date:** **01 November 2027**

### Acceptance Criteria
- [ ] **[Login screen](ca://s?q=Explain_mobile_login_screen)** with email + password.  
- [ ] Registration screen (admin‑only).  
- [ ] Token storage using secure storage.  
- [ ] Error handling + loading states.

### Dependencies
- **[Auth APIs](ca://s?q=Explain_auth_APIs)**  
- **[Expo SecureStore](ca://s?q=Explain_SecureStore_usage)**

---

## 3. Implement mobile navigation (tabs + stack)

**As a developer**  
I want mobile navigation  
So that users can move between major sections of the app.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** High  
**Target Date:** **03 November 2027**

### Acceptance Criteria
- [ ] **[React Navigation setup](ca://s?q=Explain_React_Navigation_setup)** with:
  - bottom tabs  
  - stack navigators  
- [ ] Screens:
  - Dashboard  
  - Rounds  
  - Players  
  - Settings  
- [ ] Deep linking supported.

### Dependencies
- **[Expo project](ca://s?q=Explain_Expo_project_setup)**

---

## 4. Implement mobile dashboard

**As a developer**  
I want a mobile dashboard  
So that players can see key stats at a glance.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** High  
**Target Date:** **08 November 2027**

### Acceptance Criteria
- [ ] **[Mobile dashboard](ca://s?q=Explain_mobile_dashboard_design)** shows:
  - handicap summary  
  - recent rounds  
  - AI insights  
  - practice recommendations  
- [ ] Pulls from dashboard API.  
- [ ] Responsive card layout.

### Dependencies
- **[Dashboard API](ca://s?q=Explain_dashboard_summary_endpoint)**  
- **[AI insights](ca://s?q=Explain_AI_insights_engine)**

---

## 5. Implement mobile round entry (full scorecard)

**As a developer**  
I want a mobile round entry screen  
So that players can record rounds on the course.

**Size:** L  
**Estimate:** 6–10 days  
**Priority:** High  
**Target Date:** **18 November 2027**

### Acceptance Criteria
- [ ] **[Round entry UI](ca://s?q=Explain_mobile_round_entry_UI)** includes:
  - strokes  
  - putts  
  - GIR  
  - FIR  
  - penalties  
- [ ] Swipe between holes.  
- [ ] Auto‑save locally.  
- [ ] Offline mode supported.

### Dependencies
- **[Round entry API](ca://s?q=Explain_round_entry_API)**  
- **[Offline queue](ca://s?q=Explain_offline_queue_design)**

---

## 6. Implement mobile scorecard viewer

**As a developer**  
I want a mobile scorecard viewer  
So that players can review rounds on their phone.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** Medium  
**Target Date:** **20 November 2027**

### Acceptance Criteria
- [ ] **[Scorecard viewer](ca://s?q=Explain_mobile_scorecard_viewer)** shows:
  - hole grid  
  - totals  
  - tee configuration  
- [ ] Pulls from round detail API.  
- [ ] Works offline for cached rounds.

### Dependencies
- **[Round detail API](ca://s?q=Explain_round_detail_API)**  
- **[Offline caching](ca://s?q=Explain_scorecard_caching)**

---

## 7. Implement mobile player list + search

**As a developer**  
I want a mobile player list  
So that users can browse and search players.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** Medium  
**Target Date:** **22 November 2027**

### Acceptance Criteria
- [ ] **[Player list](ca://s?q=Explain_mobile_player_list)** with search bar.  
- [ ] Infinite scroll.  
- [ ] Pulls from player search API.  
- [ ] Offline fallback for cached players.

### Dependencies
- **[Player search API](ca://s?q=Explain_player_search_API)**  
- **[Player caching](ca://s?q=Explain_player_data_caching)**

---

## 8. Implement mobile handicap summary

**As a developer**  
I want a mobile handicap summary  
So that players can view their index and history.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** Medium  
**Target Date:** **24 November 2027**

### Acceptance Criteria
- [ ] **[Handicap summary](ca://s?q=Explain_mobile_handicap_summary)** shows:
  - current index  
  - trend chart  
  - last update  
- [ ] Pulls from handicap API.

### Dependencies
- **[Handicap API](ca://s?q=Explain_handicap_history_API)**  
- **[Charting library](ca://s?q=Explain_mobile_charting_library)**

---

## 9. Implement mobile notifications (push)

**As a developer**  
I want push notifications  
So that players receive updates instantly.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** Medium  
**Target Date:** **29 November 2027**

### Acceptance Criteria
- [ ] **[Push notifications](ca://s?q=Explain_push_notifications_mobile)** via Expo.  
- [ ] Supports:
  - handicap updates  
  - round approvals  
  - practice recommendations  
- [ ] Device tokens stored per user.

### Dependencies
- **[Notification system](ca://s?q=Explain_notification_system)**  
- **[Expo Notifications](ca://s?q=Explain_Expo_notifications)**

---

## 10. Implement mobile settings page

**As a developer**  
I want a mobile settings page  
So that users can manage preferences.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** Low  
**Target Date:** **01 December 2027**

### Acceptance Criteria
- [ ] **[Settings screen](ca://s?q=Explain_mobile_settings_screen)** includes:
  - profile  
  - theme  
  - notifications  
  - logout  
- [ ] Syncs with backend preferences.

### Dependencies
- **[Settings API](ca://s?q=Explain_settings_page)**

---

## 11. Implement mobile offline mode indicators

**As a developer**  
I want offline indicators  
So that users understand when the app is offline.

**Size:** XS  
**Estimate:** 0.5 day  
**Priority:** Low  
**Target Date:** **02 December 2027**

### Acceptance Criteria
- [ ] **[Offline banner](ca://s?q=Explain_mobile_offline_banner)** displayed when offline.  
- [ ] Sync status indicator.  
- [ ] Error messages for failed sync.

### Dependencies
- **[Offline queue](ca://s?q=Explain_offline_queue_design)**

---

## 12. Implement mobile AI insights screen

**As a developer**  
I want a dedicated AI insights screen  
So that players can explore personalised insights.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** Low  
**Target Date:** **07 December 2027**

### Acceptance Criteria
- [ ] **[AI insights screen](ca://s?q=Explain_mobile_AI_insights_screen)** shows:
  - insights  
  - recommendations  
  - projections  
- [ ] Pulls from AI insights API.

### Dependencies
- **[AI insights engine](ca://s?q=Explain_AI_insights_engine)**  
- **[Mobile dashboard](ca://s?q=Explain_mobile_dashboard_design)**

---

# End of stories-mobile.md
