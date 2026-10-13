import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldAlert, Clock, CheckCircle2, XCircle, AlertCircle,
  FileText, Building2, RefreshCw, Send, ArrowRight, LogOut,
  MapPin, AlertTriangle
} from 'lucide-react';
import {
  getCurrentSession,
  resubmitVerification,
  logout,
  type AuthSession
} from '../lib/authService';
import { db, type VerificationStatus, type VerificationApplication } from '../lib/db';

const MATERIAL_OPTIONS = [
  'Circuit Boards (PCB)',
  'Smartphones & Handhelds',
  'Laptop & Desktop Computers',
  'Lithium-ion Batteries',
  'Copper Cabling & Yokes',
  'CRT & Display Units',
  'Mixed Electronic Scrap'
];

const STATUS_CONFIG: Record<VerificationStatus, {
  label: string;
  badgeBg: string;
  badgeColor: string;
  icon: React.ReactNode;
  summary: string;
}> = {
  pending_verification: {
    label: 'Pending Verification',
    badgeBg: '#fef3c7',
    badgeColor: '#b45309',
    icon: <Clock size={24} className="text-amber-500 animate-pulse" />,
    summary: 'Your business registration has been received and is waiting in the administrative verification queue.'
  },
  under_review: {
    label: 'Under Active Review',
    badgeBg: '#dbeafe',
    badgeColor: '#1d4ed8',
    icon: <Clock size={24} className="text-blue-600" />,
    summary: 'An authorized regulator or administrative reviewer is currently cross-referencing your facility documentation.'
  },
  changes_requested: {
    label: 'Changes Requested',
    badgeBg: '#ffedd5',
    badgeColor: '#c2410c',
    icon: <AlertCircle size={24} className="text-orange-600" />,
    summary: 'The administrative reviewer requested specific corrections or additional documentation before approval.'
  },
  approved: {
    label: 'Officially Verified & Approved',
    badgeBg: '#dcfce7',
    badgeColor: '#166534',
    icon: <CheckCircle2 size={24} className="text-emerald-600" />,
    summary: 'Your business credentials and facility scope have been verified. Marketplace and operational features are fully enabled.'
  },
  rejected: {
    label: 'Application Rejected',
    badgeBg: '#fee2e2',
    badgeColor: '#b91c1c',
    icon: <XCircle size={24} className="text-rose-600" />,
    summary: 'Your verification request could not be approved based on the submitted credentials. You may revise and resubmit.'
  },
  suspended: {
    label: 'Account Suspended',
    badgeBg: '#f1f5f9',
    badgeColor: '#475569',
    icon: <ShieldAlert size={24} className="text-slate-600" />,
    summary: 'Operational access has been suspended pending regulatory compliance or safety re-certification.'
  },
  expired: {
    label: 'Verification Expired',
    badgeBg: '#fef3c7',
    badgeColor: '#92400e',
    icon: <AlertTriangle size={24} className="text-amber-600" />,
    summary: 'Your facility authorization certificate or consent window has passed its expiration date. Renewal required.'
  }
};

