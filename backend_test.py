#!/usr/bin/env python3
"""
Backend API Testing for TCG Association Manager
Tests all CRUD operations and authentication flows
"""

import requests
import sys
import json
from datetime import datetime, timezone
from typing import Dict, Any, Optional

class TCGAPITester:
    def __init__(self, base_url: str = "https://deck-admin.preview.emergentagent.com"):
        self.base_url = base_url
        self.session_token = "test_session_static"  # From review request
        self.user_id = "user_test123456"  # From review request
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        
        # Headers for authenticated requests
        self.headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {self.session_token}'
        }
        
        # Store created entities for cleanup
        self.created_entities = {
            'members': [],
            'events': [],
            'products': [],
            'expenses': []
        }

    def log_test(self, name: str, success: bool, details: str = ""):
        """Log test result"""
        self.tests_run += 1
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {name}")
        if details:
            print(f"    {details}")
        if success:
            self.tests_passed += 1
        else:
            self.failed_tests.append(f"{name}: {details}")
        print()

    def make_request(self, method: str, endpoint: str, data: Optional[Dict] = None, 
                    expected_status: int = 200) -> tuple[bool, Dict]:
        """Make HTTP request and validate response"""
        url = f"{self.base_url}/api/{endpoint}"
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=self.headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, headers=self.headers, json=data, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, headers=self.headers, json=data, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=self.headers, timeout=30)
            else:
                return False, {"error": f"Unsupported method: {method}"}
            
            success = response.status_code == expected_status
            
            try:
                response_data = response.json()
            except:
                response_data = {"text": response.text, "status_code": response.status_code}
            
            if not success:
                print(f"    Expected {expected_status}, got {response.status_code}")
                print(f"    Response: {response_data}")
            
            return success, response_data
            
        except requests.exceptions.RequestException as e:
            print(f"    Request failed: {str(e)}")
            return False, {"error": str(e)}

    def test_auth_me(self):
        """Test /api/auth/me endpoint"""
        success, data = self.make_request('GET', 'auth/me')
        
        if success:
            required_fields = ['user_id', 'email', 'name', 'roles', 'permissions']
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                self.log_test("Auth /me - Response Structure", False, 
                            f"Missing fields: {missing_fields}")
            else:
                self.log_test("Auth /me - Response Structure", True, 
                            f"User: {data.get('name')} ({data.get('email')})")
        else:
            self.log_test("Auth /me", False, "Failed to get user data")

    def test_dashboard(self):
        """Test /api/dashboard endpoint"""
        success, data = self.make_request('GET', 'dashboard')
        
        if success:
            required_sections = ['members', 'financials', 'subscriptions']
            missing_sections = [section for section in required_sections if section not in data]
            
            if missing_sections:
                self.log_test("Dashboard - Structure", False, 
                            f"Missing sections: {missing_sections}")
            else:
                members = data.get('members', {})
                financials = data.get('financials', {})
                self.log_test("Dashboard - Structure", True, 
                            f"Members: {members.get('total', 0)}, "
                            f"Monthly revenue: {financials.get('month', {}).get('revenue', 0)}")
        else:
            self.log_test("Dashboard", False, "Failed to get dashboard data")

    def test_members_crud(self):
        """Test Members CRUD operations"""
        # Test GET /api/members
        success, data = self.make_request('GET', 'members')
        self.log_test("Members - List", success, 
                     f"Found {len(data) if success else 0} members")
        
        # Test POST /api/members (Create)
        member_data = {
            "first_name": "Test",
            "last_name": "Member",
            "pseudo": "testmember",
            "email": "test@example.com",
            "phone": "0123456789",
            "status": "nouveau",
            "notes": "Test member created by automated test"
        }
        
        success, response = self.make_request('POST', 'members', member_data, 200)
        if success and 'member_id' in response:
            member_id = response['member_id']
            self.created_entities['members'].append(member_id)
            self.log_test("Members - Create", True, f"Created member: {member_id}")
            
            # Test GET /api/members/{member_id}
            success, member = self.make_request('GET', f'members/{member_id}')
            self.log_test("Members - Get by ID", success, 
                         f"Retrieved: {member.get('first_name', '')} {member.get('last_name', '')}")
            
            # Test PUT /api/members/{member_id} (Update)
            update_data = {"status": "actif", "notes": "Updated by test"}
            success, _ = self.make_request('PUT', f'members/{member_id}', update_data)
            self.log_test("Members - Update", success, "Updated member status")
            
        else:
            self.log_test("Members - Create", False, "Failed to create member")

    def test_events_crud(self):
        """Test Events CRUD operations"""
        # Test GET /api/events
        success, data = self.make_request('GET', 'events')
        self.log_test("Events - List", success, 
                     f"Found {len(data) if success else 0} events")
        
        # Test POST /api/events (Create)
        event_data = {
            "name": "Test Tournament",
            "date": "2024-12-31T14:00:00Z",
            "location": "Test Location",
            "event_type": "tournoi",
            "format": "Standard",
            "max_capacity": 32,
            "entry_fee": 5.0,
            "notes": "Test event created by automated test"
        }
        
        success, response = self.make_request('POST', 'events', event_data, 200)
        if success and 'event_id' in response:
            event_id = response['event_id']
            self.created_entities['events'].append(event_id)
            self.log_test("Events - Create", True, f"Created event: {event_id}")
            
            # Test GET /api/events/{event_id}
            success, event = self.make_request('GET', f'events/{event_id}')
            self.log_test("Events - Get by ID", success, 
                         f"Retrieved: {event.get('name', '')}")
            
            # Test PUT /api/events/{event_id} (Update)
            update_data = {"max_capacity": 64, "notes": "Updated by test"}
            success, _ = self.make_request('PUT', f'events/{event_id}', update_data)
            self.log_test("Events - Update", success, "Updated event capacity")
            
        else:
            self.log_test("Events - Create", False, "Failed to create event")

    def test_products_crud(self):
        """Test Products CRUD operations"""
        # Test GET /api/products
        success, data = self.make_request('GET', 'products')
        self.log_test("Products - List", success, 
                     f"Found {len(data) if success else 0} products")
        
        # Test POST /api/products (Create)
        product_data = {
            "name": "Test Drink",
            "category": "boissons",
            "subcategory": "sodas",
            "description": "Test beverage",
            "price": 2.50,
            "cost": 1.00,
            "track_stock": True,
            "stock_quantity": 50,
            "low_stock_threshold": 10
        }
        
        success, response = self.make_request('POST', 'products', product_data, 200)
        if success and 'product_id' in response:
            product_id = response['product_id']
            self.created_entities['products'].append(product_id)
            self.log_test("Products - Create", True, f"Created product: {product_id}")
            
            # Test GET /api/products/{product_id}
            success, product = self.make_request('GET', f'products/{product_id}')
            self.log_test("Products - Get by ID", success, 
                         f"Retrieved: {product.get('name', '')}")
            
            # Test PUT /api/products/{product_id} (Update)
            update_data = {"price": 3.00, "stock_quantity": 75}
            success, _ = self.make_request('PUT', f'products/{product_id}', update_data)
            self.log_test("Products - Update", success, "Updated product price and stock")
            
            # Test POST /api/products/{product_id}/restock
            restock_data = {"quantity": 25, "comment": "Test restock"}
            success, _ = self.make_request('POST', f'products/{product_id}/restock', restock_data)
            self.log_test("Products - Restock", success, "Restocked product")
            
        else:
            self.log_test("Products - Create", False, "Failed to create product")

    def test_sales_pos(self):
        """Test Sales/POS operations"""
        # First ensure we have a product to sell
        if not self.created_entities['products']:
            self.log_test("Sales - Create", False, "No products available for sale")
            return
        
        product_id = self.created_entities['products'][0]
        
        # Test POST /api/sales (Create sale)
        sale_data = {
            "items": [
                {"product_id": product_id, "quantity": 2}
            ],
            "payment_method": "especes",
            "payment_status": "paye",
            "event_id": self.created_entities['events'][0] if self.created_entities['events'] else None,
            "comment": "Test sale"
        }
        
        success, response = self.make_request('POST', 'sales', sale_data, 200)
        if success and 'sale_id' in response:
            sale_id = response['sale_id']
            total = response.get('total_amount', 0)
            self.log_test("Sales - Create", True, f"Created sale: {sale_id}, Total: €{total}")
            
            # Test GET /api/sales
            success, sales = self.make_request('GET', 'sales')
            self.log_test("Sales - List", success, 
                         f"Found {len(sales) if success else 0} sales")
        else:
            self.log_test("Sales - Create", False, "Failed to create sale")

    def test_expenses_crud(self):
        """Test Expenses CRUD operations"""
        # Test GET /api/expenses
        success, data = self.make_request('GET', 'expenses')
        self.log_test("Expenses - List", success, 
                     f"Found {len(data) if success else 0} expenses")
        
        # Test POST /api/expenses (Create)
        expense_data = {
            "amount": 25.50,
            "category": "consommables",
            "subcategory": "boissons",
            "description": "Test expense - beverages purchase",
            "payment_method": "carte",
            "expense_date": "2024-08-15T10:00:00Z",
            "supplier": "Test Supplier",
            "reference": "TEST-001"
        }
        
        success, response = self.make_request('POST', 'expenses', expense_data, 200)
        if success and 'expense_id' in response:
            expense_id = response['expense_id']
            self.created_entities['expenses'].append(expense_id)
            self.log_test("Expenses - Create", True, f"Created expense: {expense_id}")
            
            # Test PUT /api/expenses/{expense_id} (Update)
            update_data = {"amount": 30.00, "description": "Updated test expense"}
            success, _ = self.make_request('PUT', f'expenses/{expense_id}', update_data)
            self.log_test("Expenses - Update", success, "Updated expense amount")
            
        else:
            self.log_test("Expenses - Create", False, "Failed to create expense")

    def test_settings(self):
        """Test Settings endpoint"""
        success, data = self.make_request('GET', 'settings')
        
        if success:
            expected_settings = ['annual_subscription_amount', 'max_free_participations', 
                               'current_season', 'payment_methods']
            missing_settings = [setting for setting in expected_settings if setting not in data]
            
            if missing_settings:
                self.log_test("Settings - Structure", False, 
                            f"Missing settings: {missing_settings}")
            else:
                self.log_test("Settings - Structure", True, 
                            f"Season: {data.get('current_season')}, "
                            f"Subscription: €{data.get('annual_subscription_amount')}")
        else:
            self.log_test("Settings", False, "Failed to get settings")

    def test_roles(self):
        """Test Roles endpoint"""
        success, data = self.make_request('GET', 'roles')
        self.log_test("Roles - List", success, 
                     f"Found {len(data) if success else 0} roles")

    def cleanup_test_data(self):
        """Clean up created test data"""
        print("\n🧹 Cleaning up test data...")
        
        # Delete created expenses
        for expense_id in self.created_entities['expenses']:
            success, _ = self.make_request('DELETE', f'expenses/{expense_id}')
            if success:
                print(f"    Deleted expense: {expense_id}")
        
        # Archive created members (soft delete)
        for member_id in self.created_entities['members']:
            success, _ = self.make_request('DELETE', f'members/{member_id}')
            if success:
                print(f"    Archived member: {member_id}")
        
        # Delete created events
        for event_id in self.created_entities['events']:
            success, _ = self.make_request('DELETE', f'events/{event_id}')
            if success:
                print(f"    Deleted event: {event_id}")
        
        # Note: Products are not deleted to avoid affecting sales records

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting TCG Association Manager API Tests")
        print(f"Backend URL: {self.base_url}")
        print(f"Session Token: {self.session_token[:20]}...")
        print("=" * 60)
        
        # Authentication tests
        print("\n📋 Authentication Tests")
        self.test_auth_me()
        
        # Dashboard tests
        print("\n📊 Dashboard Tests")
        self.test_dashboard()
        
        # CRUD tests
        print("\n👥 Members CRUD Tests")
        self.test_members_crud()
        
        print("\n📅 Events CRUD Tests")
        self.test_events_crud()
        
        print("\n📦 Products CRUD Tests")
        self.test_products_crud()
        
        print("\n💰 Sales/POS Tests")
        self.test_sales_pos()
        
        print("\n💸 Expenses CRUD Tests")
        self.test_expenses_crud()
        
        # Configuration tests
        print("\n⚙️ Settings Tests")
        self.test_settings()
        
        print("\n🔐 Roles Tests")
        self.test_roles()
        
        # Cleanup
        self.cleanup_test_data()
        
        # Summary
        print("\n" + "=" * 60)
        print("📈 TEST SUMMARY")
        print(f"Tests run: {self.tests_run}")
        print(f"Tests passed: {self.tests_passed}")
        print(f"Tests failed: {self.tests_run - self.tests_passed}")
        print(f"Success rate: {(self.tests_passed / self.tests_run * 100):.1f}%")
        
        if self.failed_tests:
            print("\n❌ Failed Tests:")
            for failure in self.failed_tests:
                print(f"  - {failure}")
        
        return self.tests_passed == self.tests_run

def main():
    """Main test runner"""
    tester = TCGAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())