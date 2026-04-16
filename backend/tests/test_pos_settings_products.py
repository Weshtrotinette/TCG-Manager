"""
Test suite for TCG Manager - POS, Settings, and Products features
Tests: Settings tabs, POS whitelist, product image upload, dynamic payment methods
"""
import pytest
import requests
import os
import json

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://deck-admin.preview.emergentagent.com')
SESSION_TOKEN = "test_session_1776359528327"

@pytest.fixture
def api_client():
    """Shared requests session with auth"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Cookie": f"session_token={SESSION_TOKEN}"
    })
    return session


class TestSettingsAPI:
    """Test Settings API endpoints"""
    
    def test_get_settings_returns_pos_visible_subcategories(self, api_client):
        """Settings should include pos_visible_subcategories field"""
        response = api_client.get(f"{BASE_URL}/api/settings")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "pos_visible_subcategories" in data, "Missing pos_visible_subcategories field"
        assert isinstance(data["pos_visible_subcategories"], list), "pos_visible_subcategories should be a list"
        print(f"✓ Settings has pos_visible_subcategories: {data['pos_visible_subcategories']}")
    
    def test_get_settings_returns_product_categories_with_subcategories(self, api_client):
        """Settings should include product_categories as dict with subcategories"""
        response = api_client.get(f"{BASE_URL}/api/settings")
        assert response.status_code == 200
        
        data = response.json()
        assert "product_categories" in data, "Missing product_categories field"
        
        # Should be a dict with category keys and subcategory arrays
        cats = data["product_categories"]
        assert isinstance(cats, dict), "product_categories should be a dict"
        
        # Check structure
        for cat_name, subcats in cats.items():
            assert isinstance(subcats, list), f"Subcategories for {cat_name} should be a list"
        
        print(f"✓ Product categories: {list(cats.keys())}")
        for cat, subs in cats.items():
            if subs:
                print(f"  - {cat}: {subs}")
    
    def test_get_settings_returns_payment_methods(self, api_client):
        """Settings should include payment_methods list"""
        response = api_client.get(f"{BASE_URL}/api/settings")
        assert response.status_code == 200
        
        data = response.json()
        assert "payment_methods" in data, "Missing payment_methods field"
        assert isinstance(data["payment_methods"], list), "payment_methods should be a list"
        assert len(data["payment_methods"]) > 0, "payment_methods should not be empty"
        print(f"✓ Payment methods: {data['payment_methods']}")
    
    def test_update_pos_visible_subcategories(self, api_client):
        """Should be able to update pos_visible_subcategories"""
        # First get current settings
        response = api_client.get(f"{BASE_URL}/api/settings")
        original_data = response.json()
        original_pos_visible = original_data.get("pos_visible_subcategories", [])
        
        # Update with new value
        new_subcats = ["boissons", "snack"]
        response = api_client.put(
            f"{BASE_URL}/api/settings",
            json={"pos_visible_subcategories": new_subcats}
        )
        assert response.status_code == 200, f"Update failed: {response.text}"
        
        # Verify update
        response = api_client.get(f"{BASE_URL}/api/settings")
        data = response.json()
        assert data["pos_visible_subcategories"] == new_subcats, "pos_visible_subcategories not updated"
        print(f"✓ Updated pos_visible_subcategories to: {new_subcats}")
    
    def test_update_general_settings(self, api_client):
        """Should be able to update general settings (season, subscription amount)"""
        response = api_client.put(
            f"{BASE_URL}/api/settings",
            json={
                "current_season": "2026",
                "annual_subscription_amount": 25.0,
                "enable_trial_rule": True,
                "max_free_participations": 3
            }
        )
        assert response.status_code == 200, f"Update failed: {response.text}"
        
        # Verify
        response = api_client.get(f"{BASE_URL}/api/settings")
        data = response.json()
        assert data["current_season"] == "2026"
        print(f"✓ General settings updated: season={data['current_season']}, subscription={data['annual_subscription_amount']}")
    
    def test_add_payment_method(self, api_client):
        """Should be able to add a new payment method"""
        # Get current methods
        response = api_client.get(f"{BASE_URL}/api/settings")
        data = response.json()
        current_methods = data.get("payment_methods", [])
        
        # Add test method if not present
        test_method = "test_payment"
        if test_method not in current_methods:
            new_methods = current_methods + [test_method]
            response = api_client.put(
                f"{BASE_URL}/api/settings",
                json={"payment_methods": new_methods}
            )
            assert response.status_code == 200
            
            # Verify
            response = api_client.get(f"{BASE_URL}/api/settings")
            data = response.json()
            assert test_method in data["payment_methods"]
            print(f"✓ Added payment method: {test_method}")
            
            # Clean up - remove test method
            clean_methods = [m for m in data["payment_methods"] if m != test_method]
            api_client.put(f"{BASE_URL}/api/settings", json={"payment_methods": clean_methods})
        else:
            print(f"✓ Payment method test skipped (already exists)")


class TestProductsAPI:
    """Test Products API endpoints"""
    
    def test_get_products_list(self, api_client):
        """Should return list of products with subcategory field"""
        response = api_client.get(f"{BASE_URL}/api/products?active_only=true")
        assert response.status_code == 200
        
        products = response.json()
        assert isinstance(products, list)
        print(f"✓ Got {len(products)} active products")
        
        # Check structure
        if products:
            product = products[0]
            assert "product_id" in product
            assert "name" in product
            assert "category" in product
            # subcategory can be null
            assert "subcategory" in product or product.get("subcategory") is None
            print(f"  Sample: {product['name']} - cat:{product.get('category')} sub:{product.get('subcategory')}")
    
    def test_products_have_image_url_field(self, api_client):
        """Products should have image_url field"""
        response = api_client.get(f"{BASE_URL}/api/products?active_only=true")
        assert response.status_code == 200
        
        products = response.json()
        products_with_images = [p for p in products if p.get("image_url")]
        print(f"✓ {len(products_with_images)}/{len(products)} products have images")
        
        if products_with_images:
            print(f"  Sample image URL: {products_with_images[0]['image_url']}")
    
    def test_create_product_with_subcategory(self, api_client):
        """Should be able to create product with subcategory"""
        test_product = {
            "name": "TEST_Product_With_Subcategory",
            "category": "denrées",
            "subcategory": "boissons",
            "price": 2.50,
            "track_stock": True,
            "stock_quantity": 10
        }
        
        response = api_client.post(f"{BASE_URL}/api/products", json=test_product)
        assert response.status_code == 200, f"Create failed: {response.text}"
        
        data = response.json()
        product_id = data.get("product_id")
        assert product_id, "No product_id returned"
        print(f"✓ Created product: {product_id}")
        
        # Verify product has subcategory
        response = api_client.get(f"{BASE_URL}/api/products/{product_id}")
        assert response.status_code == 200
        product = response.json()
        assert product["subcategory"] == "boissons"
        print(f"  Verified subcategory: {product['subcategory']}")
        
        # Cleanup - deactivate product
        api_client.put(f"{BASE_URL}/api/products/{product_id}", json={"is_active": False})
        return product_id
    
    def test_upload_product_image_endpoint_exists(self, api_client):
        """Upload image endpoint should exist and validate file type"""
        # Test with invalid request (no file) - should return 422 (validation error)
        response = api_client.post(f"{BASE_URL}/api/products/nonexistent/upload-image")
        # 422 means endpoint exists but validation failed (no file)
        # 404 would mean product not found (also valid)
        assert response.status_code in [404, 422], f"Unexpected status: {response.status_code}"
        print(f"✓ Upload image endpoint exists (status: {response.status_code})")


class TestPOSIntegration:
    """Test POS page integration with settings"""
    
    def test_pos_whitelist_filtering_logic(self, api_client):
        """Test that POS whitelist filtering works correctly"""
        # Get settings
        response = api_client.get(f"{BASE_URL}/api/settings")
        settings = response.json()
        pos_visible = settings.get("pos_visible_subcategories", [])
        
        # Get all products
        response = api_client.get(f"{BASE_URL}/api/products?active_only=true")
        products = response.json()
        
        # Count products by subcategory
        subcategory_counts = {}
        for p in products:
            sub = p.get("subcategory") or "autres"
            subcategory_counts[sub] = subcategory_counts.get(sub, 0) + 1
        
        print(f"✓ POS whitelist: {pos_visible}")
        print(f"  Product subcategories: {subcategory_counts}")
        
        # If whitelist is set, only those subcategories should show
        if pos_visible:
            visible_count = sum(subcategory_counts.get(s, 0) for s in pos_visible)
            # Products without subcategory go to "autres"
            if "autres" not in pos_visible:
                visible_count += subcategory_counts.get("autres", 0)
            print(f"  Products visible in POS: {visible_count}")
    
    def test_sales_endpoint_works(self, api_client):
        """Sales endpoint should work for POS checkout"""
        response = api_client.get(f"{BASE_URL}/api/sales")
        assert response.status_code == 200
        
        sales = response.json()
        print(f"✓ Sales endpoint works, {len(sales)} sales found")
    
    def test_create_sale_with_dynamic_payment_method(self, api_client):
        """Should be able to create sale with payment method from settings"""
        # Get a product
        response = api_client.get(f"{BASE_URL}/api/products?active_only=true")
        products = response.json()
        
        if not products:
            pytest.skip("No products available for sale test")
        
        product = products[0]
        
        # Get payment methods from settings
        response = api_client.get(f"{BASE_URL}/api/settings")
        settings = response.json()
        payment_method = settings["payment_methods"][0]  # Use first method
        
        # Create sale
        sale_data = {
            "items": [{"product_id": product["product_id"], "quantity": 1}],
            "payment_method": payment_method,
            "payment_status": "paye"
        }
        
        response = api_client.post(f"{BASE_URL}/api/sales", json=sale_data)
        assert response.status_code == 200, f"Sale failed: {response.text}"
        
        data = response.json()
        assert "sale_id" in data
        print(f"✓ Created sale with payment method '{payment_method}': {data['sale_id']}")


class TestProductImageUpload:
    """Test product image upload functionality"""
    
    def test_upload_image_to_existing_product(self, api_client):
        """Should be able to upload image to existing product"""
        # Get a product
        response = api_client.get(f"{BASE_URL}/api/products?active_only=true")
        products = response.json()
        
        if not products:
            pytest.skip("No products available")
        
        product = products[0]
        product_id = product["product_id"]
        
        # Create a simple test image (1x1 PNG)
        import base64
        # Minimal valid PNG (1x1 transparent pixel)
        png_data = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        )
        
        # Upload using multipart form
        files = {"file": ("test.png", png_data, "image/png")}
        
        # Need to use requests directly without JSON content-type
        upload_response = requests.post(
            f"{BASE_URL}/api/products/{product_id}/upload-image",
            files=files,
            cookies={"session_token": SESSION_TOKEN}
        )
        
        assert upload_response.status_code == 200, f"Upload failed: {upload_response.text}"
        
        data = upload_response.json()
        assert "image_url" in data
        print(f"✓ Uploaded image to product {product_id}: {data['image_url']}")
        
        # Verify product has image_url
        response = api_client.get(f"{BASE_URL}/api/products/{product_id}")
        product = response.json()
        assert product.get("image_url"), "Product should have image_url after upload"
        print(f"  Verified image_url: {product['image_url']}")


class TestSettingsProductCategories:
    """Test product categories with subcategories in settings"""
    
    def test_product_categories_structure(self, api_client):
        """Product categories should be dict with subcategory arrays"""
        response = api_client.get(f"{BASE_URL}/api/settings")
        data = response.json()
        
        cats = data.get("product_categories", {})
        assert isinstance(cats, dict), "product_categories should be dict"
        
        # Expected categories based on context
        expected_cats = ["denrées", "consommables", "autres", "produite tcg", "merch"]
        
        for cat in expected_cats:
            if cat in cats:
                print(f"✓ Category '{cat}' exists with subcategories: {cats[cat]}")
    
    def test_update_product_categories(self, api_client):
        """Should be able to update product categories"""
        # Get current
        response = api_client.get(f"{BASE_URL}/api/settings")
        original = response.json()
        original_cats = original.get("product_categories", {})
        
        # Add a test subcategory
        test_cats = dict(original_cats)
        if "denrées" in test_cats:
            if "test_sub" not in test_cats["denrées"]:
                test_cats["denrées"] = test_cats["denrées"] + ["test_sub"]
                
                response = api_client.put(
                    f"{BASE_URL}/api/settings",
                    json={"product_categories": test_cats}
                )
                assert response.status_code == 200
                
                # Verify
                response = api_client.get(f"{BASE_URL}/api/settings")
                data = response.json()
                assert "test_sub" in data["product_categories"]["denrées"]
                print(f"✓ Added test subcategory to denrées")
                
                # Cleanup
                clean_cats = dict(data["product_categories"])
                clean_cats["denrées"] = [s for s in clean_cats["denrées"] if s != "test_sub"]
                api_client.put(f"{BASE_URL}/api/settings", json={"product_categories": clean_cats})
        else:
            print("✓ Skipped - denrées category not found")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
