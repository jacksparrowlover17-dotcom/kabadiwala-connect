import {
  db,
  type IndicativePrice,
  type HubBuyingOffer,
  type PricingTransactionSnapshot,
  DEMO_INDICATIVE_PRICES,
  DEMO_HUB_BUYING_OFFERS
} from './db';
import { getCurrentSession, getAuthHeaders } from './authService';

const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

export interface PriceComparisonResult {
  material: string;
  quantity_kg?: number;
  indicative_reference: IndicativePrice | null;
  indicative_notice: string;
  eligible_offers: Array<HubBuyingOffer & {
    calculated_gross?: number;
    calculated_net?: number;
    guaranteed_rate: number;
  }>;
  ineligible_offers: Array<HubBuyingOffer & {
    reasons: string[];
    ineligibility_reasons: string[];
  }>;
  count_eligible: number;
  count_ineligible: number;
  empty_reason: string | null;
  offline_fallback: boolean;
  cached_timestamp?: number;
}

// -----------------------------------------------------------------------------
// Indicative Prices Management (Admin & View)
// -----------------------------------------------------------------------------

export async function fetchIndicativePrices(
  material?: string,
  status = 'published'
): Promise<{ prices: IndicativePrice[]; offlineFallback: boolean; cachedTimestamp?: number }> {
  try {
    const url = new URL(`${API_BASE}/prices/indicative`);
    if (material) url.searchParams.set('material', material);
    if (status) url.searchParams.set('status', status);

    const res = await fetch(url.toString());
    if (res.ok) {
      const data = await res.json();
      const serverPrices: IndicativePrice[] = (data.prices || []).map((p: any) => ({
        id: p.id,
        material: p.material,
        grade: p.grade,
        minPrice: p.min_price ?? p.minPrice,
        maxPrice: p.max_price ?? p.maxPrice,
        unit: p.unit || 'kg',
        location: p.location || 'Bengaluru Urban',
        sourceName: p.source_name ?? p.sourceName,
        sourceDate: p.source_date ?? p.sourceDate,
        effectiveDate: p.effective_date ?? p.effectiveDate,
        expiryDate: p.expiry_date ?? p.expiryDate,
        status: p.status,
        isSample: Boolean(p.is_sample ?? p.isSample),
        createdBy: p.created_by ?? p.createdBy ?? 'CPCB State Admin Officer',
        updatedBy: p.updated_by ?? p.updatedBy ?? 'CPCB State Admin Officer',
        createdAt: typeof p.created_at === 'string' ? new Date(p.created_at).getTime() : (p.created_at ?? Date.now()),
        updatedAt: typeof p.updated_at === 'string' ? new Date(p.updated_at).getTime() : (p.updated_at ?? Date.now()),
      }));

      // Cache locally in Dexie
      for (const p of serverPrices) {
        await db.indicativePrices.put(p);
      }
      return { prices: serverPrices, offlineFallback: false };
    }
  } catch (err) {
    console.warn('[PricingService] Falling back to local offline indicative prices cache:', err);
  }

  // Local fallback
  let query = db.indicativePrices.toCollection();
  let localPrices = await query.toArray();

  if (localPrices.length === 0) {
    await db.indicativePrices.bulkPut(DEMO_INDICATIVE_PRICES);
    localPrices = DEMO_INDICATIVE_PRICES;
  }

  if (material) {
    localPrices = localPrices.filter(p => p.material.toLowerCase() === material.toLowerCase());
  }
  if (status && status !== 'all') {
    localPrices = localPrices.filter(p => p.status === status);
  }

  return {
    prices: localPrices,
    offlineFallback: true,
    cachedTimestamp: Date.now()
  };
}

