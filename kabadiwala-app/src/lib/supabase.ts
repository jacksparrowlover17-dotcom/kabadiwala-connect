import { createClient } from '@supabase/supabase-js';

// These are placeholder keys for the Expo prototype.
// They will be replaced by actual Supabase Project keys when deployed.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder-project.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key';

export const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Syncs completed transactions from local IndexedDB (Dexie) to Supabase cloud.
 * This satisfies the "Offline-First" to "Traceability" requirement.
 */
export async function syncDataOnline(completedLots: any[]) {
  if (!navigator.onLine) {
    console.log('Currently offline, sync paused.');
    return;
  }

  try {
    for (const lot of completedLots) {
      // 1. Upsert lot to Supabase
      const { error: lotError } = await supabase
        .from('lots')
        .upsert({
          id: lot.id,
          material: lot.material,
          approx_weight: parseFloat(lot.weight),
          estimated_value: lot.estimate,
          status: lot.status,
        });

      if (lotError) throw lotError;
      console.log(`Synced Lot ${lot.id} successfully.`);
    }
  } catch (err) {
    console.error('Error syncing to Supabase:', err);
  }
}
