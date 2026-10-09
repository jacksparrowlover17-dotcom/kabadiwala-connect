import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { Home, PlusSquare, History, ShieldCheck, Database } from 'lucide-react';
import HomePage from './pages/HomePage';
import NewLotPage from './pages/NewLotPage';
import HandoverPage from './pages/HandoverPage';
import RecyclerPage from './pages/RecyclerPage';
import SafetyPage from './pages/SafetyPage';
import PriceBoardPage from './pages/PriceBoardPage';
import DataExportPage from './pages/DataExportPage';
import { db } from './lib/db';
import { syncDataOnline } from './lib/supabase';

function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col h-screen bg-[#F1F4EF] text-[#14213D] max-w-md mx-auto shadow-2xl relative">
      <div className="flex-1 overflow-y-auto pb-20">
        {children}
      </div>
      
      {/* Bottom Navigation */}
      <div className="absolute bottom-0 w-full bg-white border-t border-gray-200 flex justify-around p-3 pb-6">
        <button onClick={() => navigate('/')} className="flex flex-col items-center text-gray-500 hover:text-blue-600">
          <Home size={24} />
          <span className="text-xs font-semibold mt-1">Home</span>
        </button>
        <button onClick={() => navigate('/prices')} className="flex flex-col items-center text-gray-500 hover:text-orange-600">
          <History size={24} />
          <span className="text-xs font-semibold mt-1">Prices</span>
        </button>
        <button onClick={() => navigate('/new')} className="flex flex-col items-center text-gray-500 hover:text-green-600">
          <PlusSquare size={24} />
          <span className="text-xs font-semibold mt-1">New Load</span>
        </button>
        <button onClick={() => navigate('/safety')} className="flex flex-col items-center text-gray-500 hover:text-red-600">
          <ShieldCheck size={24} />
          <span className="text-xs font-semibold mt-1">Safety</span>
        </button>
        <button onClick={() => navigate('/data')} className="flex flex-col items-center text-gray-500 hover:text-purple-600">
          <Database size={24} />
          <span className="text-xs font-semibold mt-1">Data</span>
        </button>
      </div>
    </div>
  );
}

function App() {
  useEffect(() => {
    const handleOnline = async () => {
      console.log('Device is online. Attempting background sync...');
      try {
        const completedLots = await db.lots.where('status').equals('COMPLETED').toArray();
        if (completedLots.length > 0) {
          await syncDataOnline(completedLots);
        }
      } catch (err) {
        console.error('Failed to sync offline data:', err);
      }
    };

    window.addEventListener('online', handleOnline);
    // Initial check on load
    if (navigator.onLine) {
      handleOnline();
    }

    return () => window.removeEventListener('online', handleOnline);
  }, []);

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/new" element={<NewLotPage />} />
          <Route path="/handover/:id" element={<HandoverPage />} />
          <Route path="/recycler" element={<RecyclerPage />} />
          <Route path="/safety" element={<SafetyPage />} />
          <Route path="/prices" element={<PriceBoardPage />} />
          <Route path="/data" element={<DataExportPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
