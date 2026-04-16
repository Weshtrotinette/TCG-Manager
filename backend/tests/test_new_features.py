"""
Test suite for TCG Manager new features:
- Settings: pack_tournois_price, carte_snack_price, carte_snack_value, cards_are_permanent, season_renewal_day/month
- Subscriptions: fixed amount + Pack Tournois checkbox + Carte Snack checkbox
- Snack Cards: GET /api/snack-cards, POST /api/snack-cards/{id}/deduct
- Pack Tournois: GET /api/members/{id}/pack-tournois, PUT /api/participations/{id} with use_pack_tournois
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
SESSION_TOKEN = "test_session_1776359528327"

@pytest.fixture
def api_client():
    """Shared requests session with auth"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {SESSION_TOKEN}"
    })
    return session


class TestSettingsNewFields:
    """Test new settings fields for pack tournois, carte snack, and season renewal"""
    
    def test_settings_has_pack_tournois_price(self, api_client):
        """Settings should have pack_tournois_price field"""
        response = api_client.get(f"{BASE_URL}/api/settings")
        assert response.status_code == 200
        data = response.json()
        assert "pack_tournois_price" in data
        assert isinstance(data["pack_tournois_price"], (int, float))
        print(f"pack_tournois_price: {data['pack_tournois_price']}")
    
    def test_settings_has_carte_snack_price(self, api_client):
        """Settings should have carte_snack_price field"""
        response = api_client.get(f"{BASE_URL}/api/settings")
        assert response.status_code == 200
        data = response.json()
        assert "carte_snack_price" in data
        assert isinstance(data["carte_snack_price"], (int, float))
        print(f"carte_snack_price: {data['carte_snack_price']}")
    
    def test_settings_has_carte_snack_value(self, api_client):
        """Settings should have carte_snack_value field"""
        response = api_client.get(f"{BASE_URL}/api/settings")
        assert response.status_code == 200
        data = response.json()
        assert "carte_snack_value" in data
        assert isinstance(data["carte_snack_value"], (int, float))
        print(f"carte_snack_value: {data['carte_snack_value']}")
    
    def test_settings_has_cards_are_permanent(self, api_client):
        """Settings should have cards_are_permanent toggle"""
        response = api_client.get(f"{BASE_URL}/api/settings")
        assert response.status_code == 200
        data = response.json()
        assert "cards_are_permanent" in data
        assert isinstance(data["cards_are_permanent"], bool)
        print(f"cards_are_permanent: {data['cards_are_permanent']}")
    
    def test_settings_has_season_renewal_day(self, api_client):
        """Settings should have season_renewal_day field"""
        response = api_client.get(f"{BASE_URL}/api/settings")
        assert response.status_code == 200
        data = response.json()
        assert "season_renewal_day" in data
        assert isinstance(data["season_renewal_day"], int)
        assert 1 <= data["season_renewal_day"] <= 31
        print(f"season_renewal_day: {data['season_renewal_day']}")
    
    def test_settings_has_season_renewal_month(self, api_client):
        """Settings should have season_renewal_month field"""
        response = api_client.get(f"{BASE_URL}/api/settings")
        assert response.status_code == 200
        data = response.json()
        assert "season_renewal_month" in data
        assert isinstance(data["season_renewal_month"], int)
        assert 1 <= data["season_renewal_month"] <= 12
        print(f"season_renewal_month: {data['season_renewal_month']}")
    
    def test_settings_save_new_fields(self, api_client):
        """Settings save should persist new fields"""
        # Get current values
        response = api_client.get(f"{BASE_URL}/api/settings")
        original = response.json()
        
        # Update with new values
        update_data = {
            "pack_tournois_price": 6.0,
            "carte_snack_price": 11.0,
            "carte_snack_value": 13.0,
            "cards_are_permanent": True,
            "season_renewal_day": 15,
            "season_renewal_month": 10
        }
        response = api_client.put(f"{BASE_URL}/api/settings", json=update_data)
        assert response.status_code == 200
        
        # Verify changes persisted
        response = api_client.get(f"{BASE_URL}/api/settings")
        data = response.json()
        assert data["pack_tournois_price"] == 6.0
        assert data["carte_snack_price"] == 11.0
        assert data["carte_snack_value"] == 13.0
        assert data["cards_are_permanent"] == True
        assert data["season_renewal_day"] == 15
        assert data["season_renewal_month"] == 10
        
        # Restore original values
        restore_data = {
            "pack_tournois_price": original.get("pack_tournois_price", 5.0),
            "carte_snack_price": original.get("carte_snack_price", 10.0),
            "carte_snack_value": original.get("carte_snack_value", 12.0),
            "cards_are_permanent": original.get("cards_are_permanent", False),
            "season_renewal_day": original.get("season_renewal_day", 1),
            "season_renewal_month": original.get("season_renewal_month", 9)
        }
        api_client.put(f"{BASE_URL}/api/settings", json=restore_data)
        print("Settings save and restore successful")


