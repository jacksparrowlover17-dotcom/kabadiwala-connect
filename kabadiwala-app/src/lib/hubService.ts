import { 
  db, 
  type Lot, 
  type HubPurchase, 
  type Payment, 
  type Shipment, 
  type PaymentMethod,
  DEMO_HUBS,
  ensureDemoData
} from './db';
import { sha256 } from 'js-sha256';

/**
 * Computes canonical 64-character SHA-256 digest for an aggregated shipment manifest.
 */
export function generateFullShipmentSha256(shipmentId: string, material: string, weightKg: number): string {
  const payload = `id=${shipmentId.trim()}|kg=${weightKg.toFixed(2)}|mat=${material.trim().toLowerCase()}`;
  return sha256(payload);
}

/**
 * Generate a 6-digit tamper-evident human verification code for aggregated shipments.
 * Derived deterministically from the shipment's SHA-256 digest.
 */
export function generateShipmentHash(shipmentId: string, material: string, weightKg: number): string {
  const fullHash = generateFullShipmentSha256(shipmentId, material, weightKg);
  const shortHash = parseInt(fullHash.substring(0, 12), 16);
  return (shortHash % 1000000).toString().padStart(6, '0');
}

/**
 * Validates whether two materials are compatible for shipment grouping.
 * Strict standard: same material category.
 */
export function areMaterialsCompatible(mat1: string, mat2: string): boolean {
  return mat1.trim().toLowerCase() === mat2.trim().toLowerCase();
}

/**
 * Checks if a weight discrepancy is within allowable transit tolerance (default 1.0%).
 */
export function isDiscrepancyWithinTolerance(
  discrepancyKg: number,
  dispatchedKg: number,
  tolerancePercent: number = 1.0
): { isWithinTolerance: boolean; allowedKg: number; actualPercent: number } {
  const allowedKg = parseFloat(((dispatchedKg * tolerancePercent) / 100).toFixed(2));
  const actualPercent = dispatchedKg > 0 ? parseFloat(((Math.abs(discrepancyKg) / dispatchedKg) * 100).toFixed(2)) : 0;
  const isWithinTolerance = Math.abs(discrepancyKg) <= allowedKg + 0.005;
  return { isWithinTolerance, allowedKg, actualPercent };
}

/**
 * Phase 3: Collector requests a Hub to purchase their lot.
 */
export async function requestHubPurchase(lotId: string, hubId: string): Promise<Lot> {
  await ensureDemoData();
  const lot = await db.lots.get(lotId);
  if (!lot) throw new Error(`Lot not found: ${lotId}`);

  if (lot.status !== 'PENDING' && lot.status !== 'REQUESTED') {
    throw new Error(`Cannot submit lot in status "${lot.status}". Lot must be PENDING.`);
  }

  const hub = await db.hubs.get(hubId);
  if (!hub) throw new Error(`Collection Hub not found: ${hubId}`);

  await db.lots.update(lotId, {
    hubId,
    status: 'REQUESTED'
  });

  return (await db.lots.get(lotId))!;
}

/**
 * Phase 3: Hub accepts a collector request.
 */
export async function acceptLotRequest(lotId: string, hubId: string): Promise<Lot> {
  const lot = await db.lots.get(lotId);
  if (!lot) throw new Error(`Lot not found: ${lotId}`);
  if (lot.hubId && lot.hubId !== hubId) {
    throw new Error('This lot is not assigned to your hub.');
  }
  if (lot.status !== 'REQUESTED') {
    throw new Error(`Cannot accept request in status "${lot.status}". Must be REQUESTED.`);
  }

  await db.lots.update(lotId, {
    status: 'ACCEPTED',
    hubId
  });

  return (await db.lots.get(lotId))!;
}

/**
 * Phase 3: Hub rejects a collector request with clear reason.
 */
