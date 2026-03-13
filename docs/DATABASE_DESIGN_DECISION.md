# Database Design Decision — Komatsu API Marketplace BFF

## Executive Summary

**Recommendation: NO database required for MVP/Phase 1–3**

The BFF can operate **database-free** by leveraging:
- **Azure APIM** as the source of truth for APIs, products, subscriptions
- **Global Admin API** as the source of truth for user roles
- **In-memory cache (IMemoryCache)** for transient response deduplication
- **Application Insights** for audit logging and analytics

A database becomes necessary only when you need:
- User-specific data beyond APIM subscriptions (preferences, saved searches, integrations)
- Offline-first features (local storage, sync)
- Real-time notifications (separate event stream)
- Custom business logic not in APIM
- Multi-tenant data isolation at the app level

---

## 1. Current Data Flow (Database-Free)

```
┌──────────────────────────────────────┐
│  SPA (React Browser)                 │
│  • User JWT token (Entra ID)         │
│  • Local state management            │
└────────────────┬─────────────────────┘
                 │ Bearer token + API calls
                 ▼
┌──────────────────────────────────────┐
│  BFF (.NET)                          │
│                                      │
│  Gets user JWT claims                │
│  ├─ oid (user ID)                    │
│  ├─ roles (from token or enriched)   │
│  └─ displayName, email               │
│                                      │
│  IMemoryCache                        │
│  ├─ API list (10 min TTL)            │
│  ├─ User roles (30 min TTL)          │
│  └─ Product details (5 min TTL)      │
└────────────────┬─────────────────────┘
                 │ Managed Identity token
                 ▼
┌──────────────────────────────────────┐
│  Azure APIM                          │
│  • ARM Management API (design-time)  │
│  • Data API (runtime)                │
│  ├─ APIs & operations                │
│  ├─ Products                         │
│  ├─ Subscriptions                    │
│  ├─ Tags & metadata                  │
│  └─ User subscriptions (by sub ID)   │
└────────────────┬─────────────────────┘
                 │
      ┌──────────┴──────────┐
      ▼                     ▼
┌──────────────┐      ┌──────────────────┐
│ Global Admin │      │ Azure Entra ID   │
│     API      │      │                  │
├─ User roles │      ├─ JWT JWKS        │
├─ Permissions│      ├─ Token validation│
└──────────────┘      └──────────────────┘

NO DATABASE NEEDED — All data sourced from APIs
```

---

## 2. Data Inventory & Source of Truth

### **Immutable Reference Data** (Read-only, no persistence needed)

| Data | Source | Lifetime | Update Frequency | BFF Role |
|------|--------|----------|------------------|----------|
| **APIs** | APIM ARM API | ∞ (cached 10 min) | Ad-hoc (admins) | Proxy + cache |
| **Products** | APIM ARM API | ∞ (cached 5 min) | Ad-hoc (admins) | Proxy + cache |
| **Operations** | APIM ARM API | ∞ (cached 10 min) | Ad-hoc (admins) | Proxy + cache |
| **Tags** | APIM ARM API | ∞ (cached 1 day) | Ad-hoc (admins) | Proxy + cache |
| **Metadata** | APIM ARM API | ∞ | Ad-hoc (admins) | Proxy + cache |
| **API Specs** | APIM (OpenAPI) | ∞ | Versioned | Serve as-is |

### **User-Scoped Data** (Ephemeral, computed on-demand)

| Data | Source | Lifetime | BFF Role |
|------|--------|----------|----------|
| **User Subscriptions** | APIM (by user sub) | Session | Query + return |
| **Subscription Keys** | APIM Subscriptions API | Secrets | Retrieve on-demand |
| **User Roles** | Global Admin API | 30 min | Query + cache |
| **User Profile** | JWT claims (Entra ID) | Session | Extract from token |

### **Transient Data** (Session-only, no backend storage needed)

| Data | Location | Lifetime |
|------|----------|----------|
| **Search filters** | SPA local state | Session |
| **Favorites/bookmarks** | Browser localStorage | Persistent locally |
| **UI preferences** | SPA local state | Session |
| **Try-It sandbox inputs** | SPA component state | During operation |

