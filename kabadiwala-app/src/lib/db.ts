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

export type UserRole = 'COLLECTOR' | 'HUB' | 'RECYCLER' | 'ADMIN';

export type VerificationStatus =
  | 'pending_verification'
  | 'under_review'
  | 'changes_requested'
  | 'approved'
  | 'rejected'
  | 'suspended'
  | 'expired';

export interface UserAccount {
  id: string;
  email: string;
  phone?: string;
  fullName: string;
  role: UserRole;
  passwordHash?: string;
  isActive: boolean;
  createdAt: number;
}

export interface BusinessProfile {
  id: string;
  userId: string;
  role: 'HUB' | 'RECYCLER';
  businessName: string;
  authorizedContact: string;
  facilityAddress: string;
  district: string;
  operatingArea?: string;
  acceptedMaterials: string[];
  cpcbRegistrationNumber?: string;
  facilityScope?: string;
  status: VerificationStatus;
  createdAt: number;
  updatedAt: number;
}

export interface VerificationApplication {
  id: string;
  businessProfileId: string;
  userId: string;
  role: 'HUB' | 'RECYCLER';
  status: VerificationStatus;
  submittedAt: number;
  reviewedAt?: number;
  reviewerId?: string;
  reviewDecision?: string;
  reviewNotes?: string;
  rejectionReason?: string;
  correctionRequests?: string;
  officialRegistryRef?: string;
  createdAt: number;
  updatedAt: number;
}

export interface VerificationDocument {
  id: string;
  applicationId: string;
  userId: string;
  documentType: string;
  documentName: string;
  filePath: string;
  issueDate?: string;
  expiryDate?: string;
  isValid: boolean;
  uploadedAt: number;
}

