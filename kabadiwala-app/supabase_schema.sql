-- Supabase PostgreSQL Schema for Kabadiwala Connect Dataset

-- 1. Collectors Table (Anonymized)
CREATE TABLE public.collectors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    preferred_language TEXT NOT NULL DEFAULT 'hi', -- hi, mr, en
    general_operating_location TEXT NOT NULL,      -- e.g., 'Pune', 'Mumbai'
    transaction_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Recyclers Table (Authorized entities)
CREATE TABLE public.recyclers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
CREATE TABLE public.materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL,     -- e.g., 'PCB', 'CABLE', 'PHONE'
    description TEXT,
    regulatory_category TEXT,   -- Schedule I EEE code mapping
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Price Observations (The core intelligence dataset)
CREATE TABLE public.price_observations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id UUID REFERENCES public.materials(id),
    recycler_id UUID REFERENCES public.recyclers(id),
    location TEXT NOT NULL,
    buying_price NUMERIC NOT NULL, -- Price offered per unit
    unit TEXT DEFAULT 'kg',
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Lots (Digital Lots created by collectors offline)
CREATE TABLE public.lots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collector_id UUID REFERENCES public.collectors(id),
    material_id UUID REFERENCES public.materials(id),
    approx_weight NUMERIC NOT NULL,
    estimated_value NUMERIC,
    status TEXT DEFAULT 'PENDING', -- PENDING, HANDED_OVER, CANCELLED
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Transactions & Traceability Dataset
CREATE TABLE public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lot_id UUID REFERENCES public.lots(id),
    collector_id UUID REFERENCES public.collectors(id),
    recycler_id UUID REFERENCES public.recyclers(id),
    final_weight NUMERIC NOT NULL,
    final_price NUMERIC NOT NULL,
    handover_hash TEXT NOT NULL, -- The 6-digit verification code proof
    payment_status TEXT DEFAULT 'PENDING', -- PENDING, PAID_CASH, PAID_UPI
    handover_location TEXT, -- GPS or generalized string
    handover_time TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Row Level Security (RLS) setup for mobile API
ALTER TABLE public.collectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recyclers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Allow anonymous reads for public datasets (prices, materials, recyclers)
CREATE POLICY "Public Read Access" ON public.materials FOR SELECT USING (true);
CREATE POLICY "Public Read Access" ON public.recyclers FOR SELECT USING (true);
CREATE POLICY "Public Read Access" ON public.price_observations FOR SELECT USING (true);

-- Collectors can insert lots and transactions (API layer security logic pending)
CREATE POLICY "Anon Insert Lots" ON public.lots FOR INSERT WITH CHECK (true);
CREATE POLICY "Anon Insert Transactions" ON public.transactions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anon Insert Collectors" ON public.collectors FOR INSERT WITH CHECK (true);
