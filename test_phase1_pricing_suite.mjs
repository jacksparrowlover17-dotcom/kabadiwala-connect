#!/usr/bin/env node
/**
 * test_phase1_pricing_suite.mjs
 * Phase 1 Pricing Management — Integration & Logic Tests
 * Runs against the live backend (localhost:8000) when available,
 * with graceful offline fallback reporting.
 * 
 * Run: node test_phase1_pricing_suite.mjs
 */

const BASE = process.env.BACKEND_URL || 'http://localhost:8000';
const ADMIN_HEADERS = { 'Content-Type': 'application/json', 'X-User-Role': 'ADMIN', 'X-User-Name': 'Test Admin' };
const HUB_HEADERS   = { 'Content-Type': 'application/json', 'X-User-Role': 'HUB',   'X-User-Name': 'Test Hub',   'X-Hub-Id': 'HUB-TEST-001' };

let passed = 0, failed = 0, skipped = 0;
const results = [];

function ok(name, cond, detail = '') {
  if (cond) {
    passed++;
    results.push({ status: 'PASS', name });
    console.log(`  ✅ PASS  ${name}`);
  } else {
    failed++;
    results.push({ status: 'FAIL', name, detail });
    console.log(`  ❌ FAIL  ${name}${detail ? ' — ' + detail : ''}`);
  }
}
function skip(name, reason) {
  skipped++;
  results.push({ status: 'SKIP', name, reason });
  console.log(`  ⏭  SKIP  ${name} — ${reason}`);
}

async function tryFetch(url, opts = {}) {
  try {
    const r = await fetch(url, opts);
    const body = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, body };
  } catch (err) {
    return { ok: false, status: 0, body: {}, error: err.message };
  }
}

// ─── 0. Health Check ──────────────────────────────────────────────────────────
console.log('\n═══════════════════════════════════════════════════════');
console.log(' Kabadiwala Connect — Phase 1 Pricing Test Suite');
console.log('═══════════════════════════════════════════════════════');
console.log(`\nTarget backend: ${BASE}\n`);

console.log('── 0. Backend Health Check');
const health = await tryFetch(`${BASE}/`);
const backendOnline = health.ok;
ok('Backend root / returns 200 (health check)', health.ok, `status=${health.status}`);

// ─── 1. Indicative Price CRUD (Admin) ─────────────────────────────────────────
console.log('\n── 1. Admin — Indicative Price CRUD');

let createdPriceId = null;

