import Dexie, { type EntityTable } from 'dexie';

export type LotCondition = 'Working / Intact' | 'Mixed Scrap' | 'Damaged / Dismantled';

export interface Lot {
  id: string;
  material: string;
  weight: string;
  estimate: number;
  condition?: LotCondition;
  photo?: string; // Compressed base64 data URL
  collectorId?: string;
  status: 'PENDING' | 'HANDOVER_READY' | 'COMPLETED';
  timestamp: number;
}

export interface Recycler {
  id: string;
  name: string;
  rate: number;
  distance: number;
  verified: boolean;
}

export interface CollectorProfile {
  id: string; // 'current-user'
  name: string;
  collectorId: string;
  location: string;
  phone?: string;
  updatedAt: number;
}

export const DEFAULT_PROFILE: CollectorProfile = {
  id: 'current-user',
  name: 'Ramu Kabadiwala',
  collectorId: 'KAB-7842',
  location: 'Bangalore South (Ward 152 / Godown 4)',
  phone: '+91 98450 78421',
  updatedAt: Date.now(),
};

const db = new Dexie('KabadiwalaConnect') as Dexie & {
  lots: EntityTable<Lot, 'id'>;
  recyclers: EntityTable<Recycler, 'id'>;
  profile: EntityTable<CollectorProfile, 'id'>;
};

// Version 1: Original base schema
db.version(1).stores({
  lots: 'id, material, status, timestamp',
  recyclers: 'id, name, verified'
});

// Version 2: Schema upgrade adding persistent profile and indexed collectorId on lots
db.version(2).stores({
  lots: 'id, material, status, timestamp, collectorId',
  recyclers: 'id, name, verified',
  profile: 'id, collectorId'
});

// Pre-fill demo recyclers, synthetic lots, and default profile
db.on('populate', async () => {
  await db.profile.put(DEFAULT_PROFILE);

  await db.recyclers.bulkAdd([
    { id: 'R1', name: 'Green Earth Recycling', rate: 250, distance: 2.1, verified: true },
    { id: 'R2', name: 'Urban E-Waste Solutions', rate: 280, distance: 4.5, verified: true },
    { id: 'R3', name: 'Local Scrap Dealer (Unverified)', rate: 290, distance: 0.5, verified: false },
    { id: 'R4', name: 'EcoTech Material Recovery', rate: 260, distance: 3.2, verified: true },
    { id: 'R5', name: 'Informal Dismantler', rate: 300, distance: 1.1, verified: false },
  ]);

  // Seed 45 synthetic completed transactions to make the data dashboard look active
  const syntheticLots = Array.from({ length: 45 }).map((_, i) => ({
    id: `syn-${i}`,
    material: i % 3 === 0 ? 'Mobile Phones' : (i % 2 === 0 ? 'Copper Cables' : 'Circuit Boards (PCB)'),
    weight: (Math.random() * 10 + 1).toFixed(1),
    estimate: Math.floor(Math.random() * 5000 + 500),
    condition: (i % 3 === 0 ? 'Working / Intact' : (i % 2 === 0 ? 'Mixed Scrap' : 'Damaged / Dismantled')) as LotCondition,
    collectorId: DEFAULT_PROFILE.collectorId,
    status: 'COMPLETED' as const,
    timestamp: Date.now() - Math.floor(Math.random() * 10000000000) // Spread over past days
  }));
  
  await db.lots.bulkAdd(syntheticLots);
});

/**
 * Retrieves the current collector demo profile or initializes it with defaults.
 */
export async function getCollectorProfile(): Promise<CollectorProfile> {
  const existing = await db.profile.get('current-user');
  if (existing) return existing;
  await db.profile.put(DEFAULT_PROFILE);
  return DEFAULT_PROFILE;
}

/**
 * Persists updates to the local collector profile.
 */
export async function updateCollectorProfile(profileData: Partial<CollectorProfile>): Promise<CollectorProfile> {
  const current = await getCollectorProfile();
  const updated: CollectorProfile = {
    ...current,
    ...profileData,
    id: 'current-user',
    updatedAt: Date.now(),
  };
  await db.profile.put(updated);
  return updated;
}

export { db };
