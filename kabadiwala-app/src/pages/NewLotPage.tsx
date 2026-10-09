import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../lib/db';
import { Camera, Weight, Calculator } from 'lucide-react';

const CATEGORIES = [
  { id: 'PCB', name: 'Circuit Boards (PCB)', rate: 250, icon: '🟩' },
  { id: 'CABLE', name: 'Copper Cables', rate: 450, icon: '🔌' },
  { id: 'PHONE', name: 'Mobile Phones', rate: 1200, icon: '📱' },
];

export default function NewLotPage() {
  const navigate = useNavigate();
  const [material, setMaterial] = useState(CATEGORIES[0]);
  const [weight, setWeight] = useState('');

  const handleSave = async () => {
    if (!weight) return;
    const est = parseFloat(weight) * material.rate;
    
    await db.lots.add({
      id: crypto.randomUUID(),
      material: material.name,
      weight: weight,
      estimate: est,
      status: 'PENDING',
      timestamp: Date.now()
    });
    
    navigate('/');
  };

  return (
    <div className="p-6 pb-24">
      <h1 className="text-2xl font-bold mb-6">New Load</h1>
      
      {/* Photo Placeholder */}
      <div className="bg-gray-100 h-40 rounded-2xl flex flex-col items-center justify-center text-gray-500 mb-6 border-2 border-dashed border-gray-300">
        <Camera size={40} className="mb-2" />
        <span className="font-semibold">Tap to take photo</span>
      </div>

      {/* Category Selection */}
      <h2 className="font-bold mb-3">1. Select Material</h2>
      <div className="grid grid-cols-3 gap-3 mb-6">
        {CATEGORIES.map(cat => (
          <button 
            key={cat.id}
            onClick={() => setMaterial(cat)}
            className={`p-3 rounded-xl flex flex-col items-center text-center border-2 transition-colors ${material.id === cat.id ? 'border-blue-600 bg-blue-50' : 'border-gray-100 bg-white'}`}
          >
            <span className="text-2xl mb-1">{cat.icon}</span>
            <span className="text-xs font-semibold">{cat.name}</span>
          </button>
        ))}
      </div>

      {/* Weight Input */}
      <h2 className="font-bold mb-3 flex items-center"><Weight size={18} className="mr-2" /> 2. Enter Approx Weight (kg)</h2>
      <input 
        type="number" 
        value={weight}
        onChange={(e) => setWeight(e.target.value)}
        placeholder="e.g. 5"
        className="w-full text-2xl p-4 rounded-xl border border-gray-300 mb-6 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
      />

      {/* Estimate */}
      <div className="bg-yellow-50 p-4 rounded-xl mb-8 flex justify-between items-center border border-yellow-200">
        <div className="flex items-center text-yellow-800">
          <Calculator size={20} className="mr-2" />
          <span className="font-semibold">Estimated Value</span>
        </div>
        <div className="text-2xl font-black text-yellow-900">
          ₹ {weight ? (parseFloat(weight) * material.rate).toLocaleString() : '0'}
        </div>
      </div>

      <button 
        onClick={handleSave}
        disabled={!weight}
        className="w-full bg-[#14213D] text-white py-4 rounded-xl font-bold text-lg disabled:opacity-50"
      >
        Save to My Load
      </button>
    </div>
  );
}
