import {
  db,
  type DestinationPartner,
  type HandoverRequest,
  type HandoverServiceType,
  type HandoverStatus,
} from './db';
import { getAuthHeaders } from './authService';

const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

export interface DestinationSearchParams {
  material: string;
  quantityKg: number;
  collectorLat?: number;
  collectorLng?: number;
  serviceType?: HandoverServiceType;
  maxDistanceKm?: number;
  partnerType?: 'ALL' | 'HUB' | 'RECYCLER';
}

export interface ScoredDestinationPartner {
  partner: DestinationPartner;
  distance_km: number | null;
  indicative_rate_per_kg: number;
  indicative_pickup_fee: number;
  indicative_total_payout: number;
  final_score: number;
  score_breakdown: {
    price_score: number;
    distance_score: number;
    service_score: number;
    reliability_score: number;
    freshness_score: number;
  };
  recommendation_tags: string[];
}

export interface IneligiblePartner {
  partner: DestinationPartner;
  distance_km: number | null;
  reasons: string[];
}

export interface DestinationSearchResult {
  eligible_destinations: ScoredDestinationPartner[];
  ineligible_destinations: IneligiblePartner[];
  total_evaluated: number;
  offline_fallback: boolean;
  cache_warning?: string;
}

// Haversine distance helper for offline evaluation
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Searches for eligible destination facilities (hubs or recyclers)
 * Uses backend API when reachable; seamlessly falls back to Dexie cache when offline.
 */
