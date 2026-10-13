#!/usr/bin/env node
/**
 * test_auth_role_flow.mjs
 * Automated verification suite for Registration-First & Role-Based Access Control
 */

import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const API_BASE = 'http://127.0.0.1:8000';

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    process.stdout.write(`• Testing: ${name}... `);
    await fn();
    console.log('✅ PASSED');
    passed++;
  } catch (err) {
    console.log(`❌ FAILED: ${err.message}`);
    failed++;
  }
}

console.log('======================================================================');
console.log(' KABADIWALA CONNECT — REGISTRATION & ROLE-BASED ACCESS TEST SUITE');
console.log('======================================================================\n');

// ─── 1. Backend Security & Registration Gating ───────────────────────
console.log('── Part A: Backend Registration & RBAC Endpoints');

await test('Public registration rejects ADMIN role with HTTP 403 Forbidden', async () => {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `admin_hack_${Date.now()}@test.com`,
      fullName: 'Fake Admin',
      password: 'Password123!',
      role: 'ADMIN'
    })
  });
  assert.strictEqual(res.status, 403, `Expected 403, got ${res.status}`);
  const data = await res.json();
  assert.ok(data.detail.includes('Public registration cannot create Administrator accounts'));
});

const collectorEmail = `kabadiwala_${Date.now()}@test.com`;
let collectorUserId = null;
let collectorToken = null;

await test('Collector registration creates active account with signed JWT token', async () => {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: collectorEmail,
      fullName: 'Raju Kabadi',
      phone: '9845098450',
      password: 'Password123!',
      role: 'COLLECTOR'
    })
  });
  assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
  const data = await res.json();
  assert.strictEqual(data.user.role, 'COLLECTOR');
  assert.strictEqual(data.verification_status, 'active');
  assert.ok(data.token, 'Registration must issue a signed JWT token');
  collectorUserId = data.user.id;
  collectorToken = data.token;
});

await test('Duplicate email registration is rejected with HTTP 400', async () => {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: collectorEmail,
      fullName: 'Duplicate Raju',
      password: 'Password123!',
      role: 'COLLECTOR'
    })
  });
  assert.strictEqual(res.status, 400, `Expected 400, got ${res.status}`);
  const data = await res.json();
  assert.ok(data.detail.includes('already exists'));
});

const hubEmail = `hub_operator_${Date.now()}@test.com`;
let hubProfileId = null;
let hubAppId = null;
let hubToken = null;

await test('Hub registration creates pending_verification account with JWT token', async () => {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: hubEmail,
      fullName: 'Mahesh Hub Owner',
      phone: '9876543210',
      password: 'Password123!',
      role: 'HUB',
      businessName: 'Peenya Aggregation Depot',
      facilityAddress: 'Plot 12, Peenya 2nd Stage, Bengaluru',
      district: 'Bengaluru Urban',
      operatingArea: 'Peenya & Yeshwanthpur',
      acceptedMaterials: ['Circuit Boards (PCB)', 'Copper Cables']
    })
  });
  assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
  const data = await res.json();
  assert.strictEqual(data.user.role, 'HUB');
  assert.strictEqual(data.verification_status, 'pending_verification');
  assert.ok(data.business_profile);
  assert.strictEqual(data.business_profile.status, 'pending_verification');
  assert.ok(data.token, 'Must return JWT token');
  hubProfileId = data.business_profile.id;
  hubAppId = data.verification_application.id;
  hubToken = data.token;
});

const recEmail = `recycler_${Date.now()}@test.com`;
await test('Recycler registration captures CPCB registration and stays pending_verification', async () => {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: recEmail,
      fullName: 'Dr. Suresh Metallurgist',
      phone: '9888877777',
      password: 'Password123!',
      role: 'RECYCLER',
      businessName: 'EcoRecycle Metal Works',
      facilityAddress: 'KIADB Industrial Area, Doddaballapur',
      district: 'Bengaluru Rural',
      cpcbRegistrationNumber: 'CPCB/EW-REG/KA-2024/099',
      facilityScope: 'PCB Hydrometallurgical Gold & Copper Recovery',
      acceptedMaterials: ['Circuit Boards (PCB)']
    })
  });
  assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
  const data = await res.json();
  assert.strictEqual(data.user.role, 'RECYCLER');
  assert.strictEqual(data.verification_status, 'pending_verification');
  assert.ok(data.business_profile.cpcb_registration_number || data.business_profile.cpcbRegistrationNumber);
});

