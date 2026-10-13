import { TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';

const PRICES = [
  { id: 'PCB',     name: 'Circuit Boards (PCB)', price: 250,  range: '₹240 – ₹280', trend: 'up',   icon: '🟩' },
  { id: 'CABLE',   name: 'Copper Cables',         price: 450,  range: '₹440 – ₹460', trend: 'flat', icon: '🔌' },
  { id: 'PHONE',   name: 'Mobile Phones',          price: 1200, range: '₹1,100 – ₹1,300', trend: 'down', icon: '📱' },
  { id: 'BATTERY', name: 'Lithium Batteries',      price: 180,  range: '₹170 – ₹190', trend: 'up',   icon: '🔋' },
];

export default function PriceBoardPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-5 space-y-5 pb-28 sm:pb-12">
      <div>
        <h1 className="text-xl font-black text-[#1f2937]">Today's Prices</h1>
        <p className="text-sm text-[#64748b] mt-0.5">आज के भाव — Current market rates from verified buyers.</p>
      </div>

      <div className="space-y-3">
        {PRICES.map(item => (
          <div key={item.id} className="kc-card p-4 flex items-center gap-4">
            <div className="text-3xl w-10 flex-shrink-0">{item.icon}</div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-[#1f2937]">{item.name}</p>
              <p className="text-xs text-[#64748b] mt-0.5">Market range: {item.range} / kg</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-2xl font-black text-[#1f2937]">₹{item.price}</p>
              <div className="flex items-center justify-end gap-1 mt-0.5">
                {item.trend === 'up'   && <><TrendingUp  size={13} color="#166534"/><span className="text-xs font-bold text-[#166534]">Rising</span></>}
                {item.trend === 'down' && <><TrendingDown size={13} color="#b91c1c"/><span className="text-xs font-bold text-red-600">Falling</span></>}
                {item.trend === 'flat' && <><Minus        size={13} color="#64748b"/><span className="text-xs font-bold text-[#64748b]">Stable</span></>}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="kc-card p-4 flex items-start gap-3">
        <Info size={16} color="#1d4ed8" className="flex-shrink-0 mt-0.5"/>
        <p className="text-sm text-[#64748b]">
          <strong className="text-[#1f2937]">Note:</strong> These are indicative rates representing average prices offered by CPCB-authorized recyclers in the Bengaluru region.
          Actual rates may vary based on condition, quantity, and negotiation.
        </p>
      </div>
    </div>
  );
}
