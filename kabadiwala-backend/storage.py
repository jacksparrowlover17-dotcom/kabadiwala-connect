import os
import json
import sqlite3
from datetime import datetime
from typing import Dict, Any, List, Optional

DB_FILE = os.getenv("PERSISTENT_DB_FILE", os.path.join(os.path.dirname(__file__), "kabadiwala_persistent.db"))

def get_db_connection() -> sqlite3.Connection:
    """Returns a SQLite connection with row factory and WAL mode enabled."""
    conn = sqlite3.connect(DB_FILE, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn

def init_db():
    """Initializes persistent tables with proper indexes and constraints."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # 1. Users
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            phone TEXT,
            full_name TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);")

        # 2. Business Profiles
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS business_profiles (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            role TEXT NOT NULL,
            business_name TEXT NOT NULL,
            authorized_contact TEXT NOT NULL,
            facility_address TEXT NOT NULL,
            district TEXT NOT NULL,
            operating_area TEXT,
            accepted_materials_json TEXT,
            cpcb_registration_number TEXT,
            facility_scope TEXT,
            status TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_profiles_user ON business_profiles(user_id);")

        # 3. Verification Applications
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS verification_applications (
            id TEXT PRIMARY KEY,
            business_profile_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            role TEXT NOT NULL,
            status TEXT NOT NULL,
            submitted_at TEXT NOT NULL,
            reviewed_at TEXT,
            reviewer_id TEXT,
            review_decision TEXT,
            review_notes TEXT,
            rejection_reason TEXT,
            correction_requests TEXT,
            official_registry_ref TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (business_profile_id) REFERENCES business_profiles(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_app_status ON verification_applications(status);")

        # 4. Audit Logs
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS audit_logs (
            id TEXT PRIMARY KEY,
            entity_type TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            action TEXT NOT NULL,
            performed_by TEXT NOT NULL,
            details_json TEXT,
            reason TEXT,
            created_at TEXT NOT NULL
        );
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_id);")

        # 5. Indicative Prices
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS indicative_prices (
            id TEXT PRIMARY KEY,
            material TEXT NOT NULL,
            grade TEXT NOT NULL,
            min_price REAL NOT NULL,
            max_price REAL NOT NULL,
            unit TEXT NOT NULL DEFAULT 'kg',
            location TEXT NOT NULL,
            source_name TEXT,
            source_date TEXT,
            effective_date TEXT,
            expiry_date TEXT,
            status TEXT NOT NULL DEFAULT 'published',
            is_sample INTEGER NOT NULL DEFAULT 0,
            created_by TEXT,
            updated_by TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_ind_mat ON indicative_prices(material);")

        # 6. Hub Offers
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS hub_offers (
            id TEXT PRIMARY KEY,
            hub_id TEXT NOT NULL,
            hub_name TEXT NOT NULL,
            hub_verification_status TEXT NOT NULL DEFAULT 'approved',
            material TEXT NOT NULL,
            grade TEXT NOT NULL,
            rate REAL NOT NULL,
            unit TEXT NOT NULL DEFAULT 'kg',
            min_quantity_kg REAL NOT NULL DEFAULT 5.0,
            supported_services_json TEXT NOT NULL DEFAULT '["DROP_OFF"]',
            pickup_fee REAL NOT NULL DEFAULT 0.0,
            applicable_area TEXT,
            valid_from TEXT,
            valid_till TEXT,
            status TEXT NOT NULL DEFAULT 'active',
            terms_note TEXT,
            is_sample INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_offers_hub ON hub_offers(hub_id);")

        # 7. Destinations
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS destinations (
            id TEXT PRIMARY KEY,
            data_json TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        """)

        # 8. Handovers
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS handovers (
            id TEXT PRIMARY KEY,
            lot_id TEXT NOT NULL,
            collector_id TEXT NOT NULL,
            destination_id TEXT NOT NULL,
            status TEXT NOT NULL,
            manifest_code TEXT,
            data_json TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_handovers_lot ON handovers(lot_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_handovers_collector ON handovers(collector_id);")

        # 9. Pricing Transactions
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS pricing_transactions (
            id TEXT PRIMARY KEY,
            lot_id TEXT NOT NULL,
            offer_id TEXT NOT NULL,
            collector_id TEXT NOT NULL,
            hub_id TEXT NOT NULL,
            status TEXT NOT NULL,
            payment_status TEXT NOT NULL DEFAULT 'PENDING',
            manifest_code TEXT,
            data_json TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_ptx_lot ON pricing_transactions(lot_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_ptx_collector ON pricing_transactions(collector_id);")

        # 10. Lots
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS lots (
            id TEXT PRIMARY KEY,
            collector_id TEXT NOT NULL,
            collector_name TEXT,
            material TEXT NOT NULL,
            approx_weight REAL NOT NULL,
            estimated_value REAL,
            actual_weight REAL,
            purchase_amount REAL,
            status TEXT NOT NULL DEFAULT 'PENDING',
            hub_id TEXT,
            shipment_id TEXT,
            condition TEXT,
            photo_url TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            sync_status TEXT NOT NULL DEFAULT 'synced'
        );
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_lots_collector ON lots(collector_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_lots_status ON lots(status);")

        # 11. Hub Purchases
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS hub_purchases (
            id TEXT PRIMARY KEY,
            hub_id TEXT NOT NULL,
            lot_id TEXT NOT NULL,
            collector_id TEXT NOT NULL,
            material TEXT NOT NULL,
            estimated_weight REAL NOT NULL,
            actual_weight REAL,
            agreed_rate REAL,
            deductions REAL DEFAULT 0,
            net_amount REAL,
            status TEXT NOT NULL,
            weighed_at TEXT,
            confirmed_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        """)

        # 12. Payments
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS payments (
            id TEXT PRIMARY KEY,
            hub_id TEXT NOT NULL,
            purchase_id TEXT,
            lot_id TEXT,
            collector_id TEXT NOT NULL,
            amount REAL NOT NULL,
            mode TEXT NOT NULL,
            reference_id TEXT,
            status TEXT NOT NULL DEFAULT 'CONFIRMED',
            paid_at TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        """)

        # 13. Shipments
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS shipments (
            id TEXT PRIMARY KEY,
            hub_id TEXT NOT NULL,
            recycler_id TEXT NOT NULL,
            recycler_name TEXT NOT NULL,
            material TEXT NOT NULL,
            lot_ids_json TEXT NOT NULL,
            planned_quantity REAL NOT NULL,
            dispatched_quantity REAL,
            recycler_received_quantity REAL,
            discrepancy_quantity REAL,
            discrepancy_note TEXT,
            handover_hash TEXT NOT NULL,
            status TEXT NOT NULL,
            dispatched_at TEXT,
            received_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        """)
        conn.commit()

# --- Persistence helper functions ---

def save_user(user: Dict[str, Any]):
    now = datetime.utcnow().isoformat()
    with get_db_connection() as conn:
        conn.execute("""
        INSERT INTO users (id, email, phone, full_name, password_hash, role, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            email = excluded.email,
            phone = excluded.phone,
            full_name = excluded.full_name,
            password_hash = excluded.password_hash,
            role = excluded.role,
            is_active = excluded.is_active,
            updated_at = excluded.updated_at;
        """, (
            user["id"],
            user["email"].lower(),
            user.get("phone", ""),
            user["full_name"],
            user["password_hash"],
            user["role"],
            1 if user.get("is_active", True) else 0,
            user.get("created_at", now),
            user.get("updated_at", now),
        ))
        conn.commit()

def save_business_profile(prof: Dict[str, Any]):
    now = datetime.utcnow().isoformat()
    with get_db_connection() as conn:
        conn.execute("""
        INSERT INTO business_profiles (id, user_id, role, business_name, authorized_contact, facility_address, district, operating_area, accepted_materials_json, cpcb_registration_number, facility_scope, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            business_name = excluded.business_name,
            authorized_contact = excluded.authorized_contact,
            facility_address = excluded.facility_address,
            district = excluded.district,
            operating_area = excluded.operating_area,
            accepted_materials_json = excluded.accepted_materials_json,
            cpcb_registration_number = excluded.cpcb_registration_number,
            facility_scope = excluded.facility_scope,
            status = excluded.status,
            updated_at = excluded.updated_at;
        """, (
            prof["id"],
            prof["user_id"],
            prof["role"],
            prof["business_name"],
            prof["authorized_contact"],
            prof["facility_address"],
            prof["district"],
            prof.get("operating_area", ""),
            json.dumps(prof.get("accepted_materials", [])),
            prof.get("cpcb_registration_number", ""),
            prof.get("facility_scope", ""),
            prof.get("status", "pending_verification"),
            prof.get("created_at", now),
            prof.get("updated_at", now),
        ))
        conn.commit()

def save_verification_application(app: Dict[str, Any]):
    now = datetime.utcnow().isoformat()
    with get_db_connection() as conn:
        conn.execute("""
        INSERT INTO verification_applications (id, business_profile_id, user_id, role, status, submitted_at, reviewed_at, reviewer_id, review_decision, review_notes, rejection_reason, correction_requests, official_registry_ref, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            status = excluded.status,
            submitted_at = excluded.submitted_at,
            reviewed_at = excluded.reviewed_at,
            reviewer_id = excluded.reviewer_id,
            review_decision = excluded.review_decision,
            review_notes = excluded.review_notes,
            rejection_reason = excluded.rejection_reason,
            correction_requests = excluded.correction_requests,
            official_registry_ref = excluded.official_registry_ref,
            updated_at = excluded.updated_at;
        """, (
            app["id"],
            app["business_profile_id"],
            app["user_id"],
            app["role"],
            app["status"],
            app.get("submitted_at", now),
            app.get("reviewed_at"),
            app.get("reviewer_id"),
            app.get("review_decision"),
            app.get("review_notes"),
            app.get("rejection_reason"),
            app.get("correction_requests"),
            app.get("official_registry_ref"),
            app.get("created_at", now),
            app.get("updated_at", now),
        ))
        conn.commit()

def save_audit_log(entry: Dict[str, Any]):
    now = datetime.utcnow().isoformat()
    with get_db_connection() as conn:
        conn.execute("""
        INSERT INTO audit_logs (id, entity_type, entity_id, action, performed_by, details_json, reason, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?);
        """, (
            entry["id"],
            entry["entity_type"],
            entry["entity_id"],
            entry["action"],
            entry["performed_by"],
            json.dumps(entry.get("details", {})),
            entry.get("reason"),
            entry.get("created_at", now),
        ))
        conn.commit()

def save_indicative_price(price: Dict[str, Any]):
    now = datetime.utcnow().isoformat()
    with get_db_connection() as conn:
        conn.execute("""
        INSERT INTO indicative_prices (id, material, grade, min_price, max_price, unit, location, source_name, source_date, effective_date, expiry_date, status, is_sample, created_by, updated_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            min_price = excluded.min_price,
            max_price = excluded.max_price,
            grade = excluded.grade,
            location = excluded.location,
            source_name = excluded.source_name,
            source_date = excluded.source_date,
            effective_date = excluded.effective_date,
            expiry_date = excluded.expiry_date,
            status = excluded.status,
            updated_by = excluded.updated_by,
            updated_at = excluded.updated_at;
        """, (
            price["id"],
            price["material"],
            price["grade"],
            float(price["min_price"]),
            float(price["max_price"]),
            price.get("unit", "kg"),
            price.get("location", "Bengaluru Urban"),
            price.get("source_name"),
            price.get("source_date"),
            price.get("effective_date"),
            price.get("expiry_date"),
            price.get("status", "published"),
            1 if price.get("is_sample") else 0,
            price.get("created_by"),
            price.get("updated_by"),
            price.get("created_at", now),
            price.get("updated_at", now),
        ))
        conn.commit()

def save_hub_offer(offer: Dict[str, Any]):
    now = datetime.utcnow().isoformat()
    with get_db_connection() as conn:
        conn.execute("""
        INSERT INTO hub_offers (id, hub_id, hub_name, hub_verification_status, material, grade, rate, unit, min_quantity_kg, supported_services_json, pickup_fee, applicable_area, valid_from, valid_till, status, terms_note, is_sample, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            rate = excluded.rate,
            grade = excluded.grade,
            min_quantity_kg = excluded.min_quantity_kg,
            supported_services_json = excluded.supported_services_json,
            pickup_fee = excluded.pickup_fee,
            applicable_area = excluded.applicable_area,
            valid_till = excluded.valid_till,
            status = excluded.status,
            terms_note = excluded.terms_note,
            updated_at = excluded.updated_at;
        """, (
            offer["id"],
            offer["hub_id"],
            offer.get("hub_name", "Hub"),
            offer.get("hub_verification_status", "approved"),
            offer["material"],
            offer["grade"],
            float(offer["rate"]),
            offer.get("unit", "kg"),
            float(offer.get("min_quantity_kg", 5.0)),
            json.dumps(offer.get("supported_services", ["DROP_OFF"])),
            float(offer.get("pickup_fee", 0.0)),
            offer.get("applicable_area"),
            offer.get("valid_from"),
            offer.get("valid_till"),
            offer.get("status", "active"),
            offer.get("terms_note"),
            1 if offer.get("is_sample") else 0,
            offer.get("created_at", now),
            offer.get("updated_at", now),
        ))
        conn.commit()

def save_destination(dest: Dict[str, Any]):
    now = datetime.utcnow().isoformat()
    with get_db_connection() as conn:
        conn.execute("""
        INSERT INTO destinations (id, data_json, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            data_json = excluded.data_json,
            updated_at = excluded.updated_at;
        """, (
            dest["id"],
            json.dumps(dest),
            now
        ))
        conn.commit()

def save_handover(handover: Dict[str, Any]):
    now = datetime.utcnow().isoformat()
    with get_db_connection() as conn:
        conn.execute("""
        INSERT INTO handovers (id, lot_id, collector_id, destination_id, status, manifest_code, data_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            status = excluded.status,
            manifest_code = excluded.manifest_code,
            data_json = excluded.data_json,
            updated_at = excluded.updated_at;
        """, (
            handover["id"],
            handover["lot_id"],
            handover["collector_id"],
            handover["destination_id"],
            handover["status"],
            handover.get("manifest_code"),
            json.dumps(handover),
            handover.get("created_at", now),
            handover.get("updated_at", now),
        ))
        conn.commit()

def save_pricing_transaction(tx: Dict[str, Any]):
    now = datetime.utcnow().isoformat()
    with get_db_connection() as conn:
        conn.execute("""
        INSERT INTO pricing_transactions (id, lot_id, offer_id, collector_id, hub_id, status, payment_status, manifest_code, data_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            status = excluded.status,
            payment_status = excluded.payment_status,
            manifest_code = excluded.manifest_code,
            data_json = excluded.data_json,
            updated_at = excluded.updated_at;
        """, (
            tx["id"],
            tx["lot_id"],
            tx.get("offer_id", ""),
            tx["collector_id"],
            tx["hub_id"],
            tx["status"],
            tx.get("payment_status", "PENDING"),
            tx.get("manifest_code"),
            json.dumps(tx),
            tx.get("created_at", now),
            tx.get("updated_at", now),
        ))
        conn.commit()

def save_lot(lot: Dict[str, Any]):
    now = datetime.utcnow().isoformat()
    with get_db_connection() as conn:
        conn.execute("""
        INSERT INTO lots (id, collector_id, collector_name, material, approx_weight, estimated_value, actual_weight, purchase_amount, status, hub_id, shipment_id, condition, photo_url, created_at, updated_at, sync_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            approx_weight = excluded.approx_weight,
            estimated_value = excluded.estimated_value,
            actual_weight = excluded.actual_weight,
            purchase_amount = excluded.purchase_amount,
            status = excluded.status,
            hub_id = excluded.hub_id,
            shipment_id = excluded.shipment_id,
            condition = excluded.condition,
            photo_url = excluded.photo_url,
            updated_at = excluded.updated_at,
            sync_status = excluded.sync_status;
        """, (
            lot["id"],
            lot.get("collector_id") or lot.get("collectorId", "KAB-7842"),
            lot.get("collector_name") or lot.get("collectorName"),
            lot["material"],
            float(lot.get("approx_weight") or lot.get("weight") or 0.0),
            float(lot.get("estimated_value") or lot.get("estimate") or 0.0),
            float(lot["actual_weight"]) if lot.get("actual_weight") is not None else (float(lot["actualWeight"]) if lot.get("actualWeight") is not None else None),
            float(lot["purchase_amount"]) if lot.get("purchase_amount") is not None else (float(lot["purchaseAmount"]) if lot.get("purchaseAmount") is not None else None),
            lot.get("status", "PENDING"),
            lot.get("hub_id") or lot.get("hubId"),
            lot.get("shipment_id") or lot.get("shipmentId"),
            lot.get("condition"),
            lot.get("photo_url") or lot.get("photoUrl") or lot.get("photo"),
            lot.get("created_at") or (datetime.fromtimestamp(lot["timestamp"] / 1000.0).isoformat() if "timestamp" in lot else now),
            lot.get("updated_at", now),
            lot.get("sync_status", "synced"),
        ))
        conn.commit()

def _format_timestamp(val: Any) -> Optional[str]:
    """Helper to convert integer epoch (ms or s) or strings into ISO format."""
    if val is None or val == "":
        return None
    if isinstance(val, (int, float)):
        # If timestamp is in milliseconds (> 1e11), convert to seconds
        sec = val / 1000.0 if val > 1e11 else float(val)
        return datetime.utcfromtimestamp(sec).isoformat()
    return str(val)

def save_hub_purchase(purchase: Dict[str, Any]):
    now = datetime.utcnow().isoformat()
    with get_db_connection() as conn:
        conn.execute("""
        INSERT INTO hub_purchases (id, hub_id, lot_id, collector_id, material, estimated_weight, actual_weight, agreed_rate, deductions, net_amount, status, weighed_at, confirmed_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            actual_weight = excluded.actual_weight,
            agreed_rate = excluded.agreed_rate,
            deductions = excluded.deductions,
            net_amount = excluded.net_amount,
            status = excluded.status,
            weighed_at = excluded.weighed_at,
            confirmed_at = excluded.confirmed_at,
            updated_at = excluded.updated_at;
        """, (
            purchase["id"],
            purchase.get("hub_id") or purchase.get("hubId"),
            purchase.get("lot_id") or purchase.get("lotId"),
            purchase.get("collector_id") or purchase.get("collectorId"),
            purchase["material"],
            float(purchase.get("estimated_weight") or purchase.get("estimatedWeight") or 0.0),
            float(purchase["actual_weight"]) if purchase.get("actual_weight") is not None else (float(purchase["actualWeight"]) if purchase.get("actualWeight") is not None else None),
            float(purchase["agreed_rate"]) if purchase.get("agreed_rate") is not None else (float(purchase["agreedRate"]) if purchase.get("agreedRate") is not None else None),
            float(purchase.get("deductions") or 0.0),
            float(purchase["net_amount"]) if purchase.get("net_amount") is not None else (float(purchase["netAmount"]) if purchase.get("netAmount") is not None else None),
            purchase.get("status", "AWAITING_WEIGHT"),
            _format_timestamp(purchase.get("weighed_at") or purchase.get("weighedAt")),
            _format_timestamp(purchase.get("confirmed_at") or purchase.get("confirmedAt")),
            _format_timestamp(purchase.get("created_at") or purchase.get("createdAt")) or now,
            _format_timestamp(purchase.get("updated_at") or purchase.get("updatedAt")) or now,
        ))

        # Propagate intake weigh-in to persistent lots table
        lot_id = purchase.get("lot_id") or purchase.get("lotId")
        if lot_id:
            p_status = purchase.get("status", "")
            lot_status = "PAID" if p_status == "PAID" else ("PURCHASE_CONFIRMED" if p_status == "PURCHASE_CONFIRMED" else ("AWAITING_COLLECTOR_CONFIRMATION" if p_status == "AWAITING_COLLECTOR_CONFIRMATION" else None))
            act_wt = float(purchase["actual_weight"]) if purchase.get("actual_weight") is not None else (float(purchase["actualWeight"]) if purchase.get("actualWeight") is not None else None)
            net_amt = float(purchase["net_amount"]) if purchase.get("net_amount") is not None else (float(purchase["netAmount"]) if purchase.get("netAmount") is not None else None)
            h_id = purchase.get("hub_id") or purchase.get("hubId")
            
            updates = ["updated_at = ?"]
            params = [now]
            if lot_status:
                updates.append("status = ?")
                params.append(lot_status)
            if act_wt is not None:
                updates.append("actual_weight = ?")
                params.append(act_wt)
            if net_amt is not None:
                updates.append("purchase_amount = ?")
                params.append(net_amt)
            if h_id:
                updates.append("hub_id = ?")
                params.append(h_id)
            params.append(lot_id)
            conn.execute(f"UPDATE lots SET {', '.join(updates)} WHERE id = ?;", tuple(params))
        conn.commit()

def save_payment(p: Dict[str, Any]):
    now = datetime.utcnow().isoformat()
    with get_db_connection() as conn:
        conn.execute("""
        INSERT INTO payments (id, hub_id, purchase_id, lot_id, collector_id, amount, mode, reference_id, status, paid_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            status = excluded.status,
            reference_id = excluded.reference_id,
            paid_at = excluded.paid_at,
            updated_at = excluded.updated_at;
        """, (
            p["id"],
            p.get("hub_id") or p.get("hubId"),
            p.get("purchase_id") or p.get("purchaseId"),
            p.get("lot_id") or p.get("lotId"),
            p.get("collector_id") or p.get("collectorId"),
            float(p["amount"]),
            p.get("mode") or p.get("method", "CASH"),
            p.get("reference_id") or p.get("referenceNote"),
            p.get("status", "CONFIRMED"),
            _format_timestamp(p.get("paid_at") or p.get("paidAt")) or now,
            _format_timestamp(p.get("created_at") or p.get("createdAt")) or now,
            _format_timestamp(p.get("updated_at") or p.get("updatedAt")) or now,
        ))

        # Propagate payment status to persistent lots table
        lot_id = p.get("lot_id") or p.get("lotId")
        if lot_id and p.get("status") in ("CONFIRMED", "PAID"):
            conn.execute("UPDATE lots SET status = 'PAID', updated_at = ? WHERE id = ?;", (now, lot_id))
        conn.commit()

def save_shipment(s: Dict[str, Any]):
    now = datetime.utcnow().isoformat()
    dispatched_at = _format_timestamp(s.get("dispatched_at") or s.get("dispatchTimestamp") or s.get("dispatchedTimestamp"))
    received_at = _format_timestamp(s.get("received_at") or s.get("receivedTimestamp"))
    created_at = _format_timestamp(s.get("created_at") or s.get("createdAt")) or now
    updated_at = _format_timestamp(s.get("updated_at") or s.get("updatedAt")) or now
    lot_ids = s.get("lot_ids") or s.get("lotIds") or []

    with get_db_connection() as conn:
        conn.execute("""
        INSERT INTO shipments (id, hub_id, recycler_id, recycler_name, material, lot_ids_json, planned_quantity, dispatched_quantity, recycler_received_quantity, discrepancy_quantity, discrepancy_note, handover_hash, status, dispatched_at, received_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            dispatched_quantity = excluded.dispatched_quantity,
            recycler_received_quantity = excluded.recycler_received_quantity,
            discrepancy_quantity = excluded.discrepancy_quantity,
            discrepancy_note = excluded.discrepancy_note,
            status = excluded.status,
            dispatched_at = excluded.dispatched_at,
            received_at = excluded.received_at,
            updated_at = excluded.updated_at;
        """, (
            s["id"],
            s.get("hub_id") or s.get("hubId"),
            s.get("recycler_id") or s.get("recyclerId"),
            s.get("recycler_name") or s.get("recyclerName", "Recycler"),
            s["material"],
            json.dumps(lot_ids),
            float(s.get("planned_quantity") or s.get("plannedQuantity") or 0.0),
            float(s["dispatched_quantity"]) if s.get("dispatched_quantity") is not None else (float(s["dispatchedQuantity"]) if s.get("dispatchedQuantity") is not None else None),
            float(s["recycler_received_quantity"]) if s.get("recycler_received_quantity") is not None else (float(s["recyclerReceivedQuantity"]) if s.get("recyclerReceivedQuantity") is not None else None),
            float(s["discrepancy_quantity"]) if s.get("discrepancy_quantity") is not None else (float(s["discrepancyQuantity"]) if s.get("discrepancyQuantity") is not None else None),
            s.get("discrepancy_note") or s.get("discrepancyNote"),
            s.get("handover_hash") or s.get("handoverHash", "000000"),
            s.get("status", "DRAFT"),
            dispatched_at,
            received_at,
            created_at,
            updated_at,
        ))

        # Propagate shipment aggregation and recycler receipt to persistent lots table
        shipment_status = s.get("status", "DRAFT")
        for lid in lot_ids:
            if shipment_status in ("RECEIVED_BY_RECYCLER", "COMPLETED"):
                conn.execute("""
                UPDATE lots SET shipment_id = ?, status = 'COMPLETED', updated_at = ?
                WHERE id = ?;
                """, (s["id"], now, lid))
            else:
                conn.execute("""
                UPDATE lots SET shipment_id = ?, updated_at = ?
                WHERE id = ?;
                """, (s["id"], now, lid))
        conn.commit()

# --- Loader function to populate memory from SQLite on startup ---

def load_all_from_db() -> Dict[str, Any]:
    """Loads all records from SQLite into structured dictionaries."""
    init_db()
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Users
        cursor.execute("SELECT * FROM users;")
        users = {row["id"]: dict(row) for row in cursor.fetchall()}
        for u in users.values():
            u["is_active"] = bool(u["is_active"])

        # Business Profiles
        cursor.execute("SELECT * FROM business_profiles;")
        profiles = {}
        for row in cursor.fetchall():
            d = dict(row)
            d["accepted_materials"] = json.loads(d.pop("accepted_materials_json") or "[]")
            profiles[d["id"]] = d

        # Verification Applications
        cursor.execute("SELECT * FROM verification_applications;")
        apps = {row["id"]: dict(row) for row in cursor.fetchall()}

        # Audit Logs
        cursor.execute("SELECT * FROM audit_logs ORDER BY created_at ASC;")
        audits = []
        for row in cursor.fetchall():
            d = dict(row)
            d["details"] = json.loads(d.pop("details_json") or "{}")
            audits.append(d)

        # Indicative Prices
        cursor.execute("SELECT * FROM indicative_prices;")
        prices = {}
        for row in cursor.fetchall():
            d = dict(row)
            d["is_sample"] = bool(d["is_sample"])
            prices[d["id"]] = d

        # Hub Offers
        cursor.execute("SELECT * FROM hub_offers;")
        offers = {}
        for row in cursor.fetchall():
            d = dict(row)
            d["is_sample"] = bool(d["is_sample"])
            d["supported_services"] = json.loads(d.pop("supported_services_json") or "[]")
            offers[d["id"]] = d

        # Destinations
        cursor.execute("SELECT * FROM destinations;")
        destinations = {row["id"]: json.loads(row["data_json"]) for row in cursor.fetchall()}

        # Handovers
        cursor.execute("SELECT * FROM handovers;")
        handovers = {row["id"]: json.loads(row["data_json"]) for row in cursor.fetchall()}

        # Pricing Transactions
        cursor.execute("SELECT * FROM pricing_transactions;")
        transactions = {row["id"]: json.loads(row["data_json"]) for row in cursor.fetchall()}

        # Lots
        cursor.execute("SELECT * FROM lots;")
        lots = {row["id"]: dict(row) for row in cursor.fetchall()}

        # Hub Purchases
        cursor.execute("SELECT * FROM hub_purchases;")
        purchases = {row["id"]: dict(row) for row in cursor.fetchall()}

        # Payments
        cursor.execute("SELECT * FROM payments;")
        payments = {row["id"]: dict(row) for row in cursor.fetchall()}

        # Shipments
        cursor.execute("SELECT * FROM shipments;")
        shipments = {}
        for row in cursor.fetchall():
            d = dict(row)
            d["lot_ids"] = json.loads(d.pop("lot_ids_json") or "[]")
            shipments[d["id"]] = d

    return {
        "users": users,
        "business_profiles": profiles,
        "verification_applications": apps,
        "audit_logs": audits,
        "indicative_prices": prices,
        "hub_offers": offers,
        "destinations": destinations,
        "handovers": handovers,
        "pricing_transactions": transactions,
        "lots": lots,
        "hub_purchases": purchases,
        "payments": payments,
        "shipments": shipments,
    }
