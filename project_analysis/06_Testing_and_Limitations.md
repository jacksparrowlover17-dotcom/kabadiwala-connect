# 06 — Testing and Limitations

## Existing Tests

### Production Build (Verified Passing)
Command: npm run build (tsc -b && vite build)
Result: Clean build, 1958 modules transformed, dist/assets/index-*.js (736 KB), dist/assets/index-*.css (39 KB)
Lint: oxlint (no errors reported at last build)

### E2E Simulation Scripts (Source Present, Not Auto-Run)
- test_e2e_simulation.mjs (8.6 KB) - exists in project root
- test_hub_workflow.mjs (4.0 KB) - exists in project root
Status: These are Node.js script files. They require manual execution with 
ode test_e2e_simulation.mjs.
Note: These scripts have NOT been run and verified in this analysis session.

### No Unit Test Framework
No Jest, Vitest, or Playwright configuration found in package.json.
No __tests__ directory found in src/.

### Capacitor Build
Command: npx cap sync android
Result: Successfully synced dist/ to android/app/src/main/assets/public/
APK: Must be built via Android Studio (Build > Build APK(s))

---

## Reproducible Verification Steps

### Verify Database Schema
Open browser console at http://localhost:5173/
Run: indexedDB.open('KabadiwalaConnect')
Expected: Version 3 DB with tables: lots, recyclers, profile, hubs, hubPurchases, payments, shipments

### Verify Lot Status Machine
1. Go to /new, create a lot with any material and weight
2. On /, click "Send to Hub" -> select hub -> Submit Request
3. Switch role to HUB, go to /hub
4. Find lot in "Requests" tab -> click "Accept Lot"
5. Click "Weigh-In & Record Actual Weight", enter weight and rate, confirm
6. Switch back to COLLECTOR role
7. Find lot on home page showing "Action Required!" banner
8. Click "Review & Confirm" -> confirm
9. Switch to HUB, find lot in Unpaid tab -> click "Record Payment"
10. Lot should show PAID status on both Collector and Hub views

### Verify SHA-256 Hash
1. Create a shipment from /hub/shipments
2. Note the 6-digit handoverHash displayed on the shipment card
3. Switch to RECYCLER role at /recycler
4. Find the shipment in Hub Bulk Shipments tab
5. Click "Weighbridge Verification & Gate Intake"
6. Enter the 6-digit code from step 2
7. Submit - should succeed with "verified" message

### Verify CSV Export
1. Go to /data (switch to ADMIN role)
2. Click download button for Lots_Transactions_Dataset.csv
3. Open CSV: should have 45+ rows including synthetic lots
4. Verify columns: lot_id, collector_id, material, approx_weight_kg, etc.

---

## Known Issues and Limitations

### Critical
| Issue | Impact |
|---|---|
| No authentication | Any user can switch roles; no data isolation between users on same device |
| All data is local | Two people on different browsers/devices cannot share data |
| 45 synthetic lots pollute datasets | Dataset 1 CSV will contain syn-0 to syn-44 records mixed with real data |
| isSimulated: true on all payments | No real money movement; payment recording is a demonstration record |

### Moderate
| Issue | Impact |
|---|---|
| QR code is decorative SVG | Recycler cannot scan it with a phone camera |
| Price board is static | Prices do not reflect real market rates |
| CPCB numbers are generated strings | Not real regulatory IDs |
| EPR certificate is HTML page | Not signed, not officially recognized by any authority |
| Handover code not validated on Direct Handover | RecyclerPage Direct Handover tab computes hash locally, not from DB record |

### Minor
| Issue | Impact |
|---|---|
| /handover, /shipment, /export are 404 routes | Correct routes: /handover/:id, /hub/shipments, /data |
| Supabase sync not confirmed | Background sync fires but success/failure is not surfaced to user |
| Backend (kabadiwala-backend/) not connected | FastAPI server exists but no frontend API calls reference it |
| Large JS bundle (736 KB) | Single chunk; code splitting not implemented |

---

## Unverified Claims
| Claim | Verdict |
|---|---|
| "Real-time sync via Supabase" (shown in /data footer) | PARTIAL - background sync fires on navigator.onLine, but bi-directional real-time sync is not confirmed |
| "CPCB Verified" badge on RecyclerPage | UI-only decoration. No CPCB API queried. |
| "CPCB Certified Greenhouse Offset" on HandoverPage | Not certified. Calculation: weight x 2.8 kg CO2 (rough estimate). |
| "Form 6 E-Waste Manifest" on Handover Parchi | Prototype document format. Not officially submitted to CPCB. |
| Carbon Points gamification | Point values (weight x 10) are not backed by any carbon credit registry. |
