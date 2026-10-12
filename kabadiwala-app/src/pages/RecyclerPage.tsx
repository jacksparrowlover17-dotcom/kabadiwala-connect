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
  AlertCircle
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

  // Direct Handover state (legacy)
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
      setHubError('Please enter a valid scale weight in kg.');
      return;
    }

    try {
      const updated = await receiveShipmentAtRecycler({
        shipmentId: selectedShipmentId,
        receivedWeight,
        handoverCode: handoverCodeInput.trim(),
        note: notesInput.trim() || undefined
      });

      setHubSuccess(`Shipment ${updated.id} verified and recorded with ${updated.discrepancyQuantity} kg discrepancy.`);
      setSelectedShipmentId(null);
    } catch (err: any) {
      setHubError(err.message || 'Verification failed.');
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
    <div className="p-4 max-w-md mx-auto pb-28 text-[#14213D]">
      {/* Header */}
      <div className="bg-[#14213D] text-white p-5 rounded-3xl mb-4 shadow-lg">
        <div className="flex justify-between items-center mb-1">
          <h1 className="text-xl font-black">Authorized Recycler Gate</h1>
          <span className="text-[10px] bg-green-500/20 text-green-300 border border-green-500/30 px-2 py-0.5 rounded-full font-bold">
            CPCB Verified
          </span>
        </div>
        <p className="text-xs text-gray-300">
          Green Earth Recycling Facility • Peenya Industrial Area
        </p>

        {/* Tab switch */}
        <div className="flex space-x-2 mt-4 bg-white/10 p-1 rounded-2xl">
          <button
            onClick={() => setTab('HUB_SHIPMENTS')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition ${
              tab === 'HUB_SHIPMENTS' ? 'bg-[#FFC72C] text-[#14213D] shadow' : 'text-gray-300 hover:text-white'
            }`}
          >
            Hub Bulk Shipments ({shipments.length})
          </button>
          <button
            onClick={() => setTab('DIRECT_HANDOVER')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition ${
              tab === 'DIRECT_HANDOVER' ? 'bg-[#FFC72C] text-[#14213D] shadow' : 'text-gray-300 hover:text-white'
            }`}
          >
            Direct Handover
          </button>
        </div>
      </div>

      {hubSuccess && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-2xl text-green-800 text-xs flex items-center">
          <CheckCircle2 size={16} className="mr-2 text-green-600 flex-shrink-0" />
          <span>{hubSuccess}</span>
        </div>
      )}

      {/* TAB 1: HUB SHIPMENTS */}
      {tab === 'HUB_SHIPMENTS' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center mb-1">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Incoming Form 6 Shipments
            </h2>
            <span className="text-[10px] text-gray-400 font-mono">Real-time IndexedDB</span>
          </div>

          {shipments.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl text-center text-gray-400 border border-dashed border-gray-200">
              <Truck size={32} className="mx-auto mb-2 text-gray-300" />
              <p className="font-bold text-sm text-gray-600">No shipments received yet.</p>
              <p className="text-xs mt-1">
                Dispatch an aggregated batch from the Hub Dashboard to test recycler weigh-in.
              </p>
            </div>
          ) : (
            shipments.map(s => {
              const isReceived = s.status === 'RECEIVED_BY_RECYCLER' || s.status === 'COMPLETED';
              const isDispatched = s.status === 'DISPATCHED';

              return (
                <div key={s.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className="font-mono font-black text-sm text-[#14213D]">{s.id}</span>
                        <span className="text-[10px] bg-blue-50 text-blue-700 font-bold px-1.5 py-0.2 rounded">
                          {s.material}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        Hub ID: <span className="font-mono">{s.hubId}</span> • {s.lotIds.length} Batches
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="font-black text-sm text-[#14213D]">{s.plannedQuantity} kg</span>
                      <p className="text-[10px] text-gray-400 font-mono">Dispatched</p>
                    </div>
                  </div>

                  {/* Verification Status */}
                  <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100 text-xs flex justify-between items-center">
                    <div>
                      {isReceived ? (
                        <span className="inline-flex items-center text-green-700 font-bold">
                          <CheckCircle2 size={13} className="mr-1" /> Verified at Weighbridge
                        </span>
                      ) : isDispatched ? (
                        <span className="inline-flex items-center text-blue-700 font-bold">
                          <Truck size={13} className="mr-1" /> In Transit from Hub
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-amber-700 font-bold">
                          ● Ready at Hub (Not Yet Dispatched)
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-gray-400 text-[10px]">
                      {new Date(s.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {/* If already received, show discrepancy details */}
                  {isReceived && typeof s.recyclerReceivedQuantity === 'number' && (
                    <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-2.5 text-xs font-mono space-y-1">
                      <div className="flex justify-between text-emerald-950 font-bold">
                        <span>Recycler Scale Received:</span>
                        <span>{s.recyclerReceivedQuantity} kg</span>
                      </div>
                      <div className="flex justify-between text-gray-600 text-[11px]">
                        <span>Scale Discrepancy:</span>
                        <span className={`font-bold ${s.discrepancyQuantity === 0 ? 'text-green-600' : 'text-amber-700'}`}>
                          {s.discrepancyQuantity && s.discrepancyQuantity > 0 ? '+' : ''}{s.discrepancyQuantity} kg
                        </span>
                      </div>
                      {s.discrepancyNote && (
                        <p className="text-[10px] text-emerald-800 italic pt-0.5">"{s.discrepancyNote}"</p>
                      )}
                    </div>
                  )}

                  {/* Action Button */}
                  {!isReceived && (
                    <button
                      onClick={() => handleOpenShipmentModal(s)}
                      className="w-full py-2.5 rounded-xl bg-[#14213D] hover:bg-blue-900 text-white font-bold text-xs flex items-center justify-center transition shadow active:scale-95"
                    >
                      <Scale size={14} className="mr-1.5 text-[#FFC72C]" />
                      Weighbridge Verification & Gate Intake
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 2: DIRECT COLLECTOR HANDOVER (LEGACY) */}
      {tab === 'DIRECT_HANDOVER' && (
        <div className="bg-white text-black p-5 rounded-2xl shadow-sm border border-gray-100 space-y-3 text-xs">
          <div>
            <h2 className="font-bold text-sm text-[#14213D]">Single Collector Handover Code</h2>
            <p className="text-[11px] text-gray-500">Manual verification of individual informal collector batch.</p>
          </div>
          
          <div>
            <label className="block text-gray-700 font-bold mb-1">Lot ID</label>
            <input 
              placeholder="e.g. 1234" 
              value={lotId} onChange={e => setLotId(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-gray-300 font-mono"
            />
          </div>

          <div>
            <label className="block text-gray-700 font-bold mb-1">Material Category</label>
            <input 
              placeholder="e.g. Copper Cables" 
              value={material} onChange={e => setMaterial(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-gray-300"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-gray-700 font-bold mb-1">Weight (kg)</label>
              <input 
                placeholder="e.g. 12" 
                value={weight} onChange={e => setWeight(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-gray-300 font-mono"
              />
            </div>
            <div>
              <label className="block text-gray-700 font-bold mb-1">Payment (₹)</label>
              <input 
                placeholder="e.g. 5400" 
                value={estimate} onChange={e => setEstimate(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-gray-300 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-gray-700 font-bold mb-1">6-Digit Tamper-Proof Code</label>
            <input 
              placeholder="000000" 
              value={code} onChange={e => setCode(e.target.value)}
              maxLength={6}
              className="w-full p-3 text-center tracking-[0.5em] text-2xl font-black rounded-xl border-2 border-[#FFC72C] font-mono focus:outline-none"
            />
          </div>

          <button 
            onClick={verifyDirectTransaction}
            className="w-full bg-[#14213D] text-white py-3 rounded-xl font-bold text-sm shadow hover:bg-blue-900 transition"
          >
            Verify Handover Authenticity
          </button>

          {directResult === 'SUCCESS' && (
            <div className="bg-green-50 border border-green-200 text-green-800 p-3 rounded-xl flex items-start">
              <ShieldCheck className="mr-2 flex-shrink-0 text-green-600" size={18} />
              <div>
                <p className="font-bold">Verified & Authentic</p>
                <p className="text-[11px]">Weight, material, and rate match original collector manifest. Handover approved.</p>
              </div>
            </div>
          )}

          {directResult === 'FAILED' && (
            <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-xl flex items-start">
              <AlertTriangle className="mr-2 flex-shrink-0 text-red-600" size={18} />
              <div>
                <p className="font-bold">Verification Failed</p>
                <p className="text-[11px]">SHA hash checksum mismatch. The consignment payload may have been altered.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL: Recycler Gate Weighbridge Intake */}
      {selectedShipmentId && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 w-full max-w-sm shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-gray-100 pb-2">
              <div>
                <span className="text-[10px] text-blue-600 font-black uppercase">CPCB Weighbridge Verification</span>
                <h3 className="font-black text-base text-[#14213D]">Receive Bulk Consignment</h3>
              </div>
              <button 
                onClick={() => setSelectedShipmentId(null)}
                className="text-gray-400 hover:text-gray-600 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            {hubError && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center">
                <AlertCircle size={14} className="mr-1.5 flex-shrink-0" />
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
                <form onSubmit={handleVerifyShipment} className="space-y-3 text-xs">
                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 font-mono space-y-1">
                    <div className="flex justify-between text-gray-500">
                      <span>Shipment ID:</span>
                      <span className="font-bold text-[#14213D]">{currentShipment.id}</span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>Material:</span>
                      <span className="font-bold text-[#14213D]">{currentShipment.material}</span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>Dispatched from Hub:</span>
                      <span className="font-bold text-blue-700">{expected} kg</span>
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      Weighbridge Scale Reading (kg) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={receivedWeightInput}
                      onChange={e => setReceivedWeightInput(e.target.value)}
                      placeholder="e.g. 49.5"
                      className="w-full p-3 rounded-xl border border-gray-300 font-mono font-bold text-base focus:border-blue-600 focus:outline-none"
                    />
                  </div>

                  {/* Discrepancy Preview */}
                  <div className="bg-yellow-50 border border-yellow-200 p-2.5 rounded-xl font-mono flex justify-between items-center text-xs">
                    <span className="text-yellow-900 font-semibold">Scale Discrepancy:</span>
                    <span className={`font-black ${diff === 0 ? 'text-green-700' : 'text-amber-800'}`}>
                      {diff > 0 ? '+' : ''}{diff} kg
                    </span>
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      6-Digit Manifest Code *
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      required
                      value={handoverCodeInput}
                      onChange={e => setHandoverCodeInput(e.target.value)}
                      placeholder="e.g. from Hub Manifest slip"
                      className="w-full p-3 text-center tracking-[0.4em] font-mono font-black text-xl rounded-xl border border-gray-300 focus:border-blue-600 focus:outline-none"
                    />
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      Enter the 6-digit verification code printed on the Hub Form 6 Manifest slip.
                    </p>
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      Inspection / Discrepancy Notes (Optional)
                    </label>
                    <textarea
                      value={notesInput}
                      onChange={e => setNotesInput(e.target.value)}
                      placeholder="e.g. Checked seal intact, moisture deduction noted"
                      rows={2}
                      className="w-full p-2 rounded-xl border border-gray-300 text-xs focus:border-blue-600 focus:outline-none"
                    />
                  </div>

                  <div className="flex space-x-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setSelectedShipmentId(null)}
                      className="w-1/2 py-2.5 rounded-xl font-bold bg-gray-100 text-gray-700 hover:bg-gray-200 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="w-1/2 py-2.5 rounded-xl font-bold bg-green-600 text-white hover:bg-green-700 transition flex items-center justify-center shadow"
                    >
                      <CheckCircle2 size={14} className="mr-1" /> Confirm Intake
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
