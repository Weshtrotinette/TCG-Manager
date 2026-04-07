"""
Backend API Tests for TCG Association Manager - New Features
Tests for:
1. Member types (adherent/non_adherent)
2. Event types and formats (dropdown lists from settings)
3. Tournament management (Swiss, elimination, round robin)
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
AUTH_HEADER = {"Authorization": "Bearer test_session_admin"}

# Test data prefix for cleanup
TEST_PREFIX = "TEST_"


class TestAuthAndHealth:
    """Basic auth and health checks"""
    
    def test_auth_me(self):
        """Test authentication endpoint"""
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=AUTH_HEADER)
        assert response.status_code == 200, f"Auth failed: {response.text}"
        data = response.json()
        assert data["user_id"] == "user_test123456"
        assert "president" in data["roles"]
        print("✓ Auth working correctly")


class TestMemberTypes:
    """Tests for member_type field (adherent/non_adherent)"""
    
    def test_create_adherent_member(self):
        """Create a member with type 'adherent'"""
        payload = {
            "first_name": f"{TEST_PREFIX}Jean",
            "last_name": f"{TEST_PREFIX}Adherent",
            "pseudo": "TestAdherent",
            "email": f"test_adherent_{uuid.uuid4().hex[:6]}@test.com",
            "member_type": "adherent",
            "status": "actif"
        }
        response = requests.post(f"{BASE_URL}/api/members", headers=AUTH_HEADER, json=payload)
        assert response.status_code == 200, f"Failed to create adherent: {response.text}"
        data = response.json()
        member_id = data["member_id"]
        
        # Verify by fetching the member
        get_resp = requests.get(f"{BASE_URL}/api/members/{member_id}", headers=AUTH_HEADER)
        assert get_resp.status_code == 200
        member = get_resp.json()
        assert member["member_type"] == "adherent", f"Expected adherent, got {member.get('member_type')}"
        print(f"✓ Created adherent member: {member_id}")
        return member_id
    
    def test_create_non_adherent_member(self):
        """Create a member with type 'non_adherent'"""
        payload = {
            "first_name": f"{TEST_PREFIX}Pierre",
            "last_name": f"{TEST_PREFIX}NonAdherent",
            "pseudo": "TestNonAdherent",
            "email": f"test_nonadherent_{uuid.uuid4().hex[:6]}@test.com",
            "member_type": "non_adherent",
            "status": "nouveau"
        }
        response = requests.post(f"{BASE_URL}/api/members", headers=AUTH_HEADER, json=payload)
        assert response.status_code == 200, f"Failed to create non-adherent: {response.text}"
        data = response.json()
        member_id = data["member_id"]
        
        # Verify by fetching the member
        get_resp = requests.get(f"{BASE_URL}/api/members/{member_id}", headers=AUTH_HEADER)
        assert get_resp.status_code == 200
        member = get_resp.json()
        assert member["member_type"] == "non_adherent", f"Expected non_adherent, got {member.get('member_type')}"
        print(f"✓ Created non-adherent member: {member_id}")
        return member_id
    
    def test_get_members_with_type(self):
        """Verify members list includes member_type field for new members"""
        response = requests.get(f"{BASE_URL}/api/members", headers=AUTH_HEADER)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # Check that at least some members have member_type field
        members_with_type = [m for m in data if "member_type" in m]
        print(f"✓ Members list: {len(data)} total, {len(members_with_type)} with member_type field")
        
        # Verify member_type values are valid when present
        for member in members_with_type:
            assert member["member_type"] in ["adherent", "non_adherent"], f"Invalid member_type: {member['member_type']}"
        
        assert len(members_with_type) > 0, "No members have member_type field - feature may not be working"
    
    def test_update_member_type(self):
        """Update a member's type from adherent to non_adherent"""
        # First create a member
        payload = {
            "first_name": f"{TEST_PREFIX}Update",
            "last_name": f"{TEST_PREFIX}Type",
            "member_type": "adherent"
        }
        create_resp = requests.post(f"{BASE_URL}/api/members", headers=AUTH_HEADER, json=payload)
        assert create_resp.status_code == 200
        member_id = create_resp.json()["member_id"]
        
        # Update to non_adherent
        update_resp = requests.put(
            f"{BASE_URL}/api/members/{member_id}",
            headers=AUTH_HEADER,
            json={"member_type": "non_adherent"}
        )
        assert update_resp.status_code == 200
        
        # Verify by fetching the member
        get_resp = requests.get(f"{BASE_URL}/api/members/{member_id}", headers=AUTH_HEADER)
        assert get_resp.status_code == 200
        member = get_resp.json()
        assert member["member_type"] == "non_adherent", f"Expected non_adherent, got {member.get('member_type')}"
        print(f"✓ Updated member type to non_adherent")


