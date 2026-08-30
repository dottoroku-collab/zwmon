"""
Phase 3 Tests: Restitution Report Page, AM Daily Restitution Dashboard, Monthly PDF Report
Tests cover:
- GET /api/reports/restitution
- GET /api/reports/restitution/daily
- GET /api/reports/monthly-pdf
- Access control (Client/Helpdesk should get 403)
- AM Dashboard daily_restitution stat
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://sla-control-hub.preview.emergentagent.com').rstrip('/')


class TestPhase3RestitutionAPIs:
    """Tests for Phase 3 Restitution Report APIs"""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup tokens for all roles"""
        self.tokens = {}
        roles = {
            'am': {'email': 'am@telkom.co.id', 'password': 'am123'},
            'admin': {'email': 'admin@telkom.co.id', 'password': 'admin123'},
            'helpdesk': {'email': 'helpdesk@telkom.co.id', 'password': 'helpdesk123'},
            'client': {'email': 'warroom@kominfo.go.id', 'password': 'warroom123'}
        }
        for role, creds in roles.items():
            res = requests.post(f"{BASE_URL}/api/auth/login", json=creds)
            if res.status_code == 200:
                self.tokens[role] = res.json()['token']
        yield

    # ========== Restitution Report API ==========
    def test_restitution_report_am_access(self):
        """AM should be able to access restitution report"""
        res = requests.get(
            f"{BASE_URL}/api/reports/restitution",
            params={'month': 2, 'year': 2026},
            headers={'Authorization': f"Bearer {self.tokens['am']}"}
        )
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        
        # Verify response structure
        assert 'items' in data, "Response should have 'items' array"
        assert 'summary' in data, "Response should have 'summary' object"
        assert isinstance(data['items'], list), "items should be a list"
        
        # Verify summary structure
        summary = data['summary']
        assert 'total_tickets' in summary, "Summary should have total_tickets"
        assert 'total_downtime_minutes' in summary, "Summary should have total_downtime_minutes"
        assert 'total_restitution' in summary, "Summary should have total_restitution"
        print(f"✅ Restitution Report: {summary['total_tickets']} tickets, {summary['total_restitution']} Rp restitution")

    def test_restitution_report_admin_access(self):
        """Admin should also be able to access restitution report"""
        res = requests.get(
            f"{BASE_URL}/api/reports/restitution",
            params={'month': 2, 'year': 2026},
            headers={'Authorization': f"Bearer {self.tokens['admin']}"}
        )
        assert res.status_code == 200, f"Expected 200, got {res.status_code}"

    def test_restitution_report_client_forbidden(self):
        """Client should NOT be able to access restitution report (403)"""
        res = requests.get(
            f"{BASE_URL}/api/reports/restitution",
            params={'month': 2, 'year': 2026},
            headers={'Authorization': f"Bearer {self.tokens['client']}"}
        )
        assert res.status_code == 403, f"Expected 403 for client, got {res.status_code}"
        print("✅ Client correctly blocked from restitution report")

    def test_restitution_report_helpdesk_forbidden(self):
        """Helpdesk should NOT be able to access restitution report (403)"""
        res = requests.get(
            f"{BASE_URL}/api/reports/restitution",
            params={'month': 2, 'year': 2026},
            headers={'Authorization': f"Bearer {self.tokens['helpdesk']}"}
        )
        assert res.status_code == 403, f"Expected 403 for helpdesk, got {res.status_code}"
        print("✅ Helpdesk correctly blocked from restitution report")

    def test_restitution_report_with_service_filter(self):
        """Test restitution report with service_type filter"""
        res = requests.get(
            f"{BASE_URL}/api/reports/restitution",
            params={'month': 2, 'year': 2026, 'service_type': 'cctv'},
            headers={'Authorization': f"Bearer {self.tokens['am']}"}
        )
        assert res.status_code == 200
        data = res.json()
        # If items returned, they should all be cctv
        for item in data['items']:
            assert item['service_type'] == 'cctv', f"Expected cctv, got {item['service_type']}"
        print(f"✅ Service filter works: {len(data['items'])} cctv tickets")

    # ========== Daily Restitution API ==========
    def test_daily_restitution_am_access(self):
        """AM should be able to access daily restitution report"""
        res = requests.get(
            f"{BASE_URL}/api/reports/restitution/daily",
            params={'days': 30},
            headers={'Authorization': f"Bearer {self.tokens['am']}"}
        )
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        
        assert 'daily_restitution' in data, "Response should have 'daily_restitution' array"
        assert isinstance(data['daily_restitution'], list), "daily_restitution should be a list"
        print(f"✅ Daily Restitution: {len(data['daily_restitution'])} days of data")
        
        # Check structure of daily items if present
        if data['daily_restitution']:
            item = data['daily_restitution'][0]
            assert 'date' in item, "Daily item should have 'date'"
            assert 'ticket_count' in item, "Daily item should have 'ticket_count'"
            assert 'estimated_restitution' in item, "Daily item should have 'estimated_restitution'"

    def test_daily_restitution_client_forbidden(self):
        """Client should NOT be able to access daily restitution (403)"""
        res = requests.get(
            f"{BASE_URL}/api/reports/restitution/daily",
            params={'days': 30},
            headers={'Authorization': f"Bearer {self.tokens['client']}"}
        )
        assert res.status_code == 403, f"Expected 403 for client, got {res.status_code}"
        print("✅ Client correctly blocked from daily restitution")

    # ========== Monthly PDF API ==========
    def test_monthly_pdf_am_access(self):
        """AM should be able to download monthly PDF report"""
        res = requests.get(
            f"{BASE_URL}/api/reports/monthly-pdf",
            params={'month': 2, 'year': 2026},
            headers={'Authorization': f"Bearer {self.tokens['am']}"}
        )
        assert res.status_code == 200, f"Expected 200, got {res.status_code}"
        
        # Verify response is a PDF (starts with %PDF)
        assert res.content.startswith(b'%PDF'), "Response should be a valid PDF file"
        
        # Check Content-Type header
        content_type = res.headers.get('content-type', '')
        assert 'application/pdf' in content_type, f"Expected application/pdf, got {content_type}"
        print(f"✅ PDF Generated: {len(res.content)} bytes")

    def test_monthly_pdf_admin_access(self):
        """Admin should also be able to download monthly PDF"""
        res = requests.get(
            f"{BASE_URL}/api/reports/monthly-pdf",
            params={'month': 2, 'year': 2026},
            headers={'Authorization': f"Bearer {self.tokens['admin']}"}
        )
        assert res.status_code == 200, f"Expected 200, got {res.status_code}"
        assert res.content.startswith(b'%PDF'), "Response should be a valid PDF"

    def test_monthly_pdf_helpdesk_forbidden(self):
        """Helpdesk should NOT be able to download monthly PDF (403)"""
        res = requests.get(
            f"{BASE_URL}/api/reports/monthly-pdf",
            params={'month': 2, 'year': 2026},
            headers={'Authorization': f"Bearer {self.tokens['helpdesk']}"}
        )
        assert res.status_code == 403, f"Expected 403 for helpdesk, got {res.status_code}"
        print("✅ Helpdesk correctly blocked from monthly PDF")

    def test_monthly_pdf_client_forbidden(self):
        """Client should NOT be able to download monthly PDF (403)"""
        res = requests.get(
            f"{BASE_URL}/api/reports/monthly-pdf",
            params={'month': 2, 'year': 2026},
            headers={'Authorization': f"Bearer {self.tokens['client']}"}
        )
        assert res.status_code == 403, f"Expected 403 for client, got {res.status_code}"
        print("✅ Client correctly blocked from monthly PDF")

    def test_monthly_pdf_with_service_filter(self):
        """Test monthly PDF with service_type filter"""
        res = requests.get(
            f"{BASE_URL}/api/reports/monthly-pdf",
            params={'month': 2, 'year': 2026, 'service_type': 'cctv'},
            headers={'Authorization': f"Bearer {self.tokens['am']}"}
        )
        assert res.status_code == 200
        assert res.content.startswith(b'%PDF')
        print("✅ PDF with service filter generated successfully")

    # ========== AM Dashboard Stats ==========
    def test_am_dashboard_daily_restitution_stat(self):
        """AM dashboard should include daily_restitution stat"""
        res = requests.get(
            f"{BASE_URL}/api/dashboard/stats",
            headers={'Authorization': f"Bearer {self.tokens['am']}"}
        )
        assert res.status_code == 200, f"Expected 200, got {res.status_code}"
        data = res.json()
        
        # Verify daily_restitution is present
        assert 'daily_restitution' in data, "AM dashboard should have 'daily_restitution' stat"
        assert isinstance(data['daily_restitution'], (int, float)), "daily_restitution should be a number"
        print(f"✅ AM Dashboard daily_restitution: Rp {data['daily_restitution']:,.0f}")

    def test_am_dashboard_includes_all_required_stats(self):
        """AM dashboard should include all required Phase 3 stats"""
        res = requests.get(
            f"{BASE_URL}/api/dashboard/stats",
            headers={'Authorization': f"Bearer {self.tokens['am']}"}
        )
        assert res.status_code == 200
        data = res.json()
        
        required_stats = ['pending_verification', 'verified_today', 'total_closed', 
                         'scenario_a_count', 'scenario_b_count', 'daily_restitution']
        for stat in required_stats:
            assert stat in data, f"AM dashboard missing '{stat}'"
        print(f"✅ AM Dashboard has all required stats: {list(data.keys())[:6]}")


class TestRestitutionItemStructure:
    """Tests to verify restitution report item structure"""

    @pytest.fixture(autouse=True)
    def setup(self):
        res = requests.post(f"{BASE_URL}/api/auth/login", json={
            'email': 'am@telkom.co.id', 'password': 'am123'
        })
        self.token = res.json()['token']
        yield

    def test_restitution_item_has_all_fields(self):
        """Verify each restitution item has all required fields"""
        res = requests.get(
            f"{BASE_URL}/api/reports/restitution",
            params={'month': 2, 'year': 2026},
            headers={'Authorization': f"Bearer {self.token}"}
        )
        assert res.status_code == 200
        data = res.json()
        
        if data['items']:
            item = data['items'][0]
            required_fields = [
                'ticket_id', 'title', 'service_type', 'service_point_name',
                'location', 'ip_address', 'bandwidth', 'downtime_minutes',
                'downtime_days', 'closed_at', 'sla_met', 'uptime_percentage',
                'restitution_amount'
            ]
            for field in required_fields:
                assert field in item, f"Restitution item missing '{field}'"
            print(f"✅ Restitution item has all {len(required_fields)} required fields")
        else:
            print("⚠️ No restitution items to verify (empty report)")


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
