"""
Backend Tests for Phase 1 & Phase 2 Features
- Phase 1: AM Verification Workflow (verify, reject, status history)
- Phase 2: Profile Update, Chat System

Test credentials:
- admin: admin@telkom.co.id / admin123
- am: am@telkom.co.id / am123
- helpdesk: helpdesk@telkom.co.id / helpdesk123
- eos: eos@telkom.co.id / eos123
- client: warroom@kominfo.go.id / warroom123
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://sla-control-hub.preview.emergentagent.com')

# Test Credentials
CREDENTIALS = {
    'admin': {'email': 'admin@telkom.co.id', 'password': 'admin123'},
    'am': {'email': 'am@telkom.co.id', 'password': 'am123'},
    'helpdesk': {'email': 'helpdesk@telkom.co.id', 'password': 'helpdesk123'},
    'eos': {'email': 'eos@telkom.co.id', 'password': 'eos123'},
    'client': {'email': 'warroom@kominfo.go.id', 'password': 'warroom123'}
}

class TestSetup:
    """Ensure seed data exists"""
    
    def test_seed_data(self):
        """Seed the database with test users"""
        response = requests.post(f"{BASE_URL}/api/seed")
        assert response.status_code == 200
        print("Seed data initialized")


class TestAuthentication:
    """Test all role logins"""
    
    @pytest.mark.parametrize("role", ['admin', 'am', 'helpdesk', 'eos', 'client'])
    def test_login_all_roles(self, role):
        """Test login for all roles"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login", 
            json=CREDENTIALS[role]
        )
        assert response.status_code == 200, f"Login failed for {role}: {response.text}"
        data = response.json()
        assert 'token' in data
        assert data['user']['role'] == role
        print(f"SUCCESS: {role} login works")


