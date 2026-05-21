# stories-internationalisation.md
Parent Epic: #INTERNATIONALISATION_EPIC_PLACEHOLDER  
(Replace with actual epic issue number after creation)

---

# Internationalisation (i18n), Localisation (l10n) & Multi‑Language Support — User Stories

This file contains all user stories for the Internationalisation epic, including:
- Story narrative  
- Acceptance criteria  
- Dependencies  
- Size (XS/S/M/L/XL)  
- Estimate (0.5–15 days)  
- Priority  
- Target date (sequential, 6‑hour days, weekdays only)
- Guided Links embedded as required

Start date for this epic (after Architecture epic ends): **29 April 2028**

---

## 1. Implement i18n framework (frontend)

**As a developer**  
I want an i18n framework in the frontend  
So that the UI can support multiple languages.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** High  
**Target Date:** **29 April 2028**

### Acceptance Criteria
- [ ] **[i18n framework](ca://s?q=Explain_frontend_i18n_framework)** configured (e.g., i18next).  
- [ ] Language files loaded dynamically.  
- [ ] Fallback language defined.  
- [ ] Works with React components.

### Dependencies
- **[Frontend architecture](ca://s?q=Explain_frontend_architecture)**

---

## 2. Implement i18n framework (backend)

**As a developer**  
I want backend i18n support  
So that system messages and emails can be localised.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** High  
**Target Date:** **01 May 2028**

### Acceptance Criteria
- [ ] **[Backend i18n](ca://s?q=Explain_backend_i18n_framework)** supports:
  - email templates  
  - error messages  
  - notifications  
- [ ] Language passed via header or user preference.  
- [ ] Fallback logic implemented.

### Dependencies
- **[Email delivery module](ca://s?q=Explain_email_delivery_module_design)**  
- **[Notification system](ca://s?q=Explain_notification_system)**

---

## 3. Implement language selector (frontend)

**As a developer**  
I want a language selector  
So that users can switch languages easily.

**Size:** XS  
**Estimate:** 0.5 day  
**Priority:** High  
**Target Date:** **02 May 2028**

### Acceptance Criteria
- [ ] **[Language selector](ca://s?q=Explain_language_selector_UI)** in header.  
- [ ] Saves preference to backend.  
- [ ] Updates UI instantly.  
- [ ] Supports at least:
  - English  
  - Spanish  
  - Catalan  
  - French  

### Dependencies
- **[i18n framework](ca://s?q=Explain_frontend_i18n_framework)**  
- **[User settings API](ca://s?q=Explain_settings_page)**

---

## 4. Implement localisation for dates, numbers & units

**As a developer**  
I want localised formatting  
So that dates, numbers, and units match user expectations.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** High  
**Target Date:** **04 May 2028**

### Acceptance Criteria
- [ ] **[Locale formatting](ca://s?q=Explain_locale_formatting)** applied to:
  - dates  
  - times  
  - decimals  
  - thousand separators  
- [ ] Uses Intl API.  
- [ ] Respects user locale.

### Dependencies
- **[Language selector](ca://s?q=Explain_language_selector_UI)**

---

## 5. Extract all frontend strings to translation files

**As a developer**  
I want all UI strings externalised  
So that translations can be managed centrally.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** High  
**Target Date:** **09 May 2028**

### Acceptance Criteria
- [ ] **[String extraction](ca://s?q=Explain_frontend_string_extraction)** completed for:
  - dashboard  
  - rounds  
  - scorecard  
  - settings  
  - admin  
- [ ] No hardcoded strings remain.  
- [ ] English file is the source of truth.

### Dependencies
- **[i18n framework](ca://s?q=Explain_frontend_i18n_framework)**

---

## 6. Extract all backend strings to translation files

**As a developer**  
I want backend strings externalised  
So that emails and system messages can be translated.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** Medium  
**Target Date:** **14 May 2028**

### Acceptance Criteria
- [ ] **[Backend string extraction](ca://s?q=Explain_backend_string_extraction)** completed for:
  - email templates  
  - notifications  
  - error messages  
  - audit logs  
- [ ] English file is the source of truth.

### Dependencies
- **[Backend i18n](ca://s?q=Explain_backend_i18n_framework)**

---

## 7. Implement translation management workflow

**As a developer**  
I want a translation workflow  
So that new strings can be added and translated efficiently.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** Medium  
**Target Date:** **16 May 2028**

### Acceptance Criteria
- [ ] **[Translation workflow](ca://s?q=Explain_translation_management_workflow)** documented.  
- [ ] Includes:
  - adding new keys  
  - updating translations  
  - reviewing translations  
- [ ] Stored in `/docs/i18n`.

### Dependencies
- **[String extraction](ca://s?q=Explain_frontend_string_extraction)**

---

## 8. Implement right‑to‑left (RTL) support (future)

**As a developer**  
I want RTL support  
So that languages like Arabic and Hebrew can be supported later.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** Low  
**Target Date:** **21 May 2028**

### Acceptance Criteria
- [ ] **[RTL support](ca://s?q=Explain_RTL_support)** implemented in:
  - layout  
  - components  
  - typography  
- [ ] Direction toggles automatically based on locale.

### Dependencies
- **[Frontend theming](ca://s?q=Explain_theme_support)**

---

## 9. Implement multi‑language email templates

**As a developer**  
I want multi‑language email templates  
So that users receive emails in their preferred language.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** Medium  
**Target Date:** **23 May 2028**

### Acceptance Criteria
- [ ] **[Localised email templates](ca://s?q=Explain_localised_email_templates)** for:
  - handicap updates  
  - round approvals  
  - invoices  
  - notifications  
- [ ] Fallback to English.  
- [ ] Preview mode for admins.

### Dependencies
- **[Backend i18n](ca://s?q=Explain_backend_i18n_framework)**  
- **[Email delivery module](ca://s?q=Explain_email_delivery_module_design)**

---

## 10. Implement multi‑language PDF templates

**As a developer**  
I want multi‑language PDF templates  
So that scorecards and reports can be exported in any language.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** Low  
**Target Date:** **28 May 2028**

### Acceptance Criteria
- [ ] **[Localised PDF templates](ca://s?q=Explain_localised_PDF_templates)** for:
  - scorecards  
  - handicap reports  
  - admin exports  
- [ ] RTL support optional.  
- [ ] Fonts updated for multilingual support.

### Dependencies
- **[PDF generation module](ca://s?q=Explain_PDF_generation_module)**  
- **[Backend i18n](ca://s?q=Explain_backend_i18n_framework)**

---

## 11. Implement multi‑language mobile support

**As a developer**  
I want multi‑language support in the mobile app  
So that users can use the app in their preferred language.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** Medium  
**Target Date:** **02 June 2028**

### Acceptance Criteria
- [ ] **[Mobile i18n](ca://s?q=Explain_mobile_i18n_framework)** implemented.  
- [ ] Language selector in settings.  
- [ ] Strings externalised.  
- [ ] Offline translations cached.

### Dependencies
- **[Mobile app](ca://s?q=Explain_Expo_project_setup)**  
- **[Frontend i18n](ca://s?q=Explain_frontend_i18n_framework)**

---

## 12. Implement localisation QA checklist

**As a developer**  
I want a localisation QA checklist  
So that translations and formatting are validated before release.

**Size:** XS  
**Estimate:** 0.5 day  
**Priority:** Low  
**Target Date:** **03 June 2028**

### Acceptance Criteria
- [ ] **[i18n QA checklist](ca://s?q=Explain_i18n_QA_checklist)** created.  
- [ ] Includes:
  - missing translations  
  - formatting issues  
  - RTL checks  
  - mobile checks  
- [ ] Stored in `/docs/i18n`.

### Dependencies
- **[Translation workflow](ca://s?q=Explain_translation_management_workflow)**

---

# End of stories-internationalisation.md
