"""
test_auth_security.py
Comprehensive automated test suite for Server-Side Authentication & Role Authorization (Priority 1).
Validates:
- Cryptographic JWT signing and expiry
- Token rejection on missing, invalid, forged, and expired tokens (HTTP 401)
- Role authorization rejection on wrong roles (HTTP 403)
- Public registration gating (ADMIN rejection)
- Token-derived identity enforcement (no header spoofing)
"""

import os
import unittest
from datetime import datetime, timedelta
import jwt
from fastapi.testclient import TestClient

# Ensure dev test environment
os.environ["ENVIRONMENT"] = "development"
from main import app, JWT_SECRET, create_access_token


class TestAuthAndRBAC(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_01_public_registration_rejects_admin(self):
        """Public registration cannot select or create ADMIN accounts."""
        res = self.client.post("/auth/register", json={
            "email": "malicious_admin@test.com",
            "password": "Password123!",
            "full_name": "Attacker",
            "role": "ADMIN"
        })
        self.assertEqual(res.status_code, 403)
        self.assertIn("Public registration cannot create Administrator accounts", res.json()["detail"])

    def test_02_collector_registration_issues_signed_token(self):
        """Collector registration creates user and returns a cryptographically valid JWT token."""
        res = self.client.post("/auth/register", json={
            "email": f"collector_sec_{datetime.utcnow().timestamp()}@test.com",
            "password": "Password123!",
            "full_name": "Sec Test Collector",
            "role": "COLLECTOR"
        })
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("token", data)
        # Verify cryptographic signature and claims
        payload = jwt.decode(data["token"], JWT_SECRET, algorithms=["HS256"])
        self.assertEqual(payload["role"], "COLLECTOR")
        self.assertEqual(payload["user_id"], data["user"]["id"])
        self.assertIn("exp", payload)

    def test_03_login_authentication_and_token_expiry(self):
        """Login returns valid signed token with future expiration timestamp."""
        res = self.client.post("/auth/login", json={
            "email": "admin@kabadiwala.in",
            "password": "Admin@123"
        })
        self.assertEqual(res.status_code, 200)
        data = res.json()
        token = data["token"]
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        self.assertEqual(payload["role"], "ADMIN")
        exp_time = datetime.fromtimestamp(payload["exp"])
        self.assertGreater(exp_time, datetime.utcnow())

    def test_04_missing_token_rejected_401(self):
        """Protected endpoints reject requests without Authorization Bearer header with 401."""
        res = self.client.get("/admin/applications")
        self.assertEqual(res.status_code, 401)
        self.assertIn("Missing Bearer token", res.json()["detail"])

    def test_05_malformed_token_rejected_401(self):
        """Protected endpoints reject malformed / garbled tokens with 401."""
        res = self.client.get("/admin/applications", headers={
            "Authorization": "Bearer not.a.real.jwt.token"
        })
        self.assertEqual(res.status_code, 401)
        self.assertIn("Invalid authentication token", res.json()["detail"])

    def test_06_forged_secret_token_rejected_401(self):
        """Tokens signed with a different secret are rejected with 401."""
        fake_secret = "completely_different_attacker_secret_key_123456"
        forged_token = jwt.encode(
            {"user_id": "hacker-1", "role": "ADMIN", "exp": datetime.utcnow() + timedelta(hours=1)},
            fake_secret,
            algorithm="HS256"
        )
        res = self.client.get("/admin/applications", headers={
            "Authorization": f"Bearer {forged_token}"
        })
        self.assertEqual(res.status_code, 401)
        self.assertIn("Invalid authentication token", res.json()["detail"])

    def test_07_expired_token_rejected_401(self):
        """Expired tokens are strictly rejected with 401 Expired."""
        expired_token = jwt.encode(
            {
                "user_id": "admin-sys-001",
                "role": "ADMIN",
                "exp": datetime.utcnow() - timedelta(minutes=10),
                "iat": datetime.utcnow() - timedelta(hours=1)
            },
            JWT_SECRET,
            algorithm="HS256"
        )
        res = self.client.get("/admin/applications", headers={
            "Authorization": f"Bearer {expired_token}"
        })
        self.assertEqual(res.status_code, 401)
        self.assertIn("Token has expired", res.json()["detail"])

    def test_08_token_missing_identity_claims_rejected_401(self):
        """Tokens without role or user_id are rejected with 401."""
        incomplete_token = jwt.encode(
            {"something_else": "abc", "exp": datetime.utcnow() + timedelta(hours=1)},
            JWT_SECRET,
            algorithm="HS256"
        )
        res = self.client.get("/admin/applications", headers={
            "Authorization": f"Bearer {incomplete_token}"
        })
        self.assertEqual(res.status_code, 401)

    def test_09_wrong_role_collector_accessing_admin_rejected_403(self):
        """A valid Collector token attempting to access Admin endpoints is rejected with 403."""
        collector_token = create_access_token({
            "user_id": "col-test-01",
            "role": "COLLECTOR"
        })
        res = self.client.get("/admin/applications", headers={
            "Authorization": f"Bearer {collector_token}"
        })
        self.assertEqual(res.status_code, 403)
        self.assertIn("not authorized", res.json()["detail"])

    def test_10_wrong_role_collector_accessing_hub_intake_rejected_403(self):
        """A Collector token attempting to record hub scale intake is rejected with 403."""
        collector_token = create_access_token({
            "user_id": "col-test-01",
            "role": "COLLECTOR"
        })
        res = self.client.post("/pricing/transactions/TX-DUMMY/intake", headers={
            "Authorization": f"Bearer {collector_token}"
        }, json={"actual_weight": 10.0})
        self.assertEqual(res.status_code, 403)

    def test_11_wrong_role_hub_accessing_admin_review_rejected_403(self):
        """A Hub token attempting to review an application is rejected with 403."""
        hub_token = create_access_token({
            "user_id": "hub-test-01",
            "role": "HUB"
        })
        res = self.client.post("/admin/applications/APP-001/review", headers={
            "Authorization": f"Bearer {hub_token}"
        }, json={"action": "approve"})
        self.assertEqual(res.status_code, 403)

    def test_12_legacy_role_headers_ignored(self):
        """Sending untrusted X-User-Role: ADMIN without a valid token is rejected with 401."""
        res = self.client.get("/admin/applications", headers={
            "X-User-Role": "ADMIN",
            "X-User-Id": "admin-sys-001"
        })
        self.assertEqual(res.status_code, 401)

    def test_13_authorized_admin_access_succeeds(self):
        """Admin with valid signed token successfully accesses admin endpoints."""
        admin_token = create_access_token({
            "user_id": "admin-sys-001",
            "role": "ADMIN",
            "full_name": "CPCB State Admin Officer"
        })
        res = self.client.get("/admin/applications", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        self.assertEqual(res.status_code, 200)
        self.assertIn("applications", res.json())


if __name__ == "__main__":
    unittest.main(verbosity=2)
