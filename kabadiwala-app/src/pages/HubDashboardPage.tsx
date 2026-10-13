import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import {
  db, type Lot, type HubPurchase, type Payment,
  DEMO_HUBS, DEMO_ACTIVE_HUB_ID, ensureDemoData
} from '../lib/db';
import {
  acceptLotRequest, rejectLotRequest,
  receiveLotAtHub, recordHubPayment
} from '../lib/hubService';
import { PurchaseReceiptModal } from '../components/PurchaseReceiptModal';
import {
  Building2, Package, Scale, CheckCircle2, XCircle, Clock,
  Truck, Filter, AlertTriangle, ArrowRight,
  User, Banknote, ChevronDown, X, AlertCircle
} from 'lucide-react';

const MATERIAL_OPTIONS = ['All Materials', 'Circuit Boards (PCB)', 'Copper Cables', 'Mobile Phones'];

const STATUS_TABS = [
  { id: 'ALL',      label: 'All' },
  { id: 'REQUESTED',label: 'Requests' },
  { id: 'ACCEPTED', label: 'Accepted' },
  { id: 'RECEIVED', label: 'At Scale' },
  { id: 'UNPAID',   label: 'Unpaid' },
  { id: 'PAID',     label: 'Paid' },
  { id: 'REJECTED', label: 'Rejected' },
];

function LotStatusBadge({ status }: { status: Lot['status'] }) {
  const MAP: Record<string, { cls: string; label: string }> = {
    PENDING:                        { cls: 'badge-neutral', label: 'Logged' },
    REQUESTED:                      { cls: 'badge-warning', label: 'Hub Reviewing' },
    ACCEPTED:                       { cls: 'badge-active',  label: 'Accepted' },
    RECEIVED:                       { cls: 'badge-active',  label: 'At Scale' },
    AWAITING_COLLECTOR_CONFIRMATION:{ cls: 'badge-warning', label: 'Awaiting Collector' },
    PURCHASE_CONFIRMED:             { cls: 'badge-active',  label: 'Confirmed' },
    PAYMENT_PENDING:                { cls: 'badge-warning', label: 'Payment Pending' },
    PAID:                           { cls: 'badge-success', label: 'Paid' },
    COMPLETED:                      { cls: 'badge-success', label: 'Completed' },
    REJECTED:                       { cls: 'badge-error',   label: 'Rejected' },
    CANCELLED:                      { cls: 'badge-error',   label: 'Cancelled' },
  };
  const d = MAP[status] || { cls: 'badge-neutral', label: status };
  return <span className={`badge ${d.cls}`}>{d.label}</span>;
}

