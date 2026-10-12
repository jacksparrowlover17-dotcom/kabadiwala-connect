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

  // Lots available for aggregation:
  // Must belong to this hub, matching material, eligible received status, and NOT yet in another shipment
  const eligibleStatuses = ['RECEIVED', 'AWAITING_COLLECTOR_CONFIRMATION', 'PURCHASE_CONFIRMED', 'PAYMENT_PENDING', 'PAID'];
  const eligibleLots = allLots.filter(lot => {
    const isMaterialMatch = lot.material === selectedMaterial;
    const isEligibleStatus = eligibleStatuses.includes(lot.status);
    const isUnassigned = !lot.shipmentId;
    const isHubMatch = lot.hubId === activeHubId || !lot.hubId;
    return isMaterialMatch && isEligibleStatus && isUnassigned && isHubMatch;
  });

  // Calculate live totals for checked lots
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
      setErrorMsg('Please select at least one lot to aggregate into this shipment.');
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
      alert(`Shipment ${shipment.id} marked as DISPATCHED to ${shipment.recyclerName}.`);
    } catch (err: any) {
      alert(err.message || 'Failed to dispatch shipment.');
    }
  };

  return (
    <div className="p-4 max-w-md mx-auto pb-28 text-[#14213D]">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-4">
        <button 
          onClick={() => navigate('/hub')}
          className="p-2 rounded-xl bg-white border border-gray-200 text-gray-700 flex items-center text-xs font-bold shadow-sm"
        >
          <ArrowLeft size={16} className="mr-1" /> Back to Hub
        </button>
        <div className="flex items-center space-x-1 text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full">
          <Truck size={14} className="mr-1" />
          <span>Bulk Aggregation</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm border border-gray-100">
        <h1 className="text-xl font-black text-[#14213D]">Outgoing Recycler Shipments</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Aggregate street collector batches into CPCB-traceable commercial shipments.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 mb-4 bg-gray-200 p-1 rounded-2xl">
        <button
          onClick={() => setActiveTab('CREATE')}
          className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition ${
            activeTab === 'CREATE' ? 'bg-white text-[#14213D] shadow-sm' : 'text-gray-600 hover:text-black'
          }`}
        >
          + Aggregate New Batch
        </button>
        <button
          onClick={() => setActiveTab('LIST')}
          className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition flex items-center justify-center ${
            activeTab === 'LIST' ? 'bg-white text-[#14213D] shadow-sm' : 'text-gray-600 hover:text-black'
          }`}
        >
          Shipments <span className="ml-1.5 bg-[#14213D] text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">{shipments.length}</span>
        </button>
      </div>

      {successMsg && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-green-800 text-xs flex items-center">
          <CheckCircle2 size={16} className="mr-2 text-green-600 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs flex items-center">
          <AlertCircle size={16} className="mr-2 text-red-600 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* TAB 1: CREATE SHIPMENT */}
      {activeTab === 'CREATE' && (
        <div className="space-y-4">
          
          {/* Step 1: Material Selection */}
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-2">
            <label className="block text-xs font-bold text-gray-700">
              1. Select Compatible Material Category
            </label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setSelectedMaterial(cat);
                    setSelectedLotIds([]);
                  }}
                  className={`p-2.5 rounded-xl text-center text-xs font-bold border-2 transition ${
                    selectedMaterial === cat 
                      ? 'border-blue-600 bg-blue-50 text-blue-900 shadow-sm' 
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {cat.split(' ')[0]}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-gray-400">
              Only batches of the same material can be combined to maintain recyclability standards.
            </p>
          </div>

          {/* Step 2: Select Destination Recycler */}
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-2">
            <label className="block text-xs font-bold text-gray-700">
              2. Select Destination Authorized Recycler
            </label>
            <div className="space-y-2">
              {recyclers.map(r => (
                <div
                  key={r.id}
                  onClick={() => setSelectedRecyclerId(r.id)}
                  className={`p-3 rounded-xl border-2 cursor-pointer flex justify-between items-center transition ${
                    selectedRecyclerId === r.id
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div>
                    <p className="font-bold text-xs text-[#14213D] flex items-center">
                      {r.name}
                      <span className="ml-1.5 text-[9px] bg-green-100 text-green-800 font-bold px-1.5 py-0.2 rounded">
                        CPCB
                      </span>
                    </p>
                    <p className="text-[10px] text-gray-400 font-mono">Rate: ₹{r.rate}/kg • {r.distance} km</p>
                  </div>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    selectedRecyclerId === r.id ? 'border-blue-600 bg-blue-600' : 'border-gray-300'
                  }`}>
                    {selectedRecyclerId === r.id && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Step 3: Choose Received Lots */}
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xs font-bold text-gray-700">
                  3. Select Unassigned Stock Batches ({eligibleLots.length})
                </h2>
                <p className="text-[10px] text-gray-400">Received scrap lots stored in godown</p>
              </div>
              {eligibleLots.length > 0 && (
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-xs text-blue-600 font-bold hover:underline"
                >
                  {selectedLotIds.length === eligibleLots.length ? 'Deselect All' : 'Select All'}
                </button>
              )}
            </div>

            {eligibleLots.length === 0 ? (
              <div className="p-6 text-center text-gray-400 border border-dashed border-gray-200 rounded-xl">
                <Package size={24} className="mx-auto mb-1 text-gray-300" />
                <p className="text-xs font-medium">No available lots of "{selectedMaterial}".</p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  Receive scrap from collectors first or switch material category.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
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
                        isChecked ? 'bg-blue-50/70 border-blue-400' : 'bg-gray-50 border-gray-200 hover:bg-gray-100/70'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // handled by div click
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <div>
                          <p className="font-bold text-xs text-[#14213D]">
                            Lot #{lot.id.slice(0, 6)} • {lot.condition || 'Mixed'}
                          </p>
                          <p className="text-[10px] text-gray-500 font-mono">
                            Col: {lot.collectorId || 'KAB-7842'} • Status: {lot.status}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="font-bold text-xs text-[#14213D]">{wt.toFixed(2)} kg</span>
                        <p className="text-[10px] text-green-700 font-bold">
                          ₹{(lot.purchaseAmount || lot.estimate).toLocaleString('en-IN')}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Aggregated Live Total Card */}
          <div className="bg-[#14213D] text-white p-4 rounded-2xl shadow-lg space-y-2 font-mono">
            <div className="flex justify-between items-center text-xs text-gray-300">
              <span>Batches Selected:</span>
              <span className="font-bold text-white">{selectedLotIds.length}</span>
            </div>
            <div className="flex justify-between items-center text-xs text-gray-300">
              <span>Total Bulk Weight:</span>
              <span className="text-xl font-black text-[#FFC72C]">{totalSelectedWeight.toFixed(2)} KG</span>
            </div>
            <div className="flex justify-between items-center text-xs text-gray-300 border-t border-white/10 pt-1.5">
              <span>Hub Procurement Cost:</span>
              <span className="font-bold text-white">₹{totalPurchaseValue.toLocaleString('en-IN')}</span>
            </div>

            <button
              onClick={handleCreateShipment}
              disabled={selectedLotIds.length === 0}
              className="w-full mt-3 py-3 rounded-xl bg-[#FFC72C] text-[#14213D] font-black text-sm flex items-center justify-center hover:bg-yellow-400 disabled:opacity-40 transition active:scale-[0.98] shadow"
            >
              <Truck size={16} className="mr-2" />
              Generate Form 6 Bulk Shipment
            </button>
          </div>

        </div>
      )}

      {/* TAB 2: SHIPMENTS LIST */}
      {activeTab === 'LIST' && (
        <div className="space-y-4">
          {shipments.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl text-center text-gray-400 border border-dashed border-gray-200">
              <Truck size={32} className="mx-auto mb-2 text-gray-300" />
              <p className="font-bold text-sm text-gray-600">No outgoing shipments created yet.</p>
              <p className="text-xs mt-1">Aggregate received lots to dispatch bulk loads to recyclers.</p>
            </div>
          ) : (
            shipments.map(s => {
              const isDispatched = s.status === 'DISPATCHED';
              const isReceived = s.status === 'RECEIVED_BY_RECYCLER' || s.status === 'COMPLETED';
              const isReady = s.status === 'READY';

              return (
                <div key={s.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-3">
                  
                  {/* Top Bar */}
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-black text-sm text-[#14213D]">{s.id}</span>
                        <span className="text-[10px] bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded">
                          {s.material}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500 flex items-center mt-0.5">
                        <Building2 size={12} className="mr-1 text-gray-400" />
                        Dest: <strong className="ml-1 text-[#14213D]">{s.recyclerName}</strong>
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="font-black text-base text-[#14213D]">{s.plannedQuantity} kg</span>
                      <p className="text-[10px] text-gray-400 font-mono">{s.lotIds.length} lots</p>
                    </div>
                  </div>

                  {/* Status Indicator */}
                  <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100 flex justify-between items-center text-xs">
                    <div className="flex items-center">
                      {isReady && (
                        <span className="inline-flex items-center text-amber-700 font-bold text-[11px]">
                          <Clock size={13} className="mr-1" /> Ready at Hub (Awaiting Dispatch)
                        </span>
                      )}
                      {isDispatched && (
                        <span className="inline-flex items-center text-blue-700 font-bold text-[11px]">
                          <Truck size={13} className="mr-1" /> Dispatched • In Transit
                        </span>
                      )}
                      {isReceived && (
                        <span className="inline-flex items-center text-green-700 font-bold text-[11px]">
                          <CheckCircle2 size={13} className="mr-1" /> Delivered & Verified by Recycler
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-400 font-mono">
                      {new Date(s.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Recycler Received Weight & Discrepancy Reporting */}
                  {isReceived && typeof s.recyclerReceivedQuantity === 'number' && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-xs font-mono space-y-1">
                      <div className="flex justify-between text-emerald-900 font-bold">
                        <span>Recycler Scale Received:</span>
                        <span>{s.recyclerReceivedQuantity} kg</span>
                      </div>
                      {typeof s.discrepancyQuantity === 'number' && s.discrepancyQuantity !== 0 && (
                        <div className="flex justify-between text-amber-800 text-[11px]">
                          <span>Weighbridge Discrepancy:</span>
                          <span className="font-bold">
                            {s.discrepancyQuantity > 0 ? '+' : ''}{s.discrepancyQuantity} kg
                          </span>
                        </div>
                      )}
                      {s.discrepancyNote && (
                        <p className="text-[10px] text-emerald-700">Note: {s.discrepancyNote}</p>
                      )}
                    </div>
                  )}

                  {/* Tamper Evident Verification Hash */}
                  <div className="border border-dashed border-gray-300 bg-gray-50/50 p-2 rounded-xl flex items-center justify-between text-xs font-mono">
                    <span className="text-gray-400 text-[10px] uppercase">SHA-256 Manifest Code:</span>
                    <span className="font-black text-sm tracking-widest text-[#14213D]">{s.handoverHash}</span>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex space-x-2 pt-1">
                    {isReady && (
                      <button
                        onClick={() => handleDispatch(s)}
                        className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center transition active:scale-95 shadow"
                      >
                        <Truck size={14} className="mr-1.5" /> Dispatch Load
                      </button>
                    )}

                    <button
                      onClick={() => setPrintingShipment(s)}
                      className="flex-1 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs flex items-center justify-center transition active:scale-95"
                    >
                      <Printer size={14} className="mr-1.5 text-gray-600" /> Form 6 Manifest
                    </button>
                  </div>

                </div>
              );
            })
          )}
        </div>
      )}

      {/* MODAL: Form 6 Bulk Manifest Printable View */}
      {printingShipment && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl p-6 relative space-y-4 my-6">
            
            <div className="border-b-2 border-dashed border-gray-300 pb-3 text-center">
              <div className="inline-flex items-center bg-blue-50 text-blue-800 text-[10px] font-black uppercase px-2.5 py-1 rounded-full mb-1">
                <ShieldCheck size={12} className="mr-1 text-blue-600" />
                Official Form 6 E-Waste Bulk Transport Manifest
              </div>
              <h2 className="text-xl font-black text-[#14213D]">AGGREGATED CARGO MANIFEST</h2>
              <p className="text-xs font-mono text-gray-500">Manifest ID: {printingShipment.id}</p>
            </div>

            {/* SHA Hash Code Card */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                Tamper-Evident Cargo Verification Code
              </span>
              <div className="text-3xl font-black font-mono tracking-widest text-[#14213D] my-1">
                {printingShipment.handoverHash}
              </div>
              <p className="text-[10px] text-gray-400">
                Authorized Recycler scans or types this code at facility gate.
              </p>
            </div>

            {/* Consignor (Hub) & Consignee (Recycler) */}
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                <p className="text-[10px] font-bold text-gray-400 uppercase">ORIGIN (HUB)</p>
                <p className="font-bold text-[#14213D] text-[11px] mt-0.5">{currentHub.name}</p>
                <p className="text-[10px] text-gray-500">ID: {currentHub.id}</p>
              </div>

              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                <p className="text-[10px] font-bold text-gray-400 uppercase">DESTINATION (RECYCLER)</p>
                <p className="font-bold text-[#14213D] text-[11px] mt-0.5">{printingShipment.recyclerName}</p>
                <p className="text-[10px] text-green-700 font-bold">CPCB REGISTERED</p>
              </div>
            </div>

            {/* Bulk Material Specs */}
            <div className="bg-white border border-gray-200 rounded-xl p-3 text-xs font-mono space-y-1.5">
              <div className="flex justify-between">
                <span className="text-gray-500">Bulk Category:</span>
                <span className="font-bold">{printingShipment.material}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Aggregated Batches:</span>
                <span className="font-bold">{printingShipment.lotIds.length} Collector Lots</span>
              </div>
              <div className="flex justify-between border-t border-gray-100 pt-1 text-sm font-bold">
                <span>Dispatched Weight:</span>
                <span className="text-green-700">{printingShipment.plannedQuantity} KG</span>
              </div>
            </div>

            {/* Contributing Lots Traceability List */}
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                Traceability Audit (Contributed Lots)
              </p>
              <div className="max-h-28 overflow-y-auto bg-gray-50 p-2 rounded-xl text-[10px] font-mono space-y-1 border border-gray-200">
                {printingShipment.lotIds.map((id, index) => (
                  <div key={id} className="flex justify-between text-gray-600">
                    <span>Batch #{index + 1}: {id.slice(0, 8)}</span>
                    <span className="font-bold">Verified in Hub Godown</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex space-x-2 pt-2">
              <button
                onClick={() => window.print()}
                className="w-1/2 py-3 rounded-xl border border-gray-300 font-bold text-xs flex items-center justify-center text-gray-700 hover:bg-gray-50 transition"
              >
                <Printer size={14} className="mr-1.5" /> Print Manifest Slip
              </button>
              <button
                onClick={() => setPrintingShipment(null)}
                className="w-1/2 py-3 rounded-xl bg-[#14213D] text-white font-bold text-xs hover:bg-blue-900 transition shadow"
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
