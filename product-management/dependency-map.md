# **📊 Full Platform Dependency Graph**

Below is the **top‑down dependency tree**, starting from foundational epics and expanding outward.

Every node is a Guided Link so you can jump directly to the epic.

---

# **1. Foundation Layer (must be completed first)**

```
Authentication
└── Players
    └── Courses
        └── Rounds
```

**Explanation:**  
Auth → Players → Courses → Rounds is the core data chain.  
Rounds depend on players + courses; players depend on auth.

---

# **2. Core Application Layer**

```
Rounds
├── Handicap
│   └── Dashboard
│       └── Notifications
│           └── PDF
│               └── Leaderboard
│                   └── Competitions
```

**Explanation:**  
Handicap requires rounds.  
Dashboard requires handicap + rounds.  
Notifications require dashboard + events.  
PDF requires rounds + players + courses.  
Leaderboard requires rounds + handicap.  
Competitions requires rounds + handicap + leaderboard scaffolding.

---

# **3. Infrastructure Layer**

```
Competitions
└── DevOps
    ├── Security
    │   └── PWA
    │       └── Multitenancy
    │           └── Billing
```

**Explanation:**  
DevOps is required after core gameplay and ranking flows are stable.  
Security is required before PWA (service workers, offline auth).  
PWA is required before multitenancy (offline tenant‑scoped data).  
Multitenancy is required before billing (tenant subscriptions).

---

# **4. Intelligence Layer**

```
Billing
└── AI
    └── Mobile
        └── Testing
```

**Explanation:**  
AI requires stable billing + tenant context.  
Mobile requires AI + stable APIs.  
Testing requires mobile + all core features.

---

# **5. Data & Architecture Layer**

```
Testing
└── Analytics
    └── Architecture
        └── Internationalisation
            └── Misc
```

**Explanation:**  
Analytics requires stable testing + data correctness.  
Architecture refactors require analytics visibility.  
Internationalisation requires stable architecture.  
Misc enhancements come last.

---

# **📐 Full Graph (Flattened View)**

Here is the entire dependency graph in a single block:

```
Authentication
└── Players
    └── Courses
        └── Rounds
            ├── Handicap
            │   └── Dashboard
            │       └── Notifications
            │           └── PDF
            │               └── Leaderboard
            │                   └── Competitions
            └── DevOps
                └── Security
                    └── PWA
                        └── Multitenancy
                            └── Billing
                                ├── Integrations
                                └── AI
                                    └── Mobile
                                        └── Testing
                                            └── Analytics
                                                └── Architecture
                                                    └── Internationalisation
                                                        └── Misc
```

This is the **true dependency chain** of your entire platform.

---

# **📎 Cross‑Epic Dependency Table**

| Epic | Depends On | Enables |
|------|------------|---------|
| **Auth** | — | Players |
| **Players** | Auth | Courses |
| **Courses** | Players | Rounds |
| **Rounds** | Courses | Handicap, PDF, Leaderboard |
| **Handicap** | Rounds | Dashboard |
| **Dashboard** | Handicap | Notifications |
| **Notifications** | Dashboard | PDF |
| **PDF** | Rounds | Leaderboard |
| **Leaderboard** | Rounds | Competitions |
| **Competitions** | Leaderboard, Handicap | DevOps |
| **DevOps** | Competitions | Security |
| **Integrations** | Billing, Multitenancy | — |
| **Security** | DevOps | PWA |
| **PWA** | Security | Multitenancy |
| **Multitenancy** | PWA | Billing |
| **Billing** | Multitenancy | AI |
| **AI** | Billing | Mobile |
| **Mobile** | AI | Testing |
| **Testing** | Mobile | Analytics |
| **Analytics** | Testing | Architecture |
| **Architecture** | Analytics | Internationalisation |
| **Internationalisation** | Architecture | Misc |
| **Misc** | Internationalisation | — |

---