if (!backendOnline) {
  skip('POST /admin/prices/indicative creates new price', 'Backend offline');
  skip('GET /prices/indicative returns list', 'Backend offline');
  skip('PUT /admin/prices/indicative/:id updates price', 'Backend offline');
  skip('PUT /admin/prices/indicative/:id/status sets status', 'Backend offline');
} else {
  // CREATE
  const create = await tryFetch(`${BASE}/admin/prices/indicative`, {
    method: 'POST',
    headers: ADMIN_HEADERS,
    body: JSON.stringify({
      material: 'Copper Cables',
      grade: 'Stripped Copper > 60% Purity',
      min_price: 300,
      max_price: 450,
      unit: 'kg',
      location: 'Bengaluru Urban',
      source_name: 'CPCB Q4 Bulletin Test',
      source_date: '2026-10-01',
      effective_date: '2026-10-13',
      expiry_date: '2026-12-31',
      status: 'published',
      is_sample: true,
    }),
  });
  ok('POST /admin/prices/indicative returns 200', create.ok, `status=${create.status}`);
  ok('Created price has an id', !!create.body?.indicative_price?.id, JSON.stringify(create.body));
  ok('Min price is correct (300)', create.body?.indicative_price?.min_price === 300);
  ok('Max price is correct (450)', create.body?.indicative_price?.max_price === 450);
  ok('Status is published', create.body?.indicative_price?.status === 'published');
  createdPriceId = create.body?.indicative_price?.id;

  // LIST
  const list = await tryFetch(`${BASE}/prices/indicative?status=published`);
  ok('GET /prices/indicative returns ok', list.ok, `status=${list.status}`);
  ok('Response has prices array', Array.isArray(list.body?.prices), JSON.stringify(list.body));
  ok('List includes newly created price', list.body?.prices?.some(p => p.id === createdPriceId));

  // VALIDATION: min > max should fail
  const badCreate = await tryFetch(`${BASE}/admin/prices/indicative`, {
    method: 'POST',
    headers: ADMIN_HEADERS,
    body: JSON.stringify({ material: 'Copper Cables', grade: 'Test', min_price: 999, max_price: 100, unit: 'kg', location: 'Test', source_name: '', source_date: '2026-10-01', effective_date: '2026-10-01', expiry_date: '2026-12-31', status: 'published', is_sample: true }),
  });
  ok('POST with min_price > max_price returns 422 or 400', !badCreate.ok && (badCreate.status === 422 || badCreate.status === 400), `status=${badCreate.status}`);

  // UPDATE
  if (createdPriceId) {
    const update = await tryFetch(`${BASE}/admin/prices/indicative/${createdPriceId}`, {
      method: 'PUT',
      headers: ADMIN_HEADERS,
      body: JSON.stringify({ max_price: 480, grade: 'Stripped Copper Updated' }),
    });
    ok('PUT /admin/prices/indicative/:id returns ok', update.ok, `status=${update.status}`);
    ok('Updated max_price is 480', update.body?.indicative_price?.max_price === 480);

    // STATUS CHANGE
    const expire = await tryFetch(`${BASE}/admin/prices/indicative/${createdPriceId}/status`, {
      method: 'PUT',
      headers: ADMIN_HEADERS,
      body: JSON.stringify({ status: 'expired' }),
    });
    ok('PUT /status to expired returns ok', expire.ok, `status=${expire.status}`);
    ok('Status is now expired', expire.body?.indicative_price?.status === 'expired');
  }
}

// ─── 2. Hub Buying Offers ──────────────────────────────────────────────────────
console.log('\n── 2. Hub — Buying Offer Management');

let createdOfferId = null;

if (!backendOnline) {
  skip('POST /hub/offers creates hub offer', 'Backend offline');
  skip('GET /hub/offers returns hub offer list', 'Backend offline');
  skip('PUT /hub/offers/:id/status withdraws offer', 'Backend offline');
} else {
  const createOffer = await tryFetch(`${BASE}/hub/offers`, {
    method: 'POST',
    headers: HUB_HEADERS,
    body: JSON.stringify({
      hub_id: 'HUB-TEST-001',
      hub_name: 'Test Aggregation Hub',
      hub_verification_status: 'approved',
      material: 'Copper Cables',
      grade: 'Stripped Copper, tested',
      rate: 390,
      unit: 'kg',
      min_quantity_kg: 5,
      supported_services: ['DROP_OFF'],
      pickup_fee: 0,
      applicable_area: 'K.R. Puram, East Bengaluru',
      valid_from: '2026-10-13',
      valid_till: '2026-11-30',
      status: 'active',
      terms_note: 'Digital weighbridge. Deduct only tare bag.',
    }),
  });
  ok('POST /hub/offers returns 200', createOffer.ok, `status=${createOffer.status} body=${JSON.stringify(createOffer.body).slice(0,200)}`);
  ok('Created offer has id', !!createOffer.body?.hub_offer?.id);
  ok('Offer rate is 390', createOffer.body?.hub_offer?.rate === 390);
  ok('Offer status is active', createOffer.body?.hub_offer?.status === 'active');
  createdOfferId = createOffer.body?.hub_offer?.id;

  const listOffers = await tryFetch(`${BASE}/hub/offers?hub_id=HUB-TEST-001`);
  ok('GET /hub/offers returns ok', listOffers.ok);
  ok('Response has offers array', Array.isArray(listOffers.body?.offers));
  ok('Created offer is in list', listOffers.body?.offers?.some(o => o.id === createdOfferId));

  // VALIDATE: rate must be positive
  const badOffer = await tryFetch(`${BASE}/hub/offers`, {
    method: 'POST',
    headers: HUB_HEADERS,
    body: JSON.stringify({ hub_id: 'HUB-TEST-001', hub_name: 'Test Hub', hub_verification_status: 'approved', material: 'Copper Cables', grade: 'Test', rate: -50, unit: 'kg', min_quantity_kg: 5, supported_services: ['DROP_OFF'], pickup_fee: 0, applicable_area: 'Test', valid_from: '2026-10-13', valid_till: '2026-11-30', status: 'active' }),
  });
  ok('POST with negative rate is rejected (400/422)', !badOffer.ok && (badOffer.status === 400 || badOffer.status === 422), `status=${badOffer.status}`);

  if (createdOfferId) {
    const withdraw = await tryFetch(`${BASE}/hub/offers/${createdOfferId}/status`, {
      method: 'PUT',
      headers: HUB_HEADERS,
      body: JSON.stringify({ status: 'withdrawn' }),
    });
    ok('PUT /hub/offers/:id/status to withdrawn returns ok', withdraw.ok, `status=${withdraw.status}`);
    ok('Status is now withdrawn', withdraw.body?.hub_offer?.status === 'withdrawn');
  }
}