class TestSnackCards:
    """Test snack card endpoints"""
    
    def test_get_snack_cards_active_only(self, api_client):
        """GET /api/snack-cards should return active cards with member names"""
        response = api_client.get(f"{BASE_URL}/api/snack-cards?active_only=true")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # Check structure of cards
        for card in data:
            assert "card_id" in card
            assert "member_id" in card
            assert "balance" in card
            assert "member_name" in card
            assert card["balance"] > 0  # active_only=true means balance > 0
            print(f"Snack card: {card['member_name']} - {card['balance']} EUR")
    
    def test_get_snack_cards_all(self, api_client):
        """GET /api/snack-cards?active_only=false should return all cards"""
        response = api_client.get(f"{BASE_URL}/api/snack-cards?active_only=false")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Total snack cards: {len(data)}")
    
    def test_deduct_snack_card(self, api_client):
        """POST /api/snack-cards/{id}/deduct should deduct amount and return remaining"""
        # Get an active card
        response = api_client.get(f"{BASE_URL}/api/snack-cards?active_only=true")
        cards = response.json()
        
        if not cards:
            pytest.skip("No active snack cards to test deduction")
        
        card = cards[0]
        original_balance = card["balance"]
        deduct_amount = 0.5  # Small amount to not deplete the card
        
        if original_balance < deduct_amount:
            pytest.skip("Card balance too low for test")
        
        # Deduct
        response = api_client.post(f"{BASE_URL}/api/snack-cards/{card['card_id']}/deduct?amount={deduct_amount}")
        assert response.status_code == 200
        data = response.json()
        
        # API returns "remaining" not "remaining_balance"
        assert "remaining" in data
        assert "deducted" in data
        expected_remaining = original_balance - deduct_amount
        assert abs(data["remaining"] - expected_remaining) < 0.01
        print(f"Deducted {deduct_amount} EUR, remaining: {data['remaining']} EUR")
        
        # Verify balance updated
        response = api_client.get(f"{BASE_URL}/api/snack-cards?active_only=false")
        cards = response.json()
        updated_card = next((c for c in cards if c["card_id"] == card["card_id"]), None)
        assert updated_card is not None
        assert abs(updated_card["balance"] - expected_remaining) < 0.01
    
    def test_deduct_snack_card_partial_deduction(self, api_client):
        """POST /api/snack-cards/{id}/deduct should deduct min(amount, balance) - partial deduction"""
        response = api_client.get(f"{BASE_URL}/api/snack-cards?active_only=true")
        cards = response.json()
        
        if not cards:
            pytest.skip("No active snack cards to test")
        
        card = cards[0]
        # Request more than balance - API should deduct only what's available
        excessive_amount = card["balance"] + 100
        
        response = api_client.post(f"{BASE_URL}/api/snack-cards/{card['card_id']}/deduct?amount={excessive_amount}")
        # API deducts min(amount, balance) and returns 200
        assert response.status_code == 200
        data = response.json()
        # Should have deducted only the available balance
        assert data["deducted"] <= card["balance"]
        print(f"Partial deduction: requested {excessive_amount}, deducted {data['deducted']}")
    
    def test_deduct_nonexistent_card(self, api_client):
        """POST /api/snack-cards/{id}/deduct should return 404 for invalid card"""
        response = api_client.post(f"{BASE_URL}/api/snack-cards/invalid_card_id/deduct?amount=1")
        assert response.status_code == 404
        print("Correctly returned 404 for invalid card")


class TestPackTournois:
    """Test pack tournois endpoints"""
    
    def test_get_member_pack_tournois(self, api_client):
        """GET /api/members/{id}/pack-tournois should return pack status"""
        # Use the known test member with pack tournois
        member_id = "member_b3aeaa4d9c94"
        response = api_client.get(f"{BASE_URL}/api/members/{member_id}/pack-tournois")
        assert response.status_code == 200
        data = response.json()
        assert "has_pack_tournois" in data
        assert isinstance(data["has_pack_tournois"], bool)
        print(f"Member {member_id} has_pack_tournois: {data['has_pack_tournois']}")
    
    def test_get_pack_tournois_nonexistent_member(self, api_client):
        """GET /api/members/{id}/pack-tournois should return 404 for invalid member"""
        response = api_client.get(f"{BASE_URL}/api/members/invalid_member_id/pack-tournois")
        assert response.status_code == 404
        print("Correctly returned 404 for invalid member")