---

## 3. When You DO Need a Database

### ✅ **Scenarios Requiring Persistence**

```
1. USER PREFERENCES
   • Favorite APIs, saved searches, dashboard configuration
   • Custom sorting/filtering preferences
   • Notification settings
   → Typically 500 bytes per user

2. AUDIT TRAIL (Beyond APIM logs)
   • Custom events not logged by APIM
   • User behavior analytics
   • Compliance events (SOC 2, HIPAA)
   → Append-only writes; high volume

3. NOTIFICATIONS
   • User subscription announcements
   • API deprecation warnings
   • Usage alerts
   → Separate event stream; queue-based

4. OFFLINE SYNC
   • Allow local modifications without backend
   • Sync when online
   → Complex (CRDTs, conflict resolution)

5. CUSTOM BUSINESS LOGIC
   • Rate limit tracking beyond APIM
   • Custom entitlements not in APIM
   • Partner agreements (if not in APIM)
   → Business rules engine

6. MULTI-TENANT ISOLATION
   • If tenants need app-level data isolation
   • APIM already provides API-level isolation
   → Only needed if you scoped APIM by app

7. REPORTING & ANALYTICS
   • Custom reports on user behavior
   • Cohort analysis, funnel tracking
   • If Application Insights insufficient
   → Data warehouse pattern (separate DB)
```

### ❌ **Scenarios NOT Requiring a Database**

```
❌ Caching API list                          → Use IMemoryCache
❌ Storing user subscriptions                → Query APIM on-demand
❌ Storing user roles                        → Query Global Admin (cached 30 min)
❌ Audit logging of API calls                → Use Application Insights
❌ Request/response logging                  → Use Application Insights + Log Analytics
❌ Transient session state                   → Use HttpContext.Items or SPA state
❌ API specifications (OpenAPI)              → Serve from APIM directly
❌ User profile info                         → Extract from JWT claims
❌ Subscription key storage                  → Query APIM on-demand (secured)
❌ Notification queue (if not real-time)     → Use Azure Service Bus / Event Hub
```

---

## 4. Decision Matrix

### **For MVP Phase (Months 1–2)**

| Requirement | Have It? | Storage | Reason |
|-------------|----------|---------|--------|
| Browse APIs | ✅ | APIM cache | Read-only reference data |
| Search APIs | ✅ | IMemoryCache | Derived from APIM |
| View API details | ✅ | APIM cache | Detailed reference data |
| Try API operations | ✅ | Session state | Temporary sandbox state |
| Create subscription | ✅ | APIM | BFF just proxies request |
| View my subscriptions | ✅ | APIM query | User-scoped data in APIM |
| Get API keys | ✅ | APIM on-demand | Query at request time |
| User authentication | ✅ | JWT (Entra ID) | Stateless, token-driven |
| Role-based access | ✅ | JWT + Global Admin cache | 30-min cache |

**Conclusion: NO DATABASE NEEDED** ✅

### **For Phase 2 (Months 3–4)**

| Feature | Requires DB? | Alternative |
|---------|-------------|-------------|
| Save favorite APIs | ❓ Optional | Browser localStorage |
| My integrations dashboard | ✅ Optional | APIM subscriptions list |
| Notification center | ⚠️ Recommended | Azure Service Bus Topic |
| API deprecation alerts | ⚠️ Recommended | Event-driven via Event Grid |
| Custom role permissions | ❓ Optional | Extended RBAC config |
| Audit compliance report | ⚠️ Recommended | Application Insights + KQLM |

**Recommendation: Still no PRIMARY database** ⚠️ (Use event streams instead)

### **For Phase 3+ (Months 5+)**

| Feature | Database Type |
|---------|---------------|
| User preferences & settings | **NoSQL (Cosmos DB)** — scalable, fast |
| Audit trail (immutable) | **NoSQL or Data Lake** — append-only, partitioned |
| Analytics & reporting | **Data Warehouse (Synapse)** — separate system |
| Real-time notifications | **Event stream (Event Hub)** — not a DB |

---

## 5. Architecture Options

### **Option A: Database-Free (Recommended for MVP)**

