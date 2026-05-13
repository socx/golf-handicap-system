# **GitHub Project Configuration (Full Specification)**

## **1. Project Name**
```
Golf Handicap System Platform Roadmap & Delivery Plan
```

---

## **2. Columns (Kanban Workflow)**

Each column corresponds to a **status** in GitHub Projects.

| Column | Status | Purpose |
|--------|--------|---------|
| **Backlog** | `Backlog` | All stories not yet scheduled |
| **Ready** | `Ready` | Groomed, estimated, dependency‑free |
| **In Progress** | `In Progress` | Actively being worked on |
| **In Review** | `Review` | PR open, awaiting approval |
| **Testing** | `Testing` | QA, E2E, regression |
| **Blocked** | `Blocked` | Waiting on dependency |
| **Done** | `Done` | Completed and merged |

Statuses map directly to GitHub Project fields.

---

## **3. Custom Fields**

These fields allow tracking of the rich metadata already defined in the story files.

| Field | Type | Description |
|-------|------|-------------|
| **Epic** | Single select | Links each story to its epic |
| **Size** | Single select | XS / S / M / L / XL |
| **Estimate (days)** | Number | 0.5–15 days |
| **Priority** | Single select | Low / Medium / High |
| **Target Date** | Date | Sequential delivery date |
| **Dependencies** | Text | List of blocking stories |
| **Blocked By** | Text | Auto‑filled by automation |
| **Tenant Impact** | Single select | None / Single / Multi |
| **AI Impact** | Single select | None / Low / Medium / High |
| **Mobile Impact** | Single select | None / Low / Medium / High |

---

## **4. Labels**

These labels match the epics and allow filtering across repos.

```
epic:auth
epic:players
epic:courses
epic:rounds
epic:handicap
epic:dashboard
epic:notifications
epic:pdf
epic:leaderboard
epic:competitions
epic:devops
epic:security
epic:pwa
epic:multitenancy
epic:billing
epic:integrations
epic:ai
epic:mobile
epic:testing
epic:analytics
epic:architecture
epic:i18n
epic:misc
```

Plus workflow labels:

```
blocked
needs-review
needs-testing
ready
```

---

## **5. Milestones (Epic‑Level)**

Each milestone corresponds to a story file.

| Milestone | Dates | Link |
|-----------|--------|------|
| **Authentication** | May 2026 | **Open** |
| **Players** | May–Jun 2026 | **Open** |
| **Courses** | Jun–Jul 2026 | **Open** |
| **Rounds** | Jul–Sep 2026 | **Open** |
| **Frontend** | Sep 2026–2027 | **Open** |
| **PDF** | Early 2027 | **Open** |
| **Leaderboard** | Feb–Mar 2027 | **Open** |
| **Competitions** | Mar 2027 | **Open** |
| **DevOps** | Mar–May 2027 | **Open** |
| **Security** | May–Jun 2027 | **Open** |
| **PWA** | Jun–Jul 2027 | **Open** |
| **Multitenancy** | Jul–Aug 2027 | **Open** |
| **Billing** | Aug–Sep 2027 | **Open** |
| **Integrations** | Sep–Oct 2027 | **Open** |
| **AI** | Sep–Oct 2027 | **Open** |
| **Mobile** | Oct–Dec 2027 | **Open** |
| **Testing** | Dec 2027–Jan 2028 | **Open** |
| **Analytics** | Jan–Mar 2028 | **Open** |
| **Architecture** | Mar–Apr 2028 | **Open** |
| **Internationalisation** | Apr–Jun 2028 | **Open** |
| **Misc** | Jun–Jul 2028 | **Open** |

---

## **6. Automation Rules**

These are GitHub Projects automations that can be configured directly.

### **Move to “In Progress” when PR is opened**
```
Trigger: Pull request opened
Condition: Issue linked to PR
Action: Set Status = In Progress
```

### **Workflow Configuration IDs (for API updates)**
To enable direct project status updates in `.github/workflows/project-auto-move.yml`, set:

```
GH_PROJECT_ID=<ProjectV2 node ID>
GH_PROJECT_STATUS_FIELD_ID=<Status field node ID>
GH_OPTION_BACKLOG=<single-select option ID>
GH_OPTION_READY=<single-select option ID>
GH_OPTION_IN_PROGRESS=<single-select option ID>
GH_OPTION_REVIEW=<single-select option ID>
GH_OPTION_TESTING=<single-select option ID>
GH_OPTION_BLOCKED=<single-select option ID>
```

If these are left blank, the workflow still applies fallback labels (`in-progress`, `needs-review`, `needs-testing`, `blocked`).

### **Move to “In Review” when PR is ready for review**
```
Trigger: PR marked ready for review
Action: Set Status = Review
```

### **Move to “Testing” when PR is merged**
```
Trigger: PR merged
Action: Set Status = Testing
```

### **Move to “Done” when QA passes**
```
Trigger: Label added: qa-approved
Action: Set Status = Done
```

### **Auto‑flag dependencies**
```
Trigger: Issue added to project
Action: If Dependencies field contains issue numbers → add label "blocked"
```

### **Auto‑remove “blocked” when dependencies close**
```
Trigger: Issue closed
Action: Remove "blocked" from dependent issues
```

---

## **7. Saved Views**

These are the views that'll be used daily.

### **1. Roadmap View (Timeline)**
- Group by: **Epic**
- Sort by: **Target Date**
- Fields: Size, Estimate, Priority, Dependencies

### **2. Critical Path View**
- Filter: `Priority = High`
- Sort: `Target Date`
- Shows the chain of epics that cannot slip.

### **3. AI‑Related Work**
- Filter: `AI Impact != None`
- Group by: Epic

### **4. Mobile‑Related Work**
- Filter: `Mobile Impact != None`
- Group by: Status

### **5. Blocked Items**
- Filter: `Status = Blocked`

### **6. Upcoming 30 Days**
- Filter: `Target Date <= today + 30 days`

### **7. Completed This Quarter**
- Filter: `Status = Done AND completed_at within quarter`

---

## **8. Issue Template (Optional)**

This can be added to `.github/ISSUE_TEMPLATE/story.md`:

```
### Story
As a <role>  
I want <capability>  
So that <value>

### Acceptance Criteria
- [ ] …

### Size
XS / S / M / L / XL

### Estimate
<days>

### Priority
Low / Medium / High

### Dependencies
<list>

### Epic
<epic name>
```

---

## **9. Project Roles**

| Role | Responsibility |
|------|----------------|
| **Owner** | Maintains roadmap, milestones, automation |
| **Tech Lead** | Ensures dependencies are correct |
| **Engineers** | Update status, estimates, fields |
| **QA** | Moves issues to Testing / Done |
| **Admin** | Manages labels, templates, permissions |

---

## **10. Integration With Story Files**

Each epic in GitHub Projects links directly to its story file:

- **Master Index**  
- **All Story Files**  

This ensures the GitHub Project is **fully aligned** with the story architecture.

---
