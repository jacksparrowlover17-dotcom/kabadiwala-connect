# 09 — Project Summary for PPT

## Project: Kabadiwala Connect
## Subtitle: Bringing the Informal Collector into the Formal Recycling Chain
## Team: TECHCHALLENGERS1817

---

## The Problem (One Slide)
- India: 3.2 million MT e-waste/year, 3rd globally (CPCB 2022-23)
- 4-6 lakh informal kabadiwalas handle the majority, with ZERO digital paper trail
- No receipt, no price transparency, no regulatory compliance
- CPCB / Brand EPR compliance cannot be audited without a traceable chain

## The Solution (One Slide)
A single Progressive Web App + Android APK that gives every stakeholder a digital role:
- Collector: logs batches, photos, gets a tamper-proof digital parchi
- Hub Operator: weighs, prices, pays, aggregates for bulk shipment
- Recycler: verifies shipment at gate with 6-digit SHA-256 code
- Admin/Govt: downloads 5 audit CSV datasets + generates EPR certificate

## Technology (One Slide)
- Frontend: React 19 + TypeScript + Vite + Tailwind CSS v4
- Storage: Dexie.js (IndexedDB) - 100% offline-first, 7 tables
- Mobile: Capacitor 8 (Android APK from web codebase)
- Security: SHA-256 tamper-evident hash on every shipment manifest
- Cloud: Supabase (background sync when online)
- Languages: 6 Indian languages (Hindi, Marathi, Tamil, Telugu, Kannada, English)

## Workflow (One Slide - Mermaid or Timeline)
Collector logs lot -> Sends to Hub -> Hub weighs + prices -> Collector confirms
-> Hub records payment -> Hub aggregates lots into shipment
-> Recycler verifies at gate -> Admin exports datasets

## Verified Features (One Slide)
Collector role:
  - Photo capture with automatic compression (5 MB -> 60 KB)
  - 12-state lot tracking (PENDING to COMPLETED)
  - Multilingual TTS audio for earnings
  - Gamification tier (Bronze/Silver/Gold)

Hub role:
  - Weigh-in with deductions + transparent financial breakdown
  - Duplicate payment guard (technical safeguard)
  - Lot aggregation with material compatibility check
  - SHA-256 Form 6 manifest generation

Recycler role:
  - 6-digit manifest code verification
  - Weighbridge discrepancy logging

Admin role:
  - 5 downloadable audit CSV datasets
  - EPR compliance certificate generator (HTML print)

## Data Insight (One Slide)
5 joinable datasets covering the complete chain:
  Lots -> Hub Purchases -> Payments -> Shipments -> Recycler Registry
Future AI/ML potential:
  - Weight estimation from batch photo (pending real usage data)
  - Anomaly detection on weight discrepancies (rule-based feasible now)
  - Demand forecasting per hub per material category

## Limitations (One Slide - Honesty Builds Credibility)
- No server-side authentication (demo mode - one shared browser session)
- Price board uses hardcoded rates (not live market API)
- Payment recording is a manual log (no banking integration)
- EPR certificate is a prototype (not officially submitted to CPCB)
- QR code on parchi is a visual mock (not scannable)
- 45 synthetic records mixed with real user data in demo

## Impact Potential (One Slide)
- If 1000 kabadiwalas use this: ~2380 tonnes of e-waste formally tracked/year
- Each formal kg = documented EPR credit for brand responsibility
- Reduces health exposure from informal dismantling (safety guide feature)
- Creates first auditable digital trail from street to authorized recycler

## Future Roadmap (One Slide)
1. Real UPI payment integration (via Razorpay / PhonePe API)
2. Live market price feeds (LME copper, CPCB circulars)
3. Real scannable QR codes (using qrcode.js library)
4. Server-side authentication (Supabase Auth)
5. Multi-device real-time sync (Supabase Realtime)
6. AI weight estimation from batch photo
7. CPCB API integration for verified recycler registry
8. Multi-language full translation (beyond greetings)