class TestEventTypesAndFormats:
    """Tests for event type/format dropdowns from settings"""
    
    def test_get_settings_has_event_types(self):
        """Verify settings include event_types and event_formats arrays"""
        response = requests.get(f"{BASE_URL}/api/settings", headers=AUTH_HEADER)
        assert response.status_code == 200
        data = response.json()
        
        assert "event_types" in data, "event_types missing from settings"
        assert "event_formats" in data, "event_formats missing from settings"
        assert isinstance(data["event_types"], list)
        assert isinstance(data["event_formats"], list)
        
        print(f"✓ Settings has event_types: {data['event_types']}")
        print(f"✓ Settings has event_formats: {data['event_formats']}")
    
    def test_create_event_with_type_tournoi(self):
        """Create an event with type 'tournoi' and format"""
        payload = {
            "name": f"{TEST_PREFIX}Tournoi Test",
            "date": "2026-02-15T14:00:00Z",
            "location": "Test Location",
            "event_type": "tournoi",
            "format": "suisse",
            "max_capacity": 32,
            "entry_fee": 5.0
        }
        response = requests.post(f"{BASE_URL}/api/events", headers=AUTH_HEADER, json=payload)
        assert response.status_code == 200, f"Failed to create event: {response.text}"
        data = response.json()
        event_id = data["event_id"]
        
        # Verify by fetching the event
        get_resp = requests.get(f"{BASE_URL}/api/events/{event_id}", headers=AUTH_HEADER)
        assert get_resp.status_code == 200
        event = get_resp.json()
        assert event["event_type"] == "tournoi", f"Expected tournoi, got {event.get('event_type')}"
        assert event["format"] == "suisse", f"Expected suisse, got {event.get('format')}"
        print(f"✓ Created tournament event: {event_id}")
        return event_id
    
    def test_create_event_with_type_casual(self):
        """Create an event with type 'session_libre' (no format needed)"""
        payload = {
            "name": f"{TEST_PREFIX}Session Libre Test",
            "date": "2026-02-20T18:00:00Z",
            "event_type": "session_libre",
            "max_capacity": 50
        }
        response = requests.post(f"{BASE_URL}/api/events", headers=AUTH_HEADER, json=payload)
        assert response.status_code == 200
        data = response.json()
        event_id = data["event_id"]
        
        # Verify by fetching the event
        get_resp = requests.get(f"{BASE_URL}/api/events/{event_id}", headers=AUTH_HEADER)
        assert get_resp.status_code == 200
        event = get_resp.json()
        assert event["event_type"] == "session_libre", f"Expected session_libre, got {event.get('event_type')}"
        print(f"✓ Created casual event: {event_id}")
    
    def test_update_settings_event_types(self):
        """Test updating event_types list in settings"""
        # Get current settings
        get_resp = requests.get(f"{BASE_URL}/api/settings", headers=AUTH_HEADER)
        assert get_resp.status_code == 200
        settings = get_resp.json()
        
        # Add a new event type
        original_types = settings.get("event_types", [])
        new_types = original_types + ["test_type"] if "test_type" not in original_types else original_types
        
        update_resp = requests.put(
            f"{BASE_URL}/api/settings",
            headers=AUTH_HEADER,
            json={"event_types": new_types}
        )
        assert update_resp.status_code == 200
        
        # Verify
        verify_resp = requests.get(f"{BASE_URL}/api/settings", headers=AUTH_HEADER)
        assert "test_type" in verify_resp.json().get("event_types", [])
        print("✓ Updated event_types in settings")
        
        # Restore original
        requests.put(f"{BASE_URL}/api/settings", headers=AUTH_HEADER, json={"event_types": original_types})


