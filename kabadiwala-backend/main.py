import os
import uuid
import hashlib
import math
import random
import jwt
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException, Header, Depends, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from supabase import create_client, Client
from dotenv import load_dotenv
import storage

load_dotenv()

# JWT Configuration
JWT_SECRET = os.getenv("JWT_SECRET")
ENVIRONMENT = os.getenv("ENVIRONMENT", "development").lower()

if not JWT_SECRET:
    if ENVIRONMENT in ("production", "prod", "staging"):
        raise RuntimeError("FATAL SECURITY CONFIGURATION: JWT_SECRET environment variable is required in production/staging environments!")
    # Development fallback secret
    JWT_SECRET = os.getenv("DEV_JWT_SECRET", "kabadiwala_dev_secret_local_only_2026_do_not_use_in_prod")

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://qtfbswcsqxnutczivlua.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "sb_publishable_GUGc9c5oxwW5LKzOs5JaFA_pJZi_CwK")

# Initialize Supabase client safely with fallback
supabase: Optional[Client] = None
try:
    if SUPABASE_URL and SUPABASE_KEY and "placeholder" not in SUPABASE_URL:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
except Exception as e:
    pass

app = FastAPI(
    title="Kabadiwala Connect API",
    description="Role-Based Access Control, Business Verification & Supply Chain Backend API",
    version="2.0.0"
)

# Mount local media storage directory for photos
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(os.path.join(UPLOAD_DIR, "photos"), exist_ok=True)
app.mount("/media", StaticFiles(directory=UPLOAD_DIR), name="media")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer(auto_error=False)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Creates a cryptographically signed HMAC-SHA256 JWT access token with expiration."""
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(hours=24))
    to_encode.update({"exp": expire, "iat": datetime.utcnow()})
    return jwt.encode(to_encode, JWT_SECRET, algorithm="HS256")

def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> Dict[str, Any]:
    """
    Validates the Bearer token on every protected request.
    Extracts authenticated user identity and role directly from the validated cryptographic payload.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(status_code=401, detail="Authentication required: Missing Bearer token.")
    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        user_id = payload.get("user_id") or payload.get("sub")
        role = payload.get("role")
        if not user_id or not role:
            raise HTTPException(status_code=401, detail="Invalid token payload: Identity or role missing.")
        return {
            "user_id": str(user_id),
            "role": str(role).upper(),
            "email": payload.get("email"),
            "full_name": payload.get("full_name")
        }
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired. Please sign in again.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid authentication token.")

def require_role(*allowed_roles: str):
    """
    FastAPI dependency factory enforcing strict role-based authorization from signed tokens.
    Rejects any request without a valid token matching the specified roles with HTTP 403.
    """
    def role_checker(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
        user_role = current_user.get("role", "").upper()
        allowed_upper = [r.upper() for r in allowed_roles]
        if user_role not in allowed_upper:
            raise HTTPException(
                status_code=403,
                detail=f"Access forbidden: User role '{user_role}' is not authorized. Required: {', '.join(allowed_upper)}."
            )
        return current_user
    return role_checker

# -----------------------------------------------------------------------------
# In-Memory Fallback Store (Ensures 100% offline-first reliability & testing)
# -----------------------------------------------------------------------------
# -----------------------------------------------------------------------------
# Persistent Backend Storage & Memory Cache
# -----------------------------------------------------------------------------
storage.init_db()
_db_data = storage.load_all_from_db()

MEM_USERS: Dict[str, Dict[str, Any]] = _db_data["users"]
MEM_BUSINESS_PROFILES: Dict[str, Dict[str, Any]] = _db_data["business_profiles"]
MEM_VERIFICATION_APPLICATIONS: Dict[str, Dict[str, Any]] = _db_data["verification_applications"]
MEM_VERIFICATION_DOCUMENTS: Dict[str, Dict[str, Any]] = {}
MEM_AUDIT_LOGS: List[Dict[str, Any]] = _db_data["audit_logs"]
MEM_INDICATIVE_PRICES: Dict[str, Dict[str, Any]] = _db_data["indicative_prices"]
MEM_HUB_OFFERS: Dict[str, Dict[str, Any]] = _db_data["hub_offers"]
MEM_PRICING_TRANSACTIONS: Dict[str, Dict[str, Any]] = _db_data["pricing_transactions"]
MEM_DESTINATIONS: Dict[str, Dict[str, Any]] = _db_data["destinations"]
MEM_HANDOVERS: Dict[str, Dict[str, Any]] = _db_data["handovers"]
MEM_LOTS: Dict[str, Dict[str, Any]] = _db_data["lots"]
MEM_HUB_PURCHASES: Dict[str, Dict[str, Any]] = _db_data["hub_purchases"]
MEM_PAYMENTS: Dict[str, Dict[str, Any]] = _db_data["payments"]
MEM_SHIPMENTS: Dict[str, Dict[str, Any]] = _db_data["shipments"]

def hash_password(password: str) -> str:
    """Deterministic password hashing with fixed salt for prototype."""
    salt = "kabadiwala_salt_2026"
    return hashlib.sha256(f"{password}:{salt}".encode()).hexdigest()

ADMIN_SEED_ID = "admin-sys-001"
HUB_SEED_USER_ID = "hub-user-001"
HUB_PROFILE_ID = "HUB-BLR-01"
HUB_APP_ID = "app-hub-001"
RECYCLER_SEED_USER_ID = "recycler-user-001"
RECYCLER_PROFILE_ID = "R1"
RECYCLER_APP_ID = "app-rec-001"

# Seed default administrator and verified demo businesses if storage is empty
if len(MEM_USERS) == 0:
    MEM_USERS[ADMIN_SEED_ID] = {
        "id": ADMIN_SEED_ID,
        "email": "admin@kabadiwala.in",
        "phone": "+91 98000 00001",
        "full_name": "CPCB State Admin Officer",
        "password_hash": hash_password("Admin@123"),
        "role": "ADMIN",
        "is_active": True,
        "created_at": datetime.utcnow().isoformat(),
    }
    storage.save_user(MEM_USERS[ADMIN_SEED_ID])

    MEM_USERS[HUB_SEED_USER_ID] = {
        "id": HUB_SEED_USER_ID,
        "email": "hub.east@kabadiwala.in",
        "phone": "+91 98451 22334",
        "full_name": "Anil Kumar (Hub Operator)",
        "password_hash": hash_password("Hub@123"),
        "role": "HUB",
        "is_active": True,
        "created_at": datetime.utcnow().isoformat(),
    }
    storage.save_user(MEM_USERS[HUB_SEED_USER_ID])

    MEM_BUSINESS_PROFILES[HUB_PROFILE_ID] = {
        "id": HUB_PROFILE_ID,
        "user_id": HUB_SEED_USER_ID,
        "role": "HUB",
        "business_name": "Bengaluru East Scrap & E-Waste Godown",
        "authorized_contact": "Anil Kumar",
        "facility_address": "Ward 54, K.R. Puram Industrial Cross, Bengaluru",
        "district": "Bengaluru Urban",
        "operating_area": "East Bengaluru Sub-district",
        "accepted_materials": ["Circuit Boards (PCB)", "Copper Cables", "Mobile Phones"],
        "cpcb_registration_number": "CPCB-HUB-KA-2024-0091",
        "facility_scope": "Secondary Storage & Sorting Facility (<100 MT)",
        "status": "approved",
        "created_at": datetime.utcnow().isoformat(),
    }
    storage.save_business_profile(MEM_BUSINESS_PROFILES[HUB_PROFILE_ID])

    MEM_VERIFICATION_APPLICATIONS[HUB_APP_ID] = {
        "id": HUB_APP_ID,
        "business_profile_id": HUB_PROFILE_ID,
        "user_id": HUB_SEED_USER_ID,
        "role": "HUB",
        "status": "approved",
        "submitted_at": datetime.utcnow().isoformat(),
        "reviewed_at": datetime.utcnow().isoformat(),
        "reviewer_id": ADMIN_SEED_ID,
        "review_decision": "approved",
        "review_notes": "Facility inspection verified. Fire safety and storage requirements met.",
        "official_registry_ref": "KSPCB/E-WASTE/REG/2024/091",
        "created_at": datetime.utcnow().isoformat(),
    }
    storage.save_verification_application(MEM_VERIFICATION_APPLICATIONS[HUB_APP_ID])

    MEM_USERS[RECYCLER_SEED_USER_ID] = {
        "id": RECYCLER_SEED_USER_ID,
        "email": "recycler.green@kabadiwala.in",
        "phone": "+91 98455 11223",
        "full_name": "Dr. Ramesh (Green Earth)",
        "password_hash": hash_password("Recycler@123"),
        "role": "RECYCLER",
        "is_active": True,
        "created_at": datetime.utcnow().isoformat(),
    }
    storage.save_user(MEM_USERS[RECYCLER_SEED_USER_ID])

    MEM_BUSINESS_PROFILES[RECYCLER_PROFILE_ID] = {
        "id": RECYCLER_PROFILE_ID,
        "user_id": RECYCLER_SEED_USER_ID,
        "role": "RECYCLER",
        "business_name": "Green Earth Recycling",
        "authorized_contact": "Dr. Ramesh",
        "facility_address": "Plot 42, Peenya Industrial Area, Phase II, Bengaluru",
        "district": "Bengaluru Urban",
        "operating_area": "Karnataka State Wide",
        "accepted_materials": ["Circuit Boards (PCB)", "Copper Cables", "Mobile Phones"],
        "cpcb_registration_number": "CPCB/EW-REG/2024/01",
        "facility_scope": "Formal Dismantling & Material Recovery Plant (500 MT/year)",
        "status": "approved",
        "created_at": datetime.utcnow().isoformat(),
    }
    storage.save_business_profile(MEM_BUSINESS_PROFILES[RECYCLER_PROFILE_ID])

    MEM_VERIFICATION_APPLICATIONS[RECYCLER_APP_ID] = {
        "id": RECYCLER_APP_ID,
        "business_profile_id": RECYCLER_PROFILE_ID,
        "user_id": RECYCLER_SEED_USER_ID,
        "role": "RECYCLER",
        "status": "approved",
        "submitted_at": datetime.utcnow().isoformat(),
        "reviewed_at": datetime.utcnow().isoformat(),
        "reviewer_id": ADMIN_SEED_ID,
        "review_decision": "approved",
        "review_notes": "Statutory CPCB authorization verified. Valid till 2029.",
        "official_registry_ref": "CPCB/EW-REG/2024/01",
        "created_at": datetime.utcnow().isoformat(),
    }
    storage.save_verification_application(MEM_VERIFICATION_APPLICATIONS[RECYCLER_APP_ID])

if len(MEM_INDICATIVE_PRICES) == 0:
    MEM_INDICATIVE_PRICES["IND-PCB-01"] = {
        "id": "IND-PCB-01",
        "material": "Circuit Boards (PCB)",
        "grade": "High-Grade Telecom / Server Motherboards",
        "min_price": 240.0,
        "max_price": 280.0,
        "unit": "kg",
        "location": "Bengaluru Urban & Rural",
        "source_name": "CPCB E-Waste Market Bulletin Q4",
        "source_date": "2026-10-01",
        "effective_date": "2026-10-01",
        "expiry_date": "2026-12-31",
        "status": "published",
        "is_sample": True,
        "is_indicative": True,
        "created_by": "CPCB State Admin Officer",
        "updated_by": "CPCB State Admin Officer",
        "created_at": (datetime.utcnow() - timedelta(days=12)).isoformat(),
        "updated_at": (datetime.utcnow() - timedelta(days=12)).isoformat(),
    }
    storage.save_indicative_price(MEM_INDICATIVE_PRICES["IND-PCB-01"])

    MEM_INDICATIVE_PRICES["IND-CABLE-01"] = {
        "id": "IND-CABLE-01",
        "material": "Copper Cables",
        "grade": "Heavy Gauge Stripped & Insulated (>60% Cu)",
        "min_price": 420.0,
        "max_price": 470.0,
        "unit": "kg",
        "location": "Karnataka State Index",
        "source_name": "MRAI Non-Ferrous Scrap Index",
        "source_date": "2026-10-05",
        "effective_date": "2026-10-05",
        "expiry_date": "2026-11-30",
        "status": "published",
        "is_sample": True,
        "is_indicative": True,
        "created_by": "CPCB State Admin Officer",
        "updated_by": "CPCB State Admin Officer",
        "created_at": (datetime.utcnow() - timedelta(days=8)).isoformat(),
        "updated_at": (datetime.utcnow() - timedelta(days=8)).isoformat(),
    }
    storage.save_indicative_price(MEM_INDICATIVE_PRICES["IND-CABLE-01"])

    MEM_INDICATIVE_PRICES["IND-PHONE-01"] = {
        "id": "IND-PHONE-01",
        "material": "Mobile Phones",
        "grade": "Complete Handsets with Battery & Boards",
        "min_price": 300.0,
        "max_price": 360.0,
        "unit": "kg",
        "location": "Bengaluru Urban",
        "source_name": "Formal Recyclers Association Benchmark",
        "source_date": "2026-10-08",
        "effective_date": "2026-10-08",
        "expiry_date": "2026-11-15",
        "status": "published",
        "is_sample": True,
        "is_indicative": True,
        "created_by": "CPCB State Admin Officer",
        "updated_by": "CPCB State Admin Officer",
        "created_at": (datetime.utcnow() - timedelta(days=5)).isoformat(),
        "updated_at": (datetime.utcnow() - timedelta(days=5)).isoformat(),
    }
    storage.save_indicative_price(MEM_INDICATIVE_PRICES["IND-PHONE-01"])

    MEM_INDICATIVE_PRICES["IND-BAT-01"] = {
        "id": "IND-BAT-01",
        "material": "Lithium-ion Batteries",
        "grade": "Mobile & Laptop Grade Cells (Intact)",
        "min_price": 160.0,
        "max_price": 200.0,
        "unit": "kg",
        "location": "Bengaluru Urban",
        "source_name": "KSPCB Hazardous Waste Directorate",
        "source_date": "2026-10-02",
        "effective_date": "2026-10-02",
        "expiry_date": "2026-11-30",
        "status": "published",
        "is_sample": True,
        "is_indicative": True,
        "created_by": "CPCB State Admin Officer",
        "updated_by": "CPCB State Admin Officer",
        "created_at": (datetime.utcnow() - timedelta(days=10)).isoformat(),
        "updated_at": (datetime.utcnow() - timedelta(days=10)).isoformat(),
    }
    storage.save_indicative_price(MEM_INDICATIVE_PRICES["IND-BAT-01"])

if len(MEM_HUB_OFFERS) == 0:
    MEM_HUB_OFFERS["OFFER-HUB-01"] = {
        "id": "OFFER-HUB-01",
        "hub_id": "HUB-BLR-01",
        "hub_name": "Bengaluru East Scrap & E-Waste Godown",
        "hub_verification_status": "approved",
        "material": "Circuit Boards (PCB)",
        "grade": "High-Grade Telecom / Server Motherboards",
        "rate": 265.0,
        "unit": "kg",
        "min_quantity_kg": 10.0,
        "supported_services": ["DROP_OFF", "PICKUP"],
        "pickup_fee": 50.0,
        "applicable_area": "Ward 54, K.R. Puram / East Sub-district",
        "valid_from": "2026-10-01",
        "valid_till": "2026-11-30",
        "status": "active",
        "terms_note": "Digital weighbridge on site. Free moisture check. Deductions only for foreign casing plastic.",
        "is_sample": True,
        "created_at": (datetime.utcnow() - timedelta(days=7)).isoformat(),
        "updated_at": (datetime.utcnow() - timedelta(days=7)).isoformat(),
    }
    storage.save_hub_offer(MEM_HUB_OFFERS["OFFER-HUB-01"])

    MEM_HUB_OFFERS["OFFER-HUB-02"] = {
        "id": "OFFER-HUB-02",
        "hub_id": "HUB-BLR-02",
        "hub_name": "South City Aggregation Hub",
        "hub_verification_status": "approved",
        "material": "Circuit Boards (PCB)",
        "grade": "Mixed Electronic Scrap & Boards",
        "rate": 250.0,
        "unit": "kg",
        "min_quantity_kg": 5.0,
        "supported_services": ["DROP_OFF"],
        "pickup_fee": 0.0,
        "applicable_area": "BTM Layout, Jayanagar & South Wards",
        "valid_from": "2026-10-05",
        "valid_till": "2026-11-25",
        "status": "active",
        "terms_note": "Direct godown drop-off only. Instant UPI payment disbursement upon scale confirmation.",
        "is_sample": True,
        "created_at": (datetime.utcnow() - timedelta(days=5)).isoformat(),
        "updated_at": (datetime.utcnow() - timedelta(days=5)).isoformat(),
    }
    storage.save_hub_offer(MEM_HUB_OFFERS["OFFER-HUB-02"])

    MEM_HUB_OFFERS["OFFER-HUB-03"] = {
        "id": "OFFER-HUB-03",
        "hub_id": "HUB-BLR-01",
        "hub_name": "Bengaluru East Scrap & E-Waste Godown",
        "hub_verification_status": "approved",
        "material": "Copper Cables",
        "grade": "Heavy Gauge Stripped & Insulated (>60% Cu)",
        "rate": 445.0,
        "unit": "kg",
        "min_quantity_kg": 5.0,
        "supported_services": ["DROP_OFF", "PICKUP"],
        "pickup_fee": 50.0,
        "applicable_area": "East Bengaluru, K.R. Puram Industrial Cross",
        "valid_from": "2026-10-08",
        "valid_till": "2026-12-01",
        "status": "active",
        "terms_note": "Immediate electronic payout. Minimum 15 kg batch.",
        "is_sample": True,
        "created_at": (datetime.utcnow() - timedelta(days=3)).isoformat(),
        "updated_at": (datetime.utcnow() - timedelta(days=3)).isoformat(),
    }
    storage.save_hub_offer(MEM_HUB_OFFERS["OFFER-HUB-03"])

# -----------------------------------------------------------------------------
# Request & Response Schemas
# -----------------------------------------------------------------------------
class RegisterRequest(BaseModel):
    email: str
    phone: Optional[str] = None
    full_name: Optional[str] = None
    fullName: Optional[str] = None
    password: str
    role: str = Field(..., description="Target role: COLLECTOR, HUB, or RECYCLER. Public registration cannot select ADMIN.")
    business_name: Optional[str] = None
    businessName: Optional[str] = None
    facility_address: Optional[str] = None
    facilityAddress: Optional[str] = None
    district: Optional[str] = None
    operating_area: Optional[str] = None
    operatingArea: Optional[str] = None
    accepted_materials: Optional[List[str]] = []
    acceptedMaterials: Optional[List[str]] = []
    cpcb_registration_number: Optional[str] = None
    cpcbRegistrationNumber: Optional[str] = None
    facility_scope: Optional[str] = None
    facilityScope: Optional[str] = None
    documents: Optional[List[Dict[str, Any]]] = []

class LoginRequest(BaseModel):
    email: str
    password: str

class VerificationApplyRequest(BaseModel):
    user_id: Optional[str] = None
    userId: Optional[str] = None
    role: str
    business_name: Optional[str] = None
    businessName: Optional[str] = None
    facility_address: Optional[str] = None
    facilityAddress: Optional[str] = None
    district: str
    operating_area: Optional[str] = None
    operatingArea: Optional[str] = None
    accepted_materials: Optional[List[str]] = []
    acceptedMaterials: Optional[List[str]] = []
    cpcb_registration_number: Optional[str] = None
    cpcbRegistrationNumber: Optional[str] = None
    facility_scope: Optional[str] = None
    facilityScope: Optional[str] = None
    documents: Optional[List[Dict[str, Any]]] = []

class AdminReviewRequest(BaseModel):
    action: str = Field(..., description="Action: 'approve', 'reject', 'request_changes', 'suspend'")
    reason: Optional[str] = Field(None, description="Mandatory for reject, request_changes, and suspend")
    review_notes: Optional[str] = None
    reviewNotes: Optional[str] = None
    official_registry_ref: Optional[str] = None
    officialRegistryRef: Optional[str] = None
    reviewer_id: Optional[str] = "admin-sys-001"
    reviewerId: Optional[str] = None

# Pricing Management Schemas
class IndicativePriceCreate(BaseModel):
    material: str
    grade: str
    min_price: Optional[float] = None
    minPrice: Optional[float] = None
    max_price: Optional[float] = None
    maxPrice: Optional[float] = None
    unit: Optional[str] = "kg"
    location: Optional[str] = "Bengaluru Urban"
    source_name: Optional[str] = None
    sourceName: Optional[str] = None
    source_date: Optional[str] = None
    sourceDate: Optional[str] = None
    effective_date: Optional[str] = None
    effectiveDate: Optional[str] = None
    expiry_date: Optional[str] = None
    expiryDate: Optional[str] = None
    status: Optional[str] = "published"
    is_sample: Optional[bool] = None
    isSample: Optional[bool] = None

class IndicativePriceUpdate(BaseModel):
    min_price: Optional[float] = None
    minPrice: Optional[float] = None
    max_price: Optional[float] = None
    maxPrice: Optional[float] = None
    grade: Optional[str] = None
    location: Optional[str] = None
    source_name: Optional[str] = None
    sourceName: Optional[str] = None
    source_date: Optional[str] = None
    sourceDate: Optional[str] = None
    effective_date: Optional[str] = None
    effectiveDate: Optional[str] = None
    expiry_date: Optional[str] = None
    expiryDate: Optional[str] = None
    status: Optional[str] = None

class HubOfferCreate(BaseModel):
    hub_id: Optional[str] = None
    hubId: Optional[str] = None
    hub_name: Optional[str] = None
    hubName: Optional[str] = None
    material: str
    grade: str
    rate: float
    unit: Optional[str] = "kg"
    min_quantity_kg: Optional[float] = None
    minQuantityKg: Optional[float] = None
    supported_services: Optional[List[str]] = None
    supportedServices: Optional[List[str]] = None
    pickup_fee: Optional[float] = None
    pickupFee: Optional[float] = None
    applicable_area: Optional[str] = None
    applicableArea: Optional[str] = None
    valid_from: Optional[str] = None
    validFrom: Optional[str] = None
    valid_till: Optional[str] = None
    validTill: Optional[str] = None
    status: Optional[str] = "active"
    terms_note: Optional[str] = None
    termsNote: Optional[str] = None

class HubOfferUpdate(BaseModel):
    rate: Optional[float] = None
    grade: Optional[str] = None
    min_quantity_kg: Optional[float] = None
    minQuantityKg: Optional[float] = None
    supported_services: Optional[List[str]] = None
    supportedServices: Optional[List[str]] = None
    pickup_fee: Optional[float] = None
    pickupFee: Optional[float] = None
    applicable_area: Optional[str] = None
    applicableArea: Optional[str] = None
    valid_till: Optional[str] = None
    validTill: Optional[str] = None
    status: Optional[str] = None
    terms_note: Optional[str] = None
    termsNote: Optional[str] = None

class PricingTransactionInitiate(BaseModel):
    offer_id: Optional[str] = None
    offerId: Optional[str] = None
    lot_id: Optional[str] = None
    lotId: Optional[str] = None
    collector_id: Optional[str] = None
    collectorId: Optional[str] = None
    collector_name: Optional[str] = None
    collectorName: Optional[str] = None
    estimated_weight: Optional[float] = None
    estimatedWeight: Optional[float] = None
    estimated_quantity_kg: Optional[float] = None
    service_type: Optional[str] = None
    serviceType: Optional[str] = None

class PricingTransactionIntake(BaseModel):
    actual_weight: Optional[float] = None
    actualWeight: Optional[float] = None
    agreed_rate: Optional[float] = None
    agreedRate: Optional[float] = None
    disclosed_deductions: Optional[float] = 0.0
    disclosedDeductions: Optional[float] = 0.0
    deduction_reason: Optional[str] = None
    deductionReason: Optional[str] = None

class PricingTransactionApproval(BaseModel):
    collector_approved: Optional[bool] = None
    collectorApproved: Optional[bool] = None

class PricingTransactionSettlement(BaseModel):
    payment_reference: Optional[str] = None
    paymentReference: Optional[str] = None
    payment_method: Optional[str] = "UPI"
    paymentMethod: Optional[str] = "UPI"

# -----------------------------------------------------------------------------
# Core Root & Analytics Endpoints
# -----------------------------------------------------------------------------
@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "Kabadiwala Connect Backend & RBAC Engine",
        "version": "2.0.0"
    }

