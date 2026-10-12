// Standalone unit & logic verification test suite for Hub-Based Aggregation
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

console.log('--- RUNNING HUB WORKFLOW & AGGREGATION VALIDATION TESTS ---\n');

// 1. Hash Integrity Test
function generateShipmentHash(shipmentId, material, weightKg) {
  const payload = `shipment=${shipmentId}|mat=${material}|kg=${Number(weightKg).toFixed(2)}`;
  const hash = createHash('sha256').update(payload).digest('hex');
  const shortHash = parseInt(hash.substring(0, 12), 16);
  return (shortHash % 1000000).toString().padStart(6, '0');
}

console.log('Test 1: SHA-256 Manifest Hash Generation & Consistency');
const hash1 = generateShipmentHash('SHP-001', 'Circuit Boards (PCB)', 125.5);
const hash2 = generateShipmentHash('SHP-001', 'Circuit Boards (PCB)', 125.5);
assert.equal(hash1, hash2, 'Hash must be strictly deterministic');
assert.equal(hash1.length, 6, 'Hash must be a 6-digit code');
console.log(`✓ Passed: Deterministic 6-digit code generated: ${hash1}`);

console.log('\nTest 2: Tamper Evidence Detection');
const tamperedHash = generateShipmentHash('SHP-001', 'Circuit Boards (PCB)', 120.0);
assert.notEqual(hash1, tamperedHash, 'Tampered weight must yield a different code');
console.log(`✓ Passed: Weight difference correctly altered hash: ${hash1} !== ${tamperedHash}`);

// 2. Material Compatibility Test
function areMaterialsCompatible(mat1, mat2) {
  return mat1.trim().toLowerCase() === mat2.trim().toLowerCase();
}

console.log('\nTest 3: Batch Material Compatibility for Form 6 Aggregation');
assert.equal(areMaterialsCompatible('Circuit Boards (PCB)', 'Circuit Boards (PCB)'), true);
assert.equal(areMaterialsCompatible('Circuit Boards (PCB)', 'circuit boards (pcb)'), true);
assert.equal(areMaterialsCompatible('Circuit Boards (PCB)', 'Copper Cables'), false);
console.log('✓ Passed: Only homogeneous materials can be bundled into Form 6 shipments');

// 3. Financial Calculation & Deduction Logic
function calculatePurchaseSettlement(actualWeight, agreedRate, deductions = 0) {
  const grossAmount = Math.round(actualWeight * agreedRate * 100) / 100;
  const netAmount = Math.max(0, Math.round((grossAmount - deductions) * 100) / 100);
  return { grossAmount, netAmount };
}

console.log('\nTest 4: Hub Weighbridge Scale Settlement with Deductions');
const settlement = calculatePurchaseSettlement(42.5, 120, 150); // 42.5kg @ Rs 120/kg - Rs 150 dirt deduction
assert.equal(settlement.grossAmount, 5100.0);
assert.equal(settlement.netAmount, 4950.0);
console.log(`✓ Passed: Gross ₹${settlement.grossAmount}, Net ₹${settlement.netAmount}`);

// 4. Weighbridge Discrepancy & Tolerance Verification
function evaluateDiscrepancy(dispatchedWeight, receivedWeight) {
  const diff = Math.round((receivedWeight - dispatchedWeight) * 100) / 100;
  const percentage = (diff / dispatchedWeight) * 100;
  const withinTolerance = Math.abs(percentage) <= 2.0; // 2% CPCB transit tolerance
  return { diff, percentage: Math.round(percentage * 100) / 100, withinTolerance };
}

console.log('\nTest 5: Recycler Weighbridge Discrepancy & Tolerance');
const normalDiscrepancy = evaluateDiscrepancy(1000, 995); // 5 kg loss (0.5%)
assert.equal(normalDiscrepancy.diff, -5);
assert.equal(normalDiscrepancy.withinTolerance, true);
console.log(`✓ Passed: 5kg loss on 1000kg is within normal transit tolerance: diff=${normalDiscrepancy.diff}kg (${normalDiscrepancy.percentage}%)`);

const abnormalDiscrepancy = evaluateDiscrepancy(1000, 940); // 60 kg loss (6%)
assert.equal(abnormalDiscrepancy.diff, -60);
assert.equal(abnormalDiscrepancy.withinTolerance, false);
console.log(`✓ Passed: 60kg loss flagged as out of tolerance: diff=${abnormalDiscrepancy.diff}kg (${abnormalDiscrepancy.percentage}%)`);

console.log('\n=============================================');
console.log('ALL 5 UNIT VERIFICATION TESTS PASSED SUCCESSFULLY!');
console.log('=============================================\n');