await test('Login with incorrect password returns HTTP 401', async () => {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: collectorEmail,
      password: 'WrongPassword999!'
    })
  });
  assert.strictEqual(res.status, 401, `Expected 401, got ${res.status}`);
});

await test('Login with valid credentials returns user profile, role, token, and verification status', async () => {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: collectorEmail,
      password: 'Password123!'
    })
  });
  assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
  const data = await res.json();
  assert.strictEqual(data.user.role, 'COLLECTOR');
  assert.ok(data.token, 'Token must be returned on login');
});

// Admin authentication setup
let adminToken = null;
await test('Admin signs in and receives signed Administrator JWT token', async () => {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@kabadiwala.in',
      password: 'Admin@123'
    })
  });
  assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
  const data = await res.json();
  assert.strictEqual(data.user.role, 'ADMIN');
  assert.ok(data.token, 'Admin token must be returned');
  adminToken = data.token;
});

await test('Protected admin endpoint rejects request with missing Bearer token (HTTP 401)', async () => {
  const res = await fetch(`${API_BASE}/admin/applications`);
  assert.strictEqual(res.status, 401, `Expected 401, got ${res.status}`);
});

await test('Protected admin endpoint rejects forged/invalid Bearer token (HTTP 401)', async () => {
  const res = await fetch(`${API_BASE}/admin/applications`, {
    headers: { 'Authorization': 'Bearer invalid.tampered.token_signature_xyz' }
  });
  assert.strictEqual(res.status, 401, `Expected 401, got ${res.status}`);
});

await test('Collector token calling Admin endpoint is rejected with HTTP 403 Forbidden', async () => {
  const res = await fetch(`${API_BASE}/admin/applications`, {
    headers: { 'Authorization': `Bearer ${collectorToken}` }
  });
  assert.strictEqual(res.status, 403, `Expected 403, got ${res.status}`);
});

await test('Unverified Hub token cannot publish buying offers (HTTP 403 Forbidden)', async () => {
  const res = await fetch(`${API_BASE}/hub/offers`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${hubToken}`
    },
    body: JSON.stringify({
      hub_id: hubProfileId,
      hub_name: 'Peenya Aggregation Depot',
      material: 'Circuit Boards (PCB)',
      grade: 'High Grade',
      rate: 280,
      unit: 'kg',
      min_quantity_kg: 5,
      supported_services: ['DROP_OFF'],
      pickup_fee: 0,
      applicable_area: 'Peenya',
      valid_from: '2026-10-13',
      valid_till: '2026-11-30',
      status: 'active'
    })
  });
  assert.strictEqual(res.status, 403, `Expected 403 for unverified hub, got ${res.status}`);
  const data = await res.json();
  assert.ok(data.detail.includes('pending_verification') || data.detail.includes('Only officially approved hubs'));
});

await test('Admin with valid Bearer token can review and approve Hub in verification queue', async () => {
  const res = await fetch(`${API_BASE}/admin/applications/${hubAppId}/review`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      action: 'approve',
      officialRegistryRef: 'CPCB/HUB/GRANT/2026/044',
      reviewNotes: 'Site premises and digital weigh scale verified.'
    })
  });
  assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
  const data = await res.json();
  assert.strictEqual(data.business_profile.status, 'approved');
});

await test('Approved Hub with valid Bearer token can now publish buying offers', async () => {
  const res = await fetch(`${API_BASE}/hub/offers`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${hubToken}`
    },
    body: JSON.stringify({
      hub_id: hubProfileId,
      hub_name: 'Peenya Aggregation Depot',
      material: 'Circuit Boards (PCB)',
      grade: 'High Grade',
      rate: 280,
      unit: 'kg',
      min_quantity_kg: 5,
      supported_services: ['DROP_OFF'],
      pickup_fee: 0,
      applicable_area: 'Peenya',
      valid_from: '2026-10-13',
      valid_till: '2026-11-30',
      status: 'active'
    })
  });
  assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
  const data = await res.json();
  assert.ok(data.offer.id);
  assert.strictEqual(data.offer.rate, 280);
});

// ─── 2. Frontend Structure & Guard Verification ──────────────────────
console.log('\n── Part B: Frontend Architecture & Route Guards (Static Analysis)');

const appPath = join(__dirname, 'src', 'App.tsx');
const appCode = readFileSync(appPath, 'utf-8');

await test('App.tsx defines ProtectedRoute component', async () => {
  assert.ok(appCode.includes('function ProtectedRoute'), 'ProtectedRoute function must exist in App.tsx');
});