export default function VerificationStatusPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<AuthSession | null>(getCurrentSession());
  const [application, setApplication] = useState<VerificationApplication | null>(null);
  const [loading, setLoading] = useState(true);

  // Resubmission form state
  const [businessName, setBusinessName] = useState('');
  const [facilityAddress, setFacilityAddress] = useState('');
  const [district, setDistrict] = useState('Bengaluru Urban');
  const [operatingArea, setOperatingArea] = useState('');
  const [cpcbRegNumber, setCpcbRegNumber] = useState('');
  const [facilityScope, setFacilityScope] = useState('');
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadData = async () => {
    setLoading(true);
    const curr = getCurrentSession();
    setSession(curr);

    if (!curr) {
      setLoading(false);
      return;
    }

    if (curr.businessProfile) {
      setBusinessName(curr.businessProfile.businessName || '');
      setFacilityAddress(curr.businessProfile.facilityAddress || '');
      setDistrict(curr.businessProfile.district || 'Bengaluru Urban');
      setOperatingArea(curr.businessProfile.operatingArea || '');
      setCpcbRegNumber(curr.businessProfile.cpcbRegistrationNumber || '');
      setFacilityScope(curr.businessProfile.facilityScope || '');
      setSelectedMaterials(curr.businessProfile.acceptedMaterials || []);

      const app = await db.verificationApplications
        .where('businessProfileId')
        .equals(curr.businessProfile.id)
        .first();
      setApplication(app || null);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleMaterialToggle = (mat: string) => {
    setSelectedMaterials(prev =>
      prev.includes(mat) ? prev.filter(m => m !== mat) : [...prev, mat]
    );
  };

  const handleResubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !session.businessProfile) return;
    setErrorMsg('');
    setSuccessMsg('');

    if (!businessName.trim() || !facilityAddress.trim()) {
      setErrorMsg('Business name and facility address are mandatory.');
      return;
    }

    try {
      setSubmitting(true);
      await resubmitVerification({
        userId: session.user.id,
        role: session.user.role as 'HUB' | 'RECYCLER',
        businessName,
        facilityAddress,
        district,
        operatingArea,
        acceptedMaterials: selectedMaterials,
        cpcbRegistrationNumber: cpcbRegNumber,
        facilityScope,
      });

      setSuccessMsg('Your revised application has been resubmitted successfully. It is now under active review.');
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Resubmission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <RefreshCw className="animate-spin text-emerald-600 mx-auto mb-2" size={32} />
          <p className="text-sm text-slate-500 font-medium">Checking verification registry...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 text-center">
        <Building2 className="mx-auto text-slate-400 mb-3" size={48} />
        <h2 className="text-lg font-bold text-slate-800 mb-2">No Active Session</h2>
        <p className="text-sm text-slate-600 mb-6">
          Please sign in to track your facility's business verification status.
        </p>
        <button
          onClick={() => navigate('/login')}
          className="btn-primary w-full py-2.5 font-semibold text-sm"
        >
          Go to Sign In
        </button>
      </div>
    );
  }

  // If user is collector or admin, they do not have a separate business status
  if (session.user.role === 'COLLECTOR') {
    return (
      <div className="max-w-lg mx-auto px-4 py-10">
        <div className="card p-6 text-center border-emerald-200 bg-emerald-50/50">
          <CheckCircle2 className="mx-auto text-emerald-600 mb-3" size={44} />
          <h2 className="text-lg font-bold text-slate-800">Collector Account Active</h2>
          <p className="text-sm text-slate-600 mt-2 mb-6">
            Informal Collectors have immediate operational access. You can log loads, receive digital weigh slips, and track hub cash settlements.
          </p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => navigate('/')} className="btn-primary text-xs py-2 px-4">
              Go to My Loads
            </button>
            <button onClick={handleLogout} className="btn-secondary text-xs py-2 px-4">
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  const status = (session.verificationStatus as VerificationStatus) || 'pending_verification';
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending_verification;
  const canEditAndResubmit = status === 'changes_requested' || status === 'rejected' || status === 'expired';

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
              style={{ background: cfg.badgeBg, color: cfg.badgeColor }}
            >
              {session.user.role} Business Application
            </span>
            <span className="text-xs text-slate-400 font-mono">
              ID: {session.businessProfile?.id || 'N/A'}
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-1">
            {session.businessProfile?.businessName || 'Business Verification'}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 text-xs flex items-center gap-1.5 transition"
            title="Refresh Status"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
          <button
            onClick={handleLogout}
            className="p-2 border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-lg text-xs flex items-center gap-1.5 transition"
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      </div>

      {/* Status Hero Card */}
      <div
        className="mt-6 rounded-2xl p-6 border transition-all"
        style={{
          backgroundColor: cfg.badgeBg + '33',
          borderColor: cfg.badgeColor + '44'
        }}
      >
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-white shadow-sm border border-slate-100 flex-shrink-0">
            {cfg.icon}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-bold text-slate-900">{cfg.label}</h2>
              <span
                className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: cfg.badgeBg, color: cfg.badgeColor }}
              >
                {status.replace('_', ' ').toUpperCase()}
              </span>
            </div>
            <p className="text-sm text-slate-600 mt-1">{cfg.summary}</p>
          </div>
        </div>

        {/* Feedback / Reason Banner */}
        {(application?.rejectionReason || application?.correctionRequests) && (
          <div className="mt-4 p-4 rounded-xl bg-white border border-rose-200 text-sm">
            <div className="flex items-center gap-2 text-rose-700 font-bold mb-1">
              <AlertCircle size={16} />
              <span>Official Reviewer Remarks / Required Action:</span>
            </div>
            <p className="text-slate-800 bg-rose-50/70 p-3 rounded-lg border border-rose-100 font-medium">
              "{application.rejectionReason || application.correctionRequests}"
            </p>
            {application.reviewedAt && (
              <p className="text-[11px] text-slate-400 mt-2 font-mono">
                Reviewed on: {new Date(application.reviewedAt).toLocaleString('en-IN')}
              </p>
            )}
          </div>
        )}

        {/* Official Registry Reference (Approved only) */}
        {status === 'approved' && application?.officialRegistryRef && (
          <div className="mt-4 p-3 rounded-xl bg-white border border-emerald-200 text-xs flex items-center justify-between">
            <div>
              <span className="font-semibold text-slate-500">Official Registry Grant / CPCB Clearance:</span>
              <p className="font-mono font-bold text-emerald-800 text-sm mt-0.5">
                {application.officialRegistryRef}
              </p>
            </div>
            <div className="text-right text-[11px] text-slate-400">
              Verified: {application.reviewedAt ? new Date(application.reviewedAt).toLocaleDateString('en-IN') : 'Certified'}
            </div>
          </div>
        )}
      </div>

      {/* Action Shortcut for Approved Users */}
      {status === 'approved' && (
        <div className="mt-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-emerald-900 text-sm">Operational Features Unlocked</h3>
            <p className="text-xs text-emerald-700 mt-0.5">
              {session.user.role === 'HUB'
                ? 'You can now accept informal collector lots, issue weight receipts, and dispatch bulk shipments.'
                : 'Your facility is registered on the marketplace and authorized to accept bulk Form-6 cargo shipments.'}
            </p>
          </div>
          <button
            onClick={() => navigate(session.user.role === 'HUB' ? '/hub' : '/recycler')}
            className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5 flex-shrink-0"
          >
            Launch Operations <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* Submitted Details Review */}
      <div className="mt-8 card p-6 border-slate-200">
        <h3 className="font-bold text-slate-800 text-sm border-b pb-3 mb-4 flex items-center gap-2">
          <FileText size={16} className="text-slate-500" />
          Registered Facility Profile & Authorization Scope
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-slate-400 font-medium">Business / Facility Name</span>
            <p className="font-semibold text-slate-800 mt-0.5">{session.businessProfile?.businessName}</p>
          </div>
          <div>
            <span className="text-slate-400 font-medium">Authorized Contact Person</span>
            <p className="font-semibold text-slate-800 mt-0.5">{session.businessProfile?.authorizedContact}</p>
          </div>
          <div className="md:col-span-2">
            <span className="text-slate-400 font-medium">Facility Address</span>
            <p className="font-semibold text-slate-800 mt-0.5 flex items-center gap-1">
              <MapPin size={12} className="text-slate-400" />
              {session.businessProfile?.facilityAddress}, {session.businessProfile?.district}
            </p>
          </div>
          {session.businessProfile?.cpcbRegistrationNumber && (
            <div>
              <span className="text-slate-400 font-medium">CPCB / SPCB Authorization #</span>
              <p className="font-mono font-semibold text-slate-800 mt-0.5">{session.businessProfile?.cpcbRegistrationNumber}</p>
            </div>
          )}
          {session.businessProfile?.operatingArea && (
            <div>
              <span className="text-slate-400 font-medium">Operating Cluster / Catchment</span>
              <p className="font-semibold text-slate-800 mt-0.5">{session.businessProfile?.operatingArea}</p>
            </div>
          )}
          <div className="md:col-span-2">
            <span className="text-slate-400 font-medium">Permitted Material Scope</span>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {(session.businessProfile?.acceptedMaterials || []).map(mat => (
                <span key={mat} className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-medium text-[11px]">
                  {mat}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Resubmission Section (When Changes Requested or Rejected) */}
      {canEditAndResubmit && (
        <div className="mt-8 card p-6 border-orange-200 bg-orange-50/20">
          <div className="flex items-center gap-2 mb-2">
            <RefreshCw size={18} className="text-orange-600" />
            <h3 className="font-bold text-slate-900 text-sm">
              Update & Resubmit Verification Application
            </h3>
          </div>
          <p className="text-xs text-slate-600 mb-6">
            Correct the identified discrepancies based on the reviewer's feedback. Resubmitting places your application back in the queue for re-evaluation.
          </p>

          {errorMsg && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs font-semibold">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-semibold">
              {successMsg}
            </div>
          )}

          <form onSubmit={handleResubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Business / Hub Name *</label>
                <input
                  type="text"
                  value={businessName}
                  onChange={e => setBusinessName(e.target.value)}
                  className="input text-xs"
                  required
                />
              </div>

              <div>
                <label className="label">District *</label>
                <select
                  value={district}
                  onChange={e => setDistrict(e.target.value)}
                  className="input text-xs"
                >
                  <option value="Bengaluru Urban">Bengaluru Urban</option>
                  <option value="Bengaluru Rural">Bengaluru Rural</option>
                  <option value="Chennai">Chennai</option>
                  <option value="Hyderabad">Hyderabad</option>
                  <option value="Mumbai Suburban">Mumbai Suburban</option>
                  <option value="Pune">Pune</option>
                  <option value="Delhi NCR">Delhi NCR</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="label">Facility Physical Address *</label>
                <input
                  type="text"
                  value={facilityAddress}
                  onChange={e => setFacilityAddress(e.target.value)}
                  className="input text-xs"
                  required
                />
              </div>

              {session.user.role === 'HUB' && (
                <div className="md:col-span-2">
                  <label className="label">Operating Catchment / Collection Radius</label>
                  <input
                    type="text"
                    value={operatingArea}
                    onChange={e => setOperatingArea(e.target.value)}
                    placeholder="e.g., Peenya Industrial Cluster & Yeshwanthpur"
                    className="input text-xs"
                  />
                </div>
              )}

              {session.user.role === 'RECYCLER' && (
                <>
                  <div>
                    <label className="label">CPCB / SPCB Registration Number *</label>
                    <input
                      type="text"
                      value={cpcbRegNumber}
                      onChange={e => setCpcbRegNumber(e.target.value)}
                      placeholder="e.g. CPCB/EPR-2024/REC-901"
                      className="input text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="label">Consent to Operate (CTO) Scope</label>
                    <input
                      type="text"
                      value={facilityScope}
                      onChange={e => setFacilityScope(e.target.value)}
                      placeholder="e.g. Pyrometallurgical e-waste recovery (150 MT/month)"
                      className="input text-xs"
                    />
                  </div>
                </>
              )}
            </div>

            <div>
              <label className="label mb-2">Permitted Material Categories</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {MATERIAL_OPTIONS.map(mat => (
                  <label
                    key={mat}
                    className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition ${
                      selectedMaterials.includes(mat)
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-semibold'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedMaterials.includes(mat)}
                      onChange={() => handleMaterialToggle(mat)}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>{mat}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary text-xs py-2.5 px-6 flex items-center gap-2 font-bold"
              >
                {submitting ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <Send size={14} />
                )}
                Submit Corrections for Re-Review
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
