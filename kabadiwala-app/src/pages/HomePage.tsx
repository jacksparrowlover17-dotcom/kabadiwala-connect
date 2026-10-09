import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { db } from '../lib/db';
import { Wallet, Package, ArrowRight, Volume2, Leaf, Trophy } from 'lucide-react';

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
      // Cancel any ongoing speech before starting a new one
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

  return (
    <div className="p-6 pb-24">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">{currentLang.greeting}</h1>
          <p className="text-gray-500 text-sm">{currentLang.sub}</p>
        </div>
        <div className="flex items-center space-x-3">
          <button 
            onClick={speakText}
            className="p-2 bg-blue-100 text-blue-600 rounded-full active:scale-95 transition-transform"
          >
            <Volume2 size={20} />
          </button>
          <button 
            onClick={toggleLanguage}
            className="bg-yellow-400 p-2 rounded-full shadow-sm active:scale-95 transition-transform w-10 h-10 flex items-center justify-center"
          >
            <span className="font-bold text-xs uppercase">{currentLang.label}</span>
          </button>
        </div>
      </div>

      {/* Gamification / Tier Badge */}
      <div className={`flex items-center p-3 rounded-xl mb-6 shadow-sm border border-gray-100 ${tier.bg}`}>
        <Trophy size={24} className={`mr-3 ${tier.color}`} />
        <div>
          <p className={`font-bold text-sm ${tier.color}`}>Level: {tier.name}</p>
          <p className="text-xs text-gray-700 font-medium">Lifetime Recycled: {lifetimeWeightKg.toFixed(1)} kg</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        {/* Hero Stats */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center text-gray-500 mb-2">
            <Wallet size={16} className="mr-2" />
            <span className="font-semibold text-sm">Expected</span>
          </div>
          <div className="text-2xl font-extrabold text-green-600">
            ₹{expectedEarnings.toLocaleString('en-IN')}
          </div>
        </div>

        {/* Eco Stats */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center text-gray-500 mb-2">
            <Leaf size={16} className="mr-2 text-emerald-500" />
            <span className="font-semibold text-sm">CO₂ Saved</span>
          </div>
          <div className="text-2xl font-extrabold text-emerald-600">
            {carbonSavedKg} <span className="text-sm">kg</span>
          </div>
        </div>
      </div>

      {/* Pending Lots */}
      <h2 className="text-lg font-bold mb-4 flex items-center">
        <Package className="mr-2" /> My Current Load
      </h2>
      
      {pendingLots.length === 0 ? (
        <div className="bg-white p-6 rounded-2xl text-center text-gray-500 border border-dashed border-gray-300">
          No items yet. Tap "New Load" to start collecting.
        </div>
      ) : (
        <div className="space-y-4">
          {pendingLots.map(lot => (
            <div key={lot.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
              <div>
                <p className="font-bold text-lg">{lot.material}</p>
                <p className="text-gray-500 text-sm">{lot.weight} kg</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-green-600">~ ₹{lot.estimate}</p>
                <button 
                  onClick={() => navigate(`/handover/${lot.id}`)}
                  className="mt-2 text-xs bg-blue-50 text-blue-600 px-3 py-1 rounded-full font-semibold flex items-center"
                >
                  Find Buyer <ArrowRight size={12} className="ml-1" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