export async function rejectLotRequest(lotId: string, hubId: string, reason: string): Promise<Lot> {
  const lot = await db.lots.get(lotId);
  if (!lot) throw new Error(`Lot not found: ${lotId}`);
  if (lot.hubId && lot.hubId !== hubId) {
    throw new Error('This lot is not assigned to your hub.');
  }
  if (lot.status !== 'REQUESTED' && lot.status !== 'ACCEPTED') {
    throw new Error(`Cannot reject request in status "${lot.status}".`);
  }

  await db.lots.update(lotId, {
    status: 'REJECTED',
    rejectionReason: reason || 'Not accepted by hub'
  });

  return (await db.lots.get(lotId))!;
}

/**
 * Phase 3: Hub records actual received weight and enters agreed rate.
 * Critical Rule: Never silently overwrites the original estimated weight!
 */
export async function receiveLotAtHub(
  lotId: string, 
  hubId: string, 
  actualWeight: number, 
  agreedRate: number,
  deductions: number = 0,
  deductionReason?: string
): Promise<{ lot: Lot; purchase: HubPurchase }> {
  if (actualWeight <= 0 || isNaN(actualWeight)) {
    throw new Error('Actual weight must be a positive number greater than 0.');
  }
  if (agreedRate < 0 || isNaN(agreedRate)) {
    throw new Error('Agreed rate cannot be negative.');
  }

  const grossAmount = Math.round(actualWeight * agreedRate);
  if (deductions < 0) {
    throw new Error('Deductions cannot be negative.');
  }
  if (deductions > grossAmount) {
    throw new Error(`Deductions (₹${deductions}) cannot exceed gross purchase amount (₹${grossAmount}).`);
  }

  const netAmount = Math.round(grossAmount - deductions);

  const lot = await db.lots.get(lotId);
  if (!lot) throw new Error(`Lot not found: ${lotId}`);
  if (lot.status === 'REJECTED' || lot.status === 'CANCELLED') {
    throw new Error(`Cannot receive material for a ${lot.status} lot.`);
  }
  if (lot.status === 'PAID' || lot.status === 'COMPLETED') {
    throw new Error(`Lot ${lot.id.slice(0, 6)} has already been settled and completed.`);
  }
  if (lot.shipmentId) {
    throw new Error(`Lot ${lot.id.slice(0, 6)} is already allocated to active shipment ${lot.shipmentId}.`);
  }

  const hub = await db.hubs.get(hubId) || DEMO_HUBS[0];
  const purchaseId = `PUR-${lot.id.slice(0, 8).toUpperCase()}`;

  const purchaseRecord: HubPurchase = {
    id: purchaseId,
    lotId: lot.id,
    collectorId: lot.collectorId || 'KAB-7842',
    collectorName: lot.collectorName || 'Ramu Kabadiwala',
    hubId: hub.id,
    hubName: hub.name,
    material: lot.material,
    estimatedWeight: parseFloat(lot.weight) || 0,
    actualWeight,
    agreedRate,
    grossAmount,
    deductions,
    deductionReason,
    netAmount,
    status: 'AWAITING_COLLECTOR_CONFIRMATION',
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  await db.hubPurchases.put(purchaseRecord);

  // Update lot while strictly preserving original lot.weight!
  await db.lots.update(lotId, {
    hubId: hub.id,
    actualWeight,
    agreedRate,
    grossAmount,
    deductions,
    deductionReason,
    purchaseAmount: netAmount,
    status: 'AWAITING_COLLECTOR_CONFIRMATION'
  });

  const updatedLot = (await db.lots.get(lotId))!;
  return { lot: updatedLot, purchase: purchaseRecord };
}

/**
 * Phase 3: Collector reviews final calculated weight and confirms agreement.
 */
export async function confirmPurchaseAgreement(lotId: string, collectorId?: string): Promise<Lot> {
  const lot = await db.lots.get(lotId);
  if (!lot) throw new Error(`Lot not found: ${lotId}`);

  if (collectorId && lot.collectorId && lot.collectorId !== collectorId) {
    throw new Error(`Collector mismatch: Only collector ${lot.collectorId} can confirm this agreement.`);
  }

  if (lot.status !== 'AWAITING_COLLECTOR_CONFIRMATION' && lot.status !== 'RECEIVED') {
    throw new Error(`Lot is in status "${lot.status}", cannot confirm purchase.`);
  }

  const purchase = await db.hubPurchases.where('lotId').equals(lotId).first();
  if (purchase) {
    await db.hubPurchases.update(purchase.id, {
      status: 'PURCHASE_CONFIRMED',
      collectorConfirmedAt: Date.now(),
      updatedAt: Date.now()
    });
  }

  await db.lots.update(lotId, {
    status: 'PURCHASE_CONFIRMED'
  });

  return (await db.lots.get(lotId))!;
}

/**
 * Phase 4: Record manual CASH or UPI payment.
 * Validates no duplicate payments and prevents paying rejected/cancelled requests.
 */
export async function recordHubPayment(params: {
  purchaseId?: string;
  lotId: string;
  hubId: string;
  collectorId: string;
  amount: number;
  method: PaymentMethod;
  referenceNote?: string;
  recordedBy?: string;
}): Promise<Payment> {
  const lot = await db.lots.get(params.lotId);
  if (!lot) throw new Error(`Lot not found: ${params.lotId}`);

  if (lot.status === 'REJECTED' || lot.status === 'CANCELLED') {
    throw new Error(`Cannot record payment for a ${lot.status} purchase.`);
  }

  if (lot.status === 'PAID') {
    throw new Error('This purchase has already been recorded as PAID. Duplicate payment blocked.');
  }

  // Check if an existing confirmed payment exists
  const existingPayment = await db.payments
    .where('lotId')
    .equals(params.lotId)
    .filter(p => p.status === 'RECORDED' || p.status === 'CONFIRMED')
    .first();

  if (existingPayment) {
    throw new Error(`Payment already recorded for this lot (Payment ID: ${existingPayment.id}). Duplicate blocked.`);
  }

  if (params.amount <= 0 || isNaN(params.amount)) {
    throw new Error('Payment amount must be greater than zero.');
  }

  const paymentId = `PAY-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const purchaseId = params.purchaseId || `PUR-${lot.id.slice(0, 8).toUpperCase()}`;

  const paymentRecord: Payment = {
    id: paymentId,
    purchaseId,
    lotId: params.lotId,
    collectorId: params.collectorId,
    hubId: params.hubId,
    amount: params.amount,
    method: params.method,
    status: 'CONFIRMED',
    referenceNote: params.referenceNote || (params.method === 'UPI' ? 'Manual UPI Transfer Record' : 'Physical Cash Disbursal Record'),
    recordedBy: params.recordedBy || 'Hub Scrap Operator',
    recordedAt: Date.now(),
    confirmedAt: Date.now(),
    isSimulated: true
  };

  await db.payments.put(paymentRecord);

  // Update lot status to PAID
  await db.lots.update(params.lotId, {
    status: 'PAID',
    purchaseAmount: params.amount
  });

  // Update purchase record if exists
  const purchase = await db.hubPurchases.where('lotId').equals(params.lotId).first();
  if (purchase) {
    await db.hubPurchases.update(purchase.id, {
      status: 'PAID',
      updatedAt: Date.now()
    });
  }

  return paymentRecord;
}

/**
 * Phase 5: Create an outgoing aggregated shipment to an authorized recycler.
 * Executes atomically inside a Dexie transaction to prevent race conditions & double-allocation.
 */
export async function createOutgoingShipment(params: {
  hubId: string;
  recyclerId: string;
  material: string;
  lotIds: string[];
}): Promise<Shipment> {
  if (!params.lotIds || params.lotIds.length === 0) {
    throw new Error('A shipment requires at least one participating lot.');
  }

  return await db.transaction('rw', [db.lots, db.shipments, db.hubs, db.recyclers], async () => {
    const hub = await db.hubs.get(params.hubId) || DEMO_HUBS[0];
    const recycler = await db.recyclers.get(params.recyclerId);
    if (!recycler) throw new Error(`Intended Recycler not found: ${params.recyclerId}`);

    // Fetch all selected lots
    const lots = await db.lots.where('id').anyOf(params.lotIds).toArray();
    if (lots.length !== params.lotIds.length) {
      throw new Error('One or more selected lots could not be found.');
    }

    // 1. Material compatibility check
    for (const lot of lots) {
      if (!areMaterialsCompatible(lot.material, params.material)) {
        throw new Error(
          `Incompatible material detected: Lot ${lot.id.slice(0, 6)} is "${lot.material}" which cannot be aggregated into a "${params.material}" shipment.`
        );
      }
    }

    // 2. Double-allocation check
    for (const lot of lots) {
      if (lot.shipmentId) {
        throw new Error(`Lot ${lot.id.slice(0, 6)} is already allocated to active shipment ${lot.shipmentId}. Duplicate allocation blocked.`);
      }
    }

    // 3. Status validity check: Lots must be in hub possession
    const eligibleStatuses = ['RECEIVED', 'AWAITING_COLLECTOR_CONFIRMATION', 'PURCHASE_CONFIRMED', 'PAYMENT_PENDING', 'PAID'];
    for (const lot of lots) {
      if (!eligibleStatuses.includes(lot.status)) {
        throw new Error(`Lot ${lot.id.slice(0, 6)} is in status "${lot.status}". Only received or settled lots can be shipped.`);
      }
    }

    // Calculate planned quantity using actual weights (fallback to estimated if missing)
    const plannedQuantity = lots.reduce((acc, lot) => {
      const weight = typeof lot.actualWeight === 'number' && lot.actualWeight > 0 
        ? lot.actualWeight 
        : parseFloat(lot.weight) || 0;
      return acc + weight;
    }, 0);

    const roundedPlanned = parseFloat(plannedQuantity.toFixed(2));
    const shipmentId = `SHP-2026-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const handoverHash = generateShipmentHash(shipmentId, params.material, roundedPlanned);
    const fullSha256Hash = generateFullShipmentSha256(shipmentId, params.material, roundedPlanned);

    const shipment: Shipment = {
      id: shipmentId,
      hubId: hub.id,
      hubName: hub.name,
      recyclerId: recycler.id,
      recyclerName: recycler.name,
      material: params.material,
      lotIds: params.lotIds,
      plannedQuantity: roundedPlanned,
      status: 'READY',
      handoverHash,
      fullSha256Hash,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await db.shipments.put(shipment);

    // Atomically link lots to this shipment
    for (const lot of lots) {
      await db.lots.update(lot.id, {
        shipmentId: shipment.id
      });
    }

    return shipment;
  });
}

