import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Compass, MapPin, Navigation, Building2, Scale, Truck, CheckCircle2,
  AlertTriangle, ShieldCheck, ChevronRight, X, Clock,
  Sliders, Info, ArrowLeft, RefreshCw, AlertCircle
} from 'lucide-react';
import {
  searchDestinations,
  requestHandoverQuote,
  type ScoredDestinationPartner,
  type DestinationSearchResult
} from '../lib/destinationService';
import {
  db,
  type DestinationPartner,
  type HandoverServiceType,
  DEFAULT_PROFILE
} from '../lib/db';
import { getCurrentSession } from '../lib/authService';

const BANGALORE_AREAS: Record<string, { lat: number; lng: number; name: string }> = {
  'K.R. Puram (560036)': { lat: 12.9982, lng: 77.6974, name: 'K.R. Puram / East' },
  'BTM Layout (560076)': { lat: 12.9166, lng: 77.6101, name: 'BTM Layout / South' },
  'Peenya Industrial (560058)': { lat: 13.0285, lng: 77.5197, name: 'Peenya Industrial Area' },
  'Whitefield (560066)': { lat: 12.9698, lng: 77.7499, name: 'Whitefield E-Tech Zone' },
  'Electronic City (560100)': { lat: 12.8452, lng: 77.6602, name: 'Electronic City Phase 1' },
};

const MATERIALS = [
  'Circuit Boards (PCB)',
  'Copper Cables',
  'Mobile Phones',
  'Lithium-ion Batteries',
  'CRT Monitors & Glass',
  'Mixed Electronic Scrap',
];

