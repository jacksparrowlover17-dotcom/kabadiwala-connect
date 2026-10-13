import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Lot, type HubPurchase, type Payment } from '../lib/db';
import { ShieldCheck, CheckCircle2, Printer, X, Building2, User } from 'lucide-react';

export interface PurchaseReceiptModalProps {
  lot?: Lot;
  lotId?: string;
  purchase?: HubPurchase;
  payment?: Payment;
  onClose: () => void;
}

export const PurchaseReceiptModal: React.FC<PurchaseReceiptModalProps> = ({
  lot: propLot,
  lotId,
  purchase: propPurchase,
  payment: propPayment,
  onClose,
}) => {
  // If lotId is provided instead of lot object, query live data
  const fetchedLot = useLiveQuery(
    async (): Promise<Lot | undefined> => {
      if (!lotId) return undefined;
      return await db.lots.get(lotId);
    },
    [lotId]
  );

  const fetchedPurchase = useLiveQuery(
    async (): Promise<HubPurchase | undefined> => {
      if (!lotId) return undefined;
      return await db.hubPurchases.where('lotId').equals(lotId).first();
    },
    [lotId]
  );

  const fetchedPayment = useLiveQuery(
    async (): Promise<Payment | undefined> => {
      if (!lotId) return undefined;
      return await db.payments.where('lotId').equals(lotId).first();
    },
    [lotId]
  );

  const lot: Lot | undefined = propLot || fetchedLot;
  const purchase: HubPurchase | undefined = propPurchase || fetchedPurchase;
  const payment: Payment | undefined = propPayment || fetchedPayment;

  if (!lot) {
    return (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-6 text-center max-w-sm w-full">
          <p className="text-sm font-bold text-gray-700">Loading receipt details...</p>
          <button onClick={onClose} className="mt-4 px-4 py-2 bg-gray-100 rounded-xl text-xs font-bold">
            Close
          </button>
        </div>
      </div>
    );
  }

  const receiptId = payment?.id || purchase?.id || `REC-${lot.id.slice(0, 8).toUpperCase()}`;
  const purchaseId = purchase?.id || `PUR-${lot.id.slice(0, 8).toUpperCase()}`;
  const formattedDate = payment?.recordedAt 
    ? new Date(payment.recordedAt).toLocaleString('en-IN')
    : new Date(lot.timestamp).toLocaleString('en-IN');

  const actualWeight = lot.actualWeight ?? purchase?.actualWeight ?? parseFloat(lot.weight);
  const estimatedWeight = parseFloat(lot.weight) || 0;
  const agreedRate = lot.agreedRate ?? purchase?.agreedRate ?? 0;
  const grossAmount = lot.grossAmount ?? purchase?.grossAmount ?? (actualWeight * agreedRate);
  const deductions = lot.deductions ?? purchase?.deductions ?? 0;
  const netAmount = lot.purchaseAmount ?? purchase?.netAmount ?? (grossAmount - deductions);
  const paymentMethod = payment?.method || 'CASH';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden relative border border-gray-100 my-8">
        
        {/* Receipt Header */}
        <div className="bg-[#14213D] text-white p-5 relative">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
          >
            <X size={18} />
          </button>

          <div className="flex items-center space-x-2 text-[#FFC72C] text-xs font-bold uppercase tracking-wider mb-1">
            <CheckCircle2 size={16} />
            <span>Scrap Purchase Voucher (Expo Prototype)</span>
          </div>

          <h2 className="text-xl font-black tracking-tight">KABADIWALA CONNECT</h2>
          <p className="text-xs text-gray-300">Hub Aggregation & Simulated Payment Receipt</p>
          
          <div className="mt-3 pt-3 border-t border-white/10 flex justify-between text-[11px] font-mono text-gray-300">
            <span>Voucher: {receiptId}</span>
            <span>{formattedDate}</span>
          </div>
        </div>

        {/* Receipt Body */}
        <div className="p-5 space-y-4 text-xs text-[#14213D]">
          
          {/* Parties: Hub & Collector */}
          <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3.5 rounded-2xl border border-gray-100">
            <div>
              <div className="flex items-center text-gray-500 text-[10px] uppercase font-bold mb-1">
                <Building2 size={12} className="mr-1 text-blue-600" /> Collection Hub
              </div>
              <p className="font-bold text-sm text-[#14213D]">
                {purchase?.hubName || 'Hebbal Aggregation Hub'}
              </p>
              <p className="text-[10px] text-gray-500 font-mono">
                ID: {lot.hubId || 'HUB-BLR-NORTH'}
              </p>
            </div>

            <div>
              <div className="flex items-center text-gray-500 text-[10px] uppercase font-bold mb-1">
                <User size={12} className="mr-1 text-emerald-600" /> Informal Collector
              </div>
              <p className="font-bold text-sm text-[#14213D]">
                {lot.collectorName || 'Ramu Kabadiwala'}
              </p>
              <p className="text-[10px] text-gray-500 font-mono">
                ID: {lot.collectorId || 'KAB-7842'}
              </p>
            </div>
          </div>

          {/* Material & Weighbridge Details */}
          <div className="border border-gray-200 rounded-2xl p-4 space-y-2.5">
            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
              <span className="font-bold text-sm text-[#14213D]">{lot.material}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                {lot.condition || 'Mixed Scrap'}
              </span>
            </div>

            <div className="flex justify-between text-gray-600">
              <span>Collector Initial Estimate:</span>
              <span className="font-mono">{estimatedWeight.toFixed(2)} kg</span>
            </div>

            <div className="flex justify-between font-bold text-[#14213D]">
              <span>Hub Scale Verified Weight:</span>
              <span className="font-mono text-blue-700 font-black">{actualWeight.toFixed(2)} kg</span>
            </div>

            <div className="flex justify-between text-gray-600">
              <span>Agreed Base Rate:</span>
              <span className="font-mono">₹{agreedRate.toFixed(2)} / kg</span>
            </div>

            <div className="flex justify-between text-gray-600">
              <span>Gross Calculated Value:</span>
              <span className="font-mono">₹{grossAmount.toFixed(2)}</span>
            </div>

            {deductions > 0 && (
              <div className="flex justify-between text-red-600 bg-red-50 p-1.5 rounded-lg text-[11px]">
                <span>Deductions ({purchase?.deductionReason || 'Moisture / Foreign debris'}):</span>
                <span className="font-mono">- ₹{deductions.toFixed(2)}</span>
              </div>
            )}

            {/* Total Net Settlement */}
            <div className="pt-2 border-t border-gray-200 flex justify-between items-center text-sm">
              <span className="font-black text-[#14213D]">Net Settlement Amount:</span>
              <span className="text-xl font-black text-green-700 font-mono">
                ₹{netAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Payment Disbursement Information */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                Disbursement Status
              </span>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-emerald-600 text-white rounded-full">
                PAID & SETTLED
              </span>
            </div>

            <div className="flex justify-between text-xs font-mono text-emerald-950 font-bold pt-1">
              <span>Payment Mode:</span>
              <span>{paymentMethod === 'UPI' ? 'UPI Instant Transfer' : 'Immediate Cash Payout'}</span>
            </div>

            {payment?.referenceNote && (
              <div className="text-[10px] text-emerald-700 font-mono">
                Ref / Txn Note: {payment.referenceNote}
              </div>
            )}
          </div>

          {/* Traceability Seal */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center space-y-1">
            <div className="flex items-center justify-center space-x-1 text-blue-700 font-bold text-xs">
              <ShieldCheck size={14} />
              <span>Traceability Workflow Record</span>
            </div>
            <p className="text-[10px] text-gray-500">
              Lot Purchase Ref: {purchaseId} • Prototype Record: For college demonstration & pilot tracking, not an official statutory CPCB certificate.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex space-x-2">
            <button
              onClick={handlePrint}
              className="w-1/2 py-3 rounded-xl border border-gray-300 font-bold text-xs flex items-center justify-center text-gray-700 hover:bg-gray-50 active:scale-95 transition"
            >
              <Printer size={14} className="mr-1.5" /> Print Receipt
            </button>
            <button
              onClick={onClose}
              className="w-1/2 py-3 rounded-xl bg-[#14213D] text-white font-bold text-xs flex items-center justify-center hover:bg-blue-900 active:scale-95 transition shadow"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default PurchaseReceiptModal;
