
import { Volume2, Flame, Droplet, Skull } from 'lucide-react';

const SAFETY_TIPS = [
  {
    id: 'fire',
    icon: <Flame size={48} className="text-orange-500" />,
    title: 'DON\'T BURN CABLES',
    desc: 'Burning cables releases toxic smoke. Sell them intact.',
    hi_audio: 'केबलों को न जलाएं, इससे जहरीला धुआं निकलता है।'
  },
  {
    id: 'acid',
    icon: <Droplet size={48} className="text-yellow-500" />,
    title: 'DANGEROUS ACID',
    desc: 'Do not break batteries open. The acid burns skin.',
    hi_audio: 'बैटरी को न तोड़ें। इसका एसिड त्वचा को जला सकता है।'
  },
  {
    id: 'crt',
    icon: <Skull size={48} className="text-red-500" />,
    title: 'CRT GLASS HAZARD',
    desc: 'Old TV glass contains lead. Handle with care.',
    hi_audio: 'पुराने टीवी के शीशे में सीसा होता है। इसे सावधानी से संभालें।'
  }
];

export default function SafetyPage() {
  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'hi-IN';
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-2">Safety Guide (सुरक्षा)</h1>
      <p className="text-gray-500 mb-6">Stay safe while handling electronic waste.</p>

      <div className="space-y-4">
        {SAFETY_TIPS.map(tip => (
          <div key={tip.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center">
            <div className="mr-4">
              {tip.icon}
            </div>
            <div className="flex-1">
              <h2 className="font-bold text-lg text-[#14213D]">{tip.title}</h2>
              <p className="text-sm text-gray-500 mt-1">{tip.desc}</p>
            </div>
            <button 
              onClick={() => speakText(tip.hi_audio)}
              className="p-3 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100 transition"
            >
              <Volume2 size={24} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
