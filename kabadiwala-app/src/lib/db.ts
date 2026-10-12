import Dexie, { type EntityTable } from 'dexie';

export type LotCondition = 'Working / Intact' | 'Mixed Scrap' | 'Damaged / Dismantled';

export type LotStatus =
  | 'PENDING'
  | 'REQUESTED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'RECEIVED'
  | 'AWAITING_COLLECTOR_CONFIRMATION'
  | 'PURCHASE_CONFIRMED'
  | 'PAYMENT_PENDING'
  | 'PAID'
  | 'HANDOVER_READY'
  | 'COMPLETED'
  | 'CANCELLED';

export interface Lot {
  id: string;
  material: string;
  weight: string; // Original estimated weight
  estimate: number; // Original estimated value
  condition?: LotCondition;
  photo?: string; // Compressed base64 data URL
  collectorId?: string;
  collectorName?: string;
  hubId?: string;
  actualWeight?: number; // Actual weight measured at hub weigh-in (never overwrites weight)
  agreedRate?: number; // Agreed rate per kg
  grossAmount?: number;
  deductions?: number;
  deductionReason?: string;
  purchaseAmount?: number; // Final calculated purchase amount
  rejectionReason?: string;
  shipmentId?: string; // If allocated to an outgoing shipment
  status: LotStatus;
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

export interface Hub {
  id: string;
  name: string;
  ownerName: string;
  location: string;
  phone: string;
  verified: boolean;
  acceptedMaterials: string[];
  isDemo: boolean;
}

export type PurchaseStatus =
  | 'AWAITING_WEIGHT'
  | 'AWAITING_COLLECTOR_CONFIRMATION'
  | 'PURCHASE_CONFIRMED'
  | 'PAYMENT_PENDING'
  | 'PAID'
  | 'REJECTED'
  | 'CANCELLED';

export interface HubPurchase {
  id: string;
  lotId: string;
  collectorId: string;
  collectorName: string;
  hubId: string;
  hubName: string;
  material: string;
  estimatedWeight: number;
  actualWeight: number;
  agreedRate: number;
  grossAmount: number;
  deductions: number;
  deductionReason?: string;
  netAmount: number;
  status: PurchaseStatus;
  collectorConfirmedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export type PaymentMethod = 'CASH' | 'UPI';
export type PaymentStatus = 'PENDING' | 'RECORDED' | 'CONFIRMED' | 'FAILED' | 'CANCELLED';

export interface Payment {
  id: string;
  purchaseId: string;
  lotId: string;
  collectorId: string;
  hubId: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  referenceNote?: string;
  recordedBy: string;
  recordedAt: number;
  confirmedAt?: number;
  isSimulated: boolean;
}

export type ShipmentStatus = 'DRAFT' | 'READY' | 'DISPATCHED' | 'RECEIVED_BY_RECYCLER' | 'COMPLETED' | 'CANCELLED';

export interface Shipment {
  id: string;
  hubId: string;
  hubName: string;
  recyclerId: string;
  recyclerName: string;
  material: string;
  lotIds: string[];
  plannedQuantity: number; // kg
  dispatchedQuantity?: number; // kg
  recyclerReceivedQuantity?: number; // kg
  discrepancyQuantity?: number; // kg (recyclerReceived - dispatched)
  discrepancyNote?: string;
  handoverHash?: string;
  status: ShipmentStatus;
  dispatchTimestamp?: number;
  receivedTimestamp?: number;
  createdAt: number;
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

export const DEMO_HUBS: Hub[] = [
  {
    id: 'HUB-BLR-01',
    name: 'Bengaluru East Scrap & E-Waste Godown',
    ownerName: 'Anil Kumar (Scrap Shop Owner)',
    location: 'Ward 54, K.R. Puram Industrial Cross, Bengaluru',
    phone: '+91 98451 22334',
    verified: true,
    acceptedMaterials: ['Circuit Boards (PCB)', 'Copper Cables', 'Mobile Phones'],
    isDemo: true,
  },
  {
    id: 'HUB-BLR-02',
    name: 'South City Aggregation Hub',
    ownerName: 'Zubair Scrap Traders',
    location: 'Godown 8, BTM 2nd Stage, Bengaluru',
    phone: '+91 98452 33445',
    verified: true,
    acceptedMaterials: ['Circuit Boards (PCB)', 'Copper Cables', 'Mobile Phones'],
    isDemo: true,
  }
];

export const DEMO_ACTIVE_HUB_ID = 'HUB-BLR-01';

const db = new Dexie('KabadiwalaConnect') as Dexie & {
  lots: EntityTable<Lot, 'id'>;
  recyclers: EntityTable<Recycler, 'id'>;
  profile: EntityTable<CollectorProfile, 'id'>;
  hubs: EntityTable<Hub, 'id'>;
  hubPurchases: EntityTable<HubPurchase, 'id'>;
  payments: EntityTable<Payment, 'id'>;
  shipments: EntityTable<Shipment, 'id'>;
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

// Version 3: Hub aggregation, purchases, payments, and shipments
db.version(3).stores({
  lots: 'id, material, status, timestamp, collectorId, hubId, shipmentId',
  recyclers: 'id, name, verified',
  profile: 'id, collectorId',
  hubs: 'id, name, verified',
  hubPurchases: 'id, lotId, collectorId, hubId, status, createdAt',
  payments: 'id, purchaseId, lotId, collectorId, hubId, status, method, recordedAt',
  shipments: 'id, hubId, recyclerId, status, material, createdAt'
});

// Pre-fill demo recyclers, synthetic lots, default profile, and demo hubs
db.on('populate', async () => {
  await db.profile.put(DEFAULT_PROFILE);

  await db.hubs.bulkAdd(DEMO_HUBS);

  await db.recyclers.bulkAdd([
    { id: 'R1', name: 'Green Earth Recycling', rate: 250, distance: 2.1, verified: true },
    { id: 'R2', name: 'Urban E-Waste Solutions', rate: 280, distance: 4.5, verified: true },
    { id: 'R3', name: 'Local Scrap Dealer (Unverified)', rate: 290, distance: 0.5, verified: false },
    { id: 'R4', name: 'EcoTech Material Recovery', rate: 260, distance: 3.2, verified: true },
    { id: 'R5', name: 'Informal Dismantler', rate: 300, distance: 1.1, verified: false },
  ]);

  // Seed 45 synthetic completed transactions to make the data dashboard look active
  const syntheticLots: Lot[] = Array.from({ length: 45 }).map((_, i) => ({
    id: `syn-${i}`,
    material: i % 3 === 0 ? 'Mobile Phones' : (i % 2 === 0 ? 'Copper Cables' : 'Circuit Boards (PCB)'),
    weight: (Math.random() * 10 + 1).toFixed(1),
    estimate: Math.floor(Math.random() * 5000 + 500),
    condition: (i % 3 === 0 ? 'Working / Intact' : (i % 2 === 0 ? 'Mixed Scrap' : 'Damaged / Dismantled')) as LotCondition,
    collectorId: DEFAULT_PROFILE.collectorId,
    collectorName: DEFAULT_PROFILE.name,
    status: 'COMPLETED' as const,
    timestamp: Date.now() - Math.floor(Math.random() * 10000000000) // Spread over past days
  }));
  
  await db.lots.bulkAdd(syntheticLots);
});

/**
 * Ensures demo hubs and data are present even if DB was previously created at Version 1 or 2.
 */
export async function ensureDemoData(): Promise<void> {
  try {
    const hubCount = await db.hubs.count();
    if (hubCount === 0) {
      await db.hubs.bulkAdd(DEMO_HUBS);
    }
  } catch (e) {
    console.error('Error ensuring demo data:', e);
  }
}

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
