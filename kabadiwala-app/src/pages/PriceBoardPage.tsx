import React, { useCallback, useContext, useEffect, useState } from 'react';
import {
  TrendingUp, Info, PlusCircle, Edit3,
  ToggleLeft, ToggleRight, CheckCircle2, XCircle,
  AlertTriangle, Building2, Tag, MapPin,
  ShieldCheck, ArrowRight, Loader2, WifiOff,
} from 'lucide-react';
import { RoleContext } from '../App';
import type { IndicativePrice, HubBuyingOffer } from '../lib/db';
import {
  fetchIndicativePrices,
  createIndicativePrice,
  updateIndicativePrice,
  setIndicativePriceStatus,
  fetchHubOffers,
  setHubOfferStatus,
  createHubOffer,
  comparePrices,
  initiatePricingTransaction,
  type PriceComparisonResult,
} from '../lib/pricingService';
import { getCurrentSession } from '../lib/authService';

const MATERIAL_CATEGORIES = [
  'Circuit Boards (PCB)',
  'Copper Cables',
  'Mobile Phones',
  'Lithium-ion Batteries',
  'Hard Drives and Storage',
  'CRT or LCD Monitors',
  'Mixed E-Waste',
];

const MATERIAL_ICON: Record<string, string> = {
  'Circuit Boards (PCB)': '🟩',
  'Copper Cables': '🔌',
  'Mobile Phones': '📱',
  'Lithium-ion Batteries': '🔋',
  'Hard Drives and Storage': '💿',
  'CRT or LCD Monitors': '🖥️',
  'Mixed E-Waste': '♻️',
};

function IndicativeBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-200">
      <Info size={10} /> Indicative
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  const c: Record<string, string> = {
    published: 'bg-green-100 text-green-700',
    active: 'bg-green-100 text-green-700',
    draft: 'bg-gray-100 text-gray-500',
    expired: 'bg-red-100 text-red-600',
    withdrawn: 'bg-orange-100 text-orange-600',
  };
  return (
    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${c[status] ?? 'bg-gray-100 text-gray-500'}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// =============================================================================
// ADMIN VIEW
// =============================================================================
function AdminPriceManagement() {
  const [prices, setPrices] = useState<IndicativePrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<IndicativePrice | null>(null);
  const blank = {
    material: MATERIAL_CATEGORIES[0], grade: '', minPrice: '', maxPrice: '',
    unit: 'kg', location: 'Bengaluru Urban', sourceName: '', isSample: true,
    sourceDate: new Date().toISOString().slice(0, 10),
    effectiveDate: new Date().toISOString().slice(0, 10),
    expiryDate: '', status: 'published' as 'published' | 'draft' | 'expired',
  };
  const [form, setForm] = useState(blank);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetchIndicativePrices(undefined, 'all');
    setPrices(r.prices); setOffline(r.offlineFallback); setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const resetForm = () => { setForm(blank); setEditing(null); setFormError(''); };
  const openEdit = (p: IndicativePrice) => {
    setEditing(p);
    setForm({
      material: p.material, grade: p.grade,
      minPrice: String(p.minPrice), maxPrice: String(p.maxPrice),
      unit: p.unit, location: p.location, sourceName: p.sourceName,
      sourceDate: p.sourceDate, effectiveDate: p.effectiveDate,
      expiryDate: p.expiryDate, status: p.status, isSample: p.isSample,
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setFormError('');
    const minP = parseFloat(form.minPrice), maxP = parseFloat(form.maxPrice);
    if (isNaN(minP) || isNaN(maxP)) return setFormError('Enter valid prices.');
    if (minP < 0 || maxP < 0) return setFormError('Prices must be non-negative.');
    if (minP > maxP) return setFormError('Min cannot exceed max.');
    if (!form.grade.trim()) return setFormError('Grade is required.');
    setSaving(true);
    const payload = {
      material: form.material, grade: form.grade, minPrice: minP, maxPrice: maxP,
      unit: form.unit, location: form.location, sourceName: form.sourceName,
      sourceDate: form.sourceDate, effectiveDate: form.effectiveDate,
      expiryDate: form.expiryDate || new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10),
      status: form.status, isSample: form.isSample,
    };
    const result = editing
      ? await updateIndicativePrice(editing.id, payload)
      : await createIndicativePrice(payload);
    setSaving(false);
    if (result.success) { setShowForm(false); resetForm(); load(); }
    else setFormError(result.error || 'Failed to save.');
  };

  const toggle = async (p: IndicativePrice) => {
    await setIndicativePriceStatus(p.id, p.status === 'published' ? 'expired' : 'published');
    load();
  };

  const field = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500';

  return (
    <div className="max-w-3xl mx-auto px-4 py-5 space-y-5 pb-28 sm:pb-12">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-black text-[#1f2937]">📊 Indicative Price Management</h1>
          <p className="text-sm text-[#64748b] mt-0.5">Publish regulatory benchmarks. These are indicative references, not binding offers.</p>
        </div>
        <div className="flex items-center gap-2">
          {offline && <span className="flex items-center gap-1 text-xs text-orange-600"><WifiOff size={12} /> Offline</span>}
          <button onClick={() => { resetForm(); setShowForm(true); }}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors">
            <PlusCircle size={15} /> Add Price
          </button>
        </div>
      </div>

      {showForm && (
        <div className="kc-card p-5 border-2 border-blue-200 bg-blue-50/30">
          <h2 className="text-base font-bold text-[#1f2937] mb-4">{editing ? 'Edit Indicative Price' : 'New Indicative Price'}</h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">Material *</label>
                <select value={form.material} onChange={e => setForm(f => ({ ...f, material: e.target.value }))} className={field}>
                  {MATERIAL_CATEGORIES.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">Grade *</label>
                <input type="text" value={form.grade} onChange={e => setForm(f => ({ ...f, grade: e.target.value }))}
                  placeholder="e.g. High-Grade Telecom PCBs" required className={field} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">Min Price (Rs/kg) *</label>
                <input type="number" min="0" step="0.01" value={form.minPrice}
                  onChange={e => setForm(f => ({ ...f, minPrice: e.target.value }))} required className={field} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">Max Price (Rs/kg) *</label>
                <input type="number" min="0" step="0.01" value={form.maxPrice}
                  onChange={e => setForm(f => ({ ...f, maxPrice: e.target.value }))} required className={field} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">Location</label>
                <input type="text" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} className={field} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">Source Name</label>
                <input type="text" value={form.sourceName} onChange={e => setForm(f => ({ ...f, sourceName: e.target.value }))}
                  placeholder="e.g. CPCB Bulletin Q4" className={field} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">Effective Date</label>
                <input type="date" value={form.effectiveDate} onChange={e => setForm(f => ({ ...f, effectiveDate: e.target.value }))} className={field} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">Expiry Date</label>
                <input type="date" value={form.expiryDate} onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))} className={field} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">Status</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))} className={field}>
                  <option value="published">Published</option>
                  <option value="draft">Draft</option>
                  <option value="expired">Expired</option>
                </select>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <input type="checkbox" id="isSample" checked={form.isSample}
                  onChange={e => setForm(f => ({ ...f, isSample: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600" />
                <label htmlFor="isSample" className="text-sm text-[#374151]">Mark as demo/sample data</label>
              </div>
            </div>
            {formError && (
              <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 p-3 rounded-lg">
                <AlertTriangle size={14} /> {formError}
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                {saving ? 'Saving...' : (editing ? 'Update Price' : 'Publish Price')}
              </button>
              <button type="button" onClick={() => { setShowForm(false); resetForm(); }}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-200 transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="kc-card p-3 flex items-start gap-2 bg-amber-50 border border-amber-200">
        <Info size={14} color="#b45309" className="flex-shrink-0 mt-0.5" />
        <p className="text-xs text-[#92400e]">
          <strong>Regulatory Notice:</strong> All prices are indicative market reference benchmarks. Not binding buying commitments.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 size={24} className="animate-spin text-[#64748b]" /></div>
      ) : prices.length === 0 ? (
        <div className="kc-card p-8 text-center text-[#64748b]">
          <TrendingUp size={32} className="mx-auto mb-2 opacity-30" />
          <p className="font-semibold">No price records yet. Click Add Price to publish your first benchmark.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {prices.map(p => (
            <div key={p.id} className="kc-card p-4">
              <div className="flex items-start gap-3">
                <div className="text-2xl w-9 flex-shrink-0">{MATERIAL_ICON[p.material] || '♻️'}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-[#1f2937]">{p.material}</p>
                    <IndicativeBadge />
                    <StatusPill status={p.status} />
                    {p.isSample && <span className="text-xs px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded-full font-semibold">Demo</span>}
                  </div>
                  <p className="text-xs text-[#64748b] mt-0.5">{p.grade}</p>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="text-lg font-black text-blue-700">Rs.{p.minPrice}–{p.maxPrice}</span>
                    <span className="text-xs text-[#64748b]">/{p.unit} · {p.location}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[#64748b] mt-1 flex-wrap">
                    <span>Source: {p.sourceName || '—'}</span>
                    <span>Valid till {p.expiryDate || '—'}</span>
                    <span>By {p.updatedBy}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button onClick={() => openEdit(p)} title="Edit"
                    className="p-1.5 text-[#64748b] hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                    <Edit3 size={15} />
                  </button>
                  <button onClick={() => toggle(p)} title={p.status === 'published' ? 'Expire' : 'Re-publish'}
                    className={`p-1.5 rounded-lg transition-colors ${p.status === 'published' ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-50'}`}>
                    {p.status === 'published' ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// HUB VIEW
// =============================================================================
function HubRateCard() {
  const session = getCurrentSession();
  const hubId = (session?.businessProfile as any)?.id || 'HUB-BLR-01';
  const [offers, setOffers] = useState<HubBuyingOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const blankOffer = {
    material: MATERIAL_CATEGORIES[0], grade: '', rate: '', minQuantityKg: '5',
    supportedServices: ['DROP_OFF'] as string[],
    pickupFee: '0', applicableArea: '', validTill: '', termsNote: '',
  };
  const [form, setForm] = useState(blankOffer);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetchHubOffers(undefined, hubId, 'all');
    setOffers(r.offers); setOffline(r.offlineFallback); setLoading(false);
  }, [hubId]);
  useEffect(() => { load(); }, [load]);

  const srvToggle = (srv: string) => setForm(f => ({
    ...f,
    supportedServices: f.supportedServices.includes(srv)
      ? f.supportedServices.filter(s => s !== srv)
      : [...f.supportedServices, srv],
  }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setFormError('');
    const rate = parseFloat(form.rate);
    const minQ = parseFloat(form.minQuantityKg);
    const pFee = parseFloat(form.pickupFee || '0');
    if (isNaN(rate) || rate <= 0) return setFormError('Rate must be positive.');
    if (isNaN(minQ) || minQ < 0) return setFormError('Min quantity must be non-negative.');
    if (!form.grade.trim()) return setFormError('Grade is required.');
    if (!form.applicableArea.trim()) return setFormError('Service zone is required.');
    if (form.supportedServices.length === 0) return setFormError('Select at least one service type.');
    setSaving(true);
    const result = await createHubOffer({
      hubId,
      hubName: (session?.businessProfile as any)?.businessName || 'Hub Facility',
      hubVerificationStatus: 'approved',
      material: form.material, grade: form.grade, rate, unit: 'kg',
      minQuantityKg: minQ, supportedServices: form.supportedServices as any,
      pickupFee: pFee, applicableArea: form.applicableArea,
      validFrom: new Date().toISOString().slice(0, 10),
      validTill: form.validTill || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      status: 'active', termsNote: form.termsNote,
    }, hubId);
    setSaving(false);
    if (result.success) { setShowForm(false); setForm(blankOffer); load(); }
    else setFormError(result.error || 'Failed to publish offer.');
  };

  const withdraw = async (id: string) => { await setHubOfferStatus(id, 'withdrawn', hubId); load(); };
  const field = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500';

  return (
    <div className="max-w-3xl mx-auto px-4 py-5 space-y-5 pb-28 sm:pb-12">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-black text-[#1f2937]">🏷️ Rate Card and Buying Offers</h1>
          <p className="text-sm text-[#64748b] mt-0.5">Broadcast guaranteed buying rates to collectors in your service area.</p>
        </div>
        <div className="flex items-center gap-2">
          {offline && <span className="flex items-center gap-1 text-xs text-orange-600"><WifiOff size={12} /> Cached</span>}
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors">
            <PlusCircle size={15} /> New Offer
          </button>
        </div>
      </div>

      {showForm && (
        <div className="kc-card p-5 border-2 border-blue-200 bg-blue-50/30">
          <h2 className="text-base font-bold text-[#1f2937] mb-4">Publish Buying Offer</h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">Material *</label>
                <select value={form.material} onChange={e => setForm(f => ({ ...f, material: e.target.value }))} className={field}>
                  {MATERIAL_CATEGORIES.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">Grade/Quality Spec *</label>
                <input type="text" value={form.grade} onChange={e => setForm(f => ({ ...f, grade: e.target.value }))}
                  placeholder="e.g. Stripped Copper" required className={field} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">Guaranteed Rate (Rs/kg) *</label>
                <input type="number" min="0.01" step="0.01" value={form.rate}
                  onChange={e => setForm(f => ({ ...f, rate: e.target.value }))} required className={field} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">Min Quantity (kg)</label>
                <input type="number" min="0" step="0.5" value={form.minQuantityKg}
                  onChange={e => setForm(f => ({ ...f, minQuantityKg: e.target.value }))} className={field} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">Service Zone/Area *</label>
                <input type="text" value={form.applicableArea}
                  onChange={e => setForm(f => ({ ...f, applicableArea: e.target.value }))}
                  placeholder="e.g. K.R. Puram, East Bengaluru" required className={field} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">Valid Until</label>
                <input type="date" value={form.validTill}
                  onChange={e => setForm(f => ({ ...f, validTill: e.target.value }))} className={field} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1">Supported Services *</label>
              <div className="flex gap-3">
                {['DROP_OFF', 'PICKUP'].map(srv => (
                  <label key={srv} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={form.supportedServices.includes(srv)}
                      onChange={() => srvToggle(srv)} className="h-4 w-4 rounded border-gray-300 text-blue-600" />
                    <span className="text-sm text-[#374151]">{srv === 'DROP_OFF' ? 'Drop-off at Godown' : 'Doorstep Pickup'}</span>
                  </label>
                ))}
              </div>
            </div>
            {form.supportedServices.includes('PICKUP') && (
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">Pickup Fee (Rs)</label>
                <input type="number" min="0" step="1" value={form.pickupFee}
                  onChange={e => setForm(f => ({ ...f, pickupFee: e.target.value }))} className={field} />
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1">Terms Note</label>
              <textarea value={form.termsNote} onChange={e => setForm(f => ({ ...f, termsNote: e.target.value }))}
                placeholder="e.g. Digital weighbridge on site." rows={2}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none" />
            </div>
            {formError && (
              <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 p-3 rounded-lg">
                <AlertTriangle size={14} /> {formError}
              </div>
            )}
            <div className="flex gap-2">
              <button type="submit" disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                {saving ? 'Publishing...' : 'Broadcast Offer'}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-200 transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 size={24} className="animate-spin text-[#64748b]" /></div>
      ) : offers.length === 0 ? (
        <div className="kc-card p-8 text-center text-[#64748b]">
          <Tag size={32} className="mx-auto mb-2 opacity-30" />
          <p className="font-semibold">No active buying offers.</p>
          <p className="text-sm mt-1">Publish a guaranteed rate so collectors can find you.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {offers.map(o => (
            <div key={o.id} className="kc-card p-4">
              <div className="flex items-start gap-3">
                <div className="text-2xl">{MATERIAL_ICON[o.material] || '♻️'}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <p className="font-bold text-[#1f2937]">{o.material}</p>
                    <StatusPill status={o.status} />
                    <span className="text-xs text-[#64748b]">Valid till {o.validTill}</span>
                  </div>
                  <p className="text-xs text-[#64748b]">{o.grade}</p>
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    <span className="text-xl font-black text-green-700">Rs.{o.rate}</span>
                    <span className="text-xs text-[#64748b]">/{o.unit} · Min {o.minQuantityKg} kg</span>
                    {o.supportedServices.includes('PICKUP') && (
                      <span className="text-xs text-blue-600">Pickup Fee: Rs.{o.pickupFee}</span>
                    )}
                  </div>
                  <p className="text-xs text-[#64748b] mt-1">Area: {o.applicableArea}</p>
                  {o.termsNote && <p className="text-xs text-[#94a3b8] mt-0.5 italic">{o.termsNote}</p>}
                </div>
                {o.status === 'active' && (
                  <button onClick={() => withdraw(o.id)}
                    className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-orange-600 border border-orange-200 rounded-lg hover:bg-orange-50 transition-colors">
                    <XCircle size={13} /> Withdraw
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// COLLECTOR VIEW
// =============================================================================
function CollectorPriceComparison() {
  const [material, setMaterial] = useState(MATERIAL_CATEGORIES[0]);
  const [quantityKg, setQuantityKg] = useState('');
  const [area, setArea] = useState('');
  const [result, setResult] = useState<PriceComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [booking, setBooking] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState<string | null>(null);

  const handleSearch = async () => {
    setLoading(true); setResult(null); setBookingSuccess(null);
    const res = await comparePrices({
      material,
      quantityKg: quantityKg ? parseFloat(quantityKg) : undefined,
      area: area || undefined,
    });
    setResult(res); setLoading(false);
  };

  const handleBook = async (offerId: string) => {
    if (!quantityKg || isNaN(parseFloat(quantityKg))) { alert('Enter quantity first.'); return; }
    setBooking(offerId);
    const session = getCurrentSession();
    const collectorId = (session?.user as any)?.collectorId || 'KAB-DEMO-001';
    const collectorName = session?.user?.fullName || 'Demo Collector';
    const lotId = 'LOT-PRICE-' + Date.now().toString(36).toUpperCase();
    const res = await initiatePricingTransaction(offerId, lotId, collectorId, collectorName, parseFloat(quantityKg), 'DROP_OFF');
    setBooking(null);
    if (res.success && res.transaction) {
      setBookingSuccess(
        'Offer booked! Manifest: ' + res.transaction.manifestCode +
        ' · Rate: Rs.' + res.transaction.acceptedRate + '/kg. See My Handovers to track.'
      );
    } else { alert(res.error || 'Failed to book offer. Please try again.'); }
  };

  const field = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500';

  return (
    <div className="max-w-2xl mx-auto px-4 py-5 space-y-5 pb-28 sm:pb-12">
      <div>
        <h1 className="text-xl font-black text-[#1f2937]">🔍 Compare E-Waste Prices</h1>
        <p className="text-sm text-[#64748b] mt-0.5">Find the best rate. Indicative market bands vs actual hub buying offers side-by-side.</p>
      </div>

      <div className="kc-card p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[#374151] mb-1">Material</label>
            <select value={material} onChange={e => setMaterial(e.target.value)} className={field}>
              {MATERIAL_CATEGORIES.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#374151] mb-1">Quantity (kg)</label>
            <input type="number" min="0.1" step="0.5" value={quantityKg}
              onChange={e => setQuantityKg(e.target.value)} placeholder="e.g. 12.5" className={field} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#374151] mb-1">Your Area (optional)</label>
            <input type="text" value={area} onChange={e => setArea(e.target.value)}
              placeholder="e.g. K.R. Puram" className={field} />
          </div>
        </div>
        <button onClick={handleSearch} disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <TrendingUp size={16} />}
          {loading ? 'Comparing...' : 'Compare Prices'}
        </button>
      </div>

      {bookingSuccess && (
        <div className="kc-card p-4 flex items-start gap-2 bg-green-50 border border-green-200">
          <CheckCircle2 size={16} color="#166534" className="flex-shrink-0 mt-0.5" />
          <p className="text-sm text-green-800 font-semibold">{bookingSuccess}</p>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          {result.offline_fallback && (
            <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg text-xs text-orange-700">
              <WifiOff size={12} /> Offline — showing locally cached prices.
            </div>
          )}

          {result.indicative_reference && (
            <div className="kc-card p-4 border-l-4 border-blue-400 bg-blue-50/40">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck size={16} color="#1d4ed8" />
                <p className="text-sm font-bold text-blue-800">CPCB Market Benchmark (Indicative)</p>
                <IndicativeBadge />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-blue-800">
                  Rs.{result.indicative_reference.minPrice}–Rs.{result.indicative_reference.maxPrice}
                </span>
                <span className="text-sm text-blue-600">/{result.indicative_reference.unit}</span>
              </div>
              {quantityKg && parseFloat(quantityKg) > 0 && (
                <p className="text-xs text-blue-600 mt-1">
                  Indicative for {quantityKg} kg: Rs.{Math.round(parseFloat(quantityKg) * result.indicative_reference.minPrice)}–Rs.{Math.round(parseFloat(quantityKg) * result.indicative_reference.maxPrice)}
                </p>
              )}
              <p className="text-xs text-blue-700 mt-1.5 italic">{result.indicative_notice}</p>
              <p className="text-xs text-[#64748b] mt-0.5">
                Source: {result.indicative_reference.sourceName} · {result.indicative_reference.location} · Grade: {result.indicative_reference.grade}
              </p>
            </div>
          )}

          <div>
            <p className="text-sm font-bold text-[#374151] mb-2">Hub Buying Offers ({result.count_eligible} eligible)</p>
            {result.count_eligible === 0 && (
              <div className="kc-card p-6 text-center text-[#64748b]">
                <Building2 size={28} className="mx-auto mb-2 opacity-30" />
                <p className="font-semibold">No eligible offers right now</p>
                <p className="text-sm mt-1">{result.empty_reason || 'Adjust your search or check back later.'}</p>
              </div>
            )}
            <div className="space-y-3">
              {result.eligible_offers.map((o, i) => {
                const isBooking = booking === o.id;
                return (
                  <div key={o.id} className={`kc-card p-4${i === 0 ? ' border-2 border-green-300' : ''}`}>
                    {i === 0 && result.count_eligible > 1 && (
                      <div className="flex items-center gap-1 mb-2">
                        <TrendingUp size={12} color="#166534" />
                        <span className="text-xs font-bold text-green-700">Best Rate</span>
                      </div>
                    )}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-[#1f2937]">{o.hubName}</p>
                          <span className="flex items-center gap-0.5 text-xs text-green-700 font-semibold">
                            <ShieldCheck size={11} /> Verified Hub
                          </span>
                        </div>
                        <p className="text-xs text-[#64748b] mt-0.5">{o.grade}</p>
                        <div className="flex items-baseline gap-2 mt-1.5">
                          <span className="text-2xl font-black text-green-700">Rs.{o.rate}</span>
                          <span className="text-sm text-[#64748b]">/{o.unit}</span>
                        </div>
                        {quantityKg && o.calculated_gross != null && (
                          <div className="mt-1.5 space-y-0.5">
                            <p className="text-sm font-semibold text-[#1f2937]">
                              Gross: Rs.{o.calculated_gross}
                              {(o.pickupFee ?? 0) > 0 && <span className="text-xs text-[#64748b]"> minus Rs.{o.pickupFee} pickup</span>}
                            </p>
                            {o.calculated_net != null && (
                              <p className="text-base font-black text-green-700">Net Payable: Rs.{o.calculated_net}</p>
                            )}
                          </div>
                        )}
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-[#64748b] flex-wrap">
                          <span><MapPin size={10} className="inline" /> {o.applicableArea}</span>
                          <span>Min {o.minQuantityKg} kg</span>
                          <span>Valid till {o.validTill}</span>
                        </div>
                        {o.supportedServices?.includes('PICKUP') && (
                          <span className="inline-flex items-center gap-0.5 mt-1 text-xs text-blue-600">Doorstep Pickup Available</span>
                        )}
                        {o.termsNote && <p className="text-xs text-[#94a3b8] mt-1 italic">{o.termsNote}</p>}
                      </div>
                      <button onClick={() => handleBook(o.id)} disabled={isBooking}
                        className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 disabled:opacity-60 transition-colors">
                        {isBooking ? <Loader2 size={12} className="animate-spin" /> : <ArrowRight size={13} />}
                        {isBooking ? 'Booking...' : 'Select and Book'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {result.count_ineligible > 0 && (
            <div>
              <p className="text-sm font-bold text-[#374151] mb-2">Ineligible Offers ({result.count_ineligible})</p>
              <div className="space-y-2">
                {result.ineligible_offers.map(o => (
                  <div key={o.id} className="kc-card p-3 border border-gray-100 opacity-70">
                    <div className="flex items-start gap-2">
                      <XCircle size={14} color="#b91c1c" className="flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-[#374151]">{o.hubName} — Rs.{o.rate}/{o.unit}</p>
                        <ul className="mt-1 space-y-0.5">
                          {o.reasons.map((r, ri) => <li key={ri} className="text-xs text-red-600">· {r}</li>)}
                        </ul>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="kc-card p-3 flex items-start gap-2">
            <Info size={14} color="#1d4ed8" className="flex-shrink-0 mt-0.5" />
            <p className="text-xs text-[#64748b]">
              <strong className="text-[#1f2937]">Rate Transparency:</strong> Final payment = (scale weight × rate) minus disclosed deductions.
              All deductions require explicit collector approval at intake.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// RECYCLER VIEW (read-only)
// =============================================================================
function RecyclerMarketRates() {
  const [prices, setPrices] = useState<IndicativePrice[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetchIndicativePrices(undefined, 'published').then(r => { setPrices(r.prices); setLoading(false); });
  }, []);

  return (
    <div className="max-w-2xl mx-auto px-4 py-5 space-y-5 pb-28 sm:pb-12">
      <div>
        <h1 className="text-xl font-black text-[#1f2937]">📈 Market Reference Rates</h1>
        <p className="text-sm text-[#64748b] mt-0.5">Current CPCB indicative price benchmarks for e-waste materials.</p>
      </div>
      <div className="kc-card p-3 flex items-start gap-2 bg-amber-50 border border-amber-200">
        <Info size={14} color="#b45309" className="flex-shrink-0 mt-0.5" />
        <p className="text-xs text-[#92400e]">
          These are indicative regulatory benchmarks, not binding offers. Actual transaction rates depend on grade and negotiation.
        </p>
      </div>
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 size={24} className="animate-spin text-[#64748b]" /></div>
      ) : (
        <div className="space-y-3">
          {prices.map(p => (
            <div key={p.id} className="kc-card p-4 flex items-center gap-4">
              <div className="text-3xl w-10 flex-shrink-0">{MATERIAL_ICON[p.material] || '♻️'}</div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[#1f2937]">{p.material}</p>
                <p className="text-xs text-[#64748b]">{p.grade}</p>
                <p className="text-xs text-[#94a3b8] mt-0.5">Source: {p.sourceName} · {p.location}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xl font-black text-blue-700">Rs.{p.minPrice}–{p.maxPrice}</p>
                <IndicativeBadge />
                <p className="text-xs text-[#64748b] mt-0.5">/{p.unit}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// MAIN ROUTER
// =============================================================================
export default function PriceBoardPage() {
  const { role } = useContext(RoleContext);
  if (role === 'ADMIN') return <AdminPriceManagement />;
  if (role === 'HUB') return <HubRateCard />;
  if (role === 'COLLECTOR') return <CollectorPriceComparison />;
  return <RecyclerMarketRates />;
}
