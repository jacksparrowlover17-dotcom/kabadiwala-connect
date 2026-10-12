import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { 
  db, 
  type CollectorProfile, 
  type Lot, 
  DEFAULT_PROFILE, 
  getCollectorProfile, 
  updateCollectorProfile,
  DEMO_HUBS 
} from '../lib/db';
import { 
  requestLotPurchase, 
  confirmLotPurchaseByCollector 
} from '../lib/hubService';
import PurchaseReceiptModal from '../components/PurchaseReceiptModal';
import { 
  Wallet, 
  Package, 
  ArrowRight, 
  Volume2, 
  Leaf, 
  Trophy, 
  User, 
  Edit3, 
  X, 
  Check, 
  MapPin, 
  Building2, 
  CheckCircle2, 
  Clock, 
  Receipt, 
  Scale
} from 'lucide-react';

const LANGUAGES = [
  { code: 'hi-IN', label: 'hi', greeting: 'नमस्ते', sub: "आज की कीमतें अपडेट हो गई हैं", tts: "आपकी कुल अनुमानित कमाई है" },
  { code: 'mr-IN', label: 'mr', greeting: 'नमस्कार', sub: "आजचे दर अद्ययावत केले आहेत", tts: "तुमची एकूण अंदाजे कमाई आहे" },
  { code: 'ta-IN', label: 'ta', greeting: 'வணக்கம்', sub: "இன்றைய விலைகள் புதுப்பிக்கப்பட்டுள்ளன", tts: "உங்கள் மொத்த மதிப்பிடப்பட்ட வருவாய்" },
  { code: 'te-IN', label: 'te', greeting: 'నమస్కారం', sub: "నేటి ధరలు నవీకరించబడ్డాయి", tts: "మీ మొత్తం అంచనా ఆదాయం" },
  { code: 'kn-IN', label: 'kn', greeting: 'ನಮಸ್ಕಾರ', sub: "ಇಂದಿನ ಬೆಲೆಗಳನ್ನು ನವೀಕರಿಸಲಾಗಿದೆ", tts: "ನಿಮ್ಮ ಒಟ್ಟು ಅಂದಾಜು ಗಳಿಕೆ" },
  { code: 'en-US', label: 'en', greeting: 'Hello', sub: "Today's Prices are updated", tts: "Your total estimated earnings are" },
];