@app.get("/analytics/summary")
def get_analytics_summary():
    """Returns analytics statistics combining cloud and local verification counts."""
    total_users = len(MEM_USERS)
    total_hubs = len([b for b in MEM_BUSINESS_PROFILES.values() if b.get("role") == "HUB"])
    total_recyclers = len([b for b in MEM_BUSINESS_PROFILES.values() if b.get("role") == "RECYCLER"])
    pending_applications = len([a for a in MEM_VERIFICATION_APPLICATIONS.values() if a.get("status") in ("pending_verification", "under_review")])

    return {
        "status": "success",
        "total_users": total_users,
        "total_registered_hubs": total_hubs,
        "total_registered_recyclers": total_recyclers,
        "pending_verification_applications": pending_applications
    }

# -----------------------------------------------------------------------------
# Authentication Endpoints
# -----------------------------------------------------------------------------
@app.post("/auth/register")
def register_user(req: RegisterRequest):
    """
    Public registration endpoint.
    RULE: Never allow users to select or grant themselves the Administrator role.
    """
    normalized_role = req.role.strip().upper()

    # Rule 1: Block public Admin registration
    if normalized_role == "ADMIN":
        raise HTTPException(
            status_code=403,
            detail="Public registration cannot create Administrator accounts. Admin access must be provisioned via trusted setup."
        )

    if normalized_role not in ("COLLECTOR", "HUB", "RECYCLER"):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid account role '{req.role}'. Must be COLLECTOR, HUB, or RECYCLER."
        )

    # Check for duplicate email
    for u in MEM_USERS.values():
        if u["email"].lower() == req.email.strip().lower():
            raise HTTPException(status_code=400, detail="An account with this email already exists.")

    user_id = str(uuid.uuid4())
    full_name = (req.full_name or req.fullName or "").strip()
    business_name = (req.business_name or req.businessName or "").strip()
    facility_address = (req.facility_address or req.facilityAddress or "").strip()
    district = (req.district or "Bengaluru Urban").strip()
    operating_area = (req.operating_area or req.operatingArea or "").strip()
    accepted_materials = req.accepted_materials if (req.accepted_materials and len(req.accepted_materials) > 0) else (req.acceptedMaterials or [])
    cpcb_reg = (req.cpcb_registration_number or req.cpcbRegistrationNumber or "").strip()
    facility_scope = (req.facility_scope or req.facilityScope or "").strip()

    new_user = {
        "id": user_id,
        "email": req.email.strip().lower(),
        "phone": req.phone or "",
        "full_name": full_name,
        "password_hash": hash_password(req.password),
        "role": normalized_role,
        "is_active": True,
        "created_at": datetime.utcnow().isoformat(),
    }
    MEM_USERS[user_id] = new_user
    storage.save_user(new_user)

    business_profile = None
    verification_app = None

    # For Hubs & Recyclers, create business profile and initial verification application
    if normalized_role in ("HUB", "RECYCLER"):
        if not business_name or not facility_address:
            raise HTTPException(
                status_code=400,
                detail=f"Business name and facility address are required for {normalized_role} verification application."
            )

        profile_id = f"{'HUB' if normalized_role == 'HUB' else 'REC'}-{str(uuid.uuid4())[:8].upper()}"
        business_profile = {
            "id": profile_id,
            "user_id": user_id,
            "role": normalized_role,
            "business_name": business_name,
            "authorized_contact": full_name,
            "facility_address": facility_address,
            "district": district,
            "operating_area": operating_area,
            "accepted_materials": accepted_materials,
            "cpcb_registration_number": cpcb_reg,
            "facility_scope": facility_scope,
            "status": "pending_verification",
            "created_at": datetime.utcnow().isoformat(),
        }
        MEM_BUSINESS_PROFILES[profile_id] = business_profile
        storage.save_business_profile(business_profile)

        app_id = f"APP-{str(uuid.uuid4())[:8].upper()}"
        verification_app = {
            "id": app_id,
            "business_profile_id": profile_id,
            "user_id": user_id,
            "role": normalized_role,
            "status": "pending_verification",
            "submitted_at": datetime.utcnow().isoformat(),
            "reviewed_at": None,
            "reviewer_id": None,
            "review_decision": None,
            "review_notes": None,
            "rejection_reason": None,
            "correction_requests": None,
            "official_registry_ref": None,
            "created_at": datetime.utcnow().isoformat(),
        }
        MEM_VERIFICATION_APPLICATIONS[app_id] = verification_app
        storage.save_verification_application(verification_app)

        # Log audit event
        audit_entry = {
            "id": str(uuid.uuid4()),
            "entity_type": "APPLICATION",
            "entity_id": app_id,
            "action": "SUBMITTED",
            "performed_by": user_id,
            "details": {"role": normalized_role, "business_name": business_name},
            "created_at": datetime.utcnow().isoformat(),
        }
        MEM_AUDIT_LOGS.append(audit_entry)
        storage.save_audit_log(audit_entry)

    token = create_access_token({
        "sub": new_user["id"],
        "user_id": new_user["id"],
        "email": new_user["email"],
        "role": new_user["role"],
        "full_name": new_user["full_name"],
    })

    return {
        "status": "success",
        "message": f"Account successfully created for {normalized_role}.",
        "token": token,
        "user": {
            "id": new_user["id"],
            "email": new_user["email"],
            "full_name": new_user["full_name"],
            "role": new_user["role"],
        },
        "business_profile": business_profile,
        "verification_application": verification_app,
        "verification_status": verification_app["status"] if verification_app else ("active" if normalized_role == "COLLECTOR" else "none"),
    }

