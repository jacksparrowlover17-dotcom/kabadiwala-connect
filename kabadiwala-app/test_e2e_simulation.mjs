// End-to-end full lifecycle simulation of Kabadiwala Connect Hub Aggregation
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

console.log('=== KABADIWALA CONNECT: END-TO-END WORKFLOW SIMULATION ===\n');

// Mock in-memory store mirroring Dexie schema
const db = {
  hubs: new Map(),
  recyclers: new Map(),
  lots: new Map(),
  hubPurchases: new Map(),
  payments: new Map(),
  shipments: new Map()
};

// Seed Hubs & Recyclers
db.hubs.set('HUB-BLR-NORTH', {
  id: 'HUB-BLR-NORTH',
  name: 'Hebbal Aggregation Hub',
  location: 'Hebbal Industrial Area, Bengaluru',
  verified: true
});

db.recyclers.set('REC-001', {
  id: 'REC-001',
  name: 'EcoE-Waste Recyclers India Pvt Ltd',
  cpcbRegistration: 'CPCB/EW-REG/2021/BLR/4589',
  verified: true
});

function sha256ShortCode(payload) {
  const hash = createHash('sha256').update(payload).digest('hex');
  const shortNum = parseInt(hash.substring(0, 12), 16);
  return (shortNum % 1000000).toString().padStart(6, '0');
}

// -------------------------------------------------------------
// STEP 1: Street Collector creates initial lot
// -------------------------------------------------------------
console.log('Step 1: Informal Collector logs lot offline');
const lot1 = {
  id: 'LOT-DEMO-001',
  collectorId: 'KAB-7842',
  collectorName: 'Ramu Kabadiwala',
  material: 'Circuit Boards (PCB)',
  weight: '50.00', // Collector estimated 50 kg
  estimate: 6000,
  condition: 'Mixed Scrap',
  status: 'PENDING',
  timestamp: Date.now()
};
db.lots.set(lot1.id, { ...lot1 });
console.log(`✓ Lot created: ID=${lot1.id}, Est. Weight=${lot1.weight}kg, Status=${lot1.status}`);

// -------------------------------------------------------------
// STEP 2: Collector requests Hub aggregation
// -------------------------------------------------------------
console.log('\nStep 2: Collector requests transfer to Hebbal Aggregation Hub');
assert.equal(db.lots.get(lot1.id).status, 'PENDING');
db.lots.get(lot1.id).hubId = 'HUB-BLR-NORTH';
db.lots.get(lot1.id).status = 'REQUESTED';
console.log(`✓ Lot submitted to Hub: Status=${db.lots.get(lot1.id).status}, HubId=${db.lots.get(lot1.id).hubId}`);

// -------------------------------------------------------------
// STEP 3: Hub operator weighs on calibrated scale & sets terms
// -------------------------------------------------------------
console.log('\nStep 3: Hub Weighbridge Intake & Rate Setting');
const actualWeight = 48.5; // Scale measured 48.5 kg
const agreedRate = 120.0; // ₹120/kg
const deductions = 100.0; // ₹100 deduction for dirt
const grossAmount = Math.round(actualWeight * agreedRate * 100) / 100; // ₹5820
const netAmount = grossAmount - deductions; // ₹5720

// Ensure original estimated weight is never overwritten!
const targetLot = db.lots.get(lot1.id);
assert.equal(targetLot.weight, '50.00', 'Original estimate must be preserved');

targetLot.actualWeight = actualWeight;
targetLot.agreedRate = agreedRate;
targetLot.grossAmount = grossAmount;
targetLot.deductions = deductions;
targetLot.deductionReason = 'Foreign packaging & debris';
targetLot.purchaseAmount = netAmount;
targetLot.status = 'AWAITING_COLLECTOR_CONFIRMATION';

const purchaseRecord = {
  id: 'PUR-001',
  lotId: targetLot.id,
  hubId: 'HUB-BLR-NORTH',
  collectorId: targetLot.collectorId,
  material: targetLot.material,
  estimatedWeight: parseFloat(targetLot.weight),
  actualWeight,
  agreedRate,
  grossAmount,
  deductions,
  netAmount,
  status: 'AWAITING_COLLECTOR_CONFIRMATION'
};
db.hubPurchases.set(purchaseRecord.id, purchaseRecord);
console.log(`✓ Scale weigh-in recorded: Original=${targetLot.weight}kg, Scale=${targetLot.actualWeight}kg, Net=₹${targetLot.purchaseAmount}`);
console.log(`✓ Status transitioned to ${targetLot.status}`);

// -------------------------------------------------------------
// STEP 4: Collector reviews and confirms agreement
// -------------------------------------------------------------
console.log('\nStep 4: Collector confirms purchase agreement');
targetLot.status = 'PURCHASE_CONFIRMED';
purchaseRecord.status = 'PURCHASE_CONFIRMED';
console.log(`✓ Purchase confirmed by collector: Status=${targetLot.status}`);