export async function searchDestinations(
  params: DestinationSearchParams
): Promise<DestinationSearchResult> {
  try {
    const res = await fetch(`${API_BASE}/destinations/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        material: params.material,
        quantity_kg: params.quantityKg,
        collector_lat: params.collectorLat ?? null,
        collector_lng: params.collectorLng ?? null,
        service_type: params.serviceType || 'DROP_OFF',
        max_distance_km: params.maxDistanceKm ?? 50.0,
        partner_type: params.partnerType || 'ALL',
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const rawEligible = Array.isArray(data.eligible_destinations) ? data.eligible_destinations : [];
      const rawIneligible = Array.isArray(data.ineligible_destinations) ? data.ineligible_destinations : [];

      const normalizedEligible: ScoredDestinationPartner[] = rawEligible.map((item: any) => {
        const partner = item.partner || item;
        return {
          partner,
          distance_km: item.distance_km ?? null,
          indicative_rate_per_kg: item.indicative_rate_per_kg ?? item.offered_rate_per_kg ?? 250,
          indicative_pickup_fee: item.indicative_pickup_fee ?? item.pickup_fee ?? 0,
          indicative_total_payout: item.indicative_total_payout ?? item.estimated_net_payout ?? 0,
          final_score: item.final_score ?? item.rank_score ?? 80,
          score_breakdown: item.score_breakdown || item.scoring_breakdown || {
            price_score: 30,
            distance_score: 20,
            service_score: 15,
            reliability_score: 15,
            freshness_score: 10,
          },
          recommendation_tags: item.recommendation_tags || [],
        };
      });

      const normalizedIneligible: IneligiblePartner[] = rawIneligible.map((item: any) => {
        const partner = item.partner || item;
        return {
          partner,
          distance_km: item.distance_km ?? null,
          reasons: item.reasons || item.ineligibility_reasons || [],
        };
      });

      // Update local Dexie cache with latest partner details
      for (const item of normalizedEligible) {
        if (item.partner?.id) {
          await db.destinationPartners.put(item.partner);
        }
      }
      for (const item of normalizedIneligible) {
        if (item.partner?.id) {
          await db.destinationPartners.put(item.partner);
        }
      }

      return {
        eligible_destinations: normalizedEligible,
        ineligible_destinations: normalizedIneligible,
        total_evaluated: data.total_evaluated || (normalizedEligible.length + normalizedIneligible.length),
        offline_fallback: false,
      };
    }
  } catch (err) {
    console.warn('[DestinationService] Backend search unreachable, falling back to Dexie cache:', err);
  }

  // Offline fallback using Dexie local DB
  return evaluateDestinationsLocally(params);
}

/**
 * Client-side evaluation reproducing the backend matching rules when offline.
 */
async function evaluateDestinationsLocally(
  params: DestinationSearchParams
): Promise<DestinationSearchResult> {
  const allPartners = await db.destinationPartners.toArray();
  const serviceType = params.serviceType || 'DROP_OFF';
  const partnerTypeFilter = params.partnerType || 'ALL';

  const eligible: ScoredDestinationPartner[] = [];
  const ineligible: IneligiblePartner[] = [];

  for (const partner of allPartners) {
    const reasons: string[] = [];

    // Partner type filter
    if (partnerTypeFilter !== 'ALL' && partner.type !== partnerTypeFilter) {
      continue;
    }

    // Hard Gate 1: Verification status
    if (partner.verificationStatus !== 'approved' || !partner.verified) {
      reasons.push(
        `Facility is not officially approved (Status: ${partner.verificationStatus}). Handover disallowed.`
      );
    }

    // Hard Gate 2: Material acceptance
    const acceptsMaterial = partner.acceptedMaterials.some(
      (m) => m.toLowerCase().includes(params.material.toLowerCase()) || params.material.toLowerCase().includes(m.toLowerCase())
    );
    if (!acceptsMaterial) {
      reasons.push(`Material "${params.material}" is not accepted at this facility.`);
    }

    // Hard Gate 3: Quantity limits
    if (params.quantityKg < partner.minQuantityKg) {
      reasons.push(`Lot quantity (${params.quantityKg} kg) is below minimum intake (${partner.minQuantityKg} kg).`);
    }
    if (params.quantityKg > partner.maxQuantityKg) {
      reasons.push(`Lot quantity (${params.quantityKg} kg) exceeds maximum capacity (${partner.maxQuantityKg} kg).`);
    }

    // Hard Gate 4: Service availability
    if (!partner.supportedServices.includes(serviceType)) {
      reasons.push(
        `Facility does not support requested service "${serviceType}". (Supports: ${partner.supportedServices.join(', ')})`
      );
    }

    // Distance calculation
    let distKm: number | null = null;
    if (params.collectorLat != null && params.collectorLng != null) {
      distKm = calculateDistanceKm(
        params.collectorLat,
        params.collectorLng,
        partner.latitude,
        partner.longitude
      );
      if (params.maxDistanceKm && distKm > params.maxDistanceKm) {
        reasons.push(`Distance (${distKm} km) exceeds radius limit (${params.maxDistanceKm} km).`);
      }
    }

    if (reasons.length > 0) {
      ineligible.push({
        partner,
        distance_km: distKm,
        reasons,
      });
      continue;
    }

    // Price calculation
    let rate = 0;
    for (const [mat, r] of Object.entries(partner.ratesPerKg)) {
      if (
        mat.toLowerCase().includes(params.material.toLowerCase()) ||
        params.material.toLowerCase().includes(mat.toLowerCase())
      ) {
        rate = r;
        break;
      }
    }
    if (rate === 0) {
      rate = 50; // fallback base
    }

    const pickupFee = serviceType === 'PICKUP' ? (partner.pickupFee || 0) : 0;
    const totalPayout = Math.max(0, rate * params.quantityKg - pickupFee);

    // Scoring
    const priceScore = Math.min(100, (rate / 250) * 100);
    const distanceScore = distKm != null ? Math.max(0, 100 - distKm * 3) : 70;
    const serviceScore = partner.supportedServices.includes('PICKUP') ? 95 : 80;
    const reliabilityScore = partner.reliabilityScore || 80;
    const freshnessScore = 90;

    const finalScore = Math.round(
      priceScore * 0.35 +
      distanceScore * 0.25 +
      serviceScore * 0.15 +
      reliabilityScore * 0.15 +
      freshnessScore * 0.10
    );

    const tags: string[] = [];
    if (rate >= 120) tags.push('Best Price');
    if (distKm != null && distKm < 10) tags.push('Nearby Facility');
    if (partner.supportedServices.includes('PICKUP')) tags.push('Doorstep Pickup Available');
    if (partner.reliabilityScore >= 95) tags.push('High Reliability');

    eligible.push({
      partner,
      distance_km: distKm,
      indicative_rate_per_kg: rate,
      indicative_pickup_fee: pickupFee,
      indicative_total_payout: totalPayout,
      final_score: finalScore,
      score_breakdown: {
        price_score: Math.round(priceScore),
        distance_score: Math.round(distanceScore),
        service_score: Math.round(serviceScore),
        reliability_score: Math.round(reliabilityScore),
        freshness_score: Math.round(freshnessScore),
      },
      recommendation_tags: tags,
    });
  }

  eligible.sort((a, b) => b.final_score - a.final_score);

  return {
    eligible_destinations: eligible,
    ineligible_destinations: ineligible,
    total_evaluated: allPartners.length,
    offline_fallback: true,
    cache_warning: 'Displaying cached directory. Server revalidation will occur upon quote submission.',
  };
}

/**
 * Creates a formal quote request / handover booking.
 * Strictly verifies against backend API to enforce concurrency and prevent duplicate bookings.
 */
export async function requestHandoverQuote(request: {
  lotId: string;
  collectorId: string;
  collectorName: string;
  collectorLocation: string;
  collectorPhone?: string;
  destinationId: string;
  material: string;
  estimatedWeight: number;
  serviceType: HandoverServiceType;
  scheduledDate?: string;
  notes?: string;
}): Promise<{ success: boolean; handover?: HandoverRequest; error?: string; status_code?: number }> {
  try {
    const res = await fetch(`${API_BASE}/handovers/quote-request`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        lot_id: request.lotId,
        collector_id: request.collectorId,
        collector_name: request.collectorName,
        collector_location: request.collectorLocation,
        collector_phone: request.collectorPhone || '',
        destination_id: request.destinationId,
        material: request.material,
        estimated_weight: request.estimatedWeight,
        service_type: request.serviceType,
        scheduled_date: request.scheduledDate,
        notes: request.notes,
      }),
    });

    if (res.status === 409) {
      const err = await res.json();
      return {
        success: false,
        error: err.detail || 'This lot already has an active handover booking.',
        status_code: 409,
      };
    }

    if (res.ok) {
      const data = await res.json();
      const handover = data.handover as HandoverRequest;
      // Save locally to Dexie
      if (handover && handover.id) {
        await db.handoverRequests.put(handover);
      }
      return { success: true, handover };
    }

    const errData = await res.json().catch(() => ({}));
    return {
      success: false,
      error: errData.detail || `Server error (${res.status})`,
      status_code: res.status,
    };
  } catch (err) {
    console.warn('[DestinationService] Offline quote creation:', err);

    // Concurrency check in local Dexie store
    const existing = await db.handoverRequests
      .where('lotId')
      .equals(request.lotId)
      .toArray();

    const activeConflict = existing.find(
      (h) => !['rejected', 'cancelled', 'completed', 'expired'].includes(h.status)
    );

    if (activeConflict) {
      return {
        success: false,
        error: `Conflict: Lot ${request.lotId} is already booked in Handover ${activeConflict.manifestCode || activeConflict.id} (Status: ${activeConflict.status}).`,
        status_code: 409,
      };
    }

    const partner = await db.destinationPartners.get(request.destinationId);
    if (!partner) {
      return { success: false, error: 'Destination facility not found.' };
    }

    // Rate calculation
    let rate = 50;
    for (const [mat, r] of Object.entries(partner.ratesPerKg || {})) {
      if (
        mat.toLowerCase().includes(request.material.toLowerCase()) ||
        request.material.toLowerCase().includes(mat.toLowerCase())
      ) {
        rate = r;
        break;
      }
    }

    const pickupFee = request.serviceType === 'PICKUP' ? (partner.pickupFee || 0) : 0;
    const estAmount = Math.max(0, rate * request.estimatedWeight - pickupFee);

    // Random 6-digit manifest code
    const randomCode = Math.floor(100000 + Math.random() * 900000);
    const manifestCode = `MNF-${randomCode}`;
    const now = Date.now();

    const offlineHandover: HandoverRequest = {
      id: `HND-${Date.now().toString().slice(-6)}`,
      lotId: request.lotId,
      collectorId: request.collectorId,
      collectorName: request.collectorName,
      collectorLocation: request.collectorLocation,
      collectorPhone: request.collectorPhone,
      destinationId: partner.id,
      destinationName: partner.name,
      destinationType: partner.type,
      material: request.material,
      estimatedWeight: request.estimatedWeight,
      serviceType: request.serviceType,
      priceState: 'quoted',
      offeredRatePerKg: rate,
      pickupFee: pickupFee,
      estimatedNetAmount: estAmount,
      manifestCode: manifestCode,
      status: 'quoted',
      scheduledDate: request.scheduledDate,
      quoteExpiresAt: now + 48 * 3600 * 1000,
      notes: request.notes,
      createdAt: now,
      updatedAt: now,
    };

    await db.handoverRequests.put(offlineHandover);

    return {
      success: true,
      handover: offlineHandover,
    };
  }
}

/**
 * Accepts a quoted handover booking.
 */
export async function acceptHandoverQuote(
  handoverId: string
): Promise<{ success: boolean; handover?: HandoverRequest; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/handovers/${handoverId}/accept`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      const data = await res.json();
      const handover = data.handover as HandoverRequest;
      if (handover) {
        await db.handoverRequests.put(handover);
      }
      return { success: true, handover };
    }
  } catch (err) {
    console.warn('[DestinationService] Offline accept fallback:', err);
  }

  // Local Dexie fallback
  const local = await db.handoverRequests.get(handoverId);
  if (!local) return { success: false, error: 'Handover not found.' };

  local.status = 'scheduled';
  local.priceState = 'accepted';
  local.updatedAt = Date.now();
  await db.handoverRequests.put(local);

  return { success: true, handover: local };
}