class TestPhase1TicketWorkflow:
    """Phase 1: Full ticket workflow with AM verification"""
    
    @pytest.fixture
    def client_token(self):
        """Get client auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=CREDENTIALS['client'])
        return response.json()['token']
    
    @pytest.fixture
    def helpdesk_token(self):
        """Get helpdesk auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=CREDENTIALS['helpdesk'])
        return response.json()['token']
    
    @pytest.fixture
    def eos_token(self):
        """Get EOS auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=CREDENTIALS['eos'])
        return response.json()['token']
    
    @pytest.fixture
    def am_token(self):
        """Get AM auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=CREDENTIALS['am'])
        return response.json()['token']
    
    @pytest.fixture
    def eos_user_id(self, helpdesk_token):
        """Get EOS user id for assignment"""
        response = requests.get(
            f"{BASE_URL}/api/users/eos",
            headers={"Authorization": f"Bearer {helpdesk_token}"}
        )
        assert response.status_code == 200
        users = response.json()['users']
        assert len(users) > 0, "No EOS users found"
        return users[0]['id']
    
    def test_full_workflow_verify(self, client_token, helpdesk_token, eos_token, am_token, eos_user_id):
        """Test complete workflow: Create -> Assign -> Logbook (all phases) -> AM Verify"""
        
        # Step 1: Client creates ticket
        ticket_data = {
            "title": "TEST_Workflow_Verify_CCTV Offline",
            "description": "Testing full workflow with AM verification",
            "service_type": "cctv",
            "location": "Test Location",
            "priority": "high",
            "initial_indication": "RTO"
        }
        create_response = requests.post(
            f"{BASE_URL}/api/tickets",
            json=ticket_data,
            headers={"Authorization": f"Bearer {client_token}"}
        )
        assert create_response.status_code == 200, f"Failed to create ticket: {create_response.text}"
        ticket_id = create_response.json()['ticket_id']
        print(f"Step 1 PASSED: Ticket created - {ticket_id}")
        
        # Verify initial status is 'open'
        ticket_response = requests.get(
            f"{BASE_URL}/api/tickets/{ticket_id}",
            headers={"Authorization": f"Bearer {client_token}"}
        )
        assert ticket_response.json()['ticket']['status'] == 'open'
        
        # Step 2: Helpdesk assigns to EOS
        assign_response = requests.post(
            f"{BASE_URL}/api/tickets/{ticket_id}/assign?eos_user_id={eos_user_id}",
            headers={"Authorization": f"Bearer {helpdesk_token}"}
        )
        assert assign_response.status_code == 200, f"Failed to assign: {assign_response.text}"
        print("Step 2 PASSED: Ticket assigned to EOS")
        
        # Verify status changed to 'assigned'
        ticket_response = requests.get(
            f"{BASE_URL}/api/tickets/{ticket_id}",
            headers={"Authorization": f"Bearer {eos_token}"}
        )
        assert ticket_response.json()['ticket']['status'] == 'assigned'
        
        # Step 3: EOS fills logbook Phase 2
        logbook_phase2 = {
            "ticket_id": ticket_id,
            "phase2": {
                "arrival_time": "2026-01-27T10:00:00",
                "electricity_check": "Normal",
                "modem_indicator": "LOS Merah / Mati"
            }
        }
        lb2_response = requests.post(
            f"{BASE_URL}/api/logbook",
            json=logbook_phase2,
            headers={"Authorization": f"Bearer {eos_token}"}
        )
        assert lb2_response.status_code == 200, f"Failed logbook phase2: {lb2_response.text}"
        print("Step 3 PASSED: Logbook Phase 2 saved")
        
        # Verify status changed to 'in_progress'
        ticket_response = requests.get(
            f"{BASE_URL}/api/tickets/{ticket_id}",
            headers={"Authorization": f"Bearer {eos_token}"}
        )
        assert ticket_response.json()['ticket']['status'] == 'in_progress'
        
        # Step 4: EOS fills logbook Phase 3
        logbook_phase3 = {
            "ticket_id": ticket_id,
            "phase2": logbook_phase2["phase2"],
            "phase3": {
                "scenario": "A",
                "scenario_detail": "Modem ONT LOS merah - gangguan jaringan Telkom"
            }
        }
        lb3_response = requests.post(
            f"{BASE_URL}/api/logbook",
            json=logbook_phase3,
            headers={"Authorization": f"Bearer {eos_token}"}
        )
        assert lb3_response.status_code == 200
        print("Step 4 PASSED: Logbook Phase 3 saved")
        
        # Step 5: EOS fills logbook Phase 4
        logbook_phase4 = {
            "ticket_id": ticket_id,
            "phase2": logbook_phase2["phase2"],
            "phase3": logbook_phase3["phase3"],
            "phase4": {
                "action_taken": "Restart modem, reconfigure settings",
                "category": "Kategori 1"
            }
        }
        lb4_response = requests.post(
            f"{BASE_URL}/api/logbook",
            json=logbook_phase4,
            headers={"Authorization": f"Bearer {eos_token}"}
        )
        assert lb4_response.status_code == 200
        print("Step 5 PASSED: Logbook Phase 4 saved")
        
        # Step 6: EOS completes logbook Phase 5
        logbook_phase5 = {
            "ticket_id": ticket_id,
            "phase2": logbook_phase2["phase2"],
            "phase3": logbook_phase3["phase3"],
            "phase4": logbook_phase4["phase4"],
            "phase5": {
                "completion_time": "2026-01-27T14:00:00",
                "final_status": "normal_user",
                "response_time_minutes": 120,
                "recovery_time_minutes": 180,
                "total_downtime_minutes": 300,
                "notes": "Fixed successfully"
            }
        }
        lb5_response = requests.post(
            f"{BASE_URL}/api/logbook",
            json=logbook_phase5,
            headers={"Authorization": f"Bearer {eos_token}"}
        )
        assert lb5_response.status_code == 200
        print("Step 6 PASSED: Logbook Phase 5 saved")
        
        # Verify status changed to 'pending_verification'
        ticket_response = requests.get(
            f"{BASE_URL}/api/tickets/{ticket_id}",
            headers={"Authorization": f"Bearer {am_token}"}
        )
        ticket = ticket_response.json()['ticket']
        assert ticket['status'] == 'pending_verification', f"Expected 'pending_verification', got '{ticket['status']}'"
        print("Step 6 VERIFIED: Status is 'pending_verification'")
        
        # Step 7: AM verifies and closes ticket
        verify_response = requests.post(
            f"{BASE_URL}/api/tickets/{ticket_id}/verify",
            json={"comment": "Good job team! Verified and closed."},
            headers={"Authorization": f"Bearer {am_token}"}
        )
        assert verify_response.status_code == 200, f"Failed to verify: {verify_response.text}"
        print("Step 7 PASSED: AM verified ticket")
        
        # Verify final status is 'closed'
        ticket_response = requests.get(
            f"{BASE_URL}/api/tickets/{ticket_id}",
            headers={"Authorization": f"Bearer {am_token}"}
        )
        ticket = ticket_response.json()['ticket']
        assert ticket['status'] == 'closed', f"Expected 'closed', got '{ticket['status']}'"
        assert ticket['am_verified'] == True
        assert ticket['am_comment'] == "Good job team! Verified and closed."
        print("FULL WORKFLOW TEST PASSED: Ticket verified and closed")
    
    def test_am_reject_workflow(self, client_token, helpdesk_token, eos_token, am_token, eos_user_id):
        """Test AM rejection workflow"""
        
        # Create and process ticket to pending_verification
        ticket_data = {
            "title": "TEST_Workflow_Reject_SKPD Issue",
            "description": "Testing AM reject workflow",
            "service_type": "skpd",
            "location": "Test Location Reject",
            "priority": "medium",
            "initial_indication": "Internet Lambat"
        }
        create_response = requests.post(
            f"{BASE_URL}/api/tickets",
            json=ticket_data,
            headers={"Authorization": f"Bearer {client_token}"}
        )
        ticket_id = create_response.json()['ticket_id']
        
        # Assign
        requests.post(
            f"{BASE_URL}/api/tickets/{ticket_id}/assign?eos_user_id={eos_user_id}",
            headers={"Authorization": f"Bearer {helpdesk_token}"}
        )
        
        # Complete all logbook phases
        full_logbook = {
            "ticket_id": ticket_id,
            "phase2": {
                "arrival_time": "2026-01-27T09:00:00",
                "bypass_download": 50.5,
                "bypass_upload": 25.0,
                "bypass_ping": 10.0
            },
            "phase3": {
                "scenario": "A",
                "scenario_detail": "Bypass test shows degraded performance"
            },
            "phase4": {
                "action_taken": "Reconfigured router"
            },
            "phase5": {
                "completion_time": "2026-01-27T12:00:00",
                "final_status": "normal_user",
                "total_downtime_minutes": 180
            }
        }
        requests.post(
            f"{BASE_URL}/api/logbook",
            json=full_logbook,
            headers={"Authorization": f"Bearer {eos_token}"}
        )
        
        # Verify it's pending_verification
        ticket_response = requests.get(
            f"{BASE_URL}/api/tickets/{ticket_id}",
            headers={"Authorization": f"Bearer {am_token}"}
        )
        assert ticket_response.json()['ticket']['status'] == 'pending_verification'
        
        # AM Rejects the ticket
        reject_response = requests.post(
            f"{BASE_URL}/api/tickets/{ticket_id}/reject",
            json={"comment": "Incomplete documentation, please add more photos"},
            headers={"Authorization": f"Bearer {am_token}"}
        )
        assert reject_response.status_code == 200, f"Failed to reject: {reject_response.text}"
        
        # Verify ticket is back to 'in_progress'
        ticket_response = requests.get(
            f"{BASE_URL}/api/tickets/{ticket_id}",
            headers={"Authorization": f"Bearer {eos_token}"}
        )
        ticket = ticket_response.json()['ticket']
        assert ticket['status'] == 'in_progress', f"Expected 'in_progress', got '{ticket['status']}'"
        assert ticket['am_rejected'] == True
        assert ticket['am_reject_comment'] == "Incomplete documentation, please add more photos"
        print("AM REJECT TEST PASSED: Ticket returned to in_progress")
    
    def test_status_history_tracking(self, client_token, helpdesk_token, eos_token, am_token, eos_user_id):
        """Test status history is tracked correctly"""
        
        # Create ticket
        ticket_data = {
            "title": "TEST_Status_History_Tracking",
            "description": "Testing status history",
            "service_type": "cctv",
            "location": "Test Location History",
            "priority": "low",
            "initial_indication": "Gambar Blank/Hitam"
        }
        create_response = requests.post(
            f"{BASE_URL}/api/tickets",
            json=ticket_data,
            headers={"Authorization": f"Bearer {client_token}"}
        )
        ticket_id = create_response.json()['ticket_id']
        
        # Assign
        requests.post(
            f"{BASE_URL}/api/tickets/{ticket_id}/assign?eos_user_id={eos_user_id}",
            headers={"Authorization": f"Bearer {helpdesk_token}"}
        )
        
        # Complete logbook
        full_logbook = {
            "ticket_id": ticket_id,
            "phase2": {"arrival_time": "2026-01-27T08:00:00", "electricity_check": "Normal", "modem_indicator": "Normal (PON Nyala)"},
            "phase3": {"scenario": "B", "scenario_detail": "Camera issue"},
            "phase4": {"action_taken": "Restarted camera"},
            "phase5": {"completion_time": "2026-01-27T09:00:00", "final_status": "normal_user", "total_downtime_minutes": 0}
        }
        requests.post(
            f"{BASE_URL}/api/logbook",
            json=full_logbook,
            headers={"Authorization": f"Bearer {eos_token}"}
        )
        
        # AM verifies
        requests.post(
            f"{BASE_URL}/api/tickets/{ticket_id}/verify",
            json={"comment": "Well done!"},
            headers={"Authorization": f"Bearer {am_token}"}
        )
        
        # Check status history
        ticket_response = requests.get(
            f"{BASE_URL}/api/tickets/{ticket_id}",
            headers={"Authorization": f"Bearer {am_token}"}
        )
        ticket = ticket_response.json()['ticket']
        status_history = ticket.get('status_history', [])
        
        # Should have multiple status transitions
        assert len(status_history) >= 2, f"Expected at least 2 status history entries, got {len(status_history)}"
        
        # Check the last entry (verify -> closed)
        last_entry = status_history[-1]
        assert last_entry['to_status'] == 'closed'
        assert last_entry['role'] == 'am'
        assert 'Well done!' in last_entry.get('comment', '')
        
        print(f"STATUS HISTORY TEST PASSED: Found {len(status_history)} history entries")


