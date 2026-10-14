import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import {
  db, type CollectorProfile, type Lot,
  DEFAULT_PROFILE, getCollectorProfile, updateCollectorProfile, DEMO_HUBS
} from '../lib/db';
import { getCurrentSession } from '../lib/authService';
import { requestLotPurchase, confirmLotPurchaseByCollector } from '../lib/hubService';
import PurchaseReceiptModal from '../components/PurchaseReceiptModal';
import { pullLotsFromCloud } from '../lib/supabase';
import {
  Wallet, Package, Volume2, Leaf, User,
  Edit3, X, Check, MapPin, Building2, CheckCircle2, Clock,
  Receipt, Scale, PlusCircle, ChevronRight, AlertTriangle, Compass, RefreshCw
} from 'lucide-react';

const LANGUAGES = [
  { code: 'hi-IN', label: 'HI', greeting: 'नमस्ते', sub: 'आज की कीमतें अपडेट हो गई हैं', tts: 'आपकी कुल अनुमानित कमाई है' },
  { code: 'mr-IN', label: 'MR', greeting: 'नमस्कार', sub: 'आजचे दर अद्ययावत केले आहेत', tts: 'तुमची एकूण अंदाजे कमाई आहे' },
  { code: 'ta-IN', label: 'TA', greeting: 'வணக்கம்', sub: 'இன்றைய விலைகள் புதுப்பிக்கப்பட்டுள்ளன', tts: 'உங்கள் மொத்த மதிப்பிடப்பட்ட வருவாய்' },
  { code: 'te-IN', label: 'TE', greeting: 'నమస్కారం', sub: 'నేటి ధరలు నవీకరించబడ్డాయి', tts: 'మీ మొత్తం అంచనా ఆదాయం' },
  { code: 'kn-IN', label: 'KN', greeting: 'ನಮಸ್ಕಾರ', sub: 'ಇಂದಿನ ಬೆಲೆಗಳನ್ನು ನವೀಕರಿಸಲಾಗಿದೆ', tts: 'ನಿಮ್ಮ ಒಟ್ಟು ಅಂದಾಜು ಗಳಿಕೆ' },
  { code: 'en-US', label: 'EN', greeting: 'Hello', sub: "Today's prices are updated", tts: 'Your total estimated earnings are' },
];

function StatusBadge({ lot }: { lot: Lot }) {
  switch (lot.status) {
    case 'PENDING':    return <span className="badge badge-neutral">Logged</span>;
    case 'REQUESTED':  return <span className="badge badge-warning"><Clock size={10}/>Hub Reviewing</span>;
    case 'ACCEPTED':   return <span className="badge badge-active"><Building2 size={10}/>Accepted</span>;
    case 'RECEIVED':   return <span className="badge badge-active"><Scale size={10}/>At Hub</span>;
    case 'AWAITING_COLLECTOR_CONFIRMATION':
      return <span className="badge" style={{background:'#fef3c7',color:'#92400e',animation:'pulse 1.5s infinite'}}>⚠ Confirm Weight</span>;
    case 'PURCHASE_CONFIRMED': return <span className="badge badge-active">Price Agreed</span>;
    case 'PAYMENT_PENDING':    return <span className="badge badge-warning">Payment Pending</span>;
    case 'PAID':       return <span className="badge badge-success"><CheckCircle2 size={10}/>Paid</span>;
    case 'COMPLETED':  return <span className="badge badge-success">Recycled</span>;
    case 'REJECTED':   return <span className="badge badge-error">Rejected</span>;
    default:           return null;
  }
}