/**
 * Phase 5: Dispatch a shipment from the Hub
 */
export async function dispatchShipment(shipmentId: string, dispatchedQuantity?: number): Promise<Shipment> {
  const shipment = await db.shipments.get(shipmentId);
  if (!shipment) throw new Error(`Shipment not found: ${shipmentId}`);
  if (shipment.status !== 'READY' && shipment.status !== 'DRAFT') {
    throw new Error(`Cannot dispatch shipment in status "${shipment.status}".`);
  }

  const finalDispatchQty = dispatchedQuantity && dispatchedQuantity > 0 
    ? dispatchedQuantity 
    : shipment.plannedQuantity;

  await db.shipments.update(shipmentId, {
    status: 'DISPATCHED',
    dispatchedQuantity: finalDispatchQty,
    dispatchTimestamp: Date.now(),
    updatedAt: Date.now()
  });

  return (await db.shipments.get(shipmentId))!;
}

/**
 * Phase 5 & 8: Recycler receives aggregated shipment and logs weighbridge verification & discrepancies.
 * Supports overloaded arguments or options object.
 * Enforces idempotency (blocks duplicate intake) and transit tolerance checks.
 */
export async function receiveShipmentAtRecycler(
  arg1: string | { shipmentId: string; receivedWeight: number; handoverCode?: string; note?: string; tolerancePercent?: number },
  arg2?: number,
  arg3?: string
): Promise<Shipment> {
  let shipmentId: string;
  let recyclerReceivedQuantity: number;
  let inspectionNote: string | undefined;
  let handoverCode: string | undefined;
  let tolerancePercent: number = 1.0;

  if (typeof arg1 === 'object') {
    shipmentId = arg1.shipmentId;
    recyclerReceivedQuantity = arg1.receivedWeight;
    inspectionNote = arg1.note;
    handoverCode = arg1.handoverCode;
    if (arg1.tolerancePercent) tolerancePercent = arg1.tolerancePercent;
  } else {
    shipmentId = arg1;
    recyclerReceivedQuantity = arg2 as number;
    inspectionNote = arg3;
  }

  const shipment = await db.shipments.get(shipmentId);
  if (!shipment) throw new Error(`Shipment not found: ${shipmentId}`);

  // Idempotency: Prevent duplicate receipt confirmation
  if (shipment.status === 'RECEIVED_BY_RECYCLER' || shipment.status === 'COMPLETED') {
    throw new Error(`Shipment ${shipmentId} has already been received at the recycler gate. Duplicate intake blocked.`);
  }

  // Integrity Check: Compare against 6-digit manifest code or full SHA-256 hash
  if (handoverCode) {
    const trimmedCode = handoverCode.trim();
    const matches6Digit = shipment.handoverHash && trimmedCode === shipment.handoverHash;
    const matchesFullHash = shipment.fullSha256Hash && trimmedCode.toLowerCase() === shipment.fullSha256Hash.toLowerCase();
    if (!matches6Digit && !matchesFullHash) {
      throw new Error(`Manifest verification failed: Handover code "${handoverCode}" does not match expected code "${shipment.handoverHash}".`);
    }
  }

  if (recyclerReceivedQuantity < 0 || isNaN(recyclerReceivedQuantity)) {
    throw new Error('Received quantity must be a non-negative number.');
  }

  const dispatchedQty = shipment.dispatchedQuantity || shipment.plannedQuantity;
  const discrepancy = parseFloat((recyclerReceivedQuantity - dispatchedQty).toFixed(2));
  const { isWithinTolerance, actualPercent } = isDiscrepancyWithinTolerance(discrepancy, dispatchedQty, tolerancePercent);

  await db.transaction('rw', [db.shipments, db.lots], async () => {
    await db.shipments.update(shipmentId, {
      status: 'RECEIVED_BY_RECYCLER',
      recyclerReceivedQuantity,
      discrepancyQuantity: discrepancy,
      toleranceExceeded: !isWithinTolerance,
      discrepancyNote: inspectionNote || (
        discrepancy === 0 
          ? 'Exact weighbridge match (0.00% variance)' 
          : `Discrepancy: ${discrepancy > 0 ? '+' : ''}${discrepancy} kg (${actualPercent}% variance${!isWithinTolerance ? ' - EXCEEDS TOLERANCE' : ''})`
      ),
      receivedTimestamp: Date.now(),
      updatedAt: Date.now()
    });

    // Mark participating lots as COMPLETED in the formal recycling chain
    if (shipment.lotIds && shipment.lotIds.length > 0) {
      for (const lId of shipment.lotIds) {
        await db.lots.update(lId, { status: 'COMPLETED' });
      }
    }
  });

  return (await db.shipments.get(shipmentId))!;
}

// Convenient workflow aliases
export const requestLotPurchase = requestHubPurchase;
export const confirmLotPurchaseByCollector = confirmPurchaseAgreement;

