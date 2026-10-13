import React, { useEffect, useState, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import {
  Home, PlusSquare, ShieldCheck, Database, UserCircle,
  Building2, Truck, Scale, TrendingUp, Menu, X, Recycle, ChevronDown
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

interface RoleContextType { role: Role; setRole: (r: Role) => void; }
export const RoleContext = createContext<RoleContextType>({ role: 'COLLECTOR', setRole: () => {} });

// ─── Role metadata ────────────────────────────────────────────
const ROLE_META: Record<Role, { label: string; color: string; bg: string }> = {
  COLLECTOR: { label: 'Collector',   color: '#166534', bg: '#dcfce7' },
  HUB:       { label: 'Hub Operator',color: '#1d4ed8', bg: '#dbeafe' },
  RECYCLER:  { label: 'Recycler',    color: '#7c3aed', bg: '#ede9fe' },
  ADMIN:     { label: 'Admin / Govt',color: '#b45309', bg: '#fef3c7' },
};

// ─── Nav links per role ───────────────────────────────────────
const NAV_LINKS: Record<Role, { path: string; label: string; icon: React.ReactNode }[]> = {
  COLLECTOR: [
    { path: '/',       label: 'My Loads',  icon: <Home size={18}/> },
    { path: '/prices', label: 'Prices',    icon: <TrendingUp size={18}/> },
    { path: '/new',    label: 'New Load',  icon: <PlusSquare size={18}/> },
    { path: '/safety', label: 'Safety',    icon: <ShieldCheck size={18}/> },
  ],
  HUB: [
    { path: '/hub',           label: 'Hub Intake',    icon: <Building2 size={18}/> },
    { path: '/hub/shipments', label: 'Bulk Shipments',icon: <Truck size={18}/> },
    { path: '/prices',        label: 'Rate Card',     icon: <TrendingUp size={18}/> },
  ],
  RECYCLER: [
    { path: '/recycler', label: 'Gate Intake',  icon: <Scale size={18}/> },
    { path: '/prices',   label: 'Market Rates', icon: <TrendingUp size={18}/> },
    { path: '/data',     label: 'Audit Ledger', icon: <Database size={18}/> },
  ],
  ADMIN: [
    { path: '/data',   label: 'EPR Insights', icon: <Database size={18}/> },
    { path: '/hub',    label: 'Hubs',         icon: <Building2 size={18}/> },
    { path: '/prices', label: 'Price Board',  icon: <TrendingUp size={18}/> },
  ],
};

// ─── Sidebar (Desktop) ────────────────────────────────────────
function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { role, setRole } = useContext(RoleContext);
  const navigate = useNavigate();
  const location = useLocation();
  const links = NAV_LINKS[role];
  const meta = ROLE_META[role];

  const handleNav = (path: string) => { navigate(path); onClose(); };
  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const r = e.target.value as Role;
    setRole(r);
    const first = NAV_LINKS[r][0].path;
    navigate(first);
    onClose();
  };

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden" onClick={onClose}/>
      )}

      <aside className={`
        fixed top-0 left-0 h-full z-40 bg-white border-r border-[#e2e8f0]
        flex flex-col transition-transform duration-200 w-64
        ${open ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:flex
      `}>
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-[#e2e8f0]">
          <div className="w-9 h-9 rounded-xl bg-[#166534] flex items-center justify-center flex-shrink-0">
            <Recycle size={20} color="#ffffff"/>
          </div>
          <div>
            <p className="font-black text-[#1f2937] text-sm leading-tight">Kabadiwala</p>
            <p className="font-bold text-[#166534] text-xs">Connect</p>
          </div>
          <button onClick={onClose} className="ml-auto p-1 rounded-lg hover:bg-gray-100 lg:hidden">
            <X size={16} color="#64748b"/>
          </button>
        </div>

        {/* Role Switcher */}
        <div className="px-4 py-3 border-b border-[#e2e8f0]">
          <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider mb-1.5">Active Role</p>
          <div className="relative">
            <select
              value={role}
              onChange={handleRoleChange}
              className="w-full appearance-none px-3 py-2 pr-8 rounded-lg border border-[#e2e8f0] text-xs font-semibold text-[#1f2937] bg-white focus:outline-none focus:border-[#166534] cursor-pointer"
              style={{ borderLeftWidth: 3, borderLeftColor: meta.color }}
            >
              <option value="COLLECTOR">Informal Collector (Kabadiwala)</option>
              <option value="HUB">Collection Hub Operator</option>
              <option value="RECYCLER">Formal Recycler (CPCB)</option>
              <option value="ADMIN">Govt / Administrator</option>
            </select>
            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#64748b] pointer-events-none"/>
          </div>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <p className="section-label px-2 mb-2">{meta.label} Menu</p>
          {links.map(l => {
            const active = location.pathname === l.path || (l.path !== '/' && location.pathname.startsWith(l.path));
            return (
              <button
                key={l.path}
                onClick={() => handleNav(l.path)}
                className={`nav-link w-full text-left ${active ? 'active' : ''}`}
              >
                {l.icon}
                <span>{l.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-[#e2e8f0]">
          <p className="text-[10px] text-[#94a3b8] text-center font-mono">Offline-first · Dexie v4 · React 19</p>
        </div>
      </aside>
    </>
  );
}

// ─── Topbar ───────────────────────────────────────────────────
function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const { role } = useContext(RoleContext);
  const location = useLocation();
  const links = NAV_LINKS[role];
  const meta = ROLE_META[role];
  const current = links.find(l => l.path === location.pathname) || links[0];

  return (
    <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-[#e2e8f0] px-4 py-3 flex items-center gap-3 no-print">
      <button
        onClick={onMenuClick}
        className="p-2 rounded-lg hover:bg-gray-100 transition lg:hidden"
        aria-label="Open menu"
      >
        <Menu size={20} color="#1f2937"/>
      </button>

      {/* Mobile brand */}
      <div className="flex items-center gap-2 lg:hidden">
        <div className="w-7 h-7 rounded-lg bg-[#166534] flex items-center justify-center">
          <Recycle size={14} color="#fff"/>
        </div>
        <span className="font-black text-sm text-[#1f2937]">Kabadiwala Connect</span>
      </div>

      {/* Desktop page title */}
      <div className="hidden lg:flex items-center gap-2">
        <span className="text-[#64748b]">{current.icon}</span>
        <h1 className="text-base font-bold text-[#1f2937]">{current.label}</h1>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* Role badge */}
        <span className="badge text-[11px] hidden sm:inline-flex" style={{ background: meta.bg, color: meta.color }}>
          <UserCircle size={12}/>
          {meta.label}
        </span>
      </div>
    </header>
  );
}

// ─── Bottom Nav (Mobile only) ─────────────────────────────────
function BottomNav() {
  const { role } = useContext(RoleContext);
  const navigate = useNavigate();
  const location = useLocation();
  const links = NAV_LINKS[role];

  return (
    <nav className="fixed bottom-0 inset-x-0 z-20 bg-white/95 backdrop-blur border-t border-[#e2e8f0] flex lg:hidden no-print safe-area-inset-bottom">
      {links.map(l => {
        const active = location.pathname === l.path || (l.path !== '/' && location.pathname.startsWith(l.path));
        return (
          <button
            key={l.path}
            onClick={() => navigate(l.path)}
            className={`bottom-nav-item ${active ? 'active' : ''}`}
          >
            {l.icon}
            <span>{l.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

// ─── Main Layout ──────────────────────────────────────────────
function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-dvh bg-[#f8fafc] overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)}/>

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar onMenuClick={() => setSidebarOpen(true)}/>
        <main className="flex-1 overflow-y-auto pb-20 lg:pb-4">
          {children}
        </main>
      </div>

      <BottomNav/>
    </div>
  );
}

// ─── Root App ─────────────────────────────────────────────────
function App() {
  const [role, setRole] = useState<Role>('COLLECTOR');

  useEffect(() => {
    const handleOnline = async () => {
      try {
        const completedLots = await db.lots.where('status').equals('COMPLETED').toArray();
        if (completedLots.length > 0) await syncDataOnline(completedLots);
      } catch (err) {
        console.error('Background sync failed:', err);
      }
    };
    window.addEventListener('online', handleOnline);
    if (navigator.onLine) handleOnline();
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  return (
    <RoleContext.Provider value={{ role, setRole }}>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/"               element={<HomePage/>}/>
            <Route path="/new"            element={<NewLotPage/>}/>
            <Route path="/handover/:id"   element={<HandoverPage/>}/>
            <Route path="/hub"            element={<HubDashboardPage/>}/>
            <Route path="/hub/shipments"  element={<ShipmentAggregationPage/>}/>
            <Route path="/recycler"       element={<RecyclerPage/>}/>
            <Route path="/safety"         element={<SafetyPage/>}/>
            <Route path="/prices"         element={<PriceBoardPage/>}/>
            <Route path="/data"           element={<DataExportPage/>}/>
          </Routes>
        </Layout>
      </BrowserRouter>
    </RoleContext.Provider>
  );
}

export default App;
