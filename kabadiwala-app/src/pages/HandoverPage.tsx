import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { generateHandoverCode } from '../lib/hash';
import { CheckCircle2, ShieldCheck, MapPin } from 'lucide-react';

export default function HandoverPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const lot = useLiveQuery(() => db.lots.get(id as string), [id]);
  const recyclers = useLiveQuery(() => db.recyclers.toArray(), []) || [];
  
  const [selectedRecycler, setSelectedRecycler] = useState<string | null>(null);
  const [handoverCode, setHandoverCode] = useState<string | null>(null);

  useEffect(() => {
    if (selectedRecycler && lot) {
      setHandoverCode(generateHandoverCode(lot.id, lot.material, lot.weight, lot.estimate));
    }
  }, [selectedRecycler, lot]);

  if (!lot) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-2">Find a Buyer</h1>
      <p className="text-gray-500 mb-6">Choose an authorized recycler for your {lot.material} ({lot.weight} kg).</p>

      {!selectedRecycler ? (
        <div className="space-y-4">
          {recyclers.map(r => (
            <div 
              key={r.id} 
              onClick={() => r.verified && setSelectedRecycler(r.id)}
              className={`p-4 rounded-xl border-2 ${r.verified ? 'bg-white border-gray-100 active:border-blue-500 shadow-sm' : 'bg-gray-50 border-gray-200 opacity-60'} flex flex-col`}
            >
              <div className="flex justify-between items-start mb-2">
                <span className="font-bold text-lg">{r.name}</span>
                <span className="font-black text-green-600">₹ {r.rate}/kg</span>
              </div>
              <div className="flex items-center space-x-4 text-sm text-gray-500">
                <span className="flex items-center"><MapPin size={14} className="mr-1" /> {r.distance} km</span>
                {r.verified ? (
                  <span className="flex items-center text-blue-600 font-semibold bg-blue-50 px-2 py-1 rounded-full"><ShieldCheck size={14} className="mr-1" /> CPCB Authorized</span>
                ) : (
                  <span className="text-red-500 font-semibold">Not Authorized</span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-8 relative">
          {/* Parchi (Torn Receipt) Design */}
          <div className="bg-[#FFFDF5] p-8 rounded-t-sm shadow-xl text-center border-t-8 border-[#FFC72C] relative z-10" style={{ filter: 'drop-shadow(0 10px 8px rgba(0,0,0,0.1))' }}>
            {/* Dashed tear line at bottom */}
            <div className="absolute bottom-0 left-0 w-full h-4 bg-[radial-gradient(circle,transparent_4px,#FFFDF5_5px)] bg-[length:16px_16px] -mb-2"></div>
            
            <CheckCircle2 size={48} className="text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-black mb-1 text-[#14213D] uppercase tracking-widest">Handover Parchi</h2>
            <p className="text-gray-500 text-xs mb-8 uppercase font-bold tracking-wider">Present to Recycler</p>
            
            <div className="bg-white border-2 border-dashed border-gray-300 p-6 rounded-md mb-8">
              <div className="tracking-[0.3em] text-5xl font-black text-[#14213D] font-mono">
                {handoverCode}
              </div>
              <p className="text-[10px] text-gray-400 mt-3 font-mono tracking-widest uppercase">Tamper-Evident Hash</p>
            </div>
            
            <div className="text-left text-sm text-[#14213D] mb-6 space-y-3 border-t-2 border-dashed border-gray-200 pt-6 font-mono">
              <div className="flex justify-between"><span className="text-gray-500">MATL:</span> <strong>{lot.material}</strong></div>
              <div className="flex justify-between"><span className="text-gray-500">WGHT:</span> <strong>{lot.weight} KG</strong></div>
              <div className="flex justify-between text-lg mt-4 pt-4 border-t-2 border-black"><span className="text-gray-500">EST_PAY:</span> <strong className="text-green-700">₹ {lot.estimate}</strong></div>
            </div>
          </div>
          
          <button 
            onClick={() => navigate('/')}
            className="w-full text-white bg-[#14213D] font-bold py-4 rounded-b-2xl mt-4 shadow-lg hover:bg-blue-900 transition"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}
