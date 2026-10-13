import { 
  db, 
  type UserAccount, 
  type BusinessProfile, 
  type VerificationApplication, 
  type VerificationStatus, 
  type UserRole,
  ensureDemoData
} from './db';

const API_BASE = 'http://127.0.0.1:8000';
const CURRENT_USER_KEY = 'kabadiwala_auth_session';

export interface AuthSession {
  user: UserAccount;
  businessProfile?: BusinessProfile;
  verificationStatus: VerificationStatus | 'active' | 'none';
  token?: string;
}

export interface RegisterParams {
  email: string;
  phone?: string;
  fullName: string;
  password: string;
  role: UserRole;
  businessName?: string;
  facilityAddress?: string;
  district?: string;
  operatingArea?: string;
  acceptedMaterials?: string[];
  cpcbRegistrationNumber?: string;
  facilityScope?: string;
}

export interface ApplyVerificationParams {
  userId: string;
  role: 'HUB' | 'RECYCLER';
  businessName: string;
  facilityAddress: string;
  district: string;
  operatingArea?: string;
  acceptedMaterials: string[];
  cpcbRegistrationNumber?: string;
  facilityScope?: string;
}

export interface ApplicationWithDetails extends VerificationApplication {
  businessName: string;
  facilityAddress: string;
  district: string;
  operatingArea?: string;
  acceptedMaterials: string[];
  cpcbRegistrationNumber?: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string;
}

/**
 * Retrieves the currently logged in user session from localStorage.
 */
export function getCurrentSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(CURRENT_USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

/**
 * Constructs request headers including Authorization Bearer token from the active session.
 */
export function getAuthHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
  const session = getCurrentSession();
  const headers: Record<string, string> = { ...extraHeaders };
  if (session?.token) {
    headers['Authorization'] = `Bearer ${session.token}`;
  }
  return headers;
}

/**
 * Saves current authenticated session.
 */
export function setCurrentSession(session: AuthSession | null): void {
  if (session) {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(CURRENT_USER_KEY);
  }
}

/**
 * Public registration flow.
 * RULE: Public registration must never allow users to select or grant themselves the Administrator role.
 */
export async function register(params: RegisterParams): Promise<AuthSession> {
  await ensureDemoData();

  if (params.role === 'ADMIN') {
    throw new Error('Security Restriction: Public registration cannot create Administrator accounts. Admin access must be provisioned via trusted setup.');
  }

  if (!params.email || !params.fullName || !params.password) {
    throw new Error('Please fill in all required registration fields.');
  }

  // 1. Attempt backend registration first
  let backendData: any = null;
  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (res.ok) {
      backendData = await res.json();
    } else {
      const err = await res.json().catch(() => ({}));
      if (res.status === 403 || res.status === 409 || res.status === 400) {
        throw new Error(err.detail || 'Registration failed.');
      }
    }
  } catch (err: any) {
    // If explicit validation error was thrown by server, propagate it
    if (err.message && (err.message.includes('Security Restriction') || err.message.includes('already exists'))) {
      throw err;
    }
    // Network offline: proceed with local IndexedDB registration
  }

  // 2. Persist in local Dexie database for offline-first support
  const existingUser = await db.users.where('email').equalsIgnoreCase(params.email).first();
  if (existingUser) {
    throw new Error('An account with this email address already exists.');
  }

  const userId = backendData?.user?.id || crypto.randomUUID();
  const userAccount: UserAccount = {
    id: userId,
    email: params.email.trim().toLowerCase(),
    phone: params.phone?.trim() || '',
    fullName: params.fullName.trim(),
    role: params.role,
    isActive: true,
    createdAt: Date.now(),
  };
  await db.users.put(userAccount);

  let businessProfile: BusinessProfile | undefined;
  let verificationApplication: VerificationApplication | undefined;

  if (params.role === 'HUB' || params.role === 'RECYCLER') {
    if (!params.businessName || !params.facilityAddress) {
      throw new Error(`Business name and facility address are required for ${params.role} registration.`);
    }

    const profileId = backendData?.business_profile?.id || `${params.role === 'HUB' ? 'HUB' : 'REC'}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    businessProfile = {
      id: profileId,
      userId,
      role: params.role,
      businessName: params.businessName.trim(),
      authorizedContact: params.fullName.trim(),
      facilityAddress: params.facilityAddress.trim(),
      district: params.district?.trim() || 'Bengaluru Urban',
      operatingArea: params.operatingArea?.trim() || '',
      acceptedMaterials: params.acceptedMaterials || ['Circuit Boards (PCB)'],
      cpcbRegistrationNumber: params.cpcbRegistrationNumber?.trim() || '',
      facilityScope: params.facilityScope?.trim() || '',
      status: 'pending_verification',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db.businessProfiles.put(businessProfile);

    // If Hub, also add to local hubs collection
    if (params.role === 'HUB') {
      await db.hubs.put({
        id: profileId,
        name: businessProfile.businessName,
        ownerName: businessProfile.authorizedContact,
        location: businessProfile.facilityAddress,
        phone: params.phone || '',
        verified: false,
        acceptedMaterials: businessProfile.acceptedMaterials,
        isDemo: false,
      });
    }

    const appId = backendData?.verification_application?.id || `APP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    verificationApplication = {
      id: appId,
      businessProfileId: profileId,
      userId,
      role: params.role,
      status: 'pending_verification',
      submittedAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db.verificationApplications.put(verificationApplication);

    // Log audit event
    await db.auditLogs.put({
      id: crypto.randomUUID(),
      entityType: 'APPLICATION',
      entityId: appId,
      action: 'SUBMITTED',
      performedBy: userId,
      details: { role: params.role, businessName: params.businessName },
      createdAt: Date.now(),
    });
  }

  const session: AuthSession = {
    user: userAccount,
    businessProfile,
    verificationStatus: businessProfile ? 'pending_verification' : 'active',
    token: backendData?.token,
  };
  setCurrentSession(session);
  return session;
}

