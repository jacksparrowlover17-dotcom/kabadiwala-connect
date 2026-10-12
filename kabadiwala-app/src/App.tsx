import React, { useEffect, useState, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { 
  Home, 
  PlusSquare, 
  History, 
  ShieldCheck, 
  Database, 
  UserCircle, 
  Building2, 
  Truck, 
  Scale 
} from 'lucide-react';
import HomePage from './pages/HomePage';
import NewLotPage from './pages/NewLotPage';
import HandoverPage from './pages/HandoverPage';
import RecyclerPage from './pages/RecyclerPage';
import SafetyPage from './pages/SafetyPage';
import PriceBoardPage from './pages/PriceBoardPage';
import DataExportPage from './pages/DataExportPage';
import HubDashboardPage from './pages/HubDashboardPage';
import ShipmentAggregationPage from './pages/ShipmentAggregationPage';
import { db } from './lib/db';
import { syncDataOnline } from './lib/supabase';

export type Role = 'COLLECTOR' | 'HUB' | 'RECYCLER' | 'ADMIN';

interface RoleContextType {
  role: Role;
  setRole: (role: Role) => void;
}

export const RoleContext = createContext<RoleContextType>({ role: 'COLLECTOR', setRole: () => {} });

function RoleSwitcher() {
  const { role, setRole } = useContext(RoleContext);
  const navigate = useNavigate();

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRole = e.target.value as Role;
    setRole(newRole);
    if (newRole === 'ADMIN') navigate('/data');
    else if (newRole === 'HUB') navigate('/hub');
    else if (newRole === 'RECYCLER') navigate('/recycler');
    else navigate('/');
  };

  return (
    <div className="bg-gray-800 text-white p-2.5 flex justify-between items-center text-xs z-50 relative shadow-sm">
      <div className="flex items-center">
        <UserCircle size={15} className="mr-1.5 text-blue-400" />
        <span className="font-semibold text-gray-300">Active Role:</span>
      </div>
      <select 
        value={role} 
        onChange={handleRoleChange}
        className="bg-gray-700 border-none outline-none text-white rounded-lg px-2.5 py-1 font-bold text-xs cursor-pointer"
      >
        <option value="COLLECTOR">Informal Collector (Kabadiwala)</option>
        <option value="HUB">Collection Hub Operator</option>
        <option value="RECYCLER">Formal Recycler (CPCB)</option>
        <option value="ADMIN">Govt / Administrator</option>
      </select>
    </div>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { role } = useContext(RoleContext);

  const isActive = (path: string) => location.pathname === path ? 'text-blue-600 font-bold' : 'text-gray-500 hover:text-blue-600';

  return (
    <div className="flex flex-col h-screen bg-[#F1F4EF] text-[#14213D] max-w-md mx-auto shadow-2xl relative">
      <RoleSwitcher />
      
      <div className="flex-1 overflow-y-auto pb-20">
        {children}
      </div>
      
      {/* Bottom Navigation (RBAC Controlled) */}
      <div className="absolute bottom-0 w-full bg-white border-t border-gray-200 flex justify-around p-3 pb-6 z-40">
        
        {/* COLLECTOR NAV */}
        {role === 'COLLECTOR' && (
          <>
            <button onClick={() => navigate('/')} className={`flex flex-col items-center ${isActive('/')}`}>
              <Home size={22} />
              <span className="text-[11px] font-semibold mt-1">My Loads</span>
            </button>
            <button onClick={() => navigate('/prices')} className={`flex flex-col items-center ${isActive('/prices')}`}>
              <History size={22} />
              <span className="text-[11px] font-semibold mt-1">Prices</span>
            </button>
            <button onClick={() => navigate('/new')} className={`flex flex-col items-center ${isActive('/new')}`}>
              <PlusSquare size={22} />
              <span className="text-[11px] font-semibold mt-1">New Load</span>
            </button>
            <button onClick={() => navigate('/safety')} className={`flex flex-col items-center ${isActive('/safety')}`}>
              <ShieldCheck size={22} />
              <span className="text-[11px] font-semibold mt-1">Safety</span>
            </button>
          </>
        )}

        {/* HUB OPERATOR NAV */}
        {role === 'HUB' && (
          <>
            <button onClick={() => navigate('/hub')} className={`flex flex-col items-center ${isActive('/hub')}`}>
              <Building2 size={22} />
              <span className="text-[11px] font-semibold mt-1">Hub Intake</span>
            </button>
            <button onClick={() => navigate('/hub/shipments')} className={`flex flex-col items-center ${isActive('/hub/shipments')}`}>
              <Truck size={22} />
              <span className="text-[11px] font-semibold mt-1">Bulk Shipments</span>
            </button>
            <button onClick={() => navigate('/prices')} className={`flex flex-col items-center ${isActive('/prices')}`}>
              <History size={22} />
              <span className="text-[11px] font-semibold mt-1">Rate Card</span>
            </button>
          </>
        )}

        {/* RECYCLER NAV */}
        {role === 'RECYCLER' && (
          <>
            <button onClick={() => navigate('/recycler')} className={`flex flex-col items-center ${isActive('/recycler')}`}>
              <Scale size={22} />
              <span className="text-[11px] font-semibold mt-1">Gate Intake</span>
            </button>
            <button onClick={() => navigate('/prices')} className={`flex flex-col items-center ${isActive('/prices')}`}>
              <History size={22} />
              <span className="text-[11px] font-semibold mt-1">Market Rates</span>
            </button>
            <button onClick={() => navigate('/data')} className={`flex flex-col items-center ${isActive('/data')}`}>
              <Database size={22} />
              <span className="text-[11px] font-semibold mt-1">Audit Ledger</span>
            </button>
          </>
        )}

        {/* ADMIN NAV */}
        {role === 'ADMIN' && (
          <>
            <button onClick={() => navigate('/data')} className={`flex flex-col items-center ${isActive('/data')}`}>
              <Database size={22} />
              <span className="text-[11px] font-semibold mt-1">EPR Insights</span>
            </button>
            <button onClick={() => navigate('/hub')} className={`flex flex-col items-center ${isActive('/hub')}`}>
              <Building2 size={22} />
              <span className="text-[11px] font-semibold mt-1">Hubs</span>
            </button>
            <button onClick={() => navigate('/prices')} className={`flex flex-col items-center ${isActive('/prices')}`}>
              <History size={22} />
              <span className="text-[11px] font-semibold mt-1">Price Board</span>
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
            <Route path="/hub" element={<HubDashboardPage />} />
            <Route path="/hub/shipments" element={<ShipmentAggregationPage />} />
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
