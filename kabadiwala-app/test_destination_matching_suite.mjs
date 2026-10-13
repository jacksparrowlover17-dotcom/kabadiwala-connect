// test_destination_matching_suite.mjs
// Automated verification suite for Kabadiwala Connect Destination Finder & Smart Matching

const BACKEND_URL = 'http://localhost:8000';

async function runTests() {
  console.log('================================================================');
  console.log('KABADIWALA CONNECT — DESTINATION FINDER & SMART MATCHING SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, failureDetails = '') {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName} -> ${failureDetails}`);
      failed++;
    }
  }

  // -------------------------------------------------------------
  // Test 1: Hard Eligibility Gate — Unverified / Ineligible Facility
  // -------------------------------------------------------------
  console.log('\n--- 1. Verification Status Gate ---');
  try {
    const res = await fetch(`${BACKEND_URL}/destinations/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        material: 'Circuit Boards (PCB)',
        quantity_kg: 50.0,
        collector_lat: 12.9166,
        collector_lng: 77.6101,
        service_type: 'DROP_OFF',
      }),
    });
    const data = await res.json();

    const r3InEligible = data.eligible_destinations.find(d => d.partner.id === 'R3');
    const r3InIneligible = data.ineligible_destinations.find(d => d.partner.id === 'R3');

    assert(!r3InEligible, 'Unverified facility R3 excluded from eligible_destinations');
    assert(!!r3InIneligible, 'Unverified facility R3 segregated into ineligible_destinations');
    assert(
      r3InIneligible && r3InIneligible.reasons.some(r => r.toLowerCase().includes('not officially approved') || r.toLowerCase().includes('pending')),
      'Ineligible reasons explicitly cite pending/unapproved verification status'
    );
  } catch (err) {
    assert(false, 'Verification status gate failed with error', err.message);
  }

  // -------------------------------------------------------------
  // Test 2: Hard Eligibility Gate — Material Acceptance
  // -------------------------------------------------------------
  console.log('\n--- 2. Material Acceptance Gate ---');
  try {
    const res = await fetch(`${BACKEND_URL}/destinations/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        material: 'CRT Monitors & Glass',
        quantity_kg: 25.0,
        collector_lat: 12.9166,
        collector_lng: 77.6101,
        service_type: 'DROP_OFF',
      }),
    });
    const data = await res.json();

    const hub1Eligible = data.eligible_destinations.find(d => d.partner.id === 'HUB-BLR-01');
    const hub1Ineligible = data.ineligible_destinations.find(d => d.partner.id === 'HUB-BLR-01');

    assert(!hub1Eligible, 'HUB-BLR-01 excluded when material CRT is not in its accepted list');
    assert(
      hub1Ineligible && hub1Ineligible.reasons.some(r => r.includes('CRT Monitors & Glass') || r.includes('not accepted')),
      'Reason explains CRT Monitors & Glass is not accepted at HUB-BLR-01'
    );
  } catch (err) {
    assert(false, 'Material acceptance gate failed', err.message);
  }

  // -------------------------------------------------------------
  // Test 3: Hard Eligibility Gate — Minimum Batch Weight (Recycler)
  // -------------------------------------------------------------
  console.log('\n--- 3. Minimum Batch Weight Capacity Gate ---');
  try {
    // 3a. Small lot (15 kg) -> Formal Recycler R1 requires min 500 kg
    const resSmall = await fetch(`${BACKEND_URL}/destinations/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        material: 'Circuit Boards (PCB)',
        quantity_kg: 15.0,
        collector_lat: 12.9166,
        collector_lng: 77.6101,
        service_type: 'DROP_OFF',
      }),
    });
    const dataSmall = await resSmall.json();
    const r1Small = dataSmall.eligible_destinations.find(d => d.partner.id === 'R1');
    const r1Ineligible = dataSmall.ineligible_destinations.find(d => d.partner.id === 'R1');

    assert(!r1Small, 'Recycler R1 excluded for 15 kg lot (requires 50 kg minimum)');
    assert(
      r1Ineligible && r1Ineligible.reasons.some(r => r.toLowerCase().includes('below minimum')),
      'Ineligible reason cites quantity is below minimum intake threshold'
    );

    // 3b. Bulk lot (600 kg) -> R1 becomes eligible!
    const resBulk = await fetch(`${BACKEND_URL}/destinations/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        material: 'Circuit Boards (PCB)',
        quantity_kg: 600.0,
        collector_lat: 12.9166,
        collector_lng: 77.6101,
        service_type: 'DROP_OFF',
        max_distance_km: 100.0,
      }),
    });
    const dataBulk = await resBulk.json();
    const r1Bulk = dataBulk.eligible_destinations.find(d => d.partner.id === 'R1');
    assert(!!r1Bulk, 'Recycler R1 is eligible for bulk 600 kg batch');
  } catch (err) {
    assert(false, 'Minimum batch weight gate failed', err.message);
  }

  // -------------------------------------------------------------
  // Test 4: Hard Eligibility Gate — Service Method (Pickup vs Drop-off)
  // -------------------------------------------------------------
  console.log('\n--- 4. Service Logistics Method Gate ---');
  try {
    const res = await fetch(`${BACKEND_URL}/destinations/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        material: 'Circuit Boards (PCB)',
        quantity_kg: 20.0,
        collector_lat: 12.9166,
        collector_lng: 77.6101,
        service_type: 'PICKUP',
      }),
    });
    const data = await res.json();

    const hub2Eligible = data.eligible_destinations.find(d => d.partner.id === 'HUB-BLR-02');
    const hub2Ineligible = data.ineligible_destinations.find(d => d.partner.id === 'HUB-BLR-02');

    assert(!hub2Eligible, 'HUB-BLR-02 excluded when PICKUP requested (only supports DROP_OFF)');
    assert(
      hub2Ineligible && hub2Ineligible.reasons.some(r => r.includes('PICKUP')),
      'Ineligible reason states facility does not support PICKUP service'
    );

    const hub1Eligible = data.eligible_destinations.find(d => d.partner.id === 'HUB-BLR-01');
    assert(!!hub1Eligible, 'HUB-BLR-01 remains eligible for PICKUP service');
  } catch (err) {
    assert(false, 'Service logistics gate failed', err.message);
  }

  // -------------------------------------------------------------
  // Test 5: Explainable Multi-Factor Scoring
  // -------------------------------------------------------------
  console.log('\n--- 5. Explainable Ranking & Scoring ---');
  try {
    const res = await fetch(`${BACKEND_URL}/destinations/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        material: 'Circuit Boards (PCB)',
        quantity_kg: 20.0,
        collector_lat: 12.9166,
        collector_lng: 77.6101, // BTM Layout
        service_type: 'DROP_OFF',
        max_distance_km: 50.0,
      }),
    });
    const data = await res.json();

    assert(data.eligible_destinations.length >= 2, 'Multiple eligible hubs found for PCB scrap');

    const topMatch = data.eligible_destinations[0];
    assert(typeof topMatch.final_score === 'number' && topMatch.final_score > 0, 'Composite match score is calculated');
    assert(!!topMatch.score_breakdown, 'Score breakdown object is provided');
    assert(topMatch.score_breakdown.price_score >= 0, 'Price score factor present');
    assert(topMatch.score_breakdown.distance_score >= 0, 'Distance score factor present');
    assert(topMatch.score_breakdown.reliability_score >= 0, 'Reliability score factor present');
    assert(Array.isArray(topMatch.recommendation_tags) && topMatch.recommendation_tags.length > 0, 'Recommendation tags generated');
  } catch (err) {
    assert(false, 'Explainable scoring test failed', err.message);
  }

  // -------------------------------------------------------------
  // Test 6: Quote Request & 6-Digit Manifest Code Generation
  // -------------------------------------------------------------
  console.log('\n--- 6. Quote Request & Manifest Code Generation ---');
  const uniqueLotId = `LOT-EXP-${Date.now().toString().slice(-6)}`;
  let createdHandoverId = null;
  let collectorToken = null;
  let collectorId = 'KAB-7842';
  let hubToken = null;

  try {
    // Authenticate collector
    const regRes = await fetch(`${BACKEND_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `dest_collector_${Date.now()}@test.com`,
        fullName: 'Ramu Kabadiwala',
        phone: '+91 98450 78421',
        password: 'Password123!',
        role: 'COLLECTOR'
      })
    });
    const regData = await regRes.json();
    collectorToken = regData.token;
    collectorId = regData.user.id;

    // Authenticate hub
    const hubLogin = await fetch(`${BACKEND_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'hub.east@kabadiwala.in',
        password: 'Hub@123'
      })
    });
    const hubData = await hubLogin.json();
    hubToken = hubData.token;

    const res = await fetch(`${BACKEND_URL}/handovers/quote-request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${collectorToken}`
      },
      body: JSON.stringify({
        lot_id: uniqueLotId,
        collector_id: collectorId,
        collector_name: 'Ramu Kabadiwala',
        collector_location: 'BTM Layout, Ward 152',
        collector_phone: '+91 98450 78421',
        destination_id: 'HUB-BLR-01',
        material: 'Circuit Boards (PCB)',
        estimated_weight: 20.0,
        service_type: 'DROP_OFF',
        scheduled_date: '2026-10-15',
        notes: 'Dry e-waste boards, sorted capacitors',
      }),
    });

    assert(res.status === 200, `Quote request created successfully (Status ${res.status})`);
    const data = await res.json();
    assert(data.status === 'success', 'Response status is success');
    assert(!!data.handover, 'Handover object returned');
    assert(data.handover.lot_id === uniqueLotId, 'Handover retains original Lot ID');
    assert(/^MNF-\d{6}$/.test(data.handover.manifest_code), `Generated 6-digit manifest code matches pattern (${data.handover.manifest_code})`);
    assert(data.handover.status === 'quoted' || data.handover.status === 'scheduled', `Status initialized to valid state: ${data.handover.status}`);
    assert(data.handover.estimated_net_amount > 0, `Estimated net amount calculated: ₹${data.handover.estimated_net_amount}`);

    createdHandoverId = data.handover.id;
  } catch (err) {
    assert(false, 'Quote request generation failed', err.message);
  }

  // -------------------------------------------------------------
  // Test 7: Concurrency Conflict Check (409 Conflict)
  // -------------------------------------------------------------
  console.log('\n--- 7. Concurrency Conflict Prevention (409 Conflict) ---');
  try {
    const resConflict = await fetch(`${BACKEND_URL}/handovers/quote-request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${collectorToken}`
      },
      body: JSON.stringify({
        lot_id: uniqueLotId, // Duplicate active lot booking attempt!
        collector_id: collectorId,
        destination_id: 'HUB-BLR-02',
        material: 'Circuit Boards (PCB)',
        estimated_weight: 20.0,
        service_type: 'DROP_OFF',
      }),
    });

    assert(resConflict.status === 409, `Server rejects concurrent duplicate booking with HTTP 409 Conflict (Got ${resConflict.status})`);
    const errData = await resConflict.json();
    assert(errData.detail && errData.detail.includes('already has an active handover booking'), 'Error detail clearly identifies active booking collision');
  } catch (err) {
    assert(false, 'Concurrency check failed', err.message);
  }

  // -------------------------------------------------------------
  // Test 8: Handover Acceptance & Actual Weight Recalculation
  // -------------------------------------------------------------
  console.log('\n--- 8. Handover Acceptance & Weight Scale Intake ---');
  try {
    // 8a. Accept Quote
    const resAccept = await fetch(`${BACKEND_URL}/handovers/${createdHandoverId}/accept`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${collectorToken}`
      }
    });
    assert(resAccept.status === 200, 'Handover quote accepted successfully');
    const dataAccept = await resAccept.json();
    assert(dataAccept.handover.status === 'scheduled', 'Handover transitioned to scheduled');

    // 8b. Physical Intake at Facility Scale (Recalculate with actual weight 22.5 kg, ₹50 tare deduction)
    const resIntake = await fetch(`${BACKEND_URL}/handovers/${createdHandoverId}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${hubToken}`
      },
      body: JSON.stringify({
        status: 'completed',
        actual_weight: 22.5,
        deductions: 50.0,
        deduction_reason: 'Moisture and tare box weight',
        notes: 'Intake verified on certified digital scale',
      }),
    });

    assert(resIntake.status === 200, 'Handover physical intake recorded successfully');
    const dataIntake = await resIntake.json();
    const h = dataIntake.handover;

    assert(h.status === 'completed', 'Handover state reached completed');
    assert(h.actual_weight === 22.5, 'Actual scale weight saved: 22.5 kg');
    // Expected net = 22.5 kg * 250 rate - 50 deduction = 5625 - 50 = 5575
    assert(h.final_actual_amount === 5575.0, `Final payment recalculated on actual scale weight: ₹${h.final_actual_amount} (Expected ₹5575.0)`);
    assert(h.disclosed_deductions === 50.0, 'Disclosed deduction saved');
  } catch (err) {
    assert(false, 'Handover scale intake lifecycle failed', err.message);
  }

  // -------------------------------------------------------------
  // Test 9: Collector Handovers Retrieval
  // -------------------------------------------------------------
  console.log('\n--- 9. Collector Handover Manifests Retrieval ---');
  try {
    const res = await fetch(`${BACKEND_URL}/handovers/collector/${collectorId}`, {
      headers: {
        'Authorization': `Bearer ${collectorToken}`
      }
    });
    assert(res.status === 200, `GET /handovers/collector/${collectorId} returned 200 OK`);
    const data = await res.json();
    assert(Array.isArray(data.handovers) && data.handovers.length > 0, 'Collector manifests array returned');
    const found = data.handovers.find(h => h.id === createdHandoverId);
    assert(!!found, 'Created handover present in collector history list');
  } catch (err) {
    assert(false, 'Collector handovers query failed', err.message);
  }

  // -------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