// -------------------------------------------------------------
// STEP 5: Hub disburses cash or UPI payment
// -------------------------------------------------------------
console.log('\nStep 5: Immediate Payment Disbursement');
// Ensure no duplicate payment
assert.equal(db.payments.has('PAY-001'), false);

const payment = {
  id: 'PAY-001',
  purchaseId: purchaseRecord.id,
  lotId: targetLot.id,
  collectorId: targetLot.collectorId,
  hubId: targetLot.hubId,
  amount: targetLot.purchaseAmount,
  method: 'UPI',
  referenceNote: 'UPI/UTR-9284719028',
  recordedAt: Date.now()
};
db.payments.set(payment.id, payment);
targetLot.status = 'PAID';
purchaseRecord.status = 'PAID';
console.log(`✓ Payment logged: Ref=${payment.referenceNote}, Amount=₹${payment.amount}, Status=${targetLot.status}`);

// -------------------------------------------------------------
// STEP 6: Hub aggregates multiple lots into Outgoing Bulk Shipment
// -------------------------------------------------------------
console.log('\nStep 6: Shipment Aggregation & Form 6 Manifest Generation');
// Create a second lot to demonstrate aggregation
const lot2 = {
  id: 'LOT-DEMO-002',
  collectorId: 'KAB-8100',
  material: 'Circuit Boards (PCB)',
  weight: '55.00',
  actualWeight: 52.0,
  purchaseAmount: 6240,
  status: 'PAID',
  hubId: 'HUB-BLR-NORTH'
};
db.lots.set(lot2.id, lot2);

const selectedLots = [targetLot, lot2];
// Check material compatibility
const isCompatible = selectedLots.every(l => l.material === selectedLots[0].material);
assert.equal(isCompatible, true, 'All bundled lots must be of the same material');

const totalDispatchedWeight = selectedLots.reduce((acc, l) => acc + (l.actualWeight || parseFloat(l.weight)), 0);
assert.equal(totalDispatchedWeight, 48.5 + 52.0); // 100.5 kg

const shipmentId = 'SHP-2026-FORM6-01';
const manifestHash = sha256ShortCode(`shipment=${shipmentId}|mat=${targetLot.material}|kg=${totalDispatchedWeight.toFixed(2)}`);

const shipment = {
  id: shipmentId,
  hubId: 'HUB-BLR-NORTH',
  recyclerId: 'REC-001',
  recyclerName: 'EcoE-Waste Recyclers India Pvt Ltd',
  material: targetLot.material,
  lotIds: selectedLots.map(l => l.id),
  plannedQuantity: totalDispatchedWeight,
  dispatchedQuantity: totalDispatchedWeight,
  handoverHash: manifestHash,
  status: 'DISPATCHED'
};
db.shipments.set(shipment.id, shipment);

// Link lots to shipment
selectedLots.forEach(l => {
  l.shipmentId = shipmentId;
});
console.log(`✓ Bulk Shipment Dispatched: ID=${shipment.id}, Total Weight=${shipment.dispatchedQuantity}kg, Lots Bundled=${shipment.lotIds.length}`);
console.log(`✓ Tamper-evident Manifest Hash: ${shipment.handoverHash}`);

// -------------------------------------------------------------
// STEP 7: Recycler Gate Weighbridge Intake & Verification
// -------------------------------------------------------------
console.log('\nStep 7: Recycler Gate Weighbridge Intake & Hash Check');
const incomingShipment = db.shipments.get(shipmentId);
assert.ok(incomingShipment);

// Recycler inputs the 6-digit handover code given by truck driver
const enteredCode = manifestHash;
assert.equal(enteredCode, incomingShipment.handoverHash, 'Handover hash must match');

// Recycler weighs on weighbridge scale
const recyclerMeasuredWeight = 100.1; // 0.4 kg moisture loss during transit
const discrepancy = Math.round((recyclerMeasuredWeight - incomingShipment.dispatchedQuantity) * 100) / 100;
const percentVariance = Math.abs((discrepancy / incomingShipment.dispatchedQuantity) * 100);

incomingShipment.recyclerReceivedQuantity = recyclerMeasuredWeight;
incomingShipment.discrepancyQuantity = discrepancy;
incomingShipment.discrepancyNote = percentVariance <= 2.0 
  ? `Acceptable transit loss: ${discrepancy} kg (${percentVariance.toFixed(2)}%)`
  : `CRITICAL DISCREPANCY: ${discrepancy} kg`;
incomingShipment.status = 'RECEIVED_BY_RECYCLER';

console.log(`✓ Recycler Scale Verification Complete: Dispatched=${incomingShipment.dispatchedQuantity}kg, Received=${recyclerMeasuredWeight}kg`);
console.log(`✓ Discrepancy Recorded: ${discrepancy}kg (${incomingShipment.discrepancyNote})`);
console.log(`✓ Shipment Status Updated to: ${incomingShipment.status}`);

console.log('\n======================================================');
console.log('E2E SIMULATION VERIFIED: COMPLETE TRACEABILITY ACHIEVED!');
console.log('======================================================\n');
