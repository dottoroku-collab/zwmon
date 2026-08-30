import requests
import sys
import json
from datetime import datetime

class TelkomAPITester:
    def __init__(self, base_url="https://sla-control-hub.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        self.user_id = None
        self.ticket_id = None

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

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        
        # Default headers
        default_headers = {'Content-Type': 'application/json'}
        if self.token:
            default_headers['Authorization'] = f'Bearer {self.token}'
        
        if headers:
            default_headers.update(headers)

        try:
            if method == 'GET':
                response = requests.get(url, headers=default_headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=default_headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=default_headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=default_headers)

            success = response.status_code == expected_status
            response_data = response.json() if response.content else {}
            
            return self.log_test(name, success, response_data)

        except Exception as e:
            return self.log_test(name, False, error=str(e))

    def test_seed_data(self):
        """Test seeding initial data"""
        success = self.run_test("Seed Initial Data", "POST", "seed", 200)
        return success

    def test_login_admin(self):
        """Test admin login"""
        login_data = {
            "email": "admin@telkom.co.id",
            "password": "admin123"
        }
        
        url = f"{self.base_url}/auth/login"
        try:
            response = requests.post(url, json=login_data)
            success = response.status_code == 200
            
            if success:
                data = response.json()
                self.token = data.get('token')
                
            return self.log_test("Admin Login", success, response.json() if success else None)
        except Exception as e:
            return self.log_test("Admin Login", False, error=str(e))

    def test_login_roles(self):
        """Test login for all roles"""
        accounts = [
            {"email": "am@telkom.co.id", "password": "am123", "role": "AM"},
            {"email": "helpdesk@telkom.co.id", "password": "helpdesk123", "role": "Helpdesk"},
            {"email": "eos@telkom.co.id", "password": "eos123", "role": "EOS"},
            {"email": "client@kominfo.go.id", "password": "client123", "role": "Client"},
        ]
        
        all_success = True
        for account in accounts:
            url = f"{self.base_url}/auth/login"
            try:
                response = requests.post(url, json={"email": account["email"], "password": account["password"]})
                success = response.status_code == 200
                all_success = all_success and success
                self.log_test(f"{account['role']} Login", success, response.json() if success else None)
            except Exception as e:
                self.log_test(f"{account['role']} Login", False, error=str(e))
                all_success = False
                
        return all_success

    def test_user_management(self):
        """Test user management endpoints (admin only)"""
        if not self.token:
            return self.log_test("User Management - No Admin Token", False, error="Admin not logged in")
        
        # Get users
        get_success = self.run_test("Get Users List", "GET", "users", 200)
        
        # Create user
        new_user = {
            "username": f"test_user_{int(datetime.now().timestamp())}",
            "email": f"test{int(datetime.now().timestamp())}@test.com",
            "password": "testpass123",
            "role": "client",
            "full_name": "Test User",
            "phone": "08123456789"
        }
        
        create_success = self.run_test("Create User", "POST", "users", 200, new_user)
        
        return get_success and create_success

    def test_ticket_workflow(self):
        """Test basic ticket workflow"""
        if not self.token:
            return self.log_test("Ticket Workflow - No Token", False, error="Not logged in")
            
        # Create ticket
        ticket_data = {
            "title": "Test CCTV Issue",
            "description": "Test ticket for automation testing",
            "service_type": "cctv",
            "location": "Test Location",
            "priority": "medium"
        }
        
        url = f"{self.base_url}/tickets"
        try:
            response = requests.post(url, json=ticket_data, headers={'Authorization': f'Bearer {self.token}', 'Content-Type': 'application/json'})
            create_success = response.status_code == 200
            
            if create_success:
                response_data = response.json()
                self.ticket_id = response_data.get('ticket_id')
                
            self.log_test("Create Ticket", create_success, response.json() if create_success else None)
            
            # Get tickets
            get_success = self.run_test("Get Tickets", "GET", "tickets", 200)
            
            return create_success and get_success
            
        except Exception as e:
            return self.log_test("Create Ticket", False, error=str(e))

    def test_dashboard_stats(self):
        """Test dashboard stats endpoint"""
        return self.run_test("Dashboard Stats", "GET", "dashboard/stats", 200)

    def test_settings_access(self):
        """Test settings access (admin only)"""
        return self.run_test("Settings Access", "GET", "settings", 200)

    def test_reports_access(self):
        """Test reports access"""
        return self.run_test("Reports Access", "GET", "reports/tickets", 200)

def main():
    print("🚀 Starting Telkom Makassar API Tests...")
    print("=" * 50)
    
    tester = TelkomAPITester()
    
    # Test sequence
    print("\n📊 Testing API Endpoints:")
    print("-" * 30)
    
    # 1. Seed data
    tester.test_seed_data()
    
    # 2. Test admin login
    tester.test_login_admin()
    
    # 3. Test all role logins
    tester.test_login_roles()
    
    # 4. Test user management (admin)
    tester.test_user_management()
    
    # 5. Test ticket workflow
    tester.test_ticket_workflow()
    
    # 6. Test dashboard
    tester.test_dashboard_stats()
    
    # 7. Test settings
    tester.test_settings_access()
    
    # 8. Test reports
    tester.test_reports_access()
    
    # Print summary
    print("\n" + "=" * 50)
    print(f"📈 Test Results: {tester.tests_passed}/{tester.tests_run} passed")
    print(f"Success Rate: {(tester.tests_passed/tester.tests_run*100):.1f}%")
    
    # Save detailed results
    with open('/app/test_reports/backend_api_test_results.json', 'w') as f:
        json.dump({
            'summary': {
                'tests_run': tester.tests_run,
                'tests_passed': tester.tests_passed,
                'success_rate': (tester.tests_passed/tester.tests_run*100) if tester.tests_run > 0 else 0,
                'timestamp': datetime.now().isoformat()
            },
            'results': tester.test_results
        }, f, indent=2)
    
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())