/**
 * Sign In flow.
 */
export async function login(email: string, password: string): Promise<AuthSession> {
  await ensureDemoData();

  if (!email || !password) {
    throw new Error('Please enter both email and password.');
  }

  // 1. Try backend login
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password }),
    });
    if (res.ok) {
      const data = await res.json();
      const session: AuthSession = {
        user: data.user,
        businessProfile: data.business_profile,
        verificationStatus: data.verification_status,
        token: data.token,
      };
      setCurrentSession(session);
      return session;
    }
  } catch (err) {
    // Offline fallback to local Dexie users
  }

  // 2. Offline local sign in
  const user = await db.users.where('email').equalsIgnoreCase(email.trim()).first();
  if (!user) {
    throw new Error('Invalid email or password.');
  }

  if (!user.isActive) {
    throw new Error('Your account has been deactivated or suspended.');
  }

  let businessProfile: BusinessProfile | undefined;
  let verificationStatus: VerificationStatus | 'active' | 'none' = 'active';

  if (user.role === 'HUB' || user.role === 'RECYCLER') {
    businessProfile = await db.businessProfiles.where('userId').equals(user.id).first();
    verificationStatus = businessProfile?.status || 'pending_verification';
  }

  const session: AuthSession = {
    user,
    businessProfile,
    verificationStatus,
  };
  setCurrentSession(session);
  return session;
}

/**
 * Signs out current session.
 */
export function logout(): void {
  setCurrentSession(null);
}

/**
 * Resubmits an updated verification application.
 * RULE: Resubmission must NOT automatically approve it; sets status to 'under_review'.
 */