export interface AuditLogEvent {
  id: string;
  entityType: 'APPLICATION' | 'USER' | 'BUSINESS_PROFILE';
  entityId: string;
  action: string;
  performedBy: string;
  reason?: string;
  details?: Record<string, any>;
  createdAt: number;
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
  toleranceExceeded?: boolean;
  handoverHash?: string; // 6-digit manifest code
  fullSha256Hash?: string; // Full 64-char SHA-256 digest
  recordedBy?: string;
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

export type HandoverServiceType = 'DROP_OFF' | 'PICKUP';
export type PriceStateType = 'indicative' | 'requested' | 'quoted' | 'accepted' | 'expired' | 'revised';
export type HandoverStatus =
  | 'draft'
  | 'destination_selected'
  | 'quote_requested'
  | 'quoted'
  | 'accepted'
  | 'scheduled'
  | 'handed_over'
  | 'payment_recorded'
  | 'completed'
  | 'rejected'
  | 'cancelled'
  | 'expired';

export interface DestinationPartner {
  id: string;
  name: string;
  type: 'HUB' | 'RECYCLER';
  verificationStatus: VerificationStatus;
  verified: boolean;
  cpcbRegistrationNumber?: string;
  facilityScope?: string;
  address: string;
  district: string;
  pinCode?: string;
  latitude: number;
  longitude: number;
  contactPerson: string;
  phone: string;
  acceptedMaterials: string[];
  supportedServices: HandoverServiceType[];
  minQuantityKg: number;
  maxQuantityKg: number;
  ratesPerKg: Record<string, number>;
  pickupFee?: number;
  priceLastUpdated: number;
  operatingHours: string;
  completedTransactionsCount: number;
  reliabilityScore: number;
}

export interface HandoverRequest {
  id: string;
  lotId: string;
  collectorId: string;
  collectorName: string;
  collectorLocation: string;
  collectorPhone?: string;
  destinationId: string;
  destinationName: string;
  destinationType: 'HUB' | 'RECYCLER';
  material: string;
  estimatedWeight: number;
  actualWeight?: number;
  serviceType: HandoverServiceType;
  priceState: PriceStateType;
  offeredRatePerKg: number;
  pickupFee?: number;
  disclosedDeductions?: number;
  deductionReason?: string;
  estimatedNetAmount: number;
  finalActualAmount?: number;
  manifestCode?: string;
  status: HandoverStatus;
  scheduledDate?: string;
  quoteExpiresAt?: number;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface IndicativePrice {
  id: string;
  material: string;
  grade: string;
  minPrice: number;
  maxPrice: number;
  unit: string;
  location: string;
  sourceName: string;
  sourceDate: string;
  effectiveDate: string;
  expiryDate: string;
  status: 'published' | 'draft' | 'expired';
  isSample: boolean;
  createdBy: string;
  updatedBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface HubBuyingOffer {
  id: string;
  hubId: string;
  hubName: string;
  hubVerificationStatus: 'approved';
  material: string;
  grade: string;
  rate: number;
  unit: string;
  minQuantityKg: number;
  supportedServices: HandoverServiceType[];
  pickupFee?: number;
  applicableArea: string;
  validFrom: string;
  validTill: string;
  status: 'active' | 'withdrawn' | 'expired';
  termsNote?: string;
  createdAt: number;
  updatedAt: number;
}

export interface PricingTransactionSnapshot {
  id: string;
  lotId: string;
  offerId: string;
  indicativeReferenceId?: string;
  collectorId: string;
  collectorName: string;
  hubId: string;
  hubName: string;
  material: string;
  grade: string;
  offeredRate: number;
  acceptedRate: number;
  estimatedWeight: number;
  actualAcceptedWeight?: number;
  grossAmount?: number;
  disclosedDeductions: number;
  deductionReason?: string;
  pickupFee: number;
  finalPayableAmount?: number;
  serviceType: HandoverServiceType;
  manifestCode: string;
  status: 'OFFER_ACCEPTED' | 'pending_intake' | 'AWAITING_COLLECTOR_APPROVAL' | 'CONFIRMED' | 'SETTLED' | 'CANCELLED';
  collectorApproved: boolean;
  paymentStatus: 'PENDING' | 'PAID';
  paymentReference?: string;
  paidAt?: number;
  acceptedAt: number;
  completedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export const DEMO_INDICATIVE_PRICES: IndicativePrice[] = [
  {
    id: 'IND-PCB-01',
    material: 'Circuit Boards (PCB)',
    grade: 'High-Grade Telecom / Server Motherboards',
    minPrice: 240,
    maxPrice: 280,
    unit: 'kg',
    location: 'Bengaluru Urban & Rural',
    sourceName: 'CPCB E-Waste Market Bulletin Q4',
    sourceDate: '2026-10-01',
    effectiveDate: '2026-10-01',
    expiryDate: '2026-12-31',
    status: 'published',
    isSample: true,
    createdBy: 'CPCB State Admin Officer',
    updatedBy: 'CPCB State Admin Officer',
    createdAt: Date.now() - 86400000 * 12,
    updatedAt: Date.now() - 86400000 * 12,
  },
  {
    id: 'IND-CABLE-01',
    material: 'Copper Cables',
    grade: 'Heavy Gauge Stripped & Insulated (>60% Cu)',
    minPrice: 420,
    maxPrice: 470,
    unit: 'kg',
    location: 'Karnataka State Index',
    sourceName: 'MRAI Non-Ferrous Scrap Index',
    sourceDate: '2026-10-05',
    effectiveDate: '2026-10-05',
    expiryDate: '2026-11-30',
    status: 'published',
    isSample: true,
    createdBy: 'CPCB State Admin Officer',
    updatedBy: 'CPCB State Admin Officer',
    createdAt: Date.now() - 86400000 * 8,
    updatedAt: Date.now() - 86400000 * 8,
  },
  {
    id: 'IND-PHONE-01',
    material: 'Mobile Phones',
    grade: 'Complete Handsets with Battery & Boards',
    minPrice: 300,
    maxPrice: 360,
    unit: 'kg',
    location: 'Bengaluru Urban',
    sourceName: 'Formal Recyclers Association Benchmark',
    sourceDate: '2026-10-08',
    effectiveDate: '2026-10-08',
    expiryDate: '2026-11-15',
    status: 'published',
    isSample: true,
    createdBy: 'CPCB State Admin Officer',
    updatedBy: 'CPCB State Admin Officer',
    createdAt: Date.now() - 86400000 * 5,
    updatedAt: Date.now() - 86400000 * 5,
  },
  {
    id: 'IND-BAT-01',
    material: 'Lithium-ion Batteries',
    grade: 'Mobile & Laptop Grade Cells (Intact)',
    minPrice: 160,
    maxPrice: 200,
    unit: 'kg',
    location: 'Bengaluru Urban',
    sourceName: 'KSPCB Hazardous Waste Directorate',
    sourceDate: '2026-10-02',
    effectiveDate: '2026-10-02',
    expiryDate: '2026-11-30',
    status: 'published',
    isSample: true,
    createdBy: 'CPCB State Admin Officer',
    updatedBy: 'CPCB State Admin Officer',
    createdAt: Date.now() - 86400000 * 10,
    updatedAt: Date.now() - 86400000 * 10,
  }
];

export const DEMO_HUB_BUYING_OFFERS: HubBuyingOffer[] = [
  {
    id: 'OFFER-HUB-01',
    hubId: 'HUB-BLR-01',
    hubName: 'Bengaluru East Scrap & E-Waste Godown',
    hubVerificationStatus: 'approved',
    material: 'Circuit Boards (PCB)',
    grade: 'High-Grade Telecom / Server Motherboards',
    rate: 265,
    unit: 'kg',
    minQuantityKg: 10,
    supportedServices: ['DROP_OFF', 'PICKUP'],
    pickupFee: 50,
    applicableArea: 'Ward 54, K.R. Puram / East Sub-district',
    validFrom: '2026-10-01',
    validTill: '2026-11-30',
    status: 'active',
    termsNote: 'Digital weighbridge on site. Free moisture check. Deductions only for foreign casing plastic.',
    createdAt: Date.now() - 86400000 * 7,
    updatedAt: Date.now() - 86400000 * 7,
  },
  {
    id: 'OFFER-HUB-02',
    hubId: 'HUB-BLR-02',
    hubName: 'South City Aggregation Hub',
    hubVerificationStatus: 'approved',
    material: 'Circuit Boards (PCB)',
    grade: 'Mixed Electronic Scrap & Boards',
    rate: 250,
    unit: 'kg',
    minQuantityKg: 5,
    supportedServices: ['DROP_OFF'],
    pickupFee: 0,
    applicableArea: 'BTM Layout, Jayanagar & South Wards',
    validFrom: '2026-10-05',
    validTill: '2026-11-25',
    status: 'active',
    termsNote: 'Direct godown drop-off only. Instant UPI payment disbursement upon scale confirmation.',
    createdAt: Date.now() - 86400000 * 5,
    updatedAt: Date.now() - 86400000 * 5,
  },
  {
    id: 'OFFER-HUB-03',
    hubId: 'HUB-BLR-01',
    hubName: 'Bengaluru East Scrap & E-Waste Godown',
    hubVerificationStatus: 'approved',
    material: 'Copper Cables',
    grade: 'Heavy Gauge Stripped & Insulated (>60% Cu)',
    rate: 445,
    unit: 'kg',
    minQuantityKg: 15,
    supportedServices: ['DROP_OFF', 'PICKUP'],
    pickupFee: 50,
    applicableArea: 'East Bengaluru Industrial Cross',
    validFrom: '2026-10-08',
    validTill: '2026-12-01',
    status: 'active',
    termsNote: 'Immediate electronic payout. Minimum 15 kg batch.',
    createdAt: Date.now() - 86400000 * 3,
    updatedAt: Date.now() - 86400000 * 3,
  }
];

export const DEMO_DESTINATION_PARTNERS: DestinationPartner[] = [
  {
    id: 'HUB-BLR-01',
    name: 'Bengaluru East Scrap & E-Waste Godown',
    type: 'HUB',
    verificationStatus: 'approved',
    verified: true,
    cpcbRegistrationNumber: 'CPCB-HUB-KA-2024-0091',
    facilityScope: 'Secondary Storage & Sorting Facility (<100 MT)',
    address: 'Ward 54, K.R. Puram Industrial Cross, Bengaluru',
    district: 'Bengaluru Urban',
    pinCode: '560036',
    latitude: 13.0035,
    longitude: 77.6961,
    contactPerson: 'Anil Kumar',
    phone: '+91 98451 22334',
    acceptedMaterials: ['Circuit Boards (PCB)', 'Copper Cables', 'Mobile Phones'],
    supportedServices: ['DROP_OFF', 'PICKUP'],
    minQuantityKg: 10,
    maxQuantityKg: 1500,
    ratesPerKg: {
      'Circuit Boards (PCB)': 250,
      'Copper Cables': 420,
      'Mobile Phones': 310,
    },
    pickupFee: 50,
    priceLastUpdated: Date.now() - 86400000 * 2,
    operatingHours: '08:00 AM - 07:00 PM (Mon-Sat)',
    completedTransactionsCount: 148,
    reliabilityScore: 98,
  },
  {
    id: 'HUB-BLR-02',
    name: 'South City Aggregation Hub',
    type: 'HUB',
    verificationStatus: 'approved',
    verified: true,
    cpcbRegistrationNumber: 'CPCB-HUB-KA-2024-0104',
    facilityScope: 'Collection Center & Segregation Shed',
    address: 'Godown 8, BTM 2nd Stage, Bengaluru',
    district: 'Bengaluru Urban',
    pinCode: '560076',
    latitude: 12.9165,
    longitude: 77.6101,
    contactPerson: 'Zubair Scrap Traders',
    phone: '+91 98452 33445',
    acceptedMaterials: ['Circuit Boards (PCB)', 'Copper Cables', 'Mobile Phones'],
    supportedServices: ['DROP_OFF'],
    minQuantityKg: 5,
    maxQuantityKg: 800,
    ratesPerKg: {
      'Circuit Boards (PCB)': 245,
      'Copper Cables': 415,
      'Mobile Phones': 305,
    },
    pickupFee: 0,
    priceLastUpdated: Date.now() - 86400000 * 1,
    operatingHours: '09:00 AM - 08:00 PM (Daily)',
    completedTransactionsCount: 92,
    reliabilityScore: 94,
  },
  {
    id: 'R1',
    name: 'Green Earth Recycling',
    type: 'RECYCLER',
    verificationStatus: 'approved',
    verified: true,
    cpcbRegistrationNumber: 'CPCB/EW-REG/2024/01',
    facilityScope: 'Formal Dismantling & Material Recovery Plant (500 MT/year)',
    address: 'Plot 42, Peenya Industrial Area, Phase II, Bengaluru',
    district: 'Bengaluru Urban',
    pinCode: '560058',
    latitude: 13.0285,
    longitude: 77.5186,
    contactPerson: 'Dr. Ramesh (Authorized Technical Head)',
    phone: '+91 98455 11223',
    acceptedMaterials: ['Circuit Boards (PCB)', 'Copper Cables', 'Mobile Phones'],
    supportedServices: ['DROP_OFF', 'PICKUP'],
    minQuantityKg: 50,
    maxQuantityKg: 10000,
    ratesPerKg: {
      'Circuit Boards (PCB)': 280,
      'Copper Cables': 460,
      'Mobile Phones': 350,
    },
    pickupFee: 150,
    priceLastUpdated: Date.now() - 86400000 * 3,
    operatingHours: '09:30 AM - 06:00 PM (Mon-Fri)',
    completedTransactionsCount: 310,
    reliabilityScore: 99,
  },
  {
    id: 'R2',
    name: 'Urban E-Waste Solutions',
    type: 'RECYCLER',
    verificationStatus: 'approved',
    verified: true,
    cpcbRegistrationNumber: 'CPCB/EW-REG/2024/44',
    facilityScope: 'Authorized Lithium & PCB Recovery Facility',
    address: 'KIADB Industrial Area, Doddaballapur, Bengaluru Rural',
    district: 'Bengaluru Rural',
    pinCode: '561203',
    latitude: 13.2982,
    longitude: 77.5401,
    contactPerson: 'Suresh Gowda',
    phone: '+91 98458 99887',
    acceptedMaterials: ['Circuit Boards (PCB)', 'Mobile Phones'],
    supportedServices: ['DROP_OFF'],
    minQuantityKg: 100,
    maxQuantityKg: 20000,
    ratesPerKg: {
      'Circuit Boards (PCB)': 290,
      'Mobile Phones': 360,
    },
    pickupFee: 0,
    priceLastUpdated: Date.now() - 86400000 * 5,
    operatingHours: '10:00 AM - 05:30 PM (Mon-Sat)',
    completedTransactionsCount: 185,
    reliabilityScore: 96,
  },
  {
    id: 'R3',
    name: 'Local Scrap Dealer (Unverified)',
    type: 'RECYCLER',
    verificationStatus: 'rejected',
    verified: false,
    cpcbRegistrationNumber: '',
    facilityScope: 'Informal sorting shed',
    address: 'Near Old Bus Stand, Kalasipalya',
    district: 'Bengaluru Urban',
    pinCode: '560002',
    latitude: 12.9612,
    longitude: 77.5789,
    contactPerson: 'Munna Bhai',
    phone: '+91 98459 00112',
    acceptedMaterials: ['Circuit Boards (PCB)'],
    supportedServices: ['DROP_OFF'],
    minQuantityKg: 1,
    maxQuantityKg: 100,
    ratesPerKg: {
      'Circuit Boards (PCB)': 300,
    },
    priceLastUpdated: Date.now() - 86400000 * 30,
    operatingHours: '10:00 AM - 08:00 PM',
    completedTransactionsCount: 12,
    reliabilityScore: 40,
  }
];

const db = new Dexie('KabadiwalaConnect') as Dexie & {
  lots: EntityTable<Lot, 'id'>;
  recyclers: EntityTable<Recycler, 'id'>;
  profile: EntityTable<CollectorProfile, 'id'>;
  hubs: EntityTable<Hub, 'id'>;
  hubPurchases: EntityTable<HubPurchase, 'id'>;
  payments: EntityTable<Payment, 'id'>;
  shipments: EntityTable<Shipment, 'id'>;
  users: EntityTable<UserAccount, 'id'>;
  businessProfiles: EntityTable<BusinessProfile, 'id'>;
  verificationApplications: EntityTable<VerificationApplication, 'id'>;
  verificationDocuments: EntityTable<VerificationDocument, 'id'>;
  auditLogs: EntityTable<AuditLogEvent, 'id'>;
  destinationPartners: EntityTable<DestinationPartner, 'id'>;
  handoverRequests: EntityTable<HandoverRequest, 'id'>;
  indicativePrices: EntityTable<IndicativePrice, 'id'>;
  hubOffers: EntityTable<HubBuyingOffer, 'id'>;
  pricingTransactions: EntityTable<PricingTransactionSnapshot, 'id'>;
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

// Version 4: Role-based access control, business profiles, and verification lifecycle
db.version(4).stores({
  lots: 'id, material, status, timestamp, collectorId, hubId, shipmentId',
  recyclers: 'id, name, verified',
  profile: 'id, collectorId',
  hubs: 'id, name, verified',
  hubPurchases: 'id, lotId, collectorId, hubId, status, createdAt',
  payments: 'id, purchaseId, lotId, collectorId, hubId, status, method, recordedAt',
  shipments: 'id, hubId, recyclerId, status, material, createdAt',
  users: 'id, email, role, isActive',
  businessProfiles: 'id, userId, role, status, district',
  verificationApplications: 'id, businessProfileId, userId, role, status, submittedAt',
  verificationDocuments: 'id, applicationId, userId, documentType',
  auditLogs: 'id, entityType, entityId, action, performedBy, createdAt'
});

// Version 5: Collector Destination Finder, Smart Matching and Handover Requests
db.version(5).stores({
  lots: 'id, material, status, timestamp, collectorId, hubId, shipmentId',
  recyclers: 'id, name, verified',
  profile: 'id, collectorId',
  hubs: 'id, name, verified',
  hubPurchases: 'id, lotId, collectorId, hubId, status, createdAt',
  payments: 'id, purchaseId, lotId, collectorId, hubId, status, method, recordedAt',
  shipments: 'id, hubId, recyclerId, status, material, createdAt',
  users: 'id, email, role, isActive',
  businessProfiles: 'id, userId, role, status, district',
  verificationApplications: 'id, businessProfileId, userId, role, status, submittedAt',
  verificationDocuments: 'id, applicationId, userId, documentType',
  auditLogs: 'id, entityType, entityId, action, performedBy, createdAt',
  destinationPartners: 'id, type, verificationStatus, district, verified',
  handoverRequests: 'id, lotId, collectorId, destinationId, status, createdAt'
});

// Version 6: Indicative market pricing, approved hub buying offers, and immutable transaction snapshots
db.version(6).stores({
  lots: 'id, material, status, timestamp, collectorId, hubId, shipmentId',
  recyclers: 'id, name, verified',
  profile: 'id, collectorId',
  hubs: 'id, name, verified',
  hubPurchases: 'id, lotId, collectorId, hubId, status, createdAt',
  payments: 'id, purchaseId, lotId, collectorId, hubId, status, method, recordedAt',
  shipments: 'id, hubId, recyclerId, status, material, createdAt',
  users: 'id, email, role, isActive',
  businessProfiles: 'id, userId, role, status, district',
  verificationApplications: 'id, businessProfileId, userId, role, status, submittedAt',
  verificationDocuments: 'id, applicationId, userId, documentType',
  auditLogs: 'id, entityType, entityId, action, performedBy, createdAt',
  destinationPartners: 'id, type, verificationStatus, district, verified',
  handoverRequests: 'id, lotId, collectorId, destinationId, status, createdAt',
  indicativePrices: 'id, material, grade, location, status, effectiveDate, expiryDate',
  hubOffers: 'id, hubId, material, grade, status, validFrom, validTill',
  pricingTransactions: 'id, lotId, offerId, collectorId, hubId, paymentStatus, createdAt'
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
 * Ensures demo hubs, users, and verification data are present even if DB was previously created.
 */
export async function ensureDemoData(): Promise<void> {
  try {
    const hubCount = await db.hubs.count();
    if (hubCount === 0) {
      await db.hubs.bulkAdd(DEMO_HUBS);
    }

    const userCount = await db.users.count();
    if (userCount === 0) {
      // 1. Seed Admin
      await db.users.put({
        id: 'admin-sys-001',
        email: 'admin@kabadiwala.in',
        phone: '+91 98000 00001',
        fullName: 'CPCB State Admin Officer',
        role: 'ADMIN',
        isActive: true,
        createdAt: Date.now() - 86400000 * 30,
      });

      // 2. Seed Approved Hub
      await db.users.put({
        id: 'hub-user-001',
        email: 'hub.east@kabadiwala.in',
        phone: '+91 98451 22334',
        fullName: 'Anil Kumar (Hub Operator)',
        role: 'HUB',
        isActive: true,
        createdAt: Date.now() - 86400000 * 20,
      });

      await db.businessProfiles.put({
        id: 'HUB-BLR-01',
        userId: 'hub-user-001',
        role: 'HUB',
        businessName: 'Bengaluru East Scrap & E-Waste Godown',
        authorizedContact: 'Anil Kumar',
        facilityAddress: 'Ward 54, K.R. Puram Industrial Cross, Bengaluru',
        district: 'Bengaluru Urban',
        operatingArea: 'East Bengaluru Sub-district',
        acceptedMaterials: ['Circuit Boards (PCB)', 'Copper Cables', 'Mobile Phones'],
        cpcbRegistrationNumber: 'CPCB-HUB-KA-2024-0091',
        facilityScope: 'Secondary Storage & Sorting Facility (<100 MT)',
        status: 'approved',
        createdAt: Date.now() - 86400000 * 20,
        updatedAt: Date.now() - 86400000 * 18,
      });

      await db.verificationApplications.put({
        id: 'APP-HUB-001',
        businessProfileId: 'HUB-BLR-01',
        userId: 'hub-user-001',
        role: 'HUB',
        status: 'approved',
        submittedAt: Date.now() - 86400000 * 20,
        reviewedAt: Date.now() - 86400000 * 18,
        reviewerId: 'admin-sys-001',
        reviewDecision: 'approved',
        reviewNotes: 'Facility inspection verified. Fire safety and segregation standards met.',
        officialRegistryRef: 'KSPCB/E-WASTE/REG/2024/091',
        createdAt: Date.now() - 86400000 * 20,
        updatedAt: Date.now() - 86400000 * 18,
      });

      // 3. Seed Approved Recycler
      await db.users.put({
        id: 'recycler-user-001',
        email: 'recycler.green@kabadiwala.in',
        phone: '+91 98455 11223',
        fullName: 'Dr. Ramesh (Green Earth)',
        role: 'RECYCLER',
        isActive: true,
        createdAt: Date.now() - 86400000 * 25,
      });

      await db.businessProfiles.put({
        id: 'R1',
        userId: 'recycler-user-001',
        role: 'RECYCLER',
        businessName: 'Green Earth Recycling',
        authorizedContact: 'Dr. Ramesh',
        facilityAddress: 'Plot 42, Peenya Industrial Area, Phase II, Bengaluru',
        district: 'Bengaluru Urban',
        operatingArea: 'Karnataka State Wide',
        acceptedMaterials: ['Circuit Boards (PCB)', 'Copper Cables', 'Mobile Phones'],
        cpcbRegistrationNumber: 'CPCB/EW-REG/2024/01',
        facilityScope: 'Formal Dismantling & Material Recovery Plant (500 MT/year)',
        status: 'approved',
        createdAt: Date.now() - 86400000 * 25,
        updatedAt: Date.now() - 86400000 * 22,
      });

      await db.verificationApplications.put({
        id: 'APP-REC-001',
        businessProfileId: 'R1',
        userId: 'recycler-user-001',
        role: 'RECYCLER',
        status: 'approved',
        submittedAt: Date.now() - 86400000 * 25,
        reviewedAt: Date.now() - 86400000 * 22,
        reviewerId: 'admin-sys-001',
        reviewDecision: 'approved',
        reviewNotes: 'Statutory CPCB authorization verified. Valid till 2029.',
        officialRegistryRef: 'CPCB/EW-REG/2024/01',
        createdAt: Date.now() - 86400000 * 25,
        updatedAt: Date.now() - 86400000 * 22,
      });

      // 4. Seed Collector
      await db.users.put({
        id: 'col-user-001',
        email: 'ramu@kabadiwala.in',
        phone: '+91 98450 78421',
        fullName: 'Ramu Kabadiwala',
        role: 'COLLECTOR',
        isActive: true,
        createdAt: Date.now() - 86400000 * 15,
      });

      // 5. Seed Destination Partners for Collector Smart Matching
      const existingPartnersCount = await db.destinationPartners.count();
      if (existingPartnersCount === 0) {
        await db.destinationPartners.bulkPut(DEMO_DESTINATION_PARTNERS);
      }
    }

    // 6. Seed Indicative Prices & Hub Buying Offers if empty
    const priceCount = await db.indicativePrices.count();
    if (priceCount === 0) {
      await db.indicativePrices.bulkPut(DEMO_INDICATIVE_PRICES);
    }

    const offerCount = await db.hubOffers.count();
    if (offerCount === 0) {
      await db.hubOffers.bulkPut(DEMO_HUB_BUYING_OFFERS);
    }
  } catch (e) {
    console.error('Error ensuring demo data:', e);
  }
}

/**
 * Reads active session user from localStorage without circular dependencies.
 */
function getActiveSessionUser(): { id: string; fullName: string; phone?: string; role: string } | null {
  try {
    const raw = localStorage.getItem('kabadiwala_session_v4');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.user || null;
  } catch {
    return null;
  }
}

/**
 * Retrieves the current collector profile for the logged in user or initializes it with safe defaults.
 */
export async function getCollectorProfile(userId?: string): Promise<CollectorProfile> {
  const sessionUser = getActiveSessionUser();
  const activeId = userId || sessionUser?.id || 'current-user';

  const existing = await db.profile.get(activeId);
  if (existing) return existing;

  // If user is authenticated as a collector, generate a personalized profile
  if (sessionUser && (!userId || userId === sessionUser.id)) {
    const cleanIdPart = sessionUser.id.replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase() || '7842';
    const shortId = sessionUser.id.startsWith('KAB-') ? sessionUser.id : `KAB-${cleanIdPart}`;
    const userProfile: CollectorProfile = {
      id: sessionUser.id,
      name: sessionUser.fullName || 'Collector',
      collectorId: shortId,
      location: 'Bangalore (Urban Area)',
      phone: sessionUser.phone || '',
      updatedAt: Date.now(),
    };
    await db.profile.put(userProfile);
    return userProfile;
  }

  // Demo fallback
  const demo = await db.profile.get('current-user');
  if (demo) return demo;
  await db.profile.put(DEFAULT_PROFILE);
  return DEFAULT_PROFILE;
}

/**
 * Persists updates to the local collector profile.
 */
export async function updateCollectorProfile(profileData: Partial<CollectorProfile>, userId?: string): Promise<CollectorProfile> {
  const current = await getCollectorProfile(userId);
  const updated: CollectorProfile = {
    ...current,
    ...profileData,
    id: current.id,
    updatedAt: Date.now(),
  };
  await db.profile.put(updated);
  return updated;
}

export { db };
