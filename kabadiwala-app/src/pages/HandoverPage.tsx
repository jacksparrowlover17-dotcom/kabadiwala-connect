import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Recycler, DEFAULT_PROFILE } from '../lib/db';
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
  Leaf,
  Scale
} from 'lucide-react';

export default function HandoverPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const lot = useLiveQuery(() => db.lots.get(id as string), [id]);
  const recyclers = useLiveQuery(() => db.recyclers.toArray(), []) || [];
  const profile = useLiveQuery(() => db.profile.get('current-user'));
  
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
      <div className="p-8 max-w-md mx-auto text-center">
        <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3 text-gray-400">
          <Scale size={24} />
        </div>
        <p className="text-gray-600 font-semibold mb-4 text-sm">Load details not found or loading...</p>
        <button onClick={() => navigate('/')} className="btn-primary w-full">
          Return to Loads
        </button>
      </div>
    );
  }

  const effectiveRate = selectedRecycler ? selectedRecycler.rate : 250;
  const netEstimatedPay = Math.round(parseFloat(lot.weight) * effectiveRate);
  const co2Saved = (parseFloat(lot.weight) * 2.8).toFixed(1);
  const carbonPoints = Math.floor(parseFloat(lot.weight) * 10);
  const manifestId = `KAB-PROTO-MNF-${(lot.id || '0000').slice(0, 8).toUpperCase()}`;
  
  const collectorId = lot.collectorId || profile?.collectorId || DEFAULT_PROFILE.collectorId;
  const collectorName = profile?.name || DEFAULT_PROFILE.name;
  const collectorLocation = profile?.location || DEFAULT_PROFILE.location;

  const handleCompleteHandover = async () => {
    await db.lots.update(lot.id, {
      status: 'COMPLETED',
      estimate: netEstimatedPay
    });
    setIsCompleted(true);
    setTimeout(() => {
      navigate('/');
    }, 1800);
  };

  const handlePrintChallan = () => {
    window.print();
  };

  const filteredRecyclers = filterVerified ? recyclers.filter(r => r.verified) : recyclers;

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto pb-28">
      {/* Navigation & Header */}
      <div className="flex items-center justify-between mb-5 no-print">
        <button 
          onClick={() => selectedRecycler ? setSelectedRecyclerId(null) : navigate('/')} 
          className="btn-secondary text-xs py-2 px-3.5"
        >
          <ArrowLeft size={15} /> {selectedRecycler ? 'Change Buyer' : 'Back to Loads'}
        </button>
        <div className="flex items-center gap-1.5 text-xs font-bold text-[#166534] bg-[#dcfce7] px-3 py-1 rounded-full">
          <FileText size={13} />
          <span>Form 6 Digital Manifest</span>
        </div>
      </div>

      {!selectedRecycler ? (
        /* STEP 1: SELECT BUYER / RECYCLER */
        <div className="space-y-5">
          {/* Load Summary Card */}
          <div className="kc-card p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <span className="badge badge-active text-[10px]">
                  Consignment Ready
                </span>
                <h1 className="text-xl sm:text-2xl font-black text-[#1f2937] mt-1">{lot.material}</h1>
                <p className="text-xs text-[#64748b]">
                  Condition: <strong className="text-[#1f2937]">{lot.condition || 'Mixed Scrap'}</strong>
                </p>
              </div>
              {lot.photo && (
                <img 
                  src={lot.photo} 
                  alt={lot.material} 
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover border border-[#e2e8f0] shadow-sm flex-shrink-0"
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-[#e2e8f0]">
              <div className="p-3 bg-[#f8fafc] rounded-xl border border-[#e2e8f0]">
                <p className="text-[11px] font-semibold text-[#64748b] uppercase">Batch Weight</p>
                <p className="text-lg sm:text-xl font-black text-[#1f2937] mt-0.5">{lot.weight} KG</p>
              </div>
              <div className="p-3 bg-[#f0fdf4] rounded-xl border border-[#bbf7d0]">
                <p className="text-[11px] font-semibold text-[#166534] uppercase">Base Estimate</p>
                <p className="text-lg sm:text-xl font-black text-[#166534] mt-0.5">₹ {lot.estimate.toLocaleString('en-IN')}</p>
              </div>
            </div>
          </div>

          {/* Recycler Filter Header */}
          <div className="flex items-center justify-between pt-1">
            <div>
              <h2 className="font-black text-base text-[#1f2937]">Select Authorized Buyer</h2>
              <p className="text-xs text-[#64748b]">Choose a verified recycler or collection depot</p>
            </div>
            <button 
              onClick={() => setFilterVerified(!filterVerified)} 
              className={`text-xs px-3 py-1.5 rounded-full font-bold transition ${
                filterVerified 
                  ? 'bg-[#166534] text-white shadow-sm' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {filterVerified ? 'CPCB Verified Only' : 'All Buyers'}
            </button>
          </div>

          {/* Recycler List */}
          <div className="space-y-3">
            {filteredRecyclers.map(r => {
              const totalPayout = Math.round(parseFloat(lot.weight) * r.rate);
              return (
                <div 
                  key={r.id} 
                  onClick={() => r.verified && setSelectedRecyclerId(r.id)}
                  className={`kc-card p-4 transition-all ${
                    r.verified 
                      ? 'cursor-pointer hover:border-[#166534] hover:shadow-md active:scale-[0.99]' 
                      : 'opacity-60 cursor-not-allowed bg-gray-50'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm sm:text-base text-[#1f2937]">{r.name}</span>
                        {r.verified ? (
                          <span className="badge badge-success text-[10px]">
                            <ShieldCheck size={11} /> CPCB Verified
                          </span>
                        ) : (
                          <span className="badge badge-error text-[10px]">
                            Unverified
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#64748b] flex items-center gap-1 mt-1 font-mono">
                        <Building2 size={12} className="text-gray-400" />
                        {r.verified ? `CPCB/EW-REG/2024/0${r.id}` : 'Unregistered Intermediary'}
                      </p>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <span className="font-black text-[#166534] text-base sm:text-lg">₹{r.rate}/kg</span>
                      <p className="text-[11px] font-bold text-[#64748b]">Total: ₹{totalPayout.toLocaleString('en-IN')}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-[#64748b] mt-3 pt-3 border-t border-[#e2e8f0]">
                    <span className="flex items-center gap-1"><MapPin size={13} className="text-gray-400" /> {r.distance} km away</span>
                    <span className="flex items-center gap-1"><Clock size={13} className="text-gray-400" /> ~{Math.round(r.distance * 4)} mins ETA</span>
                    <span className="font-bold text-[#166534] hover:underline text-xs">
                      {r.verified ? 'Select & Generate Parchi →' : 'Unavailable'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* STEP 2: COMPLETE HANDOVER PARCHI & CPCB TRANSFER MANIFEST */
        <div className="space-y-4">
          {isCompleted && (
            <div className="p-4 bg-[#166534] text-white rounded-2xl text-center shadow-lg animate-bounce">
              <CheckCircle2 size={32} className="mx-auto mb-1 text-[#86efac]" />
              <p className="font-black text-lg">Handover Recorded Successfully!</p>
              <p className="text-xs text-[#bbf7d0]">Manifest synced with offline ledger</p>
            </div>
          )}

          {/* PARCHI / MANIFEST CONTAINER */}
          <div className="kc-card border-2 border-[#166534] p-5 sm:p-6 bg-white relative overflow-hidden shadow-md">
            
            {/* Regulatory Heading */}
            <div className="border-b-2 border-dashed border-[#cbd5e1] pb-4 mb-4 text-center">
              <div className="inline-flex items-center gap-1.5 bg-[#dcfce7] text-[#166534] text-[10px] font-black uppercase px-3 py-1 rounded-full mb-1.5">
                <ShieldCheck size={12} />
                Transfer Manifest (Expo Prototype)
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-wider text-[#1f2937]">HANDOVER PARCHI</h2>
              <p className="text-xs font-mono text-[#64748b] mt-0.5">Manifest ID: {manifestId}</p>
            </div>

            {/* Verification Hash Code Card */}
            <div className="bg-[#f8fafc] border-2 border-dashed border-[#cbd5e1] rounded-2xl p-4 text-center mb-5">
              <p className="text-[11px] font-bold tracking-widest uppercase text-[#64748b] mb-1">
                6-Digit Tamper-Evident Hash Code
              </p>
              <div className="text-3xl sm:text-4xl font-black font-mono tracking-[0.25em] text-[#166534] my-1">
                {handoverCode || '------'}
              </div>
              <p className="text-[10px] text-[#94a3b8] font-mono">
                SHA-256 Checksum: Derived from Material + Weight + Unit Price
              </p>

              {/* Scannable SVG QR Code */}
              <div className="mt-3 pt-3 border-t border-[#e2e8f0] flex flex-col items-center">
                <div className="p-2.5 bg-white border border-[#e2e8f0] rounded-xl shadow-xs inline-flex items-center justify-center">
                  <svg className="w-24 h-24" viewBox="0 0 100 100" fill="none">
                    <rect width="100" height="100" fill="#FFFFFF" rx="8" />
                    {/* QR Pattern */}
                    <rect x="8" y="8" width="24" height="24" fill="#166534" rx="2" />
                    <rect x="12" y="12" width="16" height="16" fill="#FFFFFF" />
                    <rect x="16" y="16" width="8" height="8" fill="#166534" />

                    <rect x="68" y="8" width="24" height="24" fill="#166534" rx="2" />
                    <rect x="72" y="12" width="16" height="16" fill="#FFFFFF" />
                    <rect x="76" y="16" width="8" height="8" fill="#166534" />

                    <rect x="8" y="68" width="24" height="24" fill="#166534" rx="2" />
                    <rect x="12" y="72" width="16" height="16" fill="#FFFFFF" />
                    <rect x="16" y="76" width="8" height="8" fill="#166534" />

                    {/* QR Matrix */}
                    <rect x="36" y="12" width="6" height="6" fill="#166534" />
                    <rect x="48" y="16" width="6" height="6" fill="#166534" />
                    <rect x="40" y="24" width="8" height="6" fill="#166534" />
                    <rect x="16" y="40" width="8" height="6" fill="#166534" />
                    <rect x="36" y="36" width="28" height="28" fill="#166534" rx="2" />
                    <rect x="42" y="42" width="16" height="16" fill="#FFFFFF" />
                    <rect x="46" y="46" width="8" height="8" fill="#22c55e" />
                    <rect x="72" y="40" width="12" height="6" fill="#166534" />
                    <rect x="80" y="52" width="8" height="8" fill="#166534" />
                    <rect x="40" y="72" width="12" height="6" fill="#166534" />
                    <rect x="58" y="78" width="10" height="8" fill="#166534" />
                    <rect x="74" y="74" width="14" height="14" fill="#166534" />
                  </svg>
                </div>
                <span className="text-[10px] text-[#166534] font-bold mt-1.5 flex items-center gap-1">
                  <QrIcon size={12} /> Scan with Recycler Terminal at Gate
                </span>
              </div>
            </div>

            {/* Consignee (Buyer) Details */}
            <div className="mb-3 p-3.5 bg-[#f8fafc] rounded-xl border border-[#e2e8f0] text-xs font-mono space-y-1">
              <div className="flex justify-between font-bold text-[#64748b] uppercase tracking-wider border-b border-[#e2e8f0] pb-1.5">
                <span>CONSIGNEE (AUTHORIZED BUYER)</span>
                <span className="text-[#166534]">CPCB AUTHORIZED</span>
              </div>
              <p className="font-bold text-sm text-[#1f2937] pt-1">{selectedRecycler.name}</p>
              <p className="text-[#64748b]">REG: CPCB/EW-REG/2024/0{selectedRecycler.id}</p>
              <p className="text-[#64748b]">FACILITY: Industrial Zone, Sector 4, Peenya</p>
              <p className="text-[#64748b]">RATE CONTRACT: ₹{selectedRecycler.rate}/KG</p>
            </div>

            {/* Consignor (Collector) Information */}
            <div className="mb-3 p-3.5 bg-[#f8fafc] rounded-xl border border-[#e2e8f0] text-xs font-mono space-y-1">
              <div className="flex justify-between font-bold text-[#64748b] uppercase tracking-wider border-b border-[#e2e8f0] pb-1.5">
                <span>CONSIGNOR (COLLECTOR)</span>
                <span>ORIGIN DETAILS</span>
              </div>
              <p className="pt-1"><span className="text-[#64748b]">COLLECTOR:</span> <strong>{collectorName} ({collectorId})</strong></p>
              <p><span className="text-[#64748b]">LOCATION:</span> <strong>{collectorLocation}</strong></p>
              <p><span className="text-[#64748b]">DISPATCH:</span> <span className="inline-flex items-center font-bold text-[#1f2937]"><Truck size={13} className="mr-1 text-[#166534]" /> E-Cart / Rickshaw</span></p>
              <p><span className="text-[#64748b]">TIMESTAMP:</span> <strong>{new Date().toLocaleString()}</strong></p>
              <div className="mt-2 pt-2 border-t border-dashed border-[#cbd5e1] text-[10px] text-amber-800 flex items-center">
                <AlertCircle size={12} className="mr-1 flex-shrink-0" />
                <span>Precaution: Transport in dry crates. Avoid high thermal exposure.</span>
              </div>
            </div>

            {/* Material & Financial Breakdown */}
            <div className="p-3.5 bg-[#f8fafc] rounded-xl border border-[#e2e8f0] text-xs font-mono mb-4 space-y-2">
              <div className="flex justify-between font-bold text-[#64748b] uppercase tracking-wider border-b border-[#e2e8f0] pb-1.5">
                <span>MATERIAL SPECIFICATION</span>
                <span>FINANCIAL SETTLEMENT</span>
              </div>
              <div className="flex justify-between items-center pt-1">
                <div>
                  <span className="text-[#64748b]">MATERIAL: </span>
                  <strong className="text-[#1f2937]">{lot.material}</strong>
                </div>
                <span className="badge badge-neutral text-[10px]">
                  {lot.condition || 'Mixed Scrap'}
                </span>
              </div>
              {lot.photo && (
                <div className="py-1 flex items-center gap-2 border-y border-dashed border-[#e2e8f0] my-1">
                  <img src={lot.photo} alt="Batch verification" className="w-10 h-10 rounded-lg object-cover border border-[#e2e8f0]" />
                  <span className="text-[10px] text-[#64748b]">Verified lot visual attached</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-[#64748b]">HAZARD CLASS:</span>
                <span className="font-bold text-amber-800">Schedule-I (Sec 4)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748b]">GROSS WEIGHT:</span>
                <strong className="text-base text-[#1f2937]">{lot.weight} KG</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748b]">UNIT RATE:</span>
                <strong>₹{selectedRecycler.rate}/KG</strong>
              </div>
              <div className="flex justify-between pt-2 border-t-2 border-[#166534] text-sm">
                <span className="font-black text-[#1f2937]">NET PAYOUT:</span>
                <strong className="text-lg font-black text-[#166534]">₹{netEstimatedPay.toLocaleString('en-IN')}</strong>
              </div>
            </div>

            {/* Environmental Impact Banner */}
            <div className="bg-[#f0fdf4] border border-[#bbf7d0] p-3 rounded-xl flex items-center justify-between text-xs text-[#166534] mb-4">
              <div className="flex items-center gap-2">
                <Leaf size={18} className="text-[#16a34a]" />
                <div>
                  <p className="font-bold">Avoided CO₂: {co2Saved} kg</p>
                  <p className="text-[10px] text-[#15803d]">Calculated via material density multiplier</p>
                </div>
              </div>
              <div className="bg-[#166534] text-white font-black px-2.5 py-1 rounded-md text-[10px] flex items-center gap-1">
                <Sparkles size={10} /> +{carbonPoints} PTS
              </div>
            </div>

            {/* Quick Actions (Call & Navigate) */}
            <div className="grid grid-cols-2 gap-2 mb-3 no-print">
              <a 
                href="tel:9876543210"
                className="flex items-center justify-center bg-[#f8fafc] hover:bg-gray-100 text-[#1f2937] font-bold py-2.5 rounded-xl text-xs border border-[#e2e8f0] transition"
              >
                <Phone size={14} className="mr-1.5 text-[#166534]" /> Call Facility
              </a>
              <button 
                onClick={() => alert(`Navigating to ${selectedRecycler.name} (${selectedRecycler.distance} km away).`)}
                className="flex items-center justify-center bg-[#f8fafc] hover:bg-gray-100 text-[#1f2937] font-bold py-2.5 rounded-xl text-xs border border-[#e2e8f0] transition"
              >
                <Navigation size={14} className="mr-1.5 text-[#166534]" /> GPS Route
              </button>
            </div>

            {/* Print Slip button */}
            <button 
              onClick={handlePrintChallan}
              className="w-full flex items-center justify-center text-xs font-bold py-2 text-[#64748b] hover:text-[#1f2937] transition no-print"
            >
              <Printer size={14} className="mr-1.5" /> Print Physical Challan Slip
            </button>
          </div>

          {/* Confirm Handover Button */}
          <div className="space-y-2 no-print">
            <button 
              onClick={handleCompleteHandover}
              disabled={isCompleted}
              className="btn-primary w-full py-3.5 text-base shadow-md"
            >
              <CheckCircle2 size={18} />
              Confirm Handover & Settle (₹{netEstimatedPay.toLocaleString('en-IN')})
            </button>

            <button 
              onClick={() => setSelectedRecyclerId(null)}
              className="w-full py-2.5 text-xs text-[#64748b] font-bold hover:text-[#1f2937]"
            >
              Cancel / Choose Another Buyer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