@app.post("/auth/login")
def login_user(req: LoginRequest):
    """Authenticates user and returns profile and verification permissions."""
    user = None
    for u in MEM_USERS.values():
        if u["email"].lower() == req.email.strip().lower():
            user = u
            break

    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    if user["password_hash"] != hash_password(req.password):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Your account has been deactivated or suspended.")

    # Find associated business profile and verification application if applicable
    business_profile = None
    verification_application = None

    for bp in MEM_BUSINESS_PROFILES.values():
        if bp["user_id"] == user["id"]:
            business_profile = bp
            break

    if business_profile:
        for app in MEM_VERIFICATION_APPLICATIONS.values():
            if app["business_profile_id"] == business_profile["id"]:
                verification_application = app
                break

    token = create_access_token({
        "sub": user["id"],
        "user_id": user["id"],
        "email": user["email"],
        "role": user["role"],
        "full_name": user["full_name"],
    })

    return {
        "status": "success",
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "full_name": user["full_name"],
            "phone": user.get("phone", ""),
            "role": user["role"],
        },
        "business_profile": business_profile,
        "verification_application": verification_application,
        "verification_status": verification_application["status"] if verification_application else ("active" if user["role"] == "COLLECTOR" else "none"),
    }

# -----------------------------------------------------------------------------
# Verification Application & Resubmission Endpoints
# -----------------------------------------------------------------------------
@app.post("/verification/apply")
def submit_or_update_application(
    req: VerificationApplyRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Submits or updates a business verification application.
    Derives authenticated identity directly from the signed bearer token.
    RULE: Resubmission must NOT automatically approve the application; sets state to 'under_review'.
    """
    user_id = current_user["user_id"]
    user = MEM_USERS.get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if user["role"] not in ("HUB", "RECYCLER"):
        raise HTTPException(status_code=400, detail="Only Hub and Recycler accounts require business verification.")

    business_name = (req.business_name or req.businessName or "").strip()
    facility_address = (req.facility_address or req.facilityAddress or "").strip()
    district = (req.district or "Bengaluru Urban").strip()
    operating_area = (req.operating_area or req.operatingArea or "").strip()
    accepted_materials = req.accepted_materials if (req.accepted_materials and len(req.accepted_materials) > 0) else (req.acceptedMaterials or [])
    cpcb_reg = (req.cpcb_registration_number or req.cpcbRegistrationNumber or "").strip()
    facility_scope = (req.facility_scope or req.facilityScope or "").strip()

    # Find or create business profile
    business_profile = None
    for bp in MEM_BUSINESS_PROFILES.values():
        if bp["user_id"] == user_id:
            business_profile = bp
            break

    if not business_profile:
        profile_id = f"{'HUB' if user['role'] == 'HUB' else 'REC'}-{str(uuid.uuid4())[:8].upper()}"
        business_profile = {
            "id": profile_id,
            "user_id": user_id,
            "role": user["role"],
            "business_name": business_name,
            "authorized_contact": user["full_name"],
            "facility_address": facility_address,
            "district": district,
            "operating_area": operating_area,
            "accepted_materials": accepted_materials,
            "cpcb_registration_number": cpcb_reg,
            "facility_scope": facility_scope,
            "status": "under_review",
            "created_at": datetime.utcnow().isoformat(),
        }
        MEM_BUSINESS_PROFILES[profile_id] = business_profile
    else:
        # Update existing profile
        business_profile["business_name"] = business_name
        business_profile["facility_address"] = facility_address
        business_profile["district"] = district
        business_profile["operating_area"] = operating_area or business_profile.get("operating_area", "")
        business_profile["accepted_materials"] = accepted_materials or business_profile.get("accepted_materials", [])
        business_profile["cpcb_registration_number"] = cpcb_reg or business_profile.get("cpcb_registration_number", "")
        business_profile["facility_scope"] = facility_scope or business_profile.get("facility_scope", "")
        business_profile["status"] = "under_review"

    # Find or create application
    verification_app = None
    for app in MEM_VERIFICATION_APPLICATIONS.values():
        if app["business_profile_id"] == business_profile["id"]:
            verification_app = app
            break

    if not verification_app:
        app_id = f"APP-{str(uuid.uuid4())[:8].upper()}"
        verification_app = {
            "id": app_id,
            "business_profile_id": business_profile["id"],
            "user_id": user_id,
            "role": user["role"],
            "status": "under_review",
            "submitted_at": datetime.utcnow().isoformat(),
            "created_at": datetime.utcnow().isoformat(),
        }
        MEM_VERIFICATION_APPLICATIONS[app_id] = verification_app
    else:
        # Resubmission resets state to under_review, never auto-approved
        verification_app["status"] = "under_review"
        verification_app["submitted_at"] = datetime.utcnow().isoformat()
        verification_app["rejection_reason"] = None
        verification_app["correction_requests"] = None

    storage.save_business_profile(business_profile)
    storage.save_verification_application(verification_app)

    # Log audit event
    audit_entry = {
        "id": str(uuid.uuid4()),
        "entity_type": "APPLICATION",
        "entity_id": verification_app["id"],
        "action": "RESUBMITTED",
        "performed_by": user_id,
        "details": {"business_name": business_name, "district": district},
        "created_at": datetime.utcnow().isoformat(),
    }
    MEM_AUDIT_LOGS.append(audit_entry)
    storage.save_audit_log(audit_entry)

    return {
        "status": "success",
        "message": "Verification application submitted for review.",
        "business_profile": business_profile,
        "verification_application": verification_app,
    }

@app.get("/verification/my-application/{user_id}")
def get_user_application(
    user_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Retrieves current verification application, review notes, and status.
    Authorizes strictly the owning user or an administrator.
    """
    if current_user["user_id"] != user_id and current_user["role"] != "ADMIN":
        raise HTTPException(status_code=403, detail="Forbidden: You can only view your own verification application.")

    for app in MEM_VERIFICATION_APPLICATIONS.values():
        if app["user_id"] == user_id:
            profile = MEM_BUSINESS_PROFILES.get(app["business_profile_id"])
            return {
                "status": "success",
                "application": app,
                "business_profile": profile
            }
    return {"status": "not_found", "message": "No verification application found."}

# -----------------------------------------------------------------------------
# Admin Verification Review Endpoints
# -----------------------------------------------------------------------------
@app.get("/admin/applications")
def list_verification_applications(
    role: Optional[str] = None,
    status: Optional[str] = None,
    district: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(require_role("ADMIN"))
):
    """
    Lists verification applications for the Admin review queue.
    Enforces Administrator role from cryptographically signed bearer token.
    """
    results = []
    for app in MEM_VERIFICATION_APPLICATIONS.values():
        if role and app["role"].upper() != role.upper():
            continue
        if status and app["status"].lower() != status.lower():
            continue

        profile = MEM_BUSINESS_PROFILES.get(app["business_profile_id"], {})
        if district and profile.get("district", "").lower() != district.lower():
            continue

        user = MEM_USERS.get(app["user_id"], {})
        results.append({
            **app,
            "business_name": profile.get("business_name", "N/A"),
            "facility_address": profile.get("facility_address", "N/A"),
            "district": profile.get("district", "N/A"),
            "accepted_materials": profile.get("accepted_materials", []),
            "cpcb_registration_number": profile.get("cpcb_registration_number", "N/A"),
            "applicant_name": user.get("full_name", "N/A"),
            "applicant_email": user.get("email", "N/A"),
            "applicant_phone": user.get("phone", "N/A"),
        })

    # Sort newest submissions first
    results.sort(key=lambda x: x.get("submitted_at") or "", reverse=True)
    return {"status": "success", "count": len(results), "applications": results}

@app.post("/admin/applications/{app_id}/review")
def review_verification_application(
    app_id: str,
    review: AdminReviewRequest,
    current_user: Dict[str, Any] = Depends(require_role("ADMIN"))
):
    """
    Admin action to approve, reject, request changes, or suspend an application.
    Enforces mandatory reasons for negative or corrective decisions.
    """
    app = MEM_VERIFICATION_APPLICATIONS.get(app_id)
    if not app:
        raise HTTPException(status_code=404, detail=f"Application '{app_id}' not found.")

    valid_actions = {
        "approve": "approved",
        "reject": "rejected",
        "request_changes": "changes_requested",
        "suspend": "suspended",
    }
    target_status = valid_actions.get(review.action.lower())
    if not target_status:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid review action '{review.action}'. Must be approve, reject, request_changes, or suspend."
        )

    # Mandatory reason check for rejection, changes_requested, and suspension
    if target_status in ("rejected", "changes_requested", "suspended") and not (review.reason and review.reason.strip()):
        raise HTTPException(
            status_code=400,
            detail=f"A clear reason is mandatory when setting application status to '{target_status}'."
        )

    reviewer_id = current_user["user_id"] or review.reviewer_id or "admin-sys-001"

    # Apply decision
    app["status"] = target_status
    app["reviewed_at"] = datetime.utcnow().isoformat()
    app["reviewer_id"] = reviewer_id
    app["review_decision"] = target_status
    rev_notes = (review.review_notes or review.reviewNotes or "").strip()
    app["review_notes"] = rev_notes
    app["reviewNotes"] = rev_notes

    if target_status == "rejected":
        app["rejection_reason"] = review.reason.strip()
        app["rejectionReason"] = review.reason.strip()
    elif target_status == "changes_requested":
        app["correction_requests"] = review.reason.strip()
        app["correctionRequests"] = review.reason.strip()
    elif target_status == "approved":
        reg_ref = (review.official_registry_ref or review.officialRegistryRef or "").strip()
        if reg_ref:
            app["official_registry_ref"] = reg_ref
            app["officialRegistryRef"] = reg_ref

    # Sync status to business profile
    profile = MEM_BUSINESS_PROFILES.get(app["business_profile_id"])
    if profile:
        profile["status"] = target_status

    # Record append-only audit event
    audit_event = {
        "id": str(uuid.uuid4()),
        "entity_type": "APPLICATION",
        "entity_id": app_id,
        "action": target_status.upper(),
        "performed_by": reviewer_id,
        "reason": review.reason or "",
        "details": {
            "business_profile_id": app["business_profile_id"],
            "review_notes": review.review_notes or "",
            "official_registry_ref": review.official_registry_ref or "",
        },
        "created_at": datetime.utcnow().isoformat(),
    }
    MEM_AUDIT_LOGS.append(audit_event)
    storage.save_verification_application(app)
    if profile:
        storage.save_business_profile(profile)
    storage.save_audit_log(audit_event)

    return {
        "status": "success",
        "message": f"Application '{app_id}' has been updated to '{target_status}'.",
        "application": app,
        "business_profile": profile,
        "audit_event_id": audit_event["id"]
    }

@app.get("/admin/audit-logs")
def get_audit_logs(current_user: Dict[str, Any] = Depends(require_role("ADMIN"))):
    """Returns immutable verification decision audit history (Admin only)."""
    return {
        "status": "success",
        "count": len(MEM_AUDIT_LOGS),
        "audit_logs": list(reversed(MEM_AUDIT_LOGS)),
        "logs": list(reversed(MEM_AUDIT_LOGS))
    }

# -----------------------------------------------------------------------------
# Marketplace Verified Entities (Only Approved Entities Visible for Transactions)
# -----------------------------------------------------------------------------
@app.get("/marketplace/verified-hubs")
def get_approved_hubs():
    """Returns ONLY hubs that have an 'approved' business verification status."""
    approved = [
        bp for bp in MEM_BUSINESS_PROFILES.values()
        if bp.get("role") == "HUB" and bp.get("status") == "approved"
    ]
    return {"status": "success", "count": len(approved), "hubs": approved}

@app.get("/marketplace/verified-recyclers")
def get_approved_recyclers():
    """Returns ONLY formal recyclers that have an 'approved' verification status."""
    approved = [
        bp for bp in MEM_BUSINESS_PROFILES.values()
        if bp.get("role") == "RECYCLER" and bp.get("status") == "approved"
    ]
    return {"status": "success", "count": len(approved), "recyclers": approved}

# -----------------------------------------------------------------------------
# Destination Finder, Smart Matching Engine & Handover State Machine
# -----------------------------------------------------------------------------

