import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Truck, CheckCircle2, Clock, Scale, ArrowLeft, RefreshCw,
  QrCode, Building2, ChevronRight,
  Printer, Check, X, LockKeyhole, Tag,
} from 'lucide-react';
import {
  getCollectorHandovers,
  acceptHandoverQuote,
  updateHandoverStatus,
  recalculateHandoverAmount
} from '../lib/destinationService';
import {
  type HandoverRequest,
  type PricingTransactionSnapshot,
  DEFAULT_PROFILE
} from '../lib/db';
import { getCurrentSession } from '../lib/authService';
import { db } from '../lib/db';


const STATUS_LABELS: Record<string, string> = {
  quote_requested: 'Quote Requested',
  quoted: 'Quoted by Partner',
  scheduled: 'Scheduled / Accepted',
  handed_over: 'Handed Over (Scale Weighed)',
  payment_recorded: 'Payment Recorded',
  completed: 'Settlement Completed',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  expired: 'Expired',
};

export default function MyHandoversPage() {
  const navigate = useNavigate();
  const session = getCurrentSession();
  const defaultShortId = session?.user?.id ? (session.user.id.startsWith('KAB-') ? session.user.id : `KAB-${session.user.id.replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase()}`) : DEFAULT_PROFILE.collectorId;
  const collectorId = (session?.user as any)?.collectorId || defaultShortId;

  const [handovers, setHandovers] = useState<HandoverRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'COMPLETED'>('ACTIVE');

  // Pricing transaction snapshots (immutable, linked by manifestCode)
  const [pricingSnapshots, setPricingSnapshots] = useState<PricingTransactionSnapshot[]>([]);

  // Simulation Modal for Expo Demo
  const [intakeHandover, setIntakeHandover] = useState<HandoverRequest | null>(null);
  const [scaleWeight, setScaleWeight] = useState<number>(15);
  const [scaleDeductions, setScaleDeductions] = useState<number>(0);
  const [deductionReason, setDeductionReason] = useState<string>('Tare bag weight');
  const [submittingIntake, setSubmittingIntake] = useState<false | true>(false);

  const loadHandovers = async () => {
    setLoading(true);
    try {
      const data = await getCollectorHandovers(collectorId);
      setHandovers(data);
    } catch (err) {
      console.error('Failed to load handovers:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadPricingSnapshots = async () => {
    try {
      const snaps = await db.pricingTransactions
        .where('collectorId').equals(collectorId)
        .toArray();
      setPricingSnapshots(snaps);
    } catch (err) {
      console.warn('Could not load pricing snapshots:', err);
    }
  };

  useEffect(() => {
    loadHandovers();
    loadPricingSnapshots();
  }, [collectorId]);

  const handleAccept = async (id: string) => {
    const res = await acceptHandoverQuote(id);
    if (res.success) {
      loadHandovers();
    } else {
      alert(res.error || 'Failed to accept quote.');
    }
  };

  const handleSimulateScaleIntake = async () => {
    if (!intakeHandover) return;
    setSubmittingIntake(true);
    try {
      const res = await updateHandoverStatus(intakeHandover.id, {
        status: 'completed',
        actualWeight: scaleWeight,
        disclosedDeductions: scaleDeductions,
        deductionReason: scaleDeductions > 0 ? deductionReason : undefined,
        notes: `Physical intake confirmed at destination facility scale. Scale weight: ${scaleWeight} kg.`,
      });
      setSubmittingIntake(false);
      if (res.success) {
        setIntakeHandover(null);
        loadHandovers();
      } else {
        alert(res.error || 'Failed to update intake status.');
      }
    } catch (err) {
      setSubmittingIntake(false);
      alert('Error updating scale intake.');
    }
  };

  const activeHandovers = handovers.filter(
    (h) => !['completed', 'cancelled', 'rejected', 'expired'].includes(h.status)
  );
  const completedHandovers = handovers.filter(
    (h) => ['completed', 'cancelled', 'rejected', 'expired'].includes(h.status)
  );

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
            <Truck className="text-emerald-700" size={26} />
            Collector Handover Tracking & Manifests
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Transparent destination lifecycle, digital manifest codes, and certified scale intake records.
          </p>
        </div>

        <button
          onClick={() => navigate('/find-partners')}
          className="btn-primary py-2 px-4 text-xs rounded-xl flex items-center gap-1.5 self-start sm:self-center"
        >
          <span>Find New Partner</span>
          <ChevronRight size={14} />
        </button>
      </div>

      {/* ─── Tabs ──────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('ACTIVE')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
            activeTab === 'ACTIVE'
              ? 'bg-emerald-700 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Clock size={13} />
          Active Handovers ({activeHandovers.length})
        </button>
        <button
          onClick={() => setActiveTab('COMPLETED')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
            activeTab === 'COMPLETED'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <CheckCircle2 size={13} />
          Settled / Past Handovers ({completedHandovers.length})
        </button>
      </div>

      {/* ─── Handovers List ─────────────────────────────────── */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 space-y-3">
          <RefreshCw size={28} className="animate-spin mx-auto text-emerald-600" />
          <p className="text-sm font-semibold">Loading handover manifests...</p>
        </div>
      ) : (activeTab === 'ACTIVE' ? activeHandovers : completedHandovers).length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3">
          <Truck size={36} className="mx-auto text-slate-300" />
          <h3 className="text-base font-bold text-slate-800">
            {activeTab === 'ACTIVE' ? 'No Active Handovers' : 'No Past Handovers'}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {activeTab === 'ACTIVE'
              ? 'You have not booked any handover shipments with collection hubs or recyclers yet.'
              : 'Completed and settled transactions will appear here for EPR and audit history.'}
          </p>
          {activeTab === 'ACTIVE' && (
            <button
              onClick={() => navigate('/find-partners')}
              className="mt-2 btn-primary py-2 px-4 text-xs rounded-xl"
            >
              Browse Destination Partners
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {(activeTab === 'ACTIVE' ? activeHandovers : completedHandovers).map((handover) => {
            const isCompleted = handover.status === 'completed';

            return (
              <div
                key={handover.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 hover:border-slate-300 transition"
              >
                {/* Header & Manifest Code */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="badge text-[10px] bg-slate-100 font-mono text-slate-700">
                        Lot #{handover.lotId}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isCompleted
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {STATUS_LABELS[handover.status] || handover.status}
                      </span>
                      <span className="text-xs text-slate-400">•</span>
                      <span className="text-xs text-slate-500">
                        Booked {new Date(handover.createdAt).toLocaleDateString('en-IN')}
                      </span>
                    </div>

                    <h3 className="text-base font-black text-slate-900 mt-1">
                      {handover.destinationName}
                    </h3>
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <Building2 size={12} />
                      {handover.destinationType === 'HUB' ? 'Aggregation Hub Godown' : 'Formal Recycling Unit'}
                    </p>
                  </div>

                  {/* 6-Digit Manifest Code Card */}
                  <div className="bg-slate-900 text-white rounded-xl p-2.5 px-3 text-right self-start sm:self-auto shadow-sm">
                    <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-bold">
                      Digital Manifest Code
                    </span>
                    <span className="font-mono text-lg font-black text-emerald-400 tracking-wider">
                      {handover.manifestCode || 'MNF-PENDING'}
                    </span>
                  </div>
                </div>

                {/* Progress Timeline Stepper */}
                <div className="py-1">
                  <div className="flex items-center justify-between relative">
                    <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0.5 bg-slate-200 z-0" />
                    {[
                      { key: 'quoted', label: 'Quoted' },
                      { key: 'scheduled', label: 'Scheduled' },
                      { key: 'handed_over', label: 'Intake Scale' },
                      { key: 'completed', label: 'Completed' },
                    ].map((step, idx) => {
                      const stepIdx = ['quoted', 'scheduled', 'handed_over', 'completed'].indexOf(step.key);
                      const isPassed =
                        handover.status === 'completed' ||
                        ['quoted', 'scheduled', 'handed_over', 'completed'].indexOf(handover.status) >= stepIdx;

                      return (
                        <div key={step.key} className="flex flex-col items-center relative z-10">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition ${
                              isPassed
                                ? 'bg-emerald-600 text-white ring-4 ring-emerald-50'
                                : 'bg-slate-200 text-slate-500'
                            }`}
                          >
                            {isPassed ? <Check size={12} /> : idx + 1}
                          </div>
                          <span className="text-[10px] font-semibold text-slate-600 mt-1 hidden sm:block">
                            {step.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Material & Financial Details Card */}
                {(() => {
                  // Find linked pricing transaction snapshot (matched by manifestCode)
                  const snap = pricingSnapshots.find(
                    s => s.manifestCode === handover.manifestCode ||
                         s.lotId === handover.lotId
                  );
                  return (
                    <>
                      {snap && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg">
                          <LockKeyhole size={12} color="#1d4ed8" />
                          <span className="text-xs text-blue-800 font-semibold">
                            Price-booked via Rate Board
                          </span>
                          <Tag size={11} color="#1d4ed8" className="ml-1" />
                          <span className="text-xs text-blue-700 font-mono">
                            Locked Rate: Rs.{snap.acceptedRate}/kg
                          </span>
                          <span className="ml-auto text-[10px] text-blue-500 font-mono">{snap.manifestCode}</span>
                        </div>
                      )}
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-bold">
                            Material
                          </span>
                          <span className="font-bold text-slate-900">{handover.material}</span>
                        </div>

                        <div>
                          <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-bold">
                            {snap ? 'Locked Rate (Rate Board)' : 'Agreed Rate'}
                          </span>
                          <span className="font-bold text-slate-900">
                            {snap ? (
                              <span className="text-blue-700 flex items-center gap-0.5">
                                <LockKeyhole size={10} /> Rs.{snap.acceptedRate}/kg
                              </span>
                            ) : (
                              <>Rs.{handover.offeredRatePerKg}/kg</>
                            )}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-bold">
                            Intake Weight
                          </span>
                          <span className="font-bold text-slate-900">
                            {handover.actualWeight != null ? (
                              <span className="text-emerald-700">
                                {handover.actualWeight} kg{' '}
                                <span className="text-[10px] text-slate-500 font-normal">
                                  (Est: {handover.estimatedWeight} kg)
                                </span>
                              </span>
                            ) : (
                              <span>{handover.estimatedWeight} kg (Est)</span>
                            )}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-bold">
                            {handover.finalActualAmount != null ? 'Final Payout' : 'Est. Net Amount'}
                          </span>
                          <span className="font-black text-emerald-700 text-sm">
                            Rs.{(handover.finalActualAmount ?? handover.estimatedNetAmount).toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>
                    </>
                  );
                })()}

                {/* Deductions or Notes if any */}
                {(handover.disclosedDeductions || handover.notes) && (
                  <div className="text-[11px] text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200 space-y-1">
                    {handover.disclosedDeductions ? (
                      <p className="text-amber-800 font-medium">
                        Scale Deduction: -₹{handover.disclosedDeductions} ({handover.deductionReason || 'Tare'})
                      </p>
                    ) : null}
                    {handover.notes && <p className="italic text-slate-500">Note: {handover.notes}</p>}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-1">
                  <div className="text-xs text-slate-500 flex items-center gap-1 font-mono">
                    <QrCode size={14} className="text-slate-600" />
                    <span>Scan code at facility gate</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {handover.status === 'quoted' && (
                      <button
                        onClick={() => handleAccept(handover.id)}
                        className="btn-primary py-1.5 px-3 text-xs rounded-lg flex items-center gap-1"
                      >
                        <Check size={13} />
                        <span>Accept Quote</span>
                      </button>
                    )}

                    {!isCompleted && (
                      <button
                        onClick={() => {
                          setIntakeHandover(handover);
                          setScaleWeight(handover.estimatedWeight);
                          setScaleDeductions(0);
                        }}
                        className="py-1.5 px-3 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 rounded-lg hover:bg-emerald-100 transition flex items-center gap-1"
                        title="Simulate destination digital scale intake and settlement"
                      >
                        <Scale size={13} />
                        <span>Simulate Scale Intake</span>
                      </button>
                    )}

                    <button
                      onClick={() => window.print()}
                      className="py-1.5 px-2.5 text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                      title="Print Manifest Slip"
                    >
                      <Printer size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── MODAL: Simulate Scale Intake (Expo Prototype Feature) ─── */}
      {intakeHandover && (
        <div className="modal-overlay" onClick={() => setIntakeHandover(null)}>
          <div className="modal-panel p-5 max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-black text-slate-900 text-sm">Facility Scale Intake & Settlement</h3>
                <p className="text-xs text-slate-500">Manifest: {intakeHandover.manifestCode}</p>
              </div>
              <button onClick={() => setIntakeHandover(null)} className="p-1 rounded-lg hover:bg-slate-100">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-600">
                Simulate physical intake at <strong>{intakeHandover.destinationName}</strong>: weigh the lot on the
                certified digital scale, input deductions (if tare or moisture), and settle payment.
              </p>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Scale Weight (kg)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    value={scaleWeight}
                    onChange={(e) => setScaleWeight(parseFloat(e.target.value) || 0)}
                    className="w-full text-xs font-semibold px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  />
                  <span className="text-slate-500 font-bold">kg</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Estimated Weight: {intakeHandover.estimatedWeight} kg • Variance:{' '}
                  {(scaleWeight - intakeHandover.estimatedWeight).toFixed(2)} kg
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Tare / Moisture Deductions (₹)
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={scaleDeductions}
                  onChange={(e) => setScaleDeductions(parseFloat(e.target.value) || 0)}
                  className="w-full text-xs font-semibold px-3 py-2 border border-slate-200 rounded-lg bg-white"
                />
              </div>

              {scaleDeductions > 0 && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Deduction Reason
                  </label>
                  <input
                    type="text"
                    value={deductionReason}
                    onChange={(e) => setDeductionReason(e.target.value)}
                    className="w-full text-xs font-semibold px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  />
                </div>
              )}

              {/* Real-time Recalculation Preview */}
              {(() => {
                const recalc = recalculateHandoverAmount(intakeHandover, scaleWeight, scaleDeductions);
                return (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Gross (₹{intakeHandover.offeredRatePerKg} × {scaleWeight} kg):</span>
                      <span className="font-semibold text-slate-800">₹{recalc.grossAmount}</span>
                    </div>
                    {recalc.pickupFee > 0 && (
                      <div className="flex justify-between text-rose-700">
                        <span>Pickup Fee:</span>
                        <span>-₹{recalc.pickupFee}</span>
                      </div>
                    )}
                    {recalc.deductions > 0 && (
                      <div className="flex justify-between text-rose-700">
                        <span>Deductions ({deductionReason}):</span>
                        <span>-₹{recalc.deductions}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-1 border-t border-emerald-200 text-sm font-bold">
                      <span className="text-slate-900">Final Settled Net Amount:</span>
                      <span className="font-black text-emerald-800">₹{recalc.netFinalAmount.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                );
              })()}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIntakeHandover(null)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSimulateScaleIntake}
                  disabled={submittingIntake}
                  className="btn-primary py-2 px-4 text-xs rounded-lg flex items-center gap-1.5"
                >
                  {submittingIntake && <RefreshCw size={12} className="animate-spin" />}
                  <span>Confirm Settlement</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
