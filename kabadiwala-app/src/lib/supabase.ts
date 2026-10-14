import { createClient } from '@supabase/supabase-js';
import { db, type Lot, type HubPurchase, type Payment } from './db';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder-project.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key';

export const supabase = createClient(supabaseUrl, supabaseKey);

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Checks whether an ID string conforms to canonical UUID syntax.
 */
export function isUUID(val?: string | null): boolean {
  if (!val) return false;
  return UUID_REGEX.test(val);
}

/**
 * Checks whether legitimate cloud credentials are provided vs placeholder fallbacks.
 */
export function isCloudConfigured(): boolean {
  return Boolean(
    supabaseUrl && 
    !supabaseUrl.includes('placeholder') &&
    supabaseKey &&
    !supabaseKey.includes('placeholder')
  );
}

/**
 * Immediately pushes a single scrap lot to the Supabase cloud table.
 * Designed for real-time interaction between Collector and Hub across devices.
 * Offline-first: Fails silently if offline without disrupting local storage.
 */
export async function pushLotToCloud(lot: Lot): Promise<void> {
  if (!navigator.onLine || !isCloudConfigured()) return;
  if (!isUUID(lot.id)) return; // Synthetic/demo lots remain local

  try {
    const metaPayload = {
      cond: lot.condition || '',
      collectorId: lot.collectorId || 'KAB-7842',
      collectorName: lot.collectorName || 'Collector',
      agreedRate: lot.agreedRate ?? null,
      deductions: lot.deductions ?? 0,
      deductionReason: lot.deductionReason ?? null,
      rejectionReason: lot.rejectionReason ?? null,
      grossAmount: lot.grossAmount ?? null,
      actualWeight: lot.actualWeight ?? null,
      purchaseAmount: lot.purchaseAmount ?? null,
    };

    const row = {
      id: lot.id,
      collector_id: null, // Null to prevent foreign key errors with un-registered collector UUIDs
      material: lot.material,
      approx_weight: parseFloat(lot.weight) || 0,
      estimated_value: lot.estimate || 0,
      actual_weight: typeof lot.actualWeight === 'number' ? lot.actualWeight : null,
      purchase_amount: typeof lot.purchaseAmount === 'number' ? lot.purchaseAmount : null,
      status: lot.status,
      hub_id: lot.hubId || null,
      shipment_id: lot.shipmentId || null,
      condition: JSON.stringify(metaPayload),
      photo_url: (lot.photo && lot.photo.length < 500) ? lot.photo : null,
    };

    const { error } = await supabase.from('lots').upsert(row, { onConflict: 'id' });
    if (error) {
      console.warn('Silent cloud lot push warning:', error.message);
    } else {
      console.log(`Cloud synced lot ${lot.id.slice(0, 8)} (${lot.status})`);
    }
  } catch (err) {
    console.warn('Silent cloud lot push error:', err);
  }
}

/**
 * Fetches recent lots from Supabase and merges them into local Dexie.
 * Enables Hubs and Collectors on different browsers/devices to interact live.
 */
export async function pullLotsFromCloud(hubId?: string): Promise<Lot[]> {
  if (!navigator.onLine || !isCloudConfigured()) return [];

  try {
    const { data, error } = await supabase
      .from('lots')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error || !data) {
      console.warn('Error fetching lots from cloud:', error?.message);
      return [];
    }

    const rowsToProcess = hubId
      ? data.filter(row => !row.hub_id || row.hub_id === hubId || row.status === 'REQUESTED' || row.status === 'PENDING')
      : data;

    const mergedLots: Lot[] = [];
    for (const row of rowsToProcess) {
      if (!isUUID(row.id)) continue;

      let meta: any = {};
      if (row.condition) {
        try {
          if (row.condition.startsWith('{')) {
            meta = JSON.parse(row.condition);
          } else {
            meta = { cond: row.condition };
          }
        } catch {
          meta = { cond: row.condition };
        }
      }

      const existing = await db.lots.get(row.id);

      const lotRecord: Lot = {
        id: row.id,
        material: row.material,
        weight: row.approx_weight ? String(row.approx_weight) : (existing?.weight || '0'),
        estimate: row.estimated_value || (existing?.estimate || 0),
        condition: meta.cond || (existing?.condition || undefined),
        photo: existing?.photo || undefined,
        collectorId: meta.collectorId || existing?.collectorId || 'KAB-7842',
        collectorName: meta.collectorName || existing?.collectorName || 'Collector',
        hubId: row.hub_id || existing?.hubId || undefined,
        actualWeight: (typeof row.actual_weight === 'number') ? row.actual_weight : (meta.actualWeight !== undefined ? meta.actualWeight : existing?.actualWeight),
        agreedRate: meta.agreedRate !== undefined ? meta.agreedRate : existing?.agreedRate,
        grossAmount: meta.grossAmount !== undefined ? meta.grossAmount : existing?.grossAmount,
        deductions: meta.deductions !== undefined ? meta.deductions : existing?.deductions,
        deductionReason: meta.deductionReason || existing?.deductionReason,
        purchaseAmount: (typeof row.purchase_amount === 'number') ? row.purchase_amount : (meta.purchaseAmount !== undefined ? meta.purchaseAmount : existing?.purchaseAmount),
        rejectionReason: meta.rejectionReason || existing?.rejectionReason,
        shipmentId: row.shipment_id || existing?.shipmentId,
        status: (row.status as any) || existing?.status || 'PENDING',
        timestamp: existing?.timestamp || (row.created_at ? new Date(row.created_at).getTime() : Date.now()),
      };

      await db.lots.put(lotRecord);
      mergedLots.push(lotRecord);

      // If actual weight and agreed rate are set, ensure a local HubPurchase record exists as well
      if (row.actual_weight && meta.agreedRate) {
        const purchaseId = `PUR-${row.id.slice(0, 8).toUpperCase()}`;
        const existingPurchase = await db.hubPurchases.where('lotId').equals(row.id).first();
        if (!existingPurchase) {
          await db.hubPurchases.put({
            id: purchaseId,
            lotId: row.id,
            collectorId: lotRecord.collectorId || 'KAB-7842',
            collectorName: lotRecord.collectorName || 'Collector',
            hubId: row.hub_id || 'HUB-BLR-01',
            hubName: 'Bengaluru East Scrap & E-Waste Godown',
            material: row.material,
            estimatedWeight: parseFloat(lotRecord.weight) || 0,
            actualWeight: row.actual_weight,
            agreedRate: meta.agreedRate,
            grossAmount: meta.grossAmount || Math.round(row.actual_weight * meta.agreedRate),
            deductions: meta.deductions || 0,
            deductionReason: meta.deductionReason,
            netAmount: row.purchase_amount || Math.round((row.actual_weight * meta.agreedRate) - (meta.deductions || 0)),
            status: row.status === 'PAID' ? 'PAID' : (row.status === 'PURCHASE_CONFIRMED' ? 'PURCHASE_CONFIRMED' : 'AWAITING_COLLECTOR_CONFIRMATION'),
            createdAt: lotRecord.timestamp,
            updatedAt: Date.now(),
          });
        }
      }
    }

    return mergedLots;
  } catch (err) {
    console.warn('Silent cloud lot pull error:', err);
    return [];
  }
}

