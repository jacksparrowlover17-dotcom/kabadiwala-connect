# 05 — Dataset and AI/ML Analysis

## Exportable Datasets (Verified from DataExportPage.tsx)

### Dataset 1: Lots_Transactions_Dataset.csv
Source: db.lots.toArray()
| Column | Type | Source Field | Notes |
|---|---|---|---|
| lot_id | string | lot.id | UUID |
| collector_id | string | lot.collectorId | KAB-XXXX format |
| material | string | lot.material | 3 categories |
| approx_weight_kg | string | lot.weight | Original estimate (never overwritten) |
| actual_weight_kg | number? | lot.actualWeight | Set at hub weigh-in |
| purchase_amount_inr | number | lot.purchaseAmount or lot.estimate | Final payout |
| status | string | lot.status | One of 12 states |
| hub_id | string? | lot.hubId | |
| shipment_id | string? | lot.shipmentId | |
| timestamp | ISO string | lot.timestamp | |

Records: 45+ (45 synthetic seeded + user-created)
PII: collector_id is a demo ID, not real person identity

### Dataset 2: Hub_Purchases_Dataset.csv
Source: db.hubPurchases.toArray()
| Column | Type | Source Field |
|---|---|---|
| purchase_id | string | PUR-{lotId[:8]} |
| hub_id | string | hubId |
| lot_id | string | lotId |
| collector_id | string | collectorId |
| material | string | material |
| estimated_weight_kg | number | estimatedWeight |
| actual_weight_kg | number | actualWeight |
| agreed_rate_inr | number | agreedRate |
| deductions_inr | number | deductions |
| net_amount_inr | number | netAmount |
| status | string | status |
| weighed_at | ISO string | updatedAt |
| confirmed_at | ISO string? | collectorConfirmedAt |

### Dataset 3: Payments_Disbursement_Dataset.csv
Source: db.payments.toArray()
| Column | Type | Notes |
|---|---|---|
| payment_id | string | PAY-{UUID[:8]} |
| hub_id | string | |
| purchase_id | string | |
| lot_id | string | |
| collector_id | string | |
| amount_inr | number | |
| payment_mode | CASH or UPI | |
| reference_note | string? | |
| recorded_at | ISO string | |

### Dataset 4: Shipments_Form6_Dataset.csv
Source: db.shipments.toArray()
| Column | Type | Notes |
|---|---|---|
| shipment_id | string | SHP-2026-{UUID[:6]} |
| hub_id | string | |
| recycler_id | string | |
| recycler_name | string | |
| material | string | |
| lot_count | number | lotIds.length |
| planned_kg | number | |
| dispatched_kg | number? | |
| received_kg | number? | recyclerReceivedQuantity |
| discrepancy_kg | number? | |
| handover_hash | string | 6-digit SHA-256 code |
| status | string | |
| created_at | ISO string | |

### Dataset 5: Recyclers_Registry_Dataset.csv
Source: db.recyclers.toArray()
| Column | Type | Notes |
|---|---|---|
| recycler_id | string | R1-R5 |
| name | string | |
| offered_rate_per_kg | number | |
| distance_km | number | |
| is_verified | boolean | |

---

## Data Quality Assessment

| Issue | Severity | Detail |
|---|---|---|
| 45 synthetic lots in Dataset 1 | HIGH | Seeded in db.on('populate'); marked status=COMPLETED but labeled syn-N |
| Demo recyclers (R1-R5) are hardcoded | MEDIUM | Not real CPCB-registered entities |
| Demo hubs (HUB-BLR-01/02) are hardcoded | MEDIUM | Not real godown registrations |
| Collector ID is editable by user | MEDIUM | No server validation; easy to forge |
| Prices in PriceBoardPage are hardcoded | HIGH | Not from any market API; PCB=250, Cable=450, Phone=1200 |
| isSimulated: true on all payments | HIGH | All payment records have this flag; no real banking |
| Lots from synthetic seeding have no photo or condition | LOW | condition is set; photo is missing |

## Joining Datasets
- lots.id joins to hubPurchases.lotId (1:1)
- lots.id joins to payments.lotId (1:1, guarded by dedup)
- lots.shipmentId joins to shipments.id (N:1)
- lots.collectorId consistent across all tables
- recyclers.id joins to shipments.recyclerId (1:N)

---

## AI/ML Potential Analysis

### No AI/ML is currently implemented. The following are realistic future proposals.

### Proposal 1: Material Price Prediction
- **Goal:** Predict next-week price of Circuit Boards, Copper Cables, Mobile Phones per kg
- **Required Data:** Historical price data from commodity APIs (LME copper, etc.) + PriceBoardPage time-series (currently hardcoded - NO historical data)
- **Existing Data:** NONE suitable. PriceBoardPage prices are hardcoded constants.
- **Verdict:** Requires external data source. Cannot train on current app data alone.

### Proposal 2: Weight Estimation from Photo
- **Goal:** Estimate batch weight from lot photo using CV model
- **Required Data:** Labelled images with verified scale weights (lot.photo + lot.actualWeight pairs)
- **Existing Data:** Photos are stored as base64 JPEG in IndexedDB. After enough real usage, lot.photo + lot.actualWeight pairs could serve as training data.
- **Verdict:** POSSIBLE after real usage accumulates sufficient paired samples. No model exists yet.

### Proposal 3: Anomaly Detection - Weight Discrepancy Fraud
- **Goal:** Flag shipments where recycler-received weight deviates suspiciously from hub-dispatched weight
- **Required Data:** shipments.plannedQuantity, shipments.recyclerReceivedQuantity, discrepancyQuantity
- **Existing Data:** Shipments_Form6_Dataset.csv already has these columns. A simple statistical threshold (>5%) could be rule-based today.
- **Verdict:** Rule-based version is feasible immediately. ML version needs more records.

### Proposal 4: Collector Tier / Route Optimization
- **Goal:** Suggest optimal collection routes based on collector activity patterns
- **Required Data:** lot.collectorId, lot.timestamp, lot.location (NOT COLLECTED - missing geolocation)
- **Existing Data:** Timestamps exist but location is only a text field (Ward/Godown string)
- **Verdict:** Blocked by missing geolocation data. Not feasible from current schema.

### Proposal 5: Hub Demand Forecasting
- **Goal:** Predict incoming scrap volume to a hub per week
- **Required Data:** Historical lot timestamps, material types, weights per hub
- **Existing Data:** lots.timestamp + lots.hubId + lots.weight provides time-series. Needs real (non-synthetic) data.
- **Verdict:** POSSIBLE with real usage data. Synthetic seeded data has random timestamps; would pollute model.