export default function HubDashboardPage() {
  const navigate = useNavigate();
  const [activeHubId, setActiveHubId] = useState<string>(DEMO_ACTIVE_HUB_ID);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [materialFilter, setMaterialFilter] = useState<string>('All Materials');
  const [rejectingLot, setRejectingLot] = useState<Lot | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('Incompatible scrap condition / Quality below threshold');
  const [weighingLot, setWeighingLot] = useState<Lot | null>(null);
  const [actualWeightInput, setActualWeightInput] = useState<string>('');
  const [agreedRateInput, setAgreedRateInput] = useState<string>('250');
  const [deductionsInput, setDeductionsInput] = useState<string>('0');
  const [deductionReasonInput, setDeductionReasonInput] = useState<string>('Moisture / Dirt Sorting Deduction');
  const [weighError, setWeighError] = useState<string | null>(null);
  const [payingLot, setPayingLot] = useState<Lot | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'UPI'>('CASH');
  const [paymentRefNote, setPaymentRefNote] = useState<string>('');
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [viewingReceiptLot, setViewingReceiptLot] = useState<Lot | null>(null);
  const [activePurchase, setActivePurchase] = useState<HubPurchase | undefined>(undefined);
  const [activePayment, setActivePayment] = useState<Payment | undefined>(undefined);

  useEffect(() => { ensureDemoData(); }, []);

  const hubs = useLiveQuery(() => db.hubs.toArray()) || DEMO_HUBS;
  const currentHub = hubs.find(h => h.id === activeHubId) || DEMO_HUBS[0];
  const allLots = useLiveQuery(() => db.lots.toArray(), []) || [];
  const shipments = useLiveQuery(() => db.shipments.where('hubId').equals(activeHubId).toArray(), [activeHubId]) || [];
  const allPayments = useLiveQuery(() => db.payments.where('hubId').equals(activeHubId).toArray(), [activeHubId]) || [];

  const hubLots = allLots.filter(l => l.hubId === activeHubId || (!l.hubId && (l.status === 'PENDING' || l.status === 'REQUESTED')));
  const requestedLots = hubLots.filter(l => l.status === 'REQUESTED');
  const acceptedLots  = hubLots.filter(l => l.status === 'ACCEPTED');
  const rejectedLots  = hubLots.filter(l => l.status === 'REJECTED' || l.status === 'CANCELLED');
  const receivedLots  = hubLots.filter(l => ['RECEIVED','AWAITING_COLLECTOR_CONFIRMATION','PURCHASE_CONFIRMED','PAYMENT_PENDING','PAID'].includes(l.status));
  const pendingPaymentLots = hubLots.filter(l => l.status === 'PURCHASE_CONFIRMED' || l.status === 'PAYMENT_PENDING');
  const completedPaymentLots = hubLots.filter(l => l.status === 'PAID');

  const totalReceivedWeightKg = receivedLots.reduce((acc, l) => acc + (typeof l.actualWeight === 'number' && l.actualWeight > 0 ? l.actualWeight : (parseFloat(l.weight) || 0)), 0);
  const totalPurchaseValue = receivedLots.reduce((acc, l) => acc + (l.purchaseAmount || l.estimate || 0), 0);
  const pendingPaymentAmount = pendingPaymentLots.reduce((acc, l) => acc + (l.purchaseAmount || 0), 0);
  const completedPaymentAmount = allPayments.length > 0 ? allPayments.reduce((acc, p) => acc + p.amount, 0) : completedPaymentLots.reduce((acc, l) => acc + (l.purchaseAmount || 0), 0);

  const filteredLots = hubLots.filter(lot => {
    if (materialFilter !== 'All Materials' && lot.material !== materialFilter) return false;
    if (statusFilter === 'REQUESTED') return lot.status === 'REQUESTED';
    if (statusFilter === 'ACCEPTED')  return lot.status === 'ACCEPTED';
    if (statusFilter === 'RECEIVED')  return lot.status === 'RECEIVED' || lot.status === 'AWAITING_COLLECTOR_CONFIRMATION';
    if (statusFilter === 'UNPAID')    return lot.status === 'PURCHASE_CONFIRMED' || lot.status === 'PAYMENT_PENDING';
    if (statusFilter === 'PAID')      return lot.status === 'PAID';
    if (statusFilter === 'REJECTED')  return lot.status === 'REJECTED' || lot.status === 'CANCELLED';
    return true;
  });

  const handleAccept = async (lot: Lot) => {
    try { await acceptLotRequest(lot.id, activeHubId); }
    catch (err: any) { alert(err.message || 'Error accepting'); }
  };
  const handleOpenReject = (lot: Lot) => { setRejectingLot(lot); setRejectReason('Scrap quality does not meet sorting standard.'); };
  const handleConfirmReject = async () => {
    if (!rejectingLot) return;
    try { await rejectLotRequest(rejectingLot.id, activeHubId, rejectReason); setRejectingLot(null); }
    catch (err: any) { alert(err.message || 'Error rejecting'); }
  };
  const handleOpenWeighIn = (lot: Lot) => {
    setWeighingLot(lot);
    setActualWeightInput(lot.weight);
    setAgreedRateInput(lot.material.includes('Phone') ? '1200' : (lot.material.includes('Cable') ? '450' : '250'));
    setDeductionsInput('0');
    setWeighError(null);
  };
  const handleConfirmWeighIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!weighingLot) return;
    setWeighError(null);
    const actualWeight = parseFloat(actualWeightInput);
    const agreedRate   = parseFloat(agreedRateInput);
    const deductions   = parseFloat(deductionsInput) || 0;
    if (isNaN(actualWeight) || actualWeight <= 0) { setWeighError('Enter a valid positive weight (kg).'); return; }
    if (isNaN(agreedRate) || agreedRate < 0) { setWeighError('Enter a valid agreed rate.'); return; }
    try {
      await receiveLotAtHub(weighingLot.id, activeHubId, actualWeight, agreedRate, deductions, deductions > 0 ? deductionReasonInput : undefined);
      setWeighingLot(null);
    } catch (err: any) { setWeighError(err.message || 'Failed to record weigh-in.'); }
  };
  const handleOpenPayment = (lot: Lot) => {
    setPayingLot(lot);
    setPaymentMethod('CASH');
    setPaymentRefNote(`VOUCHER-${lot.id.slice(0,6).toUpperCase()}`);
    setPaymentError(null);
  };
  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingLot) return;
    setPaymentError(null);
    const amount = payingLot.purchaseAmount || payingLot.estimate || 0;
    if (amount <= 0) { setPaymentError('Purchase amount must be greater than zero.'); return; }
    try {
      await recordHubPayment({
        lotId: payingLot.id, hubId: activeHubId,
        collectorId: payingLot.collectorId || 'KAB-7842',
        amount, method: paymentMethod,
        referenceNote: paymentRefNote.trim() || undefined,
        recordedBy: currentHub.ownerName || 'Hub Operator'
      });
      setPayingLot(null);
    } catch (err: any) { setPaymentError(err.message || 'Failed to record payment.'); }
  };
  const handleViewReceipt = async (lot: Lot) => {
    const purchase = await db.hubPurchases.where('lotId').equals(lot.id).first();
    const payment  = await db.payments.where('lotId').equals(lot.id).first();
    setActivePurchase(purchase); setActivePayment(payment); setViewingReceiptLot(lot);
  };

  const calcGross = (parseFloat(actualWeightInput) || 0) * (parseFloat(agreedRateInput) || 0);
  const calcNet   = Math.max(0, calcGross - (parseFloat(deductionsInput) || 0));

  const METRICS = [
    { label: 'Godown Stock',    value: `${totalReceivedWeightKg.toFixed(1)} kg`, sub: `${receivedLots.length} lots`, color: '#1d4ed8' },
    { label: 'Total Purchases', value: `₹${totalPurchaseValue.toLocaleString('en-IN')}`, sub: 'committed + paid', color: '#166534' },
    { label: 'Payments Due',    value: `₹${pendingPaymentAmount.toLocaleString('en-IN')}`, sub: `${pendingPaymentLots.length} collectors`, color: '#b45309' },
    { label: 'Paid Out',        value: `₹${completedPaymentAmount.toLocaleString('en-IN')}`, sub: `${completedPaymentLots.length} settled`, color: '#166534' },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-5 space-y-5 pb-28 sm:pb-12">

      {/* Hub Header */}
      <div className="kc-card p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <div className="w-7 h-7 rounded-lg bg-[#dbeafe] text-[#1d4ed8] flex items-center justify-center flex-shrink-0">
                <Building2 size={16} />
              </div>
              <h1 className="font-black text-[#1f2937] text-base leading-tight break-words">{currentHub.name}</h1>
              <span className="badge badge-warning text-[10px]">Demo</span>
            </div>
            <p className="text-xs text-[#64748b] break-words">{currentHub.location}</p>
          </div>
        </div>

        {/* Hub Selector */}
        <div className="pt-2 border-t border-[#e2e8f0]">
          <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748b] block mb-1">
            Switch Godown Location
          </label>
          <div className="relative">
            <select
              value={activeHubId}
              onChange={e => setActiveHubId(e.target.value)}
              className="w-full appearance-none bg-[#f0fdf4] border border-[#bbf7d0] text-[#166534] text-xs font-bold px-3 pr-8 py-2 rounded-xl outline-none cursor-pointer truncate"
            >
              {hubs.map(h => (
                <option key={h.id} value={h.id}>
                  {h.name} ({h.location.split(',')[0]})
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#166534] pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3">
        {METRICS.map(m => (
          <div key={m.label} className="stat-card">
            <p className="stat-card-label">{m.label}</p>
            <p className="stat-card-value mt-1.5" style={{ color: m.color }}>{m.value}</p>
            <p className="text-xs text-[#94a3b8] mt-1">{m.sub}</p>
          </div>
        ))}
      </div>

      {/* Shipments quick-nav */}
      <button onClick={() => navigate('/hub/shipments')}
        className="w-full flex items-center justify-between p-4 rounded-xl bg-[#166534] text-white hover:bg-[#14532d] transition">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
            <Truck size={18}/>
          </div>
          <div className="text-left">
            <p className="font-bold text-sm">Bulk Shipments to Recyclers</p>
            <p className="text-xs text-green-200">{shipments.length} shipment(s) created</p>
          </div>
        </div>
        <ArrowRight size={18}/>
      </button>

      {/* Filters */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 mb-3">
          <h2 className="font-bold text-[#1f2937] flex items-center gap-2">
            <Package size={16} color="#166534"/>Lot Intake ({filteredLots.length})
          </h2>
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <Filter size={13} color="#64748b" className="flex-shrink-0"/>
            <select value={materialFilter} onChange={e => setMaterialFilter(e.target.value)}
              className="w-full sm:w-auto text-xs border border-[#e2e8f0] rounded-lg px-2.5 py-1.5 font-semibold text-[#1f2937] bg-white outline-none focus:border-[#166534]">
              {MATERIAL_OPTIONS.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
        </div>

        {/* Status tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-2">
          {STATUS_TABS.map(tab => {
            const count = tab.id === 'REQUESTED' ? requestedLots.length
              : tab.id === 'ACCEPTED' ? acceptedLots.length
              : tab.id === 'UNPAID' ? pendingPaymentLots.length
              : tab.id === 'PAID' ? completedPaymentLots.length
              : tab.id === 'REJECTED' ? rejectedLots.length
              : tab.id === 'ALL' ? hubLots.length : undefined;
            return (
              <button key={tab.id} onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                  statusFilter === tab.id
                    ? 'bg-[#166534] text-white'
                    : 'bg-white border border-[#e2e8f0] text-[#64748b] hover:border-[#166534]/50'
                }`}>
                {tab.label}{count !== undefined ? ` (${count})` : ''}
              </button>
            );
          })}
        </div>

        {/* Lot list */}
        <div className="space-y-3 mt-3">
          {filteredLots.length === 0 ? (
            <div className="kc-card p-10 flex flex-col items-center text-center gap-3">
              <Package size={36} color="#cbd5e1"/>
              <p className="font-semibold text-[#64748b]">No lots match this filter.</p>
            </div>
          ) : (
            filteredLots.map(lot => {
              const displayWeight = typeof lot.actualWeight === 'number' && lot.actualWeight > 0 ? lot.actualWeight : parseFloat(lot.weight);
              const displayPrice = lot.purchaseAmount || lot.estimate || 0;
              const isRequest = lot.status === 'REQUESTED';
              const isAccepted = lot.status === 'ACCEPTED';
              const isWeighed  = lot.status === 'RECEIVED' || lot.status === 'AWAITING_COLLECTOR_CONFIRMATION';
              const isUnpaid   = lot.status === 'PURCHASE_CONFIRMED' || lot.status === 'PAYMENT_PENDING';
              const isPaid     = lot.status === 'PAID';

              return (
                <div key={lot.id} className="kc-card p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    {lot.photo ? (
                      <img src={lot.photo} alt={lot.material} className="w-12 h-12 rounded-xl object-cover flex-shrink-0 border border-[#e2e8f0]"/>
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-[#f0fdf4] flex items-center justify-center flex-shrink-0 border border-[#e2e8f0]">
                        <Package size={20} color="#166534"/>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[#1f2937] text-sm">{lot.material}</p>
                      <p className="text-xs text-[#64748b]">{displayWeight.toFixed(2)} kg • {lot.condition || 'Mixed Scrap'}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <LotStatusBadge status={lot.status}/>
                        {lot.collectorId && (
                          <span className="text-[10px] text-[#94a3b8] flex items-center gap-1"><User size={10}/>{lot.collectorId}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-black text-[#166534] text-base">₹{displayPrice.toLocaleString('en-IN')}</p>
                      <p className="text-[10px] text-[#94a3b8] font-mono mt-0.5">#{lot.id.slice(0,6)}</p>
                    </div>
                  </div>

                  {/* Lot action buttons */}
                  {isRequest && (
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => handleAccept(lot)} className="btn-primary py-2.5 text-xs rounded-xl gap-1.5">
                        <CheckCircle2 size={14}/>Accept Lot
                      </button>
                      <button onClick={() => handleOpenReject(lot)} className="btn-danger py-2.5 text-xs rounded-xl gap-1.5">
                        <XCircle size={14}/>Reject
                      </button>
                    </div>
                  )}
                  {isAccepted && (
                    <button onClick={() => handleOpenWeighIn(lot)} className="w-full btn-primary py-2.5 text-xs rounded-xl gap-1.5">
                      <Scale size={14}/>Weigh-In & Record Actual Weight
                    </button>
                  )}
                  {isWeighed && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                      <p className="font-semibold flex items-center gap-1.5 mb-0.5"><Clock size={13}/>Waiting for collector to confirm agreed amount</p>
                      {lot.actualWeight && <p className="text-[11px]">Scale: {lot.actualWeight} kg → Net: ₹{lot.purchaseAmount?.toLocaleString('en-IN')}</p>}
                    </div>
                  )}
                  {isUnpaid && (
                    <button onClick={() => handleOpenPayment(lot)} className="w-full btn-primary py-2.5 text-xs rounded-xl gap-1.5">
                      <Banknote size={14}/>Record Payment ({paymentMethod === 'UPI' ? 'UPI' : 'Cash'})
                    </button>
                  )}
                  {isPaid && (
                    <button onClick={() => handleViewReceipt(lot)} className="w-full py-2.5 border border-[#dcfce7] bg-[#f0fdf4] text-[#166534] text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 hover:bg-[#dcfce7] transition">
                      <CheckCircle2 size={14}/>View Payment Receipt
                    </button>
                  )}
                  {lot.status === 'REJECTED' && lot.rejectionReason && (
                    <p className="text-xs text-[#b91c1c] bg-red-50 border border-red-100 rounded-xl p-2.5">
                      Rejection reason: {lot.rejectionReason}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ─── MODAL: Reject ───────────────────────────── */}
      {rejectingLot && (
        <div className="modal-overlay" onClick={() => setRejectingLot(null)}>
          <div className="modal-panel p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-black text-[#1f2937]">Reject Lot</h3>
                <p className="text-xs text-[#64748b]">#{rejectingLot.id.slice(0,6)} • {rejectingLot.material}</p>
              </div>
              <button onClick={() => setRejectingLot(null)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X size={18} color="#64748b"/>
              </button>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#1f2937] mb-1.5">Reason for Rejection</label>
              <input value={rejectReason} onChange={e => setRejectReason(e.target.value)} className="kc-input"/>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setRejectingLot(null)} className="btn-secondary py-3">Cancel</button>
              <button onClick={handleConfirmReject} className="btn-danger py-3 gap-1.5">
                <XCircle size={15}/>Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: Weigh-In ─────────────────────────── */}
      {weighingLot && (
        <div className="modal-overlay" onClick={() => setWeighingLot(null)}>
          <div className="modal-panel p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <Scale size={15} color="#1d4ed8"/>
                  <span className="text-xs font-bold text-blue-700">Hub Weighbridge</span>
                </div>
                <h3 className="font-black text-[#1f2937]">Record Weigh-In</h3>
                <p className="text-xs text-[#64748b]">#{weighingLot.id.slice(0,6)} • {weighingLot.material} • Est: {weighingLot.weight} kg</p>
              </div>
              <button onClick={() => setWeighingLot(null)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X size={18} color="#64748b"/>
              </button>
            </div>
            <form onSubmit={handleConfirmWeighIn} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#1f2937] mb-1.5">Actual Weight (kg)</label>
                  <input type="number" step="0.01" min="0.01" value={actualWeightInput}
                    onChange={e => setActualWeightInput(e.target.value)} required className="kc-input font-mono"/>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#1f2937] mb-1.5">Rate (₹/kg)</label>
                  <input type="number" step="0.01" min="0" value={agreedRateInput}
                    onChange={e => setAgreedRateInput(e.target.value)} required className="kc-input font-mono"/>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#1f2937] mb-1.5">Deductions (₹)</label>
                  <input type="number" step="0.01" min="0" value={deductionsInput}
                    onChange={e => setDeductionsInput(e.target.value)} className="kc-input font-mono"/>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#1f2937] mb-1.5">Deduction Reason</label>
                  <input type="text" value={deductionReasonInput}
                    onChange={e => setDeductionReasonInput(e.target.value)} className="kc-input text-xs"/>
                </div>
              </div>

              {/* Live calculation */}
              <div className="bg-[#f0fdf4] border border-[#dcfce7] rounded-xl p-3 space-y-1.5 text-sm font-mono">
                <div className="flex justify-between text-[#64748b]"><span>Gross:</span><span>₹{calcGross.toFixed(2)}</span></div>
                {parseFloat(deductionsInput) > 0 && (
                  <div className="flex justify-between text-red-600"><span>Deductions:</span><span>-₹{parseFloat(deductionsInput).toFixed(2)}</span></div>
                )}
                <div className="flex justify-between font-black text-[#166534] text-base border-t border-[#dcfce7] pt-1.5">
                  <span>Net Payable:</span><span>₹{calcNet.toFixed(2)}</span>
                </div>
              </div>

              {weighError && (
                <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 p-2.5 rounded-xl">
                  <AlertCircle size={14}/>{weighError}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setWeighingLot(null)} className="btn-secondary py-3">Cancel</button>
                <button type="submit" className="btn-primary py-3 gap-1.5">
                  <Scale size={15}/>Confirm Weigh-In
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: Payment ──────────────────────────── */}
      {payingLot && (
        <div className="modal-overlay" onClick={() => setPayingLot(null)}>
          <div className="modal-panel p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <Banknote size={15} color="#166534"/>
                  <span className="text-xs font-bold text-[#166534]">Record Payment</span>
                </div>
                <h3 className="font-black text-[#1f2937]">Disburse Settlement</h3>
                <p className="text-xs text-[#64748b]">#{payingLot.id.slice(0,6)} • Collector: {payingLot.collectorId || 'KAB-7842'}</p>
              </div>
              <button onClick={() => setPayingLot(null)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X size={18} color="#64748b"/>
              </button>
            </div>
            <div className="bg-[#f0fdf4] border border-[#dcfce7] rounded-xl p-3 text-sm">
              <div className="flex justify-between font-black text-[#166534] text-xl">
                <span>Amount:</span><span>₹{(payingLot.purchaseAmount || payingLot.estimate || 0).toLocaleString('en-IN')}</span>
              </div>
            </div>
            <form onSubmit={handleConfirmPayment} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#1f2937] mb-2">Payment Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['CASH', 'UPI'] as const).map(m => (
                    <button key={m} type="button" onClick={() => setPaymentMethod(m)}
                      className={`py-3 rounded-xl text-sm font-bold border-2 transition ${
                        paymentMethod === m
                          ? 'border-[#166534] bg-[#f0fdf4] text-[#166534]'
                          : 'border-[#e2e8f0] bg-white text-[#64748b]'
                      }`}>
                      {m === 'CASH' ? '💵 Cash' : '📱 UPI'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#1f2937] mb-1.5">Reference / Voucher Note</label>
                <input type="text" value={paymentRefNote} onChange={e => setPaymentRefNote(e.target.value)} className="kc-input font-mono text-sm"/>
              </div>
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <AlertTriangle size={13} color="#b45309" className="flex-shrink-0 mt-0.5"/>
                <p className="text-[11px] text-amber-800">Recording payment does not transfer money. This is a manual log of an in-person cash or UPI transaction.</p>
              </div>
              {paymentError && (
                <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 p-2.5 rounded-xl">
                  <AlertCircle size={14}/>{paymentError}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setPayingLot(null)} className="btn-secondary py-3">Cancel</button>
                <button type="submit" className="btn-primary py-3 gap-1.5">
                  <CheckCircle2 size={15}/>Record Paid
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {viewingReceiptLot && (
        <PurchaseReceiptModal
          lot={viewingReceiptLot}
          purchase={activePurchase}
          payment={activePayment}
          onClose={() => setViewingReceiptLot(null)}
        />
      )}
    </div>
  );
}