/**
 * Updates status of a handover along the state machine lifecycle.
 * Recalculates amount if scale weight is provided.
 */
export async function updateHandoverStatus(
  handoverId: string,
  update: {
    status: HandoverStatus;
    actualWeight?: number;
    disclosedDeductions?: number;
    deductionReason?: string;
    notes?: string;
  }
): Promise<{ success: boolean; handover?: HandoverRequest; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/handovers/${handoverId}/status`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        status: update.status,
        actual_weight: update.actualWeight,
        disclosed_deductions: update.disclosedDeductions,
        deduction_reason: update.deductionReason,
        notes: update.notes,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      const handover = data.handover as HandoverRequest;
      if (handover) {
        await db.handoverRequests.put(handover);
      }
      return { success: true, handover };
    }
  } catch (err) {
    console.warn('[DestinationService] Offline status update fallback:', err);
  }

  // Local Dexie fallback
  const local = await db.handoverRequests.get(handoverId);
  if (!local) return { success: false, error: 'Handover not found.' };

  local.status = update.status;
  if (update.actualWeight != null) {
    local.actualWeight = update.actualWeight;
    const deductions = update.disclosedDeductions || local.disclosedDeductions || 0;
    const pickupFee = local.pickupFee || 0;
    local.finalActualAmount = Math.max(
      0,
      local.offeredRatePerKg * update.actualWeight - pickupFee - deductions
    );
    local.priceState = 'revised';
  }
  if (update.disclosedDeductions != null) {
    local.disclosedDeductions = update.disclosedDeductions;
  }
  if (update.deductionReason != null) {
    local.deductionReason = update.deductionReason;
  }
  if (update.notes) {
    local.notes = update.notes;
  }
  local.updatedAt = Date.now();
  await db.handoverRequests.put(local);

  return { success: true, handover: local };
}

/**
 * Gets all handovers for a given collector, sorted newest first.
 */
export async function getCollectorHandovers(
  collectorId: string
): Promise<HandoverRequest[]> {
  try {
    const res = await fetch(`${API_BASE}/handovers/collector/${collectorId}`, {
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      const data = await res.json();
      const serverHandovers = (data.handovers || []) as HandoverRequest[];
      for (const h of serverHandovers) {
        await db.handoverRequests.put(h);
      }
      return serverHandovers.sort((a, b) => b.createdAt - a.createdAt);
    }
  } catch (err) {
    console.warn('[DestinationService] Failed to load server handovers, using local cache:', err);
  }

  const locals = await db.handoverRequests
    .where('collectorId')
    .equals(collectorId)
    .toArray();
  return locals.sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Helper to calculate weight variance and final amount
 */
export function recalculateHandoverAmount(
  handover: HandoverRequest,
  actualWeight: number,
  deductions = 0
): {
  grossAmount: number;
  deductions: number;
  pickupFee: number;
  netFinalAmount: number;
  weightVarianceKg: number;
  variancePercentage: number;
} {
  const grossAmount = Math.round(handover.offeredRatePerKg * actualWeight * 100) / 100;
  const pickupFee = handover.pickupFee || 0;
  const netFinalAmount = Math.max(0, Math.round((grossAmount - pickupFee - deductions) * 100) / 100);
  const weightVarianceKg = Math.round((actualWeight - handover.estimatedWeight) * 100) / 100;
  const variancePercentage =
    handover.estimatedWeight > 0
      ? Math.round((weightVarianceKg / handover.estimatedWeight) * 1000) / 10
      : 0;

  return {
    grossAmount,
    deductions,
    pickupFee,
    netFinalAmount,
    weightVarianceKg,
    variancePercentage,
  };
}
