# 01 — Project Overview
## Kabadiwala Connect: Bringing the Informal Collector into the Formal Recycling Chain
**Team:** TECHCHALLENGERS1817 | **Venue:** College Project Expo

---

## Problem Statement

India generates ~3.2 million metric tonnes of e-waste annually (CPCB 2022-23), making it the third-largest producer globally. The majority is handled by an estimated 4-6 lakh **informal collectors (kabadiwalas)** who operate entirely outside the regulatory framework.

**Core problems:**
1. Informal collectors receive no itemised receipt, price transparency, or proof of sale.
2. No digital audit trail links e-waste from a household through a collector to an authorized recycler.
3. Collection hub operators use paper ledgers only.
4. Formal recyclers cannot verify origin or confirm weight at gate.
5. Brand EPR compliance cannot be proven without a traceable supply chain.

## Target Users
| Role | Description |
|---|---|
| Informal Collector (Kabadiwala) | Street-level e-waste collector; low literacy, smartphone, multilingual |
| Collection Hub Operator | Scrap godown owner aggregating lots from multiple collectors |
| Formal Recycler (CPCB) | CPCB-authorized facility receiving bulk shipments |
| Government / Administrator | EPR auditor, regulator, or platform admin |

## Solution
A **Progressive Web App (PWA)** + **Android APK** (via Capacitor) that creates a digital, offline-first audit trail for every kg of e-waste from street collection to authorized recycling.

## Key Differentiators
| Feature | Kabadiwala Connect | EXIGO / Attero | Karo Sambhav |
|---|---|---|---|
| Informal collector app | CORE FOCUS | Consumer B2C only | Consumer B2C only |
| Offline-first (IndexedDB) | YES | Online required | Online required |
| Hub aggregation dashboard | YES | No | No |
| SHA-256 hash manifest | YES | No | No |
| CSV/EPR dataset export | YES | Backend only | Backend only |
| Multi-role single app | YES (role switcher) | Separate apps | Separate apps |

## Verified Project Objectives
1. [DONE] Log e-waste lots with material, weight, condition, photo
2. [DONE] Status tracking: PENDING to PAID to COMPLETED
3. [DONE] Hub weigh-in with deductions and collector confirmation
4. [DONE] Bulk shipment aggregation with SHA-256 tamper-evident hash
5. [DONE] Recycler gate weighbridge verification with discrepancy logging
6. [DONE] CSV export for 5 data tables
7. [DONE] EPR certificate generation (HTML print prototype)
8. [DONE] Multilingual greeting + TTS audio (6 languages)
9. [DONE] Offline-first with IndexedDB via Dexie.js
10. [PARTIAL] Cloud sync to Supabase (background only, triggered by navigator.onLine)