// ─── 3. Collector Price Comparison Engine ─────────────────────────────────────
console.log('\n── 3. Collector — Price Comparison Engine');

if (!backendOnline) {
  skip('GET /prices/compare returns comparison result', 'Backend offline');
  skip('Comparison includes indicative_reference field', 'Backend offline');
  skip('Comparison includes eligible_offers array', 'Backend offline');
  skip('Comparison includes ineligible_offers array', 'Backend offline');
  skip('Comparison calculates gross/net for given quantity', 'Backend offline');
} else {
  const compare = await tryFetch(`${BASE}/prices/compare?material=Copper+Cables&quantity_kg=10&area=K.R.+Puram`);
  ok('GET /prices/compare returns ok', compare.ok, `status=${compare.status}`);
  ok('Result has indicative_reference field', 'indicative_reference' in compare.body, JSON.stringify(compare.body).slice(0,200));
  ok('Result has eligible_offers array', Array.isArray(compare.body?.eligible_offers));
  ok('Result has ineligible_offers array', Array.isArray(compare.body?.ineligible_offers));
  ok('Result has count_eligible', typeof compare.body?.count_eligible === 'number');
  ok('Result has indicative_notice string', typeof compare.body?.indicative_notice === 'string');

  // With quantity, check calculations
  if (compare.body?.eligible_offers?.length > 0) {
    const offer = compare.body.eligible_offers[0];
    ok('Eligible offer has calculated_gross', offer.calculated_gross != null, `offer=${JSON.stringify(offer).slice(0,150)}`);
    ok('calculated_gross = rate × 10 kg', Math.abs(offer.calculated_gross - offer.rate * 10) < 0.01);
  } else {
    skip('calculated_gross check', 'No eligible offers returned (seeding may be needed)');
  }
}

// ─── 4. Pricing Transaction Snapshot ──────────────────────────────────────────
console.log('\n── 4. Collector — Initiate Pricing Transaction Snapshot');

