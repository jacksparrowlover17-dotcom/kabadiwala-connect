import React, { useEffect, useState, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import {
  Home, PlusSquare, ShieldCheck, Database, UserCircle,
  Building2, Truck, Scale, TrendingUp, Menu, X, Recycle,
  LogIn, LogOut, Compass, WifiOff
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
import AuthPage from './pages/AuthPage';
import VerificationStatusPage from './pages/VerificationStatusPage';
import AdminVerificationPage from './pages/AdminVerificationPage';
import DestinationFinderPage from './pages/DestinationFinderPage';
import MyHandoversPage from './pages/MyHandoversPage';
import WelcomeLandingPage from './pages/WelcomeLandingPage';
import { syncDataOnline, pullLotsFromCloud } from './lib/supabase';
import { getCurrentSession, logout, type AuthSession } from './lib/authService';

export type Role = 'COLLECTOR' | 'HUB' | 'RECYCLER' | 'ADMIN';

interface RoleContextType { 
  role: Role; 
  setRole: (r: Role) => void;
  session: AuthSession | null;
  refreshSession: () => void;
}

export const RoleContext = createContext<RoleContextType>({ 
  role: 'COLLECTOR', 
  setRole: () => {},
  session: null,
  refreshSession: () => {}
});

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
    { path: '/',              label: 'My Loads',        icon: <Home size={18}/> },
    { path: '/find-partners', label: 'Find Facilities', icon: <Compass size={18}/> },
    { path: '/handovers',     label: 'Handovers',       icon: <Truck size={18}/> },
    { path: '/prices',        label: 'Prices',          icon: <TrendingUp size={18}/> },
    { path: '/new',           label: 'New Load',        icon: <PlusSquare size={18}/> },
    { path: '/safety',        label: 'Safety',          icon: <ShieldCheck size={18}/> },
  ],
  HUB: [
    { path: '/hub',                  label: 'Hub Intake',       icon: <Building2 size={18}/> },
    { path: '/hub/shipments',        label: 'Bulk Shipments',   icon: <Truck size={18}/> },
    { path: '/verification-status',  label: 'Business Status',  icon: <ShieldCheck size={18}/> },
    { path: '/prices',               label: 'Rate Card',        icon: <TrendingUp size={18}/> },
  ],
  RECYCLER: [
    { path: '/recycler',             label: 'Gate Intake',      icon: <Scale size={18}/> },
    { path: '/verification-status',  label: 'Business Status',  icon: <ShieldCheck size={18}/> },
    { path: '/prices',               label: 'Market Rates',     icon: <TrendingUp size={18}/> },
    { path: '/data',                 label: 'Audit Ledger',     icon: <Database size={18}/> },
  ],
  ADMIN: [
    { path: '/admin/verifications',  label: 'Verification Queue', icon: <ShieldCheck size={18}/> },
    { path: '/data',                 label: 'EPR Insights',      icon: <Database size={18}/> },
    { path: '/hub',                  label: 'Hubs',              icon: <Building2 size={18}/> },
    { path: '/prices',               label: 'Price Board',       icon: <TrendingUp size={18}/> },
  ],
};

const PUBLIC_NAV_LINKS: { path: string; label: string; icon: React.ReactNode }[] = [
  { path: '/',       label: 'Welcome Portal',   icon: <Home size={18}/> },
  { path: '/safety', label: 'Safety Guidelines', icon: <ShieldCheck size={18}/> },
  { path: '/login',  label: 'Sign In / Register', icon: <LogIn size={18}/> },
];