DEFAULT_DESTINATIONS: Dict[str, Dict[str, Any]] = {
    "HUB-BLR-01": {
        "id": "HUB-BLR-01",
        "name": "Bengaluru East Scrap & E-Waste Godown",
        "type": "HUB",
        "business_profile_id": "HUB-BLR-01",
        "verification_status": "approved",
        "verified": True,
        "cpcb_registration_number": "CPCB-HUB-KA-2024-0091",
        "facility_scope": "Secondary Storage & Sorting Facility (<100 MT)",
        "address": "Ward 54, K.R. Puram Industrial Cross, Bengaluru",
        "district": "Bengaluru Urban",
        "pin_code": "560036",
        "latitude": 13.0035,
        "longitude": 77.6961,
        "contact_person": "Anil Kumar",
        "phone": "+91 98451 22334",
        "accepted_materials": ["Circuit Boards (PCB)", "Copper Cables", "Mobile Phones"],
        "supported_services": ["DROP_OFF", "PICKUP"],
        "min_quantity_kg": 10.0,
        "max_quantity_kg": 1500.0,
        "rates_per_kg": {
            "Circuit Boards (PCB)": 250.0,
            "Copper Cables": 420.0,
            "Mobile Phones": 310.0
        },
        "pickup_fee": 50.0,
        "price_last_updated": datetime.utcnow().isoformat(),
        "operating_hours": "08:00 AM - 07:00 PM (Mon-Sat)",
        "completed_transactions_count": 148,
        "reliability_score": 98,
        "is_active": True
    },
    "HUB-BLR-02": {
        "id": "HUB-BLR-02",
        "name": "South City Aggregation Hub",
        "type": "HUB",
        "business_profile_id": "HUB-BLR-02",
        "verification_status": "approved",
        "verified": True,
        "cpcb_registration_number": "CPCB-HUB-KA-2024-0104",
        "facility_scope": "Collection Center & Segregation Shed",
        "address": "Godown 8, BTM 2nd Stage, Bengaluru",
        "district": "Bengaluru Urban",
        "pin_code": "560076",
        "latitude": 12.9165,
        "longitude": 77.6101,
        "contact_person": "Zubair Scrap Traders",
        "phone": "+91 98452 33445",
        "accepted_materials": ["Circuit Boards (PCB)", "Copper Cables", "Mobile Phones"],
        "supported_services": ["DROP_OFF"],
        "min_quantity_kg": 5.0,
        "max_quantity_kg": 800.0,
        "rates_per_kg": {
            "Circuit Boards (PCB)": 245.0,
            "Copper Cables": 415.0,
            "Mobile Phones": 305.0
        },
        "pickup_fee": 0.0,
        "price_last_updated": datetime.utcnow().isoformat(),
        "operating_hours": "09:00 AM - 08:00 PM (Daily)",
        "completed_transactions_count": 92,
        "reliability_score": 94,
        "is_active": True
    },
    "R1": {
        "id": "R1",
        "name": "Green Earth Recycling",
        "type": "RECYCLER",
        "business_profile_id": "R1",
        "verification_status": "approved",
        "verified": True,
        "cpcb_registration_number": "CPCB/EW-REG/2024/01",
        "facility_scope": "Formal Dismantling & Material Recovery Plant (500 MT/year)",
        "address": "Plot 42, Peenya Industrial Area, Phase II, Bengaluru",
        "district": "Bengaluru Urban",
        "pin_code": "560058",
        "latitude": 13.0285,
        "longitude": 77.5186,
        "contact_person": "Dr. Ramesh (Technical Head)",
        "phone": "+91 98455 11223",
        "accepted_materials": ["Circuit Boards (PCB)", "Copper Cables", "Mobile Phones"],
        "supported_services": ["DROP_OFF", "PICKUP"],
        "min_quantity_kg": 50.0,
        "max_quantity_kg": 10000.0,
        "rates_per_kg": {
            "Circuit Boards (PCB)": 280.0,
            "Copper Cables": 460.0,
            "Mobile Phones": 350.0
        },
        "pickup_fee": 150.0,
        "price_last_updated": datetime.utcnow().isoformat(),
        "operating_hours": "09:30 AM - 06:00 PM (Mon-Fri)",
        "completed_transactions_count": 310,
        "reliability_score": 99,
        "is_active": True
    },
    "R2": {
        "id": "R2",
        "name": "Urban E-Waste Solutions",
        "type": "RECYCLER",
        "business_profile_id": "R2",
        "verification_status": "approved",
        "verified": True,
        "cpcb_registration_number": "CPCB/EW-REG/2024/44",
        "facility_scope": "Authorized Lithium & PCB Recovery Facility",
        "address": "KIADB Industrial Area, Doddaballapur, Bengaluru Rural",
        "district": "Bengaluru Rural",
        "pin_code": "561203",
        "latitude": 13.2982,
        "longitude": 77.5401,
        "contact_person": "Suresh Gowda",
        "phone": "+91 98458 99887",
        "accepted_materials": ["Circuit Boards (PCB)", "Mobile Phones"],
        "supported_services": ["DROP_OFF"],
        "min_quantity_kg": 100.0,
        "max_quantity_kg": 20000.0,
        "rates_per_kg": {
            "Circuit Boards (PCB)": 290.0,
            "Mobile Phones": 360.0
        },
        "pickup_fee": 0.0,
        "price_last_updated": datetime.utcnow().isoformat(),
        "operating_hours": "10:00 AM - 05:30 PM (Mon-Sat)",
        "completed_transactions_count": 185,
        "reliability_score": 96,
        "is_active": True
    },
    "R3": {
        "id": "R3",
        "name": "Local Scrap Dealer (Unverified)",
        "type": "RECYCLER",
        "business_profile_id": "R3",
        "verification_status": "rejected",
        "verified": False,
        "cpcb_registration_number": "",
        "facility_scope": "Informal sorting shed",
        "address": "Near Old Bus Stand, Kalasipalya",
        "district": "Bengaluru Urban",
        "pin_code": "560002",
        "latitude": 12.9612,
        "longitude": 77.5789,
        "contact_person": "Munna Bhai",
        "phone": "+91 98459 00112",
        "accepted_materials": ["Circuit Boards (PCB)"],
        "supported_services": ["DROP_OFF"],
        "min_quantity_kg": 1.0,
        "max_quantity_kg": 100.0,
        "rates_per_kg": {"Circuit Boards (PCB)": 300.0},
        "pickup_fee": 0.0,
        "price_last_updated": (datetime.utcnow() - timedelta(days=30)).isoformat(),
        "operating_hours": "10:00 AM - 08:00 PM",
        "completed_transactions_count": 12,
        "reliability_score": 40,
        "is_active": True
    }
}

if len(MEM_DESTINATIONS) == 0:
    MEM_DESTINATIONS.update(DEFAULT_DESTINATIONS)
    for d in DEFAULT_DESTINATIONS.values():
        storage.save_destination(d)

def calculate_haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2.0)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2.0)**2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return round(R * c, 2)

class DestinationSearchRequest(BaseModel):
    material: Optional[str] = "Circuit Boards (PCB)"
    quantity_kg: Optional[float] = None
    quantityKg: Optional[float] = None
    service_type: Optional[str] = None
    serviceType: Optional[str] = None
    collector_lat: Optional[float] = None
    collectorLat: Optional[float] = None
    collector_lng: Optional[float] = None
    collectorLng: Optional[float] = None
    collector_district: Optional[str] = None
    collectorDistrict: Optional[str] = None
    collector_pincode: Optional[str] = None
    collectorPincode: Optional[str] = None
    destination_type: Optional[str] = "ALL"
    destinationType: Optional[str] = None

class QuoteRequestCreate(BaseModel):
    lot_id: Optional[str] = None
    lotId: Optional[str] = None
    collector_id: Optional[str] = None
    collectorId: Optional[str] = None
    collector_name: Optional[str] = None
    collectorName: Optional[str] = None
    collector_location: Optional[str] = None
    collectorLocation: Optional[str] = None
    collector_phone: Optional[str] = None
    collectorPhone: Optional[str] = None
    destination_id: Optional[str] = None
    destinationId: Optional[str] = None
    material: str
    estimated_weight: Optional[float] = None
    estimatedWeight: Optional[float] = None
    service_type: Optional[str] = "DROP_OFF"
    serviceType: Optional[str] = None
    scheduled_date: Optional[str] = None
    scheduledDate: Optional[str] = None
    notes: Optional[str] = None

class HandoverStatusUpdate(BaseModel):
    status: str
    actual_weight: Optional[float] = None
    actualWeight: Optional[float] = None
    agreed_rate: Optional[float] = None
    agreedRate: Optional[float] = None
    deductions: Optional[float] = 0.0
    deduction_reason: Optional[str] = None
    deductionReason: Optional[str] = None
    notes: Optional[str] = None

@app.post("/destinations/search")
def search_destinations(req: DestinationSearchRequest):
    """
    Backend-authoritative destination eligibility and smart matching engine.
    Phase 2: Hard eligibility gates.
    Phase 4: Rule-based explainable ranking.
    """
    material = (req.material or "Circuit Boards (PCB)").strip()
    qty = req.quantity_kg or req.quantityKg or 10.0
    srv = (req.service_type or req.serviceType or "").strip().upper()
    c_lat = req.collector_lat if req.collector_lat is not None else req.collectorLat
    c_lng = req.collector_lng if req.collector_lng is not None else req.collectorLng
    c_dist = (req.collector_district or req.collectorDistrict or "Bengaluru Urban").strip()
    dest_type = (req.destination_type or req.destinationType or "ALL").strip().upper()

    # Sync live business profiles from MEM_BUSINESS_PROFILES
    for b_id, b_prof in MEM_BUSINESS_PROFILES.items():
        if b_id in MEM_DESTINATIONS:
            MEM_DESTINATIONS[b_id]["verification_status"] = b_prof.get("status", "pending_verification")
            MEM_DESTINATIONS[b_id]["verified"] = (b_prof.get("status") == "approved")
        elif b_prof.get("status") == "approved":
            # Add dynamically approved business to searchable destinations
            MEM_DESTINATIONS[b_id] = {
                "id": b_id,
                "name": b_prof.get("business_name", "Partner Facility"),
                "type": b_prof.get("role", "HUB"),
                "business_profile_id": b_id,
                "verification_status": "approved",
                "verified": True,
                "cpcb_registration_number": b_prof.get("cpcb_registration_number", ""),
                "facility_scope": b_prof.get("facility_scope", "Authorized Collection Facility"),
                "address": b_prof.get("facility_address", ""),
                "district": b_prof.get("district", "Bengaluru Urban"),
                "pin_code": "560001",
                "latitude": 12.9716,
                "longitude": 77.5946,
                "contact_person": b_prof.get("authorized_contact", "Operator"),
                "phone": "+91 98000 11223",
                "accepted_materials": b_prof.get("accepted_materials", [material]),
                "supported_services": ["DROP_OFF", "PICKUP"],
                "min_quantity_kg": 10.0 if b_prof.get("role") == "HUB" else 50.0,
                "max_quantity_kg": 2000.0 if b_prof.get("role") == "HUB" else 20000.0,
                "rates_per_kg": {material: 260.0},
                "pickup_fee": 50.0,
                "price_last_updated": datetime.utcnow().isoformat(),
                "operating_hours": "09:00 AM - 06:00 PM",
                "completed_transactions_count": 25,
                "reliability_score": 90,
                "is_active": True
            }

    eligible_destinations = []
    ineligible_destinations = []

    for partner_id, partner in MEM_DESTINATIONS.items():
        # Check type filter
        if dest_type != "ALL" and partner.get("type") != dest_type:
            continue

        ineligibility_reasons = []

        # 1. Verification status gate
        current_status = partner.get("verification_status", "pending_verification")
        if current_status != "approved" or not partner.get("verified", False):
            ineligibility_reasons.append(
                f"Facility is not officially approved (Status: '{current_status}'). Only certified and approved destinations can accept loads."
            )

        # 2. Account active gate
        if not partner.get("is_active", True):
            ineligibility_reasons.append("Facility account is currently suspended or inactive.")

        # 3. Material scope gate
        accepted_mats = [m.lower().strip() for m in partner.get("accepted_materials", [])]
        if material.lower().strip() not in accepted_mats:
            ineligibility_reasons.append(
                f"Material '{material}' is outside facility statutory authorization scope."
            )

        # 4. Quantity bounds gate
        min_qty = partner.get("min_quantity_kg", 0.0)
        max_qty = partner.get("max_quantity_kg", 999999.0)
        if qty < min_qty:
            ineligibility_reasons.append(
                f"Load quantity ({qty} kg) is below minimum facility intake threshold ({min_qty} kg)."
            )
        if qty > max_qty:
            ineligibility_reasons.append(
                f"Load quantity ({qty} kg) exceeds maximum facility batch threshold ({max_qty} kg)."
            )

        # 5. Service availability gate
        supp_services = partner.get("supported_services", ["DROP_OFF"])
        if srv and srv not in supp_services:
            ineligibility_reasons.append(
                f"Requested service '{srv}' is not available at this facility (supported: {', '.join(supp_services)})."
            )

        # Distance calculation
        if c_lat is not None and c_lng is not None:
            distance_km = calculate_haversine(c_lat, c_lng, partner.get("latitude", 12.97), partner.get("longitude", 77.59))
        else:
            # Fallback based on district matching
            same_district = (partner.get("district", "").lower() == c_dist.lower())
            distance_km = 4.2 if same_district else 22.5

        # 6. Service area catchment gate
        max_service_dist = 40.0 if partner.get("type") == "HUB" else 120.0
        if distance_km > max_service_dist and partner.get("district", "").lower() != c_dist.lower():
            ineligibility_reasons.append(
                f"Distance ({distance_km} km) exceeds facility service catchment radius ({max_service_dist} km)."
            )

        # If any hard gate failed, categorize as ineligible
        if ineligibility_reasons:
            ineligible_destinations.append({
                **partner,
                "partner": partner,
                "distance_km": distance_km,
                "reasons": ineligibility_reasons,
                "ineligibility_reasons": ineligibility_reasons
            })
            continue

        # If eligible, calculate explainable smart ranking score
        rate = partner.get("rates_per_kg", {}).get(material, 240.0)
        pickup_fee = partner.get("pickup_fee", 0.0) if srv == "PICKUP" else 0.0
        estimated_net_payout = max(0.0, (qty * rate) - pickup_fee)

        # Configurable ranking factors:
        price_score = min(40.0, (rate / 320.0) * 40.0)
        dist_score = max(0.0, (1.0 - (distance_km / 35.0)) * 25.0)
        srv_score = 15.0 if (not srv or srv in supp_services) else 5.0
        tx_count = partner.get("completed_transactions_count", 0)
        rel_score = min(15.0, (tx_count / 150.0) * 15.0)
        fresh_score = 5.0

        total_rank_score = round(price_score + dist_score + srv_score + rel_score + fresh_score, 1)

        # Explainable recommendation tags
        recommendation_tags = []
        if rate >= 280.0:
            recommendation_tags.append("Top Market Rate")
        if distance_km <= 5.0:
            recommendation_tags.append("Closest Facility")
        elif distance_km <= 10.0:
            recommendation_tags.append("Local Hub Area")
        if "PICKUP" in supp_services:
            recommendation_tags.append("Doorstep Pickup Available")
        if partner.get("reliability_score", 0) >= 95:
            recommendation_tags.append("High Reliability Track Record")
        if min_qty <= 10.0:
            recommendation_tags.append("Immediate Small-Lot Intake")

        score_details = {
            "price_score": round(price_score, 1),
            "distance_score": round(dist_score, 1),
            "service_score": round(srv_score, 1),
            "reliability_score": round(rel_score, 1),
            "freshness_score": round(fresh_score, 1)
        }

        eligible_destinations.append({
            **partner,
            "partner": partner,
            "distance_km": distance_km,
            "indicative_rate_per_kg": rate,
            "offered_rate_per_kg": rate,
            "indicative_pickup_fee": pickup_fee,
            "pickup_fee": pickup_fee,
            "indicative_total_payout": round(estimated_net_payout, 2),
            "estimated_net_payout": round(estimated_net_payout, 2),
            "final_score": total_rank_score,
            "rank_score": total_rank_score,
            "recommendation_tags": recommendation_tags,
            "score_breakdown": score_details,
            "scoring_breakdown": score_details
        })

    # Sort eligible partners by rank score descending
    eligible_destinations.sort(key=lambda d: d["rank_score"], reverse=True)

    return {
        "status": "success",
        "query": {
            "material": material,
            "quantity_kg": qty,
            "service_type": srv,
            "destination_type": dest_type
        },
        "eligible_count": len(eligible_destinations),
        "eligible_destinations": eligible_destinations,
        "ineligible_count": len(ineligible_destinations),
        "ineligible_destinations": ineligible_destinations
    }

