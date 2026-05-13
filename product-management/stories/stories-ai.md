# stories-ai.md
Parent Epic: #AI_EPIC_PLACEHOLDER  
(Replace with actual epic issue number after creation)

---

# AI Features (Insights, Predictions, Recommendations) — User Stories

This file contains all user stories for the AI epic, including:
- Story narrative  
- Acceptance criteria  
- Dependencies  
- Size (XS/S/M/L/XL)  
- Estimate (0.5–15 days)  
- Priority  
- Target date (sequential, 6‑hour days, weekdays only)
- Guided Links embedded as required

Start date for this epic (after Billing epic ends): **06 September 2027**

---

## 1. Implement AI insights service (backend)

**As a developer**  
I want an AI insights service  
So that the system can generate personalised performance insights for players.

**Size:** L  
**Estimate:** 6–10 days  
**Priority:** High  
**Target Date:** **06 September 2027**

### Acceptance Criteria
- [ ] **[AI insights engine](ca://s?q=Explain_AI_insights_engine)** processes:
  - round history  
  - handicap trend  
  - GIR/FIR patterns  
  - scoring deviations  
- [ ] Generates structured insight objects.  
- [ ] Supports per‑tenant isolation.  
- [ ] Unit tests for all insight types.

### Dependencies
- **[Analytics service](ca://s?q=Explain_analytics_service)**  
- **[Rounds table](ca://s?q=Explain_rounds_table)**  
- **[Handicap history](ca://s?q=Explain_handicap_history_API)**

---

## 2. Implement AI “What to Practice” recommendations

**As a developer**  
I want AI‑generated practice recommendations  
So that players know which areas to focus on.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** High  
**Target Date:** **11 September 2027**

### Acceptance Criteria
- [ ] **[Practice recommendation engine](ca://s?q=Explain_practice_recommendation_engine)** analyses:
  - GIR %  
  - FIR %  
  - putts per round  
  - penalties  
  - hole‑by‑hole weaknesses  
- [ ] Produces 3–5 actionable recommendations.  
- [ ] Recommendations stored per round.

### Dependencies
- **[AI insights engine](ca://s?q=Explain_AI_insights_engine)**  
- **[Analytics service](ca://s?q=Explain_analytics_service)**

---

## 3. Implement AI anomaly detection (round quality)

**As a developer**  
I want anomaly detection  
So that the system can flag unusual scoring patterns.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** Medium  
**Target Date:** **16 September 2027**

### Acceptance Criteria
- [ ] **[Anomaly detection model](ca://s?q=Explain_anomaly_detection_model)** identifies:
  - unusually high/low scores  
  - inconsistent hole patterns  
  - potential data entry errors  
- [ ] Flags stored in rounds table.  
- [ ] Admins can review flagged rounds.

### Dependencies
- **[Rounds table](ca://s?q=Explain_rounds_table)**  
- **[Analytics service](ca://s?q=Explain_analytics_service)**

---

## 4. Implement AI-powered round summary

**As a developer**  
I want an AI‑generated round summary  
So that players receive a narrative explanation of their performance.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** High  
**Target Date:** **21 September 2027**

### Acceptance Criteria
- [ ] **[Round summary generator](ca://s?q=Explain_round_summary_generator)** produces:
  - strengths  
  - weaknesses  
  - key turning points  
  - comparison to historical averages  
- [ ] Summary stored in round record.  
- [ ] Supports 9‑hole and 18‑hole rounds.

### Dependencies
- **[AI insights engine](ca://s?q=Explain_AI_insights_engine)**  
- **[Round detail API](ca://s?q=Explain_round_detail_API)**

---

## 5. Implement AI-powered handicap projection

**As a developer**  
I want handicap projections  
So that players can see where their index is trending.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** Medium  
**Target Date:** **26 September 2027**

### Acceptance Criteria
- [ ] **[Handicap projection model](ca://s?q=Explain_handicap_projection_model)** uses:
  - last 20 differentials  
  - trend slope  
  - volatility  
- [ ] Produces projected index for:
  - 5 rounds  
  - 10 rounds  
  - 20 rounds  
- [ ] Displayed in dashboard.

### Dependencies
- **[Handicap history](ca://s?q=Explain_handicap_history_API)**  
- **[Analytics service](ca://s?q=Explain_analytics_service)**

---

## 6. Implement AI-powered course strategy suggestions

**As a developer**  
I want AI course strategy suggestions  
So that players can prepare for specific courses.

**Size:** L  
**Estimate:** 6–10 days  
**Priority:** Medium  
**Target Date:** **06 October 2027**

### Acceptance Criteria
- [ ] **[Course strategy engine](ca://s?q=Explain_course_strategy_engine)** analyses:
  - hole distances  
  - hazards  
  - player tendencies  
  - historical performance  
- [ ] Suggests:
  - tee shot strategy  
  - layup vs aggressive play  
  - approach shot tendencies  
- [ ] Supports 9‑hole and 18‑hole courses.

### Dependencies
- **[Course data](ca://s?q=Explain_course_detail_API)**  
- **[Player analytics](ca://s?q=Explain_analytics_service)**

---

## 7. Implement AI-powered leaderboard predictions

**As a developer**  
I want leaderboard predictions  
So that tournaments can show projected standings.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** Low  
**Target Date:** **11 October 2027**

### Acceptance Criteria
- [ ] **[Leaderboard prediction model](ca://s?q=Explain_leaderboard_prediction_model)** uses:
  - scoring averages  
  - course difficulty  
  - recent form  
- [ ] Produces projected ranking list.  
- [ ] Admin‑only feature.

### Dependencies
- **[Leaderboard data](ca://s?q=Explain_leaderboard_by_club)**  
- **[Analytics service](ca://s?q=Explain_analytics_service)**

---

## 8. Implement AI-powered pace-of-play estimator

**As a developer**  
I want a pace‑of‑play estimator  
So that players can estimate round duration.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** Low  
**Target Date:** **13 October 2027**

### Acceptance Criteria
- [ ] **[Pace model](ca://s?q=Explain_pace_of_play_model)** uses:
  - course length  
  - player scoring average  
  - historical pace data  
- [ ] Produces estimated round time.  
- [ ] Displayed in round entry screen.

### Dependencies
- **[Course data](ca://s?q=Explain_course_detail_API)**  
- **[Player analytics](ca://s?q=Explain_analytics_service)**

---

## 9. Frontend: AI insights widget

**As a developer**  
I want an AI insights widget  
So that players can see personalised insights on their dashboard.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** High  
**Target Date:** **18 October 2027**

### Acceptance Criteria
- [ ] `/dashboard` shows:
  - insights  
  - recommendations  
  - projections  
- [ ] Uses **[AI insights API](ca://s?q=Explain_AI_insights_engine)**.  
- [ ] Responsive layout.

### Dependencies
- **[AI insights engine](ca://s?q=Explain_AI_insights_engine)**  
- **[UI components](ca://s?q=Explain_UI_components)**

---

## 10. Frontend: AI round summary panel

**As a developer**  
I want an AI round summary panel  
So that players can read a narrative explanation of their round.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** Medium  
**Target Date:** **20 October 2027**

### Acceptance Criteria
- [ ] `/rounds/:id` includes AI summary section.  
- [ ] Expand/collapse UI.  
- [ ] Shows strengths, weaknesses, key moments.

### Dependencies
- **[Round summary generator](ca://s?q=Explain_round_summary_generator)**  
- **[Scorecard view](ca://s?q=Explain_scorecard_view)**

---

## 11. Frontend: AI practice recommendations page

**As a developer**  
I want a dedicated page for practice recommendations  
So that players can explore detailed improvement suggestions.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** Medium  
**Target Date:** **25 October 2027**

### Acceptance Criteria
- [ ] `/practice/recommendations` page.  
- [ ] Shows:
  - weaknesses  
  - drills  
  - improvement targets  
- [ ] Pulls from **[practice recommendation engine](ca://s?q=Explain_practice_recommendation_engine)**.

### Dependencies
- **[AI insights engine](ca://s?q=Explain_AI_insights_engine)**  
- **[UI components](ca://s?q=Explain_UI_components)**

---

## 12. Admin: AI model monitoring dashboard

**As a developer**  
I want an AI monitoring dashboard  
So that admins can track model performance and errors.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** Low  
**Target Date:** **30 October 2027**

### Acceptance Criteria
- [ ] **[AI monitoring dashboard](ca://s?q=Explain_AI_monitoring_dashboard)** shows:
  - model latency  
  - error rates  
  - insight generation volume  
  - flagged anomalies  
- [ ] Super-admin only.

### Dependencies
- **[Logging system](ca://s?q=Explain_logging_system)**  
- **[AI insights engine](ca://s?q=Explain_AI_insights_engine)**

---

# End of stories-ai.md