```
┌─────────────────────────────────────────────────────┐
│                      SPA                            │
│                  (React + MUI 7)                    │
└─────────────────┬───────────────────────────────────┘
                  │
        HTTP(S) with Bearer token
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│                    BFF (.NET)                       │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │ IMemoryCache (in-process)                    │   │
│  │ • APIs list (10 min TTL)                     │   │
│  │ • User roles (30 min TTL)                    │   │
│  │ • Product details (5 min TTL)                │   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │ Authorization & Middleware                   │   │
│  │ • JWT validation                             │   │
│  │ • Claims enrichment                          │   │
│  │ • RBAC policy checks                         │   │
│  │ • Audit logging (App Insights)               │   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
│  Stateless — scales horizontally                   │
│  No database connection pool overhead              │
│  Sub-5ms authorization decisions                   │
└─────────────────┬───────────────────────────────────┘
                  │
        Managed Identity token
                  │
      ┌───────────┴───────────┐
      ▼                       ▼
  ┌────────────┐         ┌──────────────┐
  │ Azure APIM │         │ Global Admin  │
  │ (SoT)      │         │ (SoT)        │
  └────────────┘         └──────────────┘

Pros:
  ✅ No database operations
  ✅ Stateless scaling (load balancer friendly)
  ✅ Reduced operational complexity
  ✅ Lower latency (<5ms per request)
  ✅ No connection pool management
  ✅ Cheaper (no DB licensing/hosting)
  ✅ Easier to containerize

Cons:
  ❌ No custom user data persistence
  ❌ No offline features
  ❌ Limited custom business logic
  ❌ Must rely on APIM for all data
```

### **Option B: Optional NoSQL for Extended Features (Phase 3)**

```
┌─────────────────────────────────────────────────────┐
│                      SPA                            │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│                    BFF (.NET)                       │
│                                                     │
│ Uses APIM for:                                      │
│ • APIs, products, subscriptions                     │
│ • Authorization (roles from Global Admin)           │
│                                                     │
│ Uses Cosmos DB for:                                 │
│ • User preferences (favorites, settings)            │
│ • Dashboard customization                           │
│ • Integration metadata                              │
│ • Audit compliance (append-only)                    │
└──────────────────┬────────────────────────────────┘
                   │
        ┌──────────┼──────────┬───────────┐
        ▼          ▼          ▼           ▼
    ┌────────┐ ┌──────────┐ ┌────────┐ ┌────────────┐
    │ APIM   │ │ Cosmos   │ │ Event  │ │ App        │
    │(APIs)  │ │ DB (User)│ │ Hub    │ │ Insights   │
    │        │ │ (prefs)  │ │ (audit)│ │ (logs)     │
    └────────┘ └──────────┘ └────────┘ └────────────┘

Pros:
  ✅ Everything from Option A
  ✅ User preferences & personalization
  ✅ Extended audit trail
  ✅ Real-time notifications via Event Hub

Cons:
  ❌ More operational complexity
  ❌ Database connection management
  ❌ Eventual consistency (Cosmos DB)
  ❌ Cost (Cosmos DB + Event Hub)
  ⚠️ Only add when needed, don't pre-engineer
```

### **Option C: Relational SQL (NOT Recommended)**

```
BFF → SQL Server / PostgreSQL
  ├─ User preferences
  ├─ Subscription audit
  ├─ Custom roles
  └─ Integration history

Pros:
  ✅ Strong ACID guarantees
  ✅ Complex queries

Cons:
  ❌ Overkill for Komatsu use case
  ❌ Harder to scale horizontally
  ❌ Connection pool contention
  ❌ More complex schema management
  ❌ Doesn't fit stateless BFF pattern
```

---

## 6. Conclusion & Recommendation

### **For Current Phase (MVP → Phase 3)**

**✅ NO DATABASE**

Use:
- **APIM** as source of truth for APIs, products, subscriptions
- **Global Admin API** for user roles
- **IMemoryCache** for transient caching
- **Application Insights** for audit logging

### **For Future Phases (Phase 4+)**

**⚠️ OPTIONAL NoSQL (Cosmos DB)**

Add only if you need:
- User preferences ✓
- Extended audit trail ✓
- Real-time notifications ✓
- Custom entitlements ✓