// ─── Sidebar (Desktop) ────────────────────────────────────────
function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { role, session, refreshSession } = useContext(RoleContext);
  const navigate = useNavigate();
  const location = useLocation();
  const links = session ? NAV_LINKS[role] : PUBLIC_NAV_LINKS;
  const meta = ROLE_META[role];

  const handleNav = (path: string) => { navigate(path); onClose(); };

  const handleLogout = () => {
    logout();
    refreshSession();
    navigate('/');
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

        {/* Account / Role Card */}
        {session ? (
          <div className="px-4 py-3 border-b border-[#e2e8f0]">
            <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider mb-1.5">Authenticated Account</p>
            <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 flex items-center gap-2.5">
              <div 
                className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs flex-shrink-0" 
                style={{ background: meta.bg, color: meta.color }}
              >
                {role.slice(0, 2)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-800 truncate">{session.user.fullName}</p>
                <p className="text-[10px] font-semibold" style={{ color: meta.color }}>{meta.label}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="px-4 py-3 border-b border-[#e2e8f0]">
            <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider mb-2">Access Portal</p>
            <div className="flex gap-2">
              <button
                onClick={() => { navigate('/login?tab=login'); onClose(); }}
                className="flex-1 py-1.5 px-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold text-center transition cursor-pointer"
              >
                Sign In
              </button>
              <button
                onClick={() => { navigate('/login?tab=register'); onClose(); }}
                className="flex-1 py-1.5 px-2 bg-white border border-emerald-700 text-emerald-800 hover:bg-emerald-50 rounded-lg text-xs font-bold text-center transition cursor-pointer"
              >
                Register
              </button>
            </div>
          </div>
        )}

        {/* Nav Links */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <p className="section-label px-2 mb-2">
            {session ? `${meta.label} Menu` : 'Public Menu'}
          </p>
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

        {/* Footer with Logout */}
        <div className="px-4 py-3 border-t border-[#e2e8f0] space-y-2">
          {session && (
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
            >
              <LogOut size={15} />
              <span>Sign Out</span>
            </button>
          )}
          <p className="text-[10px] text-[#94a3b8] text-center font-mono">Offline-first · Dexie v4 · React 19</p>
        </div>
      </aside>
    </>
  );
}

// ─── Topbar ───────────────────────────────────────────────────
function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const { role, session, refreshSession } = useContext(RoleContext);
  const location = useLocation();
  const navigate = useNavigate();
  const links = session ? NAV_LINKS[role] : PUBLIC_NAV_LINKS;
  const meta = ROLE_META[role];
  const current = links.find(l => l.path === location.pathname) || links[0];

  const handleSignOut = () => {
    logout();
    refreshSession();
    navigate('/');
  };

  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

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
      <div className="flex items-center gap-2 min-w-0 lg:hidden">
        <div className="w-7 h-7 rounded-lg bg-[#166534] flex items-center justify-center flex-shrink-0">
          <Recycle size={14} color="#fff"/>
        </div>
        <span className="font-black text-sm text-[#1f2937] truncate">Kabadiwala Connect</span>
      </div>

      {/* Desktop page title */}
      <div className="hidden lg:flex items-center gap-2">
        <span className="text-[#64748b]">{current.icon}</span>
        <h1 className="text-base font-bold text-[#1f2937]">{current.label}</h1>
      </div>

      <div className="ml-auto flex items-center gap-2 flex-shrink-0">
        {!isOnline && (
          <span 
            className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1 shadow-2xs"
            title="App is operating in Offline-First mode. Data is stored safely in local IndexedDB."
          >
            <WifiOff size={11} className="text-amber-700" />
            <span>Offline</span>
          </span>
        )}
        {session ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(session.user.role === 'COLLECTOR' ? '/' : '/verification-status')}
              className="badge text-[11px] hover:opacity-80 transition cursor-pointer"
              style={{ background: meta.bg, color: meta.color }}
              title="View account profile"
            >
              <UserCircle size={12}/>
              <span>{session.user.fullName || meta.label}</span>
              {session.verificationStatus && session.verificationStatus !== 'active' && (
                <span className="ml-1 px-1 py-0.2 rounded bg-white/70 text-[9px] uppercase font-bold">
                  {session.verificationStatus.replace('_', ' ')}
                </span>
              )}
            </button>
            <button
              onClick={handleSignOut}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
              title="Sign Out"
            >
              <LogOut size={14} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/login?tab=login')}
              className="px-2.5 py-1 text-xs font-semibold border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg flex items-center gap-1 transition cursor-pointer"
            >
              <LogIn size={13} />
              <span>Sign In</span>
            </button>
            <button
              onClick={() => navigate('/login?tab=register')}
              className="px-2.5 py-1 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg flex items-center gap-1 transition cursor-pointer"
            >
              <span className="hidden sm:inline">Register</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

// ─── Bottom Nav (Mobile only) ─────────────────────────────────
function BottomNav() {
  const { role, session } = useContext(RoleContext);
  const navigate = useNavigate();
  const location = useLocation();
  const links = session ? NAV_LINKS[role] : PUBLIC_NAV_LINKS;

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

// ─── Protected Route Guard ────────────────────────────────────
function ProtectedRoute({ 
  allowedRoles, 
  children 
}: { 
  allowedRoles?: Role[]; 
  children: React.ReactNode; 
}) {
  const session = getCurrentSession();
  const location = useLocation();

  if (!session) {
    return <Navigate to="/login?tab=login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(session.user.role as Role)) {
    const userRole = session.user.role as Role;
    let target = '/';
    if (userRole === 'ADMIN') target = '/admin/verifications';
    else if (userRole === 'HUB') target = session.verificationStatus === 'approved' ? '/hub' : '/verification-status';
    else if (userRole === 'RECYCLER') target = session.verificationStatus === 'approved' ? '/recycler' : '/verification-status';

    return <Navigate to={target} replace />;
  }

  return <>{children}</>;
}

// ─── Root Index Route (Landing or Collector Home) ─────────────
function RootIndexRoute() {
  const session = getCurrentSession();

  if (!session) {
    return <WelcomeLandingPage />;
  }

  if (session.user.role === 'COLLECTOR') {
    return <HomePage />;
  }
  if (session.user.role === 'HUB') {
    return <Navigate to={session.verificationStatus === 'approved' ? "/hub" : "/verification-status"} replace />;
  }
  if (session.user.role === 'RECYCLER') {
    return <Navigate to={session.verificationStatus === 'approved' ? "/recycler" : "/verification-status"} replace />;
  }
  if (session.user.role === 'ADMIN') {
    return <Navigate to="/admin/verifications" replace />;
  }

  return <WelcomeLandingPage />;
}

// ─── Root App ─────────────────────────────────────────────────
function App() {
  const [session, setSession] = useState<AuthSession | null>(() => getCurrentSession());
  const role: Role = (session?.user?.role as Role) || 'COLLECTOR';

  const refreshSession = () => {
    setSession(getCurrentSession());
  };

  const setRole = (_r: Role) => {
    // If admin, can view preview
    if (session?.user?.role === 'ADMIN') {
      // Allowed for admin review
    }
  };

  useEffect(() => {
    const handleOnline = async () => {
      try {
        console.log('Online detected. Synchronizing offline data to cloud...');
        await syncDataOnline();
        await pullLotsFromCloud();
      } catch (err) {
        console.error('Background sync failed:', err);
      }
    };
    window.addEventListener('online', handleOnline);
    if (navigator.onLine) handleOnline();
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  return (
    <RoleContext.Provider value={{ role, setRole, session, refreshSession }}>
      <BrowserRouter>
        <Layout>
          <Routes>
            {/* Public Entry Points */}
            <Route path="/"                    element={<RootIndexRoute/>}/>
            <Route path="/welcome"             element={<WelcomeLandingPage/>}/>
            <Route path="/login"               element={<AuthPage onAuthSuccess={refreshSession}/>}/>
            <Route path="/safety"              element={<SafetyPage/>}/>

            {/* Protected: Informal Collector Screens */}
            <Route path="/loads"               element={<ProtectedRoute allowedRoles={['COLLECTOR', 'ADMIN']}><HomePage/></ProtectedRoute>}/>
            <Route path="/new"                 element={<ProtectedRoute allowedRoles={['COLLECTOR', 'ADMIN']}><NewLotPage/></ProtectedRoute>}/>
            <Route path="/find-partners"       element={<ProtectedRoute allowedRoles={['COLLECTOR', 'ADMIN']}><DestinationFinderPage/></ProtectedRoute>}/>
            <Route path="/handovers"           element={<ProtectedRoute allowedRoles={['COLLECTOR', 'ADMIN']}><MyHandoversPage/></ProtectedRoute>}/>
            <Route path="/handover/:id"        element={<ProtectedRoute allowedRoles={['COLLECTOR', 'ADMIN']}><HandoverPage/></ProtectedRoute>}/>

            {/* Protected: Hub Screens */}
            <Route path="/hub"                 element={<ProtectedRoute allowedRoles={['HUB', 'ADMIN']}><HubDashboardPage/></ProtectedRoute>}/>
            <Route path="/hub/shipments"       element={<ProtectedRoute allowedRoles={['HUB', 'ADMIN']}><ShipmentAggregationPage/></ProtectedRoute>}/>

            {/* Protected: Formal Recycler Screens */}
            <Route path="/recycler"            element={<ProtectedRoute allowedRoles={['RECYCLER', 'ADMIN']}><RecyclerPage/></ProtectedRoute>}/>

            {/* Protected: Administrator Screens */}
            <Route path="/admin/verifications" element={<ProtectedRoute allowedRoles={['ADMIN']}><AdminVerificationPage/></ProtectedRoute>}/>

            {/* Protected: Common Authenticated Screens */}
            <Route path="/prices"              element={<ProtectedRoute allowedRoles={['COLLECTOR', 'HUB', 'RECYCLER', 'ADMIN']}><PriceBoardPage/></ProtectedRoute>}/>
            <Route path="/data"                element={<ProtectedRoute allowedRoles={['ADMIN', 'RECYCLER']}><DataExportPage/></ProtectedRoute>}/>
            <Route path="/verification-status" element={<ProtectedRoute allowedRoles={['HUB', 'RECYCLER', 'ADMIN']}><VerificationStatusPage/></ProtectedRoute>}/>

            {/* Catch-all */}
            <Route path="*"                    element={<Navigate to="/" replace/>}/>
          </Routes>
        </Layout>
      </BrowserRouter>
    </RoleContext.Provider>
  );
}

export default App;
