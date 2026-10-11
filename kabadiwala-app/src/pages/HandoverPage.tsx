import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Recycler } from '../lib/db';
import { generateHandoverCode } from '../lib/hash';
import { 
  CheckCircle2, 
  ShieldCheck, 
  MapPin, 
  Phone, 
  Navigation, 
  Printer, 
  Clock, 
  Truck, 
  AlertCircle,
  FileText,
  Building2,
  ArrowLeft,
  QrCode as QrIcon,
  Sparkles,
  Leaf
} from 'lucide-react';

export default function HandoverPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const lot = useLiveQuery(() => db.lots.get(id as string), [id]);
  const recyclers = useLiveQuery(() => db.recyclers.toArray(), []) || [];
  
  const [selectedRecyclerId, setSelectedRecyclerId] = useState<string | null>(null);
  const [selectedRecycler, setSelectedRecycler] = useState<Recycler | null>(null);
  const [handoverCode, setHandoverCode] = useState<string | null>(null);
  const [filterVerified, setFilterVerified] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    if (selectedRecyclerId && recyclers.length > 0) {
      const found = recyclers.find(r => r.id === selectedRecyclerId) || null;
      setSelectedRecycler(found);
    }
  }, [selectedRecyclerId, recyclers]);

  useEffect(() => {
    if (selectedRecycler && lot) {
      const calcEst = Math.round(parseFloat(lot.weight) * selectedRecycler.rate);
      setHandoverCode(generateHandoverCode(lot.id, lot.material, lot.weight, calcEst));
    }
  }, [selectedRecycler, lot]);

  if (!lot) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500 mb-4">Loading load information...</p>
        <button onClick={() => navigate('/')} className="px-4 py-2 bg-[#14213D] text-white rounded-lg">Return Home</button>
      </div>
    );
  }

  const effectiveRate = selectedRecycler ? selectedRecycler.rate : 250;
  const netEstimatedPay = Math.round(parseFloat(lot.weight) * effectiveRate);
  const co2Saved = (parseFloat(lot.weight) * 2.8).toFixed(1);
  const carbonPoints = Math.floor(parseFloat(lot.weight) * 10);
  const manifestId = `CPCB-MNF-${(lot.id || '0000').slice(0, 8).toUpperCase()}`;
  const collectorId = `KAB-${(lot.id || '0000').slice(0, 4).toUpperCase()}`;

  const handleCompleteHandover = async () => {
    await db.lots.update(lot.id, {
      status: 'COMPLETED',
      estimate: netEstimatedPay
    });
    setIsCompleted(true);
    setTimeout(() => {
      navigate('/');
    }, 2000);
  };

  const handlePrintChallan = () => {
    window.print();
  };

  const filteredRecyclers = filterVerified ? recyclers.filter(r => r.verified) : recyclers;

  return (
    <div className="p-4 max-w-md mx-auto pb-28">
      {/* Header bar */}
      <div className="flex items-center justify-between mb-4">
        <button 
          onClick={() => selectedRecycler ? setSelectedRecyclerId(null) : navigate('/')} 
          className="p-2 rounded-xl bg-white border border-gray-200 text-gray-700 flex items-center text-xs font-bold"
        >
          <ArrowLeft size={16} className="mr-1" /> {selectedRecycler ? 'Change Buyer' : 'Back'}
        </button>
        <div className="flex items-center text-xs font-semibold text-gray-500">
          <FileText size={14} className="mr-1 text-blue-600" />
          <span>Form 6 Manifest</span>
        </div>
      </div>

      {!selectedRecycler ? (
        /* STEP 1: SELECT BUYER / RECYCLER */
        <div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 mb-5">
            <span className="text-[11px] font-bold text-blue-600 tracking-wider uppercase bg-blue-50 px-2 py-0.5 rounded-md">
              Consignment Ready
            </span>
            <h1 className="text-2xl font-black mt-2 text-[#14213D]">{lot.material}</h1>
            <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-gray-100 text-xs">
              <div>
                <p className="text-gray-400 font-medium">Batch Weight</p>
                <p className="text-lg font-black text-[#14213D]">{lot.weight} KG</p>
              </div>
              <div>
                <p className="text-gray-400 font-medium">Est. Value (Base)</p>
                <p className="text-lg font-black text-green-700">₹ {lot.estimate.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-[#14213D] text-base">Select Authorized Buyer</h2>
            <button 
              onClick={() => setFilterVerified(!filterVerified)} 
              className={`text-xs px-2.5 py-1 rounded-full font-bold transition ${filterVerified ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              {filterVerified ? 'CPCB Verified Only' : 'All Buyers'}
            </button>
          </div>

          <div className="space-y-3">
            {filteredRecyclers.map(r => {
              const totalPayout = Math.round(parseFloat(lot.weight) * r.rate);
              return (
                <div 
                  key={r.id} 
                  onClick={() => r.verified && setSelectedRecyclerId(r.id)}
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                    r.verified 
                      ? 'bg-white border-gray-200 hover:border-blue-500 shadow-sm active:scale-[0.98]' 
                      : 'bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <div>
                      <span className="font-bold text-base text-[#14213D]">{r.name}</span>
                      <p className="text-[11px] text-gray-400 flex items-center mt-0.5">
                        <Building2 size={12} className="mr-1" />
                        {r.verified ? 'CPCB/EW-REG/2024/0' + r.id : 'Unregistered Middleman'}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-black text-green-700 text-base">₹{r.rate}/kg</span>
                      <p className="text-[11px] font-bold text-gray-500">Total: ₹{totalPayout.toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-500 mt-3 pt-2.5 border-t border-gray-100">
                    <span className="flex items-center"><MapPin size={13} className="mr-1 text-gray-400" /> {r.distance} km away</span>
                    <span className="flex items-center"><Clock size={13} className="mr-1 text-gray-400" /> ~{Math.round(r.distance * 4)} mins ETA</span>
                    {r.verified ? (
                      <span className="flex items-center text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded-full text-[10px]">
                        <ShieldCheck size={12} className="mr-1 text-blue-600" /> CPCB Authorized
                      </span>
                    ) : (
                      <span className="text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded-full text-[10px]">
                        Not Authorized
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* STEP 2: COMPLETE HANDOVER PARCHI & CPCB TRANSFER MANIFEST */
        <div>
          {isCompleted && (
            <div className="mb-4 bg-green-600 text-white p-4 rounded-2xl text-center shadow-lg animate-bounce">
              <CheckCircle2 size={32} className="mx-auto mb-1" />
              <p className="font-black text-lg">Handover Recorded Successfully!</p>
              <p className="text-xs text-green-100">Syncing with cloud ledger...</p>
            </div>
          )}

          {/* PARCHI CONTAINER */}
          <div className="bg-[#FFFDF5] rounded-3xl shadow-xl border-t-8 border-[#FFC72C] p-6 text-[#14213D] relative overflow-hidden">
            
            {/* Top Regulatory Heading */}
            <div className="border-b-2 border-dashed border-gray-300 pb-4 mb-4 text-center">
              <div className="inline-flex items-center bg-blue-50 text-blue-800 text-[10px] font-black uppercase px-2.5 py-1 rounded-full mb-1">
                <ShieldCheck size={12} className="mr-1 text-blue-600" />
                CPCB Form 6 - Official E-Waste Transfer Manifest
              </div>
              <h2 className="text-2xl font-black tracking-wider text-[#14213D]">HANDOVER PARCHI</h2>
              <p className="text-[11px] font-mono text-gray-400">ID: {manifestId}</p>
            </div>

            {/* Verification Hash Card */}
            <div className="bg-white border-2 border-dashed border-gray-300 rounded-2xl p-4 text-center mb-5 shadow-inner">
              <p className="text-[11px] font-bold tracking-widest uppercase text-gray-400 mb-1">
                6-Digit Tamper-Evident Hash Code
              </p>
              <div className="text-4xl font-black font-mono tracking-[0.3em] text-[#14213D] my-1">
                {handoverCode || '------'}
              </div>
              <p className="text-[10px] text-gray-400 font-mono">
                SHA-256 Checksum: Derived from Material + Weight + Price
              </p>

              {/* Scannable SVG QR Code Representation */}
              <div className="mt-3 pt-3 border-t border-gray-100 flex flex-col items-center">
                <div className="p-2 bg-gray-50 border border-gray-200 rounded-xl inline-flex items-center justify-center">
                  <svg className="w-24 h-24" viewBox="0 0 100 100" fill="none">
                    <rect width="100" height="100" fill="#FFFFFF" rx="8" />
                    {/* QR Finder patterns */}
                    <rect x="8" y="8" width="24" height="24" fill="#14213D" rx="2" />
                    <rect x="12" y="12" width="16" height="16" fill="#FFFFFF" />
                    <rect x="16" y="16" width="8" height="8" fill="#14213D" />

                    <rect x="68" y="8" width="24" height="24" fill="#14213D" rx="2" />
                    <rect x="72" y="12" width="16" height="16" fill="#FFFFFF" />
                    <rect x="76" y="16" width="8" height="8" fill="#14213D" />

                    <rect x="8" y="68" width="24" height="24" fill="#14213D" rx="2" />
                    <rect x="12" y="72" width="16" height="16" fill="#FFFFFF" />
                    <rect x="16" y="76" width="8" height="8" fill="#14213D" />

                    {/* QR Data Matrix Mock */}
                    <rect x="36" y="12" width="6" height="6" fill="#14213D" />
                    <rect x="48" y="16" width="6" height="6" fill="#14213D" />
                    <rect x="40" y="24" width="8" height="6" fill="#14213D" />
                    <rect x="16" y="40" width="8" height="6" fill="#14213D" />
                    <rect x="36" y="36" width="28" height="28" fill="#14213D" rx="2" />
                    <rect x="42" y="42" width="16" height="16" fill="#FFFFFF" />
                    <rect x="46" y="46" width="8" height="8" fill="#2563EB" />
                    <rect x="72" y="40" width="12" height="6" fill="#14213D" />
                    <rect x="80" y="52" width="8" height="8" fill="#14213D" />
                    <rect x="40" y="72" width="12" height="6" fill="#14213D" />
                    <rect x="58" y="78" width="10" height="8" fill="#14213D" />
                    <rect x="74" y="74" width="14" height="14" fill="#14213D" />
                  </svg>
                </div>
                <span className="text-[10px] text-blue-600 font-semibold mt-1 flex items-center">
                  <QrIcon size={12} className="mr-1" /> Scan with Recycler Terminal
                </span>
              </div>
            </div>

            {/* 1. Facility & Consignee Details */}
            <div className="mb-4 text-xs font-mono bg-white p-3.5 rounded-xl border border-gray-200">
              <div className="flex justify-between font-bold text-gray-500 uppercase tracking-wider mb-2 border-b border-gray-100 pb-1">
                <span>CONSIGNEE (BUYER)</span>
                <span className="text-green-700">AUTHORIZED</span>
              </div>
              <div className="space-y-1">
                <p className="font-bold text-sm text-[#14213D]">{selectedRecycler.name}</p>
                <p className="text-gray-500">CPCB REG: CPCB/EW-REG/2024/0{selectedRecycler.id}</p>
                <p className="text-gray-500">FACILITY: Industrial Zone, Sector 4, Unit B</p>
                <p className="text-gray-500">OFFERED RATE: ₹{selectedRecycler.rate}/KG</p>
              </div>
            </div>

            {/* 2. Consignor & Logistics Information */}
            <div className="mb-4 text-xs font-mono bg-white p-3.5 rounded-xl border border-gray-200">
              <div className="flex justify-between font-bold text-gray-500 uppercase tracking-wider mb-2 border-b border-gray-100 pb-1">
                <span>CONSIGNOR (COLLECTOR)</span>
                <span>ORIGIN INFO</span>
              </div>
              <div className="space-y-1">
                <p><span className="text-gray-400">COLLECTOR ID:</span> <strong>{collectorId}</strong></p>
                <p><span className="text-gray-400">DISPATCH TYPE:</span> <span className="inline-flex items-center font-bold text-[#14213D]"><Truck size={13} className="mr-1 text-blue-600" /> 3-Wheeler E-Cart</span></p>
                <p><span className="text-gray-400">PACKAGING:</span> <strong>Grade-A Sorted Bags</strong></p>
                <p><span className="text-gray-400">DATE & TIME:</span> <strong>{new Date().toLocaleString()}</strong></p>
              </div>
              <div className="mt-2 pt-2 border-t border-dashed border-gray-200 text-[10px] text-amber-700 flex items-center">
                <AlertCircle size={12} className="mr-1 flex-shrink-0" />
                <span>Precaution: Transport in dry crates. Avoid thermal exposure.</span>
              </div>
            </div>

            {/* 3. Material & Financial Breakdown */}
            <div className="text-xs font-mono bg-white p-3.5 rounded-xl border border-gray-200 mb-4 space-y-2">
              <div className="flex justify-between font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100 pb-1">
                <span>MATERIAL SPECIFICATION</span>
                <span>AUDIT TERMS</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">MATERIAL:</span>
                <strong className="text-[#14213D]">{lot.material}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">HAZARD CLASS:</span>
                <span className="font-bold text-amber-700">Schedule-I (Sec 4)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">GROSS WEIGHT:</span>
                <strong className="text-base text-[#14213D]">{lot.weight} KG</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">UNIT PRICE:</span>
                <strong>₹{selectedRecycler.rate}/KG</strong>
              </div>
              <div className="flex justify-between pt-2 border-t-2 border-black text-sm">
                <span className="font-black">NET PAYOUT:</span>
                <strong className="text-lg font-black text-green-700">₹{netEstimatedPay.toLocaleString()}</strong>
              </div>
            </div>

            {/* 4. Environmental Impact Banner */}
            <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl flex items-center justify-between text-xs text-emerald-900 mb-5">
              <div className="flex items-center">
                <Leaf size={18} className="mr-2 text-emerald-600" />
                <div>
                  <p className="font-bold">Avoided CO₂: {co2Saved} kg</p>
                  <p className="text-[10px] text-emerald-700">CPCB Certified Greenhouse Offset</p>
                </div>
              </div>
              <div className="bg-emerald-600 text-white font-black px-2 py-1 rounded-md text-[10px] flex items-center">
                <Sparkles size={10} className="mr-1" /> +{carbonPoints} PTS
              </div>
            </div>

            {/* Quick Actions (Call & Navigate) */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <a 
                href="tel:9876543210"
                className="flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-[#14213D] font-bold py-2.5 rounded-xl text-xs transition"
              >
                <Phone size={14} className="mr-1.5 text-blue-600" /> Call Facility
              </a>
              <button 
                onClick={() => alert(`Navigating to ${selectedRecycler.name} (${selectedRecycler.distance} km away).`)}
                className="flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-[#14213D] font-bold py-2.5 rounded-xl text-xs transition"
              >
                <Navigation size={14} className="mr-1.5 text-green-600" /> GPS Route
              </button>
            </div>

            {/* Print / Save Manifest button */}
            <button 
              onClick={handlePrintChallan}
              className="w-full flex items-center justify-center text-xs font-bold py-2 text-gray-500 hover:text-gray-800 transition mb-2"
            >
              <Printer size={14} className="mr-1" /> Print Physical Challan Slip
            </button>
          </div>

          {/* Complete Handover Button */}
          <div className="mt-4 space-y-2">
            <button 
              onClick={handleCompleteHandover}
              disabled={isCompleted}
              className="w-full bg-[#14213D] hover:bg-blue-900 text-white font-black py-4 rounded-2xl shadow-xl flex items-center justify-center text-base transition active:scale-[0.98]"
            >
              <CheckCircle2 size={20} className="mr-2 text-green-400" />
              Confirm Handover & Settle (₹{netEstimatedPay.toLocaleString()})
            </button>

            <button 
              onClick={() => setSelectedRecyclerId(null)}
              className="w-full py-2.5 text-xs text-gray-500 font-bold hover:text-gray-700"
            >
              Cancel / Choose Another Buyer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
