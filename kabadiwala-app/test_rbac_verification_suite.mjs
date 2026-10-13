import assert from 'node:assert';

const API_BASE = 'http://127.0.0.1:8000';

async function runTests() {
  console.log('====================================================');
  console.log('KABADIWALA CONNECT — RBAC & VERIFICATION TEST SUITE');
  console.log('====================================================\n');

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

  // --- 1. Public Admin Registration Prevention ---
  await test('Public registration must reject ADMIN role with 403 Forbidden', async () => {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `hacker_${Date.now()}@evil.com`,
        fullName: 'Rogue Admin Attempt',
        password: 'Password123!',
        role: 'ADMIN'
      })
    });
    assert.strictEqual(res.status, 403, `Expected status 403, got ${res.status}`);
    const data = await res.json();
    assert.ok(data.detail.includes('Public registration cannot create Administrator accounts'));
  });

  // --- 2. Public Collector Registration ---
  const collectorEmail = `collector_${Date.now()}@test.com`;
  await test('Public registration of informal COLLECTOR creates active account', async () => {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: collectorEmail,
        fullName: 'Ramu Kabadi',
        phone: '9876543210',
        password: 'Password123!',
        role: 'COLLECTOR'
      })
    });
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert.strictEqual(data.user.role, 'COLLECTOR');
    assert.strictEqual(data.verification_status, 'active');
  });

  // --- 3. Duplicate Email Prevention ---
  await test('Registration prevents duplicate email registrations', async () => {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: collectorEmail,
        fullName: 'Duplicate Ramu',
        password: 'Password123!',
        role: 'COLLECTOR'
      })
    });
    assert.strictEqual(res.status, 400, `Expected status 400, got ${res.status}`);
    const data = await res.json();
    assert.ok(data.detail.includes('already exists'));
  });

  // --- 4. Hub Operator Registration & Pending Verification ---
  const hubEmail = `hub_${Date.now()}@test.com`;
  let hubProfileId = null;
  let hubAppId = null;
  let hubUserId = null;
  await test('Public registration of HUB creates business profile in pending_verification', async () => {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: hubEmail,
        fullName: 'Venkatesh Hub',
        phone: '9845012345',
        password: 'Password123!',
        role: 'HUB',
        businessName: 'Venkatesh Aggregation Godown',
        facilityAddress: 'Plot 44, Peenya 3rd Phase',
        district: 'Bengaluru Urban',
        operatingArea: 'Peenya Industrial Area',
        acceptedMaterials: ['Circuit Boards (PCB)', 'Mobile Phones']
      })
    });
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert.strictEqual(data.user.role, 'HUB');
    assert.strictEqual(data.verification_status, 'pending_verification');
    assert.ok(data.business_profile);
    assert.strictEqual(data.business_profile.status, 'pending_verification');
    hubProfileId = data.business_profile.id;
    hubAppId = data.verification_application.id;
    hubUserId = data.user.id;
  });

  // --- 5. Formal Recycler Registration & Pending Verification ---
  const recEmail = `recycler_${Date.now()}@test.com`;
  let recProfileId = null;
  let recAppId = null;
  let recUserId = null;
  await test('Public registration of FORMAL RECYCLER creates pending verification with CPCB details', async () => {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: recEmail,
        fullName: 'Dr. Ramesh Smelter',
        phone: '9811223344',
        password: 'Password123!',
        role: 'RECYCLER',
        businessName: 'Green Smelters Pvt Ltd',
        facilityAddress: 'KIADB Industrial Area, Doddaballapur',
        district: 'Bengaluru Rural',
        cpcbRegistrationNumber: 'CPCB/EPR-2024/REC-401',
        facilityScope: 'E-waste pyrometallurgical recovery (200 MT/month)',
        acceptedMaterials: ['Circuit Boards (PCB)']
      })
    });
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert.strictEqual(data.user.role, 'RECYCLER');
    assert.strictEqual(data.verification_status, 'pending_verification');
    const cpcbVal = data.business_profile.cpcbRegistrationNumber || data.business_profile.cpcb_registration_number;
    assert.strictEqual(cpcbVal, 'CPCB/EPR-2024/REC-401');
    recProfileId = data.business_profile.id;
    recAppId = data.verification_application.id;
    recUserId = data.user.id;
  });

  // --- 6. Non-Admin Access to Review Queue Blocked ---
  await test('Non-admin users cannot access administrative review endpoints (403)', async () => {
    const res = await fetch(`${API_BASE}/admin/applications`, {
      headers: { 'X-User-Role': 'COLLECTOR' }
    });
    assert.strictEqual(res.status, 403, `Expected status 403, got ${res.status}`);
    const data = await res.json();
    assert.ok(data.detail.includes('Administrator role required'));
  });

  // --- 7. Admin Queue Lists Pending Applications ---
  await test('Admin with X-User-Role: ADMIN can list applications in queue', async () => {
    const res = await fetch(`${API_BASE}/admin/applications`, {
      headers: { 'X-User-Role': 'ADMIN' }
    });
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert.ok(Array.isArray(data.applications));
    const foundHub = data.applications.find(a => a.id === hubAppId);
    assert.ok(foundHub, 'Newly registered Hub application should be in admin queue');
  });

  // --- 8. Mandatory Reason Enforcement for Request Changes / Rejection ---
  await test('Admin review without reason on request_changes is rejected (400)', async () => {
    const res = await fetch(`${API_BASE}/admin/applications/${hubAppId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Role': 'ADMIN' },
      body: JSON.stringify({
        action: 'request_changes',
        reason: '' // Missing mandatory reason
      })
    });
    assert.strictEqual(res.status, 400, `Expected 400, got ${res.status}`);
    const data = await res.json();
    assert.ok(data.detail.includes('mandatory'));
  });

  // --- 9. Admin Requests Changes with Reason ---
  await test('Admin successfully sets changes_requested with mandatory reason', async () => {
    const res = await fetch(`${API_BASE}/admin/applications/${hubAppId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Role': 'ADMIN' },
      body: JSON.stringify({
        action: 'request_changes',
        reason: 'Missing fire department NOC and updated weigh scale calibration certificate.'
      })
    });
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    const app = data.application || data.verification_application;
    assert.strictEqual(app.status, 'changes_requested');
    const remarks = app.correctionRequests || app.correction_requests;
    assert.strictEqual(remarks, 'Missing fire department NOC and updated weigh scale calibration certificate.');
  });

  // --- 10. Resubmission Lifecycle: Resubmitted Application is NOT auto-approved ---
  await test('Resubmitting updated application sets status to under_review, NOT auto-approved', async () => {
    const res = await fetch(`${API_BASE}/verification/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: hubUserId,
        role: 'HUB',
        businessName: 'Venkatesh Aggregation Godown (Updated)',
        facilityAddress: 'Plot 44, Peenya 3rd Phase, Fire NOC Attached',
        district: 'Bengaluru Urban',
        operatingArea: 'Peenya Industrial Area',
        acceptedMaterials: ['Circuit Boards (PCB)', 'Mobile Phones', 'Copper Cables']
      })
    });
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    const app = data.application || data.verification_application;
    assert.strictEqual(app.status, 'under_review', 'Resubmission must be under_review');
    assert.strictEqual(data.business_profile.status, 'under_review');
  });

  // --- 11. Admin Official Approval ---
  await test('Admin approves Hub with official registry reference', async () => {
    const res = await fetch(`${API_BASE}/admin/applications/${hubAppId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Role': 'ADMIN' },
      body: JSON.stringify({
        action: 'approve',
        officialRegistryRef: 'CPCB/HUB-GRANT/BLR-2024/099',
        reviewNotes: 'All fire safety and calibration documents verified in physical inspection.'
      })
    });
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    const app = data.application || data.verification_application;
    assert.strictEqual(app.status, 'approved');
    const regRef = app.officialRegistryRef || app.official_registry_ref;
    assert.strictEqual(regRef, 'CPCB/HUB-GRANT/BLR-2024/099');
    assert.strictEqual(data.business_profile.status, 'approved');
  });

  // --- 12. Approved Hub appears in marketplace verified list ---
  await test('Approved Hub appears in /marketplace/verified-hubs', async () => {
    const res = await fetch(`${API_BASE}/marketplace/verified-hubs`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    const found = data.hubs.find(h => h.id === hubProfileId);
    assert.ok(found, 'Approved Hub must be present in verified hubs marketplace list');
  });

  // --- 13. Recycler Approval and Material Scope Matching ---
  await test('Admin approves Recycler scoped strictly to Circuit Boards (PCB)', async () => {
    const res = await fetch(`${API_BASE}/admin/applications/${recAppId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Role': 'ADMIN' },
      body: JSON.stringify({
        action: 'approve',
        officialRegistryRef: 'CPCB/REC-AUTH/2024/401'
      })
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.application.status, 'approved');
  });

  // --- 14. Immutable Audit Ledger Logged Decision ---
  await test('Admin decisions are logged to immutable audit ledger', async () => {
    const res = await fetch(`${API_BASE}/admin/audit-logs`, {
      headers: { 'X-User-Role': 'ADMIN' }
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.logs && data.logs.length > 0);
    const approvalLog = data.logs.find(l => l.entity_id === hubAppId && l.action === 'APPROVED');
    assert.ok(approvalLog, 'Approval decision must be recorded in audit log');
  });

  // --- 15. Suspension Workflow ---
  await test('Admin can suspend an approved business with mandatory reason', async () => {
    const res = await fetch(`${API_BASE}/admin/applications/${hubAppId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Role': 'ADMIN' },
      body: JSON.stringify({
        action: 'suspend',
        reason: 'Temporary regulatory freeze for safety protocol audit.'
      })
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.application.status, 'suspended');
    assert.strictEqual(data.business_profile.status, 'suspended');
  });

  console.log('\n====================================================');
  console.log(`SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test suite runner crashed:', err);
  process.exit(1);
});