await test('App.tsx defines RootIndexRoute component', async () => {
  assert.ok(appCode.includes('function RootIndexRoute'), 'RootIndexRoute function must exist in App.tsx');
});

await test('App.tsx imports WelcomeLandingPage', async () => {
  assert.ok(appCode.includes("import WelcomeLandingPage from './pages/WelcomeLandingPage'"), 'WelcomeLandingPage must be imported');
});

await test('Root route / renders RootIndexRoute instead of directly rendering HomePage', async () => {
  assert.ok(appCode.includes('<Route path="/" element={<RootIndexRoute/>}/>') || appCode.includes('<Route path="/" element={<RootIndexRoute />} />') || appCode.includes('element={<RootIndexRoute'), 'Root route must render RootIndexRoute');
});

await test('Protected collector screens (/loads, /new, /find-partners, /handovers) are wrapped in ProtectedRoute', async () => {
  assert.ok(appCode.includes('<ProtectedRoute allowedRoles={[\'COLLECTOR\', \'ADMIN\']}><HomePage'), 'HomePage protected');
  assert.ok(appCode.includes('<ProtectedRoute allowedRoles={[\'COLLECTOR\', \'ADMIN\']}><NewLotPage'), 'NewLotPage protected');
  assert.ok(appCode.includes('<ProtectedRoute allowedRoles={[\'COLLECTOR\', \'ADMIN\']}><DestinationFinderPage'), 'DestinationFinder protected');
  assert.ok(appCode.includes('<ProtectedRoute allowedRoles={[\'COLLECTOR\', \'ADMIN\']}><MyHandoversPage'), 'MyHandovers protected');
});

await test('Protected hub and recycler screens (/hub, /recycler) are wrapped in ProtectedRoute', async () => {
  assert.ok(appCode.includes('<ProtectedRoute allowedRoles={[\'HUB\', \'ADMIN\']}><HubDashboardPage'), 'HubDashboard protected');
  assert.ok(appCode.includes('<ProtectedRoute allowedRoles={[\'RECYCLER\', \'ADMIN\']}><RecyclerPage'), 'RecyclerPage protected');
});

await test('Protected admin screens (/admin/verifications) are wrapped in ProtectedRoute with ADMIN role only', async () => {
  assert.ok(appCode.includes('<ProtectedRoute allowedRoles={[\'ADMIN\']}><AdminVerificationPage'), 'AdminVerification protected with ADMIN');
});

await test('Unauthenticated sidebar role select dropdown is removed', async () => {
  assert.ok(!appCode.includes('<select') || !appCode.includes('value={role}'), 'Unauthenticated role switcher select element must not be in sidebar');
});

await test('Logout button is present in Sidebar and Topbar', async () => {
  assert.ok(appCode.includes('handleLogout') || appCode.includes('handleSignOut'), 'Logout handler must be defined');
  assert.ok(appCode.includes('logout()'), 'logout() must be called');
});

const landingPath = join(__dirname, 'src', 'pages', 'WelcomeLandingPage.tsx');
const landingCode = readFileSync(landingPath, 'utf-8');

await test('WelcomeLandingPage has Register and Sign In navigation buttons', async () => {
  assert.ok(landingCode.includes('/login?tab=register'), 'Must have register link');
  assert.ok(landingCode.includes('/login?tab=login'), 'Must have login link');
});

await test('WelcomeLandingPage explains all 3 roles: Collector, Hub, Recycler', async () => {
  assert.ok(landingCode.includes('Informal Collector'), 'Must mention Informal Collector');
  assert.ok(landingCode.includes('Collection Hub'), 'Must mention Collection Hub');
  assert.ok(landingCode.includes('Formal Recycler'), 'Must mention Formal Recycler');
});

const authPath = join(__dirname, 'src', 'pages', 'AuthPage.tsx');
const authCode = readFileSync(authPath, 'utf-8');

await test('AuthPage handles query params tab and role', async () => {
  assert.ok(authCode.includes('useSearchParams'), 'Must use useSearchParams');
  assert.ok(authCode.includes('tabParam') || authCode.includes('searchParams.get(\'tab\')'), 'Must read tab parameter');
  assert.ok(authCode.includes('roleParam') || authCode.includes('searchParams.get(\'role\')'), 'Must read role parameter');
});

console.log('\n======================================================================');
console.log(` RESULTS: ${passed} PASSED | ${failed} FAILED`);
console.log('======================================================================\n');

process.exit(failed > 0 ? 1 : 0);
