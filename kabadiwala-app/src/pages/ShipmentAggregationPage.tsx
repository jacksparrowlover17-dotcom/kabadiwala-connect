import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { 
  db, 
  type Shipment, 
  DEMO_ACTIVE_HUB_ID, 
  DEMO_HUBS 
} from '../lib/db';
import { 
  createOutgoingShipment, 
  dispatchShipment 
} from '../lib/hubService';
import { 
  Truck, 
  Package, 
  ShieldCheck, 
  ArrowLeft, 
  CheckCircle2, 
  Clock, 
  Printer, 
  Building2, 
  AlertCircle
} from 'lucide-react';

const CATEGORIES = [
  'Circuit Boards (PCB)',
  'Copper Cables',
  'Mobile Phones'
];

export default function ShipmentAggregationPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'CREATE' | 'LIST'>('CREATE');
  const [selectedMaterial, setSelectedMaterial] = useState<string>(CATEGORIES[0]);
  const [selectedLotIds, setSelectedLotIds] = useState<string[]>([]);
  const [selectedRecyclerId, setSelectedRecyclerId] = useState<string>('R1');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Manifest Print Modal
  const [printingShipment, setPrintingShipment] = useState<Shipment | null>(null);

  const activeHubId = DEMO_ACTIVE_HUB_ID;
  const hubs = useLiveQuery(() => db.hubs.toArray()) || DEMO_HUBS;
  const currentHub = hubs.find(h => h.id === activeHubId) || DEMO_HUBS[0];

  const recyclers = useLiveQuery(() => db.recyclers.where('verified').equals(1).toArray(), []) || [];
  const allLots = useLiveQuery(() => db.lots.toArray(), []) || [];
  const shipments = useLiveQuery(
    () => db.shipments.where('hubId').equals(activeHubId).reverse().sortBy('createdAt'), 
    [activeHubId]
  ) || [];

  const eligibleStatuses = ['RECEIVED', 'AWAITING_COLLECTOR_CONFIRMATION', 'PURCHASE_CONFIRMED', 'PAYMENT_PENDING', 'PAID'];
  const eligibleLots = allLots.filter(lot => {
    const isMaterialMatch = lot.material === selectedMaterial;
    const isEligibleStatus = eligibleStatuses.includes(lot.status);
    const isUnassigned = !lot.shipmentId;
    const isHubMatch = lot.hubId === activeHubId || !lot.hubId;
    return isMaterialMatch && isEligibleStatus && isUnassigned && isHubMatch;
  });

  const selectedLots = eligibleLots.filter(l => selectedLotIds.includes(l.id));
  const totalSelectedWeight = selectedLots.reduce((acc, l) => {
    const wt = typeof l.actualWeight === 'number' && l.actualWeight > 0 ? l.actualWeight : parseFloat(l.weight) || 0;
    return acc + wt;
  }, 0);
  const totalPurchaseValue = selectedLots.reduce((acc, l) => {
    return acc + (l.purchaseAmount || l.estimate || 0);
  }, 0);

  const handleToggleLot = (id: string) => {
    setSelectedLotIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedLotIds.length === eligibleLots.length) {
      setSelectedLotIds([]);
    } else {
      setSelectedLotIds(eligibleLots.map(l => l.id));
    }
  };

  const handleCreateShipment = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (selectedLotIds.length === 0) {
      setErrorMsg('Please select at least one received lot to aggregate into this bulk shipment.');
      return;
    }

    try {
      const shipment = await createOutgoingShipment({
        hubId: activeHubId,
        recyclerId: selectedRecyclerId,
        material: selectedMaterial,
        lotIds: selectedLotIds,
      });

      setSelectedLotIds([]);
      setSuccessMsg(`Shipment ${shipment.id} created successfully with ${shipment.plannedQuantity} kg!`);
      setActiveTab('LIST');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create shipment.');
    }
  };

  const handleDispatch = async (shipment: Shipment) => {
    try {
      await dispatchShipment(shipment.id);
      alert(`Shipment ${shipment.id} dispatched to ${shipment.recyclerName}. Status updated to IN TRANSIT.`);
    } catch (err: any) {
      alert(err.message || 'Failed to dispatch shipment.');
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto pb-28">
      {/* Top Header & Navigation */}
      <div className="flex items-center justify-between mb-5 no-print">
        <button 
          onClick={() => navigate('/hub')}
          className="btn-secondary text-xs py-2 px-3.5"
        >
          <ArrowLeft size={15} /> Back to Hub Intake
        </button>
        <div className="flex items-center gap-1.5 text-xs font-bold text-[#166534] bg-[#dcfce7] px-3 py-1 rounded-full">
          <Truck size={13} />
          <span>Form 6 Cargo Aggregation</span>
        </div>
      </div>

      {/* Main Intro Card */}
      <div className="kc-card p-5 sm:p-6 mb-5 bg-white border-l-4 border-l-[#166534]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-[#1f2937]">Outgoing Recycler Shipments</h1>
            <p className="text-xs text-[#64748b] mt-1">
              Bundle verified street collector batches into CPCB-compliant commercial bulk shipments.
            </p>
          </div>

          {/* Tab Switcher */}
          <div className="flex bg-[#f1f5f9] p-1 rounded-xl self-start sm:self-auto border border-[#e2e8f0]">
            <button
              onClick={() => setActiveTab('CREATE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === 'CREATE'
                  ? 'bg-white text-[#166534] shadow-xs'
                  : 'text-[#64748b] hover:text-[#1f2937]'
              }`}
            >
              + Aggregate New Batch
            </button>
            <button
              onClick={() => setActiveTab('LIST')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'LIST'
                  ? 'bg-white text-[#166534] shadow-xs'
                  : 'text-[#64748b] hover:text-[#1f2937]'
              }`}
            >
              Shipments
              <span className="bg-[#166534] text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                {shipments.length}
              </span>
            </button>
          </div>
        </div>
      </div>

      {successMsg && (
        <div className="mb-4 p-3.5 bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl text-[#166534] text-xs flex items-center gap-2">
          <CheckCircle2 size={16} className="text-[#16a34a] flex-shrink-0" />
          <span className="font-medium">{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="mb-4 p-3.5 bg-[#fef2f2] border border-[#fecaca] rounded-xl text-[#b91c1c] text-xs flex items-center gap-2">
          <AlertCircle size={16} className="flex-shrink-0" />
          <span className="font-medium">{errorMsg}</span>
        </div>
      )}

      {/* TAB 1: CREATE SHIPMENT */}
      {activeTab === 'CREATE' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          
          <div className="lg:col-span-2 space-y-4">
            {/* Step 1: Material Category */}
            <div className="kc-card p-4 sm:p-5 space-y-2.5">
              <label className="block text-xs font-bold text-[#1f2937] uppercase tracking-wider">
                1. Select Material Category
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      setSelectedMaterial(cat);
                      setSelectedLotIds([]);
                    }}
                    className={`p-3 rounded-xl text-center text-xs font-bold border-2 transition ${
                      selectedMaterial === cat 
                        ? 'border-[#166534] bg-[#f0fdf4] text-[#166534] shadow-xs' 
                        : 'border-[#e2e8f0] bg-white text-[#64748b] hover:border-gray-300'
                    }`}
                  >
                    {cat.split(' ')[0]}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-[#94a3b8]">
                Only lots of identical material category can be aggregated into a single transport manifest.
              </p>
            </div>

            {/* Step 2: Destination Recycler */}
            <div className="kc-card p-4 sm:p-5 space-y-2.5">
              <label className="block text-xs font-bold text-[#1f2937] uppercase tracking-wider">
                2. Select Destination Recycler
              </label>
              <div className="space-y-2">
                {recyclers.map(r => (
                  <div
                    key={r.id}
                    onClick={() => setSelectedRecyclerId(r.id)}
                    className={`p-3 rounded-xl border-2 cursor-pointer flex justify-between items-center transition ${
                      selectedRecyclerId === r.id
                        ? 'border-[#166534] bg-[#f0fdf4]'
                        : 'border-[#e2e8f0] hover:border-gray-300'
                    }`}
                  >
                    <div>
                      <p className="font-black text-xs text-[#1f2937] flex items-center gap-1.5">
                        {r.name}
                        <span className="badge badge-success text-[9px] py-0">
                          CPCB
                        </span>
                      </p>
                      <p className="text-[10px] text-[#64748b] font-mono mt-0.5">Rate: ₹{r.rate}/kg · Distance: {r.distance} km</p>
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      selectedRecyclerId === r.id ? 'border-[#166534] bg-[#166534]' : 'border-gray-300'
                    }`}>
                      {selectedRecyclerId === r.id && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Step 3: Choose Received Lots */}
            <div className="kc-card p-4 sm:p-5 space-y-3">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xs font-bold text-[#1f2937] uppercase tracking-wider">
                    3. Select Stock Lots ({eligibleLots.length} available)
                  </h2>
                  <p className="text-[11px] text-[#64748b]">Unassigned scrap lots stored in depot godown</p>
                </div>
                {eligibleLots.length > 0 && (
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="text-xs text-[#166534] font-bold hover:underline"
                  >
                    {selectedLotIds.length === eligibleLots.length ? 'Deselect All' : 'Select All'}
                  </button>
                )}
              </div>

              {eligibleLots.length === 0 ? (
                <div className="p-8 text-center text-[#64748b] border border-dashed border-[#e2e8f0] rounded-xl">
                  <Package size={28} className="mx-auto mb-2 text-[#94a3b8]" />
                  <p className="text-xs font-bold text-[#1f2937]">No stock lots found for "{selectedMaterial}".</p>
                  <p className="text-[11px] text-[#94a3b8] mt-0.5">
                    Intake loads from informal collectors on the Hub Intake page or switch category.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {eligibleLots.map(lot => {
                    const isChecked = selectedLotIds.includes(lot.id);
                    const wt = typeof lot.actualWeight === 'number' && lot.actualWeight > 0 
                      ? lot.actualWeight 
                      : parseFloat(lot.weight);

                    return (
                      <div
                        key={lot.id}
                        onClick={() => handleToggleLot(lot.id)}
                        className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                          isChecked 
                            ? 'bg-[#f0fdf4] border-[#86efac]' 
                            : 'bg-[#f8fafc] border-[#e2e8f0] hover:bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="w-4 h-4 text-[#166534] rounded cursor-pointer accent-[#166534]"
                          />
                          <div>
                            <p className="font-bold text-xs text-[#1f2937]">
                              Lot #{lot.id.slice(0, 8)} · {lot.condition || 'Mixed'}
                            </p>
                            <p className="text-[10px] text-[#64748b] font-mono">
                              Collector: {lot.collectorId || 'KAB-7842'} · Status: {lot.status}
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="font-black text-xs text-[#1f2937]">{wt.toFixed(2)} kg</span>
                          <p className="text-[10px] text-[#166534] font-bold">
                            ₹{(lot.purchaseAmount || lot.estimate).toLocaleString('en-IN')}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

          {/* Right Column: Aggregation Summary Card */}
          <div className="lg:col-span-1">
            <div className="kc-card p-5 sticky top-20 space-y-4 bg-white border-2 border-[#166534]">
              <div>
                <span className="badge badge-success text-[10px]">Commercial Cargo Summary</span>
                <h3 className="font-black text-base text-[#1f2937] mt-1">Aggregated Load</h3>
                <p className="text-xs text-[#64748b]">CPCB Form 6 Electronic Manifest</p>
              </div>

              <div className="p-3 bg-[#f8fafc] rounded-xl border border-[#e2e8f0] space-y-2 text-xs font-mono">
                <div className="flex justify-between text-[#64748b]">
                  <span>Category:</span>
                  <span className="font-bold text-[#1f2937]">{selectedMaterial}</span>
                </div>
                <div className="flex justify-between text-[#64748b]">
                  <span>Lots Selected:</span>
                  <span className="font-bold text-[#1f2937]">{selectedLotIds.length}</span>
                </div>
                <div className="flex justify-between text-[#64748b] border-t border-[#e2e8f0] pt-2">
                  <span>Gross Weight:</span>
                  <span className="text-base font-black text-[#166534]">{totalSelectedWeight.toFixed(2)} KG</span>
                </div>
                <div className="flex justify-between text-[#64748b]">
                  <span>Procurement Cost:</span>
                  <span className="font-bold text-[#1f2937]">₹{totalPurchaseValue.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <button
                onClick={handleCreateShipment}
                disabled={selectedLotIds.length === 0}
                className="btn-primary w-full py-3.5 text-sm shadow-md"
              >
                <Truck size={16} />
                Generate Bulk Cargo Manifest
              </button>

              <p className="text-[11px] text-[#94a3b8] text-center leading-relaxed">
                Locks selected collector batches and generates a cryptographic SHA-256 cargo verification hash.
              </p>
            </div>
          </div>

        </div>
      )}

      {/* TAB 2: SHIPMENTS LIST */}
      {activeTab === 'LIST' && (
        <div className="space-y-4">
          {shipments.length === 0 ? (
            <div className="kc-card p-10 text-center text-[#64748b] border-dashed">
              <Truck size={36} className="mx-auto mb-2 text-[#94a3b8]" />
              <p className="font-bold text-sm text-[#1f2937]">No bulk shipments created yet</p>
              <p className="text-xs mt-1 text-[#64748b]">
                Aggregate received stock batches in the "Aggregate New Batch" tab to dispatch to authorized recyclers.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {shipments.map(s => {
                const isDispatched = s.status === 'DISPATCHED';
                const isReceived = s.status === 'RECEIVED_BY_RECYCLER' || s.status === 'COMPLETED';
                const isReady = s.status === 'READY';

                return (
                  <div key={s.id} className="kc-card p-4 space-y-3 flex flex-col justify-between">
                    <div className="space-y-2.5">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-black text-sm text-[#1f2937]">{s.id}</span>
                            <span className="badge badge-active text-[10px]">
                              {s.material}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#64748b] flex items-center gap-1 mt-1">
                            <Building2 size={12} className="text-gray-400" />
                            Dest: <strong className="text-[#1f2937]">{s.recyclerName}</strong>
                          </p>
                        </div>

                        <div className="text-right flex-shrink-0">
                          <span className="font-black text-base text-[#1f2937]">{s.plannedQuantity} kg</span>
                          <p className="text-[10px] text-[#64748b] font-mono">{s.lotIds.length} lots</p>
                        </div>
                      </div>

                      {/* Status indicator */}
                      <div className="p-2 bg-[#f8fafc] rounded-xl border border-[#e2e8f0] flex justify-between items-center text-xs">
                        <div>
                          {isReady && (
                            <span className="inline-flex items-center gap-1 text-amber-800 font-bold text-[11px]">
                              <Clock size={13} /> Ready at Hub (Awaiting Dispatch)
                            </span>
                          )}
                          {isDispatched && (
                            <span className="inline-flex items-center gap-1 text-[#1d4ed8] font-bold text-[11px]">
                              <Truck size={13} /> Dispatched · In Transit
                            </span>
                          )}
                          {isReceived && (
                            <span className="inline-flex items-center gap-1 text-[#166534] font-bold text-[11px]">
                              <CheckCircle2 size={13} /> Delivered & Verified by Recycler
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-[#94a3b8] font-mono">
                          {new Date(s.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      {/* Recycler Received Weight & Discrepancy */}
                      {isReceived && typeof s.recyclerReceivedQuantity === 'number' && (
                        <div className="p-2.5 bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl text-xs font-mono space-y-1">
                          <div className="flex justify-between text-[#166534] font-bold">
                            <span>Recycler Scale Received:</span>
                            <span>{s.recyclerReceivedQuantity} kg</span>
                          </div>
                          {typeof s.discrepancyQuantity === 'number' && s.discrepancyQuantity !== 0 && (
                            <div className="flex justify-between text-amber-800 text-[11px]">
                              <span>Weighbridge Variance:</span>
                              <span className="font-bold">
                                {s.discrepancyQuantity > 0 ? '+' : ''}{s.discrepancyQuantity} kg
                              </span>
                            </div>
                          )}
                          {s.discrepancyNote && (
                            <p className="text-[10px] text-[#15803d]">Note: {s.discrepancyNote}</p>
                          )}
                        </div>
                      )}

                      {/* Tamper Code */}
                      <div className="p-2 rounded-xl bg-[#f8fafc] border border-dashed border-[#cbd5e1] flex items-center justify-between text-xs font-mono">
                        <span className="text-[#64748b] text-[10px] uppercase">Manifest Code:</span>
                        <span className="font-black text-sm tracking-widest text-[#166534]">{s.handoverHash}</span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2 pt-2">
                      {isReady && (
                        <button
                          onClick={() => handleDispatch(s)}
                          className="btn-primary flex-1 py-2 text-xs"
                        >
                          <Truck size={14} /> Dispatch Load
                        </button>
                      )}

                      <button
                        onClick={() => setPrintingShipment(s)}
                        className="btn-secondary flex-1 py-2 text-xs"
                      >
                        <Printer size={14} /> Form 6 Manifest
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL: Form 6 Bulk Manifest Printable View */}
      {printingShipment && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-3 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl p-5 sm:p-6 relative space-y-4 my-6">
            
            <div className="border-b-2 border-dashed border-[#cbd5e1] pb-3 text-center">
              <div className="inline-flex items-center gap-1.5 bg-[#dcfce7] text-[#166534] text-[10px] font-black uppercase px-2.5 py-1 rounded-full mb-1">
                <ShieldCheck size={12} />
                Official Form 6 E-Waste Bulk Transport Manifest
              </div>
              <h2 className="text-xl font-black text-[#1f2937]">AGGREGATED CARGO MANIFEST</h2>
              <p className="text-xs font-mono text-[#64748b]">Manifest ID: {printingShipment.id}</p>
            </div>

            {/* SHA Hash Code Card */}
            <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-3 text-center">
              <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">
                Tamper-Evident Cargo Verification Code
              </span>
              <div className="text-3xl font-black font-mono tracking-widest text-[#166534] my-1">
                {printingShipment.handoverHash}
              </div>
              <p className="text-[10px] text-[#94a3b8]">
                Authorized Recycler verifies this code upon weighbridge scale intake.
              </p>
            </div>

            {/* Hub and Recycler details */}
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-3 bg-[#f8fafc] rounded-xl border border-[#e2e8f0]">
                <p className="text-[10px] font-bold text-[#64748b] uppercase">ORIGIN (HUB)</p>
                <p className="font-bold text-[#1f2937] text-[11px] mt-0.5">{currentHub.name}</p>
                <p className="text-[10px] text-[#94a3b8]">ID: {currentHub.id}</p>
              </div>

              <div className="p-3 bg-[#f8fafc] rounded-xl border border-[#e2e8f0]">
                <p className="text-[10px] font-bold text-[#64748b] uppercase">DESTINATION</p>
                <p className="font-bold text-[#1f2937] text-[11px] mt-0.5">{printingShipment.recyclerName}</p>
                <p className="text-[10px] text-[#166534] font-bold">CPCB REGISTERED</p>
              </div>
            </div>

            {/* Bulk Material Specs */}
            <div className="p-3 bg-white border border-[#e2e8f0] rounded-xl text-xs font-mono space-y-1.5">
              <div className="flex justify-between">
                <span className="text-[#64748b]">Bulk Category:</span>
                <span className="font-bold text-[#1f2937]">{printingShipment.material}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748b]">Aggregated Batches:</span>
                <span className="font-bold text-[#1f2937]">{printingShipment.lotIds.length} Collector Lots</span>
              </div>
              <div className="flex justify-between border-t border-[#e2e8f0] pt-1.5 text-sm font-bold">
                <span>Dispatched Weight:</span>
                <span className="text-[#166534]">{printingShipment.plannedQuantity} KG</span>
              </div>
            </div>

            {/* Contributing Lots Traceability List */}
            <div>
              <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider mb-1">
                Traceability Audit (Contributed Lots)
              </p>
              <div className="max-h-28 overflow-y-auto p-2 bg-[#f8fafc] rounded-xl text-[10px] font-mono space-y-1 border border-[#e2e8f0]">
                {printingShipment.lotIds.map((id, index) => (
                  <div key={id} className="flex justify-between text-[#64748b]">
                    <span>Batch #{index + 1}: {id.slice(0, 8)}</span>
                    <span className="font-bold text-[#166534]">Verified in Godown</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => window.print()}
                className="btn-secondary w-1/2 py-2.5 text-xs"
              >
                <Printer size={14} /> Print Slip
              </button>
              <button
                onClick={() => setPrintingShipment(null)}
                className="btn-primary w-1/2 py-2.5 text-xs"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