export default function HomePage() {
  const navigate = useNavigate();
  const [langIndex, setLangIndex] = useState(0);
  const session = getCurrentSession();
  const activeUserId = session?.user?.id || 'current-user';
  const liveProfile = useLiveQuery(() => db.profile.get(activeUserId), [activeUserId]);

  const [profile, setProfile] = useState<CollectorProfile>(() => {
    if (session?.user && session.user.role === 'COLLECTOR') {
      const cleanIdPart = session.user.id.replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase() || '7842';
      const shortId = session.user.id.startsWith('KAB-') ? session.user.id : `KAB-${cleanIdPart}`;
      return {
        id: session.user.id,
        name: session.user.fullName || 'Collector',
        collectorId: shortId,
        location: 'Bangalore (Urban Area)',
        phone: session.user.phone || '',
        updatedAt: Date.now(),
      };
    }
    return DEFAULT_PROFILE;
  });
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<CollectorProfile>(profile);
  const [hubSelectLot, setHubSelectLot] = useState<Lot | null>(null);
  const [chosenHubId, setChosenHubId] = useState<string>(DEMO_HUBS[0].id);
  const [confirmingLot, setConfirmingLot] = useState<Lot | null>(null);
  const [receiptLotId, setReceiptLotId] = useState<string | null>(null);
  const [lotTab, setLotTab] = useState<'ACTIVE' | 'HISTORY'>('ACTIVE');

  useEffect(() => {
    if (liveProfile) {
      setProfile(liveProfile);
      setEditForm(liveProfile);
    } else {
      getCollectorProfile(activeUserId).then(p => {
        setProfile(p);
        setEditForm(p);
      });
    }
  }, [liveProfile, activeUserId]);

  const [isSyncing, setIsSyncing] = useState(false);

  const handleManualSync = async () => {
    setIsSyncing(true);
    await pullLotsFromCloud();
    setIsSyncing(false);
  };

  useEffect(() => {
    pullLotsFromCloud();
    const interval = setInterval(() => {
      pullLotsFromCloud();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const allLots = useLiveQuery(() => db.lots.reverse().sortBy('timestamp'), []) || [];
  const hubs = useLiveQuery(() => db.hubs.toArray()) || DEMO_HUBS;

  const activeLots = allLots.filter(l => !['COMPLETED', 'REJECTED', 'CANCELLED'].includes(l.status));
  const completedLots = allLots.filter(l => ['COMPLETED', 'PAID', 'REJECTED'].includes(l.status));
  const expectedEarnings = activeLots.reduce((acc, l) => acc + (l.purchaseAmount || l.estimate || 0), 0);
  const lifetimeWeightKg = allLots.filter(l => ['COMPLETED', 'PAID'].includes(l.status))
    .reduce((acc, l) => acc + (l.actualWeight || parseFloat(l.weight) || 0), 0);
  const carbonSavedKg = (lifetimeWeightKg * 1.44).toFixed(1);

  let tier = { name: 'Bronze Collector', icon: '🥉', color: '#b45309' };
  if (lifetimeWeightKg > 500) tier = { name: 'Gold Collector', icon: '🥇', color: '#ca8a04' };
  else if (lifetimeWeightKg > 100) tier = { name: 'Silver Collector', icon: '🥈', color: '#64748b' };

  const currentLang = LANGUAGES[langIndex];
  const speakText = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utt = new SpeechSynthesisUtterance(`${currentLang.tts} ${expectedEarnings} ${langIndex === 5 ? 'rupees' : 'रुपये'}`);
      utt.lang = currentLang.code;
      window.speechSynthesis.speak(utt);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const updated = await updateCollectorProfile({
      name: editForm.name.trim() || profile.name || DEFAULT_PROFILE.name,
      collectorId: editForm.collectorId.trim().toUpperCase() || profile.collectorId || DEFAULT_PROFILE.collectorId,
      location: editForm.location.trim() || profile.location || DEFAULT_PROFILE.location,
      phone: editForm.phone?.trim() || profile.phone || DEFAULT_PROFILE.phone,
    }, activeUserId);
    setProfile(updated);
    setIsEditModalOpen(false);
  };

  const handleSendToHub = async () => {
    if (!hubSelectLot) return;
    try { await requestLotPurchase(hubSelectLot.id, chosenHubId); setHubSelectLot(null); }
    catch (err: any) { alert(err.message || 'Failed to send lot to hub.'); }
  };

  const handleConfirmLotPrice = async (lotId: string) => {
    try { await confirmLotPurchaseByCollector(lotId); setConfirmingLot(null); }
    catch (err: any) { alert(err.message || 'Failed to confirm price.'); }
  };

  const displayName = profile.name || session?.user?.fullName || 'Collector';
  const displayFirstName = displayName.trim().split(' ')[0] || 'Collector';
  const displayCollectorId = profile.collectorId || (session?.user?.id ? (session.user.id.startsWith('KAB-') ? session.user.id : `KAB-${session.user.id.replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase()}`) : 'KAB-COLLECTOR');
  const displayLocation = profile.location || 'Bangalore (Urban Area)';

  return (
    <div className="max-w-2xl mx-auto px-4 py-5 space-y-5 pb-28 sm:pb-12">

      {/* ─── Greeting Bar ─────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-2xl font-black text-[#1f2937]">{currentLang.greeting}, {displayFirstName}</p>
          <p className="text-sm text-[#64748b] mt-0.5">{currentLang.sub}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={speakText} title="Read summary aloud"
            className="p-2 rounded-xl bg-[#dcfce7] text-[#166534] hover:bg-green-200 transition">
            <Volume2 size={17}/>
          </button>
          <button onClick={() => setLangIndex(i => (i+1) % LANGUAGES.length)} title="Switch language"
            className="w-9 h-9 rounded-xl bg-[#166534] text-white flex items-center justify-center text-[11px] font-bold transition hover:bg-[#14532d]">
            {currentLang.label}
          </button>
        </div>
      </div>

      {/* ─── Stats Row ───────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="stat-card">
          <div className="flex items-center gap-1.5 text-[#64748b] mb-2">
            <Wallet size={14}/><span className="stat-card-label" style={{marginTop:0}}>Est. Earnings</span>
          </div>
          <p className="stat-card-value text-[#166534]">₹{expectedEarnings.toLocaleString('en-IN')}</p>
          <p className="text-[11px] text-[#64748b] mt-1">{activeLots.length} active lots</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-1.5 text-[#64748b] mb-2">
            <Leaf size={14} color="#166534"/><span className="stat-card-label" style={{marginTop:0}}>CO₂ Saved</span>
          </div>
          <p className="stat-card-value text-[#166534]">{carbonSavedKg}<span className="text-base font-normal"> kg</span></p>
          <p className="text-[10px] text-[#64748b] mt-1" title="Estimated at 1.44 kg CO₂e offset per kg diverted from landfill (academic LCA benchmark)">
            est. (~1.44 kg CO₂e/kg)
          </p>
        </div>
      </div>

      {/* ─── Profile Card ────────────────────────────── */}
      <div className="kc-card p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#dcfce7] flex items-center justify-center flex-shrink-0">
            <User size={20} color="#166534"/>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-[#1f2937] text-sm truncate">{displayName}</p>
              <span className="badge badge-neutral font-mono">{displayCollectorId}</span>
              <span className="text-sm">{tier.icon}</span>
              <span className="text-[11px] font-semibold" style={{color: tier.color}}>{tier.name}</span>
            </div>
            <p className="text-xs text-[#64748b] flex items-center gap-1 mt-0.5 truncate">
              <MapPin size={11}/>{displayLocation}
            </p>
          </div>
          <button onClick={() => setIsEditModalOpen(true)}
            className="p-2 rounded-lg hover:bg-gray-100 transition flex-shrink-0" title="Edit profile">
            <Edit3 size={15} color="#64748b"/>
          </button>
        </div>
      </div>

      {/* ─── Add New Lot CTA ─────────────────────────── */}
      <button onClick={() => navigate('/new')}
        className="w-full btn-primary py-3.5 text-base rounded-xl gap-2">
        <PlusCircle size={20}/>
        Log New Scrap Lot
      </button>

      {/* ─── Lots Tabs ───────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex gap-2">
            {(['ACTIVE', 'HISTORY'] as const).map(tab => (
              <button key={tab} onClick={() => setLotTab(tab)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
                  lotTab === tab
                    ? 'bg-[#166534] text-white'
                    : 'bg-white border border-[#e2e8f0] text-[#64748b] hover:border-[#166534] hover:text-[#166534]'
                }`}>
                {tab === 'ACTIVE' ? `Active (${activeLots.length})` : `History (${completedLots.length})`}
              </button>
            ))}
          </div>
          <button
            onClick={handleManualSync}
            disabled={isSyncing}
            className="flex items-center gap-1 text-[11px] font-bold text-[#166534] bg-[#f0fdf4] border border-[#bbf7d0] px-2.5 py-1.5 rounded-xl hover:bg-[#dcfce7] transition shadow-2xs"
            title="Pull updates from cloud godown"
          >
            <RefreshCw size={11} className={isSyncing ? 'animate-spin' : ''} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Cloud'}</span>
          </button>
        </div>

        {/* Active Lots */}
        {lotTab === 'ACTIVE' && (
          <div className="space-y-3">
            {activeLots.length === 0 ? (
              <div className="kc-card p-10 flex flex-col items-center text-center gap-3">
                <Package size={36} color="#cbd5e1"/>
                <p className="font-semibold text-[#64748b]">No active scrap loads</p>
                <p className="text-sm text-[#94a3b8]">Tap "Log New Scrap Lot" above to get started.</p>
              </div>
            ) : (
              activeLots.map(lot => {
                const displayWeight = typeof lot.actualWeight === 'number' && lot.actualWeight > 0 ? lot.actualWeight : parseFloat(lot.weight);
                const displayPrice = lot.purchaseAmount || lot.estimate;
                const needsAction = lot.status === 'AWAITING_COLLECTOR_CONFIRMATION';

                return (
                  <div key={lot.id} className={`kc-card overflow-hidden ${needsAction ? 'border-amber-300' : ''}`}>
                    {needsAction && (
                      <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2">
                        <AlertTriangle size={14} color="#b45309"/>
                        <p className="text-xs font-bold text-amber-800">Action required — confirm hub weigh-in</p>
                      </div>
                    )}
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        {lot.photo ? (
                          <img src={lot.photo} alt={lot.material}
                            className="w-14 h-14 rounded-xl object-cover border border-[#e2e8f0] flex-shrink-0"/>
                        ) : (
                          <div className="w-14 h-14 rounded-xl bg-[#f0fdf4] flex items-center justify-center flex-shrink-0 border border-[#e2e8f0]">
                            <Package size={22} color="#166534"/>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-[#1f2937] text-sm">{lot.material}</p>
                          <p className="text-xs text-[#64748b]">{displayWeight.toFixed(2)} kg • {lot.condition || 'Mixed Scrap'}</p>
                          <div className="mt-1.5"><StatusBadge lot={lot}/></div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-black text-[#166534] text-base">₹{displayPrice.toLocaleString('en-IN')}</p>
                          <p className="text-[10px] text-[#94a3b8] font-mono mt-0.5">#{lot.id.slice(0,6)}</p>
                        </div>
                      </div>

                      {/* Action banner for AWAITING_COLLECTOR_CONFIRMATION */}
                      {needsAction && (
                        <div className="mt-3 p-3 bg-amber-50 rounded-xl border border-amber-200 space-y-2">
                          <p className="text-xs text-amber-900">
                            Hub scale: <strong>{lot.actualWeight} kg</strong> (estimate: {lot.weight} kg) •
                            Net payout: <strong className="text-[#166534]">₹{lot.purchaseAmount}</strong>
                          </p>
                          <button onClick={() => setConfirmingLot(lot)}
                            className="w-full py-2.5 bg-[#166534] text-white text-xs font-bold rounded-lg hover:bg-[#14532d] transition">
                            Review & Confirm Agreed Amount
                          </button>
                        </div>
                      )}

                      {/* Actions for PENDING */}
                      {lot.status === 'PENDING' && (
                        <div className="mt-3 space-y-2">
                          <button onClick={() => navigate(`/find-partners?lotId=${lot.id}&material=${encodeURIComponent(lot.material)}&weight=${lot.weight}`)}
                            className="w-full py-2.5 bg-[#166534] text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 hover:bg-[#14532d] shadow-sm transition">
                            <Compass size={14}/>Find Collection Partners & Smart Quotes
                          </button>
                          <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => { setHubSelectLot(lot); setChosenHubId(DEMO_HUBS[0].id); }}
                              className="py-2 bg-[#f0fdf4] border border-[#dcfce7] text-[#166534] text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 hover:bg-[#dcfce7] transition">
                              <Building2 size={13}/>Quick Hub Send
                            </button>
                            <button onClick={() => navigate(`/handover/${lot.id}`)}
                              className="py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 hover:bg-slate-200 transition">
                              Direct Manifest<ChevronRight size={13}/>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* View receipt for PAID */}
                      {lot.status === 'PAID' && (
                        <button onClick={() => setReceiptLotId(lot.id)}
                          className="mt-3 w-full py-2 bg-[#f0fdf4] border border-[#dcfce7] text-[#166534] text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 hover:bg-[#dcfce7] transition">
                          <Receipt size={13}/>View Payment Receipt
                        </button>
                      )}

                      {/* Hub info for in-progress */}
                      {['REQUESTED','ACCEPTED','RECEIVED','PURCHASE_CONFIRMED','PAYMENT_PENDING'].includes(lot.status) && (
                        <p className="mt-2 text-[11px] text-[#64748b] text-center font-mono">
                          Hub: {hubs.find(h => h.id === lot.hubId)?.name || 'Bengaluru East Scrap & E-Waste Godown'}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* History Tab */}
        {lotTab === 'HISTORY' && (
          <div className="space-y-2">
            {completedLots.length === 0 ? (
              <div className="kc-card p-10 flex flex-col items-center text-center gap-3">
                <CheckCircle2 size={36} color="#cbd5e1"/>
                <p className="font-semibold text-[#64748b]">No completed transactions yet.</p>
              </div>
            ) : (
              completedLots.map(lot => (
                <div key={lot.id} className="kc-card p-4 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm text-[#1f2937]">{lot.material}</p>
                      <StatusBadge lot={lot}/>
                    </div>
                    <p className="text-xs text-[#64748b] mt-0.5">
                      {(lot.actualWeight || parseFloat(lot.weight)).toFixed(2)} kg •
                      {new Date(lot.timestamp).toLocaleDateString('en-IN')} •
                      #{lot.id.slice(0,6)}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-black text-[#166534] text-sm">₹{(lot.purchaseAmount || lot.estimate).toLocaleString('en-IN')}</p>
                    {lot.status === 'PAID' && (
                      <button onClick={() => setReceiptLotId(lot.id)}
                        className="text-[11px] text-[#166534] font-bold flex items-center gap-1 mt-1 hover:underline">
                        <Receipt size={11}/>Receipt
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* ─── MODAL: Hub Select ─────────────────────── */}
      {hubSelectLot && (
        <div className="modal-overlay" onClick={() => setHubSelectLot(null)}>
          <div className="modal-panel p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-black text-[#1f2937]">Send Lot to Hub</h3>
                <p className="text-xs text-[#64748b] mt-0.5">Select an aggregation godown</p>
              </div>
              <button onClick={() => setHubSelectLot(null)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X size={18} color="#64748b"/>
              </button>
            </div>
            <div className="bg-[#f0fdf4] border border-[#dcfce7] rounded-xl p-3 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-[#64748b]">Material:</span><span className="font-semibold">{hubSelectLot.material}</span></div>
              <div className="flex justify-between"><span className="text-[#64748b]">Est. Weight:</span><span className="font-semibold">{hubSelectLot.weight} kg</span></div>
              <div className="flex justify-between"><span className="text-[#64748b]">Est. Value:</span><span className="font-bold text-[#166534]">₹{hubSelectLot.estimate.toLocaleString('en-IN')}</span></div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#1f2937]">Select Hub</label>
              {hubs.map(h => (
                <div key={h.id} onClick={() => setChosenHubId(h.id)}
                  className={`p-3 rounded-xl border-2 cursor-pointer transition ${
                    chosenHubId === h.id ? 'border-[#166534] bg-[#f0fdf4]' : 'border-[#e2e8f0] hover:border-[#166534]/50'
                  }`}>
                  <p className="font-bold text-sm text-[#1f2937]">{h.name}</p>
                  <p className="text-xs text-[#64748b]">{h.location}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button onClick={() => setHubSelectLot(null)} className="btn-secondary py-3">Cancel</button>
              <button onClick={handleSendToHub} className="btn-primary py-3">Submit Request</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: Confirm Weight ─────────────────── */}
      {confirmingLot && (
        <div className="modal-overlay" onClick={() => setConfirmingLot(null)}>
          <div className="modal-panel p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Scale size={15} color="#b45309"/>
                  <span className="text-xs font-bold text-amber-700">Hub Scale Verification</span>
                </div>
                <h3 className="font-black text-[#1f2937]">Confirm Agreed Price</h3>
                <p className="text-xs text-[#64748b]">Lot #{confirmingLot.id.slice(0,6)} • {confirmingLot.material}</p>
              </div>
            </div>
            <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-4 space-y-2 font-mono text-sm">
              <div className="flex justify-between text-[#64748b]">
                <span>Your estimate:</span><span>{confirmingLot.weight} kg</span>
              </div>
              <div className="flex justify-between font-bold text-[#1f2937]">
                <span>Hub scale:</span><span>{confirmingLot.actualWeight} kg</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-[#e2e8f0] text-[#166534] font-black text-base">
                <span>Final Payout:</span><span>₹{confirmingLot.purchaseAmount?.toLocaleString('en-IN')}</span>
              </div>
            </div>
            <p className="text-xs text-[#64748b] bg-[#f0fdf4] p-3 rounded-xl">
              By confirming, you agree to the hub's measured weight and payout amount.
              Cash or UPI payment will be disbursed immediately.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setConfirmingLot(null)} className="btn-secondary py-3">Hold / Dispute</button>
              <button onClick={() => handleConfirmLotPrice(confirmingLot.id)} className="btn-primary py-3 gap-1.5">
                <Check size={15}/>Confirm & Accept
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Receipt Modal ─────────────────────────── */}
      {receiptLotId && <PurchaseReceiptModal lotId={receiptLotId} onClose={() => setReceiptLotId(null)}/>}

      {/* ─── Edit Profile Modal ────────────────────── */}
      {isEditModalOpen && (
        <div className="modal-overlay" onClick={() => setIsEditModalOpen(false)}>
          <div className="modal-panel p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-black text-[#1f2937]">Edit Collector Profile</h3>
                <p className="text-xs text-[#64748b] mt-0.5">Saved locally to your device</p>
              </div>
              <button onClick={() => setIsEditModalOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X size={18} color="#64748b"/>
              </button>
            </div>
            <form onSubmit={handleSaveProfile} className="space-y-3">
              {[
                { label: 'Collector Name', key: 'name', placeholder: 'e.g. Ramu Kabadiwala', type: 'text' },
                { label: 'Collector ID', key: 'collectorId', placeholder: 'e.g. KAB-7842', type: 'text' },
                { label: 'Collection Area', key: 'location', placeholder: 'e.g. Bangalore South (Ward 152)', type: 'text' },
                { label: 'Phone (Optional)', key: 'phone', placeholder: '+91 98450 78421', type: 'tel' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-bold text-[#1f2937] mb-1.5">{f.label}</label>
                  <input
                    type={f.type}
                    value={(editForm as any)[f.key] || ''}
                    onChange={e => setEditForm({ ...editForm, [f.key]: e.target.value })}
                    placeholder={f.placeholder}
                    className="kc-input"
                  />
                </div>
              ))}
              <p className="text-[11px] text-[#94a3b8] bg-[#f8fafc] p-3 rounded-xl border border-[#e2e8f0]">
                This profile is stored in your browser's IndexedDB. It persists across refreshes.
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="btn-secondary py-3">Cancel</button>
                <button type="submit" className="btn-primary py-3 gap-1.5">
                  <Check size={15}/>Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
