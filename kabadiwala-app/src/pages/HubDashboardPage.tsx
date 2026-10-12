import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { 
  db, 
  type Lot, 
  type HubPurchase, 
  type Payment, 
  DEMO_HUBS, 
  DEMO_ACTIVE_HUB_ID, 
  ensureDemoData 
} from '../lib/db';
import { 
  acceptLotRequest, 
  rejectLotRequest, 
  receiveLotAtHub, 
  recordHubPayment 
} from '../lib/hubService';
import { PurchaseReceiptModal } from '../components/PurchaseReceiptModal';
import { 
  Building2, 
  Package, 
  Scale, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  CreditCard, 
  Truck, 
  Filter, 
  AlertCircle, 
  ArrowRight, 
  User, 
  Sparkles,
  Banknote,
  Smartphone
} from 'lucide-react';

const MATERIAL_OPTIONS = [
  'All Materials',
  'Circuit Boards (PCB)',
  'Copper Cables',
  'Mobile Phones'
];

export default function HubDashboardPage() {
  const navigate = useNavigate();

  // Selected Hub (Demo)
  const [activeHubId, setActiveHubId] = useState<string>(DEMO_ACTIVE_HUB_ID);
  
  // Filter states
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [materialFilter, setMaterialFilter] = useState<string>('All Materials');

  // Modals state
  const [rejectingLot, setRejectingLot] = useState<Lot | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('Incompatible scrap condition / Quality below threshold');

  // Weigh-in modal state
  const [weighingLot, setWeighingLot] = useState<Lot | null>(null);
  const [actualWeightInput, setActualWeightInput] = useState<string>('');
  const [agreedRateInput, setAgreedRateInput] = useState<string>('250');
  const [deductionsInput, setDeductionsInput] = useState<string>('0');
  const [deductionReasonInput, setDeductionReasonInput] = useState<string>('Moisture / Dirt Sorting Deduction');
  const [weighError, setWeighError] = useState<string | null>(null);

  // Payment recording modal state
  const [payingLot, setPayingLot] = useState<Lot | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'UPI'>('CASH');
  const [paymentRefNote, setPaymentRefNote] = useState<string>('');
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Receipt viewing modal state
  const [viewingReceiptLot, setViewingReceiptLot] = useState<Lot | null>(null);
  const [activePurchase, setActivePurchase] = useState<HubPurchase | undefined>(undefined);
  const [activePayment, setActivePayment] = useState<Payment | undefined>(undefined);

  // Ensure initial data
  useEffect(() => {
    ensureDemoData();
  }, []);

  // Live queries
  const hubs = useLiveQuery(() => db.hubs.toArray()) || DEMO_HUBS;
  const currentHub = hubs.find(h => h.id === activeHubId) || DEMO_HUBS[0];

  const allLots = useLiveQuery(() => db.lots.toArray(), []) || [];
  const shipments = useLiveQuery(() => db.shipments.where('hubId').equals(activeHubId).toArray(), [activeHubId]) || [];
  const allPayments = useLiveQuery(() => db.payments.where('hubId').equals(activeHubId).toArray(), [activeHubId]) || [];

  // Filter lots that belong to this hub or are unassigned requests
  const hubLots = allLots.filter(lot => {
    // Lots explicitly requested for this hub or general pending loads
    return lot.hubId === activeHubId || (!lot.hubId && (lot.status === 'PENDING' || lot.status === 'REQUESTED'));
  });

  // Derived metrics
  const requestedLots = hubLots.filter(l => l.status === 'REQUESTED');
  const acceptedLots = hubLots.filter(l => l.status === 'ACCEPTED');
  const rejectedLots = hubLots.filter(l => l.status === 'REJECTED' || l.status === 'CANCELLED');
  const receivedLots = hubLots.filter(l => 
    ['RECEIVED', 'AWAITING_COLLECTOR_CONFIRMATION', 'PURCHASE_CONFIRMED', 'PAYMENT_PENDING', 'PAID'].includes(l.status)
  );

  const totalReceivedWeightKg = receivedLots.reduce((acc, l) => {
    const wt = typeof l.actualWeight === 'number' && l.actualWeight > 0 
      ? l.actualWeight 
      : (parseFloat(l.weight) || 0);
    return acc + wt;
  }, 0);

  const totalPurchaseValue = receivedLots.reduce((acc, l) => acc + (l.purchaseAmount || l.estimate || 0), 0);
  
  const pendingPaymentLots = hubLots.filter(l => 
    l.status === 'PURCHASE_CONFIRMED' || l.status === 'PAYMENT_PENDING'
  );
  const pendingPaymentAmount = pendingPaymentLots.reduce((acc, l) => acc + (l.purchaseAmount || 0), 0);

  const completedPaymentLots = hubLots.filter(l => l.status === 'PAID');
  const completedPaymentAmount = allPayments.length > 0
    ? allPayments.reduce((acc, p) => acc + p.amount, 0)
    : completedPaymentLots.reduce((acc, l) => acc + (l.purchaseAmount || 0), 0);

  // Apply filters to list
  const filteredLots = hubLots.filter(lot => {
    // Material filter
    if (materialFilter !== 'All Materials' && lot.material !== materialFilter) {
      return false;
    }
    // Status filter
    if (statusFilter === 'REQUESTED') return lot.status === 'REQUESTED';
    if (statusFilter === 'ACCEPTED') return lot.status === 'ACCEPTED';
    if (statusFilter === 'RECEIVED') return lot.status === 'RECEIVED' || lot.status === 'AWAITING_COLLECTOR_CONFIRMATION';
    if (statusFilter === 'UNPAID') return lot.status === 'PURCHASE_CONFIRMED' || lot.status === 'PAYMENT_PENDING';
    if (statusFilter === 'PAID') return lot.status === 'PAID';
    if (statusFilter === 'REJECTED') return lot.status === 'REJECTED' || lot.status === 'CANCELLED';
    return true; // ALL
  });

  // Handlers
  const handleAccept = async (lot: Lot) => {
    try {
      await acceptLotRequest(lot.id, activeHubId);
    } catch (err: any) {
      alert(err.message || 'Error accepting request');
    }
  };

  const handleOpenReject = (lot: Lot) => {
    setRejectingLot(lot);
    setRejectReason('Scrap quality does not meet sorting standard or contaminated.');
  };

  const handleConfirmReject = async () => {
    if (!rejectingLot) return;
    try {
      await rejectLotRequest(rejectingLot.id, activeHubId, rejectReason);
      setRejectingLot(null);
    } catch (err: any) {
      alert(err.message || 'Error rejecting request');
    }
  };

  const handleOpenWeighIn = (lot: Lot) => {
    setWeighingLot(lot);
    // Prefill estimated weight as default suggestion for convenience
    setActualWeightInput(lot.weight);
    // Suggest standard rate
    const defaultRate = lot.material.includes('Phone') ? '1200' : (lot.material.includes('Cable') ? '450' : '250');
    setAgreedRateInput(defaultRate);
    setDeductionsInput('0');
    setWeighError(null);
  };

  const handleConfirmWeighIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!weighingLot) return;
    setWeighError(null);

    const actualWeight = parseFloat(actualWeightInput);
    const agreedRate = parseFloat(agreedRateInput);
    const deductions = parseFloat(deductionsInput) || 0;

    if (isNaN(actualWeight) || actualWeight <= 0) {
      setWeighError('Please enter a valid positive actual weight in kg.');
      return;
    }
    if (isNaN(agreedRate) || agreedRate < 0) {
      setWeighError('Please enter a valid agreed purchase rate.');
      return;
    }

    try {
      await receiveLotAtHub(
        weighingLot.id,
        activeHubId,
        actualWeight,
        agreedRate,
        deductions,
        deductions > 0 ? deductionReasonInput : undefined
      );
      setWeighingLot(null);
    } catch (err: any) {
      setWeighError(err.message || 'Failed to record actual received weight.');
    }
  };

  const handleOpenPayment = (lot: Lot) => {
    setPayingLot(lot);
    setPaymentMethod('CASH');
    setPaymentRefNote(`VOUCHER-${lot.id.slice(0, 6).toUpperCase()}`);
    setPaymentError(null);
  };

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingLot) return;
    setPaymentError(null);

    const amount = payingLot.purchaseAmount || payingLot.estimate || 0;
    if (amount <= 0) {
      setPaymentError('Calculated purchase amount must be greater than zero.');
      return;
    }

    try {
      await recordHubPayment({
        lotId: payingLot.id,
        hubId: activeHubId,
        collectorId: payingLot.collectorId || 'KAB-7842',
        amount,
        method: paymentMethod,
        referenceNote: paymentRefNote.trim() || undefined,
        recordedBy: currentHub.ownerName || 'Hub Scrap Operator'
      });
      setPayingLot(null);
    } catch (err: any) {
      setPaymentError(err.message || 'Failed to record payment.');
    }
  };

  const handleViewReceipt = async (lot: Lot) => {
    const purchase = await db.hubPurchases.where('lotId').equals(lot.id).first();
    const payment = await db.payments.where('lotId').equals(lot.id).first();
    setActivePurchase(purchase);
    setActivePayment(payment);
    setViewingReceiptLot(lot);
  };

  // Helper for live calculation inside weigh-in modal
  const calcGross = (parseFloat(actualWeightInput) || 0) * (parseFloat(agreedRateInput) || 0);
  const calcNet = Math.max(0, calcGross - (parseFloat(deductionsInput) || 0));

  return (
    <div className="p-4 max-w-md mx-auto pb-28 text-[#14213D]">
      
      {/* Demo Hub Header & Switcher */}
      <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm border border-gray-100">
        <div className="flex justify-between items-start mb-2">
          <div>
            <div className="flex items-center space-x-2">
              <Building2 size={18} className="text-blue-600" />
              <h1 className="text-base font-black text-[#14213D]">{currentHub.name}</h1>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{currentHub.location}</p>
          </div>
          <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded uppercase">
            Demo Hub
          </span>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs">
          <span className="text-gray-500 font-medium">Switch Hub:</span>
          <select 
            value={activeHubId} 
            onChange={(e) => setActiveHubId(e.target.value)}
            className="bg-gray-100 text-xs font-bold p-1 rounded border-none outline-none text-[#14213D]"
          >
            {hubs.map(h => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Hero Operational Metrics */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* Metric 1: Received Weight in Godown */}
        <div className="bg-white p-3.5 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center text-gray-500 mb-1">
            <Scale size={14} className="mr-1 text-blue-600" />
            <span className="text-[11px] font-bold uppercase">Godown Stock</span>
          </div>
          <p className="text-2xl font-black text-[#14213D]">
            {totalReceivedWeightKg.toFixed(1)} <span className="text-xs font-normal text-gray-500">kg</span>
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5">{receivedLots.length} lots received</p>
        </div>

        {/* Metric 2: Total Purchase Value */}
        <div className="bg-white p-3.5 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center text-gray-500 mb-1">
            <CreditCard size={14} className="mr-1 text-green-600" />
            <span className="text-[11px] font-bold uppercase">Total Purchases</span>
          </div>
          <p className="text-2xl font-black text-green-700">
            ₹{totalPurchaseValue.toLocaleString('en-IN')}
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5">Disbursed & Committed</p>
        </div>

        {/* Metric 3: Pending Payments */}
        <div className="bg-white p-3.5 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center text-amber-600 mb-1">
            <Clock size={14} className="mr-1" />
            <span className="text-[11px] font-bold uppercase">Payments Due</span>
          </div>
          <p className="text-xl font-black text-amber-600">
            ₹{pendingPaymentAmount.toLocaleString('en-IN')}
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5">{pendingPaymentLots.length} collectors awaiting cash</p>
        </div>

        {/* Metric 4: Completed Payments */}
        <div className="bg-white p-3.5 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center text-emerald-600 mb-1">
            <CheckCircle2 size={14} className="mr-1" />
            <span className="text-[11px] font-bold uppercase">Paid Out</span>
          </div>
          <p className="text-xl font-black text-emerald-700">
            ₹{completedPaymentAmount.toLocaleString('en-IN')}
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5">{completedPaymentLots.length} paid transactions</p>
        </div>
      </div>

      {/* Outgoing Shipments Quick Action Card */}
      <div 
        onClick={() => navigate('/hub/shipments')}
        className="bg-[#14213D] text-white p-4 rounded-2xl shadow-md mb-5 flex items-center justify-between cursor-pointer active:scale-[0.99] transition hover:bg-blue-950"
      >
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-white/10 rounded-xl text-[#FFC72C]">
            <Truck size={22} />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="font-bold text-sm">Outgoing Recycler Shipments</h2>
              <span className="bg-[#FFC72C] text-[#14213D] text-[10px] font-black px-1.5 py-0.2 rounded-full">
                {shipments.length}
              </span>
            </div>
            <p className="text-xs text-gray-300 mt-0.5">
              Aggregate compatible lots into bulk shipments
            </p>
          </div>
        </div>
        <ArrowRight size={18} className="text-[#FFC72C]" />
      </div>

      {/* Filter Tabs & Material Dropdown */}
      <div className="mb-4 space-y-2">
        <div className="flex justify-between items-center">
          <h2 className="text-sm font-bold text-gray-700 flex items-center">
            <Package size={16} className="mr-1.5 text-blue-600" /> Collector Scrap Loads ({filteredLots.length})
          </h2>
          
          <div className="flex items-center space-x-1 text-xs">
            <Filter size={12} className="text-gray-400" />
            <select 
              value={materialFilter}
              onChange={(e) => setMaterialFilter(e.target.value)}
              className="bg-white border border-gray-200 rounded-lg p-1 text-xs font-semibold text-gray-700"
            >
              {MATERIAL_OPTIONS.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Status Filter Badges */}
        <div className="flex space-x-1.5 overflow-x-auto pb-1 text-xs scrollbar-none">
          {[
            { id: 'ALL', label: `All (${hubLots.length})` },
            { id: 'REQUESTED', label: `Requests (${requestedLots.length})` },
            { id: 'ACCEPTED', label: `Accepted (${acceptedLots.length})` },
            { id: 'RECEIVED', label: `Awaiting Confirm` },
            { id: 'UNPAID', label: `Unpaid (${pendingPaymentLots.length})` },
            { id: 'PAID', label: `Paid (${completedPaymentLots.length})` },
            { id: 'REJECTED', label: `Rejected (${rejectedLots.length})` },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition text-[11px] ${
                statusFilter === tab.id 
                  ? 'bg-[#14213D] text-white shadow-sm' 
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lots List */}
      {filteredLots.length === 0 ? (
        <div className="bg-white p-8 rounded-2xl text-center text-gray-400 border border-dashed border-gray-300">
          <Package className="mx-auto mb-2 text-gray-300" size={32} />
          <p className="font-bold text-sm text-gray-600">No lots found for this filter.</p>
          <p className="text-xs mt-1">Collectors can submit loads from the informal collector interface.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLots.map(lot => {
            const isRequested = lot.status === 'REQUESTED';
            const isAccepted = lot.status === 'ACCEPTED';
            const isAwaitingCollector = lot.status === 'AWAITING_COLLECTOR_CONFIRMATION' || lot.status === 'RECEIVED';
            const isReadyForPayment = lot.status === 'PURCHASE_CONFIRMED' || lot.status === 'PAYMENT_PENDING';
            const isPaid = lot.status === 'PAID';
            const isRejected = lot.status === 'REJECTED';

            const displayWeight = typeof lot.actualWeight === 'number' && lot.actualWeight > 0 
              ? `${lot.actualWeight} kg (Actual)` 
              : `${lot.weight} kg (Est.)`;

            const displayAmount = lot.purchaseAmount ?? lot.estimate;

            return (
              <div key={lot.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-3">
                {/* Top Info */}
                <div className="flex justify-between items-start">
                  <div className="flex items-start space-x-3">
                    {lot.photo ? (
                      <img 
                        src={lot.photo} 
                        alt={lot.material} 
                        className="w-14 h-14 rounded-xl object-cover border border-gray-200 flex-shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-gray-100 text-gray-400 flex items-center justify-center font-bold text-xs flex-shrink-0">
                        No Pic
                      </div>
                    )}
                    <div>
                      <p className="font-black text-sm text-[#14213D]">{lot.material}</p>
                      <p className="text-xs text-gray-500 flex items-center mt-0.5">
                        <User size={12} className="mr-1 text-gray-400" />
                        {lot.collectorName || 'Collector'} • <span className="font-mono font-bold ml-1">{lot.collectorId || 'KAB-7842'}</span>
                      </p>
                      <div className="flex items-center space-x-1.5 mt-1">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                          {lot.condition || 'Mixed Scrap'}
                        </span>
                        {lot.shipmentId && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-700">
                            Shipment: {lot.shipmentId.slice(-6)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-base font-black text-green-700">₹{displayAmount.toLocaleString('en-IN')}</p>
                    <p className="text-xs font-mono text-gray-600 font-bold">{displayWeight}</p>
                  </div>
                </div>

                {/* Status Badges */}
                <div className="flex justify-between items-center text-xs pt-2 border-t border-gray-50">
                  <div className="flex items-center">
                    {isRequested && (
                      <span className="inline-flex items-center text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-bold text-[11px]">
                        <Clock size={12} className="mr-1" /> Request Pending
                      </span>
                    )}
                    {isAccepted && (
                      <span className="inline-flex items-center text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-bold text-[11px]">
                        <CheckCircle2 size={12} className="mr-1" /> Accepted (Awaiting Delivery)
                      </span>
                    )}
                    {isAwaitingCollector && (
                      <span className="inline-flex items-center text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full font-bold text-[11px]">
                        <Clock size={12} className="mr-1" /> Weighed • Awaiting Collector Agree
                      </span>
                    )}
                    {isReadyForPayment && (
                      <span className="inline-flex items-center text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full font-bold text-[11px]">
                        <CreditCard size={12} className="mr-1" /> Confirmed • Payment Pending
                      </span>
                    )}
                    {isPaid && (
                      <span className="inline-flex items-center text-green-700 bg-green-50 px-2 py-0.5 rounded-full font-bold text-[11px]">
                        <CheckCircle2 size={12} className="mr-1" /> Paid (Receipt Generated)
                      </span>
                    )}
                    {isRejected && (
                      <span className="inline-flex items-center text-red-600 bg-red-50 px-2 py-0.5 rounded-full font-bold text-[11px]">
                        <XCircle size={12} className="mr-1" /> Rejected ({lot.rejectionReason || 'Declined'})
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-400 font-mono">
                    {new Date(lot.timestamp).toLocaleDateString()}
                  </span>
                </div>

                {/* Workflow Action Buttons */}
                <div className="pt-1">
                  {/* State 1: REQUESTED -> Hub accepts or rejects */}
                  {isRequested && (
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleAccept(lot)}
                        className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm flex items-center justify-center transition active:scale-95"
                      >
                        <CheckCircle2 size={14} className="mr-1" /> Accept Lot
                      </button>
                      <button
                        onClick={() => handleOpenReject(lot)}
                        className="py-2 px-3 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 font-bold text-xs flex items-center justify-center transition active:scale-95"
                      >
                        <XCircle size={14} className="mr-1" /> Reject
                      </button>
                    </div>
                  )}

                  {/* State 2: ACCEPTED -> Hub records actual received weight */}
                  {isAccepted && (
                    <button
                      onClick={() => handleOpenWeighIn(lot)}
                      className="w-full py-2.5 rounded-xl bg-[#14213D] hover:bg-blue-900 text-white font-bold text-xs shadow-sm flex items-center justify-center transition active:scale-95"
                    >
                      <Scale size={14} className="mr-1.5 text-[#FFC72C]" />
                      Weigh-In & Record Actual Weight
                    </button>
                  )}

                  {/* State 3: AWAITING_COLLECTOR_CONFIRMATION */}
                  {isAwaitingCollector && (
                    <div className="bg-purple-50 p-2.5 rounded-xl border border-purple-200 text-xs text-purple-900 flex justify-between items-center">
                      <div>
                        <p className="font-bold text-[11px]">Weighed: {lot.actualWeight} kg @ ₹{lot.agreedRate}/kg</p>
                        <p className="text-[10px] text-purple-700">Waiting for collector to confirm final payout.</p>
                      </div>
                      <button
                        onClick={() => handleOpenWeighIn(lot)}
                        className="text-[10px] font-bold text-purple-800 underline"
                      >
                        Re-Weigh
                      </button>
                    </div>
                  )}

                  {/* State 4: PURCHASE_CONFIRMED -> Record Cash/UPI Payment */}
                  {isReadyForPayment && (
                    <button
                      onClick={() => handleOpenPayment(lot)}
                      className="w-full py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-black text-xs shadow-md flex items-center justify-center transition active:scale-95"
                    >
                      <CreditCard size={14} className="mr-1.5" />
                      Record Payment (₹{lot.purchaseAmount?.toLocaleString('en-IN')})
                    </button>
                  )}

                  {/* State 5: PAID -> View Receipt */}
                  {isPaid && (
                    <button
                      onClick={() => handleViewReceipt(lot)}
                      className="w-full py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-[#14213D] font-bold text-xs flex items-center justify-center transition active:scale-95"
                    >
                      <Sparkles size={13} className="mr-1 text-green-600" />
                      View Purchase Receipt & Traceability
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: Weigh-In & Pricing Modal */}
      {weighingLot && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <h2 className="text-lg font-black text-[#14213D] flex items-center">
              <Scale size={20} className="mr-2 text-blue-600" /> Weigh-In & Pricing
            </h2>
            <p className="text-xs text-gray-500 mb-4">
              Lot: {weighingLot.material} (Est: {weighingLot.weight} kg)
            </p>

            {weighError && (
              <div className="mb-3 p-2.5 bg-red-50 border border-red-200 rounded-xl flex items-center text-xs text-red-700">
                <AlertCircle size={14} className="mr-1.5 flex-shrink-0" />
                <span>{weighError}</span>
              </div>
            )}

            <form onSubmit={handleConfirmWeighIn} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  1. Actual Scale Weight (kg) <span className="text-red-500">*</span>
                </label>
                <input 
                  type="number"
                  step="0.01"
                  value={actualWeightInput}
                  onChange={(e) => setActualWeightInput(e.target.value)}
                  placeholder="e.g. 5.25"
                  required
                  className="w-full p-3 rounded-xl border border-gray-300 font-mono text-base font-bold focus:outline-none focus:border-blue-600"
                />
                <p className="text-[10px] text-gray-400 mt-0.5">
                  Original estimated weight ({weighingLot.weight} kg) is preserved for audit.
                </p>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  2. Agreed Purchase Rate (₹/kg) <span className="text-red-500">*</span>
                </label>
                <input 
                  type="number"
                  value={agreedRateInput}
                  onChange={(e) => setAgreedRateInput(e.target.value)}
                  placeholder="e.g. 250"
                  required
                  className="w-full p-3 rounded-xl border border-gray-300 font-mono font-bold focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  3. Itemized Deductions (₹) <span className="text-gray-400 font-normal">(Optional)</span>
                </label>
                <input 
                  type="number"
                  value={deductionsInput}
                  onChange={(e) => setDeductionsInput(e.target.value)}
                  placeholder="0"
                  className="w-full p-2.5 rounded-xl border border-gray-300 font-mono focus:outline-none focus:border-blue-600"
                />
              </div>

              {parseFloat(deductionsInput) > 0 && (
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Deduction Reason</label>
                  <input 
                    type="text"
                    value={deductionReasonInput}
                    onChange={(e) => setDeductionReasonInput(e.target.value)}
                    placeholder="e.g. Moisture / Dirt Sorting Deduction"
                    className="w-full p-2.5 rounded-xl border border-gray-300 focus:outline-none focus:border-blue-600"
                  />
                </div>
              )}

              {/* Live Transparent Financial Breakdown */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 font-mono space-y-1">
                <div className="flex justify-between text-gray-500">
                  <span>Gross (Weight × Rate):</span>
                  <span>₹{calcGross.toFixed(0)}</span>
                </div>
                {parseFloat(deductionsInput) > 0 && (
                  <div className="flex justify-between text-red-600 text-[11px]">
                    <span>Deductions:</span>
                    <span>- ₹{deductionsInput}</span>
                  </div>
                )}
                <div className="flex justify-between pt-1 border-t border-gray-200 font-bold text-sm text-[#14213D]">
                  <span>Net Payout:</span>
                  <span className="text-green-700">₹{calcNet.toFixed(0)}</span>
                </div>
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setWeighingLot(null)}
                  className="w-1/2 py-3 rounded-xl bg-gray-100 font-bold text-gray-700 hover:bg-gray-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-3 rounded-xl bg-[#14213D] text-white font-bold hover:bg-blue-900 transition flex items-center justify-center shadow"
                >
                  <CheckCircle2 size={14} className="mr-1 text-green-400" /> Confirm Weight
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Record Cash / UPI Payment Modal */}
      {payingLot && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <h2 className="text-lg font-black text-[#14213D] flex items-center">
              <CreditCard size={20} className="mr-2 text-green-600" /> Record Collector Payment
            </h2>
            <p className="text-xs text-gray-500 mb-3">
              Collector: <strong>{payingLot.collectorName || 'Ramu Kabadiwala'}</strong> ({payingLot.collectorId})
            </p>

            {/* Simulation Disclaimer */}
            <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-[11px] text-amber-800 flex items-start">
              <AlertCircle size={14} className="mr-1.5 flex-shrink-0 text-amber-600 mt-0.5" />
              <span>
                <strong>Demonstration Record:</strong> Records manual payment outside the app. No automated banking APIs are triggered.
              </span>
            </div>

            {paymentError && (
              <div className="mb-3 p-2.5 bg-red-50 border border-red-200 rounded-xl flex items-center text-xs text-red-700">
                <AlertCircle size={14} className="mr-1.5 flex-shrink-0" />
                <span>{paymentError}</span>
              </div>
            )}

            <form onSubmit={handleConfirmPayment} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Purchase Amount to Pay</label>
                <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-green-800 font-mono text-xl font-black">
                  ₹{(payingLot.purchaseAmount || payingLot.estimate).toLocaleString('en-IN')}
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-2">Select Payment Method</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('CASH')}
                    className={`p-3 rounded-xl border-2 flex items-center justify-center font-bold transition ${
                      paymentMethod === 'CASH'
                        ? 'border-green-600 bg-green-50 text-green-900 shadow-sm'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Banknote size={16} className="mr-1.5 text-green-600" /> CASH
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('UPI')}
                    className={`p-3 rounded-xl border-2 flex items-center justify-center font-bold transition ${
                      paymentMethod === 'UPI'
                        ? 'border-blue-600 bg-blue-50 text-blue-900 shadow-sm'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Smartphone size={16} className="mr-1.5 text-blue-600" /> UPI
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  {paymentMethod === 'UPI' ? 'UPI Transaction Ref / UTR #' : 'Cash Voucher / Note (Optional)'}
                </label>
                <input 
                  type="text"
                  value={paymentRefNote}
                  onChange={(e) => setPaymentRefNote(e.target.value)}
                  placeholder={paymentMethod === 'UPI' ? 'e.g. UPI/2026/882194' : 'e.g. Voucher #1042'}
                  className="w-full p-2.5 rounded-xl border border-gray-300 font-mono focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPayingLot(null)}
                  className="w-1/2 py-3 rounded-xl bg-gray-100 font-bold text-gray-700 hover:bg-gray-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-3 rounded-xl bg-green-600 text-white font-bold hover:bg-green-700 transition flex items-center justify-center shadow"
                >
                  <CheckCircle2 size={14} className="mr-1" /> Record Paid
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Rejection Reason Dialog */}
      {rejectingLot && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl relative">
            <h2 className="text-base font-black text-red-600 flex items-center mb-2">
              <XCircle size={18} className="mr-1.5" /> Reject Scrap Request
            </h2>
            <p className="text-xs text-gray-600 mb-3">
              Provide a clear reason for the collector regarding why this lot cannot be accepted.
            </p>

            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full p-3 rounded-xl border border-gray-300 text-xs focus:outline-none focus:border-red-500 mb-4"
              placeholder="e.g. Material damaged beyond recovery / Hazardous fluid leakage"
            />

            <div className="flex space-x-2">
              <button
                onClick={() => setRejectingLot(null)}
                className="w-1/2 py-2.5 rounded-xl bg-gray-100 font-bold text-xs text-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                className="w-1/2 py-2.5 rounded-xl bg-red-600 text-white font-bold text-xs hover:bg-red-700 shadow"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Receipt View Modal */}
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