class TestSubscriptionWithOptions:
    """Test subscription creation with pack tournois and carte snack options"""
    
    def test_create_subscription_with_pack_tournois(self, api_client):
        """Creating subscription with pack_tournois should set has_pack_tournois on member"""
        # Get settings for prices
        response = api_client.get(f"{BASE_URL}/api/settings")
        settings = response.json()
        base_amount = settings["annual_subscription_amount"]
        pack_price = settings["pack_tournois_price"]
        
        # Get a member without subscription
        response = api_client.get(f"{BASE_URL}/api/members")
        members = response.json()
        
        # Get existing subscriptions
        response = api_client.get(f"{BASE_URL}/api/subscriptions")
        subs = response.json()
        sub_member_ids = [s["member_id"] for s in subs if s["season"] == settings["current_season"]]
        
        # Find member without subscription
        available_members = [m for m in members if m["member_id"] not in sub_member_ids 
                           and m.get("member_type", "adherent") == "adherent"
                           and m.get("status") != "archive"]
        
        if not available_members:
            pytest.skip("No available members for subscription test")
        
        test_member = available_members[0]
        total_amount = base_amount + pack_price
        
        # Create subscription with pack tournois
        sub_data = {
            "member_id": test_member["member_id"],
            "season": settings["current_season"],
            "amount_due": total_amount,
            "includes_pack_tournois": True,
            "includes_carte_snack": False
        }
        response = api_client.post(f"{BASE_URL}/api/subscriptions", json=sub_data)
        assert response.status_code == 200
        result = response.json()
        assert "subscription_id" in result
        
        # Verify member now has pack tournois
        response = api_client.get(f"{BASE_URL}/api/members/{test_member['member_id']}/pack-tournois")
        assert response.status_code == 200
        data = response.json()
        assert data["has_pack_tournois"] == True
        print(f"Created subscription with pack tournois for {test_member['first_name']} {test_member['last_name']}")
        
        # Cleanup: delete the subscription
        api_client.delete(f"{BASE_URL}/api/subscriptions/{result['subscription_id']}")
    
    def test_create_subscription_with_carte_snack(self, api_client):
        """Creating subscription with carte_snack should create a snack card"""
        # Get settings
        response = api_client.get(f"{BASE_URL}/api/settings")
        settings = response.json()
        base_amount = settings["annual_subscription_amount"]
        snack_price = settings["carte_snack_price"]
        snack_value = settings["carte_snack_value"]
        
        # Get a member without subscription
        response = api_client.get(f"{BASE_URL}/api/members")
        members = response.json()
        
        response = api_client.get(f"{BASE_URL}/api/subscriptions")
        subs = response.json()
        sub_member_ids = [s["member_id"] for s in subs if s["season"] == settings["current_season"]]
        
        available_members = [m for m in members if m["member_id"] not in sub_member_ids 
                           and m.get("member_type", "adherent") == "adherent"
                           and m.get("status") != "archive"]
        
        if not available_members:
            pytest.skip("No available members for subscription test")
        
        test_member = available_members[0]
        total_amount = base_amount + snack_price
        
        # Get initial snack card count for this member
        response = api_client.get(f"{BASE_URL}/api/snack-cards?active_only=false")
        initial_cards = [c for c in response.json() if c["member_id"] == test_member["member_id"]]
        initial_count = len(initial_cards)
        
        # Create subscription with carte snack
        sub_data = {
            "member_id": test_member["member_id"],
            "season": settings["current_season"],
            "amount_due": total_amount,
            "includes_pack_tournois": False,
            "includes_carte_snack": True
        }
        response = api_client.post(f"{BASE_URL}/api/subscriptions", json=sub_data)
        assert response.status_code == 200
        result = response.json()
        
        # Verify snack card was created
        response = api_client.get(f"{BASE_URL}/api/snack-cards?active_only=false")
        new_cards = [c for c in response.json() if c["member_id"] == test_member["member_id"]]
        assert len(new_cards) == initial_count + 1
        
        # Verify card has correct balance
        newest_card = max(new_cards, key=lambda c: c["created_at"])
        assert newest_card["balance"] == snack_value
        assert newest_card["initial_value"] == snack_value
        print(f"Created subscription with carte snack for {test_member['first_name']} {test_member['last_name']}")
        print(f"Snack card balance: {newest_card['balance']} EUR")
        
        # Cleanup: delete the subscription (card remains)
        api_client.delete(f"{BASE_URL}/api/subscriptions/{result['subscription_id']}")


class TestParticipationWithPackTournois:
    """Test participation update with use_pack_tournois parameter"""
    
    def test_participation_update_accepts_use_pack_tournois(self, api_client):
        """PUT /api/participations/{id} should accept use_pack_tournois parameter"""
        # Get events
        response = api_client.get(f"{BASE_URL}/api/events")
        events = response.json()
        
        if not events:
            pytest.skip("No events to test participation")
        
        # Get event with participations
        for event in events:
            response = api_client.get(f"{BASE_URL}/api/events/{event['event_id']}")
            event_detail = response.json()
            if event_detail.get("participations"):
                participation = event_detail["participations"][0]
                
                # Try updating with use_pack_tournois
                response = api_client.put(
                    f"{BASE_URL}/api/participations/{participation['participation_id']}",
                    params={"use_pack_tournois": "true"}
                )
                # Should succeed (200) or fail gracefully if member doesn't have pack
                assert response.status_code in [200, 400]
                print(f"Participation update with use_pack_tournois: status {response.status_code}")
                return
        
        pytest.skip("No participations found to test")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