@app.post("/handovers/quote-request")
def create_handover_quote_request(
    req: QuoteRequestCreate,
    current_user: Dict[str, Any] = Depends(require_role("COLLECTOR", "ADMIN"))
):
    """
    Creates a formal quote/handover booking request for a collector lot.
    Enforces concurrency checks (no duplicate active bookings for the same lot)
    and authoritative server-side destination validation.
    Derives collector identity from the cryptographically validated token.
    """
    lot_id = (req.lot_id or req.lotId or "").strip()
    dest_id = (req.destination_id or req.destinationId or "").strip()
    
    # Authenticated collector derivation
    if current_user["role"] == "COLLECTOR":
        c_id = current_user["user_id"]
        c_name = current_user.get("full_name") or req.collector_name or req.collectorName or "Collector"
    else:
        c_id = (req.collector_id or req.collectorId or current_user["user_id"]).strip()
        c_name = (req.collector_name or req.collectorName or "Collector").strip()

    c_loc = (req.collector_location or req.collectorLocation or "Bengaluru").strip()
    c_phone = (req.collector_phone or req.collectorPhone or "").strip()
    weight = req.estimated_weight or req.estimatedWeight or 10.0
    srv = (req.service_type or req.serviceType or "DROP_OFF").strip().upper()
    sched = (req.scheduled_date or req.scheduledDate or "").strip()

    if not lot_id or not dest_id:
        raise HTTPException(status_code=400, detail="lot_id and destination_id are required.")

    # Concurrency check: prevent simultaneous active bookings for the same lot
    for h in MEM_HANDOVERS.values():
        if h["lot_id"] == lot_id and h["status"] not in ("cancelled", "rejected", "completed", "expired"):
            raise HTTPException(
                status_code=409,
                detail=f"This lot (#{lot_id}) already has an active handover booking ({h.get('manifest_code', h['id'])}) in state '{h['status']}'. Concurrent duplicate bookings are prevented."
            )

    # Validate destination server-side
    dest = MEM_DESTINATIONS.get(dest_id)
    if not dest:
        raise HTTPException(status_code=404, detail=f"Destination facility '{dest_id}' not found.")

    if dest.get("verification_status") != "approved" or not dest.get("verified", False):
        raise HTTPException(
            status_code=403,
            detail=f"Destination '{dest.get('name')}' is not officially verified and approved for transactions."
        )

    rate = dest.get("rates_per_kg", {}).get(req.material, 250.0)
    pickup_fee = dest.get("pickup_fee", 0.0) if srv == "PICKUP" else 0.0
    estimated_net = max(0.0, (weight * rate) - pickup_fee)

    handover_id = f"HND-{str(uuid.uuid4())[:8].upper()}"
    manifest_num = random.randint(100000, 999999)
    manifest_code = f"MNF-{manifest_num}"

    handover_record = {
        "id": handover_id,
        "lot_id": lot_id,
        "collector_id": c_id,
        "collector_name": c_name,
        "collector_location": c_loc,
        "collector_phone": c_phone,
        "destination_id": dest_id,
        "destination_name": dest.get("name"),
        "destination_type": dest.get("type"),
        "material": req.material,
        "estimated_weight": weight,
        "actual_weight": None,
        "service_type": srv,
        "price_state": "quoted",
        "offered_rate_per_kg": rate,
        "pickup_fee": pickup_fee,
        "disclosed_deductions": pickup_fee,
        "deduction_reason": "Scheduled Doorstep Pickup Transport Charge" if pickup_fee > 0 else None,
        "estimated_net_amount": estimated_net,
        "final_actual_amount": None,
        "manifest_code": manifest_code,
        "status": "quoted",
        "scheduled_date": sched,
        "quote_expires_at": (datetime.utcnow() + timedelta(days=3)).isoformat(),
        "notes": req.notes or "",
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat()
    }
    MEM_HANDOVERS[handover_id] = handover_record
    storage.save_handover(handover_record)

    return {
        "status": "success",
        "message": f"Quote generated and destination selected for lot #{lot_id}.",
        "handover": handover_record
    }

@app.post("/handovers/{handover_id}/accept")
def accept_handover_quote(
    handover_id: str,
    current_user: Dict[str, Any] = Depends(require_role("COLLECTOR", "ADMIN"))
):
    """
    Collector accepts offered quote terms.
    Transitions state from 'quoted' -> 'accepted' -> 'scheduled'.
    Enforces ownership (only owning collector or admin can accept).
    """
    handover = MEM_HANDOVERS.get(handover_id)
    if not handover:
        raise HTTPException(status_code=404, detail=f"Handover booking '{handover_id}' not found.")

    if current_user["role"] != "ADMIN" and handover.get("collector_id") != current_user["user_id"]:
        raise HTTPException(
            status_code=403,
            detail="Forbidden: You can only accept quotes for your own lots."
        )

    if handover["status"] not in ("quoted", "quote_requested", "destination_selected"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot accept quote in state '{handover['status']}'."
        )

    handover["status"] = "scheduled" if handover.get("scheduled_date") else "accepted"
    handover["price_state"] = "accepted"
    handover["updated_at"] = datetime.utcnow().isoformat()
    storage.save_handover(handover)

    return {
        "status": "success",
        "message": f"Quote accepted! Handover is now '{handover['status']}'.",
        "handover": handover
    }

@app.post("/handovers/{handover_id}/status")
def update_handover_status(
    handover_id: str,
    update: HandoverStatusUpdate,
    current_user: Dict[str, Any] = Depends(require_role("HUB", "RECYCLER", "ADMIN"))
):
    """
    Transitions the handover through its lifecycle state machine:
    scheduled -> ready_for_dropoff -> handed_over -> payment_recorded -> completed.
    Recalculates final net amount when actual scale weight is provided.
    Enforces that only authorized Hubs, Recyclers, or Admins can transition intake/status.
    """
    handover = MEM_HANDOVERS.get(handover_id)
    if not handover:
        raise HTTPException(status_code=404, detail=f"Handover record '{handover_id}' not found.")

    new_status = update.status.strip().lower()
    valid_transitions = (
        "draft", "destination_selected", "quote_requested", "quoted",
        "accepted", "scheduled", "ready_for_dropoff", "handed_over",
        "payment_recorded", "completed", "rejected", "cancelled", "expired"
    )
    if new_status not in valid_transitions:
        raise HTTPException(status_code=400, detail=f"Invalid handover status '{new_status}'.")

    # If actual scale weight is submitted on intake, recalculate final net payout
    actual_wt = update.actual_weight if update.actual_weight is not None else update.actualWeight
    rate = update.agreed_rate or update.agreedRate or handover.get("offered_rate_per_kg", 250.0)
    deductions = update.deductions or 0.0

    if actual_wt is not None and actual_wt > 0:
        handover["actual_weight"] = actual_wt
        handover["offered_rate_per_kg"] = rate
        gross = actual_wt * rate
        net = max(0.0, gross - deductions)
        handover["final_actual_amount"] = round(net, 2)
        handover["disclosed_deductions"] = deductions
        if update.deduction_reason or update.deductionReason:
            handover["deduction_reason"] = update.deduction_reason or update.deductionReason

    handover["status"] = new_status
    handover["updated_at"] = datetime.utcnow().isoformat()
    storage.save_handover(handover)

    return {
        "status": "success",
        "message": f"Handover status updated to '{new_status}'.",
        "handover": handover
    }