export async function createIndicativePrice(
  data: Omit<IndicativePrice, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>
): Promise<{ success: boolean; price?: IndicativePrice; error?: string }> {
  if (data.minPrice < 0 || data.maxPrice < 0) {
    return { success: false, error: 'Indicative prices must be non-negative.' };
  }
  if (data.minPrice > data.maxPrice) {
    return { success: false, error: 'Minimum price cannot exceed maximum price.' };
  }

  const session = getCurrentSession();
  const adminName = session?.user?.fullName || 'CPCB State Admin Officer';

  try {
    const res = await fetch(`${API_BASE}/admin/prices/indicative`, {
      method: 'POST',
      headers: getAuthHeaders({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({
        material: data.material,
        grade: data.grade,
        min_price: data.minPrice,
        max_price: data.maxPrice,
        unit: data.unit,
        location: data.location,
        source_name: data.sourceName,
        source_date: data.sourceDate,
        effective_date: data.effectiveDate,
        expiry_date: data.expiryDate,
        status: data.status,
        is_sample: data.isSample,
      }),
    });

    if (res.ok) {
      const respData = await res.json();
      const p = respData.indicative_price;
      const formatted: IndicativePrice = {
        id: p.id,
        material: p.material,
        grade: p.grade,
        minPrice: p.min_price,
        maxPrice: p.max_price,
        unit: p.unit,
        location: p.location,
        sourceName: p.source_name,
        sourceDate: p.source_date,
        effectiveDate: p.effective_date,
        expiryDate: p.expiry_date,
        status: p.status,
        isSample: p.is_sample,
        createdBy: p.created_by,
        updatedBy: p.updated_by,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await db.indicativePrices.put(formatted);
      return { success: true, price: formatted };
    } else {
      const errData = await res.json().catch(() => ({}));
      return { success: false, error: errData.detail || 'Failed to create indicative price.' };
    }
  } catch (err) {
    console.warn('[PricingService] Offline fallback create indicative price:', err);
    // Offline local save
    const localId = `IND-OFFLINE-${Date.now()}`;
    const newRecord: IndicativePrice = {
      ...data,
      id: localId,
      createdBy: adminName,
      updatedBy: adminName,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db.indicativePrices.put(newRecord);
    return { success: true, price: newRecord };
  }
}

export async function updateIndicativePrice(
  priceId: string,
  data: Partial<IndicativePrice>
): Promise<{ success: boolean; price?: IndicativePrice; error?: string }> {
  if (data.minPrice !== undefined && data.maxPrice !== undefined && data.minPrice > data.maxPrice) {
    return { success: false, error: 'Minimum price cannot exceed maximum price.' };
  }

  const session = getCurrentSession();
  const adminName = session?.user?.fullName || 'CPCB State Admin Officer';

  try {
    const res = await fetch(`${API_BASE}/admin/prices/indicative/${priceId}`, {
      method: 'PUT',
      headers: getAuthHeaders({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({
        min_price: data.minPrice,
        max_price: data.maxPrice,
        grade: data.grade,
        location: data.location,
        source_name: data.sourceName,
        source_date: data.sourceDate,
        effective_date: data.effectiveDate,
        expiry_date: data.expiryDate,
        status: data.status,
      }),
    });

    if (res.ok) {
      const respData = await res.json();
      const p = respData.indicative_price;
      const formatted: IndicativePrice = {
        id: p.id,
        material: p.material,
        grade: p.grade,
        minPrice: p.min_price,
        maxPrice: p.max_price,
        unit: p.unit,
        location: p.location,
        sourceName: p.source_name,
        sourceDate: p.source_date,
        effectiveDate: p.effective_date,
        expiryDate: p.expiry_date,
        status: p.status,
        isSample: p.is_sample,
        createdBy: p.created_by,
        updatedBy: p.updated_by,
        createdAt: typeof p.created_at === 'string' ? new Date(p.created_at).getTime() : p.created_at,
        updatedAt: Date.now(),
      };
      await db.indicativePrices.put(formatted);
      return { success: true, price: formatted };
    }
  } catch (err) {
    console.warn('[PricingService] Offline update fallback:', err);
  }

  // Local Dexie fallback
  const existing = await db.indicativePrices.get(priceId);
  if (!existing) return { success: false, error: 'Price record not found.' };

  const updated: IndicativePrice = {
    ...existing,
    ...data,
    updatedBy: adminName,
    updatedAt: Date.now(),
  };
  await db.indicativePrices.put(updated);
  return { success: true, price: updated };
}

export async function setIndicativePriceStatus(
  priceId: string,
  status: 'published' | 'expired' | 'draft'
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/admin/prices/indicative/${priceId}/status`, {
      method: 'POST',
      headers: getAuthHeaders({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const local = await db.indicativePrices.get(priceId);
      if (local) {
        local.status = status;
        local.updatedAt = Date.now();
        await db.indicativePrices.put(local);
      }
      return { success: true };
    }
  } catch (err) {
    console.warn('[PricingService] Offline status change fallback:', err);
  }

  const local = await db.indicativePrices.get(priceId);
  if (!local) return { success: false, error: 'Price record not found.' };
  local.status = status;
  local.updatedAt = Date.now();
  await db.indicativePrices.put(local);
  return { success: true };
}

// -----------------------------------------------------------------------------
// Approved Hub Buying Offers
// -----------------------------------------------------------------------------

export async function fetchHubOffers(
  material?: string,
  hubId?: string,
  status = 'active'
): Promise<{ offers: HubBuyingOffer[]; offlineFallback: boolean }> {
  try {
    const url = new URL(`${API_BASE}/offers/hub`);
    if (material) url.searchParams.set('material', material);
    if (hubId) url.searchParams.set('hub_id', hubId);
    if (status) url.searchParams.set('status', status);

    const res = await fetch(url.toString());
    if (res.ok) {
      const data = await res.json();
      const serverOffers: HubBuyingOffer[] = (data.offers || []).map((o: any) => ({
        id: o.id,
        hubId: o.hub_id ?? o.hubId,
        hubName: o.hub_name ?? o.hubName,
        hubVerificationStatus: 'approved',
        material: o.material,
        grade: o.grade,
        rate: o.rate,
        unit: o.unit || 'kg',
        minQuantityKg: o.min_quantity_kg ?? o.minQuantityKg ?? 5,
        supportedServices: o.supported_services ?? o.supportedServices ?? ['DROP_OFF'],
        pickupFee: o.pickup_fee ?? o.pickupFee ?? 0,
        applicableArea: o.applicable_area ?? o.applicableArea,
        validFrom: o.valid_from ?? o.validFrom,
        validTill: o.valid_till ?? o.validTill,
        status: o.status,
        termsNote: o.terms_note ?? o.termsNote,
        createdAt: typeof o.created_at === 'string' ? new Date(o.created_at).getTime() : (o.created_at ?? Date.now()),
        updatedAt: typeof o.updated_at === 'string' ? new Date(o.updated_at).getTime() : (o.updated_at ?? Date.now()),
      }));

      for (const o of serverOffers) {
        await db.hubOffers.put(o);
      }
      return { offers: serverOffers, offlineFallback: false };
    }
  } catch (err) {
    console.warn('[PricingService] Falling back to local hub offers cache:', err);
  }

  let localOffers = await db.hubOffers.toArray();
  if (localOffers.length === 0) {
    await db.hubOffers.bulkPut(DEMO_HUB_BUYING_OFFERS);
    localOffers = DEMO_HUB_BUYING_OFFERS;
  }

  if (material) localOffers = localOffers.filter(o => o.material.toLowerCase() === material.toLowerCase());
  if (hubId) localOffers = localOffers.filter(o => o.hubId === hubId);
  if (status && status !== 'all') localOffers = localOffers.filter(o => o.status === status);

  return { offers: localOffers, offlineFallback: true };
}

export async function createHubOffer(
  data: Omit<HubBuyingOffer, 'id' | 'createdAt' | 'updatedAt'>,
  authenticatedHubId: string
): Promise<{ success: boolean; offer?: HubBuyingOffer; error?: string }> {
  if (data.rate <= 0) return { success: false, error: 'Offer rate must be strictly positive.' };
  if (data.minQuantityKg < 0) return { success: false, error: 'Minimum quantity cannot be negative.' };

  try {
    const res = await fetch(`${API_BASE}/hub/offers`, {
      method: 'POST',
      headers: getAuthHeaders({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({
        hub_id: authenticatedHubId,
        hub_name: data.hubName,
        material: data.material,
        grade: data.grade,
        rate: data.rate,
        unit: data.unit,
        min_quantity_kg: data.minQuantityKg,
        supported_services: data.supportedServices,
        pickup_fee: data.pickupFee,
        applicable_area: data.applicableArea,
        valid_from: data.validFrom,
        valid_till: data.validTill,
        status: data.status,
        terms_note: data.termsNote,
      }),
    });

    if (res.ok) {
      const respData = await res.json();
      const o = respData.offer;
      const formatted: HubBuyingOffer = {
        id: o.id,
        hubId: o.hub_id,
        hubName: o.hub_name,
        hubVerificationStatus: 'approved',
        material: o.material,
        grade: o.grade,
        rate: o.rate,
        unit: o.unit,
        minQuantityKg: o.min_quantity_kg,
        supportedServices: o.supported_services,
        pickupFee: o.pickup_fee,
        applicableArea: o.applicable_area,
        validFrom: o.valid_from,
        validTill: o.valid_till,
        status: o.status,
        termsNote: o.terms_note,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await db.hubOffers.put(formatted);
      return { success: true, offer: formatted };
    } else {
      const errData = await res.json().catch(() => ({}));
      return { success: false, error: errData.detail || 'Failed to publish buying offer.' };
    }
  } catch (err) {
    console.warn('[PricingService] Offline hub offer create fallback:', err);
    const newOffer: HubBuyingOffer = {
      ...data,
      id: `OFFER-OFFLINE-${Date.now()}`,
      hubId: authenticatedHubId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db.hubOffers.put(newOffer);
    return { success: true, offer: newOffer };
  }
}

export async function setHubOfferStatus(
  offerId: string,
  status: 'active' | 'withdrawn' | 'expired',
  _authenticatedHubId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/hub/offers/${offerId}/status`, {
      method: 'POST',
      headers: getAuthHeaders({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const local = await db.hubOffers.get(offerId);
      if (local) {
        local.status = status;
        local.updatedAt = Date.now();
        await db.hubOffers.put(local);
      }
      return { success: true };
    }
  } catch (err) {
    console.warn('[PricingService] Offline hub offer status update fallback:', err);
  }

  const local = await db.hubOffers.get(offerId);
  if (!local) return { success: false, error: 'Offer not found.' };
  local.status = status;
  local.updatedAt = Date.now();
  await db.hubOffers.put(local);
  return { success: true };
}

// -----------------------------------------------------------------------------
// Collector Price Comparison
// -----------------------------------------------------------------------------

export async function comparePrices(params: {
  material: string;
  grade?: string;
  quantityKg?: number;
  area?: string;
  district?: string;
}): Promise<PriceComparisonResult> {
  try {
    const url = new URL(`${API_BASE}/pricing/compare`);
    url.searchParams.set('material', params.material);
    if (params.grade) url.searchParams.set('grade', params.grade);
    if (params.quantityKg != null) url.searchParams.set('quantity_kg', String(params.quantityKg));
    if (params.area) url.searchParams.set('area', params.area);
    if (params.district) url.searchParams.set('district', params.district);

    const res = await fetch(url.toString());
    if (res.ok) {
      const data = await res.json();
      return {
        material: data.material,
        quantity_kg: data.quantity_kg,
        indicative_reference: data.indicative_reference ? {
          id: data.indicative_reference.id,
          material: data.indicative_reference.material,
          grade: data.indicative_reference.grade,
          minPrice: data.indicative_reference.min_price ?? data.indicative_reference.minPrice,
          maxPrice: data.indicative_reference.max_price ?? data.indicative_reference.maxPrice,
          unit: data.indicative_reference.unit || 'kg',
          location: data.indicative_reference.location,
          sourceName: data.indicative_reference.source_name ?? data.indicative_reference.sourceName,
          sourceDate: data.indicative_reference.source_date ?? data.indicative_reference.sourceDate,
          effectiveDate: data.indicative_reference.effective_date ?? data.indicative_reference.effectiveDate,
          expiryDate: data.indicative_reference.expiry_date ?? data.indicative_reference.expiryDate,
          status: data.indicative_reference.status,
          isSample: Boolean(data.indicative_reference.is_sample ?? data.indicative_reference.isSample),
          createdBy: data.indicative_reference.created_by ?? data.indicative_reference.createdBy,
          updatedBy: data.indicative_reference.updated_by ?? data.indicative_reference.updatedBy,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        } : null,
        indicative_notice: data.indicative_notice || 'Indicative prices are official regulatory reference estimates and not guaranteed buying offers.',
        eligible_offers: (data.eligible_offers || []).map((o: any) => ({
          id: o.id,
          hubId: o.hub_id ?? o.hubId,
          hubName: o.hub_name ?? o.hubName,
          hubVerificationStatus: 'approved',
          material: o.material,
          grade: o.grade,
          rate: o.rate,
          unit: o.unit || 'kg',
          minQuantityKg: o.min_quantity_kg ?? o.minQuantityKg ?? 5,
          supportedServices: o.supported_services ?? o.supportedServices ?? ['DROP_OFF'],
          pickupFee: o.pickup_fee ?? o.pickupFee ?? 0,
          applicableArea: o.applicable_area ?? o.applicableArea,
          validFrom: o.valid_from ?? o.validFrom,
          validTill: o.valid_till ?? o.validTill,
          status: o.status,
          termsNote: o.terms_note ?? o.termsNote,
          createdAt: typeof o.created_at === 'string' ? new Date(o.created_at).getTime() : o.created_at,
          updatedAt: typeof o.updated_at === 'string' ? new Date(o.updated_at).getTime() : o.updated_at,
          calculated_gross: o.calculated_gross,
          calculated_net: o.calculated_net,
          guaranteed_rate: o.guaranteed_rate ?? o.rate,
        })),
        ineligible_offers: (data.ineligible_offers || []).map((o: any) => ({
          id: o.id,
          hubId: o.hub_id ?? o.hubId,
          hubName: o.hub_name ?? o.hubName,
          hubVerificationStatus: 'approved',
          material: o.material,
          grade: o.grade,
          rate: o.rate,
          unit: o.unit || 'kg',
          minQuantityKg: o.min_quantity_kg ?? o.minQuantityKg ?? 5,
          supportedServices: o.supported_services ?? o.supportedServices ?? ['DROP_OFF'],
          pickupFee: o.pickup_fee ?? o.pickupFee ?? 0,
          applicableArea: o.applicable_area ?? o.applicableArea,
          validFrom: o.valid_from ?? o.validFrom,
          validTill: o.valid_till ?? o.validTill,
          status: o.status,
          termsNote: o.terms_note ?? o.termsNote,
          createdAt: typeof o.created_at === 'string' ? new Date(o.created_at).getTime() : o.created_at,
          updatedAt: typeof o.updated_at === 'string' ? new Date(o.updated_at).getTime() : o.updated_at,
          reasons: o.reasons || o.ineligibility_reasons || [],
          ineligibility_reasons: o.reasons || o.ineligibility_reasons || [],
        })),
        count_eligible: data.count_eligible,
        count_ineligible: data.count_ineligible,
        empty_reason: data.empty_reason,
        offline_fallback: false,
      };
    }
  } catch (err) {
    console.warn('[PricingService] Offline fallback price comparison:', err);
  }

  // Local Offline Comparison
  const localPrices = await db.indicativePrices
    .where('material')
    .equals(params.material)
    .toArray();
  const indRef = localPrices.find(p => p.status === 'published') || null;

  const localOffers = await db.hubOffers
    .where('material')
    .equals(params.material)
    .toArray();

  const eligible: any[] = [];
  const ineligible: any[] = [];

  for (const o of localOffers) {
    const reasons: string[] = [];
    if (o.status !== 'active') reasons.push(`Offer is currently '${o.status}'.`);
    if (params.quantityKg != null && params.quantityKg < o.minQuantityKg) {
      reasons.push(`Batch quantity (${params.quantityKg} kg) is below hub minimum intake threshold (${o.minQuantityKg} kg).`);
    }
    if (params.area && !o.applicableArea.toLowerCase().includes(params.area.toLowerCase()) && !o.applicableArea.toLowerCase().includes('all')) {
      reasons.push(`Offer is restricted to '${o.applicableArea}', which does not cover '${params.area}'.`);
    }

    if (reasons.length > 0) {
      ineligible.push({ ...o, reasons, ineligibility_reasons: reasons });
    } else {
      const gross = params.quantityKg != null ? Math.round(params.quantityKg * o.rate * 100) / 100 : undefined;
      const pickupFee = o.pickupFee || 0;
      const net = gross != null ? Math.max(0, Math.round((gross - pickupFee) * 100) / 100) : undefined;
      eligible.push({
        ...o,
        calculated_gross: gross,
        calculated_net: net,
        guaranteed_rate: o.rate,
      });
    }
  }

  eligible.sort((a, b) => b.rate - a.rate);

  return {
    material: params.material,
    quantity_kg: params.quantityKg,
    indicative_reference: indRef,
    indicative_notice: 'Offline Cached: Indicative prices are official regulatory benchmarks, not guaranteed binding offers.',
    eligible_offers: eligible,
    ineligible_offers: ineligible,
    count_eligible: eligible.length,
    count_ineligible: ineligible.length,
    empty_reason: eligible.length === 0 ? 'No active hub offers currently available for this material.' : null,
    offline_fallback: true,
    cached_timestamp: Date.now(),
  };
}

// -----------------------------------------------------------------------------
// Pricing Handover Transaction Snapshot Flow
// -----------------------------------------------------------------------------

export async function initiatePricingTransaction(
  offerId: string,
  lotId: string,
  collectorId: string,
  collectorName: string,
  estimatedWeight: number,
  serviceType: 'DROP_OFF' | 'PICKUP' = 'DROP_OFF'
): Promise<{ success: boolean; transaction?: PricingTransactionSnapshot; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/pricing/transactions/initiate`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        offer_id: offerId,
        lot_id: lotId,
        collector_id: collectorId,
        collector_name: collectorName,
        estimated_weight: estimatedWeight,
        service_type: serviceType,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const tx = data.transaction as PricingTransactionSnapshot;
      if (tx) {
        await db.pricingTransactions.put(tx);
      }
      return { success: true, transaction: tx };
    } else {
      const err = await res.json().catch(() => ({}));
      return { success: false, error: err.detail || 'Failed to initiate transaction.' };
    }
  } catch (err) {
    console.warn('[PricingService] Offline initiate transaction fallback:', err);
  }

  // Local fallback
  const offer = await db.hubOffers.get(offerId);
  if (!offer) return { success: false, error: 'Hub offer not found.' };

  const txId = `TX-PRC-OFFLINE-${Date.now()}`;
  const now = Date.now();
  const snapshot: PricingTransactionSnapshot = {
    id: txId,
    lotId,
    offerId,
    collectorId,
    collectorName,
    hubId: offer.hubId,
    hubName: offer.hubName,
    material: offer.material,
    grade: offer.grade,
    offeredRate: offer.rate,
    acceptedRate: offer.rate,
    estimatedWeight,
    disclosedDeductions: 0,
    pickupFee: offer.pickupFee || 0,
    serviceType,
    manifestCode: `KC-MNF-${Date.now().toString(36).toUpperCase()}`,
    status: 'OFFER_ACCEPTED',
    collectorApproved: true,
    paymentStatus: 'PENDING',
    acceptedAt: now,
    createdAt: now,
    updatedAt: now,
  };
  await db.pricingTransactions.put(snapshot);
  return { success: true, transaction: snapshot };
}

export async function recordScaleIntake(
  txId: string,
  actualWeight: number,
  agreedRate?: number,
  disclosedDeductions = 0,
  deductionReason?: string
): Promise<{ success: boolean; transaction?: PricingTransactionSnapshot; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/pricing/transactions/${txId}/intake`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        actual_weight: actualWeight,
        agreed_rate: agreedRate,
        disclosed_deductions: disclosedDeductions,
        deduction_reason: deductionReason,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const tx = data.transaction as PricingTransactionSnapshot;
      if (tx) {
        await db.pricingTransactions.put(tx);
      }
      return { success: true, transaction: tx };
    } else {
      const err = await res.json().catch(() => ({}));
      return { success: false, error: err.detail || 'Failed to record scale intake.' };
    }
  } catch (err) {
    console.warn('[PricingService] Offline intake fallback:', err);
  }

  const tx = await db.pricingTransactions.get(txId);
  if (!tx) return { success: false, error: 'Transaction not found.' };

  const rate = agreedRate && agreedRate > 0 ? agreedRate : tx.acceptedRate;
  const gross = Math.round(actualWeight * rate * 100) / 100;
  const net = Math.max(0, Math.round((gross - tx.pickupFee - disclosedDeductions) * 100) / 100);

  tx.actualAcceptedWeight = actualWeight;
  tx.acceptedRate = rate;
  tx.grossAmount = gross;
  tx.disclosedDeductions = disclosedDeductions;
  tx.deductionReason = disclosedDeductions > 0 ? deductionReason : undefined;
  tx.finalPayableAmount = net;

  if (rate !== tx.offeredRate || disclosedDeductions > 0) {
    tx.status = 'AWAITING_COLLECTOR_APPROVAL';
    tx.collectorApproved = false;
  } else {
    tx.status = 'CONFIRMED';
    tx.collectorApproved = true;
  }
  tx.updatedAt = Date.now();
  await db.pricingTransactions.put(tx);
  return { success: true, transaction: tx };
}

export async function approveRevisedIntake(
  txId: string,
  collectorApproved: boolean
): Promise<{ success: boolean; transaction?: PricingTransactionSnapshot; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/pricing/transactions/${txId}/collector-approval`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ collector_approved: collectorApproved }),
    });

    if (res.ok) {
      const data = await res.json();
      const tx = data.transaction as PricingTransactionSnapshot;
      if (tx) await db.pricingTransactions.put(tx);
      return { success: true, transaction: tx };
    }
  } catch (err) {
    console.warn('[PricingService] Offline collector approval fallback:', err);
  }

  const tx = await db.pricingTransactions.get(txId);
  if (!tx) return { success: false, error: 'Transaction not found.' };

  tx.status = collectorApproved ? 'CONFIRMED' : 'CANCELLED';
  tx.collectorApproved = collectorApproved;
  tx.updatedAt = Date.now();
  await db.pricingTransactions.put(tx);
  return { success: true, transaction: tx };
}

export async function settleTransactionPayment(
  txId: string,
  paymentReference?: string
): Promise<{ success: boolean; transaction?: PricingTransactionSnapshot; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/pricing/transactions/${txId}/settle-payment`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ payment_reference: paymentReference }),
    });

    if (res.ok) {
      const data = await res.json();
      const tx = data.transaction as PricingTransactionSnapshot;
      if (tx) await db.pricingTransactions.put(tx);
      return { success: true, transaction: tx };
    } else {
      const err = await res.json().catch(() => ({}));
      return { success: false, error: err.detail || 'Failed to record settlement.' };
    }
  } catch (err) {
    console.warn('[PricingService] Offline payment settlement fallback:', err);
  }

  const tx = await db.pricingTransactions.get(txId);
  if (!tx) return { success: false, error: 'Transaction not found.' };
  if (tx.paymentStatus === 'PAID') {
    return { success: false, error: 'Transaction already settled. Duplicate payment prevented.' };
  }

  tx.paymentStatus = 'PAID';
  tx.status = 'SETTLED';
  tx.paymentReference = paymentReference || `UPI-OFFLINE-${Date.now()}`;
  tx.paidAt = Date.now();
  tx.completedAt = Date.now();
  tx.updatedAt = Date.now();
  await db.pricingTransactions.put(tx);
  return { success: true, transaction: tx };
}
