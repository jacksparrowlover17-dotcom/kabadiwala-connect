import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../lib/db';
import { Camera, Weight, Calculator, ScanLine, Bluetooth, CheckCircle2 } from 'lucide-react';

const CATEGORIES = [
  { id: 'PCB', name: 'Circuit Boards (PCB)', rate: 250, icon: '🟩' },
  { id: 'CABLE', name: 'Copper Cables', rate: 450, icon: '🔌' },
  { id: 'PHONE', name: 'Mobile Phones', rate: 1200, icon: '📱' },
];

export default function NewLotPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [material, setMaterial] = useState(CATEGORIES[0]);
  const [weight, setWeight] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [photoCaptured, setPhotoCaptured] = useState(false);

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setIsScanning(true);
      // Simulate AI Processing delay
      setTimeout(() => {
        setIsScanning(false);
        setPhotoCaptured(true);
        // Mock AI automatically classifying it as a Mobile Phone
        setMaterial(CATEGORIES[2]);
      }, 2000);
    }
  };

  const fetchBluetoothWeight = () => {
    // Mocking a precise weight coming from a digital scale
    setWeight((Math.random() * 5 + 1).toFixed(2));
  };

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
      
      {/* Hidden File Input for Camera */}
      <input 
        type="file" 
        accept="image/*" 
        capture="environment" 
        ref={fileInputRef} 
        onChange={handlePhotoCapture}
        className="hidden" 
      />

      {/* Photo / AI Scanner Area */}
      <div 
        onClick={() => !isScanning && fileInputRef.current?.click()}
        className={`h-40 rounded-2xl flex flex-col items-center justify-center mb-6 border-2 transition-all cursor-pointer overflow-hidden relative
          ${isScanning ? 'border-blue-500 bg-blue-50' : photoCaptured ? 'border-green-500 bg-green-50' : 'border-dashed border-gray-300 bg-gray-100'}
        `}
      >
        {isScanning ? (
          <>
            <ScanLine size={40} className="mb-2 text-blue-500 animate-pulse" />
            <span className="font-semibold text-blue-600 animate-pulse">AI Analyzing Material...</span>
            <div className="absolute top-0 left-0 w-full h-1 bg-blue-500 animate-[bounce_1s_infinite]"></div>
          </>
        ) : photoCaptured ? (
          <>
            <CheckCircle2 size={40} className="mb-2 text-green-500" />
            <span className="font-semibold text-green-700">Auto-detected: {material.name}</span>
          </>
        ) : (
          <>
            <Camera size={40} className="mb-2 text-gray-400" />
            <span className="font-semibold text-gray-500">Tap to take photo (AI Scan)</span>
          </>
        )}
      </div>

      {/* Category Selection */}
      <h2 className="font-bold mb-3 text-gray-700">1. Select Material</h2>
      <div className="grid grid-cols-3 gap-3 mb-6">
        {CATEGORIES.map(cat => (
          <button 
            key={cat.id}
            onClick={() => setMaterial(cat)}
            className={`p-3 rounded-xl flex flex-col items-center text-center border-2 transition-colors ${material.id === cat.id ? 'border-blue-600 bg-blue-50 shadow-sm' : 'border-gray-100 bg-white'}`}
          >
            <span className="text-2xl mb-1">{cat.icon}</span>
            <span className="text-xs font-semibold">{cat.name}</span>
          </button>
        ))}
      </div>

      {/* Weight Input */}
      <div className="flex justify-between items-end mb-3">
        <h2 className="font-bold text-gray-700 flex items-center"><Weight size={18} className="mr-2" /> 2. Exact Weight (kg)</h2>
        <button 
          onClick={fetchBluetoothWeight}
          className="text-xs flex items-center bg-blue-100 text-blue-700 px-2 py-1 rounded-lg font-bold active:scale-95"
        >
          <Bluetooth size={12} className="mr-1" /> Fetch Scale
        </button>
      </div>
      
      <input 
        type="number" 
        value={weight}
        onChange={(e) => setWeight(e.target.value)}
        placeholder="e.g. 5.00"
        className="w-full text-2xl p-4 rounded-xl border border-gray-300 mb-6 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 font-mono"
      />

      {/* Estimate */}
      <div className="bg-yellow-50 p-4 rounded-xl mb-8 flex justify-between items-center border border-yellow-200">
        <div className="flex items-center text-yellow-800">
          <Calculator size={20} className="mr-2" />
          <span className="font-semibold">Estimated Value</span>
        </div>
        <div className="text-2xl font-black text-yellow-900">
          ₹ {weight ? (parseFloat(weight) * material.rate).toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '0'}
        </div>
      </div>

      <button 
        onClick={handleSave}
        disabled={!weight}
        className="w-full bg-[#14213D] text-white py-4 rounded-xl font-bold text-lg disabled:opacity-50 active:scale-95 transition-transform"
      >
        Save to My Load
      </button>
    </div>
  );
}
