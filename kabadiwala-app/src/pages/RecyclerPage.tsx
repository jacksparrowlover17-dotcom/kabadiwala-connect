import { useState } from 'react';
import { sha256 } from 'js-sha256';
import { ShieldCheck, AlertTriangle } from 'lucide-react';

export default function RecyclerPage() {
  const [code, setCode] = useState('');
  const [lotId, setLotId] = useState('');
  const [material, setMaterial] = useState('');
  const [weight, setWeight] = useState('');
  const [estimate, setEstimate] = useState('');
  
  const [verificationResult, setVerificationResult] = useState<'IDLE' | 'SUCCESS' | 'FAILED'>('IDLE');

  const verifyTransaction = () => {
    // In a real app, the recycler would only enter the code, and the backend would look up the lot.
    // For this offline demo, we simulate it by hashing the inputs and checking if it matches the code.
    const payload = `id=${lotId}|mat=${material}|kg=${weight}|est=${estimate}`;
    const hash = sha256(payload);
    const shortHash = parseInt(hash.substring(0, 12), 16);
    const derivedCode = (shortHash % 1000000).toString().padStart(6, '0');

    if (derivedCode === code && code.length === 6) {
      setVerificationResult('SUCCESS');
    } else {
      setVerificationResult('FAILED');
    }
  };

  return (
    <div className="p-6 bg-[#14213D] min-h-screen text-white">
      <h1 className="text-2xl font-bold mb-2">Recycler Dashboard</h1>
      <p className="text-gray-400 mb-8">Verify incoming materials from Kabadiwalas.</p>

      <div className="bg-white text-black p-6 rounded-2xl shadow-lg">
        <h2 className="font-bold mb-4">Enter Collector's Details</h2>
        
        <input 
          placeholder="Lot ID (e.g. 1234)" 
          value={lotId} onChange={e => setLotId(e.target.value)}
          className="w-full p-3 rounded-xl border border-gray-300 mb-3"
        />
        <input 
          placeholder="Material (e.g. Copper Cables)" 
          value={material} onChange={e => setMaterial(e.target.value)}
          className="w-full p-3 rounded-xl border border-gray-300 mb-3"
        />
        <input 
          placeholder="Weight in kg (e.g. 12)" 
          value={weight} onChange={e => setWeight(e.target.value)}
          className="w-full p-3 rounded-xl border border-gray-300 mb-3"
        />
        <input 
          placeholder="Expected Payment (₹)" 
          value={estimate} onChange={e => setEstimate(e.target.value)}
          className="w-full p-3 rounded-xl border border-gray-300 mb-6"
        />

        <h2 className="font-bold mb-2">6-Digit Handover Code</h2>
        <input 
          placeholder="000000" 
          value={code} onChange={e => setCode(e.target.value)}
          maxLength={6}
          className="w-full p-4 text-center tracking-[0.5em] text-3xl font-black rounded-xl border-2 border-[#FFC72C] mb-6 focus:outline-none"
        />

        <button 
          onClick={verifyTransaction}
          className="w-full bg-[#14213D] text-white py-4 rounded-xl font-bold text-lg"
        >
          Verify Transaction
        </button>

        {verificationResult === 'SUCCESS' && (
          <div className="mt-6 bg-green-50 border border-green-200 text-green-700 p-4 rounded-xl flex items-start">
            <ShieldCheck className="mr-2 flex-shrink-0" />
            <div>
              <p className="font-bold">Verified & Authentic</p>
              <p className="text-sm">The weight and material match the collector's original entry. Proceed to pay ₹{estimate}.</p>
            </div>
          </div>
        )}

        {verificationResult === 'FAILED' && (
          <div className="mt-6 bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-start">
            <AlertTriangle className="mr-2 flex-shrink-0" />
            <div>
              <p className="font-bold">Verification Failed</p>
              <p className="text-sm">The code does not match. The weight, material, or price may have been tampered with.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