/**
 * Pushes a Hub purchase record to cloud.
 */
export async function pushHubPurchaseToCloud(hp: HubPurchase): Promise<void> {
  if (!navigator.onLine || !isCloudConfigured()) return;
  try {
    await supabase.from('hub_purchases').upsert({
      id: hp.id,
      hub_id: hp.hubId,
      lot_id: isUUID(hp.lotId) ? hp.lotId : null,
      collector_id: null,
      material: hp.material,
      estimated_weight: hp.estimatedWeight,
      actual_weight: hp.actualWeight || null,
      agreed_rate: hp.agreedRate || null,
      deductions: hp.deductions || 0,
      net_amount: hp.netAmount || null,
      status: hp.status,
      weighed_at: hp.updatedAt ? new Date(hp.updatedAt).toISOString() : null,
      confirmed_at: hp.collectorConfirmedAt ? new Date(hp.collectorConfirmedAt).toISOString() : null,
    }, { onConflict: 'id' });
  } catch (err) {
    console.warn('Silent cloud hub_purchase push error:', err);
  }
}

/**
 * Pushes a payment record to cloud.
 */
export async function pushPaymentToCloud(p: Payment): Promise<void> {
  if (!navigator.onLine || !isCloudConfigured()) return;
  try {
    await supabase.from('payments').upsert({
      id: p.id,
      hub_id: p.hubId,
      purchase_id: p.purchaseId,
      lot_id: isUUID(p.lotId) ? p.lotId : null,
      collector_id: null,
      amount: p.amount,
      mode: p.method,
      reference_id: p.referenceNote || null,
      paid_at: new Date(p.recordedAt).toISOString(),
    }, { onConflict: 'id' });
  } catch (err) {
    console.warn('Silent cloud payment push error:', err);
  }
}

/**
 * Syncs completed transactions, hub purchases, payments, and shipments
 * from local IndexedDB (Dexie) to Supabase cloud.
 * Offline-first design: silently handles offline state and network exceptions.
 */
export async function syncDataOnline(completedLots?: Lot[]) {
  if (!navigator.onLine || !isCloudConfigured()) {
    return;
  }

  try {
    // 1. Sync Lots
    const lotsToSync = completedLots || await db.lots.toArray();
    for (const lot of lotsToSync) {
      if (isUUID(lot.id)) {
        await pushLotToCloud(lot);
      }
    }

    // 2. Sync Hub Purchases
    const hubPurchases = await db.hubPurchases.toArray();
    for (const hp of hubPurchases) {
      await pushHubPurchaseToCloud(hp);
    }

    // 3. Sync Payments
    const payments = await db.payments.toArray();
    for (const p of payments) {
      await pushPaymentToCloud(p);
    }

    // 4. Sync Shipments
    const shipments = await db.shipments.toArray();
    for (const s of shipments) {
      await supabase
        .from('shipments')
        .upsert({
          id: s.id,
          hub_id: s.hubId,
          recycler_id: s.recyclerId,
          recycler_name: s.recyclerName,
          material: s.material,
          lot_ids: s.lotIds,
          planned_quantity: s.plannedQuantity,
          dispatched_quantity: s.dispatchedQuantity || null,
          recycler_received_quantity: s.recyclerReceivedQuantity || null,
          discrepancy_quantity: s.discrepancyQuantity || null,
          discrepancy_note: s.discrepancyNote || null,
          handover_hash: s.handoverHash,
          status: s.status,
          dispatched_at: s.dispatchTimestamp ? new Date(s.dispatchTimestamp).toISOString() : null,
          received_at: s.receivedTimestamp ? new Date(s.receivedTimestamp).toISOString() : null,
        }, { onConflict: 'id' });
    }

    console.log('Supabase cloud synchronization completed.');
  } catch (err) {
    console.warn('Supabase sync skipped (offline or network issue):', err);
  }
}
