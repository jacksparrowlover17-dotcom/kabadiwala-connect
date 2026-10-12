import { createClient } from '@supabase/supabase-js';
import { db } from './db';

// These are placeholder keys for the Expo prototype.
// They will be replaced by actual Supabase Project keys when deployed.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder-project.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key';

export const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Syncs completed transactions, hub purchases, payments, and shipments
 * from local IndexedDB (Dexie) to Supabase cloud.
 * Offline-first design: silently handles offline state and network exceptions.
 */
export async function syncDataOnline(completedLots?: any[]) {
  if (!navigator.onLine) {
    console.log('Device is offline. Local IndexedDB storage active.');
    return;
  }

  try {
    // 1. Sync Lots
    const lotsToSync = completedLots || await db.lots.toArray();
    for (const lot of lotsToSync) {
      await supabase
        .from('lots')
        .upsert({
          id: lot.id,
          collector_id: lot.collectorId || 'KAB-7842',
          material: lot.material,
          approx_weight: parseFloat(lot.weight) || 0,
          estimated_value: lot.estimate || 0,
          actual_weight: lot.actualWeight || null,
          purchase_amount: lot.purchaseAmount || null,
          status: lot.status,
          hub_id: lot.hubId || null,
          shipment_id: lot.shipmentId || null,
          condition: lot.condition || null,
        }, { onConflict: 'id' });
    }

    // 2. Sync Hub Purchases
    const hubPurchases = await db.hubPurchases.toArray();
    for (const hp of hubPurchases) {
      await supabase
        .from('hub_purchases')
        .upsert({
          id: hp.id,
          hub_id: hp.hubId,
          lot_id: hp.lotId,
          collector_id: hp.collectorId,
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
    }

    // 3. Sync Payments
    const payments = await db.payments.toArray();
    for (const p of payments) {
      await supabase
        .from('payments')
        .upsert({
          id: p.id,
          hub_id: p.hubId,
          purchase_id: p.purchaseId,
          lot_id: p.lotId,
          collector_id: p.collectorId,
          amount: p.amount,
          mode: p.method,
          reference_id: p.referenceNote || null,
          paid_at: new Date(p.recordedAt).toISOString(),
        }, { onConflict: 'id' });
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
    // Non-blocking log for offline demo resilience
    console.warn('Supabase sync skipped (offline or placeholder credentials):', err);
  }
}
