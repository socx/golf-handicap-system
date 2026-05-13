# stories-billing.md
Parent Epic: #BILLING_EPIC_PLACEHOLDER  
(Replace with actual epic issue number after creation)

---

# Billing, Subscriptions & Payments — User Stories

This file contains all user stories for the Billing epic, including:
- Story narrative  
- Acceptance criteria  
- Dependencies  
- Size (XS/S/M/L/XL)  
- Estimate (0.5–15 days)  
- Priority  
- Target date (sequential, 6‑hour days, weekdays only)
- Guided Links embedded as required

Start date for this epic (after Multi‑Tenancy epic ends): **09 August 2027**

---

## 1. Integrate payment provider (Stripe)

**As a developer**  
I want to integrate Stripe  
So that tenants can subscribe and pay for the platform.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** High  
**Target Date:** **09 August 2027**

### Acceptance Criteria
- [ ] **[Stripe integration](ca://s?q=Explain_Stripe_integration)** configured with:
  - secret keys  
  - webhook signing  
  - test + live modes  
- [ ] Stripe customer created per tenant.  
- [ ] Errors logged securely.

### Dependencies
- **[Tenant model](ca://s?q=Explain_tenant_model)**  
- Stripe account

---

## 2. Implement subscription plans

**As a developer**  
I want subscription plans  
So that tenants can choose pricing tiers.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** High  
**Target Date:** **11 August 2027**

### Acceptance Criteria
- [ ] **[Plans table](ca://s?q=Explain_subscription_plans)** includes:
  - plan_id  
  - name  
  - price  
  - features  
- [ ] Plans synced with Stripe.  
- [ ] Supports monthly + annual billing.

### Dependencies
- **[Stripe integration](ca://s?q=Explain_Stripe_integration)**

---

## 3. Implement checkout session API

**As a developer**  
I want an API to create Stripe checkout sessions  
So that tenants can subscribe easily.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** High  
**Target Date:** **13 August 2027**

### Acceptance Criteria
- [ ] **[POST /billing/checkout](ca://s?q=Explain_checkout_session_API)** creates session.  
- [ ] Redirect URL returned.  
- [ ] Tenant_id included in metadata.  
- [ ] Supports plan selection.

### Dependencies
- **[Subscription plans](ca://s?q=Explain_subscription_plans)**  
- **[Stripe integration](ca://s?q=Explain_Stripe_integration)**

---

## 4. Implement Stripe webhook handler

**As a developer**  
I want a webhook handler  
So that subscription events update tenant status.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** High  
**Target Date:** **18 August 2027**

### Acceptance Criteria
- [ ] **[Webhook handler](ca://s?q=Explain_Stripe_webhook_handler)** processes:
  - checkout.session.completed  
  - invoice.paid  
  - invoice.payment_failed  
  - customer.subscription.deleted  
- [ ] Tenant subscription status updated.  
- [ ] Webhook signature verified.

### Dependencies
- **[Stripe integration](ca://s?q=Explain_Stripe_integration)**  
- **[Tenant model](ca://s?q=Explain_tenant_model)**

---

## 5. Implement subscription status fields

**As a developer**  
I want subscription status fields on tenants  
So that billing state is tracked.

**Size:** XS  
**Estimate:** 0.5 day  
**Priority:** High  
**Target Date:** **19 August 2027**

### Acceptance Criteria
- [ ] **[Subscription fields](ca://s?q=Explain_subscription_status_fields)** added:
  - status (active, trialing, past_due, cancelled)  
  - current_period_end  
  - stripe_customer_id  
  - stripe_subscription_id  
- [ ] Updated via webhook.

### Dependencies
- **[Webhook handler](ca://s?q=Explain_Stripe_webhook_handler)**

---

## 6. Implement trial period logic

**As a developer**  
I want trial periods  
So that new tenants can test the platform.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** Medium  
**Target Date:** **21 August 2027**

### Acceptance Criteria
- [ ] **[Trial logic](ca://s?q=Explain_trial_period_logic)** supports:
  - configurable trial length  
  - trial expiration  
  - trial-to-paid conversion  
- [ ] Notifications sent before trial ends.

### Dependencies
- **[Notification system](ca://s?q=Explain_notification_system)**  
- **[Subscription fields](ca://s?q=Explain_subscription_status_fields)**

---

## 7. Implement usage limits per plan

**As a developer**  
I want usage limits  
So that features scale with subscription tiers.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** Medium  
**Target Date:** **26 August 2027**

### Acceptance Criteria
- [ ] **[Usage limits](ca://s?q=Explain_usage_limits)** enforced for:
  - number of players  
  - number of rounds per month  
  - number of admins  
- [ ] Grace period for overages.  
- [ ] Admin UI shows usage.

### Dependencies
- **[Subscription plans](ca://s?q=Explain_subscription_plans)**  
- **[Tenant model](ca://s?q=Explain_tenant_model)**

---

## 8. Implement billing portal link

**As a developer**  
I want a billing portal link  
So that tenants can manage payment methods and invoices.

**Size:** XS  
**Estimate:** 0.5 day  
**Priority:** Medium  
**Target Date:** **27 August 2027**

### Acceptance Criteria
- [ ] **[Billing portal API](ca://s?q=Explain_billing_portal_API)** returns Stripe portal URL.  
- [ ] Tenant_id included in metadata.  
- [ ] Accessible only to tenant admins.

### Dependencies
- **[Stripe integration](ca://s?q=Explain_Stripe_integration)**

---

## 9. Implement invoice email notifications

**As a developer**  
I want invoice notifications  
So that tenants receive billing updates.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** Low  
**Target Date:** **29 August 2027**

### Acceptance Criteria
- [ ] **[Invoice email template](ca://s?q=Explain_invoice_email_template)** includes:
  - amount  
  - due date  
  - invoice link  
- [ ] Triggered by webhook.  
- [ ] Respects notification preferences.

### Dependencies
- **[Email service](ca://s?q=Explain_email_service_design)**  
- **[Webhook handler](ca://s?q=Explain_Stripe_webhook_handler)**

---

## 10. Implement subscription cancellation flow

**As a developer**  
I want a cancellation flow  
So that tenants can end their subscription cleanly.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** Low  
**Target Date:** **31 August 2027**

### Acceptance Criteria
- [ ] **[Cancel subscription API](ca://s?q=Explain_cancel_subscription_API)** calls Stripe.  
- [ ] Tenant status updated to “cancelled”.  
- [ ] Access ends at period end.  
- [ ] Confirmation email sent.

### Dependencies
- **[Stripe integration](ca://s?q=Explain_Stripe_integration)**  
- **[Email service](ca://s?q=Explain_email_service_design)**

---

## 11. Implement grace period handling

**As a developer**  
I want a grace period  
So that tenants have time to resolve payment issues.

**Size:** XS  
**Estimate:** 0.5 day  
**Priority:** Low  
**Target Date:** **01 September 2027**

### Acceptance Criteria
- [ ] **[Grace period logic](ca://s?q=Explain_grace_period_logic)** applied when payment fails.  
- [ ] Notifications sent.  
- [ ] Access restricted after grace period ends.

### Dependencies
- **[Webhook handler](ca://s?q=Explain_Stripe_webhook_handler)**

---

## 12. Implement billing analytics dashboard

**As a developer**  
I want a billing analytics dashboard  
So that super-admins can monitor revenue and churn.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** Low  
**Target Date:** **06 September 2027**

### Acceptance Criteria
- [ ] **[Billing analytics](ca://s?q=Explain_billing_analytics_dashboard)** include:
  - MRR  
  - churn rate  
  - active subscriptions  
  - trial conversions  
- [ ] Super-admin only.

### Dependencies
- **[Analytics service](ca://s?q=Explain_analytics_service)**  
- **[Subscription data](ca://s?q=Explain_subscription_status_fields)**

---

# End of stories-billing.md
