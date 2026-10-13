import { useNavigate } from 'react-router-dom';
import {
  Recycle,
  ShieldCheck,
  Truck,
  Building2,
  CheckCircle2,
  ArrowRight,
  LogIn,
  UserPlus,
  Scale,
  Leaf,
  Lock,
  FileCheck2,
  Download
} from 'lucide-react';
import { getCurrentSession } from '../lib/authService';

export default function WelcomeLandingPage() {
  const navigate = useNavigate();
  const session = getCurrentSession();

  // If already authenticated, redirect to role dashboard
  const handleEnterDashboard = () => {
    if (!session) {
      navigate('/login?tab=login');
      return;
    }
    const role = session.user.role;
    if (role === 'ADMIN') navigate('/admin/verifications');
    else if (role === 'HUB') navigate(session.verificationStatus === 'approved' ? '/hub' : '/verification-status');
    else if (role === 'RECYCLER') navigate(session.verificationStatus === 'approved' ? '/recycler' : '/verification-status');
    else navigate('/loads');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Top Banner / Hero */}
      <section className="bg-gradient-to-b from-emerald-900 via-emerald-800 to-emerald-900 text-white pt-10 pb-16 px-4 sm:px-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-700/60 border border-emerald-500/30 text-emerald-200 text-xs font-semibold mb-6">
            <Leaf size={14} className="text-emerald-300" />
            <span>Digital E-Waste Supply Chain & EPR Traceability</span>
          </div>

          <div className="w-16 h-16 rounded-2xl bg-emerald-600/80 border border-emerald-400/40 flex items-center justify-center mx-auto mb-4 shadow-xl">
            <Recycle size={34} className="text-white" />
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight mb-4">
            Kabadiwala <span className="text-emerald-300">Connect</span>
          </h1>

          <p className="text-base sm:text-lg text-emerald-100/90 max-w-2xl mx-auto font-normal leading-relaxed mb-8">
            Bringing the informal waste collector into the formal recycling value chain with transparent pricing, verified aggregation hubs, and end-to-end EPR compliance.
          </p>

          {/* Primary Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 max-w-lg mx-auto">
            {session ? (
              <button
                onClick={handleEnterDashboard}
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-emerald-950 font-bold text-sm shadow-lg flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <span>Go to My Dashboard ({session.user.role})</span>
                <ArrowRight size={16} />
              </button>
            ) : (
              <>
                <button
                  onClick={() => navigate('/login?tab=register')}
                  className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-emerald-950 font-bold text-sm shadow-lg flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <UserPlus size={16} />
                  <span>Register Account</span>
                </button>
                <button
                  onClick={() => navigate('/login?tab=login')}
                  className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/30 text-white font-bold text-sm backdrop-blur flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <LogIn size={16} />
                  <span>Sign In</span>
                </button>
              </>
            )}
            <a
              href="/kabadiwala-connect-latest.apk"
              download="kabadiwala-connect-latest.apk"
              className="w-full sm:w-auto px-5 py-3.5 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-400/40 text-emerald-300 font-bold text-sm backdrop-blur flex items-center justify-center gap-2 transition cursor-pointer shadow-md"
            >
              <Download size={16} />
              <span>Download APK (4.7 MB)</span>
            </a>
          </div>
        </div>
      </section>

      {/* Participant Roles Section */}
      <section className="max-w-5xl mx-auto px-4 -mt-8 relative z-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Informal Collector */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-md hover:shadow-lg transition">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center mb-4">
              <Truck size={24} />
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-1">Informal Collector</h2>
            <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-2">Kabadiwala</p>
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Log collected electronic scrap, compare transparent buying rates, book drop-offs at certified hubs, and receive instant digital scale intake receipts.
            </p>
            <ul className="text-xs text-slate-600 space-y-1.5 mb-5 border-t border-slate-100 pt-3">
              <li className="flex items-center gap-1.5"><CheckCircle2 size={13} className="text-emerald-600 flex-shrink-0" /> Photo-documented lot logging</li>
              <li className="flex items-center gap-1.5"><CheckCircle2 size={13} className="text-emerald-600 flex-shrink-0" /> Real-time rate comparisons</li>
              <li className="flex items-center gap-1.5"><CheckCircle2 size={13} className="text-emerald-600 flex-shrink-0" /> Multi-language voice guidance</li>
            </ul>
            <button
              onClick={() => navigate('/login?role=COLLECTOR&tab=register')}
              className="w-full py-2 px-3 text-xs font-bold rounded-lg border border-emerald-600 text-emerald-700 hover:bg-emerald-50 transition cursor-pointer"
            >
              Register as Collector
            </button>
          </div>

          {/* Card 2: Collection Hub */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-md hover:shadow-lg transition">
            <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center mb-4">
              <Building2 size={24} />
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-1">Collection Hub</h2>
            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-2">Aggregation Facility</p>
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Accept material from local collectors, record digital scale intake, manage binding rate cards, and aggregate lots for bulk dispatch to formal recyclers.
            </p>
            <ul className="text-xs text-slate-600 space-y-1.5 mb-5 border-t border-slate-100 pt-3">
              <li className="flex items-center gap-1.5"><CheckCircle2 size={13} className="text-blue-600 flex-shrink-0" /> Weighbridge scale calibration</li>
              <li className="flex items-center gap-1.5"><CheckCircle2 size={13} className="text-blue-600 flex-shrink-0" /> Bulk shipment aggregation</li>
              <li className="flex items-center gap-1.5"><CheckCircle2 size={13} className="text-blue-600 flex-shrink-0" /> Official state CPCB verification</li>
            </ul>
            <button
              onClick={() => navigate('/login?role=HUB&tab=register')}
              className="w-full py-2 px-3 text-xs font-bold rounded-lg border border-blue-600 text-blue-700 hover:bg-blue-50 transition cursor-pointer"
            >
              Register as Collection Hub
            </button>
          </div>

          {/* Card 3: Formal Recycler */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-md hover:shadow-lg transition">
            <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center mb-4">
              <Scale size={24} />
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-1">Formal Recycler</h2>
            <p className="text-xs font-semibold text-purple-700 uppercase tracking-wider mb-2">CPCB Registered</p>
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Verify gate intake of bulk shipments with Form 6 manifest codes, audit SHA-256 tamper-proof chain of custody, and generate EPR compliance certificates.
            </p>
            <ul className="text-xs text-slate-600 space-y-1.5 mb-5 border-t border-slate-100 pt-3">
              <li className="flex items-center gap-1.5"><CheckCircle2 size={13} className="text-purple-600 flex-shrink-0" /> Form 6 transit manifest audit</li>
              <li className="flex items-center gap-1.5"><CheckCircle2 size={13} className="text-purple-600 flex-shrink-0" /> SHA-256 cryptographic hashes</li>
              <li className="flex items-center gap-1.5"><CheckCircle2 size={13} className="text-purple-600 flex-shrink-0" /> CPCB EPR quota fulfilment</li>
            </ul>
            <button
              onClick={() => navigate('/login?role=RECYCLER&tab=register')}
              className="w-full py-2 px-3 text-xs font-bold rounded-lg border border-purple-600 text-purple-700 hover:bg-purple-50 transition cursor-pointer"
            >
              Register as Recycler
            </button>
          </div>
        </div>
      </section>

      {/* Trust & Verification Workflow Summary */}
      <section className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <ShieldCheck size={26} className="text-emerald-700" />
            <h3 className="text-lg font-bold text-slate-900">Three-Tier Role Verification & Security</h3>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-6">
            To prevent fraud and maintain regulatory standards under India’s E-Waste (Management) Rules, all commercial hub and recycler facilities undergo strict administrative vetting before buying privileges are granted.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="font-bold text-slate-900 block mb-1">1. Registration Gate</span>
              <span className="text-slate-600">Choose participant type with structured facility and licensing metadata.</span>
            </div>
            <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80">
              <span className="font-bold text-amber-900 block mb-1">2. Admin Approval</span>
              <span className="text-amber-800">State pollution board admin reviews fire NOC, site photos, and registry IDs.</span>
            </div>
            <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80">
              <span className="font-bold text-emerald-900 block mb-1">3. Verified Trading</span>
              <span className="text-emerald-800">Approved facilities broadcast live buying offers and issue verified receipts.</span>
            </div>
          </div>
        </div>
      </section>

      {/* Safety & Public Guidance Footer Banner */}
      <footer className="border-t border-slate-200 bg-white py-8 px-4 text-center">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs text-slate-500 mb-3">
            Kabadiwala Connect Prototype · College Expo 2026 · TechChallengers1817
          </p>
          <div className="flex items-center justify-center gap-4 text-xs font-semibold text-emerald-700">
            <button onClick={() => navigate('/safety')} className="hover:underline flex items-center gap-1 cursor-pointer">
              <FileCheck2 size={13} />
              <span>Safety & Handling Guidelines</span>
            </button>
            <span className="text-slate-300">·</span>
            <button onClick={() => navigate('/login')} className="hover:underline flex items-center gap-1 cursor-pointer">
              <Lock size={13} />
              <span>Authorized Sign In</span>
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