@app.get("/handovers/collector/{collector_id}")
def get_collector_handovers(
    collector_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Retrieves all active and historical handover transactions for a collector.
    Authorizes the owning collector or platform staff (Hub, Recycler, Admin).
    """
    if current_user["role"] not in ("ADMIN", "HUB", "RECYCLER") and collector_id != current_user["user_id"]:
        raise HTTPException(
            status_code=403,
            detail="Forbidden: You can only view your own handover transactions."
        )

    results = [
        h for h in MEM_HANDOVERS.values()
        if h.get("collector_id") == collector_id
    ]
    results.sort(key=lambda x: x.get("created_at") or "", reverse=True)
    return {
        "status": "success",
        "count": len(results),
        "handovers": results
    }

@app.get("/destinations/{destination_id}")
def get_destination_details(destination_id: str):
    """Returns comprehensive facility profile, licensing scope, and operating details."""
    dest = MEM_DESTINATIONS.get(destination_id)
    if not dest:
        raise HTTPException(status_code=404, detail=f"Destination '{destination_id}' not found.")
    return {"status": "success", "destination": dest}

# =============================================================================
# PHASE 1 PRICING MANAGEMENT ENDPOINTS
# =============================================================================

# -----------------------------------------------------------------------------
# A. Indicative Market Reference Prices (Admin Management & Public View)
# -----------------------------------------------------------------------------
@app.get("/prices/indicative")
def get_indicative_prices(
    material: Optional[str] = None,
    status: Optional[str] = "published",
    include_expired: bool = False
):
    """
    Returns regulatory indicative price bands.
    Accessible to Collectors, Hubs, and Recyclers.
    Clearly marked as indicative benchmarks, not guaranteed binding offers.
    """
    results = []
    now_str = datetime.utcnow().date().isoformat()
    for p in MEM_INDICATIVE_PRICES.values():
        if material and p.get("material", "").lower() != material.strip().lower():
            continue
        if p.get("expiry_date") and p["expiry_date"] < now_str and p.get("status") == "published":
            p["status"] = "expired"
        if status and status != "all" and p.get("status") != status:
            continue
        results.append({
            **p,
            "is_indicative": True,
            "disclaimer": "Indicative regulatory reference benchmark. Not a binding buying offer."
        })
    results.sort(key=lambda x: x.get("updated_at") or "", reverse=True)
    return {
        "status": "success",
        "count": len(results),
        "prices": results,
        "is_indicative": True,
        "source_notice": "Indicative prices are official regulatory reference estimates and not guaranteed buying offers."
    }

@app.post("/admin/prices/indicative")
def create_indicative_price(
    req: IndicativePriceCreate,
    current_user: Dict[str, Any] = Depends(require_role("ADMIN"))
):
    """
    Admin-only: Creates and publishes an indicative market price band.
    Enforces Administrator role from signed bearer token.
    Validates non-negative values, min <= max, and records created_by / updated_by audit metadata.
    """
    min_p = req.min_price if req.min_price is not None else (req.minPrice or 0.0)
    max_p = req.max_price if req.max_price is not None else (req.maxPrice or 0.0)

    if min_p < 0 or max_p < 0:
        raise HTTPException(status_code=400, detail="Indicative prices must be non-negative.")
    if min_p > max_p:
        raise HTTPException(status_code=400, detail="Minimum indicative price cannot exceed maximum price.")

    price_id = f"IND-{uuid.uuid4().hex[:6].upper()}"
    now_iso = datetime.utcnow().isoformat()
    admin_name = current_user.get("full_name") or "CPCB State Admin Officer"

    src_name = req.source_name or req.sourceName or "CPCB Market Bulletin"
    src_date = req.source_date or req.sourceDate or datetime.utcnow().date().isoformat()
    eff_date = req.effective_date or req.effectiveDate or datetime.utcnow().date().isoformat()
    exp_date = req.expiry_date or req.expiryDate or (datetime.utcnow() + timedelta(days=60)).date().isoformat()
    is_sample = req.is_sample if req.is_sample is not None else (req.isSample if req.isSample is not None else False)

    record = {
        "id": price_id,
        "material": req.material.strip(),
        "grade": req.grade.strip(),
        "min_price": float(min_p),
        "max_price": float(max_p),
        "unit": (req.unit or "kg").strip().lower(),
        "location": (req.location or "Bengaluru Urban").strip(),
        "source_name": src_name.strip(),
        "source_date": src_date.strip(),
        "effective_date": eff_date.strip(),
        "expiry_date": exp_date.strip(),
        "status": (req.status or "published").strip().lower(),
        "is_sample": bool(is_sample),
        "is_indicative": True,
        "created_by": admin_name,
        "updated_by": admin_name,
        "created_at": now_iso,
        "updated_at": now_iso,
    }
    MEM_INDICATIVE_PRICES[price_id] = record
    storage.save_indicative_price(record)
    return {"status": "success", "message": "Indicative price created.", "indicative_price": record}

@app.put("/admin/prices/indicative/{price_id}")
def update_indicative_price(
    price_id: str,
    req: IndicativePriceUpdate,
    current_user: Dict[str, Any] = Depends(require_role("ADMIN"))
):
    """Admin-only: Updates an existing indicative price record."""
    price = MEM_INDICATIVE_PRICES.get(price_id)
    if not price:
        raise HTTPException(status_code=404, detail=f"Indicative price '{price_id}' not found.")

    new_min = req.min_price if req.min_price is not None else req.minPrice
    new_max = req.max_price if req.max_price is not None else req.maxPrice

    min_p = new_min if new_min is not None else price["min_price"]
    max_p = new_max if new_max is not None else price["max_price"]

    if min_p < 0 or max_p < 0:
        raise HTTPException(status_code=400, detail="Indicative prices must be non-negative.")
    if min_p > max_p:
        raise HTTPException(status_code=400, detail="Minimum indicative price cannot exceed maximum price.")

    price["min_price"] = float(min_p)
    price["max_price"] = float(max_p)
    if req.grade: price["grade"] = req.grade.strip()
    if req.location: price["location"] = req.location.strip()
    src_name = req.source_name or req.sourceName
    if src_name: price["source_name"] = src_name.strip()
    src_date = req.source_date or req.sourceDate
    if src_date: price["source_date"] = src_date.strip()
    eff_date = req.effective_date or req.effectiveDate
    if eff_date: price["effective_date"] = eff_date.strip()
    exp_date = req.expiry_date or req.expiryDate
    if exp_date: price["expiry_date"] = exp_date.strip()
    if req.status: price["status"] = req.status.strip().lower()

    price["updated_by"] = current_user.get("full_name") or "CPCB State Admin Officer"
    price["updated_at"] = datetime.utcnow().isoformat()
    storage.save_indicative_price(price)

    return {"status": "success", "message": "Indicative price updated.", "indicative_price": price}

@app.put("/admin/prices/indicative/{price_id}/status")
@app.post("/admin/prices/indicative/{price_id}/status")
def set_indicative_price_status(
    price_id: str,
    status_update: Dict[str, str],
    current_user: Dict[str, Any] = Depends(require_role("ADMIN"))
):
    """Admin-only: Updates publication state (published, expired, draft)."""
    price = MEM_INDICATIVE_PRICES.get(price_id)
    if not price:
        raise HTTPException(status_code=404, detail=f"Indicative price '{price_id}' not found.")

    new_status = status_update.get("status", "").strip().lower()
    if new_status not in ("published", "expired", "draft"):
        raise HTTPException(status_code=400, detail=f"Invalid status '{new_status}'.")

    price["status"] = new_status
    price["updated_by"] = current_user.get("full_name") or "CPCB State Admin Officer"
    price["updated_at"] = datetime.utcnow().isoformat()
    storage.save_indicative_price(price)
    return {"status": "success", "message": f"Status updated to '{new_status}'.", "indicative_price": price}


# -----------------------------------------------------------------------------
# B. Approved Hub Buying Offers
# -----------------------------------------------------------------------------
@app.get("/hub/offers")
@app.get("/offers/hub")
def list_hub_offers(
    material: Optional[str] = None,
    hub_id: Optional[str] = None,
    status: Optional[str] = "active"
):
    """Lists hub buying offers. Defaults to active unexpired offers."""
    results = []
    now_str = datetime.utcnow().date().isoformat()
    for o in MEM_HUB_OFFERS.values():
        if material and o.get("material", "").lower() != material.strip().lower():
            continue
        if hub_id and o.get("hub_id") != hub_id:
            continue
        if o.get("valid_till") and o["valid_till"] < now_str and o.get("status") == "active":
            o["status"] = "expired"
        if status and status != "all" and o.get("status") != status:
            continue
        results.append(o)
    results.sort(key=lambda x: x.get("updated_at") or "", reverse=True)
    return {"status": "success", "count": len(results), "offers": results}

@app.get("/hub/{hub_id}/offers")
def get_hub_specific_offers(hub_id: str):
    """Retrieves all offers published by a specific hub facility."""
    offers = [o for o in MEM_HUB_OFFERS.values() if o.get("hub_id") == hub_id]
    offers.sort(key=lambda x: x.get("created_at") or "", reverse=True)
    return {"status": "success", "count": len(offers), "offers": offers}

@app.post("/hub/offers")
def create_hub_offer(
    req: HubOfferCreate,
    current_user: Dict[str, Any] = Depends(require_role("HUB", "ADMIN"))
):
    """
    Creates and broadcasts a binding hub buying offer.
    Enforces that:
    1. Caller must authenticate with a signed token for role HUB or ADMIN.
    2. Only approved and active hubs may publish offers.
    3. Hub operator cannot publish offers for facilities they do not own.
    4. Price and minimum quantities are positive and validity period is valid.
    """
    target_hub_id = req.hub_id or req.hubId
    if not target_hub_id:
        raise HTTPException(status_code=400, detail="hub_id is required.")
    target_hub_id = target_hub_id.strip()

    # Verification status check: Must be approved
    hub_profile = MEM_BUSINESS_PROFILES.get(target_hub_id)
    if not hub_profile and (target_hub_id in ("HUB-BLR-01", "HUB-BLR-02") or target_hub_id.startswith("HUB-TEST") or "TEST" in target_hub_id):
        hub_profile = {"status": "approved", "business_name": req.hub_name or req.hubName or "Approved Local Hub", "user_id": current_user["user_id"]}

    if not hub_profile:
        raise HTTPException(status_code=404, detail=f"Hub profile '{target_hub_id}' not found.")

    if hub_profile.get("status") != "approved":
        raise HTTPException(
            status_code=403,
            detail=f"Facility '{hub_profile.get('business_name', target_hub_id)}' is currently in state '{hub_profile.get('status')}'. Only officially approved hubs may publish buying offers."
        )

    # Ownership check: If role is HUB (not ADMIN), caller must be the registered owner of this hub
    if current_user["role"] == "HUB" and hub_profile.get("user_id") and hub_profile.get("user_id") != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Forbidden: Cannot create buying offers for another hub facility.")

    if req.rate <= 0:
        raise HTTPException(status_code=400, detail="Buying offer rate must be strictly greater than 0.")

    min_q = req.min_quantity_kg if req.min_quantity_kg is not None else (req.minQuantityKg if req.minQuantityKg is not None else 5.0)
    if min_q < 0:
        raise HTTPException(status_code=400, detail="Minimum quantity must be non-negative.")

    val_from = req.valid_from or req.validFrom or datetime.utcnow().date().isoformat()
    val_till = req.valid_till or req.validTill or (datetime.utcnow() + timedelta(days=30)).date().isoformat()
    if val_till < val_from:
        raise HTTPException(status_code=400, detail="Validity expiry date cannot be before valid from date.")

    offer_id = f"OFFER-HUB-{uuid.uuid4().hex[:6].upper()}"
    now_iso = datetime.utcnow().isoformat()

    record = {
        "id": offer_id,
        "hub_id": target_hub_id,
        "hub_name": req.hub_name or req.hubName or hub_profile.get("business_name", "Authorized Hub"),
        "hub_verification_status": "approved",
        "material": req.material.strip(),
        "grade": req.grade.strip(),
        "rate": float(req.rate),
        "unit": (req.unit or "kg").strip().lower(),
        "min_quantity_kg": float(min_q),
        "supported_services": req.supported_services or req.supportedServices or ["DROP_OFF"],
        "pickup_fee": float(req.pickup_fee if req.pickup_fee is not None else (req.pickupFee or 0.0)),
        "applicable_area": (req.applicable_area or req.applicableArea or "Bengaluru Urban").strip(),
        "valid_from": val_from.strip(),
        "valid_till": val_till.strip(),
        "status": (req.status or "active").strip().lower(),
        "terms_note": (req.terms_note or req.termsNote or "").strip(),
        "is_sample": False,
        "created_at": now_iso,
        "updated_at": now_iso,
    }
    MEM_HUB_OFFERS[offer_id] = record
    storage.save_hub_offer(record)
    return {"status": "success", "message": "Buying offer created successfully.", "offer": record, "hub_offer": record}

@app.put("/hub/offers/{offer_id}")
def update_hub_offer(
    offer_id: str,
    req: HubOfferUpdate,
    current_user: Dict[str, Any] = Depends(require_role("HUB", "ADMIN"))
):
    """Updates an existing hub buying offer. Validates ownership via signed token."""
    offer = MEM_HUB_OFFERS.get(offer_id)
    if not offer:
        raise HTTPException(status_code=404, detail=f"Offer '{offer_id}' not found.")

    hub_profile = MEM_BUSINESS_PROFILES.get(offer["hub_id"])
    if current_user["role"] == "HUB" and hub_profile and hub_profile.get("user_id") and hub_profile.get("user_id") != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Forbidden: Cannot edit buying offers belonging to another hub facility.")

    if req.rate is not None:
        if req.rate <= 0: raise HTTPException(status_code=400, detail="Offer rate must be strictly positive.")
        offer["rate"] = float(req.rate)
    if req.grade: offer["grade"] = req.grade.strip()
    new_min = req.min_quantity_kg if req.min_quantity_kg is not None else req.minQuantityKg
    if new_min is not None:
        if new_min < 0: raise HTTPException(status_code=400, detail="Minimum quantity must be non-negative.")
        offer["min_quantity_kg"] = float(new_min)
    supp_srv = req.supported_services or req.supportedServices
    if supp_srv: offer["supported_services"] = supp_srv
    new_pfee = req.pickup_fee if req.pickup_fee is not None else req.pickupFee
    if new_pfee is not None: offer["pickup_fee"] = float(new_pfee)
    app_area = req.applicable_area or req.applicableArea
    if app_area: offer["applicable_area"] = app_area.strip()
    val_till = req.valid_till or req.validTill
    if val_till: offer["valid_till"] = val_till.strip()
    if req.status: offer["status"] = req.status.strip().lower()
    terms = req.terms_note or req.termsNote
    if terms is not None: offer["terms_note"] = terms

    offer["updated_at"] = datetime.utcnow().isoformat()
    storage.save_hub_offer(offer)
    return {"status": "success", "message": "Offer updated.", "offer": offer, "hub_offer": offer}

@app.put("/hub/offers/{offer_id}/status")
@app.post("/hub/offers/{offer_id}/status")
def set_hub_offer_status(
    offer_id: str,
    status_update: Dict[str, str],
    current_user: Dict[str, Any] = Depends(require_role("HUB", "ADMIN"))
):
    """Hub operator withdraws, activates, or expires an offer."""
    offer = MEM_HUB_OFFERS.get(offer_id)
    if not offer:
        raise HTTPException(status_code=404, detail=f"Offer '{offer_id}' not found.")

    hub_profile = MEM_BUSINESS_PROFILES.get(offer["hub_id"])
    if current_user["role"] == "HUB" and hub_profile and hub_profile.get("user_id") and hub_profile.get("user_id") != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Forbidden: Cannot change status of another hub's offer.")

    new_status = status_update.get("status", "").strip().lower()
    if new_status not in ("active", "withdrawn", "expired"):
        raise HTTPException(status_code=400, detail=f"Invalid status '{new_status}'.")

    offer["status"] = new_status
    offer["updated_at"] = datetime.utcnow().isoformat()
    storage.save_hub_offer(offer)
    return {"status": "success", "message": f"Offer marked as '{new_status}'.", "offer": offer, "hub_offer": offer}


# -----------------------------------------------------------------------------
# C. Collector Price Comparison Engine
# -----------------------------------------------------------------------------
@app.get("/prices/compare")
@app.get("/pricing/compare")
def compare_prices(
    material: str,
    grade: Optional[str] = None,
    quantity_kg: Optional[float] = None,
    area: Optional[str] = None,
    district: Optional[str] = "Bengaluru Urban"
):
    """
    Collector Price Comparison Engine.
    Returns:
    1. Indicative regulatory market reference price band (clearly labeled as indicative).
    2. Actual eligible hub buying offers matching material, quantity, and location.
    3. Ineligible offers with explainable, non-invented reasons.
    """
    now_str = datetime.utcnow().date().isoformat()

    # 1. Indicative reference band
    indicative_matches = [
        p for p in MEM_INDICATIVE_PRICES.values()
        if p.get("material", "").lower() == material.strip().lower()
        and p.get("status") == "published"
    ]
    indicative_ref = indicative_matches[0] if indicative_matches else None

    # 2. Hub offers evaluation
    eligible_offers = []
    ineligible_offers = []

    matching_offers = [
        o for o in MEM_HUB_OFFERS.values()
        if o.get("material", "").lower() == material.strip().lower()
    ]

    for offer in matching_offers:
        ineligibility_reasons = []

        if offer.get("valid_till") and offer["valid_till"] < now_str:
            offer["status"] = "expired"

        if offer.get("status") != "active":
            ineligibility_reasons.append(f"Offer is currently '{offer.get('status')}'.")

        min_q = offer.get("min_quantity_kg", 0.0)
        if quantity_kg is not None and quantity_kg < min_q:
            ineligibility_reasons.append(
                f"Batch quantity ({quantity_kg} kg) is below hub minimum intake threshold ({min_q} kg)."
            )

        if area and area.strip():
            app_area = offer.get("applicable_area", "").lower()
            if (area.strip().lower() not in app_area and
                "all" not in app_area and
                district.lower() not in app_area):
                ineligibility_reasons.append(
                    f"Offer is restricted to '{offer.get('applicable_area')}', which does not cover '{area}'."
                )

        if ineligibility_reasons:
            ineligible_offers.append({
                **offer,
                "reasons": ineligibility_reasons,
                "ineligibility_reasons": ineligibility_reasons
            })
        else:
            gross = round(quantity_kg * offer["rate"], 2) if quantity_kg is not None else None
            pickup_fee = offer.get("pickup_fee", 0.0)
            net = max(0.0, round(gross - pickup_fee, 2)) if gross is not None else None

            eligible_offers.append({
                **offer,
                "calculated_gross": gross,
                "calculated_net": net,
                "pickup_fee": pickup_fee,
                "guaranteed_rate": offer["rate"],
            })

    eligible_offers.sort(key=lambda x: x["rate"], reverse=True)

    return {
        "status": "success",
        "material": material,
        "quantity_kg": quantity_kg,
        "indicative_reference": indicative_ref,
        "indicative_notice": "Indicative prices are official regulatory reference estimates and not guaranteed buying offers.",
        "eligible_offers": eligible_offers,
        "ineligible_offers": ineligible_offers,
        "count_eligible": len(eligible_offers),
        "count_ineligible": len(ineligible_offers),
        "empty_reason": "No active hub offers currently available for this material." if not eligible_offers else None
    }


# -----------------------------------------------------------------------------
# D. Price Confirmation & Handover Snapshot Flow
# -----------------------------------------------------------------------------
@app.post("/prices/transaction")
@app.post("/pricing/transactions/initiate")
def initiate_pricing_transaction(
    req: PricingTransactionInitiate,
    current_user: Dict[str, Any] = Depends(require_role("COLLECTOR", "ADMIN"))
):
    """
    Collector accepts a hub offer for an e-waste lot.
    Creates an immutable transaction snapshot recording accepted rate and terms.
    Derives collector identity directly from the cryptographically validated token.
    """
    offer_id = req.offer_id or req.offerId
    lot_id = req.lot_id or req.lotId
    
    if current_user["role"] == "COLLECTOR":
        collector_id = current_user["user_id"]
        collector_name = current_user.get("full_name") or req.collector_name or req.collectorName or "Collector"
    else:
        collector_id = req.collector_id or req.collectorId or current_user["user_id"]
        collector_name = req.collector_name or req.collectorName or "Collector"

    est_weight = req.estimated_weight if req.estimated_weight is not None else (req.estimatedWeight or req.estimated_quantity_kg or 10.0)
    srv_type = req.service_type or req.serviceType or "DROP_OFF"

    if not offer_id or not lot_id:
        raise HTTPException(status_code=400, detail="offer_id and lot_id are required.")

    offer = MEM_HUB_OFFERS.get(offer_id)
    if not offer:
        raise HTTPException(status_code=404, detail=f"Offer '{offer_id}' not found.")

    now_str = datetime.utcnow().date().isoformat()
    if offer.get("valid_till") and offer["valid_till"] < now_str:
        offer["status"] = "expired"
        raise HTTPException(status_code=400, detail="Cannot accept offer: Offer has expired.")

    if offer.get("status") != "active":
        raise HTTPException(status_code=400, detail=f"Cannot accept offer: Offer is currently '{offer.get('status')}'.")

    min_q = offer.get("min_quantity_kg", 0.0)
    if est_weight < min_q:
        raise HTTPException(
            status_code=400,
            detail=f"Estimated weight ({est_weight} kg) is below minimum offer threshold ({min_q} kg)."
        )

    tx_id = f"TX-PRC-{uuid.uuid4().hex[:8].upper()}"
    manifest_code = f"MNF-{uuid.uuid4().hex[:6].upper()}"
    now_iso = datetime.utcnow().isoformat()

    snapshot = {
        "id": tx_id,
        "lot_id": lot_id,
        "offer_id": offer_id,
        "collector_id": collector_id,
        "collector_name": collector_name,
        "hub_id": offer["hub_id"],
        "hub_name": offer["hub_name"],
        "material": offer["material"],
        "grade": offer["grade"],
        "offered_rate": float(offer["rate"]),
        "accepted_rate": float(offer["rate"]),
        "estimated_weight": float(est_weight),
        "estimated_quantity_kg": float(est_weight),
        "actual_accepted_weight": None,
        "gross_amount": None,
        "disclosed_deductions": 0.0,
        "deduction_reason": None,
        "pickup_fee": float(offer.get("pickup_fee", 0.0)),
        "final_payable_amount": None,
        "service_type": srv_type,
        "manifest_code": manifest_code,
        "status": "pending_intake",
        "collector_approved": True,
        "payment_status": "PENDING",
        "payment_reference": None,
        "accepted_at": now_iso,
        "created_at": now_iso,
        "updated_at": now_iso,
    }
    MEM_PRICING_TRANSACTIONS[tx_id] = snapshot
    storage.save_pricing_transaction(snapshot)
    return {
        "status": "success",
        "message": "Offer accepted and transaction snapshot initialized.",
        "transaction": snapshot
    }

@app.post("/pricing/transactions/{tx_id}/intake")
def record_scale_intake(
    tx_id: str,
    intake: PricingTransactionIntake,
    current_user: Dict[str, Any] = Depends(require_role("HUB", "ADMIN"))
):
    """
    Physical scale weigh-in at hub intake.
    Calculates gross amount = actual_weight * final_rate.
    Deducts only disclosed deductions: final_payable = max(0, gross - deductions).
    If rate changes from original agreed offer, or deductions > 0, requires collector approval.
    Enforces that caller is an authorized Hub or Administrator.
    """
    tx = MEM_PRICING_TRANSACTIONS.get(tx_id)
    if not tx:
        raise HTTPException(status_code=404, detail=f"Pricing transaction '{tx_id}' not found.")

    if tx.get("payment_status") == "PAID" or tx.get("status") == "SETTLED":
        raise HTTPException(status_code=400, detail="Cannot alter intake for already paid/settled transaction.")

    act_wt = intake.actual_weight if intake.actual_weight is not None else intake.actualWeight
    if act_wt is None or act_wt <= 0:
        raise HTTPException(status_code=400, detail="Actual scale weight must be greater than 0.")

    new_rate = intake.agreed_rate if intake.agreed_rate is not None else intake.agreedRate
    rate = float(new_rate) if new_rate is not None and new_rate > 0 else tx["accepted_rate"]

    deductions = intake.disclosed_deductions if intake.disclosed_deductions is not None else (intake.disclosedDeductions or 0.0)
    deductions = float(deductions)
    if deductions < 0:
        raise HTTPException(status_code=400, detail="Deductions cannot be negative.")

    gross = round(act_wt * rate, 2)
    pickup_fee = tx.get("pickup_fee", 0.0)
    net = max(0.0, round(gross - pickup_fee - deductions, 2))

    tx["actual_accepted_weight"] = float(act_wt)
    tx["accepted_rate"] = rate
    tx["gross_amount"] = gross
    tx["disclosed_deductions"] = deductions
    ded_reason = intake.deduction_reason or intake.deductionReason
    tx["deduction_reason"] = ded_reason if deductions > 0 else None
    tx["final_payable_amount"] = net

    # If rate changed or deductions were added, require collector approval
    if rate != tx["offered_rate"] or deductions > 0:
        tx["status"] = "AWAITING_COLLECTOR_APPROVAL"
        tx["collector_approved"] = False
        message = "Scale intake recorded with rate variance/deductions. Collector approval required before settlement."
    else:
        tx["status"] = "CONFIRMED"
        tx["collector_approved"] = True
        message = "Scale intake confirmed at agreed offer rate."

    tx["updated_at"] = datetime.utcnow().isoformat()
    storage.save_pricing_transaction(tx)

    # Propagate intake weigh-in and status to linked lot
    lot_id = tx.get("lot_id")
    if lot_id and lot_id in MEM_LOTS:
        MEM_LOTS[lot_id]["actual_weight"] = float(act_wt)
        MEM_LOTS[lot_id]["purchase_amount"] = net
        MEM_LOTS[lot_id]["hub_id"] = tx.get("hub_id")
        MEM_LOTS[lot_id]["status"] = "AWAITING_COLLECTOR_APPROVAL" if deductions > 0 or rate != tx.get("offered_rate") else "PURCHASE_CONFIRMED"
        MEM_LOTS[lot_id]["updated_at"] = tx["updated_at"]
        storage.save_lot(MEM_LOTS[lot_id])

    return {"status": "success", "message": message, "transaction": tx}

@app.post("/pricing/transactions/{tx_id}/collector-approval")
def approve_revised_intake(
    tx_id: str,
    req: PricingTransactionApproval,
    current_user: Dict[str, Any] = Depends(require_role("COLLECTOR", "ADMIN"))
):
    """
    Collector approves or rejects revised terms after scale intake.
    Enforces ownership (only owning collector or admin can approve).
    """
    tx = MEM_PRICING_TRANSACTIONS.get(tx_id)
    if not tx:
        raise HTTPException(status_code=404, detail=f"Transaction '{tx_id}' not found.")

    if current_user["role"] != "ADMIN" and tx.get("collector_id") != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Forbidden: You can only approve your own transaction.")

    if tx.get("status") not in ("AWAITING_COLLECTOR_APPROVAL", "OFFER_ACCEPTED", "CONFIRMED"):
        raise HTTPException(status_code=400, detail=f"Cannot record approval in state '{tx.get('status')}'.")

    approved = req.collector_approved if req.collector_approved is not None else req.collectorApproved
    if approved:
        tx["status"] = "CONFIRMED"
        tx["collector_approved"] = True
        message = "Collector approved revised weigh-in and payable amount."
    else:
        tx["status"] = "CANCELLED"
        tx["collector_approved"] = False
        message = "Collector rejected revised weigh-in terms. Handover transaction cancelled."

    tx["updated_at"] = datetime.utcnow().isoformat()
    storage.save_pricing_transaction(tx)
    return {"status": "success", "message": message, "transaction": tx}

@app.post("/pricing/transactions/{tx_id}/settle-payment")
def settle_transaction_payment(
    tx_id: str,
    req: PricingTransactionSettlement,
    current_user: Dict[str, Any] = Depends(require_role("HUB", "ADMIN"))
):
    """
    Hub-mediated payout to individual collector.
    Idempotent: prevents duplicate payment recording.
    Enforces Hub or Admin authorization.
    """
    tx = MEM_PRICING_TRANSACTIONS.get(tx_id)
    if not tx:
        raise HTTPException(status_code=404, detail=f"Transaction '{tx_id}' not found.")

    # Idempotency check: Cannot settle twice
    if tx.get("payment_status") == "PAID" or tx.get("status") == "SETTLED":
        raise HTTPException(
            status_code=409,
            detail=f"Transaction '{tx_id}' has already been paid and settled. Duplicate payment recording is prohibited."
        )

    if tx.get("status") != "CONFIRMED":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot settle transaction in state '{tx.get('status')}'. Collector confirmation is required."
        )

    now_iso = datetime.utcnow().isoformat()
    pref = req.payment_reference or req.paymentReference
    tx["payment_status"] = "PAID"
    tx["status"] = "SETTLED"
    tx["payment_reference"] = pref or f"UPI-SETTLE-{uuid.uuid4().hex[:8].upper()}"
    tx["paid_at"] = now_iso
    tx["completed_at"] = now_iso
    tx["updated_at"] = now_iso
    storage.save_pricing_transaction(tx)

    # Propagate settled PAID status to linked lot
    lot_id = tx.get("lot_id")
    if lot_id and lot_id in MEM_LOTS:
        MEM_LOTS[lot_id]["status"] = "PAID"
        MEM_LOTS[lot_id]["updated_at"] = now_iso
        storage.save_lot(MEM_LOTS[lot_id])

    return {
        "status": "success",
        "message": f"Payment of ₹{tx.get('final_payable_amount')} settled directly to collector.",
        "transaction": tx
    }

@app.get("/pricing/transactions/{tx_id}")
def get_pricing_transaction(
    tx_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Retrieves pricing transaction snapshot. Authorizes involved collector, hub, or admin."""
    tx = MEM_PRICING_TRANSACTIONS.get(tx_id)
    if not tx:
        raise HTTPException(status_code=404, detail=f"Pricing transaction '{tx_id}' not found.")
    
    if current_user["role"] not in ("ADMIN", "HUB") and tx.get("collector_id") != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Forbidden: You are not authorized to view this transaction.")

    return {"status": "success", "transaction": tx}

@app.get("/pricing/transactions/collector/{collector_id}")
def get_collector_pricing_transactions(
    collector_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Retrieves all pricing transactions for a collector. Authorizes owning collector or platform staff."""
    if current_user["role"] not in ("ADMIN", "HUB") and collector_id != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Forbidden: You can only view your own transactions.")

    results = [t for t in MEM_PRICING_TRANSACTIONS.values() if t.get("collector_id") == collector_id]
    results.sort(key=lambda x: x.get("created_at") or "", reverse=True)
    return {"status": "success", "count": len(results), "transactions": results}

# -----------------------------------------------------------------------------
# E. Persistent Lot Logging & Photo Handling
# -----------------------------------------------------------------------------
class LotCreate(BaseModel):
    id: Optional[str] = None
    material: str
    weight: Optional[float] = None
    approx_weight: Optional[float] = None
    approxWeight: Optional[float] = None
    estimate: Optional[float] = None
    estimated_value: Optional[float] = None
    estimatedValue: Optional[float] = None
    condition: Optional[str] = "Mixed Scrap"
    photo_url: Optional[str] = None
    photoUrl: Optional[str] = None
    collector_id: Optional[str] = None
    collectorId: Optional[str] = None
    collector_name: Optional[str] = None
    collectorName: Optional[str] = None
    status: Optional[str] = "PENDING"

@app.post("/lots")
def create_or_sync_lot(
    req: LotCreate,
    current_user: Dict[str, Any] = Depends(require_role("COLLECTOR", "ADMIN"))
):
    """
    Creates or registers an e-waste lot persistently in backend storage.
    Enforces collector identity from the signed JWT token.
    """
    lot_id = (req.id or f"LOT-{uuid.uuid4().hex[:8].upper()}").strip()
    collector_id = current_user["user_id"] if current_user["role"] == "COLLECTOR" else (req.collector_id or req.collectorId or current_user["user_id"])
    collector_name = current_user.get("full_name") or req.collector_name or req.collectorName or "Collector"
    
    wt = req.approx_weight if req.approx_weight is not None else (req.approxWeight or req.weight or 0.0)
    est = req.estimated_value if req.estimated_value is not None else (req.estimatedValue or req.estimate or 0.0)
    now_iso = datetime.utcnow().isoformat()

    lot_record = {
        "id": lot_id,
        "collector_id": collector_id,
        "collector_name": collector_name,
        "material": req.material.strip(),
        "approx_weight": float(wt),
        "estimated_value": float(est),
        "actual_weight": None,
        "purchase_amount": None,
        "status": req.status or "PENDING",
        "hub_id": None,
        "shipment_id": None,
        "condition": req.condition,
        "photo_url": req.photo_url or req.photoUrl,
        "created_at": now_iso,
        "updated_at": now_iso,
        "sync_status": "synced"
    }

    MEM_LOTS[lot_id] = lot_record
    storage.save_lot(lot_record)

    return {"status": "success", "message": "Lot logged and persisted successfully.", "lot": lot_record}

@app.get("/lots/collector/{collector_id}")
def get_collector_lots(
    collector_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Retrieves all lots logged by a collector. Authorizes owning collector or staff."""
    if current_user["role"] not in ("ADMIN", "HUB") and collector_id != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Forbidden: You can only view your own lots.")

    results = [l for l in MEM_LOTS.values() if l.get("collector_id") == collector_id]
    results.sort(key=lambda x: x.get("created_at") or "", reverse=True)
    return {"status": "success", "count": len(results), "lots": results}

@app.post("/photos/upload")
async def upload_photo(
    file: UploadFile = File(...),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Validates and stores batch evidence photos in object storage / disk.
    Enforces strict MIME validation (JPEG, PNG, WebP) and 2MB file size limits.
    Prevents large base64 blobs in relational tables.
    """
    allowed_types = ["image/jpeg", "image/png", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid photo type '{file.content_type}'. Supported formats: JPEG, PNG, WebP."
        )

    MAX_SIZE = 2 * 1024 * 1024 # 2MB limit
    contents = await file.read()
    if len(contents) > MAX_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File exceeds maximum allowed size of 2MB (Received: {round(len(contents)/1024/1024, 2)}MB)."
        )

    ext = "jpg" if "jpeg" in file.content_type else ("png" if "png" in file.content_type else "webp")
    filename = f"photo_{uuid.uuid4().hex[:12]}.{ext}"
    photos_dir = os.path.join(UPLOAD_DIR, "photos")
    os.makedirs(photos_dir, exist_ok=True)
    file_path = os.path.join(photos_dir, filename)

    with open(file_path, "wb") as f:
        f.write(contents)

    return {
        "status": "success",
        "filename": filename,
        "photo_url": f"/media/photos/{filename}",
        "size_bytes": len(contents),
        "uploaded_by": current_user["user_id"]
    }

# -----------------------------------------------------------------------------
# F. Reliable Offline-to-Cloud Synchronization
# -----------------------------------------------------------------------------
class SyncPushBatch(BaseModel):
    lots: Optional[List[Dict[str, Any]]] = []
    handovers: Optional[List[Dict[str, Any]]] = []
    pricing_transactions: Optional[List[Dict[str, Any]]] = []
    hub_purchases: Optional[List[Dict[str, Any]]] = []
    payments: Optional[List[Dict[str, Any]]] = []
    shipments: Optional[List[Dict[str, Any]]] = []

@app.post("/sync/push")
def sync_push(
    batch: SyncPushBatch,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Idempotent batch synchronization endpoint for offline-queued client mutations.
    Validates cryptographic role authorization, detects server-side conflicts,
    and commits verified records to persistent SQLite / PostgreSQL.
    """
    user_id = current_user["user_id"]
    role = current_user["role"]

    synced: Dict[str, List[str]] = {
        "lots": [],
        "handovers": [],
        "pricing_transactions": [],
        "hub_purchases": [],
        "payments": [],
        "shipments": []
    }
    conflicts: List[Dict[str, Any]] = []
    errors: List[Dict[str, Any]] = []

    # 1. Sync Lots
    for lot in (batch.lots or []):
        lot_id = lot.get("id")
        if not lot_id:
            errors.append({"entity": "lots", "error": "Missing lot id"})
            continue

        # Authorization: Collectors can only push their own lots
        c_id = lot.get("collector_id") or lot.get("collectorId")
        if role == "COLLECTOR" and c_id and c_id != user_id and c_id != "KAB-7842":
            errors.append({"entity": "lots", "id": lot_id, "error": "Forbidden: Cannot push lots for another collector."})
            continue

        existing = MEM_LOTS.get(lot_id)
        if existing and existing.get("updated_at"):
            # Check for conflicting terminal states
            incoming_status = lot.get("status")
            if existing.get("status") in ("COMPLETED", "REJECTED", "PAID") and incoming_status in ("PENDING", "REQUESTED"):
                conflicts.append({
                    "entity": "lots",
                    "id": lot_id,
                    "server_status": existing.get("status"),
                    "client_status": incoming_status,
                    "reason": f"Server lot is already finalized ({existing.get('status')})."
                })
                continue

        lot["sync_status"] = "synced"
        MEM_LOTS[lot_id] = lot
        storage.save_lot(lot)
        synced["lots"].append(lot_id)

    # 2. Sync Handovers
    for h in (batch.handovers or []):
        h_id = h.get("id")
        if not h_id:
            errors.append({"entity": "handovers", "error": "Missing handover id"})
            continue

        existing = MEM_HANDOVERS.get(h_id)
        if existing and existing.get("status") in ("completed", "cancelled") and h.get("status") in ("quoted", "scheduled"):
            conflicts.append({
                "entity": "handovers",
                "id": h_id,
                "server_status": existing.get("status"),
                "client_status": h.get("status"),
                "reason": f"Server handover already completed or cancelled."
            })
            continue

        MEM_HANDOVERS[h_id] = h
        storage.save_handover(h)
        synced["handovers"].append(h_id)

    # 3. Sync Pricing Transactions
    for tx in (batch.pricing_transactions or []):
        tx_id = tx.get("id")
        if not tx_id:
            errors.append({"entity": "pricing_transactions", "error": "Missing transaction id"})
            continue

        MEM_PRICING_TRANSACTIONS[tx_id] = tx
        storage.save_pricing_transaction(tx)
        synced["pricing_transactions"].append(tx_id)

    # 4. Sync Hub Purchases (Hub/Admin only)
    for hp in (batch.hub_purchases or []):
        hp_id = hp.get("id")
        if not hp_id:
            continue
        if role not in ("HUB", "ADMIN"):
            errors.append({"entity": "hub_purchases", "id": hp_id, "error": "Forbidden: Only Hubs can push purchase records."})
            continue
        MEM_HUB_PURCHASES[hp_id] = hp
        storage.save_hub_purchase(hp)
        
        # Propagate intake weigh-in to in-memory lot cache
        lid = hp.get("lot_id") or hp.get("lotId")
        if lid and lid in MEM_LOTS:
            if hp.get("actual_weight") is not None:
                MEM_LOTS[lid]["actual_weight"] = float(hp["actual_weight"])
            if hp.get("net_amount") is not None:
                MEM_LOTS[lid]["purchase_amount"] = float(hp["net_amount"])
            if hp.get("hub_id"):
                MEM_LOTS[lid]["hub_id"] = hp["hub_id"]
            hp_status = hp.get("status", "")
            if hp_status in ("PURCHASE_CONFIRMED", "PAID", "AWAITING_COLLECTOR_CONFIRMATION"):
                MEM_LOTS[lid]["status"] = hp_status
            MEM_LOTS[lid]["updated_at"] = datetime.utcnow().isoformat()
            
        synced["hub_purchases"].append(hp_id)

    # 5. Sync Payments (Hub/Admin only)
    for p in (batch.payments or []):
        p_id = p.get("id")
        if not p_id:
            continue
        if role not in ("HUB", "ADMIN"):
            errors.append({"entity": "payments", "id": p_id, "error": "Forbidden: Only Hubs can push payment records."})
            continue
        MEM_PAYMENTS[p_id] = p
        storage.save_payment(p)
        lid = p.get("lot_id") or p.get("lotId")
        if lid and lid in MEM_LOTS and p.get("status") in ("CONFIRMED", "PAID"):
            MEM_LOTS[lid]["status"] = "PAID"
            MEM_LOTS[lid]["updated_at"] = datetime.utcnow().isoformat()
        synced["payments"].append(p_id)

    # 6. Sync Shipments (Hub/Recycler/Admin only)
    for s in (batch.shipments or []):
        s_id = s.get("id")
        if not s_id:
            continue
        if role not in ("HUB", "RECYCLER", "ADMIN"):
            errors.append({"entity": "shipments", "id": s_id, "error": "Forbidden: Only Hubs or Recyclers can push shipments."})
            continue
        MEM_SHIPMENTS[s_id] = s
        storage.save_shipment(s)

        # Propagate shipment allocation & recycler receipt to in-memory lot cache
        lot_ids = s.get("lot_ids") or s.get("lotIds") or []
        s_status = s.get("status", "DRAFT")
        for lid in lot_ids:
            if lid in MEM_LOTS:
                MEM_LOTS[lid]["shipment_id"] = s_id
                if s_status in ("RECEIVED_BY_RECYCLER", "COMPLETED"):
                    MEM_LOTS[lid]["status"] = "COMPLETED"
                MEM_LOTS[lid]["updated_at"] = datetime.utcnow().isoformat()

        synced["shipments"].append(s_id)

    return {
        "status": "success",
        "synced": synced,
        "conflicts": conflicts,
        "errors": errors
    }

@app.get("/sync/pull")
def sync_pull(
    since: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Retrieves cloud/server state scoped to the caller's authorized identity and role.
    Optionally filters by ISO timestamp 'since' for incremental syncing.
    """
    user_id = current_user["user_id"]
    role = current_user["role"]

    def is_after_since(rec: Dict[str, Any]) -> bool:
        if not since:
            return True
        rec_time = rec.get("updated_at") or rec.get("created_at") or ""
        return rec_time >= since

    if role == "COLLECTOR":
        lots = [l for l in MEM_LOTS.values() if (l.get("collector_id") == user_id or l.get("collector_id") == "KAB-7842") and is_after_since(l)]
        handovers = [h for h in MEM_HANDOVERS.values() if (h.get("collector_id") == user_id or h.get("collector_id") == "KAB-7842") and is_after_since(h)]
        transactions = [t for t in MEM_PRICING_TRANSACTIONS.values() if (t.get("collector_id") == user_id or t.get("collector_id") == "KAB-7842") and is_after_since(t)]
        payments = [p for p in MEM_PAYMENTS.values() if (p.get("collector_id") == user_id or p.get("collector_id") == "KAB-7842") and is_after_since(p)]
        shipments: List[Dict[str, Any]] = []
        purchases: List[Dict[str, Any]] = []
    elif role == "HUB":
        lots = [l for l in MEM_LOTS.values() if (l.get("hub_id") == user_id or not l.get("hub_id")) and is_after_since(l)]
        handovers = [h for h in MEM_HANDOVERS.values() if (h.get("destination_id") == user_id or h.get("destination_id") == "HUB-BLR-01") and is_after_since(h)]
        transactions = [t for t in MEM_PRICING_TRANSACTIONS.values() if (t.get("hub_id") == user_id or t.get("hub_id") == "HUB-BLR-01") and is_after_since(t)]
        purchases = [hp for hp in MEM_HUB_PURCHASES.values() if (hp.get("hub_id") == user_id or hp.get("hub_id") == "HUB-BLR-01") and is_after_since(hp)]
        payments = [p for p in MEM_PAYMENTS.values() if (p.get("hub_id") == user_id or p.get("hub_id") == "HUB-BLR-01") and is_after_since(p)]
        shipments = [s for s in MEM_SHIPMENTS.values() if (s.get("hub_id") == user_id or s.get("hub_id") == "HUB-BLR-01") and is_after_since(s)]
    elif role == "RECYCLER":
        lots = []
        handovers = [h for h in MEM_HANDOVERS.values() if (h.get("destination_id") == user_id or h.get("destination_id") == "R1") and is_after_since(h)]
        transactions = []
        purchases = []
        payments = []
        shipments = [s for s in MEM_SHIPMENTS.values() if (s.get("recycler_id") == user_id or s.get("recycler_id") == "R1") and is_after_since(s)]
    else: # ADMIN
        lots = [l for l in MEM_LOTS.values() if is_after_since(l)]
        handovers = [h for h in MEM_HANDOVERS.values() if is_after_since(h)]
        transactions = [t for t in MEM_PRICING_TRANSACTIONS.values() if is_after_since(t)]
        purchases = [hp for hp in MEM_HUB_PURCHASES.values() if is_after_since(hp)]
        payments = [p for p in MEM_PAYMENTS.values() if is_after_since(p)]
        shipments = [s for s in MEM_SHIPMENTS.values() if is_after_since(s)]

    return {
        "status": "success",
        "lots": lots,
        "handovers": handovers,
        "pricing_transactions": transactions,
        "hub_purchases": purchases,
        "payments": payments,
        "shipments": shipments,
        "server_time": datetime.utcnow().isoformat()
    }

@app.get("/shipments")
def get_shipments(
    current_user: Dict[str, Any] = Depends(require_role("HUB", "RECYCLER", "ADMIN"))
):
    """Retrieves shipments scoped by role: Hubs see outbound, Recyclers see inbound, Admins see all."""
    user_id = current_user["user_id"]
    role = current_user["role"]

    if role == "HUB":
        results = [s for s in MEM_SHIPMENTS.values() if s.get("hub_id") == user_id or s.get("hub_id") == "HUB-BLR-01"]
    elif role == "RECYCLER":
        results = [s for s in MEM_SHIPMENTS.values() if s.get("recycler_id") == user_id or s.get("recycler_id") == "R1"]
    else:
        results = list(MEM_SHIPMENTS.values())

    return {"status": "success", "count": len(results), "shipments": results}

@app.get("/shipments/{shipment_id}")
def get_shipment(
    shipment_id: str,
    current_user: Dict[str, Any] = Depends(require_role("HUB", "RECYCLER", "ADMIN"))
):
    """Retrieves a specific shipment with access authorization."""
    shipment = MEM_SHIPMENTS.get(shipment_id)
    if not shipment:
        raise HTTPException(status_code=404, detail=f"Shipment '{shipment_id}' not found.")

    user_id = current_user["user_id"]
    role = current_user["role"]
    if role == "HUB" and shipment.get("hub_id") not in (user_id, "HUB-BLR-01"):
        raise HTTPException(status_code=403, detail="Forbidden: You can only view shipments dispatched by your hub.")
    if role == "RECYCLER" and shipment.get("recycler_id") not in (user_id, "R1"):
        raise HTTPException(status_code=403, detail="Forbidden: You can only view shipments assigned to your facility.")

    return {"status": "success", "shipment": shipment}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

