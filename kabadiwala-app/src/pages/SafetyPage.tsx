import { Volume2, Flame, Droplet, Skull, ShieldCheck } from 'lucide-react';

const SAFETY_TIPS = [
  {
    id: 'fire',
    icon: <Flame size={32} color="#ea580c"/>,
    color: '#ea580c',
    bg: '#fff7ed',
    border: '#fed7aa',
    title: "Don't Burn Cables",
    desc: 'Burning cables releases toxic smoke. Sell them intact for maximum value.',
    hi_audio: 'केबलों को न जलाएं, इससे जहरीला धुआं निकलता है।',
  },
  {
    id: 'acid',
    icon: <Droplet size={32} color="#ca8a04"/>,
    color: '#ca8a04',
    bg: '#fefce8',
    border: '#fde68a',
    title: 'Dangerous Battery Acid',
    desc: 'Do not break batteries open. The acid severely burns skin and eyes.',
    hi_audio: 'बैटरी को न तोड़ें। इसका एसिड त्वचा को जला सकता है।',
  },
  {
    id: 'crt',
    icon: <Skull size={32} color="#b91c1c"/>,
    color: '#b91c1c',
    bg: '#fef2f2',
    border: '#fecaca',
    title: 'CRT Glass Hazard',
    desc: 'Old TV and monitor glass contains lead. Handle with thick gloves.',
    hi_audio: 'पुराने टीवी के शीशे में सीसा होता है। इसे सावधानी से संभालें।',
  },
];

export default function SafetyPage() {
  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utt = new SpeechSynthesisUtterance(text);
      utt.lang = 'hi-IN';
      window.speechSynthesis.speak(utt);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-5 space-y-5 pb-28 sm:pb-12">
      <div>
        <h1 className="text-xl font-black text-[#1f2937]">Safety Guide</h1>
        <p className="text-sm text-[#64748b] mt-0.5">सुरक्षा — Stay safe while handling electronic waste.</p>
      </div>

      <div className="space-y-3">
        {SAFETY_TIPS.map(tip => (
          <div key={tip.id} className="kc-card p-4 flex items-start gap-4"
            style={{ borderLeftWidth: 4, borderLeftColor: tip.color }}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: tip.bg }}>
              {tip.icon}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-[#1f2937]">{tip.title}</h2>
              <p className="text-sm text-[#64748b] mt-1">{tip.desc}</p>
            </div>
            <button onClick={() => speakText(tip.hi_audio)}
              className="p-2.5 rounded-xl flex-shrink-0 transition hover:opacity-80"
              style={{ background: tip.bg, color: tip.color }}
              title="Listen in Hindi">
              <Volume2 size={18}/>
            </button>
          </div>
        ))}
      </div>

      <div className="kc-card p-4 flex items-start gap-3">
        <ShieldCheck size={18} color="#166534" className="flex-shrink-0 mt-0.5"/>
        <div>
          <p className="font-semibold text-sm text-[#1f2937]">Protect yourself and your family</p>
          <p className="text-xs text-[#64748b] mt-1">
            E-waste contains hazardous materials including lead, mercury, cadmium, and flame retardants.
            Always wear gloves, wash hands after handling, and keep children away from scrap areas.
          </p>
        </div>
      </div>
    </div>
  );
}
