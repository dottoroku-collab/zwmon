"""
Phase 5 Backend Tests: New Features
- Password change API
- Monitoring APIs (status, ping, history)
- Settings API (site name/logo)
- Access control tests
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from previous iterations
CREDENTIALS = {
    "admin": {"email": "admin@telkom.co.id", "password": "admin123"},
    "am": {"email": "am@telkom.co.id", "password": "am123456"},
    "helpdesk": {"email": "helpdesk@telkom.co.id", "password": "helpdesk123"},
    "eos": {"email": "eos@telkom.co.id", "password": "eos123456"},
    "client": {"email": "warroom@kominfo.go.id", "password": "warroom123"},
}


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


def get_token(api_client, role):
    """Get auth token for a role"""
    creds = CREDENTIALS.get(role)
    if not creds:
        pytest.skip(f"No credentials for role: {role}")
    response = api_client.post(f"{BASE_URL}/api/auth/login", json=creds)
    if response.status_code != 200:
        pytest.skip(f"Login failed for {role}: {response.text}")
    return response.json().get("token")


class TestPasswordChange:
    """Tests for PUT /api/auth/password"""

    def test_password_change_success(self, api_client):
        """AM can change password with correct current password"""
        token = get_token(api_client, "am")
        headers = {"Authorization": f"Bearer {token}"}
        
        # Change password to new one
        response = api_client.put(
            f"{BASE_URL}/api/auth/password",
            json={"current_password": "am123456", "new_password": "am_newpass123"},
            headers=headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        assert "berhasil" in response.json().get("message", "").lower()
        
        # Change it back
        response2 = api_client.put(
            f"{BASE_URL}/api/auth/password",
            json={"current_password": "am_newpass123", "new_password": "am123456"},
            headers=headers
        )
        assert response2.status_code == 200

    def test_password_change_wrong_current(self, api_client):
        """Password change fails with wrong current password"""
        token = get_token(api_client, "helpdesk")
        headers = {"Authorization": f"Bearer {token}"}
        
        response = api_client.put(
            f"{BASE_URL}/api/auth/password",
            json={"current_password": "wrongpassword", "new_password": "newpass123"},
            headers=headers
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "salah" in response.json().get("detail", "").lower()

    def test_password_change_too_short(self, api_client):
        """Password change fails if new password is too short"""
        token = get_token(api_client, "helpdesk")
        headers = {"Authorization": f"Bearer {token}"}
        
        response = api_client.put(
            f"{BASE_URL}/api/auth/password",
            json={"current_password": "helpdesk123", "new_password": "short"},
            headers=headers
        )
        assert response.status_code == 400
        assert "6" in response.json().get("detail", "").lower() or "minimal" in response.json().get("detail", "").lower()


class TestMonitoringAPIs:
    """Tests for monitoring endpoints"""

    def test_monitoring_status_am_access(self, api_client):
        """AM can access monitoring status"""
        token = get_token(api_client, "am")
        headers = {"Authorization": f"Bearer {token}"}
        
        response = api_client.get(f"{BASE_URL}/api/monitoring/status", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "points" in data
        assert "summary" in data
        assert "ping_interval_hours" in data
        
        summary = data["summary"]
        assert "total" in summary
        assert "online" in summary
        assert "offline" in summary

    def test_monitoring_status_helpdesk_access(self, api_client):
        """Helpdesk can access monitoring status"""
        token = get_token(api_client, "helpdesk")
        headers = {"Authorization": f"Bearer {token}"}
        
        response = api_client.get(f"{BASE_URL}/api/monitoring/status", headers=headers)
        assert response.status_code == 200

    def test_monitoring_status_eos_access(self, api_client):
        """EOS can access monitoring status"""
        token = get_token(api_client, "eos")
        headers = {"Authorization": f"Bearer {token}"}
        
        response = api_client.get(f"{BASE_URL}/api/monitoring/status", headers=headers)
        assert response.status_code == 200

    def test_monitoring_status_client_forbidden(self, api_client):
        """Client CANNOT access monitoring status - should get 403"""
        token = get_token(api_client, "client")
        headers = {"Authorization": f"Bearer {token}"}
        
        response = api_client.get(f"{BASE_URL}/api/monitoring/status", headers=headers)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"

    def test_monitoring_ping_trigger(self, api_client):
        """Admin/AM/Helpdesk/EOS can trigger ping check"""
        token = get_token(api_client, "am")
        headers = {"Authorization": f"Bearer {token}"}
        
        response = api_client.post(f"{BASE_URL}/api/monitoring/ping", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message" in data
        # Message should mention online/offline counts
        assert "online" in data["message"].lower() or "ping" in data["message"].lower()

    def test_monitoring_history(self, api_client):
        """Can retrieve ping history for a service point"""
        token = get_token(api_client, "am")
        headers = {"Authorization": f"Bearer {token}"}
        
        # First get a service point ID
        status_response = api_client.get(f"{BASE_URL}/api/monitoring/status", headers=headers)
        points = status_response.json().get("points", [])
        
        if not points:
            pytest.skip("No service points to test history")
        
        sp_id = points[0]["id"]
        
        response = api_client.get(
            f"{BASE_URL}/api/monitoring/history/{sp_id}",
            params={"hours": 24},
            headers=headers
        )
        assert response.status_code == 200
        assert "history" in response.json()

    def test_monitoring_interval_admin_only(self, api_client):
        """Only admin can change ping interval"""
        # AM should fail
        token = get_token(api_client, "am")
        headers = {"Authorization": f"Bearer {token}"}
        
        response = api_client.put(
            f"{BASE_URL}/api/monitoring/interval",
            params={"interval": 6},
            headers=headers
        )
        assert response.status_code == 403

        # Admin should succeed
        admin_token = get_token(api_client, "admin")
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = api_client.put(
            f"{BASE_URL}/api/monitoring/interval",
            params={"interval": 3},
            headers=admin_headers
        )
        assert response.status_code == 200


class TestSettingsAPI:
    """Tests for settings endpoints including site settings"""

    def test_site_settings_public(self, api_client):
        """Site settings (name/logo) are publicly accessible without auth"""
        response = api_client.get(f"{BASE_URL}/api/settings/site")
        assert response.status_code == 200
        
        data = response.json()
        assert "site_name" in data
        # site_logo may be empty string
        assert "site_logo" in data

    def test_settings_admin_only(self, api_client):
        """Only admin can access full settings"""
        # AM should fail
        am_token = get_token(api_client, "am")
        response = api_client.get(
            f"{BASE_URL}/api/settings",
            headers={"Authorization": f"Bearer {am_token}"}
        )
        assert response.status_code == 403

        # Admin should succeed
        admin_token = get_token(api_client, "admin")
        response = api_client.get(
            f"{BASE_URL}/api/settings",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        assert "settings" in response.json()

    def test_settings_update_site_name(self, api_client):
        """Admin can update site name"""
        admin_token = get_token(api_client, "admin")
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        test_name = "Test Site Name For Testing"
        response = api_client.post(
            f"{BASE_URL}/api/settings",
            json={"key": "site_name", "value": test_name},
            headers=headers
        )
        assert response.status_code == 200
        
        # Verify via public endpoint
        verify_response = api_client.get(f"{BASE_URL}/api/settings/site")
        assert verify_response.json().get("site_name") == test_name
        
        # Reset to original
        api_client.post(
            f"{BASE_URL}/api/settings",
            json={"key": "site_name", "value": "Sistem Tiketing & SLA Control Telkom Makassar"},
            headers=headers
        )


class TestLogbookPhase3Fix:
    """Tests for logbook phase navigation fix"""

    def test_eos_login(self, api_client):
        """EOS can login with updated password"""
        response = api_client.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "eos@telkom.co.id", "password": "eos123456"}
        )
        assert response.status_code == 200, f"EOS login failed: {response.text}"
        assert "token" in response.json()

    def test_get_assigned_tickets(self, api_client):
        """EOS can get their assigned tickets"""
        token = get_token(api_client, "eos")
        headers = {"Authorization": f"Bearer {token}"}
        
        response = api_client.get(f"{BASE_URL}/api/tickets", headers=headers)
        assert response.status_code == 200
        
        # Response structure check
        data = response.json()
        assert "tickets" in data


class TestAccessControl:
    """Tests for role-based access control"""

    def test_client_cannot_see_monitoring(self, api_client):
        """Client role cannot access monitoring endpoints"""
        token = get_token(api_client, "client")
        headers = {"Authorization": f"Bearer {token}"}
        
        # Monitoring status
        response = api_client.get(f"{BASE_URL}/api/monitoring/status", headers=headers)
        assert response.status_code == 403
        
        # Ping check
        response = api_client.post(f"{BASE_URL}/api/monitoring/ping", headers=headers)
        assert response.status_code == 403

    def test_client_can_access_allowed_endpoints(self, api_client):
        """Client can access their allowed endpoints"""
        token = get_token(api_client, "client")
        headers = {"Authorization": f"Bearer {token}"}
        
        # Dashboard stats
        response = api_client.get(f"{BASE_URL}/api/dashboard/stats", headers=headers)
        assert response.status_code == 200
        
        # Tickets
        response = api_client.get(f"{BASE_URL}/api/tickets", headers=headers)
        assert response.status_code == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
