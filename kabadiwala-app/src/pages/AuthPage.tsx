import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  register, 
  login, 
  type RegisterParams 
} from '../lib/authService';
import { 
  Building2, 
  Recycle, 
  ShieldCheck, 
  User, 
  Lock, 
  Mail, 
  AlertCircle, 
  CheckCircle2, 
  ShieldAlert,
  Sparkles
} from 'lucide-react';

const MATERIAL_CHOICES = [
  'Circuit Boards (PCB)',
  'Copper Cables',
  'Mobile Phones'
];

export default function AuthPage({ onAuthSuccess }: { onAuthSuccess?: () => void }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const roleParam = searchParams.get('role')?.toUpperCase();

  const [mode, setMode] = useState<'LOGIN' | 'REGISTER'>(tabParam === 'register' ? 'REGISTER' : 'LOGIN');
  
  // Registration form state
  const [role, setRole] = useState<'COLLECTOR' | 'HUB' | 'RECYCLER'>(
    roleParam === 'HUB' || roleParam === 'RECYCLER' ? roleParam : 'COLLECTOR'
  );

  useEffect(() => {
    if (tabParam === 'register') setMode('REGISTER');
    if (tabParam === 'login') setMode('LOGIN');
    if (roleParam === 'HUB' || roleParam === 'RECYCLER' || roleParam === 'COLLECTOR') {
      setRole(roleParam as any);
    }
  }, [tabParam, roleParam]);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  
  // Business fields (for Hub and Recycler)
  const [businessName, setBusinessName] = useState('');
  const [facilityAddress, setFacilityAddress] = useState('');
  const [district, setDistrict] = useState('Bengaluru Urban');
  const [operatingArea, setOperatingArea] = useState('');
  const [cpcbNumber, setCpcbNumber] = useState('');
  const [facilityScope, setFacilityScope] = useState('');
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([MATERIAL_CHOICES[0]]);

  // UI state
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const toggleMaterial = (mat: string) => {
    setSelectedMaterials(prev => 
      prev.includes(mat) ? prev.filter(m => m !== mat) : [...prev, mat]
    );
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    // Explicit security check
    if ((role as any) === 'ADMIN') {
      setErrorMsg('Security Restriction: Public registration cannot create Administrator accounts.');
      return;
    }

    setLoading(true);
    try {
      const params: RegisterParams = {
        fullName,
        email,
        phone,
        password,
        role,
        businessName: role !== 'COLLECTOR' ? businessName : undefined,
        facilityAddress: role !== 'COLLECTOR' ? facilityAddress : undefined,
        district: role !== 'COLLECTOR' ? district : undefined,
        operatingArea: role !== 'COLLECTOR' ? operatingArea : undefined,
        acceptedMaterials: role !== 'COLLECTOR' ? selectedMaterials : undefined,
        cpcbRegistrationNumber: role === 'RECYCLER' ? cpcbNumber : undefined,
        facilityScope: role !== 'COLLECTOR' ? facilityScope : undefined,
      };

      const session = await register(params);
      setSuccessMsg(`Welcome, ${session.user.fullName}! Your account has been created.`);
      if (onAuthSuccess) onAuthSuccess();

      setTimeout(() => {
        if (session.user.role === 'HUB' || session.user.role === 'RECYCLER') {
          navigate('/verification-status');
        } else {
          navigate('/');
        }
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const session = await login(email, password);
      setSuccessMsg(`Signed in as ${session.user.fullName} (${session.user.role})`);
      if (onAuthSuccess) onAuthSuccess();

      setTimeout(() => {
        if (session.user.role === 'ADMIN') {
          navigate('/admin/verifications');
        } else if (session.user.role === 'HUB') {
          navigate(session.verificationStatus === 'approved' ? '/hub' : '/verification-status');
        } else if (session.user.role === 'RECYCLER') {
          navigate(session.verificationStatus === 'approved' ? '/recycler' : '/verification-status');
        } else {
          navigate('/');
        }
      }, 800);
    } catch (err: any) {
      setErrorMsg(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  // Quick Demo Logins for Expo Evaluators
  const handleQuickDemoLogin = async (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setErrorMsg(null);
    setLoading(true);
    try {
      const session = await login(demoEmail, demoPass);
      if (onAuthSuccess) onAuthSuccess();
      if (session.user.role === 'ADMIN') navigate('/admin/verifications');
      else if (session.user.role === 'HUB') navigate('/hub');
      else if (session.user.role === 'RECYCLER') navigate('/recycler');
      else navigate('/');
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-8 pb-32">
      {/* Brand Header */}
      <div className="text-center mb-6">
        <div className="w-14 h-14 bg-[#166534] text-white rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-md">
          <Recycle size={30} />
        </div>
        <h1 className="text-2xl font-black text-[#1f2937]">Kabadiwala Connect</h1>
        <p className="text-xs text-[#64748b] mt-1">
          Role-Based Access Control & Formal Supply Chain Verification
        </p>
      </div>

      {/* Tabs */}
      <div className="flex bg-[#f1f5f9] p-1 rounded-xl mb-6 border border-[#e2e8f0]">
        <button
          type="button"
          onClick={() => { setMode('LOGIN'); setErrorMsg(null); }}
          className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition ${
            mode === 'LOGIN' ? 'bg-white text-[#166534] shadow-xs' : 'text-[#64748b] hover:text-[#1f2937]'
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => { setMode('REGISTER'); setErrorMsg(null); }}
          className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition ${
            mode === 'REGISTER' ? 'bg-white text-[#166534] shadow-xs' : 'text-[#64748b] hover:text-[#1f2937]'
          }`}
        >
          Create Account
        </button>
      </div>

      {errorMsg && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
          <AlertCircle size={16} className="flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="mb-4 p-3 bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl text-[#166534] text-xs flex items-center gap-2">
          <CheckCircle2 size={16} className="flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* ─── TAB 1: SIGN IN ─────────────────────────────────────── */}
      {mode === 'LOGIN' && (
        <div className="space-y-6">
          <form onSubmit={handleLogin} className="kc-card p-5 sm:p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#1f2937] mb-1.5">Email Address</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="kc-input pl-9 text-xs"
                />
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#1f2937] mb-1.5">Password</label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="kc-input pl-9 text-xs"
                />
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 text-xs"
            >
              {loading ? 'Authenticating…' : 'Sign In to Portal'}
            </button>
          </form>

          {/* Quick Demo Logins for Expo Jury */}
          <div className="kc-card p-4 sm:p-5 bg-[#f8fafc] border-dashed space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-[#166534]">
              <Sparkles size={14} />
              <span>Expo Demo Quick Access (Pre-seeded Roles)</span>
            </div>
            <p className="text-[11px] text-[#64748b]">
              Click any role to evaluate permissions, dashboards, and role gating instantly:
            </p>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleQuickDemoLogin('ramu@kabadiwala.in', 'Collector@123')}
                className="p-2.5 rounded-xl border border-[#e2e8f0] bg-white hover:border-[#166534] text-left transition"
              >
                <span className="font-bold text-[#166534] block">Collector</span>
                <span className="text-[10px] text-[#64748b]">Ramu Kabadiwala</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemoLogin('hub.east@kabadiwala.in', 'Hub@123')}
                className="p-2.5 rounded-xl border border-[#e2e8f0] bg-white hover:border-[#1d4ed8] text-left transition"
              >
                <span className="font-bold text-[#1d4ed8] block">Hub Operator</span>
                <span className="text-[10px] text-[#64748b]">Bengaluru East Godown</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemoLogin('recycler.green@kabadiwala.in', 'Recycler@123')}
                className="p-2.5 rounded-xl border border-[#e2e8f0] bg-white hover:border-[#7c3aed] text-left transition"
              >
                <span className="font-bold text-[#7c3aed] block">Formal Recycler</span>
                <span className="text-[10px] text-[#64748b]">Green Earth (CPCB)</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemoLogin('admin@kabadiwala.in', 'Admin@123')}
                className="p-2.5 rounded-xl border border-[#e2e8f0] bg-white hover:border-[#b45309] text-left transition"
              >
                <span className="font-bold text-[#b45309] block">Administrator</span>
                <span className="text-[10px] text-[#64748b]">CPCB State Reviewer</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2: REGISTER ────────────────────────────────────── */}
      {mode === 'REGISTER' && (
        <form onSubmit={handleRegister} className="kc-card p-5 sm:p-6 space-y-4">
          {/* Role Selection */}
          <div>
            <label className="block text-xs font-bold text-[#1f2937] mb-2">1. Select Account Type</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setRole('COLLECTOR')}
                className={`p-3 rounded-xl border-2 text-center transition flex flex-col items-center gap-1 ${
                  role === 'COLLECTOR' ? 'border-[#166534] bg-[#f0fdf4] text-[#166534]' : 'border-[#e2e8f0] bg-white text-[#64748b]'
                }`}
              >
                <User size={18} />
                <span className="text-xs font-bold leading-tight">Collector</span>
                <span className="text-[9px] text-[#64748b]">Instant access</span>
              </button>

              <button
                type="button"
                onClick={() => setRole('HUB')}
                className={`p-3 rounded-xl border-2 text-center transition flex flex-col items-center gap-1 ${
                  role === 'HUB' ? 'border-[#1d4ed8] bg-[#eff6ff] text-[#1d4ed8]' : 'border-[#e2e8f0] bg-white text-[#64748b]'
                }`}
              >
                <Building2 size={18} />
                <span className="text-xs font-bold leading-tight">Hub Depot</span>
                <span className="text-[9px] text-[#64748b]">Verification req.</span>
              </button>

              <button
                type="button"
                onClick={() => setRole('RECYCLER')}
                className={`p-3 rounded-xl border-2 text-center transition flex flex-col items-center gap-1 ${
                  role === 'RECYCLER' ? 'border-[#7c3aed] bg-[#f5f3ff] text-[#7c3aed]' : 'border-[#e2e8f0] bg-white text-[#64748b]'
                }`}
              >
                <Recycle size={18} />
                <span className="text-xs font-bold leading-tight">Recycler</span>
                <span className="text-[9px] text-[#64748b]">CPCB/SPCB req.</span>
              </button>
            </div>

            {/* Public Admin prevention disclaimer */}
            <div className="mt-2.5 p-2 bg-[#f8fafc] border border-[#e2e8f0] rounded-lg text-[10px] text-[#64748b] flex items-center gap-1.5">
              <ShieldAlert size={13} className="text-[#b45309] flex-shrink-0" />
              <span>Admin accounts cannot be self-selected and are provisioned via trusted setup.</span>
            </div>
          </div>

          {/* Basic User Information */}
          <div className="space-y-3 pt-1 border-t border-[#e2e8f0]">
            <div>
              <label className="block text-xs font-bold text-[#1f2937] mb-1">Full Legal Name *</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="e.g. Ramesh Kumar"
                className="kc-input text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#1f2937] mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="ramesh@example.com"
                  className="kc-input text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1f2937] mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+91 98450 XXXXX"
                  className="kc-input text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#1f2937] mb-1">Password *</label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className="kc-input text-xs"
              />
            </div>
          </div>

          {/* Conditional Business Verification Fields */}
          {role !== 'COLLECTOR' && (
            <div className="space-y-3 pt-3 border-t border-[#e2e8f0]">
              <div className="flex items-center gap-1.5 text-xs font-black text-[#1f2937]">
                <ShieldCheck size={14} className="text-[#166534]" />
                <span>Business Verification Application Details</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1f2937] mb-1">
                  {role === 'HUB' ? 'Hub / Scrap Business Name *' : 'Recycling Company Legal Name *'}
                </label>
                <input
                  type="text"
                  required
                  value={businessName}
                  onChange={e => setBusinessName(e.target.value)}
                  placeholder={role === 'HUB' ? 'e.g. North City Aggregation Godown' : 'e.g. EcoRecover E-Waste Pvt Ltd'}
                  className="kc-input text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1f2937] mb-1">Facility Address *</label>
                <input
                  type="text"
                  required
                  value={facilityAddress}
                  onChange={e => setFacilityAddress(e.target.value)}
                  placeholder="Plot/Godown No, Street, Industrial Area"
                  className="kc-input text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#1f2937] mb-1">District *</label>
                  <select
                    value={district}
                    onChange={e => setDistrict(e.target.value)}
                    className="kc-input text-xs"
                  >
                    <option value="Bengaluru Urban">Bengaluru Urban</option>
                    <option value="Bengaluru Rural">Bengaluru Rural</option>
                    <option value="Mysuru">Mysuru</option>
                    <option value="Pune">Pune</option>
                    <option value="Mumbai Suburban">Mumbai Suburban</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1f2937] mb-1">Operating Area</label>
                  <input
                    type="text"
                    value={operatingArea}
                    onChange={e => setOperatingArea(e.target.value)}
                    placeholder="e.g. Ward 54 / Peenya"
                    className="kc-input text-xs"
                  />
                </div>
              </div>

              {role === 'RECYCLER' && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-[#1f2937] mb-1">Official CPCB/SPCB Registration Number *</label>
                    <input
                      type="text"
                      required
                      value={cpcbNumber}
                      onChange={e => setCpcbNumber(e.target.value)}
                      placeholder="e.g. CPCB/EW-REG/2024/091"
                      className="kc-input text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#1f2937] mb-1">Facility Scope / Process Details</label>
                    <input
                      type="text"
                      value={facilityScope}
                      onChange={e => setFacilityScope(e.target.value)}
                      placeholder="e.g. Mechanical dismantling & hydrometallurgical extraction"
                      className="kc-input text-xs"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-bold text-[#1f2937] mb-1.5">Authorized Material Categories</label>
                <div className="flex flex-wrap gap-2">
                  {MATERIAL_CHOICES.map(mat => (
                    <button
                      key={mat}
                      type="button"
                      onClick={() => toggleMaterial(mat)}
                      className={`text-xs px-2.5 py-1.5 rounded-lg border font-semibold transition ${
                        selectedMaterials.includes(mat)
                          ? 'bg-[#166534] text-white border-[#166534]'
                          : 'bg-white text-[#64748b] border-[#e2e8f0]'
                      }`}
                    >
                      {mat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[10px] text-amber-800 space-y-1">
                <p className="font-bold">Verification Notice:</p>
                <p>
                  Hub and Recycler accounts start in <strong>pending_verification</strong> state. Restricted marketplace actions (accepting lots, creating shipments) require Administrator approval.
                </p>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3 text-xs mt-4"
          >
            {loading ? 'Creating Account…' : (
              role === 'COLLECTOR' ? 'Register as Collector' : 'Submit Application & Create Account'
            )}
          </button>
        </form>
      )}
    </div>
  );
}
