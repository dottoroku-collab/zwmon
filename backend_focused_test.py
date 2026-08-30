import requests
import sys
import json
from datetime import datetime

class TelkomFocusedTester:
    def __init__(self, base_url="https://sla-control-hub.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.tokens = {}  # Store tokens for different roles
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        self.service_points = {}  # Store service points for testing

    def log_test(self, name, success, response_data=None, error=None):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
        
        result = {
            'test': name,
            'status': 'PASS' if success else 'FAIL',
            'timestamp': datetime.now().isoformat(),
            'response_data': response_data,
            'error': str(error) if error else None
        }
        self.test_results.append(result)
        
        status_icon = "✅" if success else "❌"
        print(f"{status_icon} {name}")
        if error:
            print(f"   Error: {error}")
        return success

    def run_request(self, method, endpoint, expected_status, data=None, role=None):
        """Run HTTP request with proper authentication"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if role and role in self.tokens:
            headers['Authorization'] = f'Bearer {self.tokens[role]}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            response_data = response.json() if response.content else {}
            
            return success, response_data

        except Exception as e:
            return False, str(e)

    def test_login_all_roles(self):
        """Test login for all 5 required roles"""
        print("\n🔑 Testing Login for All Roles:")
        
        credentials = [
            {"email": "admin@telkom.co.id", "password": "admin123", "role": "admin"},
            {"email": "am@telkom.co.id", "password": "am123", "role": "am"},
            {"email": "helpdesk@telkom.co.id", "password": "helpdesk123", "role": "helpdesk"},
            {"email": "eos@telkom.co.id", "password": "eos123", "role": "eos"},
            {"email": "warroom@kominfo.go.id", "password": "warroom123", "role": "client"},
        ]
        
        all_success = True
        for cred in credentials:
            success, response_data = self.run_request('POST', 'auth/login', 200, {
                "email": cred["email"], 
                "password": cred["password"]
            })
            
            if success and 'token' in response_data:
                self.tokens[cred["role"]] = response_data['token']
                self.log_test(f"Login - {cred['role'].upper()}", True, response_data)
            else:
                self.log_test(f"Login - {cred['role'].upper()}", False, error=response_data)
                all_success = False
        
        return all_success

    def test_admin_user_management(self):
        """Test Admin user management functionality"""
        print("\n👥 Testing Admin User Management:")
        
        if 'admin' not in self.tokens:
            return self.log_test("Admin User Management - No Token", False, error="Admin not logged in")
        
        # Test view users
        success, response_data = self.run_request('GET', 'users', 200, role='admin')
        view_success = self.log_test("Admin - View Users", success, response_data)
        
        # Test add user
        new_user = {
            "username": f"test_user_{int(datetime.now().timestamp())}",
            "email": f"test{int(datetime.now().timestamp())}@telkom.test",
            "password": "testpass123",
            "role": "eos",
            "full_name": "Test EOS User",
            "phone": "08123456789"
        }
        
        success, response_data = self.run_request('POST', 'users', 200, new_user, role='admin')
        add_success = self.log_test("Admin - Add User", success, response_data)
        
        return view_success and add_success

    def test_service_points_crud(self):
        """Test Admin Master Data Titik Layanan CRUD"""
        print("\n📍 Testing Service Points CRUD:")
        
        if 'admin' not in self.tokens:
            return self.log_test("Service Points CRUD - No Token", False, error="Admin not logged in")
        
        # Test view service points
        success, response_data = self.run_request('GET', 'service-points', 200, role='admin')
        view_success = self.log_test("Admin - View Service Points", success, response_data)
        
        # Test add service point for each type
        service_types = [
            {
                "name": f"Test CCTV {datetime.now().strftime('%H%M%S')}",
                "location": "Test Location CCTV",
                "address": "Jl. Test CCTV No. 1",
                "service_type": "cctv",
                "bandwidth": 10,
                "ip_address": "10.10.1.100"
            },
            {
                "name": f"Test SKPD {datetime.now().strftime('%H%M%S')}",
                "location": "Test Location SKPD", 
                "address": "Jl. Test SKPD No. 2",
                "service_type": "skpd",
                "bandwidth": 100,
                "ip_address": "10.20.1.100"
            },
            {
                "name": f"Test IP Speaker {datetime.now().strftime('%H%M%S')}",
                "location": "Test Location IP Speaker",
                "address": "Jl. Test IP Speaker No. 3", 
                "service_type": "ip_speaker",
                "bandwidth": 5,
                "ip_address": "10.30.1.100"
            }
        ]
        
        add_success = True
        for service_point in service_types:
            success, response_data = self.run_request('POST', 'service-points', 200, service_point, role='admin')
            if success:
                self.service_points[service_point['service_type']] = response_data.get('point_id')
            add_success = add_success and self.log_test(f"Admin - Add {service_point['service_type'].upper()} Point", success, response_data)
        
        return view_success and add_success

    def test_restitution_calculator(self):
        """Test AM Restitution Calculator"""
        print("\n🧮 Testing Restitution Calculator:")
        
        if 'am' not in self.tokens:
            return self.log_test("Restitution Calculator - No Token", False, error="AM not logged in")
        
        # Test calculation for each service type
        calculations = [
            {
                "service_type": "cctv",
                "bandwidth_affected": 50.0,
                "downtime_minutes": 300,  # 5 hours
                "month": 12,
                "year": 2024
            },
            {
                "service_type": "skpd", 
                "bandwidth_affected": 100.0,
                "downtime_minutes": 180,  # 3 hours
                "month": 12,
                "year": 2024
            },
            {
                "service_type": "ip_speaker",
                "bandwidth_affected": 25.0,
                "downtime_minutes": 600,  # 10 hours
                "month": 12, 
                "year": 2024
            }
        ]
        
        all_success = True
        for calc in calculations:
            success, response_data = self.run_request('POST', 'restitution/calculate', 200, calc, role='am')
            all_success = all_success and self.log_test(f"Calculate Restitution - {calc['service_type'].upper()}", success, response_data)
        
        return all_success

    def test_helpdesk_operations(self):
        """Test Helpdesk operations - view and assign tickets"""
        print("\n🎧 Testing Helpdesk Operations:")
        
        if 'helpdesk' not in self.tokens:
            return self.log_test("Helpdesk Operations - No Token", False, error="Helpdesk not logged in")
        
        # Test view tickets
        success, response_data = self.run_request('GET', 'tickets', 200, role='helpdesk')
        view_success = self.log_test("Helpdesk - View Tickets", success, response_data)
        
        # Test get EOS users for assignment
        success, response_data = self.run_request('GET', 'users/eos', 200, role='helpdesk')
        eos_success = self.log_test("Helpdesk - Get EOS Users", success, response_data)
        
        return view_success and eos_success

    def test_client_create_ticket(self):
        """Test Client ticket creation with service point selection"""
        print("\n🎫 Testing Client Ticket Creation:")
        
        if 'client' not in self.tokens:
            return self.log_test("Client Ticket Creation - No Token", False, error="Client not logged in")
        
        # First get service points to select from
        success, response_data = self.run_request('GET', 'service-points', 200, role='client')
        if not success:
            return self.log_test("Client - Get Service Points for Selection", False, error="Cannot get service points")
        
        # Test create ticket with different service types and indications
        test_tickets = [
            {
                "title": "Test CCTV RTO Issue",
                "description": "CCTV showing RTO when pinged from War Room", 
                "service_type": "cctv",
                "location": "Test Location CCTV",
                "priority": "high",
                "initial_indication": "RTO"
            },
            {
                "title": "Test SKPD Internet Lambat",
                "description": "Internet SKPD very slow, speedtest only 10 Mbps",
                "service_type": "skpd", 
                "location": "Test Location SKPD",
                "priority": "medium",
                "initial_indication": "Internet Lambat"
            }
        ]
        
        all_success = True
        for ticket in test_tickets:
            success, response_data = self.run_request('POST', 'tickets', 200, ticket, role='client')
            all_success = all_success and self.log_test(f"Client - Create {ticket['service_type'].upper()} Ticket", success, response_data)
        
        return all_success

    def test_eos_logbook_access(self):
        """Test EOS access to logbook functionality"""
        print("\n📋 Testing EOS Logbook Access:")
        
        if 'eos' not in self.tokens:
            return self.log_test("EOS Logbook Access - No Token", False, error="EOS not logged in")
        
        # Test get tickets assigned to EOS
        success, response_data = self.run_request('GET', 'tickets', 200, role='eos')
        tickets_success = self.log_test("EOS - View Assigned Tickets", success, response_data)
        
        # Test dashboard stats to see workload
        success, response_data = self.run_request('GET', 'dashboard/stats', 200, role='eos')
        stats_success = self.log_test("EOS - Dashboard Stats", success, response_data)
        
        return tickets_success and stats_success

    def test_admin_access_verification(self):
        """Test Admin can access all admin features"""
        print("\n🔧 Testing Admin Access Verification:")
        
        if 'admin' not in self.tokens:
            return self.log_test("Admin Access - No Token", False, error="Admin not logged in")
        
        # Test settings access
        success, response_data = self.run_request('GET', 'settings', 200, role='admin')
        settings_success = self.log_test("Admin - Settings Access", success, response_data)
        
        # Test reports access
        success, response_data = self.run_request('GET', 'reports/tickets', 200, role='admin')
        reports_success = self.log_test("Admin - Reports Access", success, response_data)
        
        # Test dashboard stats
        success, response_data = self.run_request('GET', 'dashboard/stats', 200, role='admin')
        dashboard_success = self.log_test("Admin - Dashboard Access", success, response_data)
        
        return settings_success and reports_success and dashboard_success

def main():
    print("🚀 Starting Telkom Makassar Focused API Tests...")
    print("Testing specific features from review request:")
    print("- Login for all 5 roles")
    print("- Admin User Management")
    print("- Master Data Service Points CRUD") 
    print("- AM Restitution Calculator")
    print("- Helpdesk ticket operations")
    print("- Client ticket creation")
    print("- EOS logbook access")
    print("=" * 60)
    
    tester = TelkomFocusedTester()
    
    # Seed data first
    print("\n🌱 Seeding Initial Data:")
    success, response_data = tester.run_request('POST', 'seed', 200)
    tester.log_test("Seed Initial Data", success, response_data)
    
    # Run focused tests
    tester.test_login_all_roles()
    tester.test_admin_user_management()  
    tester.test_service_points_crud()
    tester.test_restitution_calculator()
    tester.test_helpdesk_operations()
    tester.test_client_create_ticket()
    tester.test_eos_logbook_access()
    tester.test_admin_access_verification()
    
    # Print summary
    print("\n" + "=" * 60)
    print(f"📈 Test Results: {tester.tests_passed}/{tester.tests_run} passed")
    success_rate = (tester.tests_passed/tester.tests_run*100) if tester.tests_run > 0 else 0
    print(f"Success Rate: {success_rate:.1f}%")
    
    # Save results
    with open('/app/test_reports/focused_backend_results.json', 'w') as f:
        json.dump({
            'summary': {
                'tests_run': tester.tests_run,
                'tests_passed': tester.tests_passed,
                'success_rate': success_rate,
                'timestamp': datetime.now().isoformat()
            },
            'results': tester.test_results
        }, f, indent=2)
    
    return 0 if success_rate >= 90 else 1

if __name__ == "__main__":
    sys.exit(main())