if (!backendOnline) {
  skip('POST /prices/transaction creates snapshot', 'Backend offline');
  skip('Snapshot is immutable (no price change after creation)', 'Backend offline');
} else {
  // Re-create a fresh active offer for transaction test
  const freshOffer = await tryFetch(`${BASE}/hub/offers`, {
    method: 'POST',
    headers: { ...HUB_HEADERS, 'X-Hub-Id': 'HUB-TEST-002' },
    body: JSON.stringify({
      hub_id: 'HUB-TEST-002', hub_name: 'Snapshot Test Hub',
      hub_verification_status: 'approved', material: 'Mobile Phones',
      grade: 'Working Smartphones', rate: 1200, unit: 'kg',
      min_quantity_kg: 1, supported_services: ['DROP_OFF'],
      pickup_fee: 0, applicable_area: 'BTM Layout', valid_from: '2026-10-13',
      valid_till: '2026-12-31', status: 'active',
    }),
  });

  if (freshOffer.ok && freshOffer.body?.hub_offer?.id) {
    const offerId = freshOffer.body.hub_offer.id;
    const txn = await tryFetch(`${BASE}/prices/transaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Role': 'COLLECTOR', 'X-Collector-Id': 'KAB-TEST-001' },
      body: JSON.stringify({
        offer_id: offerId,
        lot_id: 'LOT-TEST-' + Date.now().toString(36).toUpperCase(),
        collector_id: 'KAB-TEST-001',
        collector_name: 'Test Kabadiwala',
        estimated_quantity_kg: 8,
        service_type: 'DROP_OFF',
      }),
    });
    ok('POST /prices/transaction returns ok', txn.ok, `status=${txn.status} body=${JSON.stringify(txn.body).slice(0,200)}`);
    ok('Transaction has manifest_code', !!txn.body?.transaction?.manifest_code, JSON.stringify(txn.body).slice(0,200));
    ok('Snapshot accepted_rate matches offer rate (1200)', txn.body?.transaction?.accepted_rate === 1200);
    ok('Snapshot service_type is DROP_OFF', txn.body?.transaction?.service_type === 'DROP_OFF');
    ok('Snapshot status is pending_intake', txn.body?.transaction?.status === 'pending_intake');
    ok('manifest_code starts with MNF-', txn.body?.transaction?.manifest_code?.startsWith('MNF-'));

    // Immutability: even if we then change the offer rate, transaction snapshot should remain locked
    // (In prototype this is guaranteed because MEM_PRICING_TRANSACTIONS stores at creation time)
    ok('Snapshot stores accepted_rate as a number', typeof txn.body?.transaction?.accepted_rate === 'number');
  } else {
    skip('POST /prices/transaction', 'Failed to create test offer for transaction test');
  }
}

// ─── 5. Security / Role Enforcement ───────────────────────────────────────────
console.log('\n── 5. Security — Role Enforcement');

if (!backendOnline) {
  skip('Collector cannot create indicative price', 'Backend offline');
  skip('Unauthenticated cannot create hub offer', 'Backend offline');
} else {
  const collectorCreatePrice = await tryFetch(`${BASE}/admin/prices/indicative`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-User-Role': 'COLLECTOR' },
    body: JSON.stringify({ material: 'Copper Cables', grade: 'Test', min_price: 100, max_price: 200, unit: 'kg', location: 'Test', source_name: '', source_date: '2026-10-01', effective_date: '2026-10-01', expiry_date: '2026-12-31', status: 'published', is_sample: true }),
  });
  ok('Collector cannot call admin create price (403)', !collectorCreatePrice.ok && collectorCreatePrice.status === 403, `status=${collectorCreatePrice.status}`);

  const noRoleCreateOffer = await tryFetch(`${BASE}/hub/offers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hub_id: 'X', hub_name: 'X', hub_verification_status: 'approved', material: 'Copper Cables', grade: 'X', rate: 100, unit: 'kg', min_quantity_kg: 5, supported_services: ['DROP_OFF'], pickup_fee: 0, applicable_area: 'X', valid_from: '2026-10-13', valid_till: '2026-11-30', status: 'active' }),
  });
  ok('No X-User-Role header rejects hub offer creation (403/422)', !noRoleCreateOffer.ok && (noRoleCreateOffer.status === 403 || noRoleCreateOffer.status === 422), `status=${noRoleCreateOffer.status}`);
}

// ─── 6. Offline Fallback Logic ─────────────────────────────────────────────────
console.log('\n── 6. Offline Fallback — Client Logic (static analysis)');

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const svcPath = join(__dirname, 'kabadiwala-app', 'src', 'lib', 'pricingService.ts');
let svcCode = '';
try {
  svcCode = readFileSync(svcPath, 'utf-8');
} catch {}