class TestPhase2Profile:
    """Phase 2: Profile update tests"""
    
    @pytest.fixture
    def client_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=CREDENTIALS['client'])
        return response.json()['token']
    
    def test_get_profile(self, client_token):
        """Test getting current user profile"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {client_token}"}
        )
        assert response.status_code == 200
        user = response.json()
        assert 'email' in user
        assert 'role' in user
        assert user['email'] == CREDENTIALS['client']['email']
        print("GET PROFILE TEST PASSED")
    
    def test_update_profile(self, client_token):
        """Test updating profile name and phone"""
        new_name = f"Test Client {int(time.time())}"
        new_phone = "081234567999"
        
        response = requests.put(
            f"{BASE_URL}/api/auth/profile",
            json={"full_name": new_name, "phone": new_phone},
            headers={"Authorization": f"Bearer {client_token}"}
        )
        assert response.status_code == 200, f"Failed to update profile: {response.text}"
        
        # Verify changes persisted
        get_response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {client_token}"}
        )
        user = get_response.json()
        assert user['full_name'] == new_name
        assert user['phone'] == new_phone
        print("UPDATE PROFILE TEST PASSED")


class TestPhase2Chat:
    """Phase 2: Chat system tests"""
    
    @pytest.fixture
    def am_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=CREDENTIALS['am'])
        return response.json()['token'], response.json()['user']['id']
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=CREDENTIALS['admin'])
        return response.json()['token'], response.json()['user']['id']
    
    @pytest.fixture
    def helpdesk_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=CREDENTIALS['helpdesk'])
        return response.json()['token'], response.json()['user']['id']
    
    def test_am_can_message_admin(self, am_token, admin_token):
        """Test AM can send message to Admin"""
        am_tok, am_id = am_token
        admin_tok, admin_id = admin_token
        
        # AM sends message to Admin
        message = f"TEST_Message from AM {int(time.time())}"
        response = requests.post(
            f"{BASE_URL}/api/chat/send",
            json={"to_user_id": admin_id, "message": message},
            headers={"Authorization": f"Bearer {am_tok}"}
        )
        assert response.status_code == 200, f"Failed to send chat: {response.text}"
        print("AM SEND TO ADMIN TEST PASSED")
        
        # Admin can see the conversation
        conv_response = requests.get(
            f"{BASE_URL}/api/chat/conversations",
            headers={"Authorization": f"Bearer {admin_tok}"}
        )
        assert conv_response.status_code == 200
        conversations = conv_response.json()['conversations']
        assert len(conversations) > 0, "Admin should see conversation from AM"
        print("ADMIN SEES CONVERSATION TEST PASSED")
        
        # Admin can see messages
        msg_response = requests.get(
            f"{BASE_URL}/api/chat/messages/{am_id}",
            headers={"Authorization": f"Bearer {admin_tok}"}
        )
        assert msg_response.status_code == 200
        messages = msg_response.json()['messages']
        assert any(m['message'] == message for m in messages), "Admin should see AM's message"
        print("ADMIN SEES MESSAGE TEST PASSED")
    
    def test_helpdesk_cannot_message_admin(self, helpdesk_token, admin_token):
        """Test Helpdesk CANNOT send message to Admin (403)"""
        helpdesk_tok, _ = helpdesk_token
        _, admin_id = admin_token
        
        response = requests.post(
            f"{BASE_URL}/api/chat/send",
            json={"to_user_id": admin_id, "message": "Test message from helpdesk"},
            headers={"Authorization": f"Bearer {helpdesk_tok}"}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        assert "Hanya AM" in response.json().get('detail', '')
        print("HELPDESK BLOCKED FROM ADMIN CHAT TEST PASSED")
    
    def test_get_chat_users(self, am_token):
        """Test getting available chat users"""
        am_tok, _ = am_token
        
        response = requests.get(
            f"{BASE_URL}/api/chat/users",
            headers={"Authorization": f"Bearer {am_tok}"}
        )
        assert response.status_code == 200
        users = response.json()['users']
        assert len(users) > 0, "AM should see other users to chat with"
        print(f"GET CHAT USERS TEST PASSED: Found {len(users)} users")


class TestSelectItemFix:
    """Test Select.Item fix for dropdowns"""
    
    @pytest.fixture
    def client_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=CREDENTIALS['client'])
        return response.json()['token']
    
    @pytest.fixture
    def am_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=CREDENTIALS['am'])
        return response.json()['token']
    
    def test_create_ticket_with_all_service_types(self, client_token):
        """Test ticket creation with all service types (dropdown test)"""
        for service_type in ['cctv', 'skpd', 'ip_speaker']:
            ticket_data = {
                "title": f"TEST_Select_Fix_{service_type}",
                "description": f"Testing {service_type} creation",
                "service_type": service_type,
                "location": "Test Location",
                "priority": "medium",
                "initial_indication": "RTO"
            }
            response = requests.post(
                f"{BASE_URL}/api/tickets",
                json=ticket_data,
                headers={"Authorization": f"Bearer {client_token}"}
            )
            assert response.status_code == 200, f"Failed to create {service_type} ticket: {response.text}"
            print(f"CREATE {service_type.upper()} TICKET PASSED")
    
    def test_restitution_calculation_all_services(self, am_token):
        """Test restitution calculation for all service types (dropdown test)"""
        for service_type in ['cctv', 'skpd', 'ip_speaker']:
            calc_data = {
                "service_type": service_type,
                "bandwidth_affected": 10,
                "downtime_minutes": 300,
                "month": 1,
                "year": 2026
            }
            response = requests.post(
                f"{BASE_URL}/api/restitution/calculate",
                json=calc_data,
                headers={"Authorization": f"Bearer {am_token}"}
            )
            assert response.status_code == 200, f"Failed restitution for {service_type}: {response.text}"
            result = response.json()
            assert 'restitution_amount' in result
            assert 'sla_met' in result
            print(f"RESTITUTION {service_type.upper()} PASSED: {result['restitution_amount']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
