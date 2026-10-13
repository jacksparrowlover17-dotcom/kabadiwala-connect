import os
import sys
import unittest
import json
import io
from fastapi.testclient import TestClient

# Ensure backend directory is in path
sys.path.insert(0, os.path.dirname(__file__))

import main
import storage

class TestBackendPersistenceAndSync(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(main.app)

    def test_01_backend_restart_persistence(self):
        """Tests that records created via the backend persist across an emulated restart/reload."""
        # 1. Register a test user
        unique_email = f"persisted.collector.{os.urandom(4).hex()}@test.in"
        reg_resp = self.client.post("/auth/register", json={
            "email": unique_email,
            "password": "Password@123",
            "fullName": "Persistent Test Collector",
            "role": "COLLECTOR"
        })
        self.assertEqual(reg_resp.status_code, 200, reg_resp.text)
        token = reg_resp.json()["token"]
        user_id = reg_resp.json()["user"]["id"]
        headers = {"Authorization": f"Bearer {token}"}

        # 2. Create a lot
        lot_resp = self.client.post("/lots", headers=headers, json={
            "material": "Circuit Boards (PCB)",
            "approxWeight": 14.5,
            "estimatedValue": 3625.0,
            "condition": "Mixed Scrap"
        })
        self.assertEqual(lot_resp.status_code, 200, lot_resp.text)
        lot_id = lot_resp.json()["lot"]["id"]

        # 3. Request a handover
        hnd_resp = self.client.post("/handovers/quote-request", headers=headers, json={
            "lotId": lot_id,
            "destinationId": "HUB-BLR-01",
            "material": "Circuit Boards (PCB)",
            "estimatedWeight": 14.5,
            "serviceType": "DROP_OFF"
        })
        self.assertEqual(hnd_resp.status_code, 200, hnd_resp.text)
        handover_id = hnd_resp.json()["handover"]["id"]

        # 4. Simulate complete server process restart by re-reading directly from persistent disk DB
        reloaded_db = storage.load_all_from_db()
        self.assertIn(user_id, reloaded_db["users"], "User must persist in DB across restarts")
        self.assertEqual(reloaded_db["users"][user_id]["email"], unique_email.lower())
        self.assertIn(lot_id, reloaded_db["lots"], "Lot must persist in DB across restarts")
        self.assertIn(handover_id, reloaded_db["handovers"], "Handover must persist in DB across restarts")

    def test_02_sync_push_idempotency_and_duplicate_prevention(self):
        """Tests that pushing the same record multiple times via /sync/push is idempotent and does not create duplicates."""
        # Login as collector
        reg_resp = self.client.post("/auth/register", json={
            "email": f"idempotent.{os.urandom(4).hex()}@test.in",
            "password": "Password@123",
            "fullName": "Idempotent Collector",
            "role": "COLLECTOR"
        })
        token = reg_resp.json()["token"]
        user_id = reg_resp.json()["user"]["id"]
        headers = {"Authorization": f"Bearer {token}"}

        lot_id = f"LOT-SYNC-{os.urandom(4).hex().upper()}"
        payload = {
            "lots": [{
                "id": lot_id,
                "collector_id": user_id,
                "material": "Copper Cables",
                "approx_weight": 22.0,
                "estimated_value": 9240.0,
                "status": "PENDING"
            }]
        }

        # First push
        push_resp_1 = self.client.post("/sync/push", headers=headers, json=payload)
        self.assertEqual(push_resp_1.status_code, 200)
        self.assertIn(lot_id, push_resp_1.json()["synced"]["lots"])

        # Second push (identical payload)
        push_resp_2 = self.client.post("/sync/push", headers=headers, json=payload)
        self.assertEqual(push_resp_2.status_code, 200)
        self.assertIn(lot_id, push_resp_2.json()["synced"]["lots"])

        # Verify only one record exists in storage
        reloaded = storage.load_all_from_db()
        self.assertEqual(reloaded["lots"][lot_id]["approx_weight"], 22.0)

    def test_03_sync_conflict_detection(self):
        """Tests that attempting to push an outdated status over a finalized server lot produces a conflict."""
        reg_resp = self.client.post("/auth/register", json={
            "email": f"conflict.{os.urandom(4).hex()}@test.in",
            "password": "Password@123",
            "fullName": "Conflict Collector",
            "role": "COLLECTOR"
        })
        token = reg_resp.json()["token"]
        user_id = reg_resp.json()["user"]["id"]
        headers = {"Authorization": f"Bearer {token}"}

        lot_id = f"LOT-CONF-{os.urandom(4).hex().upper()}"
        # Set server lot directly to COMPLETED
        main.MEM_LOTS[lot_id] = {
            "id": lot_id,
            "collector_id": user_id,
            "material": "Mobile Phones",
            "approx_weight": 5.0,
            "status": "COMPLETED",
            "updated_at": "2026-10-13T20:00:00"
        }
        storage.save_lot(main.MEM_LOTS[lot_id])

        # Client attempts to push stale PENDING state
        stale_payload = {
            "lots": [{
                "id": lot_id,
                "collector_id": user_id,
                "material": "Mobile Phones",
                "approx_weight": 5.0,
                "status": "PENDING"
            }]
        }
        push_resp = self.client.post("/sync/push", headers=headers, json=stale_payload)
        self.assertEqual(push_resp.status_code, 200)
        conflicts = push_resp.json()["conflicts"]
        self.assertTrue(any(c["id"] == lot_id for c in conflicts), "Expected conflict for finalized lot")

    def test_04_role_authorization_on_sync_endpoints(self):
        """Tests that a Collector cannot push Hub Purchases or Shipments."""
        reg_resp = self.client.post("/auth/register", json={
            "email": f"auth.sync.{os.urandom(4).hex()}@test.in",
            "password": "Password@123",
            "fullName": "Auth Test Collector",
            "role": "COLLECTOR"
        })
        token = reg_resp.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}

        unauthorized_payload = {
            "hub_purchases": [{
                "id": "PUR-ILLEGAL-01",
                "hub_id": "HUB-BLR-01",
                "lot_id": "LOT-1",
                "material": "Circuit Boards (PCB)",
                "actual_weight": 10.0
            }]
        }
        resp = self.client.post("/sync/push", headers=headers, json=unauthorized_payload)
        self.assertEqual(resp.status_code, 200)
        errors = resp.json()["errors"]
        self.assertTrue(any("Forbidden" in e.get("error", "") for e in errors))

    def test_05_photo_validation(self):
        """Tests MIME type and file validation for photo uploads."""
        # Login
        login_resp = self.client.post("/auth/login", json={
            "email": "admin@kabadiwala.in",
            "password": "Admin@123"
        })
        token = login_resp.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Invalid mime type (text/plain)
        fake_txt = io.BytesIO(b"Not an image")
        bad_resp = self.client.post(
            "/photos/upload",
            headers=headers,
            files={"file": ("test.txt", fake_txt, "text/plain")}
        )
        self.assertEqual(bad_resp.status_code, 400)
        self.assertIn("Invalid photo type", bad_resp.json()["detail"])

        # 2. Valid image mime type (image/jpeg)
        valid_jpeg = io.BytesIO(b"\xff\xd8\xff\xe0\x00\x10JFIF" + b"\x00" * 100)
        ok_resp = self.client.post(
            "/photos/upload",
            headers=headers,
            files={"file": ("evidence.jpg", valid_jpeg, "image/jpeg")}
        )
        self.assertEqual(ok_resp.status_code, 200)
        self.assertTrue(ok_resp.json()["photo_url"].startswith("/media/photos/"))

    def test_06_chain_of_custody_intake_shipment_recycler_persistence(self):
        """Tests that lot state propagates properly when hub intake, shipment, and recycler receipt occur."""
        # 1. Login as Admin/Hub
        hub_resp = self.client.post("/auth/login", json={
            "email": "admin@kabadiwala.in",
            "password": "Admin@123"
        })
        token = hub_resp.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 2. Collector creates a lot
        lot_id = f"LOT-CUSTODY-{os.urandom(3).hex().upper()}"
        col_lot = {
            "id": lot_id,
            "collector_id": "collector-001",
            "material": "Circuit Boards (PCB)",
            "approx_weight": 50.0,
            "estimated_value": 12500.0,
            "status": "PENDING"
        }
        storage.save_lot(col_lot)
        main.MEM_LOTS[lot_id] = col_lot

        # 3. Hub records intake weigh-in via /sync/push
        purchase_id = f"PUR-{os.urandom(3).hex().upper()}"
        hp_record = {
            "id": purchase_id,
            "hub_id": "HUB-BLR-01",
            "lot_id": lot_id,
            "collector_id": "collector-001",
            "material": "Circuit Boards (PCB)",
            "estimated_weight": 50.0,
            "actual_weight": 52.5,
            "agreed_rate": 260.0,
            "net_amount": 13650.0,
            "status": "PURCHASE_CONFIRMED",
            "weighed_at": 1728844800000 # Millisecond epoch
        }
        push_hp = self.client.post("/sync/push", headers=headers, json={"hub_purchases": [hp_record]})
        self.assertEqual(push_hp.status_code, 200)

        # Check lot has updated actual weight and status in storage
        reloaded = storage.load_all_from_db()
        self.assertEqual(reloaded["lots"][lot_id]["actual_weight"], 52.5)
        self.assertEqual(reloaded["lots"][lot_id]["status"], "PURCHASE_CONFIRMED")

        # 4. Hub aggregates lot into a bulk shipment
        shipment_id = f"SHP-{os.urandom(3).hex().upper()}"
        shipment_record = {
            "id": shipment_id,
            "hub_id": "HUB-BLR-01",
            "recycler_id": "R1",
            "recycler_name": "Green Earth Recycling",
            "material": "Circuit Boards (PCB)",
            "lot_ids": [lot_id],
            "planned_quantity": 52.5,
            "dispatched_quantity": 52.5,
            "handover_hash": "654321",
            "status": "DISPATCHED",
            "dispatchTimestamp": 1728848400000
        }
        push_shp = self.client.post("/sync/push", headers=headers, json={"shipments": [shipment_record]})
        self.assertEqual(push_shp.status_code, 200)

        # Verify lot is linked to shipment
        reloaded = storage.load_all_from_db()
        self.assertEqual(reloaded["lots"][lot_id]["shipment_id"], shipment_id)

        # 5. Recycler receives shipment and confirms gate intake
        received_shipment = dict(shipment_record)
        received_shipment["status"] = "RECEIVED_BY_RECYCLER"
        received_shipment["recycler_received_quantity"] = 52.0
        received_shipment["discrepancy_quantity"] = -0.5
        received_shipment["discrepancy_note"] = "Minor transit loss 0.95%"
        received_shipment["receivedTimestamp"] = 1728852000000

        push_rcv = self.client.post("/sync/push", headers=headers, json={"shipments": [received_shipment]})
        self.assertEqual(push_rcv.status_code, 200)

        # Verify participating lot is marked COMPLETED in persistent storage across reload
        reloaded_final = storage.load_all_from_db()
        self.assertEqual(reloaded_final["lots"][lot_id]["status"], "COMPLETED")
        self.assertEqual(reloaded_final["shipments"][shipment_id]["status"], "RECEIVED_BY_RECYCLER")
        self.assertEqual(reloaded_final["shipments"][shipment_id]["recycler_received_quantity"], 52.0)
        self.assertIsNotNone(reloaded_final["shipments"][shipment_id]["received_at"])

        # Test querying shipments endpoint
        get_shp = self.client.get("/shipments", headers=headers)
        self.assertEqual(get_shp.status_code, 200)
        self.assertTrue(any(s["id"] == shipment_id for s in get_shp.json()["shipments"]))

if __name__ == "__main__":
    unittest.main()
