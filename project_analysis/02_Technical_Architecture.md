# 02 — Technical Architecture

## Actual Technology Stack (Verified from source files)

### Frontend
| Item | Detail | Source |
|---|---|---|
| Framework | React 19.2.8 | package.json |
| Language | TypeScript 6.0.2 | package.json |
| Build Tool | Vite 8.3.1 | package.json, vite.config.ts |
| Styling | Tailwind CSS v4 (@tailwindcss/vite 4.3.3) | package.json |
| Icons | Lucide React 1.49.0 | package.json |
| Routing | React Router DOM 7.18.4 (BrowserRouter, Routes) | App.tsx |
| State | React useState + useLiveQuery (dexie-react-hooks) | All pages |

### Local Storage / Database
| Item | Detail | Source |
|---|---|---|
| Primary DB | Dexie.js 4.4.6 (IndexedDB wrapper) | db.ts |
| DB Name | KabadiwalaConnect | db.ts line 175 |
| DB Version | v3 (3 migrations) | db.ts lines 186-207 |
| Tables | lots, recyclers, profile, hubs, hubPurchases, payments, shipments | db.ts |
| Reactivity | useLiveQuery from dexie-react-hooks 4.4.0 | All pages |

### Mobile / Build
| Item | Detail | Source |
|---|---|---|
| Mobile Bridge | Capacitor 8.5.2 (@capacitor/core + @capacitor/android) | package.json |
| App ID | com.techx1817.kabadiwala | capacitor.config.ts |
| App Name | KabadiwalaConnect | capacitor.config.ts |
| Web Dir | dist | capacitor.config.ts |
| Android Project | E:\K\kabadiwala-app\android\ | Filesystem |

### Cloud / Backend (Secondary)
| Item | Detail | Source |
|---|---|---|
| Cloud DB | Supabase (@supabase/supabase-js 2.117.2) | package.json |
| Sync Mode | Background, on navigator.onLine event only | App.tsx lines 171-190 |
| Backend Server | kabadiwala-backend/ (FastAPI/Python) | Directory listing |
| Backend Status | Exists but NOT integrated in frontend; no API calls | supabase.ts |

### Cryptography / Security
| Item | Detail | Source |
|---|---|---|
| Hash Library | js-sha256 1.0.0 | package.json |
| Hash Usage | 6-digit codes from SHA-256 truncated to 12 hex chars mod 10^6 | hash.ts, hubService.ts |
| Hash Scope | Handover codes (lot) and shipment manifest codes | hash.ts, hubService.ts |

---

## Database Schema (IndexedDB via Dexie v3)

### Table: lots
| Field | Type | Notes |
|---|---|---|
| id | string (PK) | crypto.randomUUID() |
| material | string | Circuit Boards, Copper Cables, Mobile Phones |
| weight | string | Original estimated weight (never overwritten) |
| estimate | number | Estimated value (weight x rate) |
| condition | LotCondition? | Working/Intact, Mixed Scrap, Damaged/Dismantled |
| photo | string? | Compressed base64 JPEG (Canvas-compressed, ~30-80 KB) |
| collectorId | string? | Indexed |
| collectorName | string? | |
| hubId | string? | Indexed |
| actualWeight | number? | Scale weight at hub (preserves original weight) |
| agreedRate | number? | ₹/kg |
| grossAmount | number? | actualWeight x agreedRate |
| deductions | number? | Quality/moisture deductions |
| deductionReason | string? | |
| purchaseAmount | number? | Final net payout |
| rejectionReason | string? | |
| shipmentId | string? | Indexed |
| status | LotStatus | 12-state finite state machine |
| timestamp | number | Unix ms |

### LotStatus State Machine
PENDING → REQUESTED → ACCEPTED → RECEIVED → AWAITING_COLLECTOR_CONFIRMATION → PURCHASE_CONFIRMED → PAYMENT_PENDING → PAID → COMPLETED

Side exits: REJECTED, CANCELLED, HANDOVER_READY

### Table: recyclers
| id | name | rate | distance | verified |

### Table: profile
Single record (id='current-user') — collector's local identity

### Table: hubs
| id | name | ownerName | location | phone | verified | acceptedMaterials | isDemo |

### Table: hubPurchases
Immutable purchase record created at weigh-in. Preserved for audit independently of lot status.

### Table: payments
One payment per lot. Duplicate payment is blocked in hubService.ts (line 224-237).

### Table: shipments
Aggregated consignment. Links multiple lotIds. Contains handoverHash, status, quantities.

---

## Architecture Pattern

### Offline-First Local-First
1. All writes go directly to IndexedDB (Dexie)
2. UI updates instantly via useLiveQuery (reactive)
3. Background cloud sync fires only when navigator.onLine = true
4. No network required for any core workflow

### Role-Based UI (Not Server-Side Auth)
- Role is stored in React Context (useState)
- Switching role changes bottom navigation and redirects
- No authentication, no JWT, no server session
- Any user can switch to any role in the demo

### Data Flow
`
Collector (Browser/PWA) 
  -- IndexedDB (Dexie) -- 
  Hub Dashboard (same Browser/PWA)
  -- IndexedDB (Dexie) --
  Recycler Dashboard (same Browser/PWA)
  -- Background Supabase Sync (when online) --
  Cloud Ledger
`

All roles run in the same browser session sharing the same IndexedDB.

---

## Environment Variables Required
| Variable | Purpose |
|---|---|
| VITE_SUPABASE_URL | Supabase project URL |
| VITE_SUPABASE_ANON_KEY | Supabase anonymous public key |

Values are in .env (not committed to Git — must be manually set).
