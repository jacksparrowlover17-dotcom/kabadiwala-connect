import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Shipment } from '../lib/db';
import { receiveShipmentAtRecycler } from '../lib/hubService';
import { sha256 } from 'js-sha256';
import { 
  ShieldCheck, 
  AlertTriangle, 
  Truck, 
  Scale, 
  CheckCircle2, 
  AlertCircle,
  X,
  FileCheck2
} from 'lucide-react';

export default function RecyclerPage() {
  const [tab, setTab] = useState<'HUB_SHIPMENTS' | 'DIRECT_HANDOVER'>('HUB_SHIPMENTS');

  // Hub shipment verification state
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(null);
  const [receivedWeightInput, setReceivedWeightInput] = useState<string>('');
  const [handoverCodeInput, setHandoverCodeInput] = useState<string>('');
  const [notesInput, setNotesInput] = useState<string>('');
  const [hubError, setHubError] = useState<string | null>(null);
  const [hubSuccess, setHubSuccess] = useState<string | null>(null);

  // Direct Handover state
  const [code, setCode] = useState('');
  const [lotId, setLotId] = useState('');
  const [material, setMaterial] = useState('');
  const [weight, setWeight] = useState('');
  const [estimate, setEstimate] = useState('');
  const [directResult, setDirectResult] = useState<'IDLE' | 'SUCCESS' | 'FAILED'>('IDLE');

  const shipments = useLiveQuery(() => db.shipments.reverse().sortBy('createdAt'), []) || [];

  const handleOpenShipmentModal = (s: Shipment) => {
    setSelectedShipmentId(s.id);
    setReceivedWeightInput(s.dispatchedQuantity?.toString() || s.plannedQuantity.toString());
    setHandoverCodeInput('');
    setNotesInput('');
    setHubError(null);
    setHubSuccess(null);
  };

  const handleVerifyShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShipmentId) return;
    setHubError(null);
    setHubSuccess(null);

    const receivedWeight = parseFloat(receivedWeightInput);
    if (isNaN(receivedWeight) || receivedWeight <= 0) {
      setHubError('Please enter a valid scale reading in kg.');
      return;
    }

    try {
      const updated = await receiveShipmentAtRecycler({
        shipmentId: selectedShipmentId,
        receivedWeight,
        handoverCode: handoverCodeInput.trim(),
        note: notesInput.trim() || undefined
      });

      setHubSuccess(`Shipment ${updated.id} verified at gate. Weight discrepancy recorded: ${updated.discrepancyQuantity} kg.`);
      setSelectedShipmentId(null);
    } catch (err: any) {
      setHubError(err.message || 'Verification failed. Please check manifest code.');
    }
  };

  const verifyDirectTransaction = () => {
    const payload = `id=${lotId}|mat=${material}|kg=${weight}|est=${estimate}`;
    const hash = sha256(payload);
    const shortHash = parseInt(hash.substring(0, 12), 16);
    const derivedCode = (shortHash % 1000000).toString().padStart(6, '0');

    if (derivedCode === code && code.length === 6) {
      setDirectResult('SUCCESS');
    } else {
      setDirectResult('FAILED');
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto pb-28">
      {/* Top Header Card */}
      <div className="kc-card p-5 sm:p-6 mb-5 bg-white border-l-4 border-l-[#166534]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-[#1f2937]">Authorized Recycler Gate</h1>
              <span className="badge badge-success text-[10px]">
                <ShieldCheck size={12} /> CPCB Certified
              </span>
            </div>
            <p className="text-xs text-[#64748b] mt-1">
              Green Earth Recycling Facility · Peenya Industrial Area, Bengaluru · CPCB/EW-REG/2024/01
            </p>
          </div>

          {/* Tab Switcher */}
          <div className="flex bg-[#f1f5f9] p-1 rounded-xl self-start sm:self-auto border border-[#e2e8f0]">
            <button
              onClick={() => setTab('HUB_SHIPMENTS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                tab === 'HUB_SHIPMENTS'
                  ? 'bg-white text-[#166534] shadow-xs'
                  : 'text-[#64748b] hover:text-[#1f2937]'
              }`}
            >
              Hub Bulk Shipments ({shipments.length})
            </button>
            <button
              onClick={() => setTab('DIRECT_HANDOVER')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                tab === 'DIRECT_HANDOVER'
                  ? 'bg-white text-[#166534] shadow-xs'
                  : 'text-[#64748b] hover:text-[#1f2937]'
              }`}
            >
              Direct Handover Code
            </button>
          </div>
        </div>
      </div>

      {hubSuccess && (
        <div className="mb-4 p-3.5 bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl text-[#166534] text-xs flex items-center gap-2">
          <CheckCircle2 size={16} className="text-[#16a34a] flex-shrink-0" />
          <span className="font-medium">{hubSuccess}</span>
        </div>
      )}

      {/* TAB 1: HUB BULK SHIPMENTS */}
      {tab === 'HUB_SHIPMENTS' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#64748b]">
              Incoming Form 6 Consignments
            </h2>
            <span className="text-[10px] text-[#94a3b8] font-mono">Offline-first Live Ledger</span>
          </div>

          {shipments.length === 0 ? (
            <div className="kc-card p-10 text-center text-[#64748b] border-dashed">
              <Truck size={36} className="mx-auto mb-2 text-[#94a3b8]" />
              <p className="font-bold text-sm text-[#1f2937]">No shipments logged in queue</p>
              <p className="text-xs mt-1 text-[#64748b] max-w-sm mx-auto">
                Dispatch an aggregated batch from the Hub Dashboard to simulate weighbridge intake at the recycler gate.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {shipments.map(s => {
                const isReceived = s.status === 'RECEIVED_BY_RECYCLER' || s.status === 'COMPLETED';
                const isDispatched = s.status === 'DISPATCHED';

                return (
                  <div key={s.id} className="kc-card p-4 space-y-3 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-black text-sm text-[#1f2937]">{s.id}</span>
                            <span className="badge badge-active text-[10px]">
                              {s.material}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#64748b] mt-0.5">
                            Origin Hub: <span className="font-mono font-bold text-[#1f2937]">{s.hubId}</span> · {s.lotIds.length} Lots
                          </p>
                        </div>

                        <div className="text-right flex-shrink-0">
                          <span className="font-black text-base text-[#1f2937]">{s.plannedQuantity} kg</span>
                          <p className="text-[10px] text-[#64748b]">Dispatched</p>
                        </div>
                      </div>

                      {/* Status row */}
                      <div className="p-2 bg-[#f8fafc] rounded-lg border border-[#e2e8f0] text-xs flex justify-between items-center">
                        <div>
                          {isReceived ? (
                            <span className="inline-flex items-center gap-1 text-[#166534] font-bold">
                              <CheckCircle2 size={13} /> Verified at Gate Weighbridge
                            </span>
                          ) : isDispatched ? (
                            <span className="inline-flex items-center gap-1 text-[#1d4ed8] font-bold">
                              <Truck size={13} /> In Transit from Hub
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber-700 font-bold">
                              ● Ready at Hub (Pending Transport)
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-[#94a3b8] text-[10px]">
                          {new Date(s.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      {/* Discrepancy details */}
                      {isReceived && typeof s.recyclerReceivedQuantity === 'number' && (
                        <div className="p-2.5 bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl text-xs font-mono space-y-1">
                          <div className="flex justify-between text-[#166534] font-bold">
                            <span>Scale Received:</span>
                            <span>{s.recyclerReceivedQuantity} kg</span>
                          </div>
                          <div className="flex justify-between text-[#64748b] text-[11px]">
                            <span>Weight Variance:</span>
                            <span className={`font-bold ${s.discrepancyQuantity === 0 ? 'text-[#166534]' : 'text-amber-700'}`}>
                              {s.discrepancyQuantity && s.discrepancyQuantity > 0 ? '+' : ''}{s.discrepancyQuantity} kg
                            </span>
                          </div>
                          {s.discrepancyNote && (
                            <p className="text-[10px] text-[#15803d] italic pt-0.5">"{s.discrepancyNote}"</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Action button */}
                    {!isReceived ? (
                      <button
                        onClick={() => handleOpenShipmentModal(s)}
                        className="btn-primary w-full py-2.5 text-xs shadow-xs"
                      >
                        <Scale size={14} />
                        Weighbridge Verification & Gate Intake
                      </button>
                    ) : (
                      <div className="pt-1 flex items-center justify-between text-[11px] text-[#64748b]">
                        <span className="font-mono text-[10px]">Tamper Code: {s.handoverHash}</span>
                        <span className="font-bold text-[#166534] flex items-center gap-1">
                          <FileCheck2 size={12} /> Closed
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: DIRECT HANDOVER (SINGLE LOT VERIFICATION) */}
      {tab === 'DIRECT_HANDOVER' && (
        <div className="max-w-xl mx-auto">
          <div className="kc-card p-5 sm:p-6 space-y-4">
            <div>
              <h2 className="font-black text-base text-[#1f2937]">Verify Individual Collector Code</h2>
              <p className="text-xs text-[#64748b] mt-0.5">
                Verify the 6-digit tamper-evident hash presented on the collector's digital Parchi.
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[#64748b] font-bold mb-1">Lot ID *</label>
                <input 
                  placeholder="e.g. 1234 or lot timestamp" 
                  value={lotId} 
                  onChange={e => setLotId(e.target.value)}
                  className="kc-input font-mono"
                />
              </div>

              <div>
                <label className="block text-[#64748b] font-bold mb-1">Material Category *</label>
                <input 
                  placeholder="e.g. Copper Cables or Circuit Boards (PCB)" 
                  value={material} 
                  onChange={e => setMaterial(e.target.value)}
                  className="kc-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#64748b] font-bold mb-1">Weight (kg) *</label>
                  <input 
                    placeholder="e.g. 12.5" 
                    value={weight} 
                    onChange={e => setWeight(e.target.value)}
                    className="kc-input font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[#64748b] font-bold mb-1">Estimated Value (₹) *</label>
                  <input 
                    placeholder="e.g. 5400" 
                    value={estimate} 
                    onChange={e => setEstimate(e.target.value)}
                    className="kc-input font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#64748b] font-bold mb-1">6-Digit Tamper-Proof Code *</label>
                <input 
                  placeholder="000000" 
                  value={code} 
                  onChange={e => setCode(e.target.value)}
                  maxLength={6}
                  className="kc-input text-center tracking-[0.4em] text-2xl font-black font-mono py-3 border-2 focus:border-[#166534]"
                />
              </div>

              <button 
                onClick={verifyDirectTransaction}
                className="btn-primary w-full py-3 text-sm mt-2"
              >
                <ShieldCheck size={16} />
                Verify Consignment Authenticity
              </button>

              {directResult === 'SUCCESS' && (
                <div className="p-3.5 bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl text-[#166534] flex items-start gap-2.5">
                  <ShieldCheck className="flex-shrink-0 text-[#16a34a] mt-0.5" size={18} />
                  <div>
                    <p className="font-black text-xs">Authentic & Verified</p>
                    <p className="text-[11px] text-[#15803d]">
                      SHA-256 payload checksum matches. Material, weight, and rate are intact without tampering.
                    </p>
                  </div>
                </div>
              )}

              {directResult === 'FAILED' && (
                <div className="p-3.5 bg-[#fef2f2] border border-[#fecaca] rounded-xl text-[#b91c1c] flex items-start gap-2.5">
                  <AlertTriangle className="flex-shrink-0 text-[#ef4444] mt-0.5" size={18} />
                  <div>
                    <p className="font-black text-xs">Checksum Verification Failed</p>
                    <p className="text-[11px] text-[#991b1b]">
                      The 6-digit code does not match the entered weight, material, or estimate. Possible consignment modification.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Recycler Gate Weighbridge Intake */}
      {selectedShipmentId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 sm:p-6 w-full max-w-md shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-[#e2e8f0] pb-3">
              <div>
                <span className="badge badge-success text-[10px]">CPCB Weighbridge Verification</span>
                <h3 className="font-black text-base text-[#1f2937] mt-1">Receive Bulk Consignment</h3>
              </div>
              <button 
                onClick={() => setSelectedShipmentId(null)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-[#64748b]"
              >
                <X size={18} />
              </button>
            </div>

            {hubError && (
              <div className="p-3 bg-[#fef2f2] border border-[#fecaca] rounded-xl text-[#b91c1c] text-xs flex items-center gap-2">
                <AlertCircle size={15} className="flex-shrink-0" />
                <span>{hubError}</span>
              </div>
            )}

            {(() => {
              const currentShipment = shipments.find(s => s.id === selectedShipmentId);
              if (!currentShipment) return null;

              const expected = currentShipment.dispatchedQuantity || currentShipment.plannedQuantity;
              const inputVal = parseFloat(receivedWeightInput) || 0;
              const diff = parseFloat((inputVal - expected).toFixed(2));

              return (
                <form onSubmit={handleVerifyShipment} className="space-y-3.5 text-xs">
                  <div className="p-3 bg-[#f8fafc] rounded-xl border border-[#e2e8f0] font-mono space-y-1">
                    <div className="flex justify-between text-[#64748b]">
                      <span>Shipment ID:</span>
                      <span className="font-bold text-[#1f2937]">{currentShipment.id}</span>
                    </div>
                    <div className="flex justify-between text-[#64748b]">
                      <span>Material:</span>
                      <span className="font-bold text-[#1f2937]">{currentShipment.material}</span>
                    </div>
                    <div className="flex justify-between text-[#64748b]">
                      <span>Hub Manifest Weight:</span>
                      <span className="font-bold text-[#166534]">{expected} kg</span>
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-[#1f2937] mb-1">
                      Weighbridge Scale Reading (kg) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={receivedWeightInput}
                      onChange={e => setReceivedWeightInput(e.target.value)}
                      placeholder="e.g. 49.5"
                      className="kc-input font-mono font-bold text-base"
                    />
                  </div>

                  {/* Discrepancy Preview */}
                  <div className="p-2.5 bg-[#fef3c7] border border-[#fde68a] rounded-xl font-mono flex justify-between items-center text-xs">
                    <span className="text-[#92400e] font-semibold">Scale Variance:</span>
                    <span className={`font-black ${diff === 0 ? 'text-[#166534]' : 'text-amber-800'}`}>
                      {diff > 0 ? '+' : ''}{diff} kg
                    </span>
                  </div>

                  <div>
                    <label className="block font-bold text-[#1f2937] mb-1">
                      6-Digit Manifest Code *
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      required
                      value={handoverCodeInput}
                      onChange={e => setHandoverCodeInput(e.target.value)}
                      placeholder="e.g. from Hub Manifest slip"
                      className="kc-input text-center tracking-[0.35em] font-mono font-black text-xl"
                    />
                    <p className="text-[10px] text-[#94a3b8] mt-1">
                      Printed on the physical or digital Form 6 Manifest slip issued by the Hub.
                    </p>
                  </div>

                  <div>
                    <label className="block font-bold text-[#1f2937] mb-1">
                      Inspection Notes (Optional)
                    </label>
                    <textarea
                      value={notesInput}
                      onChange={e => setNotesInput(e.target.value)}
                      placeholder="e.g. Container seals verified intact; standard tare deduction"
                      rows={2}
                      className="kc-input"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setSelectedShipmentId(null)}
                      className="btn-secondary w-1/2 py-2.5 text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn-primary w-1/2 py-2.5 text-xs"
                    >
                      <CheckCircle2 size={14} /> Confirm Intake
                    </button>
                  </div>
                </form>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