export async function resubmitVerification(params: ApplyVerificationParams): Promise<VerificationApplication> {
  await ensureDemoData();

  let businessProfile = await db.businessProfiles.where('userId').equals(params.userId).first();
  if (!businessProfile) {
    throw new Error('Business profile not found.');
  }

  businessProfile = {
    ...businessProfile,
    businessName: params.businessName.trim(),
    facilityAddress: params.facilityAddress.trim(),
    district: params.district.trim(),
    operatingArea: params.operatingArea?.trim() || businessProfile.operatingArea,
    acceptedMaterials: params.acceptedMaterials.length > 0 ? params.acceptedMaterials : businessProfile.acceptedMaterials,
    cpcbRegistrationNumber: params.cpcbRegistrationNumber?.trim() || businessProfile.cpcbRegistrationNumber,
    facilityScope: params.facilityScope?.trim() || businessProfile.facilityScope,
    status: 'under_review',
    updatedAt: Date.now(),
  };
  await db.businessProfiles.put(businessProfile);

  let app = await db.verificationApplications.where('businessProfileId').equals(businessProfile.id).first();
  if (!app) {
    app = {
      id: `APP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      businessProfileId: businessProfile.id,
      userId: params.userId,
      role: params.role,
      status: 'under_review',
      submittedAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  } else {
    app = {
      ...app,
      status: 'under_review',
      submittedAt: Date.now(),
      rejectionReason: undefined,
      correctionRequests: undefined,
      updatedAt: Date.now(),
    };
  }
  await db.verificationApplications.put(app);

  // Sync with backend if online
  try {
    await fetch(`${API_BASE}/verification/apply`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(params),
    });
  } catch (e) {
    // Non-blocking offline support
  }

  // Audit log
  await db.auditLogs.put({
    id: crypto.randomUUID(),
    entityType: 'APPLICATION',
    entityId: app.id,
    action: 'RESUBMITTED',
    performedBy: params.userId,
    details: { businessName: params.businessName, district: params.district },
    createdAt: Date.now(),
  });

  // Update current session
  const current = getCurrentSession();
  if (current && current.user.id === params.userId) {
    setCurrentSession({
      ...current,
      businessProfile,
      verificationStatus: 'under_review',
    });
  }

  return app;
}

/**
 * Retrieves the verification applications queue for Administrator review.
 */
export async function getAdminApplicationsQueue(filters?: {
  role?: string;
  status?: string;
  district?: string;
}): Promise<ApplicationWithDetails[]> {
  await ensureDemoData();

  // Try backend first
  try {
    const res = await fetch(`${API_BASE}/admin/applications`, {
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.applications && data.applications.length > 0) {
        let list: ApplicationWithDetails[] = data.applications;
        if (filters?.role && filters.role !== 'ALL') {
          list = list.filter(a => a.role === filters.role);
        }
        if (filters?.status && filters.status !== 'ALL') {
          list = list.filter(a => a.status === filters.status);
        }
        if (filters?.district && filters.district !== 'ALL') {
          list = list.filter(a => a.district.toLowerCase() === filters.district!.toLowerCase());
        }
        return list;
      }
    }
  } catch (e) {
    // Offline fallback to Dexie
  }

  // Fallback to local Dexie
  const apps = await db.verificationApplications.toArray();
  const profiles = await db.businessProfiles.toArray();
  const users = await db.users.toArray();

  const results: ApplicationWithDetails[] = [];
  for (const a of apps) {
    if (filters?.role && filters.role !== 'ALL' && a.role !== filters.role) continue;
    if (filters?.status && filters.status !== 'ALL' && a.status !== filters.status) continue;

    const prof = profiles.find(p => p.id === a.businessProfileId);
    if (filters?.district && filters.district !== 'ALL' && prof?.district.toLowerCase() !== filters.district.toLowerCase()) continue;

    const u = users.find(usr => usr.id === a.userId);

    results.push({
      ...a,
      businessName: prof?.businessName || 'N/A',
      facilityAddress: prof?.facilityAddress || 'N/A',
      district: prof?.district || 'Bengaluru Urban',
      operatingArea: prof?.operatingArea,
      acceptedMaterials: prof?.acceptedMaterials || [],
      cpcbRegistrationNumber: prof?.cpcbRegistrationNumber,
      applicantName: u?.fullName || 'N/A',
      applicantEmail: u?.email || 'N/A',
      applicantPhone: u?.phone || 'N/A',
    });
  }

  results.sort((x, y) => (y.submittedAt || 0) - (x.submittedAt || 0));
  return results;
}

/**
 * Admin action to approve, reject, request changes, or suspend an application.
 * RULE: Mandatory reasons must be provided for rejection, changes_requested, and suspension.
 */
export async function reviewApplicationAsAdmin(params: {
  applicationId: string;
  action: 'approve' | 'reject' | 'request_changes' | 'suspend';
  reason?: string;
  reviewNotes?: string;
  officialRegistryRef?: string;
  reviewerId?: string;
}): Promise<VerificationApplication> {
  await ensureDemoData();

  const targetStatusMap: Record<string, VerificationStatus> = {
    approve: 'approved',
    reject: 'rejected',
    request_changes: 'changes_requested',
    suspend: 'suspended',
  };
  const targetStatus = targetStatusMap[params.action];

  if (!targetStatus) {
    throw new Error(`Invalid review action '${params.action}'.`);
  }

  if ((targetStatus === 'rejected' || targetStatus === 'changes_requested' || targetStatus === 'suspended') && !params.reason?.trim()) {
    throw new Error(`A clear, specific reason is mandatory when setting application status to '${targetStatus}'.`);
  }

  // 1. Try backend
  try {
    await fetch(`${API_BASE}/admin/applications/${params.applicationId}/review`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(params),
    });
  } catch (e) {
    // Non-blocking fallback
  }

  // 2. Apply to Dexie
  const app = await db.verificationApplications.get(params.applicationId);
  if (!app) throw new Error(`Application ${params.applicationId} not found.`);

  const updatedApp: VerificationApplication = {
    ...app,
    status: targetStatus,
    reviewedAt: Date.now(),
    reviewerId: params.reviewerId || 'admin-sys-001',
    reviewDecision: targetStatus,
    reviewNotes: params.reviewNotes?.trim() || '',
    rejectionReason: targetStatus === 'rejected' ? params.reason?.trim() : undefined,
    correctionRequests: targetStatus === 'changes_requested' ? params.reason?.trim() : undefined,
    officialRegistryRef: targetStatus === 'approved' ? params.officialRegistryRef?.trim() : app.officialRegistryRef,
    updatedAt: Date.now(),
  };
  await db.verificationApplications.put(updatedApp);

  // Sync to business profile
  const profile = await db.businessProfiles.get(app.businessProfileId);
  if (profile) {
    await db.businessProfiles.update(profile.id, {
      status: targetStatus,
      updatedAt: Date.now(),
    });

    // If hub, also update verified boolean in hubs collection
    if (profile.role === 'HUB') {
      const hub = await db.hubs.get(profile.id);
      if (hub) {
        await db.hubs.update(profile.id, { verified: targetStatus === 'approved' });
      }
    }
  }

  // Record audit log
  await db.auditLogs.put({
    id: crypto.randomUUID(),
    entityType: 'APPLICATION',
    entityId: app.id,
    action: targetStatus.toUpperCase(),
    performedBy: params.reviewerId || 'admin-sys-001',
    reason: params.reason || '',
    details: {
      reviewNotes: params.reviewNotes || '',
      officialRegistryRef: params.officialRegistryRef || '',
    },
    createdAt: Date.now(),
  });

  return updatedApp;
}

/**
 * Checks if a Hub is authorized to perform intake, weigh-in, and shipment dispatch.
 * RULE: Only approved, active business accounts may execute hub operations.
 */
export async function verifyHubOperationalStatus(hubId: string): Promise<{
  allowed: boolean;
  status: VerificationStatus | 'none';
  reason?: string;
}> {
  await ensureDemoData();

  const profile = await db.businessProfiles.get(hubId);
  if (!profile) {
    // Check if it's a pre-configured verified demo hub
    const hub = await db.hubs.get(hubId);
    if (hub && hub.verified) {
      return { allowed: true, status: 'approved' };
    }
    return {
      allowed: false,
      status: 'none',
      reason: 'Hub business profile not found or unverified in system registry.'
    };
  }

  if (profile.status === 'approved') {
    return { allowed: true, status: 'approved' };
  }

  return {
    allowed: false,
    status: profile.status,
    reason: `Hub business status is '${profile.status}'. Hub must be officially approved to intake lots or dispatch bulk shipments.`
  };
}

/**
 * Checks if a Recycler is authorized to appear in the marketplace and accept shipments.
 * RULE: Recycler must be approved AND authorized for the target material category.
 */
export async function verifyRecyclerOperationalStatus(recyclerId: string, material?: string): Promise<{
  allowed: boolean;
  status: VerificationStatus | 'none';
  reason?: string;
}> {
  await ensureDemoData();

  const profile = await db.businessProfiles.get(recyclerId);
  if (!profile) {
    const rec = await db.recyclers.get(recyclerId);
    if (rec && rec.verified) {
      return { allowed: true, status: 'approved' };
    }
    return {
      allowed: false,
      status: 'none',
      reason: 'Recycler entity not found or not registered.'
    };
  }

  if (profile.status !== 'approved') {
    return {
      allowed: false,
      status: profile.status,
      reason: `Recycler status is '${profile.status}'. Only officially approved formal recyclers can receive cargo shipments.`
    };
  }

  if (material && profile.acceptedMaterials && profile.acceptedMaterials.length > 0) {
    const isMaterialCovered = profile.acceptedMaterials.some(
      m => m.trim().toLowerCase() === material.trim().toLowerCase()
    );
    if (!isMaterialCovered) {
      return {
        allowed: false,
        status: 'approved',
        reason: `Material mismatch: Recycler facility scope is limited to [${profile.acceptedMaterials.join(', ')}], and cannot accept '${material}'.`
      };
    }
  }

  return { allowed: true, status: 'approved' };
}
