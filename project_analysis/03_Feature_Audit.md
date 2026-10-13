# 03 — Feature Audit (Role-by-Role)

## A. Informal Collector (Kabadiwala)
**Source file:** src/pages/HomePage.tsx, src/pages/NewLotPage.tsx, src/pages/HandoverPage.tsx, src/pages/SafetyPage.tsx, src/pages/PriceBoardPage.tsx

### Working Features (Verified in source code)
| Feature | Evidence |
|---|---|
| Create new lot (material + weight) | NewLotPage.tsx handleSave(), db.lots.add() |
| Photo capture (camera/gallery) | NewLotPage.tsx fileInputRef, capture="environment", compressImage() |
| Image compression (Canvas) | NewLotPage.tsx compressImage() - 800px max, 0.7 quality JPEG |
| Condition selector (3 states) | NewLotPage.tsx CONDITIONS array, stored as LotCondition |
| Real-time estimate calculation | NewLotPage.tsx: weight x material.rate |
| Persistent collector profile | HomePage.tsx + db.ts profile table, DEFAULT_PROFILE |
| Edit profile modal | HomePage.tsx isEditModalOpen state |
| Active lots tab | HomePage.tsx lotTab='ACTIVE', activeLots filter |
| History & Paid tab | HomePage.tsx lotTab='HISTORY', completedLots filter |
| Status badges (8 states) | HomePage.tsx renderStatusBadge() |
| Send lot to Hub selection modal | HomePage.tsx hubSelectLot state, requestLotPurchase() |
| Weight confirmation modal | HomePage.tsx confirmingLot state, confirmLotPurchaseByCollector() |
| View purchase receipt modal | HomePage.tsx receiptLotId, PurchaseReceiptModal |
| Gamification tier (Bronze/Silver/Gold) | HomePage.tsx: lifetimeWeightKg thresholds |
| CO2 saved calculation | HomePage.tsx: lifetimeWeightKg x 1.44 |
| Language toggle (6 languages) | HomePage.tsx LANGUAGES array, setLangIndex |
| TTS audio for earnings | HomePage.tsx speakText(), SpeechSynthesis API |
| Direct Handover parchi | HandoverPage.tsx: select recycler + generate 6-digit code |
| Print manifest | HandoverPage.tsx window.print() |
| Safety guide | SafetyPage.tsx: 3 tips with TTS |
| Prices board | PriceBoardPage.tsx: hardcoded 4 materials |

### Partially Working Features
| Feature | Limitation |
|---|---|
| QR code on Handover Parchi | SVG is a static decorative mock, not a real scannable QR code |
| GPS Route button | Shows alert() with distance, no real Maps integration |
| Call Recycler button | Uses tel:9876543210 (hardcoded number, not real recycler contact) |
| "Syncing with cloud ledger" | Message shown but Supabase sync is background-only, not confirmed |

### UI-Only / Mock Features
| Feature | Evidence |
|---|---|
| Price board data | PriceBoardPage.tsx: hardcoded PRICES array, not fetched from any API |
| Recycler registry data | db.ts populate: 5 demo recyclers seeded locally |
| CPCB registration numbers | HandoverPage.tsx: string template "CPCB/EW-REG/2024/0"+r.id |

### Missing Features
- No real user authentication (any user can edit any profile)
- No actual UPI/bank payment integration (payment is "recorded manually")
- No barcode/QR scan for recycler verification (type-in only)
- No push notifications when hub accepts/rejects a lot
- No multi-collector isolation (all data is shared in same browser IndexedDB)

---

## B. Collection Hub Operator
**Source file:** src/pages/HubDashboardPage.tsx, src/pages/ShipmentAggregationPage.tsx, src/lib/hubService.ts