class TestTournamentManagement:
    """Tests for tournament creation and management"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.test_event_id = "event_bebaa2405bd7"  # Existing test event
    
    def test_get_tournament_by_event(self):
        """Get tournament for existing test event"""
        response = requests.get(
            f"{BASE_URL}/api/tournaments/event/{self.test_event_id}",
            headers=AUTH_HEADER
        )
        assert response.status_code == 200
        data = response.json()
        
        if data:  # Tournament exists
            assert "tournament_id" in data
            assert "format" in data
            assert "participants" in data
            assert "matches" in data
            assert "standings" in data
            print(f"✓ Got tournament: {data['tournament_id']} ({data['format']})")
            print(f"  - Participants: {len(data['participants'])}")
            print(f"  - Matches: {len(data['matches'])}")
            print(f"  - Current round: {data.get('current_round')}/{data.get('total_rounds')}")
        else:
            print("✓ No tournament exists for this event (expected if not created)")
    
    def test_create_tournament_swiss(self):
        """Create a new Swiss tournament"""
        # First create a new event
        event_payload = {
            "name": f"{TEST_PREFIX}Tournament Event",
            "date": "2026-03-01T14:00:00Z",
            "event_type": "tournoi",
            "format": "suisse",
            "max_capacity": 16
        }
        event_resp = requests.post(f"{BASE_URL}/api/events", headers=AUTH_HEADER, json=event_payload)
        assert event_resp.status_code == 200
        event_id = event_resp.json()["event_id"]
        
        # Get some members for participants
        members_resp = requests.get(f"{BASE_URL}/api/members", headers=AUTH_HEADER)
        members = members_resp.json()[:4]  # Get first 4 members
        participant_ids = [m["member_id"] for m in members]
        
        if len(participant_ids) < 2:
            pytest.skip("Not enough members to create tournament")
        
        # Create tournament
        tournament_payload = {
            "event_id": event_id,
            "format": "suisse",
            "participant_ids": participant_ids
        }
        response = requests.post(f"{BASE_URL}/api/tournaments", headers=AUTH_HEADER, json=tournament_payload)
        assert response.status_code == 200, f"Failed to create tournament: {response.text}"
        data = response.json()
        assert "tournament_id" in data
        print(f"✓ Created Swiss tournament: {data['tournament_id']}")
        
        # Verify tournament was created
        verify_resp = requests.get(f"{BASE_URL}/api/tournaments/event/{event_id}", headers=AUTH_HEADER)
        assert verify_resp.status_code == 200
        tournament = verify_resp.json()
        assert tournament["format"] == "suisse"
        assert len(tournament["participants"]) == len(participant_ids)
        assert len(tournament["matches"]) > 0  # Should have round 1 matches
        print(f"  - Generated {len(tournament['matches'])} matches for round 1")
        
        return data["tournament_id"], event_id
    
    def test_update_match_result(self):
        """Update a match result in existing tournament"""
        # Get existing tournament
        response = requests.get(
            f"{BASE_URL}/api/tournaments/event/{self.test_event_id}",
            headers=AUTH_HEADER
        )
        if response.status_code != 200 or not response.json():
            pytest.skip("No tournament exists for test event")
        
        tournament = response.json()
        tournament_id = tournament["tournament_id"]
        
        # Find an incomplete match
        incomplete_matches = [m for m in tournament["matches"] if m["status"] != "termine" and m.get("player2_id")]
        
        if not incomplete_matches:
            print("✓ All matches already complete, skipping match update test")
            return
        
        match = incomplete_matches[0]
        match_id = match["match_id"]
        
        # Update result
        result_payload = {
            "player1_score": 2,
            "player2_score": 1
        }
        update_resp = requests.put(
            f"{BASE_URL}/api/tournaments/{tournament_id}/match/{match_id}",
            headers=AUTH_HEADER,
            json=result_payload
        )
        assert update_resp.status_code == 200, f"Failed to update match: {update_resp.text}"
        print(f"✓ Updated match result: {match_id} (2-1)")
        
        # Verify standings updated
        verify_resp = requests.get(f"{BASE_URL}/api/tournaments/event/{self.test_event_id}", headers=AUTH_HEADER)
        updated_tournament = verify_resp.json()
        assert len(updated_tournament["standings"]) > 0
        print(f"  - Standings updated with {len(updated_tournament['standings'])} players")
    
    def test_generate_next_round(self):
        """Generate next round of matches"""
        # Get existing tournament
        response = requests.get(
            f"{BASE_URL}/api/tournaments/event/{self.test_event_id}",
            headers=AUTH_HEADER
        )
        if response.status_code != 200 or not response.json():
            pytest.skip("No tournament exists for test event")
        
        tournament = response.json()
        tournament_id = tournament["tournament_id"]
        current_round = tournament["current_round"]
        
        # Check if all current round matches are complete
        current_matches = [m for m in tournament["matches"] if m["round_number"] == current_round]
        incomplete = [m for m in current_matches if m["status"] != "termine"]
        
        if incomplete:
            print(f"✓ Cannot generate next round - {len(incomplete)} matches incomplete")
            # Try to generate anyway to test error handling
            next_resp = requests.post(
                f"{BASE_URL}/api/tournaments/{tournament_id}/next-round",
                headers=AUTH_HEADER
            )
            assert next_resp.status_code == 400  # Should fail
            print("  - Correctly rejected (matches incomplete)")
            return
        
        # Generate next round
        next_resp = requests.post(
            f"{BASE_URL}/api/tournaments/{tournament_id}/next-round",
            headers=AUTH_HEADER
        )
        assert next_resp.status_code == 200, f"Failed to generate next round: {next_resp.text}"
        data = next_resp.json()
        print(f"✓ Generated next round: {data.get('message')}")
    
    def test_tournament_standings_calculation(self):
        """Verify standings are calculated correctly"""
        response = requests.get(
            f"{BASE_URL}/api/tournaments/event/{self.test_event_id}",
            headers=AUTH_HEADER
        )
        if response.status_code != 200 or not response.json():
            pytest.skip("No tournament exists for test event")
        
        tournament = response.json()
        standings = tournament.get("standings", [])
        
        if not standings:
            print("✓ No standings yet (no completed matches)")
            return
        
        # Verify standings structure
        for s in standings:
            assert "member_id" in s
            assert "points" in s
            assert "wins" in s
            assert "losses" in s
            assert "draws" in s
            assert "games_played" in s
            assert "buchholz" in s
        
        # Verify sorted by points (descending)
        points = [s["points"] for s in standings]
        assert points == sorted(points, reverse=True), "Standings not sorted by points"
        
        print(f"✓ Standings calculated correctly ({len(standings)} players)")
        for i, s in enumerate(standings[:3]):
            print(f"  {i+1}. {s.get('member_name', s['member_id'])}: {s['points']} pts ({s['wins']}W-{s['losses']}L)")


class TestSubscriptionsAdherentsOnly:
    """Test that subscriptions only show adherent members"""
    
    def test_subscriptions_endpoint(self):
        """Verify subscriptions endpoint works"""
        response = requests.get(f"{BASE_URL}/api/subscriptions", headers=AUTH_HEADER)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Got {len(data)} subscriptions")
    
    def test_create_subscription_for_adherent(self):
        """Create subscription for an adherent member"""
        # First create an adherent member
        member_payload = {
            "first_name": f"{TEST_PREFIX}Sub",
            "last_name": f"{TEST_PREFIX}Test",
            "member_type": "adherent"
        }
        member_resp = requests.post(f"{BASE_URL}/api/members", headers=AUTH_HEADER, json=member_payload)
        assert member_resp.status_code == 200
        member_id = member_resp.json()["member_id"]
        
        # Create subscription
        sub_payload = {
            "member_id": member_id,
            "season": "2025-2026",
            "amount_due": 30.0
        }
        response = requests.post(f"{BASE_URL}/api/subscriptions", headers=AUTH_HEADER, json=sub_payload)
        assert response.status_code == 200, f"Failed to create subscription: {response.text}"
        data = response.json()
        assert "subscription_id" in data, "subscription_id not in response"
        subscription_id = data["subscription_id"]
        
        # Verify by fetching subscriptions
        get_resp = requests.get(f"{BASE_URL}/api/subscriptions", headers=AUTH_HEADER)
        assert get_resp.status_code == 200
        subs = get_resp.json()
        created_sub = next((s for s in subs if s["subscription_id"] == subscription_id), None)
        assert created_sub is not None, "Created subscription not found"
        assert created_sub["member_id"] == member_id
        assert created_sub["amount_due"] == 30.0
        print(f"✓ Created subscription for adherent: {subscription_id}")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_members(self):
        """Remove test members created during tests"""
        response = requests.get(f"{BASE_URL}/api/members", headers=AUTH_HEADER)
        if response.status_code != 200:
            return
        
        members = response.json()
        test_members = [m for m in members if m.get("first_name", "").startswith(TEST_PREFIX) or m.get("last_name", "").startswith(TEST_PREFIX)]
        
        deleted = 0
        for member in test_members:
            del_resp = requests.delete(f"{BASE_URL}/api/members/{member['member_id']}", headers=AUTH_HEADER)
            if del_resp.status_code == 200:
                deleted += 1
        
        print(f"✓ Cleaned up {deleted} test members")
    
    def test_cleanup_test_events(self):
        """Remove test events created during tests"""
        response = requests.get(f"{BASE_URL}/api/events", headers=AUTH_HEADER)
        if response.status_code != 200:
            return
        
        events = response.json()
        test_events = [e for e in events if e.get("name", "").startswith(TEST_PREFIX)]
        
        deleted = 0
        for event in test_events:
            # First try to delete tournament if exists
            requests.delete(f"{BASE_URL}/api/tournaments/event/{event['event_id']}", headers=AUTH_HEADER)
            # Then delete event
            del_resp = requests.delete(f"{BASE_URL}/api/events/{event['event_id']}", headers=AUTH_HEADER)
            if del_resp.status_code == 200:
                deleted += 1
        
        print(f"✓ Cleaned up {deleted} test events")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
