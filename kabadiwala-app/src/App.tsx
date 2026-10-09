import React, { useEffect, useState, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Home, PlusSquare, History, ShieldCheck, Database, UserCircle, QrCode } from 'lucide-react';
import HomePage from './pages/HomePage';
import NewLotPage from './pages/NewLotPage';
import HandoverPage from './pages/HandoverPage';
import RecyclerPage from './pages/RecyclerPage';
import SafetyPage from './pages/SafetyPage';
import PriceBoardPage from './pages/PriceBoardPage';
import DataExportPage from './pages/DataExportPage';
import { db } from './lib/db';
import { syncDataOnline } from './lib/supabase';

type Role = 'COLLECTOR' | 'RECYCLER' | 'ADMIN';

interface RoleContextType {
  role: Role;
  setRole: (role: Role) => void;
}

const RoleContext = createContext<RoleContextType>({ role: 'COLLECTOR', setRole: () => {} });

function RoleSwitcher() {
  const { role, setRole } = useContext(RoleContext);
  const navigate = useNavigate();

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRole = e.target.value as Role;
    setRole(newRole);
    if (newRole === 'ADMIN') navigate('/data');
    else if (newRole === 'RECYCLER') navigate('/recycler');
    else navigate('/');
  };

  return (
    <div className="bg-gray-800 text-white p-2 flex justify-between items-center text-xs z-50 relative">
      <div className="flex items-center">
        <UserCircle size={14} className="mr-1" />
        <span className="font-semibold text-gray-300">Active Role:</span>
      </div>
      <select 
        value={role} 
        onChange={handleRoleChange}
        className="bg-gray-700 border-none outline-none text-white rounded px-2 py-1 font-bold"
      >
        <option value="COLLECTOR">Informal Collector</option>
        <option value="RECYCLER">Formal Recycler</option>
        <option value="ADMIN">Govt / Admin</option>
      </select>
    </div>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { role } = useContext(RoleContext);

  const isActive = (path: string) => location.pathname === path ? 'text-blue-600' : 'text-gray-500 hover:text-blue-600';

  return (
    <div className="flex flex-col h-screen bg-[#F1F4EF] text-[#14213D] max-w-md mx-auto shadow-2xl relative">
      <RoleSwitcher />
      
      <div className="flex-1 overflow-y-auto pb-20">
        {children}
      </div>
      
      {/* Bottom Navigation (RBAC Controlled) */}
      <div className="absolute bottom-0 w-full bg-white border-t border-gray-200 flex justify-around p-3 pb-6">
        
        {/* COLLECTOR NAV */}
        {role === 'COLLECTOR' && (
          <>
            <button onClick={() => navigate('/')} className={`flex flex-col items-center ${isActive('/')}`}>
              <Home size={24} />
              <span className="text-xs font-semibold mt-1">Home</span>
            </button>
            <button onClick={() => navigate('/prices')} className={`flex flex-col items-center ${isActive('/prices')}`}>
              <History size={24} />
              <span className="text-xs font-semibold mt-1">Prices</span>
            </button>
            <button onClick={() => navigate('/new')} className={`flex flex-col items-center ${isActive('/new')}`}>
              <PlusSquare size={24} />
              <span className="text-xs font-semibold mt-1">New Load</span>
            </button>
            <button onClick={() => navigate('/safety')} className={`flex flex-col items-center ${isActive('/safety')}`}>
              <ShieldCheck size={24} />
              <span className="text-xs font-semibold mt-1">Safety</span>
            </button>
          </>
        )}

        {/* RECYCLER NAV */}
        {role === 'RECYCLER' && (
          <>
            <button onClick={() => navigate('/recycler')} className={`flex flex-col items-center ${isActive('/recycler')}`}>
              <Home size={24} />
              <span className="text-xs font-semibold mt-1">Dashboard</span>
            </button>
            <button onClick={() => navigate('/prices')} className={`flex flex-col items-center ${isActive('/prices')}`}>
              <History size={24} />
              <span className="text-xs font-semibold mt-1">Market Rates</span>
            </button>
            <button className={`flex flex-col items-center text-gray-500`}>
              <QrCode size={24} />
              <span className="text-xs font-semibold mt-1">Receive Hash</span>
            </button>
          </>
        )}

        {/* ADMIN NAV */}
        {role === 'ADMIN' && (
          <>
            <button onClick={() => navigate('/data')} className={`flex flex-col items-center ${isActive('/data')}`}>
              <Database size={24} />
              <span className="text-xs font-semibold mt-1">Intelligence</span>
            </button>
            <button onClick={() => navigate('/prices')} className={`flex flex-col items-center ${isActive('/prices')}`}>
              <History size={24} />
              <span className="text-xs font-semibold mt-1">Price Board</span>
            </button>
          </>
        )}

      </div>
    </div>
  );
}

function App() {
  const [role, setRole] = useState<Role>('COLLECTOR');

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
    <RoleContext.Provider value={{ role, setRole }}>
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
    </RoleContext.Provider>
  );
}

export default App;
