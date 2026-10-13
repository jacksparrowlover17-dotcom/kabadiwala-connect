-- ============================================================================
-- Migration: 001_priority2_core_schema.sql
-- Description: Core Persistent Storage Schema, Foreign Keys, Indexes & RLS
-- Target: PostgreSQL / Supabase
-- Applied for: Kabadiwala Connect (Priority 2)
-- ============================================================================

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    full_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('COLLECTOR', 'HUB', 'RECYCLER', 'ADMIN')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- 2. BUSINESS PROFILES (Hubs & Formal Recyclers)
CREATE TABLE IF NOT EXISTS public.business_profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('HUB', 'RECYCLER')),
    business_name TEXT NOT NULL,
    authorized_contact TEXT NOT NULL,
    facility_address TEXT NOT NULL,
    district TEXT NOT NULL,
    operating_area TEXT,
    accepted_materials TEXT[] DEFAULT '{}',
    cpcb_registration_number TEXT,
    facility_scope TEXT,
    status TEXT NOT NULL DEFAULT 'pending_verification' CHECK (status IN ('pending_verification', 'under_review', 'changes_requested', 'approved', 'rejected', 'suspended', 'expired')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_business_profile_user ON public.business_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_business_profile_status ON public.business_profiles(status);

-- 3. VERIFICATION APPLICATIONS
CREATE TABLE IF NOT EXISTS public.verification_applications (
    id TEXT PRIMARY KEY,
    business_profile_id TEXT REFERENCES public.business_profiles(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('HUB', 'RECYCLER')),
    status TEXT NOT NULL DEFAULT 'pending_verification' CHECK (status IN ('pending_verification', 'under_review', 'changes_requested', 'approved', 'rejected', 'suspended', 'expired')),
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewer_id TEXT REFERENCES public.users(id),
    review_decision TEXT,
    review_notes TEXT,
    rejection_reason TEXT,
    correction_requests TEXT,
    official_registry_ref TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_verif_app_status ON public.verification_applications(status);
CREATE INDEX IF NOT EXISTS idx_verif_app_user ON public.verification_applications(user_id);

-- 4. VERIFICATION DOCUMENTS
CREATE TABLE IF NOT EXISTS public.verification_documents (
    id TEXT PRIMARY KEY,
    application_id TEXT REFERENCES public.verification_applications(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL,
    document_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    issue_date DATE,
    expiry_date DATE,
    is_valid BOOLEAN DEFAULT true,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    performed_by TEXT NOT NULL,
    details JSONB DEFAULT '{}',
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON public.audit_logs(entity_id);

-- 6. INDICATIVE PRICES (CPCB / SPCB Regulatory Reference Bands)
CREATE TABLE IF NOT EXISTS public.indicative_prices (
    id TEXT PRIMARY KEY,
    material TEXT NOT NULL,
    grade TEXT NOT NULL,
    min_price NUMERIC NOT NULL CHECK (min_price >= 0),
    max_price NUMERIC NOT NULL CHECK (max_price >= min_price),
    unit TEXT NOT NULL DEFAULT 'kg',
    location TEXT NOT NULL,
    source_name TEXT,
    source_date DATE,
    effective_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'draft', 'expired')),
    is_sample BOOLEAN DEFAULT false,
    created_by TEXT,
    updated_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ind_prices_mat ON public.indicative_prices(material, status);

-- 7. HUB BUYING OFFERS
CREATE TABLE IF NOT EXISTS public.hub_offers (
    id TEXT PRIMARY KEY,
    hub_id TEXT NOT NULL,
    hub_name TEXT NOT NULL,
    hub_verification_status TEXT NOT NULL DEFAULT 'approved',
    material TEXT NOT NULL,
    grade TEXT NOT NULL,
    rate NUMERIC NOT NULL CHECK (rate > 0),
    unit TEXT NOT NULL DEFAULT 'kg',
    min_quantity_kg NUMERIC NOT NULL DEFAULT 5.0 CHECK (min_quantity_kg > 0),
    supported_services TEXT[] DEFAULT '{"DROP_OFF"}',
    pickup_fee NUMERIC DEFAULT 0.0 CHECK (pickup_fee >= 0),
    applicable_area TEXT,
    valid_from DATE NOT NULL,
    valid_till DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'withdrawn', 'expired')),
    terms_note TEXT,
    is_sample BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hub_offers_hub ON public.hub_offers(hub_id, status);
CREATE INDEX IF NOT EXISTS idx_hub_offers_mat ON public.hub_offers(material, status);

-- 8. LOTS (Collector Scrap Batches)
CREATE TABLE IF NOT EXISTS public.lots (
    id TEXT PRIMARY KEY,
    collector_id TEXT NOT NULL,
    collector_name TEXT,
    material TEXT NOT NULL,
    approx_weight NUMERIC NOT NULL CHECK (approx_weight > 0),
    estimated_value NUMERIC CHECK (estimated_value >= 0),
    actual_weight NUMERIC CHECK (actual_weight >= 0),
    purchase_amount NUMERIC CHECK (purchase_amount >= 0),
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN (
        'PENDING', 'REQUESTED', 'ACCEPTED', 'REJECTED', 'RECEIVED',
        'AWAITING_COLLECTOR_CONFIRMATION', 'PURCHASE_CONFIRMED',
        'PAYMENT_PENDING', 'PAID', 'HANDOVER_READY', 'COMPLETED', 'CANCELLED'
    )),
    hub_id TEXT,
    shipment_id TEXT,
    condition TEXT,
    photo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sync_status TEXT DEFAULT 'synced'
);
CREATE INDEX IF NOT EXISTS idx_lots_collector ON public.lots(collector_id, status);
CREATE INDEX IF NOT EXISTS idx_lots_hub ON public.lots(hub_id, status);

-- 9. HANDOVER REQUESTS & BOOKINGS
CREATE TABLE IF NOT EXISTS public.handover_requests (
    id TEXT PRIMARY KEY,
    lot_id TEXT NOT NULL,
    collector_id TEXT NOT NULL,
    collector_name TEXT NOT NULL,
    collector_location TEXT NOT NULL,
    collector_phone TEXT,
    destination_id TEXT NOT NULL,
    destination_name TEXT NOT NULL,
    destination_type TEXT NOT NULL CHECK (destination_type IN ('HUB', 'RECYCLER')),
    material TEXT NOT NULL,
    estimated_weight NUMERIC NOT NULL,
    actual_weight NUMERIC,
    service_type TEXT NOT NULL CHECK (service_type IN ('DROP_OFF', 'PICKUP')),
    price_state TEXT NOT NULL DEFAULT 'quoted',
    offered_rate_per_kg NUMERIC NOT NULL,
    pickup_fee NUMERIC DEFAULT 0.0,
    disclosed_deductions NUMERIC DEFAULT 0.0,
    deduction_reason TEXT,
    estimated_net_amount NUMERIC NOT NULL,
    final_actual_amount NUMERIC,
    manifest_code TEXT,
    status TEXT NOT NULL DEFAULT 'quoted',
    scheduled_date DATE,
    quote_expires_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_active_lot_booking UNIQUE (lot_id, manifest_code)
);
CREATE INDEX IF NOT EXISTS idx_handovers_lot ON public.handover_requests(lot_id);
CREATE INDEX IF NOT EXISTS idx_handovers_collector ON public.handover_requests(collector_id, status);
CREATE INDEX IF NOT EXISTS idx_handovers_dest ON public.handover_requests(destination_id, status);

-- 10. PRICING TRANSACTIONS (Authoritative Snapshots)
CREATE TABLE IF NOT EXISTS public.pricing_transactions (
    id TEXT PRIMARY KEY,
    lot_id TEXT NOT NULL,
    offer_id TEXT,
    indicative_reference_id TEXT,
    collector_id TEXT NOT NULL,
    collector_name TEXT NOT NULL,
    hub_id TEXT NOT NULL,
    hub_name TEXT NOT NULL,
    material TEXT NOT NULL,
    grade TEXT NOT NULL,
    offered_rate NUMERIC NOT NULL,
    accepted_rate NUMERIC NOT NULL,
    estimated_weight NUMERIC NOT NULL,
    actual_accepted_weight NUMERIC,
    gross_amount NUMERIC,
    disclosed_deductions NUMERIC DEFAULT 0.0,
    deduction_reason TEXT,
    pickup_fee NUMERIC DEFAULT 0.0,
    final_payable_amount NUMERIC,
    service_type TEXT NOT NULL CHECK (service_type IN ('DROP_OFF', 'PICKUP')),
    manifest_code TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'OFFER_ACCEPTED',
    collector_approved BOOLEAN DEFAULT false,
    payment_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (payment_status IN ('PENDING', 'PAID')),
    payment_reference TEXT,
    paid_at TIMESTAMP WITH TIME ZONE,
    accepted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pricing_tx_lot ON public.pricing_transactions(lot_id);
CREATE INDEX IF NOT EXISTS idx_pricing_tx_collector ON public.pricing_transactions(collector_id);
CREATE INDEX IF NOT EXISTS idx_pricing_tx_hub ON public.pricing_transactions(hub_id);

-- 11. HUB PURCHASES (Intake, Scale Verification & Settlement)
CREATE TABLE IF NOT EXISTS public.hub_purchases (
    id TEXT PRIMARY KEY,
    hub_id TEXT NOT NULL,
    lot_id TEXT NOT NULL,
    collector_id TEXT NOT NULL,
    material TEXT NOT NULL,
    estimated_weight NUMERIC NOT NULL,
    actual_weight NUMERIC,
    agreed_rate NUMERIC,
    deductions NUMERIC DEFAULT 0,
    net_amount NUMERIC,
    status TEXT NOT NULL CHECK (status IN (
        'AWAITING_WEIGHT', 'AWAITING_COLLECTOR_CONFIRMATION', 'PURCHASE_CONFIRMED',
        'PAYMENT_PENDING', 'PAID', 'REJECTED', 'CANCELLED'
    )),
    weighed_at TIMESTAMP WITH TIME ZONE,
    confirmed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_purchases_hub ON public.hub_purchases(hub_id, status);

-- 12. PAYMENTS (Ledger)
CREATE TABLE IF NOT EXISTS public.payments (
    id TEXT PRIMARY KEY,
    hub_id TEXT NOT NULL,
    purchase_id TEXT,
    lot_id TEXT,
    collector_id TEXT NOT NULL,
    amount NUMERIC NOT NULL CHECK (amount >= 0),
    mode TEXT NOT NULL CHECK (mode IN ('CASH', 'UPI')),
    reference_id TEXT,
    status TEXT NOT NULL DEFAULT 'CONFIRMED',
    paid_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payments_collector ON public.payments(collector_id);
CREATE INDEX IF NOT EXISTS idx_payments_hub ON public.payments(hub_id);

-- 13. SHIPMENTS (Outgoing Recycler Manifests)
CREATE TABLE IF NOT EXISTS public.shipments (
    id TEXT PRIMARY KEY,
    hub_id TEXT NOT NULL,
    recycler_id TEXT NOT NULL,
    recycler_name TEXT NOT NULL,
    material TEXT NOT NULL,
    lot_ids JSONB NOT NULL,
    planned_quantity NUMERIC NOT NULL CHECK (planned_quantity > 0),
    dispatched_quantity NUMERIC,
    recycler_received_quantity NUMERIC,
    discrepancy_quantity NUMERIC,
    discrepancy_note TEXT,
    handover_hash TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('DRAFT', 'READY', 'DISPATCHED', 'RECEIVED_BY_RECYCLER', 'COMPLETED', 'CANCELLED')),
    dispatched_at TIMESTAMP WITH TIME ZONE,
    received_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_shipments_hub ON public.shipments(hub_id);
CREATE INDEX IF NOT EXISTS idx_shipments_recycler ON public.shipments(recycler_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.indicative_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.handover_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;

-- 1. Public Read Policies for Reference Data
CREATE POLICY "Public Read Indicative Prices" ON public.indicative_prices FOR SELECT USING (status = 'published');
CREATE POLICY "Public Read Active Hub Offers" ON public.hub_offers FOR SELECT USING (status = 'active');
CREATE POLICY "Public Read Approved Profiles" ON public.business_profiles FOR SELECT USING (status = 'approved');

-- 2. Authenticated Scoped Policies
-- Lots: Collectors can read/write their own lots; Hubs can read lots requested or assigned to them
CREATE POLICY "Collector Own Lots Read" ON public.lots FOR SELECT USING (auth.uid() = collector_id OR auth.jwt() ->> 'role' IN ('ADMIN', 'HUB'));
CREATE POLICY "Collector Own Lots Insert" ON public.lots FOR INSERT WITH CHECK (auth.uid() = collector_id);
CREATE POLICY "Collector Own Lots Update" ON public.lots FOR UPDATE USING (auth.uid() = collector_id OR auth.jwt() ->> 'role' IN ('ADMIN', 'HUB'));

-- Handover Requests: Collector and Destination Hub/Recycler access
CREATE POLICY "Handover Read" ON public.handover_requests FOR SELECT USING (auth.uid() = collector_id OR auth.uid() = destination_id OR auth.jwt() ->> 'role' = 'ADMIN');
CREATE POLICY "Handover Insert" ON public.handover_requests FOR INSERT WITH CHECK (auth.uid() = collector_id);

-- Hub Offers: Hubs manage their own offers; Admins manage all
CREATE POLICY "Hub Manage Offers" ON public.hub_offers FOR ALL USING (auth.uid() = hub_id OR auth.jwt() ->> 'role' = 'ADMIN');

-- Indicative Prices: Only Admins can insert/update
CREATE POLICY "Admin Manage Indicative Prices" ON public.indicative_prices FOR ALL USING (auth.jwt() ->> 'role' = 'ADMIN');

-- Payments: Collectors and Hubs see their transactions
CREATE POLICY "Payments Read" ON public.payments FOR SELECT USING (auth.uid() = collector_id OR auth.uid() = hub_id OR auth.jwt() ->> 'role' = 'ADMIN');

-- Shipments: Hubs and Recyclers see their manifests
CREATE POLICY "Shipments Read" ON public.shipments FOR SELECT USING (auth.uid() = hub_id OR auth.uid() = recycler_id OR auth.jwt() ->> 'role' = 'ADMIN');