**❌ NEVER Relational SQL**

It's incompatible with:
- Stateless scaling
- Cloud-native architecture
- API-driven design

---

## 7. Implementation Guidance

### **If You DON'T Add a Database (Recommended)**

```csharp
// Program.cs
builder.Services.AddMemoryCache();
builder.Services.AddSingleton<IApiCacheService, MemoryCacheManager>();

// Keep it simple:
// • Cache invalidation based on TTL only
// • No background sync jobs
// • Query APIM on cache miss
```

### **If You MUST Add a Database (Phase 3+)**

```csharp
// Program.cs
builder.Services.AddCosmosDb(options => { ... });

// Add a separate data layer:
// • IUserPreferenceRepository
// • INotificationRepository
// • Keep APIM queries separate from user data

// Important: Don't migrate existing APIM data to DB
// • Keep APIM as system of record
// • DB is supplementary only
```

---

## 8. Cost Analysis

### **Database-Free Architecture (Recommended)**

| Component | Monthly Cost |
|-----------|--------------|
| Container Apps (BFF) | $50–200 |
| APIM (existing) | $500–2000 |
| IMemoryCache | $0 (included) |
| Application Insights | $100–300 |
| **Total** | **$650–2500** |

### **With Cosmos DB (Optional)**

| Component | Monthly Cost |
|-----------|--------------|
| Container Apps | $50–200 |
| APIM | $500–2000 |
| Cosmos DB (R/U model) | $200–1000 |
| Application Insights | $100–300 |
| Event Hub (optional) | $100–300 |
| **Total** | **$950–3800** |

**Savings: $300–1300/month by staying database-free**

---

## 9. Migration Path

### **Phase 1–2: Database-Free** ✅
```
MVP features only
APIM as source of truth
IMemoryCache for performance
No custom data persistence
```

### **Phase 3: Optional Observability Database**
```
If needed: Cosmos DB for user preferences only
Keep APIM API data untouched
No migration of existing API data
```

### **Phase 4: Analytics Warehouse** (if needed)
```
Separate data warehouse (not operational DB)
Historical reporting only
No transactional queries
```

---

## 10. FAQ

**Q: Won't caching stale if APIM changes?**
A: Cache TTL is 5–30 min. For critical changes, clear cache manually or use webhooks.

**Q: What if global Admin API is down?**
A: Role cache lasts 30 min. For outages >30 min, admins must restart BFF or manually clear cache.

**Q: Can users save favorites without a DB?**
A: Yes, use browser `localStorage` (client-side). BFF doesn't need to store it.

**Q: How do we track user behavior?**
A: Use Application Insights. All BFF operations are logged with user ID, timestamps, outcomes.

**Q: What about audit compliance (SOC 2)?**
A: Application Insights audit logging is sufficient. Optional: Cosmos DB for extended retention.

**Q: Can we scale BFF if we have a database?**
A: Yes, but adds latency and complexity. Without DB, scales horizontally to unlimited instances.

**Q: When should we add Cosmos DB?**
A: Only when users demand features requiring persistence:
  • Custom integration settings
  • Saved search filters
  • User-specific dashboards
  • Notification subscriptions

**Q: Will APIM handle all our data needs?**
A: Yes, APIM manages APIs, products, subscriptions, users. If you need app-specific data, then add DB.

---

## Decision Record

**Date:** March 10, 2026  
**Decision:** No database for MVP/Phase 1–3  
**Rationale:** APIM is source of truth; caching handles performance; stateless BFF scales better  
**Approved By:** [Software Architect]  
**Review Date:** June 10, 2026 (Phase 2 checkpoint)

---

## References

- **Current Architecture:** [DESIGN_DOCUMENT.md](./DESIGN_DOCUMENT.md) — SPA + BFF pattern
- **RBAC Design:** [RBAC_ARCHITECTURE.md](./RBAC_ARCHITECTURE.md) — Role-based authorization
- **Azure APIM:** [APIM Data API Comparison](./APIM_DATA_API_COMPARISON.md)
- **Caching Strategy:** See Program.cs `IMemoryCache` configuration
