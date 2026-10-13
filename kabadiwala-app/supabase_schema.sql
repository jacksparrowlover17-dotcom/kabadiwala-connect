-- Supabase PostgreSQL Schema for Kabadiwala Connect Dataset
-- Extended for Hub-Based Aggregation, Collector Payments & CPCB Recycler Shipments

-- 1. Collectors Table (Anonymized)
CREATE TABLE IF NOT EXISTS public.collectors (
    id TEXT PRIMARY KEY,
    preferred_language TEXT NOT NULL DEFAULT 'hi', -- hi, mr, en, ta, te, kn
    general_operating_location TEXT NOT NULL,      -- e.g., 'Pune', 'Bangalore'
    transaction_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Recyclers Table (Authorized entities)
CREATE TABLE IF NOT EXISTS public.recyclers (
    id TEXT PRIMARY KEY,
    legal_name TEXT NOT NULL,
    cpcb_registration_number TEXT NOT NULL,
    registration_status TEXT DEFAULT 'REGISTERED', -- REGISTERED, EXPIRED, SUSPENDED
    facility_address TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    materials_accepted TEXT[], -- Array of material categories
    pickup_available BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Materials Dataset (Available E-Waste Categories)
CREATE TABLE IF NOT EXISTS public.materials (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,     -- e.g., 'PCB', 'CABLE', 'PHONE'
    description TEXT,
    regulatory_category TEXT,   -- Schedule I EEE code mapping
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Price Observations (The core intelligence dataset)
CREATE TABLE IF NOT EXISTS public.price_observations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id TEXT,
    recycler_id TEXT,
    location TEXT NOT NULL,
    buying_price NUMERIC NOT NULL, -- Price offered per unit
    unit TEXT DEFAULT 'kg',
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Hubs Table (Intermediate Aggregation Points)
CREATE TABLE IF NOT EXISTS public.hubs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    contact TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Lots (Digital Lots created by collectors offline)
CREATE TABLE IF NOT EXISTS public.lots (
    id TEXT PRIMARY KEY,
    collector_id TEXT,
    material TEXT NOT NULL,
    approx_weight NUMERIC NOT NULL,
    estimated_value NUMERIC,
    actual_weight NUMERIC,
    purchase_amount NUMERIC,
    status TEXT DEFAULT 'PENDING',
    hub_id TEXT,
    shipment_id TEXT,
    condition TEXT,
    photo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure all columns exist if the table was created earlier with partial columns
ALTER TABLE public.lots ADD COLUMN IF NOT EXISTS collector_id TEXT;
ALTER TABLE public.lots ADD COLUMN IF NOT EXISTS material TEXT;
ALTER TABLE public.lots ADD COLUMN IF NOT EXISTS approx_weight NUMERIC;
ALTER TABLE public.lots ADD COLUMN IF NOT EXISTS estimated_value NUMERIC;
ALTER TABLE public.lots ADD COLUMN IF NOT EXISTS actual_weight NUMERIC;
ALTER TABLE public.lots ADD COLUMN IF NOT EXISTS purchase_amount NUMERIC;
ALTER TABLE public.lots ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PENDING';
ALTER TABLE public.lots ADD COLUMN IF NOT EXISTS hub_id TEXT;
ALTER TABLE public.lots ADD COLUMN IF NOT EXISTS shipment_id TEXT;
ALTER TABLE public.lots ADD COLUMN IF NOT EXISTS condition TEXT;
ALTER TABLE public.lots ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- 7. Hub Purchases (Intake, Scale Weighbridge Verification & Pricing)
CREATE TABLE IF NOT EXISTS public.hub_purchases (
    id TEXT PRIMARY KEY,
    hub_id TEXT REFERENCES public.hubs(id),
    lot_id TEXT,
    collector_id TEXT,
    material TEXT NOT NULL,
    estimated_weight NUMERIC NOT NULL,
    actual_weight NUMERIC,
    agreed_rate NUMERIC,
    deductions NUMERIC DEFAULT 0,
    net_amount NUMERIC,
    status TEXT NOT NULL,
    weighed_at TIMESTAMP WITH TIME ZONE,
    confirmed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Collector Payments (Cash & UPI Settlement Ledger)
CREATE TABLE IF NOT EXISTS public.payments (
    id TEXT PRIMARY KEY,
    hub_id TEXT REFERENCES public.hubs(id),
    purchase_id TEXT,
    lot_id TEXT,
    collector_id TEXT,
    amount NUMERIC NOT NULL,
    mode TEXT NOT NULL, -- 'CASH' or 'UPI'
    reference_id TEXT,
    paid_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Outgoing Bulk Shipments (Form 6 Manifests to Recyclers)
CREATE TABLE IF NOT EXISTS public.shipments (
    id TEXT PRIMARY KEY,
    hub_id TEXT REFERENCES public.hubs(id),
    recycler_id TEXT,
    recycler_name TEXT NOT NULL,
    material TEXT NOT NULL,
    lot_ids JSONB NOT NULL,
    planned_quantity NUMERIC NOT NULL,
    dispatched_quantity NUMERIC,
    recycler_received_quantity NUMERIC,
    discrepancy_quantity NUMERIC,
    discrepancy_note TEXT,
    handover_hash TEXT NOT NULL,
    status TEXT NOT NULL,
    dispatched_at TIMESTAMP WITH TIME ZONE,
    received_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. Direct Handover Transactions & Traceability Dataset
CREATE TABLE IF NOT EXISTS public.transactions (
    id TEXT PRIMARY KEY,
    lot_id TEXT,
    collector_id TEXT,
    recycler_id TEXT,
    final_weight NUMERIC NOT NULL,
    final_price NUMERIC NOT NULL,
    handover_hash TEXT NOT NULL,
    payment_status TEXT DEFAULT 'PENDING',
    handover_location TEXT,
    handover_time TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Row Level Security (RLS) setup
ALTER TABLE public.collectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recyclers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Allow anonymous reads for public demo datasets
CREATE POLICY "Public Read Access Hubs" ON public.hubs FOR SELECT USING (true);
CREATE POLICY "Public Read Access Materials" ON public.materials FOR SELECT USING (true);
CREATE POLICY "Public Read Access Recyclers" ON public.recyclers FOR SELECT USING (true);
CREATE POLICY "Public Read Access Prices" ON public.price_observations FOR SELECT USING (true);
CREATE POLICY "Public Read Access Lots" ON public.lots FOR SELECT USING (true);
CREATE POLICY "Public Read Access Hub Purchases" ON public.hub_purchases FOR SELECT USING (true);
CREATE POLICY "Public Read Access Payments" ON public.payments FOR SELECT USING (true);
CREATE POLICY "Public Read Access Shipments" ON public.shipments FOR SELECT USING (true);
CREATE POLICY "Public Read Access Transactions" ON public.transactions FOR SELECT USING (true);

-- Upsert / Insert access for demo data sync
CREATE POLICY "Anon Write Lots" ON public.lots FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon Write Hub Purchases" ON public.hub_purchases FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon Write Payments" ON public.payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon Write Shipments" ON public.shipments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon Write Transactions" ON public.transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon Write Hubs" ON public.hubs FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- 11. USERS & ROLE-BASED ACCESS CONTROL (RBAC)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    full_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('COLLECTOR', 'HUB', 'RECYCLER', 'ADMIN')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 12. BUSINESS PROFILES (Hub Operators and Formal Recyclers)
CREATE TABLE IF NOT EXISTS public.business_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('HUB', 'RECYCLER')),
    business_name TEXT NOT NULL,
    authorized_contact TEXT NOT NULL,
    facility_address TEXT NOT NULL,
    district TEXT NOT NULL,
    operating_area TEXT,
    accepted_materials TEXT[] DEFAULT '{}',
    cpcb_registration_number TEXT,
    facility_scope TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 13. VERIFICATION APPLICATIONS & STATUS LIFECYCLE
-- Lifecycle states: pending_verification, under_review, changes_requested, approved, rejected, suspended, expired
CREATE TABLE IF NOT EXISTS public.verification_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_profile_id UUID REFERENCES public.business_profiles(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('HUB', 'RECYCLER')),
    status TEXT NOT NULL DEFAULT 'pending_verification' CHECK (status IN ('pending_verification', 'under_review', 'changes_requested', 'approved', 'rejected', 'suspended', 'expired')),
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewer_id UUID REFERENCES public.users(id),
    review_decision TEXT,
    review_notes TEXT,
    rejection_reason TEXT,
    correction_requests TEXT,
    official_registry_ref TEXT,
    registry_verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 14. VERIFICATION DOCUMENTS (Private Reference Metadata)
CREATE TABLE IF NOT EXISTS public.verification_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID REFERENCES public.verification_applications(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL, -- 'FACILITY_EVIDENCE', 'TRADE_LICENSE', 'CPCB_REGISTRATION', 'SPCB_CONSENT', 'ID_PROOF'
    document_name TEXT NOT NULL,
    file_path TEXT NOT NULL,     -- Secured storage path / encrypted base64 payload reference
    issue_date DATE,
    expiry_date DATE,
    is_valid BOOLEAN DEFAULT true,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 15. AUDIT LOGS (Immutable decision events for compliance)
CREATE TABLE IF NOT EXISTS public.verification_audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL, -- 'APPLICATION', 'USER', 'BUSINESS_PROFILE'
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,      -- 'SUBMITTED', 'UNDER_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'REJECTED', 'SUSPENDED', 'RESUBMITTED'
    performed_by TEXT NOT NULL,
    details JSONB DEFAULT '{}',
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance & quick administrative queries
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_verif_app_status ON public.verification_applications(status);
CREATE INDEX IF NOT EXISTS idx_verif_app_user ON public.verification_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_business_profile_user ON public.business_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON public.verification_audit_events(entity_id);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_audit_events ENABLE ROW LEVEL SECURITY;

-- Allow authenticated and demo sync policies
CREATE POLICY "Public Read Approved Profiles" ON public.business_profiles FOR SELECT USING (true);
CREATE POLICY "Public Read Applications" ON public.verification_applications FOR SELECT USING (true);
CREATE POLICY "Public Write Applications" ON public.verification_applications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Write Profiles" ON public.business_profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Write Documents" ON public.verification_documents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Write Audit" ON public.verification_audit_events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Write Users" ON public.users FOR ALL USING (true) WITH CHECK (true);
