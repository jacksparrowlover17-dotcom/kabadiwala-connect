import React, { useEffect, useState } from 'react';
import {
  ShieldCheck, Clock, Search, RefreshCw,
  ShieldAlert, Check, X, History, MapPin, Building2
} from 'lucide-react';
import {
  getAdminApplicationsQueue,
  reviewApplicationAsAdmin,
  getCurrentSession,
  type ApplicationWithDetails,
  type AuthSession
} from '../lib/authService';
import { db, type AuditLogEvent, type VerificationStatus } from '../lib/db';

const DISTRICTS = [
  'ALL',
  'Bengaluru Urban',
  'Bengaluru Rural',
  'Chennai',
  'Hyderabad',
  'Mumbai Suburban',
  'Pune',
  'Delhi NCR'
];

export default function AdminVerificationPage() {
  const [session, setSession] = useState<AuthSession | null>(getCurrentSession());
  const [applications, setApplications] = useState<ApplicationWithDetails[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [districtFilter, setDistrictFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Active review modal
  const [selectedApp, setSelectedApp] = useState<ApplicationWithDetails | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'request_changes' | 'suspend' | null>(null);
  const [reason, setReason] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [officialRegistryRef, setOfficialRegistryRef] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  const loadData = async () => {
    setLoading(true);
    const curr = getCurrentSession();
    setSession(curr);

    try {
      const list = await getAdminApplicationsQueue({
        role: roleFilter,
        status: statusFilter,
        district: districtFilter,
      });
      setApplications(list);

      // Fetch audit events
      const logs = await db.auditLogs.orderBy('createdAt').reverse().limit(30).toArray();
      setAuditLogs(logs);
    } catch (err) {
      console.error('Failed to load queue:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [roleFilter, statusFilter, districtFilter]);

  const handleOpenReview = (app: ApplicationWithDetails, action: 'approve' | 'reject' | 'request_changes' | 'suspend') => {
    setSelectedApp(app);
    setActionType(action);
    setReason('');
    setReviewNotes('');
    setOfficialRegistryRef(action === 'approve' ? `CPCB/REG-${new Date().getFullYear()}/${app.role}-${app.businessProfileId.slice(0, 6)}` : '');
    setActionError('');
    setActionSuccess('');
  };

  const handleConfirmAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp || !actionType) return;
    setActionError('');
    setActionSuccess('');

    // Rule: Mandatory reasons for rejection, changes_requested, and suspension
    if ((actionType === 'reject' || actionType === 'request_changes' || actionType === 'suspend') && !reason.trim()) {
      setActionError(`A mandatory explanation reason must be recorded for '${actionType}'.`);
      return;
    }

    try {
      setActionLoading(true);
      await reviewApplicationAsAdmin({
        applicationId: selectedApp.id,
        action: actionType,
        reason: reason.trim(),
        reviewNotes: reviewNotes.trim(),
        officialRegistryRef: actionType === 'approve' ? officialRegistryRef.trim() : undefined,
        reviewerId: session?.user?.id || 'admin-sys-001',
      });

      setActionSuccess(`Application successfully marked as ${actionType.toUpperCase()}`);
      setTimeout(() => {
        setSelectedApp(null);
        setActionType(null);
        loadData();
      }, 1000);
    } catch (err: any) {
      setActionError(err.message || 'Action failed.');
    } finally {
      setActionLoading(false);
    }
  };

  // Filter application list by search term
  const filteredApps = applications.filter(app => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      app.businessName.toLowerCase().includes(q) ||
      app.applicantName.toLowerCase().includes(q) ||
      app.district.toLowerCase().includes(q) ||
      (app.cpcbRegistrationNumber && app.cpcbRegistrationNumber.toLowerCase().includes(q))
    );
  });

  const getStatusBadge = (status: VerificationStatus) => {
    const map: Record<VerificationStatus, { bg: string; color: string; label: string }> = {
      pending_verification: { bg: '#fef3c7', color: '#b45309', label: 'Pending Review' },
      under_review: { bg: '#dbeafe', color: '#1d4ed8', label: 'Under Review' },
      changes_requested: { bg: '#ffedd5', color: '#c2410c', label: 'Changes Req.' },
      approved: { bg: '#dcfce7', color: '#166534', label: 'Approved' },
      rejected: { bg: '#fee2e2', color: '#b91c1c', label: 'Rejected' },
      suspended: { bg: '#f1f5f9', color: '#475569', label: 'Suspended' },
      expired: { bg: '#fef3c7', color: '#92400e', label: 'Expired' },
    };
    const s = map[status] || { bg: '#e2e8f0', color: '#334155', label: status };
    return (
      <span
        className="px-2 py-0.5 rounded text-[11px] font-bold"
        style={{ background: s.bg, color: s.color }}
      >
        {s.label}
      </span>
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Title & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="badge bg-amber-100 text-amber-800 text-[11px] font-bold">
              Administrative & Regulatory Desk
            </span>
            <span className="text-xs text-slate-500 font-mono">
              CPCB E-Waste Oversight
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            Business Verification & Operational Registry
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Review business credentials, official licenses, and grant/suspend marketplace operational authorization.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 text-xs flex items-center gap-1.5 transition"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh Queue
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="mt-6 card p-4 border-slate-200 bg-white grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div>
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Role</label>
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            className="input text-xs py-1.5"
          >
            <option value="ALL">All Roles</option>
            <option value="HUB">Hub Operators</option>
            <option value="RECYCLER">Formal Recyclers</option>
          </select>
        </div>

        <div>
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Status</label>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="input text-xs py-1.5"
          >
            <option value="ALL">All Statuses</option>
            <option value="pending_verification">Pending Verification</option>
            <option value="under_review">Under Review</option>
            <option value="changes_requested">Changes Requested</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>

        <div>
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">District</label>
          <select
            value={districtFilter}
            onChange={e => setDistrictFilter(e.target.value)}
            className="input text-xs py-1.5"
          >
            {DISTRICTS.map(d => (
              <option key={d} value={d}>{d === 'ALL' ? 'All Districts' : d}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Search</label>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search business, applicant..."
              className="input pl-8 text-xs py-1.5"
            />
          </div>
        </div>
      </div>

      {/* Main Queue Table */}
      <div className="mt-6 card border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 size={16} className="text-slate-600" />
            <h2 className="font-bold text-slate-800 text-sm">Applications Queue ({filteredApps.length})</h2>
          </div>
          <span className="text-[11px] text-slate-500">
            Real-time regulatory review
          </span>
        </div>

        {filteredApps.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            <Clock size={32} className="mx-auto text-slate-300 mb-2" />
            No applications found matching the selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-100/75 text-slate-600 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Entity & Role</th>
                  <th className="py-3 px-4">Applicant</th>
                  <th className="py-3 px-4">Facility & District</th>
                  <th className="py-3 px-4">Registry / Scope</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Regulatory Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredApps.map(app => (
                  <tr key={app.id} className="hover:bg-slate-50/75 transition">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{app.businessName}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                          app.role === 'HUB' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                        }`}>
                          {app.role === 'HUB' ? 'Local Hub' : 'Formal Recycler'}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">{app.id}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-800">{app.applicantName}</div>
                      <div className="text-[11px] text-slate-500">{app.applicantEmail}</div>
                      {app.applicantPhone && (
                        <div className="text-[10px] text-slate-400">{app.applicantPhone}</div>
                      )}
                    </td>

                    <td className="py-3 px-4 max-w-xs">
                      <div className="truncate font-medium text-slate-700">{app.facilityAddress}</div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <MapPin size={11} className="text-slate-400" />
                        {app.district}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      {app.cpcbRegistrationNumber ? (
                        <div className="font-mono text-[11px] font-semibold text-emerald-700">
                          {app.cpcbRegistrationNumber}
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">Unspecified</span>
                      )}
                      <div className="flex flex-wrap gap-1 mt-1 max-w-[200px]">
                        {(app.acceptedMaterials || []).slice(0, 2).map(m => (
                          <span key={m} className="px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded text-[10px]">
                            {m}
                          </span>
                        ))}
                        {(app.acceptedMaterials || []).length > 2 && (
                          <span className="text-[10px] text-slate-400">
                            +{app.acceptedMaterials.length - 2} more
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      {getStatusBadge(app.status)}
                      <div className="text-[10px] text-slate-400 mt-1">
                        {app.submittedAt ? new Date(app.submittedAt).toLocaleDateString('en-IN') : 'N/A'}
                      </div>
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {app.status !== 'approved' ? (
                          <>
                            <button
                              onClick={() => handleOpenReview(app, 'approve')}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-semibold text-[11px] transition"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleOpenReview(app, 'request_changes')}
                              className="px-2.5 py-1 bg-orange-100 hover:bg-orange-200 text-orange-800 rounded font-semibold text-[11px] transition"
                            >
                              Request Changes
                            </button>
                            <button
                              onClick={() => handleOpenReview(app, 'reject')}
                              className="px-2.5 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded font-semibold text-[11px] transition"
                            >
                              Reject
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleOpenReview(app, 'suspend')}
                            className="px-2.5 py-1 bg-slate-200 hover:bg-rose-100 hover:text-rose-800 text-slate-700 rounded font-semibold text-[11px] transition flex items-center gap-1"
                          >
                            <ShieldAlert size={12} />
                            Suspend Access
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Audit Trail Section */}
      <div className="mt-8 card border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History size={16} className="text-slate-600" />
            <h2 className="font-bold text-slate-800 text-sm">Regulatory Verification Audit Ledger</h2>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">Immutable append-only events</span>
        </div>

        <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
          {auditLogs.length === 0 ? (
            <div className="p-6 text-center text-slate-400 text-xs">No audit events recorded yet.</div>
          ) : (
            auditLogs.map(log => (
              <div key={log.id} className="p-3 text-xs flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800 uppercase text-[10px] px-1.5 py-0.5 rounded bg-slate-100 border">
                      {log.action}
                    </span>
                    <span className="font-mono text-slate-500 text-[11px]">
                      Target: {log.entityId}
                    </span>
                    <span className="text-slate-400 text-[10px]">
                      by {log.performedBy}
                    </span>
                  </div>
                  {log.reason && (
                    <p className="text-slate-600 mt-1 italic">
                      Reason: "{log.reason}"
                    </p>
                  )}
                  {log.details?.officialRegistryRef && (
                    <p className="text-emerald-700 text-[11px] font-mono mt-0.5 font-semibold">
                      CPCB Ref: {log.details.officialRegistryRef}
                    </p>
                  )}
                </div>
                <div className="text-[10px] text-slate-400 whitespace-nowrap font-mono">
                  {new Date(log.createdAt).toLocaleString('en-IN')}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Review Action Modal */}
      {selectedApp && actionType && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-xl overflow-hidden animate-in fade-in">
            <div className={`p-4 border-b flex items-center justify-between ${
              actionType === 'approve' ? 'bg-emerald-50 text-emerald-900 border-emerald-100' :
              actionType === 'suspend' ? 'bg-slate-100 text-slate-900 border-slate-200' :
              actionType === 'request_changes' ? 'bg-orange-50 text-orange-900 border-orange-100' :
              'bg-rose-50 text-rose-900 border-rose-100'
            }`}>
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} />
                <h3 className="font-bold text-sm uppercase">
                  {actionType.replace('_', ' ')} Application
                </h3>
              </div>
              <button
                onClick={() => setSelectedApp(null)}
                className="p-1 rounded hover:bg-black/10 transition"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleConfirmAction} className="p-5 space-y-4 text-xs">
              <div>
                <p className="text-slate-500 text-[11px]">Applicant Entity</p>
                <p className="font-bold text-slate-800 text-sm">{selectedApp.businessName}</p>
                <p className="text-slate-600 text-[11px]">{selectedApp.facilityAddress}, {selectedApp.district}</p>
              </div>

              {actionError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg font-semibold">
                  {actionError}
                </div>
              )}

              {actionSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg font-semibold">
                  {actionSuccess}
                </div>
              )}

              {actionType === 'approve' && (
                <div>
                  <label className="label">Official Registry Reference / CPCB Grant Number</label>
                  <input
                    type="text"
                    value={officialRegistryRef}
                    onChange={e => setOfficialRegistryRef(e.target.value)}
                    className="input font-mono text-xs"
                    required
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Recorded in regulatory audit trail to authorize marketplace shipments.
                  </p>
                </div>
              )}

              {(actionType === 'reject' || actionType === 'request_changes' || actionType === 'suspend') && (
                <div>
                  <label className="label text-rose-800 font-bold">
                    Mandatory Reason for {actionType.replace('_', ' ').toUpperCase()} *
                  </label>
                  <textarea
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder="Provide specific regulatory discrepancies or corrective requirements..."
                    rows={3}
                    className="input text-xs"
                    required
                  />
                </div>
              )}

              <div>
                <label className="label">Internal Review Notes / Officer Remarks</label>
                <textarea
                  value={reviewNotes}
                  onChange={e => setReviewNotes(e.target.value)}
                  placeholder="Optional internal inspector notes..."
                  rows={2}
                  className="input text-xs"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedApp(null)}
                  className="btn-secondary text-xs py-2 px-4"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className={`text-xs py-2 px-5 font-bold rounded-lg text-white transition flex items-center gap-1.5 ${
                    actionType === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' :
                    actionType === 'suspend' ? 'bg-slate-700 hover:bg-slate-800' :
                    actionType === 'request_changes' ? 'bg-orange-600 hover:bg-orange-700' :
                    'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {actionLoading ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />}
                  Confirm {actionType.replace('_', ' ')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
