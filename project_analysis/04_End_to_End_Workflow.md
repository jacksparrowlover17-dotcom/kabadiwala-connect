# 04 — End-to-End Workflow

## Verified Workflow (Source-Code Traced)

### Step 1: Collector Creates a Lot
- **Page:** /new (NewLotPage.tsx)
- **Action:** Selects material, condition, enters weight, optionally takes photo
- **Persistence:** db.lots.add() with status='PENDING', collectorId from profile
- **Status after:** PENDING
- **Data survives refresh:** YES (IndexedDB)

### Step 2: Collector Sends Lot to Hub
- **Page:** / (HomePage.tsx)
- **Action:** Clicks "Send to Hub", selects hub from modal
- **Function:** requestLotPurchase() -> requestHubPurchase() in hubService.ts
- **Persistence:** db.lots.update(lotId, { hubId, status: 'REQUESTED' })
- **Status after:** REQUESTED

### Step 3: Hub Reviews Request
- **Page:** /hub (HubDashboardPage.tsx)
- **Action:** Hub operator sees lot in "Requests" tab
- **Accept:** acceptLotRequest() -> status='ACCEPTED'
- **Reject:** rejectLotRequest(reason) -> status='REJECTED'

### Step 4: Hub Weighs In and Prices the Lot
- **Page:** /hub
- **Action:** Hub clicks "Weigh-In & Record Actual Weight"
- **Function:** receiveLotAtHub(lotId, hubId, actualWeight, agreedRate, deductions)
- **Creates:** HubPurchase record (db.hubPurchases.put)
- **Updates:** lot.actualWeight, lot.purchaseAmount (preserves lot.weight - original estimate)
- **Status after:** AWAITING_COLLECTOR_CONFIRMATION

### Step 5: Collector Confirms Final Price
- **Page:** / (HomePage.tsx)
- **Action:** Collector sees "Action Required! Confirm Weight" banner, clicks "Review & Confirm"
- **Function:** confirmLotPurchaseByCollector() -> confirmPurchaseAgreement()
- **Updates:** HubPurchase.status='PURCHASE_CONFIRMED', lot.status='PURCHASE_CONFIRMED'
- **Status after:** PURCHASE_CONFIRMED

### Step 6: Hub Records Payment
- **Page:** /hub
- **Action:** Hub clicks "Record Payment (₹XXX)", selects CASH or UPI
- **Function:** recordHubPayment() with duplicate payment guard
- **Creates:** Payment record (db.payments.put, isSimulated: true)
- **Updates:** lot.status='PAID'
- **Status after:** PAID

### Step 7: Hub Aggregates Lots into Shipment
- **Page:** /hub/shipments (ShipmentAggregationPage.tsx)
- **Action:** Select material category, choose recycler, check eligible lots, click "Generate Form 6 Bulk Shipment"
- **Function:** createOutgoingShipment() in hubService.ts
- **Validation checks:**
  - Material compatibility (all lots must be same category)
  - Double-allocation (lot.shipmentId must be null)
  - Status validity (only RECEIVED/PAID/etc lots)
- **Creates:** Shipment record with handoverHash (SHA-256)
- **Links:** Each lot.shipmentId = shipment.id
- **Status after:** Shipment='READY', Lots linked

### Step 8: Hub Dispatches Shipment
- **Page:** /hub/shipments
- **Action:** Click "Dispatch Load"
- **Function:** dispatchShipment()
- **Updates:** shipment.status='DISPATCHED', dispatchedQuantity set
- **Status after:** DISPATCHED

### Step 9: Recycler Receives Shipment
- **Page:** /recycler (RecyclerPage.tsx)
- **Action:** Click "Weighbridge Verification & Gate Intake", enter received weight + 6-digit manifest code
- **Function:** receiveShipmentAtRecycler({shipmentId, receivedWeight, handoverCode})
- **Validation:** handoverCode must match shipment.handoverHash
- **Updates:** shipment.status='RECEIVED_BY_RECYCLER', recyclerReceivedQuantity, discrepancyQuantity
- **Status after:** RECEIVED_BY_RECYCLER

### Step 10: Administrator Exports Data
- **Page:** /data (DataExportPage.tsx)
- **Action:** Click download buttons for any of 5 CSVs, or generate EPR certificate
- **Source:** Live reads from IndexedDB tables

---

## Mermaid Workflow Diagram

`mermaid
flowchart TD
    A[Collector: Log Lot\nNewLotPage - status PENDING] --> B[Collector: Send to Hub\nstatus REQUESTED]
    B --> C{Hub: Review Request}
    C -->|Accept| D[status ACCEPTED]
    C -->|Reject| R[status REJECTED]
    D --> E[Hub: Weigh-In + Record\nactualWeight, agreedRate\nHubPurchase created\nstatus AWAITING_COLLECTOR_CONFIRMATION]
    E --> F[Collector: Confirm Price\nstatus PURCHASE_CONFIRMED]
    F --> G[Hub: Record Payment\nCASH or UPI\nPayment record created\nstatus PAID]
    G --> H[Hub: Aggregate Lots\nShipmentAggregationPage\nShipment created - READY]
    H --> I[Hub: Dispatch\nstatus DISPATCHED]
    I --> J[Recycler: Gate Weighbridge\n6-digit code verified\nDiscrepancy calculated\nstatus RECEIVED_BY_RECYCLER]
    J --> K[Admin: Export CSV\nEPR Certificate generated]

    style R fill:#ffaaaa
    style A fill:#d4f0d4
    style K fill:#d4e0ff
`

---

## Data Integrity Analysis

| Concern | Status | Detail |
|---|---|---|
| Lot weight preserved | SAFE | hubService.ts never overwrites lot.weight; actualWeight is a separate field |
| Duplicate payment guard | SAFE | recordHubPayment checks existing RECORDED/CONFIRMED payment, throws if exists |
| Double shipment allocation | SAFE | createOutgoingShipment checks lot.shipmentId before adding |
| Status machine enforcement | SAFE | Each hubService function checks current status before transition |
| Cross-role data isolation | NOT IMPLEMENTED | All roles share one IndexedDB; no per-user data separation |
| Offline survivability | YES | All data in IndexedDB; survives browser refresh and restart |
| Demo data mixing | YES (by design) | 45 synthetic lots are seeded on populate. They co-exist with real user lots. |
| Multi-device sync | NOT IMPLEMENTED | Data is local only; no real-time sync between devices |

---

## Route Corrections (Browser QA Finding)
- /handover is NOT a valid route; correct route is /handover/:id (requires lot ID param)
- /shipment is NOT a valid route; correct route is /hub/shipments
- /export is NOT a valid route; correct route is /data
