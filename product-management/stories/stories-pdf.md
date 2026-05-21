# stories-pdf.md
Parent Epic: #PDF_EPIC_PLACEHOLDER  
(Replace with actual epic issue number after creation)

---

# PDF / Scorecard Export — User Stories

This file contains all user stories for the PDF/Scorecard Export epic, including:
- Story narrative  
- Acceptance criteria  
- Dependencies  
- Size (XS/S/M/L/XL)  
- Estimate (0.5–15 days)  
- Priority  
- Target date (sequential, 6‑hour days, weekdays only)
- Guided Links embedded as required

Start date for this epic (after Notifications epic ends): **16 January 2027**

---

## 1. Implement PDF generation module

**As a developer**  
I want a backend PDF generation module  
So that scorecards and documents can be exported consistently.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** High  
**Target Date:** **16 January 2027**

### Acceptance Criteria
- [ ] **[PDF generation module](ca://s?q=Explain_PDF_generation_module)** supports:
  - HTML → PDF rendering  
  - custom fonts  
  - page headers/footers  
- [ ] Module is reusable for all PDF types.  
- [ ] Errors logged with context.

### Dependencies
- **[Round detail API](ca://s?q=Explain_round_detail_API)**  
- **[Course detail API](ca://s?q=Explain_course_detail_API)**

---

## 2. Implement scorecard HTML template

**As a developer**  
I want a reusable HTML template for scorecards  
So that PDFs have a consistent, professional layout.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** High  
**Target Date:** **18 January 2027**

### Acceptance Criteria
- [ ] **[Scorecard template](ca://s?q=Explain_scorecard_template)** includes:
  - player info  
  - course + tee configuration  
  - per‑hole grid  
  - totals (gross, adjusted, putts, GIR, FIR, penalties)  
- [ ] Responsive for PDF rendering.  
- [ ] Supports 9‑hole and 18‑hole layouts.

### Dependencies
- **[PDF generation module](ca://s?q=Explain_PDF_generation_module)**  
- **[Round detail API](ca://s?q=Explain_round_detail_API)**

---

## 3. API: Export round as PDF

**As a developer**  
I want an endpoint to export a round as a PDF  
So that users can download or share their scorecards.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** High  
**Target Date:** **20 January 2027**

### Acceptance Criteria
- [ ] **[GET /rounds/:id/export/pdf](ca://s?q=Explain_round_export_PDF)** returns PDF stream.  
- [ ] Uses scorecard template.  
- [ ] Includes metadata (date, course, tee, player).  
- [ ] Returns correct headers for download.

### Dependencies
- **[Scorecard template](ca://s?q=Explain_scorecard_template)**  
- **[PDF generation module](ca://s?q=Explain_PDF_generation_module)**

---

## 4. API: Export player handicap report as PDF

**As a developer**  
I want to export a player’s handicap report  
So that players can share their handicap history.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** Medium  
**Target Date:** **25 January 2027**

### Acceptance Criteria
- [ ] **[GET /handicap/:playerId/export/pdf](ca://s?q=Explain_handicap_export_PDF)** returns:
  - current index  
  - handicap trend  
  - differentials used  
  - PCC values  
  - cap adjustments  
- [ ] Uses dedicated HTML template.  
- [ ] Supports date range filters.

### Dependencies
- **[Handicap history API](ca://s?q=Explain_handicap_history_API)**  
- **[PDF generation module](ca://s?q=Explain_PDF_generation_module)**

---

## 5. Implement PDF storage option (object storage)

**As a developer**  
I want the option to store generated PDFs  
So that users can re-download without regenerating.

**Size:** S  
**Estimate:** 1–2 days  
**Priority:** Medium  
**Target Date:** **27 January 2027**

### Acceptance Criteria
- [ ] **[PDF storage layer](ca://s?q=Explain_PDF_storage_layer)** supports:
  - upload  
  - signed URL retrieval  
  - expiry configuration  
- [ ] Storage optional (configurable).  
- [ ] Metadata stored in DB.

### Dependencies
- Object storage provider  
- **[PDF generation module](ca://s?q=Explain_PDF_generation_module)**

---

## 6. Frontend: Download scorecard button

**As a developer**  
I want a download button on the scorecard page  
So that users can export their round as a PDF.

**Size:** XS  
**Estimate:** 0.5 day  
**Priority:** High  
**Target Date:** **28 January 2027**

### Acceptance Criteria
- [ ] Button triggers **[round export API](ca://s?q=Explain_round_export_PDF)**.  
- [ ] Shows loading state.  
- [ ] Handles errors gracefully.  
- [ ] Works on mobile.

### Dependencies
- **[Scorecard view](ca://s?q=Explain_scorecard_view)**  
- **[Export API](ca://s?q=Explain_round_export_PDF)**

---

## 7. Frontend: Download handicap report button

**As a developer**  
I want a download button on the handicap page  
So that players can export their handicap report.

**Size:** XS  
**Estimate:** 0.5 day  
**Priority:** Medium  
**Target Date:** **29 January 2027**

### Acceptance Criteria
- [ ] Button triggers **[handicap export API](ca://s?q=Explain_handicap_export_PDF)**.  
- [ ] Shows loading state.  
- [ ] Works on mobile.  
- [ ] Error handling included.

### Dependencies
- **[Handicap summary page](ca://s?q=Explain_handicap_summary_page)**  
- **[Export API](ca://s?q=Explain_handicap_export_PDF)**

---

## 8. Frontend: PDF preview modal (optional)

**As a developer**  
I want a PDF preview modal  
So that users can view the PDF before downloading.

**Size:** M  
**Estimate:** 3–5 days  
**Priority:** Low  
**Target Date:** **03 February 2027**

### Acceptance Criteria
- [ ] Modal displays embedded PDF.  
- [ ] Supports zoom + scroll.  
- [ ] Works on desktop + tablet.  
- [ ] Optional feature (config flag).

### Dependencies
- **[PDF export APIs](ca://s?q=Explain_round_export_PDF)**  
- **[UI components](ca://s?q=Explain_UI_components)**

---

## 9. Admin: Bulk export rounds as ZIP

**As a developer**  
I want admins to bulk export rounds  
So that they can generate reports for tournaments or audits.

**Size:** L  
**Estimate:** 6–10 days  
**Priority:** Low  
**Target Date:** **13 February 2027**

### Acceptance Criteria
- [ ] **[POST /admin/rounds/export/zip](ca://s?q=Explain_bulk_round_export)** accepts:
  - date range  
  - course  
  - player  
- [ ] Generates PDFs for each round.  
- [ ] Bundles into ZIP.  
- [ ] Provides download link.

### Dependencies
- **[Round export PDF](ca://s?q=Explain_round_export_PDF)**  
- ZIP generation library  
- Admin RBAC

---

## 10. Implement PDF audit logging

**As a developer**  
I want to log PDF exports  
So that admins can track document access.

**Size:** XS  
**Estimate:** 0.5 day  
**Priority:** Low  
**Target Date:** **14 February 2027**

### Acceptance Criteria
- [ ] Logs include:
  - user_id  
  - document type  
  - document id  
  - timestamp  
- [ ] Viewable in admin audit logs.

### Dependencies
- **[Audit logs](ca://s?q=Explain_audit_logs)**  
- **[PDF export APIs](ca://s?q=Explain_round_export_PDF)**

---

# End of stories-pdf.md
