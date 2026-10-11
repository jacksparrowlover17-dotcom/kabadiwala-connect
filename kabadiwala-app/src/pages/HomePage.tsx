import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { db, type CollectorProfile, DEFAULT_PROFILE, getCollectorProfile, updateCollectorProfile } from '../lib/db';
import { Wallet, Package, ArrowRight, Volume2, Leaf, Trophy, User, Edit3, X, Check, MapPin } from 'lucide-react';

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

  const pendingLots = useLiveQuery(() => db.lots.where('status').equals('PENDING').toArray(), []) || [];
  const completedLots = useLiveQuery(() => db.lots.where('status').equals('COMPLETED').toArray(), []) || [];

  const expectedEarnings = pendingLots.reduce((acc, lot) => acc + lot.estimate, 0);
  
  // Calculate lifetime stats for gamification
  const lifetimeWeightKg = completedLots.reduce((acc, lot) => acc + parseFloat(lot.weight), 0);
  const carbonSavedKg = (lifetimeWeightKg * 1.44).toFixed(1); // Rough estimate for E-waste CO2 offset
  
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

  return (
    <div className="p-6 pb-28">
      {/* Top Header & Language Bar */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl font-black text-[#14213D]">{currentLang.greeting}</h1>
          <p className="text-gray-500 text-xs">{currentLang.sub}</p>
        </div>
        <div className="flex items-center space-x-2.5">
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
      <div className="bg-white rounded-2xl p-4 mb-5 shadow-sm border border-gray-100 relative overflow-hidden">
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
      <div className={`flex items-center p-3.5 rounded-2xl mb-6 shadow-sm border border-gray-100 ${tier.bg}`}>
        <Trophy size={24} className={`mr-3 ${tier.color}`} />
        <div>
          <p className={`font-bold text-xs ${tier.color}`}>Level: {tier.name}</p>
          <p className="text-xs text-gray-700 font-medium">Lifetime Recycled: {lifetimeWeightKg.toFixed(1)} kg</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3.5 mb-8">
        {/* Hero Stats */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center text-gray-500 mb-2">
            <Wallet size={15} className="mr-1.5" />
            <span className="font-semibold text-xs">Expected</span>
          </div>
          <div className="text-2xl font-black text-green-600">
            ₹{expectedEarnings.toLocaleString('en-IN')}
          </div>
        </div>

        {/* Eco Stats */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center text-gray-500 mb-2">
            <Leaf size={15} className="mr-1.5 text-emerald-500" />
            <span className="font-semibold text-xs">CO₂ Saved</span>
          </div>
          <div className="text-2xl font-black text-emerald-600">
            {carbonSavedKg} <span className="text-xs font-normal">kg</span>
          </div>
        </div>
      </div>

      {/* Pending Lots */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-base font-bold text-[#14213D] flex items-center">
          <Package className="mr-2" size={18} /> My Current Load ({pendingLots.length})
        </h2>
        <button 
          onClick={() => navigate('/new')}
          className="text-xs text-blue-600 font-bold hover:underline"
        >
          + Add New
        </button>
      </div>
      
      {pendingLots.length === 0 ? (
        <div className="bg-white p-8 rounded-2xl text-center text-gray-400 border border-dashed border-gray-300">
          <Package className="mx-auto mb-2 text-gray-300" size={32} />
          <p className="font-medium text-sm text-gray-500">No active load items yet.</p>
          <p className="text-xs mt-1">Tap "New Load" below to log a scrap batch.</p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {pendingLots.map(lot => (
            <div key={lot.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {/* Photo thumbnail or icon fallback */}
                {lot.photo ? (
                  <img 
                    src={lot.photo} 
                    alt={lot.material} 
                    className="w-14 h-14 rounded-xl object-cover border border-gray-200 flex-shrink-0 shadow-sm"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-gray-100 text-gray-400 flex items-center justify-center font-bold text-xs flex-shrink-0 border border-gray-200">
                    No Photo
                  </div>
                )}
                
                <div>
                  <p className="font-bold text-sm text-[#14213D]">{lot.material}</p>
                  <p className="text-xs text-gray-500 font-medium">{lot.weight} kg</p>
                  
                  {/* Condition badge */}
                  <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700">
                    {lot.condition || 'Mixed Scrap'}
                  </span>
                </div>
              </div>

              <div className="text-right">
                <p className="font-black text-green-700 text-sm">₹{lot.estimate.toLocaleString()}</p>
                <button 
                  onClick={() => navigate(`/handover/${lot.id}`)}
                  className="mt-2 text-xs bg-[#14213D] text-white px-3 py-1.5 rounded-xl font-bold flex items-center shadow-sm active:scale-95 transition"
                >
                  Handover <ArrowRight size={11} className="ml-1" />
                </button>
              </div>
            </div>
          ))}
        </div>
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
