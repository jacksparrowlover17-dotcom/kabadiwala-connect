
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const PRICES = [
  { id: 'PCB', name: 'Circuit Boards (PCB)', price: 250, range: '₹240 - ₹280', trend: 'up' },
  { id: 'CABLE', name: 'Copper Cables', price: 450, range: '₹440 - ₹460', trend: 'flat' },
  { id: 'PHONE', name: 'Mobile Phones', price: 1200, range: '₹1100 - ₹1300', trend: 'down' },
  { id: 'BATTERY', name: 'Lithium Batteries', price: 180, range: '₹170 - ₹190', trend: 'up' },
];

export default function PriceBoardPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-2">Today's Prices (आज के भाव)</h1>
      <p className="text-gray-500 mb-6">Current market rates from verified buyers.</p>

      <div className="space-y-3">
        {PRICES.map(item => (
          <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
            <div>
              <p className="font-bold text-lg">{item.name}</p>
              <p className="text-sm text-gray-400">Market Range: {item.range}/kg</p>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-xl font-black text-[#14213D]">₹{item.price}</span>
              {item.trend === 'up' && <span className="text-green-500 flex items-center text-xs font-bold mt-1"><TrendingUp size={14} className="mr-1" /> Rising</span>}
              {item.trend === 'down' && <span className="text-red-500 flex items-center text-xs font-bold mt-1"><TrendingDown size={14} className="mr-1" /> Falling</span>}
              {item.trend === 'flat' && <span className="text-gray-500 flex items-center text-xs font-bold mt-1"><Minus size={14} className="mr-1" /> Stable</span>}
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-6 p-4 bg-blue-50 text-blue-800 rounded-xl text-sm border border-blue-200">
        <strong>Note:</strong> Prices are dynamic and represent the average rate offered by CPCB-authorized recyclers in your area.
      </div>
    </div>
  );
}