export default function DestinationFinderPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const session = getCurrentSession();
  const activeUserId = session?.user?.id || 'current-user';
  const profile = useLiveQuery(() => db.profile.get(activeUserId), [activeUserId]);

  // URL query params
  const paramLotId = searchParams.get('lotId') || '';
  const paramMaterial = searchParams.get('material') || 'Circuit Boards (PCB)';
  const paramWeight = parseFloat(searchParams.get('weight') || '15');

  // Form State
  const [lotId, setLotId] = useState(paramLotId);
  const [material, setMaterial] = useState(paramMaterial);
  const [quantityKg, setQuantityKg] = useState<number>(paramWeight > 0 ? paramWeight : 15);
  const [serviceType, setServiceType] = useState<HandoverServiceType>('DROP_OFF');
  const [partnerTypeFilter, setPartnerTypeFilter] = useState<'ALL' | 'HUB' | 'RECYCLER'>('ALL');
  const [maxDistanceKm, setMaxDistanceKm] = useState<number>(30);

  // Location State
  const [locationMode, setLocationMode] = useState<'GPS' | 'MANUAL' | 'PROFILE'>('MANUAL');
  const [selectedArea, setSelectedArea] = useState<string>('BTM Layout (560076)');
  const [userLat, setUserLat] = useState<number | undefined>(12.9166);
  const [userLng, setUserLng] = useState<number | undefined>(77.6101);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Results State
  const [loading, setLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<DestinationSearchResult | null>(null);
  const [showIneligible, setShowIneligible] = useState(false);

  // Modals
  const [detailPartner, setDetailPartner] = useState<DestinationPartner | null>(null);
  const [scoreBreakdownPartner, setScoreBreakdownPartner] = useState<ScoredDestinationPartner | null>(null);
  const [bookingPartner, setBookingPartner] = useState<ScoredDestinationPartner | null>(null);
  const [scheduledDate, setScheduledDate] = useState<string>(
    new Date(Date.now() + 86400000).toISOString().split('T')[0]
  );
  const [bookingNotes, setBookingNotes] = useState('');
  const [submittingBooking, setSubmittingBooking] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSuccessManifest, setBookingSuccessManifest] = useState<string | null>(null);

  // Fetch collector lots to allow choosing lot if not in query param
  const [availableLots, setAvailableLots] = useState<any[]>([]);

  useEffect(() => {
    async function loadLots() {
      const lots = await db.lots.where('status').equals('PENDING').toArray();
      setAvailableLots(lots);
      if (!lotId && lots.length > 0) {
        setLotId(lots[0].id);
        setMaterial(lots[0].material);
        setQuantityKg(parseFloat(lots[0].weight) || 15);
      }
    }
    loadLots();
  }, []);

  // Handle GPS location request
  const requestGpsLocation = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser.');
      return;
    }
    setGpsLoading(true);
    setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLat(position.coords.latitude);
        setUserLng(position.coords.longitude);
        setGpsLoading(false);
        setLocationMode('GPS');
      },
      (error) => {
        setGpsLoading(false);
        setGpsError(
          error.code === 1
            ? 'Location access denied. Using manual area selector.'
            : 'Unable to acquire GPS coordinates.'
        );
        setLocationMode('MANUAL');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Perform Destination Search
  const doSearch = async () => {
    setLoading(true);
    try {
      let lat = userLat;
      let lng = userLng;

      if (locationMode === 'MANUAL' && BANGALORE_AREAS[selectedArea]) {
        lat = BANGALORE_AREAS[selectedArea].lat;
        lng = BANGALORE_AREAS[selectedArea].lng;
      } else if (locationMode === 'PROFILE') {
        lat = 12.9166;
        lng = 77.6101;
      }

      const res = await searchDestinations({
        material,
        quantityKg,
        collectorLat: lat,
        collectorLng: lng,
        serviceType,
        maxDistanceKm,
        partnerType: partnerTypeFilter,
      });

      setSearchResult(res);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  };

  // Auto trigger search on dependencies update
  useEffect(() => {
    doSearch();
  }, [material, quantityKg, serviceType, partnerTypeFilter, maxDistanceKm, locationMode, selectedArea, userLat, userLng]);

  // Handle Booking Quote Submission
  const handleConfirmBooking = async () => {
    if (!bookingPartner) return;
    if (!lotId) {
      setBookingError('Please select or specify a lot ID before booking.');
      return;
    }

    setSubmittingBooking(true);
    setBookingError(null);

    const sessionCollectorId = session?.user?.id ? (session.user.id.startsWith('KAB-') ? session.user.id : `KAB-${session.user.id.replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase()}`) : DEFAULT_PROFILE.collectorId;
    const collectorId = (session?.user as any)?.collectorId || profile?.collectorId || sessionCollectorId;
    const collectorName = profile?.name || session?.user?.fullName || DEFAULT_PROFILE.name;
    const collectorLocation = selectedArea || profile?.location || DEFAULT_PROFILE.location;

    const res = await requestHandoverQuote({
      lotId,
      collectorId,
      collectorName,
      collectorLocation,
      destinationId: bookingPartner.partner.id,
      material,
      estimatedWeight: quantityKg,
      serviceType,
      scheduledDate,
      notes: bookingNotes,
    });

    setSubmittingBooking(false);

    if (res.success && res.handover) {
      setBookingSuccessManifest(res.handover.manifestCode || 'MNF-GENERATED');
    } else {
      setBookingError(res.error || 'Failed to submit quote request.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-5 space-y-6">
      {/* ─── Header ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-emerald-700 mb-2 transition"
          >
            <ArrowLeft size={14} /> Back to Dashboard
          </button>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <Compass className="text-emerald-700" size={26} />
            Collector Destination Finder
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Smart matching engine connecting informal collectors to authorized local hubs & formal recyclers.
          </p>
        </div>

        <button
          onClick={() => navigate('/handovers')}
          className="px-3.5 py-2 text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl hover:bg-emerald-100 flex items-center gap-1.5 transition self-start sm:self-center"
        >
          <Truck size={14} />
          <span>My Handovers & Manifests</span>
        </button>
      </div>

      {/* ─── Offline Fallback Notice ──────────────────────── */}
      {searchResult?.offline_fallback && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-900">
          <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold">Offline Directory Mode</p>
            <p className="mt-0.5">
              {searchResult.cache_warning ||
                'Displaying cached destination facilities from local storage. Revalidation and quota locking will finalize upon network synchronization.'}
            </p>
          </div>
        </div>
      )}

      {/* ─── Lot & Parameters Card ────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Sliders size={16} className="text-emerald-700" />
            1. Lot Specification & Dispatch Parameters
          </h2>
          {paramLotId && (
            <span className="badge font-mono text-[11px] bg-emerald-100 text-emerald-800 border-emerald-300">
              Active Lot: #{paramLotId.slice(0, 8)}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Lot Selector */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Select Pending Lot
            </label>
            {availableLots.length > 0 ? (
              <select
                value={lotId}
                onChange={(e) => {
                  setLotId(e.target.value);
                  const selected = availableLots.find((l) => l.id === e.target.value);
                  if (selected) {
                    setMaterial(selected.material);
                    setQuantityKg(parseFloat(selected.weight) || 15);
                  }
                }}
                className="w-full text-xs font-semibold px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:border-emerald-600"
              >
                {availableLots.map((l) => (
                  <option key={l.id} value={l.id}>
                    #{l.id.slice(0, 6)} - {l.material} ({l.weight} kg)
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={lotId}
                onChange={(e) => setLotId(e.target.value)}
                placeholder="Enter Lot ID (e.g. LOT-101)"
                className="w-full text-xs font-semibold px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:border-emerald-600"
              />
            )}
          </div>

          {/* Material */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              E-Waste Material
            </label>
            <select
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
              className="w-full text-xs font-semibold px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:border-emerald-600"
            >
              {MATERIALS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Estimated Weight (kg)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="5000"
                step="0.5"
                value={quantityKg}
                onChange={(e) => setQuantityKg(Math.max(1, parseFloat(e.target.value) || 1))}
                className="w-full text-xs font-semibold px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:border-emerald-600"
              />
              <span className="text-xs font-bold text-slate-500">kg</span>
            </div>
          </div>
        </div>

        {/* ─── Location & Service Method ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
          {/* Location Mode */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Collector Location
            </label>
            <div className="flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs mb-2">
              <button
                type="button"
                onClick={() => setLocationMode('MANUAL')}
                className={`flex-1 py-1.5 rounded-md font-bold transition ${
                  locationMode === 'MANUAL' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Area / PIN
              </button>
              <button
                type="button"
                onClick={requestGpsLocation}
                disabled={gpsLoading}
                className={`flex-1 py-1.5 rounded-md font-bold flex items-center justify-center gap-1 transition ${
                  locationMode === 'GPS' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Navigation size={12} className={gpsLoading ? 'animate-spin' : ''} />
                <span>GPS Live</span>
              </button>
              <button
                type="button"
                onClick={() => setLocationMode('PROFILE')}
                className={`flex-1 py-1.5 rounded-md font-bold transition ${
                  locationMode === 'PROFILE' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                My Profile
              </button>
            </div>

            {locationMode === 'MANUAL' && (
              <select
                value={selectedArea}
                onChange={(e) => {
                  setSelectedArea(e.target.value);
                  const a = BANGALORE_AREAS[e.target.value];
                  if (a) {
                    setUserLat(a.lat);
                    setUserLng(a.lng);
                  }
                }}
                className="w-full text-xs font-semibold px-3 py-2 border border-slate-200 rounded-lg bg-white"
              >
                {Object.keys(BANGALORE_AREAS).map((area) => (
                  <option key={area} value={area}>
                    {area}
                  </option>
                ))}
              </select>
            )}

            {locationMode === 'GPS' && (
              <div className="text-xs p-2 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-between">
                <span className="flex items-center gap-1 font-semibold">
                  <Navigation size={12} />
                  GPS Coords: {userLat?.toFixed(4)}, {userLng?.toFixed(4)}
                </span>
                <button
                  onClick={requestGpsLocation}
                  className="text-[10px] font-bold text-emerald-900 underline hover:no-underline"
                >
                  Refresh GPS
                </button>
              </div>
            )}

            {locationMode === 'PROFILE' && (
              <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-200">
                Registered Base: <strong>{profile?.location || DEFAULT_PROFILE.location}</strong>
              </p>
            )}

            {gpsError && (
              <p className="text-[11px] text-rose-600 mt-1 flex items-center gap-1">
                <AlertCircle size={12} /> {gpsError}
              </p>
            )}
          </div>

          {/* Service Method & Radius */}
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                Handover Logistics Method
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setServiceType('DROP_OFF')}
                  className={`p-2.5 rounded-xl border text-left transition flex items-start gap-2 ${
                    serviceType === 'DROP_OFF'
                      ? 'border-emerald-600 bg-emerald-50/60 ring-1 ring-emerald-600'
                      : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                  }`}
                >
                  <MapPin size={16} className={serviceType === 'DROP_OFF' ? 'text-emerald-700' : 'text-slate-400'} />
                  <div>
                    <p className="text-xs font-bold text-slate-900">Direct Drop-off</p>
                    <p className="text-[10px] text-slate-500">I will deliver to facility (₹0 fee)</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setServiceType('PICKUP')}
                  className={`p-2.5 rounded-xl border text-left transition flex items-start gap-2 ${
                    serviceType === 'PICKUP'
                      ? 'border-emerald-600 bg-emerald-50/60 ring-1 ring-emerald-600'
                      : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                  }`}
                >
                  <Truck size={16} className={serviceType === 'PICKUP' ? 'text-emerald-700' : 'text-slate-400'} />
                  <div>
                    <p className="text-xs font-bold text-slate-900">Doorstep Pickup</p>
                    <p className="text-[10px] text-slate-500">Request partner pickup vehicle</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Radius Slider */}
            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-[11px] font-bold text-slate-600">Search Radius:</span>
              <div className="flex items-center gap-1">
                {[15, 30, 50, 100].map((dist) => (
                  <button
                    key={dist}
                    type="button"
                    onClick={() => setMaxDistanceKm(dist)}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      maxDistanceKm === dist
                        ? 'bg-emerald-700 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {dist} km
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Partner Category Tabs ────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setPartnerTypeFilter('ALL')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
            partnerTypeFilter === 'ALL'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          All Eligible Facilities ({searchResult?.eligible_destinations.length ?? 0})
        </button>
        <button
          onClick={() => setPartnerTypeFilter('HUB')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
            partnerTypeFilter === 'HUB'
              ? 'bg-blue-700 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Building2 size={13} />
          Aggregation Hubs
        </button>
        <button
          onClick={() => setPartnerTypeFilter('RECYCLER')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
            partnerTypeFilter === 'RECYCLER'
              ? 'bg-purple-700 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Scale size={13} />
          Formal Recyclers (CPCB)
        </button>
      </div>

      {/* ─── Eligible Results ─────────────────────────────── */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <RefreshCw size={28} className="animate-spin mx-auto text-emerald-600" />
            <p className="text-sm font-semibold">Evaluating matching facilities against eligibility rules...</p>
          </div>
        ) : searchResult && searchResult.eligible_destinations.length > 0 ? (
          searchResult.eligible_destinations.map((match) => (
            <div
              key={match.partner.id}
              className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm hover:border-slate-300 transition space-y-3"
            >
              {/* Partner Card Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                        match.partner.type === 'HUB'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}
                    >
                      {match.partner.type === 'HUB' ? 'Aggregation Hub' : 'Formal Recycler'}
                    </span>
                    <h3 className="text-base font-bold text-slate-900">{match.partner.name}</h3>
                    {match.partner.verified && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold">
                        <ShieldCheck size={12} /> CPCB Verified
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <MapPin size={12} />
                    {match.partner.address} • {match.partner.district}
                    {match.distance_km != null && (
                      <span className="font-bold text-slate-700 ml-1">({match.distance_km} km away)</span>
                    )}
                  </p>
                </div>

                {/* Score & Badge */}
                <div className="flex items-center gap-2 self-start">
                  <button
                    onClick={() => setScoreBreakdownPartner(match)}
                    className="flex flex-col items-end px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 transition text-right"
                    title="Click to view explainable score breakdown"
                  >
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-0.5">
                      Match Score <Info size={10} />
                    </span>
                    <span className="text-lg font-black text-emerald-700 leading-none">
                      {match.final_score}
                      <span className="text-xs text-slate-400 font-normal">/100</span>
                    </span>
                  </button>
                </div>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-1.5">
                {match.recommendation_tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200"
                  >
                    ★ {tag}
                  </span>
                ))}
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  Reliability: {match.partner.reliabilityScore}%
                </span>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 flex items-center gap-1">
                  <Clock size={10} /> {match.partner.operatingHours}
                </span>
              </div>

              {/* Pricing & Net Calculation Bar */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="grid grid-cols-3 gap-2 sm:gap-4 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-bold">
                      Indicative Rate
                    </span>
                    <span className="font-black text-slate-900 text-sm">
                      ₹{match.indicative_rate_per_kg}
                      <span className="text-[10px] text-slate-500 font-normal"> / kg</span>
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-bold">
                      Pickup Deduction
                    </span>
                    <span className="font-semibold text-slate-700">
                      {match.indicative_pickup_fee > 0 ? `₹${match.indicative_pickup_fee}` : '₹0 (Free)'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-bold">
                      Est. Net Payout
                    </span>
                    <span className="font-black text-emerald-700 text-sm">
                      ₹{match.indicative_total_payout.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    onClick={() => setDetailPartner(match.partner)}
                    className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition"
                  >
                    Facility Details
                  </button>
                  <button
                    onClick={() => {
                      setBookingPartner(match);
                      setBookingError(null);
                    }}
                    className="px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-sm flex items-center gap-1 transition"
                  >
                    <span>Request Quote & Handover</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-3">
            <AlertCircle size={36} className="mx-auto text-slate-400" />
            <h3 className="text-base font-bold text-slate-800">No Eligible Facilities Found</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              No active facilities meet all hard eligibility requirements (material acceptance, minimum intake weight,
              and service method) within {maxDistanceKm} km.
            </p>
          </div>
        )}
      </div>

      {/* ─── Ineligible Facilities Drawer ──────────────────── */}
      {searchResult && searchResult.ineligible_destinations.length > 0 && (
        <div className="border border-slate-200 rounded-2xl bg-white overflow-hidden shadow-sm">
          <button
            onClick={() => setShowIneligible(!showIneligible)}
            className="w-full px-5 py-3.5 bg-slate-50 hover:bg-slate-100 flex items-center justify-between transition text-left"
          >
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-amber-600" />
              <span className="text-xs font-bold text-slate-800">
                Ineligible Facilities ({searchResult.ineligible_destinations.length})
              </span>
              <span className="text-[11px] text-slate-500">
                — Why certain facilities were excluded from matching
              </span>
            </div>
            <span className="text-xs font-bold text-emerald-800">
              {showIneligible ? 'Hide Reasons ▲' : 'View Ineligible Facilities ▼'}
            </span>
          </button>

          {showIneligible && (
            <div className="p-4 divide-y divide-slate-100 space-y-3">
              {searchResult.ineligible_destinations.map((inelig) => (
                <div key={inelig.partner.id} className="pt-3 first:pt-0 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">{inelig.partner.name}</span>
                      <span className="badge text-[10px] bg-slate-100 text-slate-600">{inelig.partner.type}</span>
                    </div>
                    {inelig.distance_km != null && (
                      <span className="text-xs text-slate-500">{inelig.distance_km} km away</span>
                    )}
                  </div>

                  <ul className="space-y-1">
                    {inelig.reasons.map((r, i) => (
                      <li key={i} className="text-[11px] text-rose-700 flex items-start gap-1.5">
                        <span className="text-rose-500 font-bold">•</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── MODAL: Score Breakdown ───────────────────────── */}
      {scoreBreakdownPartner && (
        <div className="modal-overlay" onClick={() => setScoreBreakdownPartner(null)}>
          <div className="modal-panel p-5 max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Explainable Match Score</h3>
                <p className="text-xs text-slate-500">{scoreBreakdownPartner.partner.name}</p>
              </div>
              <button
                onClick={() => setScoreBreakdownPartner(null)}
                className="p-1 rounded-lg hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>

            <div className="text-center py-2 bg-emerald-50 rounded-xl border border-emerald-200">
              <span className="text-[10px] uppercase font-bold text-emerald-800">Composite Score</span>
              <p className="text-3xl font-black text-emerald-800">
                {scoreBreakdownPartner.final_score}
                <span className="text-sm font-normal text-slate-500"> / 100</span>
              </p>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">Price Offer (35% weight):</span>
                <span className="font-bold text-slate-900">
                  {scoreBreakdownPartner.score_breakdown.price_score} / 100
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">Distance Proximity (25% weight):</span>
                <span className="font-bold text-slate-900">
                  {scoreBreakdownPartner.score_breakdown.distance_score} / 100
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">Logistics Availability (15% weight):</span>
                <span className="font-bold text-slate-900">
                  {scoreBreakdownPartner.score_breakdown.service_score} / 100
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">Facility Reliability (15% weight):</span>
                <span className="font-bold text-slate-900">
                  {scoreBreakdownPartner.score_breakdown.reliability_score} / 100
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">Price Freshness (10% weight):</span>
                <span className="font-bold text-slate-900">
                  {scoreBreakdownPartner.score_breakdown.freshness_score} / 100
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 italic">
              Scores are calculated dynamically without opaque bias to ensure transparent and competitive returns
              for informal collectors.
            </p>
          </div>
        </div>
      )}

      {/* ─── MODAL: Facility Details ──────────────────────── */}
      {detailPartner && (
        <div className="modal-overlay" onClick={() => setDetailPartner(null)}>
          <div className="modal-panel p-5 max-w-lg space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">{detailPartner.name}</h3>
                <p className="text-xs text-slate-500">
                  CPCB Reg: {detailPartner.cpcbRegistrationNumber || 'Official Approved Registry'}
                </p>
              </div>
              <button onClick={() => setDetailPartner(null)} className="p-1 rounded-lg hover:bg-slate-100">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Facility Scope</span>
                <p className="font-semibold text-slate-800">{detailPartner.facilityScope || 'General E-Waste Aggregation'}</p>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Address & Contact</span>
                <p className="text-slate-700">{detailPartner.address}, {detailPartner.district}</p>
                <p className="text-slate-700 mt-0.5">Contact: {detailPartner.contactPerson} ({detailPartner.phone})</p>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Batch Capacity</span>
                <p className="text-slate-700">
                  Min: <strong>{detailPartner.minQuantityKg} kg</strong> • Max: <strong>{detailPartner.maxQuantityKg} kg</strong>
                </p>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Accepted Materials & Rates</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {Object.entries(detailPartner.ratesPerKg).map(([mat, rate]) => (
                    <div key={mat} className="p-2 rounded-lg bg-slate-50 border border-slate-200 flex justify-between">
                      <span className="truncate pr-1 text-slate-700">{mat}</span>
                      <span className="font-bold text-emerald-800">₹{rate}/kg</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: Handover Quote & Booking ─────────────── */}
      {bookingPartner && (
        <div className="modal-overlay" onClick={() => !submittingBooking && setBookingPartner(null)}>
          <div className="modal-panel p-5 max-w-lg space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-black text-slate-900 text-base">Request Handover Quote</h3>
                <p className="text-xs text-slate-500">Destination: {bookingPartner.partner.name}</p>
              </div>
              {!submittingBooking && (
                <button onClick={() => setBookingPartner(null)} className="p-1 rounded-lg hover:bg-slate-100">
                  <X size={16} />
                </button>
              )}
            </div>

            {bookingSuccessManifest ? (
              <div className="text-center py-4 space-y-3">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 size={28} />
                </div>
                <h4 className="text-base font-black text-slate-900">Handover Quota Locked & Confirmed!</h4>
                <p className="text-xs text-slate-600">
                  Your formal quote has been locked. Show this 6-digit manifest code at facility intake or to pickup driver:
                </p>
                <div className="p-3 bg-slate-900 text-emerald-400 font-mono text-xl font-black rounded-xl tracking-wider">
                  {bookingSuccessManifest}
                </div>
                <div className="pt-2 flex gap-2">
                  <button
                    onClick={() => navigate('/handovers')}
                    className="w-full btn-primary py-2.5 text-xs rounded-xl"
                  >
                    View My Handovers Timeline
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                {bookingError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2">
                    <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Booking Error</p>
                      <p className="text-[11px] mt-0.5">{bookingError}</p>
                    </div>
                  </div>
                )}

                {/* Handover summary */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Selected Lot:</span>
                    <span className="font-bold text-slate-900">#{lotId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Material & Est. Weight:</span>
                    <span className="font-bold text-slate-900">{material} ({quantityKg} kg)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Offered Rate:</span>
                    <span className="font-bold text-slate-900">₹{bookingPartner.indicative_rate_per_kg} / kg</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Logistics Method:</span>
                    <span className="font-bold text-slate-900">
                      {serviceType === 'PICKUP' ? 'Doorstep Pickup (Fee: ₹' + bookingPartner.indicative_pickup_fee + ')' : 'Self Drop-off (₹0 Fee)'}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-200 text-sm">
                    <span className="font-bold text-slate-900">Estimated Net Payout:</span>
                    <span className="font-black text-emerald-700">₹{bookingPartner.indicative_total_payout.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {/* Date Selection */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Scheduled Handover Date
                  </label>
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="w-full text-xs font-semibold px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  />
                </div>

                {/* Optional Notes */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Special Handover Instructions (Optional)
                  </label>
                  <input
                    type="text"
                    value={bookingNotes}
                    onChange={(e) => setBookingNotes(e.target.value)}
                    placeholder="e.g. Bring small tare bags, available between 10 AM - 1 PM"
                    className="w-full text-xs font-semibold px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  />
                </div>

                {/* Verification & Weighing Clause */}
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900">
                  <p className="font-bold">Transparent Scale Weight Clause:</p>
                  <p className="mt-0.5">
                    This quote is locked for 48 hours. Final payment will be recalculated based on certified digital scale weight
                    and grade inspection upon receipt at the destination facility.
                  </p>
                </div>

                {/* Actions */}
                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setBookingPartner(null)}
                    className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmBooking}
                    disabled={submittingBooking}
                    className="px-5 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-sm transition flex items-center gap-1.5"
                  >
                    {submittingBooking && <RefreshCw size={12} className="animate-spin" />}
                    <span>Confirm & Generate Manifest</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
