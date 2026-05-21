# stories-multitenancy.md
Parent Epic: #MULTITENANCY_EPIC_PLACEHOLDER  
(Replace with actual epic issue number after creation)

---

# Multi‑Tenancy (Clubs, Organisations, Leagues) — User Stories

This file contains all user stories for the Multi‑Tenancy epic, including:
- Story narrative  
- Acceptance criteria  
- Dependencies  
- Size (XS/S/M/L/XL)  
- Estimate (0.5–15 days)  
- Priority  
- Target date (sequential, 6‑hour days, weekdays only)
- Guided Links embedded as required

Start date for this epic (after PWA epic ends): **04 July 2027**

---

## 1. Implement tenant model (clubs/organisations)

**As a developer**  
I want a tenant model  
So that each club or organisation has isolated data.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** High  
**Target Date:** **04 July 2027**

### Acceptance Criteria
- [ ] **[tenants table](ca://s?q=Explain_tenant_model)** includes:
  - id  
  - name  
  - country  
  - timezone  
  - branding settings  
- [ ] Soft delete supported.  
- [ ] Unique name per country.

### Dependencies
- **[Players table](ca://s?q=Explain_players_table)**  
- **[Users table](ca://s?q=Explain_users_table)**

---

## 2. Implement tenant scoping middleware

**As a developer**  
I want tenant scoping middleware  
So that all queries are restricted to the current tenant.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** High  
**Target Date:** **09 July 2027**

### Acceptance Criteria
- [ ] **[Tenant middleware](ca://s?q=Explain_tenant_scoping_middleware)** resolves tenant from:
  - subdomain  
  - JWT claim  
  - admin override  
- [ ] All DB queries automatically scoped.  
- [ ] Cross‑tenant access blocked.

### Dependencies
- **[Tenant model](ca://s?q=Explain_tenant_model)**  
- **[JWT middleware](ca://s?q=Explain_JWT_middleware)**

---

## 3. Add tenant_id to all major tables

**As a developer**  
I want tenant_id added to all relevant tables  
So that data is isolated per tenant.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** High  
**Target Date:** **14 July 2027**

### Acceptance Criteria
- [ ] **[tenant_id field](ca://s?q=Explain_tenant_id_field)** added to:
  - players  
  - rounds  
  - tee_configurations  
  - courses  
  - handicap_records  
  - notifications  
- [ ] Backfill script for existing data.  
- [ ] Foreign key constraints enforced.

### Dependencies
- **[Tenant model](ca://s?q=Explain_tenant_model)**

---

## 4. Implement tenant-aware authentication

**As a developer**  
I want tenant-aware authentication  
So that users belong to specific tenants.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** High  
**Target Date:** **16 July 2027**

### Acceptance Criteria
- [ ] **[Tenant claim](ca://s?q=Explain_tenant_claim)** added to JWT.  
- [ ] Login restricted to tenant context.  
- [ ] Admins can switch tenants (super-admin only).  
- [ ] Prevents cross‑tenant login.

### Dependencies
- **[Auth APIs](ca://s?q=Explain_auth_APIs)**  
- **[Tenant middleware](ca://s?q=Explain_tenant_scoping_middleware)**

---

## 5. Implement tenant admin roles

**As a developer**  
I want tenant‑specific admin roles  
So that each club can manage its own users.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** Medium  
**Target Date:** **18 July 2027**

### Acceptance Criteria
- [ ] **[Tenant admin role](ca://s?q=Explain_tenant_admin_role)** created.  
- [ ] Tenant admins can:
  - manage players  
  - approve rounds  
  - view tenant analytics  
- [ ] Cannot access other tenants.

### Dependencies
- **[RBAC](ca://s?q=Explain_RBAC)**  
- **[Tenant model](ca://s?q=Explain_tenant_model)**

---

## 6. Implement super-admin role (global)

**As a developer**  
I want a super-admin role  
So that platform-wide management is possible.

**Size:** XS  
**Estimate:** 0.5 day  
**Priority:** Medium  
**Target Date:** **19 July 2027**

### Acceptance Criteria
- [ ] **[Super-admin role](ca://s?q=Explain_super_admin_role)** bypasses tenant scoping.  
- [ ] Can manage tenants.  
- [ ] Can impersonate tenant admins (audit logged).

### Dependencies
- **[RBAC](ca://s?q=Explain_RBAC)**

---

## 7. Implement tenant creation API

**As a developer**  
I want an API to create tenants  
So that new clubs can onboard easily.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** Medium  
**Target Date:** **21 July 2027**

### Acceptance Criteria
- [ ] **[POST /tenants](ca://s?q=Explain_tenant_creation_API)** creates tenant.  
- [ ] Creates default tenant admin.  
- [ ] Branding defaults applied.  
- [ ] Super-admin only.

### Dependencies
- **[Tenant model](ca://s?q=Explain_tenant_model)**  
- **[Super-admin role](ca://s?q=Explain_super_admin_role)**

---

## 8. Implement tenant branding (logo, colours)

**As a developer**  
I want tenant branding  
So that each club can customise the UI.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** Medium  
**Target Date:** **26 July 2027**

### Acceptance Criteria
- [ ] **[Branding settings](ca://s?q=Explain_tenant_branding_settings)** include:
  - logo  
  - primary colour  
  - accent colour  
- [ ] Branding applied dynamically in frontend.  
- [ ] Logo stored in object storage.

### Dependencies
- **[Object storage](ca://s?q=Explain_object_storage_bucket)**  
- **[Frontend theming](ca://s?q=Explain_theme_support)**

---

## 9. Implement tenant analytics dashboard

**As a developer**  
I want tenant‑specific analytics  
So that clubs can view their own performance metrics.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** Medium  
**Target Date:** **31 July 2027**

### Acceptance Criteria
- [ ] **[Tenant analytics](ca://s?q=Explain_tenant_analytics)** include:
  - total players  
  - rounds played  
  - handicap distribution  
  - recent activity  
- [ ] Tenant‑scoped queries enforced.

### Dependencies
- **[Analytics module](ca://s?q=Explain_analytics_module)**  
- **[Tenant middleware](ca://s?q=Explain_tenant_scoping_middleware)**

---

## 10. Implement tenant data export (CSV/JSON)

**As a developer**  
I want tenant‑scoped data export  
So that clubs can download their own data.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** Low  
**Target Date:** **05 August 2027**

### Acceptance Criteria
- [ ] **[Tenant export API](ca://s?q=Explain_tenant_export_API)** supports:
  - players  
  - rounds  
  - handicap history  
- [ ] Export restricted to tenant.  
- [ ] Admin‑only.

### Dependencies
- **[Tenant scoping](ca://s?q=Explain_tenant_scoping_middleware)**  
- **[Export pipeline](ca://s?q=Explain_export_pipeline)**