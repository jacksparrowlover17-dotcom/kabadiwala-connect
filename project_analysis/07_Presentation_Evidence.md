# 07 — Presentation Evidence

## Key Facts for Slides (Evidence-Based, Source Verified)

### Technology Facts
- React 19 + TypeScript + Vite 8 (cutting-edge 2026 stack)
- Dexie.js v4 for IndexedDB - reactive real-time UI without a server
- SHA-256 cryptographic hash for tamper-proof manifests (js-sha256)
- Capacitor 8 for Android APK generation from web codebase
- 3-version database migration (Dexie v1 -> v2 -> v3)
- 1958 modules bundled in 1.02 seconds build time

### Feature Facts (Verified Numbers)
- 12 lot status states in the finite state machine
- 7 tables in the IndexedDB schema
- 5 downloadable CSV datasets
- 6 languages supported in UI (Hindi, Marathi, Tamil, Telugu, Kannada, English)
- 3 material categories (Circuit Boards/PCB, Copper Cables, Mobile Phones)
- 3 lot condition types (Working/Intact, Mixed Scrap, Damaged/Dismantled)
- 45 synthetic transaction records pre-seeded for demo realism
- Image compression: 5-10 MB camera photo -> ~30-80 KB via HTML5 Canvas

### Architecture Facts
- Single codebase serves 4 roles (Collector, Hub, Recycler, Admin)
- Full workflow works 100% offline (no internet needed for any step)
- Background Supabase cloud sync when device comes online
- Zero-server demo: no backend server needed to run the demo

---

## Recommended Screenshots for PPT

### Slide 1 - Problem
URL: /safety or text slide (no screenshot needed)

### Slide 2 - Home Page (Collector View)
URL: /
Show: Profile card (Ramu Kabadiwala KAB-7842), Silver Collector badge, CO2 saved counter

### Slide 3 - New Load Page
URL: /new
Show: Camera capture UI, condition selector (3 options), weight input, estimate card

### Slide 4 - Lot Status Tracking
URL: /
Show: Active lot with status badge "Hub Reviewing" or "Action Required! Confirm Weight"

### Slide 5 - Hub Dashboard
URL: /hub (switch role to HUB)
Show: 4 metric cards (Godown Stock, Total Purchases, Payments Due, Paid Out)

### Slide 6 - Weigh-In Modal
URL: /hub
Show: Weigh-in modal with Gross/Deductions/Net breakdown

### Slide 7 - Form 6 Manifest (Shipment)
URL: /hub/shipments
Show: SHA-256 handover hash code printed on manifest

### Slide 8 - Recycler Gate
URL: /recycler (switch role to RECYCLER)
Show: Weighbridge verification form, discrepancy display

### Slide 9 - Handover Parchi (optional)
URL: /handover/{any-lot-id} (from home page, click Direct Handover on a PENDING lot)
Show: The parchi document with 6-digit hash code

### Slide 10 - Data Export
URL: /data (switch role to ADMIN)
Show: 4 counter cards, 5 CSV download buttons, EPR certificate button

---

## Demo Sequence (Live at Expo - 5 Minutes)

1. [30s] Open app, show home page. Point out: offline-first, multilingual, TTS
2. [45s] Create a new lot: select Circuit Boards, take photo (or select gallery image), Mixed Scrap, 5 kg -> Save
3. [45s] Back on home: click Send to Hub, select Bengaluru East Hub, Submit
4. [30s] Switch role to HUB. Go to /hub. Find the lot in Requests tab. Click Accept.
5. [60s] Click Weigh-In. Enter 4.8 kg (slight discrepancy), rate ₹260, no deductions. Confirm.
6. [30s] Switch back to COLLECTOR. Show "Action Required!" banner. Click Confirm.
7. [30s] Switch to HUB. Find lot in Unpaid tab. Click Record Payment -> CASH -> Record Paid.
8. [45s] Go to /hub/shipments. Select Circuit Boards. Select the lot. Generate Form 6 Shipment.
9. [30s] Click Dispatch Load. Switch to RECYCLER at /recycler. Find shipment. Click Weighbridge Verification. Enter received weight + 6-digit code. Confirm Intake.
10. [30s] Switch to ADMIN. Go to /data. Download Shipments_Form6_Dataset.csv. Generate EPR Certificate.

---

## Supporting Source Files
| Claim | Source File | Line(s) |
|---|---|---|
| SHA-256 hash implementation | src/lib/hash.ts | 8-20 |
| Shipment hash generation | src/lib/hubService.ts | 16-21 |
| Duplicate payment guard | src/lib/hubService.ts | 224-237 |
| Weight preservation | src/lib/hubService.ts | 156-157 |
| IndexedDB schema v3 | src/lib/db.ts | 199-207 |
| Image compression | src/pages/NewLotPage.tsx | 22-63 |
| 6 language support | src/pages/HomePage.tsx | 37-44 |
| Role context | src/App.tsx | 26-34 |
| Status machine states | src/lib/db.ts | 5-17 |
| CSV export logic | src/pages/DataExportPage.tsx | 24-67 |
| EPR certificate generator | src/pages/DataExportPage.tsx | 69-155 |