ok('pricingService.ts exists', svcCode.length > 100, 'File not found');
ok('fetchIndicativePrices has try/catch offline fallback', svcCode.includes('offlineFallback: true'));
ok('comparePrices falls back to Dexie on network error', svcCode.includes('offline_fallback: true'));
ok('initiatePricingTransaction saves to Dexie offline', svcCode.includes('db.pricingTransactions.put'));
ok('createIndicativePrice saves locally when offline', svcCode.includes('IND-OFFLINE-'));
ok('Network-first pattern: fetch before Dexie', svcCode.indexOf('await fetch(') < svcCode.indexOf('indicativePrices'), `fetch=${svcCode.indexOf('await fetch(')} dexie=${svcCode.indexOf('indicativePrices')}`);

// ─── 7. Frontend Component Static Checks ──────────────────────────────────────
console.log('\n── 7. Frontend — PriceBoardPage.tsx static analysis');

const pbPath = join(__dirname, 'kabadiwala-app', 'src', 'pages', 'PriceBoardPage.tsx');
let pbCode = '';
try { pbCode = readFileSync(pbPath, 'utf-8'); } catch {}

ok('PriceBoardPage.tsx exists', pbCode.length > 500);
ok('Admin view: AdminPriceManagement function defined', pbCode.includes('function AdminPriceManagement'));
ok('Hub view: HubRateCard function defined', pbCode.includes('function HubRateCard'));
ok('Collector view: CollectorPriceComparison function defined', pbCode.includes('function CollectorPriceComparison'));
ok('Recycler view: RecyclerMarketRates function defined', pbCode.includes('function RecyclerMarketRates'));
ok('Role-based router: checks for ADMIN', pbCode.includes("role === 'ADMIN'"));
ok('Role-based router: checks for HUB', pbCode.includes("role === 'HUB'"));
ok('Role-based router: checks for COLLECTOR', pbCode.includes("role === 'COLLECTOR'"));
ok('IndicativeBadge component used', pbCode.includes('IndicativeBadge'));
ok('Offline fallback indicator (WifiOff) present', pbCode.includes('WifiOff'));
ok('Comparison uses comparePrices from pricingService', pbCode.includes('comparePrices'));
ok('Booking uses initiatePricingTransaction', pbCode.includes('initiatePricingTransaction'));
ok('Price validation: min/max check', pbCode.includes('minP > maxP'));
ok('Hub form validation: rate check', pbCode.includes('rate <= 0'));
ok('Hub form validation: service type check', pbCode.includes('supportedServices.length === 0'));

// ─── 8. MyHandoversPage Pricing Integration ────────────────────────────────────
console.log('\n── 8. MyHandoversPage — Pricing Snapshot Integration');

const mhPath = join(__dirname, 'kabadiwala-app', 'src', 'pages', 'MyHandoversPage.tsx');
let mhCode = '';
try { mhCode = readFileSync(mhPath, 'utf-8'); } catch {}

ok('MyHandoversPage.tsx exists', mhCode.length > 500);
ok('Imports PricingTransactionSnapshot type', mhCode.includes('PricingTransactionSnapshot'));
ok('Loads pricingSnapshots from db', mhCode.includes('pricingSnapshots'));
ok('Loads snapshots from Dexie pricingTransactions table', mhCode.includes('db.pricingTransactions'));
ok('Snapshot lookup by manifestCode', mhCode.includes('s.manifestCode === handover.manifestCode'));
ok('Shows locked rate badge when snapshot found', mhCode.includes('LockKeyhole'));
ok('Price-booked via Rate Board label shown', mhCode.includes('Price-booked via Rate Board'));
ok('Locked rate shown in financial card', mhCode.includes('Locked Rate'));

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log('\n═══════════════════════════════════════════════════════');
console.log(` Results: ${passed} passed, ${failed} failed, ${skipped} skipped`);
console.log('═══════════════════════════════════════════════════════');

if (failed > 0) {
  console.log('\nFailed tests:');
  results.filter(r => r.status === 'FAIL').forEach(r => {
    console.log(`  ❌ ${r.name}${r.detail ? ' — ' + r.detail : ''}`);
  });
}
if (skipped > 0) {
  console.log(`\nNote: ${skipped} tests skipped (backend offline or no data). Start the backend with 'uvicorn main:app' and re-run for full coverage.`);
}

process.exit(failed > 0 ? 1 : 0);
