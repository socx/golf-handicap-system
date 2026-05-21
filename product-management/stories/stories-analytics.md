# stories-analytics.md
Parent Epic: #ANALYTICS_EPIC_PLACEHOLDER  
(Replace with actual epic issue number after creation)

---

# Advanced Analytics, Reporting & Data Warehouse — User Stories

This file contains all user stories for the Analytics epic, including:
- Story narrative  
- Acceptance criteria  
- Dependencies  
- Size (XS/S/M/L/XL)  
- Estimate (0.5–15 days)  
- Priority  
- Target date (sequential, 6‑hour days, weekdays only)
- Guided Links embedded as required

Start date for this epic (after Testing epic ends): **26 January 2028**

---

## 1. Implement analytics event pipeline

**As a developer**  
I want an analytics event pipeline  
So that key user and system events can be tracked consistently.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** High  
**Target Date:** **26 January 2028**

### Acceptance Criteria
- [ ] **[Event pipeline](ca://s?q=Explain_analytics_event_pipeline)** captures:
  - logins  
  - round creation  
  - round approval  
  - handicap updates  
  - AI insight generation  
- [ ] Events stored in analytics_events table.  
- [ ] Supports batching + async processing.

### Dependencies
- **[Logging system](ca://s?q=Explain_logging_system)**  
- **[Audit logs](ca://s?q=Explain_audit_logs)**

---

## 2. Implement analytics_events table

**As a developer**  
I want a dedicated analytics events table  
So that events can be queried efficiently.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** High  
**Target Date:** **28 January 2028**

### Acceptance Criteria
- [ ] **[analytics_events table](ca://s?q=Explain_analytics_events_table)** includes:
  - id  
  - tenant_id  
  - user_id  
  - event_type  
  - metadata (JSONB)  
  - timestamp  
- [ ] Indexed by event_type + timestamp.

### Dependencies
- **[Event pipeline](ca://s?q=Explain_analytics_event_pipeline)**

---

## 3. Implement data warehouse schema

**As a developer**  
I want a data warehouse schema  
So that analytics queries run efficiently without impacting production.

**Size:** L  
**Estimate:** 6–10 days  
**Priority:** High  
**Target Date:** **07 February 2028**

### Acceptance Criteria
- [ ] **[DW schema](ca://s?q=Explain_data_warehouse_schema)** includes:
  - fact_rounds  
  - fact_handicap  
  - fact_events  
  - dim_players  
  - dim_courses  
  - dim_dates  
- [ ] Star schema documented.  
- [ ] ETL-ready.

### Dependencies
- **[Production DB schema](ca://s?q=Explain_database_schema)**

---

## 4. Implement ETL pipeline (nightly)

**As a developer**  
I want an ETL pipeline  
So that analytics data is refreshed nightly.

**Size:** L  
**Estimate:** 6–10 days  
**Priority:** High  
**Target Date:** **17 February 2028**

### Acceptance Criteria
- [ ] **[ETL pipeline](ca://s?q=Explain_ETL_pipeline)** extracts from production DB.  
- [ ] Transforms into DW schema.  
- [ ] Loads into analytics database.  
- [ ] Error notifications sent on failure.

### Dependencies
- **[DW schema](ca://s?q=Explain_data_warehouse_schema)**  
- **[Staging environment](ca://s?q=Explain_staging_environment)**

---

## 5. Implement real-time analytics cache

**As a developer**  
I want a real-time analytics cache  
So that dashboards load instantly.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** Medium  
**Target Date:** **22 February 2028**

### Acceptance Criteria
- [ ] **[Analytics cache](ca://s?q=Explain_analytics_cache_design)** stores:
  - recent rounds  
  - handicap updates  
  - event counts  
- [ ] TTL-based invalidation.  
- [ ] Tenant-aware keys.

### Dependencies
- **[Redis cache](ca://s?q=Explain_Redis_instance)**  
- **[Event pipeline](ca://s?q=Explain_analytics_event_pipeline)**

---

## 6. Implement player performance analytics API

**As a developer**  
I want a performance analytics API  
So that the frontend can display detailed stats.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** High  
**Target Date:** **27 February 2028**

### Acceptance Criteria
- [ ] **[Performance analytics API](ca://s?q=Explain_player_performance_analytics_API)** returns:
  - scoring averages  
  - GIR/FIR trends  
  - putting stats  
  - penalties  
  - hole-by-hole breakdown  
- [ ] Supports date range filters.  
- [ ] Tenant-scoped.

### Dependencies
- **[Analytics module](ca://s?q=Explain_analytics_module)**  
- **[DW schema](ca://s?q=Explain_data_warehouse_schema)**

---

## 7. Implement course difficulty analytics

**As a developer**  
I want course difficulty analytics  
So that players can compare performance across courses.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** Medium  
**Target Date:** **03 March 2028**

### Acceptance Criteria
- [ ] **[Course difficulty model](ca://s?q=Explain_course_difficulty_model)** calculates:
  - scoring average  
  - differential distribution  
  - hardest holes  
  - easiest holes  
- [ ] Supports 9‑hole and 18‑hole courses.

### Dependencies
- **[Course data](ca://s?q=Explain_course_detail_API)**  
- **[DW schema](ca://s?q=Explain_data_warehouse_schema)**

---

## 8. Implement handicap trend analytics

**As a developer**  
I want handicap trend analytics  
So that players can visualise long-term improvement.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** Medium  
**Target Date:** **05 March 2028**

### Acceptance Criteria
- [ ] **[Handicap trend API](ca://s?q=Explain_handicap_trend_API)** returns:
  - index history  
  - volatility  
  - trend slope  
- [ ] Supports multi-year data.

### Dependencies
- **[Handicap history](ca://s?q=Explain_handicap_history_API)**  
- **[DW schema](ca://s?q=Explain_data_warehouse_schema)**

---

## 9. Implement tenant analytics dashboard (frontend)

**As a developer**  
I want a tenant analytics dashboard  
So that clubs can view their own performance metrics.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** Medium  
**Target Date:** **10 March 2028**

### Acceptance Criteria
- [ ] `/analytics/tenant` shows:
  - total players  
  - rounds played  
  - handicap distribution  
  - event activity  
- [ ] Uses **[tenant analytics API](ca://s?q=Explain_tenant_analytics)**.  
- [ ] Responsive layout.

### Dependencies
- **[Tenant analytics](ca://s?q=Explain_tenant_analytics)**  
- **[UI components](ca://s?q=Explain_UI_components)**

---

## 10. Implement player analytics dashboard (frontend)

**As a developer**  
I want a player analytics dashboard  
So that players can explore their performance in depth.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** Medium  
**Target Date:** **15 March 2028**

### Acceptance Criteria
- [ ] `/analytics/player/:id` shows:
  - scoring trends  
  - GIR/FIR charts  
  - putting stats  
  - penalties  
  - hole-by-hole performance  
- [ ] Uses **[performance analytics API](ca://s?q=Explain_player_performance_analytics_API)**.

### Dependencies
- **[Performance analytics API](ca://s?q=Explain_player_performance_analytics_API)**  
- **[Charting library](ca://s?q=Explain_charting_library)**

---

## 11. Implement analytics export (CSV/Excel)

**As a developer**  
I want analytics export  
So that users can download data for offline analysis.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** Low  
**Target Date:** **17 March 2028**

### Acceptance Criteria
- [ ] **[Analytics export API](ca://s?q=Explain_analytics_export_API)** supports:
  - player analytics  
  - course analytics  
  - tenant analytics  
- [ ] CSV + Excel formats.  
- [ ] Tenant-scoped.

### Dependencies
- **[DW schema](ca://s?q=Explain_data_warehouse_schema)**  
- **[Performance analytics API](ca://s?q=Explain_player_performance_analytics_API)**

---

## 12. Implement analytics alerts (email)

**As a developer**  
I want analytics alerts  
So that admins are notified of unusual patterns.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** Low  
**Target Date:** **19 March 2028**

### Acceptance Criteria
- [ ] **[Analytics alert engine](ca://s?q=Explain_analytics_alert_engine)** detects:
  - spikes in round submissions  
  - unusual handicap changes  
  - anomaly clusters  
- [ ] Sends email alerts.  
- [ ] Logged in notification history.

### Dependencies
- **[Email delivery module](ca://s?q=Explain_email_delivery_module_design)**  
- **[Anomaly detection](ca://s?q=Explain_anomaly_detection_model)**

---

# End of stories-analytics.md