### Working Features (Verified)
| Feature | Evidence |
|---|---|
| View incoming requests from collectors | HubDashboardPage.tsx requestedLots filter |
| Accept lot request | acceptLotRequest() in hubService.ts |
| Reject lot with reason | rejectLotRequest() in hubService.ts |
| Weigh-in modal (actual weight + rate + deductions) | receiveLotAtHub() creates HubPurchase record |
| Live financial breakdown in modal | HubDashboardPage.tsx calcGross, calcNet |
| Collector confirmation wait state | AWAITING_COLLECTOR_CONFIRMATION status |
| Record Cash/UPI payment | recordHubPayment() with duplicate payment guard |
| View payment receipt | handleViewReceipt() + PurchaseReceiptModal |
| Dashboard metrics (4 cards) | Godown Stock, Total Purchases, Payments Due, Paid Out |
| Status filter tabs (7 states) | HubDashboardPage.tsx statusFilter |
| Material filter dropdown | HubDashboardPage.tsx materialFilter |
| Photo preview of lots | HubDashboardPage.tsx lot.photo rendering |
| Switch between demo hubs | HubDashboardPage.tsx activeHubId select |
| Navigate to Shipment Aggregation | navigate('/hub/shipments') |
| Aggregate lots into shipment | createOutgoingShipment() with material compatibility + double-allocation checks |
| Select unassigned lots for shipment | ShipmentAggregationPage.tsx eligibleLots filter |
| Dispatch shipment | dispatchShipment() |
| Print Form-6 manifest modal | ShipmentAggregationPage.tsx printingShipment modal |
| SHA-256 handover hash displayed | shipment.handoverHash |

### Partially Working Features
| Feature | Limitation |
|---|---|
| Hub switcher | Only 2 demo hubs (HUB-BLR-01, HUB-BLR-02). Both share same IndexedDB. |
| Payment "Demonstration Record" | isSimulated: true in payment record. No banking API called. |

### Missing Features
- No actual multi-hub isolation (all hubs share one IndexedDB)
- No real scale/IoT integration for automatic weight entry
- No SMS/WhatsApp notification to collector on lot acceptance
- Hub operator login/authentication not implemented

---

## C. Formal Recycler (CPCB)
**Source file:** src/pages/RecyclerPage.tsx, src/lib/hubService.ts

### Working Features (Verified)
| Feature | Evidence |
|---|---|
| View incoming hub shipments | useLiveQuery on db.shipments |
| Weighbridge intake modal | handleVerifyShipment() -> receiveShipmentAtRecycler() |
| Scale discrepancy calculation | discrepancy = receivedWeight - dispatchedQty |
| Discrepancy note recording | discrepancyNote stored on shipment |
| 6-digit manifest code verification | handoverCode compared to shipment.handoverHash |
| Show verification status (3 states) | Ready / In Transit / Verified at Weighbridge |
| Direct collector handover tab | Legacy SHA-256 hash verify from lot fields |

### Limitations
| Limitation | Detail |
|---|---|
| Recycler identity is hardcoded | "Green Earth Recycling Facility, Peenya" - not dynamic |
| CPCB Verified badge is UI-only | No external CPCB API or registry is queried |
| Handover code check | Compares string equality; no signature/PKI |
| No multi-recycler support | All recyclers see the same shipments |

---

## D. Government / Administrator
**Source file:** src/pages/DataExportPage.tsx

### Working Features (Verified)
| Feature | Evidence |
|---|---|
| Platform metrics dashboard (4 counters) | useLiveQuery on all tables |
| Export Lots_Transactions_Dataset.csv | exportTransactions() reads db.lots |
| Export Hub_Purchases_Dataset.csv | exportHubPurchases() reads db.hubPurchases |
| Export Payments_Disbursement_Dataset.csv | exportPayments() reads db.payments |
| Export Shipments_Form6_Dataset.csv | exportShipments() reads db.shipments |
| Export Recyclers_Registry_Dataset.csv | exportRecyclers() reads db.recyclers |
| Generate EPR Certificate (HTML print) | generateEPRCertificate() opens new window with styled HTML |

### Limitations
| Limitation | Detail |
|---|---|
| EPR Certificate is a prototype | Generated in-browser HTML; not signed by CPCB, not official |
| "CPCB Compliant" stamp | UI decoration only; no regulatory body has validated this |
| No user management UI | No ability to add/remove hubs, collectors, or recyclers |
| No audit log | No record of who exported data or when |
| Admin nav shows Hub and Price Board | Admin role nav in App.tsx links to HubDashboard (shared with Hub role) |