export default function HomePage() {
  const navigate = useNavigate();
  const [langIndex, setLangIndex] = useState(0);
  
  // Profile state
  const liveProfile = useLiveQuery(() => db.profile.get('current-user'));
  const [profile, setProfile] = useState<CollectorProfile>(DEFAULT_PROFILE);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<CollectorProfile>(DEFAULT_PROFILE);

  // Hub Modal for lot assignment
  const [hubSelectLot, setHubSelectLot] = useState<Lot | null>(null);
  const [chosenHubId, setChosenHubId] = useState<string>(DEMO_HUBS[0].id);

  // Confirmation Modal for weigh-in review
  const [confirmingLot, setConfirmingLot] = useState<Lot | null>(null);

  // Receipt Modal
  const [receiptLotId, setReceiptLotId] = useState<string | null>(null);

  // Tabs for collector lots
  const [lotTab, setLotTab] = useState<'ACTIVE' | 'HISTORY'>('ACTIVE');

  useEffect(() => {
    if (liveProfile) {
      setProfile(liveProfile);
      setEditForm(liveProfile);
    } else {
      getCollectorProfile().then(p => {
        setProfile(p);
        setEditForm(p);
      });
    }
  }, [liveProfile]);

  const allLots = useLiveQuery(() => db.lots.reverse().sortBy('createdAt'), []) || [];
  const hubs = useLiveQuery(() => db.hubs.toArray()) || DEMO_HUBS;

  const activeLots = allLots.filter(l => 
    !['COMPLETED', 'REJECTED'].includes(l.status)
  );

  const completedLots = allLots.filter(l => 
    ['COMPLETED', 'PAID', 'REJECTED'].includes(l.status)
  );

  const expectedEarnings = activeLots.reduce((acc, lot) => {
    return acc + (lot.purchaseAmount || lot.estimate || 0);
  }, 0);
  
  // Calculate lifetime stats for gamification
  const lifetimeWeightKg = allLots
    .filter(l => l.status === 'COMPLETED' || l.status === 'PAID')
    .reduce((acc, lot) => acc + (lot.actualWeight || parseFloat(lot.weight) || 0), 0);
  const carbonSavedKg = (lifetimeWeightKg * 1.44).toFixed(1);
  
  // Determine Tier
  let tier = { name: "Bronze Collector", color: "text-amber-600", bg: "bg-amber-100" };
  if (lifetimeWeightKg > 500) tier = { name: "Gold Collector", color: "text-yellow-600", bg: "bg-yellow-100" };
  else if (lifetimeWeightKg > 100) tier = { name: "Silver Collector", color: "text-gray-500", bg: "bg-gray-100" };

  const currentLang = LANGUAGES[langIndex];

  const speakText = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const text = `${currentLang.tts} ${expectedEarnings} ${langIndex === 5 ? 'rupees' : 'रुपये'}`;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = currentLang.code;
      window.speechSynthesis.speak(utterance);
    }
  };

  const toggleLanguage = () => {
    setLangIndex((prev) => (prev + 1) % LANGUAGES.length);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const updated = await updateCollectorProfile({
      name: editForm.name.trim() || DEFAULT_PROFILE.name,
      collectorId: editForm.collectorId.trim().toUpperCase() || DEFAULT_PROFILE.collectorId,
      location: editForm.location.trim() || DEFAULT_PROFILE.location,
      phone: editForm.phone?.trim() || DEFAULT_PROFILE.phone,
    });
    setProfile(updated);
    setIsEditModalOpen(false);
  };

  const handleSendToHub = async () => {
    if (!hubSelectLot) return;
    try {
      await requestLotPurchase(hubSelectLot.id, chosenHubId);
      setHubSelectLot(null);
    } catch (err: any) {
      alert(err.message || 'Failed to send lot to hub.');
    }
  };

  const handleConfirmLotPrice = async (lotId: string) => {
    try {
      await confirmLotPurchaseByCollector(lotId);
      setConfirmingLot(null);
    } catch (err: any) {
      alert(err.message || 'Failed to confirm price.');
    }
  };

  const renderStatusBadge = (lot: Lot) => {
    switch (lot.status) {
      case 'PENDING':
        return <span className="text-[10px] bg-gray-100 text-gray-700 font-bold px-2 py-0.5 rounded-full">Logged</span>;
      case 'REQUESTED':
        return <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full flex items-center"><Clock size={10} className="mr-1" /> Hub Reviewing</span>;
      case 'ACCEPTED':
        return <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full flex items-center"><Building2 size={10} className="mr-1" /> Accepted at Hub</span>;
      case 'RECEIVED':
        return <span className="text-[10px] bg-purple-100 text-purple-800 font-bold px-2 py-0.5 rounded-full flex items-center"><Scale size={10} className="mr-1" /> Hub Weigh-in</span>;
      case 'AWAITING_COLLECTOR_CONFIRMATION':
        return <span className="text-[10px] bg-amber-400 text-amber-950 font-black px-2 py-0.5 rounded-full animate-pulse flex items-center">Action Required! Confirm Weight</span>;
      case 'PURCHASE_CONFIRMED':
        return <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-full">Price Agreed</span>;
      case 'PAYMENT_PENDING':
        return <span className="text-[10px] bg-yellow-100 text-yellow-800 font-bold px-2 py-0.5 rounded-full">Payment Processing</span>;
      case 'PAID':
        return <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full flex items-center"><CheckCircle2 size={10} className="mr-1 text-emerald-600" /> Paid & Settled</span>;
      case 'COMPLETED':
        return <span className="text-[10px] bg-green-100 text-green-800 font-bold px-2 py-0.5 rounded-full">Recycled</span>;
      case 'REJECTED':
        return <span className="text-[10px] bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded-full">Hub Rejected</span>;
      default:
        return null;
    }
  };

  return (
    <div className="p-4 max-w-md mx-auto pb-28 text-[#14213D]">
      {/* Top Header & Language Bar */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl font-black text-[#14213D]">{currentLang.greeting}</h1>
          <p className="text-gray-500 text-xs">{currentLang.sub}</p>
        </div>
        <div className="flex items-center space-x-2">
          <button 
            onClick={speakText}
            title="Read summary out loud"
            className="p-2 bg-blue-100 text-blue-600 rounded-full active:scale-95 transition-transform"
          >
            <Volume2 size={18} />
          </button>
          <button 
            onClick={toggleLanguage}
            title="Switch Language"
            className="bg-[#FFC72C] p-2 rounded-full shadow-sm active:scale-95 transition-transform w-9 h-9 flex items-center justify-center"
          >
            <span className="font-bold text-xs uppercase text-[#14213D]">{currentLang.label}</span>
          </button>
        </div>
      </div>

      {/* Persistent Collector Profile Card (Demo Profile) */}
      <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm border border-gray-100 relative overflow-hidden">
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold mr-3 border border-blue-100">
              <User size={20} />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="font-bold text-sm text-[#14213D]">{profile.name}</h2>
                <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono font-bold">
                  {profile.collectorId}
                </span>
              </div>
              <p className="text-[11px] text-gray-500 flex items-center mt-0.5">
                <MapPin size={11} className="mr-1 text-gray-400" /> {profile.location}
              </p>
            </div>
          </div>
          <button 
            onClick={() => setIsEditModalOpen(true)}
            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
            title="Edit Collector Demo Profile"
          >
            <Edit3 size={15} />
          </button>
        </div>
        <div className="flex justify-between items-center pt-2 border-t border-gray-50 text-[10px] text-gray-400 font-mono">
          <span>Local Demo Profile (Offline Storage)</span>
          <span className="text-emerald-600 font-bold">● Active Session</span>
        </div>
      </div>

      {/* Gamification / Tier Badge */}
      <div className={`flex items-center p-3 rounded-2xl mb-4 shadow-sm border border-gray-100 ${tier.bg}`}>
        <Trophy size={22} className={`mr-2.5 ${tier.color}`} />
        <div>
          <p className={`font-bold text-xs ${tier.color}`}>Level: {tier.name}</p>
          <p className="text-[11px] text-gray-700 font-medium">Lifetime Recycled: {lifetimeWeightKg.toFixed(1)} kg</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-gray-100">
          <div className="flex items-center text-gray-500 mb-1">
            <Wallet size={14} className="mr-1.5" />
            <span className="font-semibold text-xs">Estimated Value</span>
          </div>
          <div className="text-xl font-black text-green-600">
            ₹{expectedEarnings.toLocaleString('en-IN')}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-gray-100">
          <div className="flex items-center text-gray-500 mb-1">
            <Leaf size={14} className="mr-1.5 text-emerald-500" />
            <span className="font-semibold text-xs">CO₂ Saved</span>
          </div>
          <div className="text-xl font-black text-emerald-600">
            {carbonSavedKg} <span className="text-xs font-normal">kg</span>
          </div>
        </div>
      </div>

      {/* Lots Header & Switcher */}
      <div className="flex justify-between items-center mb-3">
        <div className="flex space-x-2">
          <button
            onClick={() => setLotTab('ACTIVE')}
            className={`text-xs font-bold px-3 py-1.5 rounded-xl transition ${
              lotTab === 'ACTIVE' 
                ? 'bg-[#14213D] text-white shadow-sm' 
                : 'bg-gray-100 text-gray-600 hover:text-black'
            }`}
          >
            Active Scrap ({activeLots.length})
          </button>
          <button
            onClick={() => setLotTab('HISTORY')}
            className={`text-xs font-bold px-3 py-1.5 rounded-xl transition ${
              lotTab === 'HISTORY' 
                ? 'bg-[#14213D] text-white shadow-sm' 
                : 'bg-gray-100 text-gray-600 hover:text-black'
            }`}
          >
            History & Paid ({completedLots.length})
          </button>
        </div>

        <button 
          onClick={() => navigate('/new')}
          className="text-xs text-blue-600 font-bold hover:underline flex items-center"
        >
          + Add New
        </button>
      </div>

      {/* Display Lots */}
      {lotTab === 'ACTIVE' && (
        <div className="space-y-3">
          {activeLots.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl text-center text-gray-400 border border-dashed border-gray-300">
              <Package className="mx-auto mb-2 text-gray-300" size={32} />
              <p className="font-medium text-sm text-gray-500">No active scrap loads.</p>
              <p className="text-xs mt-1">Tap "+ Add New" to log collected electronic scrap.</p>
            </div>
          ) : (
            activeLots.map(lot => {
              const displayWeight = typeof lot.actualWeight === 'number' && lot.actualWeight > 0 
                ? lot.actualWeight 
                : parseFloat(lot.weight);
              const displayPrice = lot.purchaseAmount || lot.estimate;

              return (
                <div key={lot.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {lot.photo ? (
                        <img 
                          src={lot.photo} 
                          alt={lot.material} 
                          className="w-12 h-12 rounded-xl object-cover border border-gray-200 flex-shrink-0 shadow-sm"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-gray-100 text-gray-400 flex items-center justify-center font-bold text-xs flex-shrink-0 border border-gray-200">
                          No Pic
                        </div>
                      )}
                      
                      <div>
                        <p className="font-bold text-sm text-[#14213D]">{lot.material}</p>
                        <p className="text-xs text-gray-500 font-medium">
                          {displayWeight.toFixed(2)} kg • {lot.condition || 'Mixed Scrap'}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="font-black text-green-700 text-sm">₹{displayPrice.toLocaleString('en-IN')}</p>
                      <div className="mt-1">{renderStatusBadge(lot)}</div>
                    </div>
                  </div>

                  {/* If Awaiting Confirmation, show prominent banner */}
                  {lot.status === 'AWAITING_COLLECTOR_CONFIRMATION' && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
                      <div className="flex items-start text-amber-900 text-xs">
                        <Scale size={16} className="mr-2 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">Hub Weigh-in Completed!</p>
                          <p className="text-[11px] text-amber-800">
                            Estimated: {lot.weight} kg → Actual scale weight: <strong>{lot.actualWeight} kg</strong>.
                            Net payout offered: <strong>₹{lot.purchaseAmount}</strong>.
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setConfirmingLot(lot)}
                        className="w-full py-2 bg-[#FFC72C] text-[#14213D] font-black text-xs rounded-lg hover:bg-yellow-400 shadow-sm transition active:scale-95"
                      >
                        Review & Confirm Agreed Amount
                      </button>
                    </div>
                  )}

                  {/* Actions for other statuses */}
                  <div className="flex items-center space-x-2 pt-1 border-t border-gray-50">
                    {lot.status === 'PENDING' && (
                      <>
                        <button 
                          onClick={() => {
                            setHubSelectLot(lot);
                          }}
                          className="flex-1 py-2 bg-blue-50 text-blue-800 rounded-xl text-xs font-bold hover:bg-blue-100 transition flex items-center justify-center"
                        >
                          <Building2 size={13} className="mr-1 text-blue-600" /> Send to Hub
                        </button>
                        <button 
                          onClick={() => navigate(`/handover/${lot.id}`)}
                          className="flex-1 py-2 bg-[#14213D] text-white rounded-xl text-xs font-bold hover:bg-blue-900 transition flex items-center justify-center"
                        >
                          Direct Handover <ArrowRight size={12} className="ml-1" />
                        </button>
                      </>
                    )}

                    {lot.status === 'PAID' && (
                      <button
                        onClick={() => setReceiptLotId(lot.id)}
                        className="w-full py-2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold hover:bg-emerald-100 transition flex items-center justify-center"
                      >
                        <Receipt size={14} className="mr-1.5 text-emerald-600" /> View Official Cash Receipt
                      </button>
                    )}

                    {['REQUESTED', 'ACCEPTED', 'RECEIVED', 'PURCHASE_CONFIRMED', 'PAYMENT_PENDING'].includes(lot.status) && (
                      <div className="w-full text-center text-[11px] text-gray-500 font-mono py-1">
                        Hub Location: {hubs.find(h => h.id === lot.hubId)?.name || 'Hebbal Aggregation Hub'}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* History & Settled Lots */}
      {lotTab === 'HISTORY' && (
        <div className="space-y-3">
          {completedLots.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl text-center text-gray-400 border border-dashed border-gray-300">
              <CheckCircle2 className="mx-auto mb-2 text-gray-300" size={32} />
              <p className="font-medium text-sm text-gray-500">No settled transactions yet.</p>
            </div>
          ) : (
            completedLots.map(lot => (
              <div key={lot.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <p className="font-bold text-sm text-[#14213D]">{lot.material}</p>
                    {renderStatusBadge(lot)}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Weight: {lot.actualWeight || lot.weight} kg
                  </p>
                  <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                    {new Date(lot.timestamp).toLocaleDateString()} • ID #{lot.id.slice(0, 6)}
                  </p>
                </div>

                <div className="text-right">
                  <p className="font-black text-green-700 text-sm">₹{(lot.purchaseAmount || lot.estimate).toLocaleString('en-IN')}</p>
                  {lot.status === 'PAID' && (
                    <button
                      onClick={() => setReceiptLotId(lot.id)}
                      className="mt-1.5 text-[11px] text-blue-600 font-bold hover:underline flex items-center justify-end"
                    >
                      <Receipt size={12} className="mr-1" /> Receipt
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* MODAL: Select Aggregation Hub */}
      {hubSelectLot && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 w-full max-w-sm shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-gray-100 pb-2">
              <div>
                <h3 className="font-black text-base text-[#14213D]">Send Lot to Hub</h3>
                <p className="text-[11px] text-gray-500">Select participating aggregation godown</p>
              </div>
              <button onClick={() => setHubSelectLot(null)} className="p-1 text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <div className="bg-gray-50 p-3 rounded-xl text-xs space-y-1">
              <div className="flex justify-between font-bold text-gray-700">
                <span>Material:</span>
                <span>{hubSelectLot.material}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Estimated Weight:</span>
                <span>{hubSelectLot.weight} kg</span>
              </div>
              <div className="flex justify-between font-bold text-green-700">
                <span>Estimated Payout:</span>
                <span>₹{hubSelectLot.estimate.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-700">Select Collection Hub</label>
              {hubs.map(h => (
                <div
                  key={h.id}
                  onClick={() => setChosenHubId(h.id)}
                  className={`p-3 rounded-xl border-2 cursor-pointer transition ${
                    chosenHubId === h.id ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className="font-bold text-xs text-[#14213D]">{h.name}</p>
                  <p className="text-[10px] text-gray-500">{h.location}</p>
                </div>
              ))}
            </div>

            <div className="flex space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setHubSelectLot(null)}
                className="w-1/2 py-2.5 rounded-xl font-bold text-xs bg-gray-100 text-gray-700 hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendToHub}
                className="w-1/2 py-2.5 rounded-xl font-bold text-xs bg-[#14213D] text-white hover:bg-blue-900 shadow"
              >
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Collector Reviews & Confirms Hub Weigh-in */}
      {confirmingLot && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 w-full max-w-sm shadow-2xl space-y-4">
            <div className="border-b border-gray-100 pb-2">
              <div className="flex items-center text-xs font-bold text-amber-700 mb-1">
                <Scale size={14} className="mr-1" /> Hub Scale Weight Verification
              </div>
              <h3 className="font-black text-lg text-[#14213D]">Confirm Agreed Price</h3>
              <p className="text-xs text-gray-500">Lot #{confirmingLot.id.slice(0, 6)} • {confirmingLot.material}</p>
            </div>

            <div className="bg-gray-50 rounded-2xl p-3 text-xs font-mono space-y-2 border border-gray-100">
              <div className="flex justify-between text-gray-500">
                <span>Collector Initial Estimate:</span>
                <span>{confirmingLot.weight} kg</span>
              </div>
              <div className="flex justify-between text-blue-900 font-bold text-sm">
                <span>Hub Scale Verified Weight:</span>
                <span>{confirmingLot.actualWeight} kg</span>
              </div>
              <div className="border-t border-gray-200 pt-1.5 flex justify-between font-bold text-green-700 text-base">
                <span>Final Payable Amount:</span>
                <span>₹{confirmingLot.purchaseAmount}</span>
              </div>
            </div>

            <div className="text-[11px] text-gray-600 bg-blue-50 p-2.5 rounded-xl border border-blue-100">
              By confirming, you agree to this net weight and payout. The Hub manager will immediately disburse your cash or UPI payment.
            </div>

            <div className="flex space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmingLot(null)}
                className="w-1/2 py-2.5 rounded-xl font-bold text-xs bg-gray-100 text-gray-700 hover:bg-gray-200"
              >
                Hold / Dispute
              </button>
              <button
                type="button"
                onClick={() => handleConfirmLotPrice(confirmingLot.id)}
                className="w-1/2 py-2.5 rounded-xl font-bold text-xs bg-green-600 text-white hover:bg-green-700 shadow"
              >
                Confirm & Accept
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RECEIPT MODAL */}
      {receiptLotId && (
        <PurchaseReceiptModal
          lotId={receiptLotId}
          onClose={() => setReceiptLotId(null)}
        />
      )}

      {/* Edit Profile Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-black text-[#14213D]">Edit Collector Profile</h3>
                <p className="text-[11px] text-gray-500">Persistent Local Demo Identity</p>
              </div>
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 rounded-full text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Collector Name</label>
                <input 
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  placeholder="e.g. Ramu Kabadiwala"
                  required
                  className="w-full p-3 rounded-xl border border-gray-300 focus:outline-none focus:border-blue-600 font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Collector ID</label>
                <input 
                  type="text"
                  value={editForm.collectorId}
                  onChange={(e) => setEditForm({ ...editForm, collectorId: e.target.value })}
                  placeholder="e.g. KAB-7842"
                  required
                  className="w-full p-3 rounded-xl border border-gray-300 focus:outline-none focus:border-blue-600 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Collection Area / Godown</label>
                <input 
                  type="text"
                  value={editForm.location}
                  onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                  placeholder="e.g. Bangalore South (Ward 152)"
                  required
                  className="w-full p-3 rounded-xl border border-gray-300 focus:outline-none focus:border-blue-600 font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Contact Phone (Optional)</label>
                <input 
                  type="text"
                  value={editForm.phone || ''}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  placeholder="e.g. +91 98450 78421"
                  className="w-full p-3 rounded-xl border border-gray-300 focus:outline-none focus:border-blue-600 font-mono"
                />
              </div>

              <div className="pt-2 text-[10px] text-gray-400 bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                Notice: This profile is saved to your browser's local IndexedDB database. It will persist across refreshes and be reused across all future load entries.
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="w-1/2 py-3 rounded-xl font-bold bg-gray-100 text-gray-700 hover:bg-gray-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-3 rounded-xl font-bold bg-[#14213D] text-white hover:bg-blue-900 transition flex items-center justify-center shadow"
                >
                  <Check size={14} className="mr-1 text-green-400" /> Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
