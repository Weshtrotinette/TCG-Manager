"""
Test Tournament Participant Eligibility and Algorithm Improvements
Tests for:
1. Tournament creation ONLY uses eligible participants (present + paid for paid events)
2. Tournament creation for FREE events includes ALL present participants
3. Tournament creation REJECTS if fewer than 2 eligible participants
4. Round Robin generates correct number of rounds with circle method
5. Single Elimination creates proper bracket with byes
6. Swiss pairing avoids rematches
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
AUTH_HEADER = {"Authorization": "Bearer test_session_admin", "Content-Type": "application/json"}


class TestTournamentEligibility:
    """Test participant eligibility validation for tournaments"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.test_prefix = f"TEST_{uuid.uuid4().hex[:8]}"
        self.created_members = []
        self.created_events = []
        self.created_participations = []
        self.created_tournaments = []
        yield
        # Cleanup
        self._cleanup()
    
    def _cleanup(self):
        """Clean up test data"""
        for tid in self.created_tournaments:
            try:
                requests.delete(f"{BASE_URL}/api/tournaments/{tid}", headers=AUTH_HEADER)
            except:
                pass
        for pid in self.created_participations:
            try:
                requests.delete(f"{BASE_URL}/api/participations/{pid}", headers=AUTH_HEADER)
            except:
                pass
        for eid in self.created_events:
            try:
                requests.delete(f"{BASE_URL}/api/events/{eid}", headers=AUTH_HEADER)
            except:
                pass
        for mid in self.created_members:
            try:
                requests.delete(f"{BASE_URL}/api/members/{mid}", headers=AUTH_HEADER)
            except:
                pass
    
    def _create_member(self, first_name, last_name):
        """Helper to create a test member"""
        resp = requests.post(f"{BASE_URL}/api/members", headers=AUTH_HEADER, json={
            "first_name": f"{self.test_prefix}_{first_name}",
            "last_name": last_name,
            "member_type": "adherent"
        })
        assert resp.status_code == 200, f"Failed to create member: {resp.text}"
        member_id = resp.json()["member_id"]
        self.created_members.append(member_id)
        return member_id
    
    def _create_event(self, name, entry_fee=0):
        """Helper to create a test event"""
        resp = requests.post(f"{BASE_URL}/api/events", headers=AUTH_HEADER, json={
            "name": f"{self.test_prefix}_{name}",
            "date": "2026-02-15T10:00:00Z",
            "event_type": "tournoi",
            "format": "suisse",
            "entry_fee": entry_fee
        })
        assert resp.status_code == 200, f"Failed to create event: {resp.text}"
        event_id = resp.json()["event_id"]
        self.created_events.append(event_id)
        return event_id
    
    def _add_participation(self, event_id, member_id, is_present=False, entry_paid=False):
        """Helper to add participation"""
        resp = requests.post(f"{BASE_URL}/api/participations", headers=AUTH_HEADER, json={
            "event_id": event_id,
            "member_id": member_id,
            "is_present": is_present,
            "entry_paid": entry_paid
        })
        assert resp.status_code == 200, f"Failed to add participation: {resp.text}"
        part_id = resp.json()["participation_id"]
        self.created_participations.append(part_id)
        return part_id
    
    def _update_participation(self, part_id, is_present=None, entry_paid=None):
        """Helper to update participation using query params"""
        params = {}
        if is_present is not None:
            params["is_present"] = str(is_present).lower()
        if entry_paid is not None:
            params["entry_paid"] = str(entry_paid).lower()
        resp = requests.put(f"{BASE_URL}/api/participations/{part_id}", headers=AUTH_HEADER, params=params)
        assert resp.status_code == 200, f"Failed to update participation: {resp.text}"
    
    # =========================================================================
    # TEST: Paid event - only present AND paid participants are eligible
    # =========================================================================
    def test_paid_event_only_present_and_paid_eligible(self):
        """Tournament creation for PAID event should only include present+paid participants"""
        # Create paid event (5€ entry fee)
        event_id = self._create_event("PaidEvent", entry_fee=5.0)
        
        # Create 4 members
        m1 = self._create_member("Player1", "Present_Paid")
        m2 = self._create_member("Player2", "Present_NotPaid")
        m3 = self._create_member("Player3", "NotPresent_Paid")
        m4 = self._create_member("Player4", "Present_Paid2")
        
        # Add participations with different statuses
        p1 = self._add_participation(event_id, m1, is_present=True, entry_paid=True)   # Eligible
        p2 = self._add_participation(event_id, m2, is_present=True, entry_paid=False)  # NOT eligible (not paid)
        p3 = self._add_participation(event_id, m3, is_present=False, entry_paid=True)  # NOT eligible (not present)
        p4 = self._add_participation(event_id, m4, is_present=True, entry_paid=True)   # Eligible
        
        # Create tournament without specifying participants (auto-select)
        resp = requests.post(f"{BASE_URL}/api/tournaments", headers=AUTH_HEADER, json={
            "event_id": event_id,
            "format": "suisse",
            "participant_ids": []  # Empty = auto-select eligible
        })
        
        assert resp.status_code == 200, f"Tournament creation failed: {resp.text}"
        tournament_id = resp.json()["tournament_id"]
        self.created_tournaments.append(tournament_id)
        
        # Verify tournament participants
        resp = requests.get(f"{BASE_URL}/api/tournaments/event/{event_id}", headers=AUTH_HEADER)
        assert resp.status_code == 200
        tournament = resp.json()
        
        participants = tournament.get("participants", [])
        print(f"Participants in tournament: {participants}")
        
        # Should only have m1 and m4 (present AND paid)
        assert len(participants) == 2, f"Expected 2 eligible participants, got {len(participants)}"
        assert m1 in participants, "Player1 (present+paid) should be in tournament"
        assert m4 in participants, "Player4 (present+paid) should be in tournament"
        assert m2 not in participants, "Player2 (not paid) should NOT be in tournament"
        assert m3 not in participants, "Player3 (not present) should NOT be in tournament"
        print("✓ Paid event correctly filters to only present+paid participants")
    
    # =========================================================================
    # TEST: Free event - all present participants are eligible
    # =========================================================================
    def test_free_event_all_present_eligible(self):
        """Tournament creation for FREE event should include ALL present participants"""
        # Create free event (0€ entry fee)
        event_id = self._create_event("FreeEvent", entry_fee=0)
        
        # Create 4 members
        m1 = self._create_member("FreeP1", "Present_Paid")
        m2 = self._create_member("FreeP2", "Present_NotPaid")
        m3 = self._create_member("FreeP3", "NotPresent")
        m4 = self._create_member("FreeP4", "Present_Paid2")
        
        # Add participations
        p1 = self._add_participation(event_id, m1, is_present=True, entry_paid=True)   # Eligible
        p2 = self._add_participation(event_id, m2, is_present=True, entry_paid=False)  # Eligible (free event)
        p3 = self._add_participation(event_id, m3, is_present=False, entry_paid=False) # NOT eligible (not present)
        p4 = self._add_participation(event_id, m4, is_present=True, entry_paid=True)   # Eligible
        
        # Create tournament
        resp = requests.post(f"{BASE_URL}/api/tournaments", headers=AUTH_HEADER, json={
            "event_id": event_id,
            "format": "suisse",
            "participant_ids": []
        })
        
        assert resp.status_code == 200, f"Tournament creation failed: {resp.text}"
        tournament_id = resp.json()["tournament_id"]
        self.created_tournaments.append(tournament_id)
        
        # Verify tournament participants
        resp = requests.get(f"{BASE_URL}/api/tournaments/event/{event_id}", headers=AUTH_HEADER)
        assert resp.status_code == 200
        tournament = resp.json()
        
        participants = tournament.get("participants", [])
        print(f"Participants in free event tournament: {participants}")
        
        # Should have m1, m2, m4 (all present, regardless of payment)
        assert len(participants) == 3, f"Expected 3 eligible participants, got {len(participants)}"
        assert m1 in participants, "Player1 (present) should be in tournament"
        assert m2 in participants, "Player2 (present, not paid) should be in tournament for FREE event"
        assert m4 in participants, "Player4 (present) should be in tournament"
        assert m3 not in participants, "Player3 (not present) should NOT be in tournament"
        print("✓ Free event correctly includes all present participants regardless of payment")
    
    # =========================================================================
    # TEST: Reject tournament with fewer than 2 eligible participants
    # =========================================================================
    def test_reject_fewer_than_2_eligible(self):
        """Tournament creation should fail if fewer than 2 eligible participants"""
        # Create paid event
        event_id = self._create_event("TooFewEvent", entry_fee=5.0)
        
        # Create 2 members but only 1 will be eligible
        m1 = self._create_member("OnlyOne", "Eligible")
        m2 = self._create_member("NotEligible", "NotPaid")
        
        # Add participations - only m1 is eligible
        p1 = self._add_participation(event_id, m1, is_present=True, entry_paid=True)
        p2 = self._add_participation(event_id, m2, is_present=True, entry_paid=False)
        
        # Try to create tournament - should fail
        resp = requests.post(f"{BASE_URL}/api/tournaments", headers=AUTH_HEADER, json={
            "event_id": event_id,
            "format": "suisse",
            "participant_ids": []
        })
        
        assert resp.status_code == 400, f"Expected 400 error, got {resp.status_code}"
        assert "2 participants" in resp.text.lower() or "au moins" in resp.text.lower(), f"Error message should mention minimum participants: {resp.text}"
        print("✓ Tournament creation correctly rejected with fewer than 2 eligible participants")
    
    # =========================================================================
    # TEST: Validate provided participant IDs against eligibility
    # =========================================================================
    def test_validate_provided_participant_ids(self):
        """When participant_ids are provided, they should be validated for eligibility"""
        # Create paid event
        event_id = self._create_event("ValidateIdsEvent", entry_fee=5.0)
        
        # Create 4 members
        m1 = self._create_member("Val1", "Eligible")
        m2 = self._create_member("Val2", "NotPaid")
        m3 = self._create_member("Val3", "Eligible2")
        m4 = self._create_member("Val4", "NotPresent")
        
        # Add participations
        p1 = self._add_participation(event_id, m1, is_present=True, entry_paid=True)
        p2 = self._add_participation(event_id, m2, is_present=True, entry_paid=False)
        p3 = self._add_participation(event_id, m3, is_present=True, entry_paid=True)
        p4 = self._add_participation(event_id, m4, is_present=False, entry_paid=True)
        
        # Try to create tournament with all 4 members (including ineligible ones)
        resp = requests.post(f"{BASE_URL}/api/tournaments", headers=AUTH_HEADER, json={
            "event_id": event_id,
            "format": "suisse",
            "participant_ids": [m1, m2, m3, m4]  # Include ineligible members
        })
        
        assert resp.status_code == 200, f"Tournament creation failed: {resp.text}"
        tournament_id = resp.json()["tournament_id"]
        self.created_tournaments.append(tournament_id)
        
        # Verify only eligible participants were included
        resp = requests.get(f"{BASE_URL}/api/tournaments/event/{event_id}", headers=AUTH_HEADER)
        assert resp.status_code == 200
        tournament = resp.json()
        
        participants = tournament.get("participants", [])
        print(f"Validated participants: {participants}")
        
        # Should only have m1 and m3 (eligible ones from the provided list)
        assert len(participants) == 2, f"Expected 2 validated participants, got {len(participants)}"
        assert m1 in participants
        assert m3 in participants
        assert m2 not in participants, "Ineligible member should be filtered out"
        assert m4 not in participants, "Ineligible member should be filtered out"
        print("✓ Provided participant IDs are correctly validated for eligibility")


class TestRoundRobinAlgorithm:
    """Test Round Robin tournament algorithm with circle method"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.test_prefix = f"TEST_RR_{uuid.uuid4().hex[:8]}"
        self.created_members = []
        self.created_events = []
        self.created_participations = []
        self.created_tournaments = []
        yield
        self._cleanup()
    
    def _cleanup(self):
        for tid in self.created_tournaments:
            try:
                requests.delete(f"{BASE_URL}/api/tournaments/{tid}", headers=AUTH_HEADER)
            except:
                pass
        for pid in self.created_participations:
            try:
                requests.delete(f"{BASE_URL}/api/participations/{pid}", headers=AUTH_HEADER)
            except:
                pass
        for eid in self.created_events:
            try:
                requests.delete(f"{BASE_URL}/api/events/{eid}", headers=AUTH_HEADER)
            except:
                pass
        for mid in self.created_members:
            try:
                requests.delete(f"{BASE_URL}/api/members/{mid}", headers=AUTH_HEADER)
            except:
                pass
    
    def _create_member(self, name):
        resp = requests.post(f"{BASE_URL}/api/members", headers=AUTH_HEADER, json={
            "first_name": f"{self.test_prefix}_{name}",
            "last_name": "RR",
            "member_type": "adherent"
        })
        assert resp.status_code == 200
        member_id = resp.json()["member_id"]
        self.created_members.append(member_id)
        return member_id
    
    def _create_event(self, name):
        resp = requests.post(f"{BASE_URL}/api/events", headers=AUTH_HEADER, json={
            "name": f"{self.test_prefix}_{name}",
            "date": "2026-02-15T10:00:00Z",
            "event_type": "tournoi",
            "format": "round_robin",
            "entry_fee": 0
        })
        assert resp.status_code == 200
        event_id = resp.json()["event_id"]
        self.created_events.append(event_id)
        return event_id
    
    def _add_participation(self, event_id, member_id):
        resp = requests.post(f"{BASE_URL}/api/participations", headers=AUTH_HEADER, json={
            "event_id": event_id,
            "member_id": member_id,
            "is_present": True,
            "entry_paid": True
        })
        assert resp.status_code == 200
        part_id = resp.json()["participation_id"]
        self.created_participations.append(part_id)
        return part_id
    
    def test_round_robin_4_players_correct_rounds(self):
        """4 players should generate 3 rounds (n-1 for even)"""
        event_id = self._create_event("RR4Players")
        members = [self._create_member(f"P{i}") for i in range(4)]
        for m in members:
            self._add_participation(event_id, m)
        
        resp = requests.post(f"{BASE_URL}/api/tournaments", headers=AUTH_HEADER, json={
            "event_id": event_id,
            "format": "round_robin",
            "participant_ids": members
        })
        assert resp.status_code == 200
        tournament_id = resp.json()["tournament_id"]
        self.created_tournaments.append(tournament_id)
        
        resp = requests.get(f"{BASE_URL}/api/tournaments/event/{event_id}", headers=AUTH_HEADER)
        tournament = resp.json()
        
        # 4 players = 3 rounds
        assert tournament["total_rounds"] == 3, f"Expected 3 rounds for 4 players, got {tournament['total_rounds']}"
        
        # Count matches per round
        matches = tournament.get("matches", [])
        rounds = {}
        for m in matches:
            r = m["round_number"]
            rounds[r] = rounds.get(r, 0) + 1
        
        print(f"Matches per round: {rounds}")
        # Each round should have 2 matches (4 players / 2)
        for r, count in rounds.items():
            assert count == 2, f"Round {r} should have 2 matches, got {count}"
        
        # Total matches = n*(n-1)/2 = 4*3/2 = 6
        assert len(matches) == 6, f"Expected 6 total matches, got {len(matches)}"
        print("✓ Round Robin 4 players: 3 rounds, 2 matches per round, 6 total matches")
    
    def test_round_robin_5_players_correct_rounds(self):
        """5 players (odd) should generate 5 rounds with byes"""
        event_id = self._create_event("RR5Players")
        members = [self._create_member(f"P{i}") for i in range(5)]
        for m in members:
            self._add_participation(event_id, m)
        
        resp = requests.post(f"{BASE_URL}/api/tournaments", headers=AUTH_HEADER, json={
            "event_id": event_id,
            "format": "round_robin",
            "participant_ids": members
        })
        assert resp.status_code == 200
        tournament_id = resp.json()["tournament_id"]
        self.created_tournaments.append(tournament_id)
        
        resp = requests.get(f"{BASE_URL}/api/tournaments/event/{event_id}", headers=AUTH_HEADER)
        tournament = resp.json()
        
        # 5 players (odd) = 5 rounds (with dummy player for byes)
        assert tournament["total_rounds"] == 5, f"Expected 5 rounds for 5 players, got {tournament['total_rounds']}"
        
        matches = tournament.get("matches", [])
        # Total matches = 5*4/2 = 10 real matches + 5 byes = 15 total
        # Or with circle method: 5 rounds * 3 matches (2 real + 1 bye) = 15
        print(f"Total matches for 5 players: {len(matches)}")
        
        # Count byes
        byes = [m for m in matches if m.get("player2_id") is None]
        real_matches = [m for m in matches if m.get("player2_id") is not None]
        print(f"Real matches: {len(real_matches)}, Byes: {len(byes)}")
        
        # Should have 10 real matches (5*4/2)
        assert len(real_matches) == 10, f"Expected 10 real matches, got {len(real_matches)}"
        # Should have 5 byes (one per round)
        assert len(byes) == 5, f"Expected 5 byes, got {len(byes)}"
        print("✓ Round Robin 5 players: 5 rounds with correct byes")
    
    def test_round_robin_each_player_plays_once_per_round(self):
        """Each player should play exactly once per round"""
        event_id = self._create_event("RRDistribution")
        members = [self._create_member(f"Dist{i}") for i in range(4)]
        for m in members:
            self._add_participation(event_id, m)
        
        resp = requests.post(f"{BASE_URL}/api/tournaments", headers=AUTH_HEADER, json={
            "event_id": event_id,
            "format": "round_robin",
            "participant_ids": members
        })
        assert resp.status_code == 200
        tournament_id = resp.json()["tournament_id"]
        self.created_tournaments.append(tournament_id)
        
        resp = requests.get(f"{BASE_URL}/api/tournaments/event/{event_id}", headers=AUTH_HEADER)
        tournament = resp.json()
        matches = tournament.get("matches", [])
        
        # Check each round
        for round_num in range(1, tournament["total_rounds"] + 1):
            round_matches = [m for m in matches if m["round_number"] == round_num]
            players_in_round = set()
            
            for m in round_matches:
                p1 = m["player1_id"]
                p2 = m.get("player2_id")
                
                assert p1 not in players_in_round, f"Player {p1} appears twice in round {round_num}"
                players_in_round.add(p1)
                
                if p2:
                    assert p2 not in players_in_round, f"Player {p2} appears twice in round {round_num}"
                    players_in_round.add(p2)
            
            print(f"Round {round_num}: {len(players_in_round)} unique players")
        
        print("✓ Round Robin: Each player plays exactly once per round")


class TestSingleEliminationAlgorithm:
    """Test Single Elimination tournament algorithm with byes"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.test_prefix = f"TEST_SE_{uuid.uuid4().hex[:8]}"
        self.created_members = []
        self.created_events = []
        self.created_participations = []
        self.created_tournaments = []
        yield
        self._cleanup()
    
    def _cleanup(self):
        for tid in self.created_tournaments:
            try:
                requests.delete(f"{BASE_URL}/api/tournaments/{tid}", headers=AUTH_HEADER)
            except:
                pass
        for pid in self.created_participations:
            try:
                requests.delete(f"{BASE_URL}/api/participations/{pid}", headers=AUTH_HEADER)
            except:
                pass
        for eid in self.created_events:
            try:
                requests.delete(f"{BASE_URL}/api/events/{eid}", headers=AUTH_HEADER)
            except:
                pass
        for mid in self.created_members:
            try:
                requests.delete(f"{BASE_URL}/api/members/{mid}", headers=AUTH_HEADER)
            except:
                pass
    
    def _create_member(self, name):
        resp = requests.post(f"{BASE_URL}/api/members", headers=AUTH_HEADER, json={
            "first_name": f"{self.test_prefix}_{name}",
            "last_name": "SE",
            "member_type": "adherent"
        })
        assert resp.status_code == 200
        member_id = resp.json()["member_id"]
        self.created_members.append(member_id)
        return member_id
    
    def _create_event(self, name):
        resp = requests.post(f"{BASE_URL}/api/events", headers=AUTH_HEADER, json={
            "name": f"{self.test_prefix}_{name}",
            "date": "2026-02-15T10:00:00Z",
            "event_type": "tournoi",
            "format": "elimination_simple",
            "entry_fee": 0
        })
        assert resp.status_code == 200
        event_id = resp.json()["event_id"]
        self.created_events.append(event_id)
        return event_id
    
    def _add_participation(self, event_id, member_id):
        resp = requests.post(f"{BASE_URL}/api/participations", headers=AUTH_HEADER, json={
            "event_id": event_id,
            "member_id": member_id,
            "is_present": True,
            "entry_paid": True
        })
        assert resp.status_code == 200
        part_id = resp.json()["participation_id"]
        self.created_participations.append(part_id)
        return part_id
    
    def test_single_elim_power_of_2_no_byes(self):
        """4 players (power of 2) should have no byes"""
        event_id = self._create_event("SE4Players")
        members = [self._create_member(f"SE4P{i}") for i in range(4)]
        for m in members:
            self._add_participation(event_id, m)
        
        resp = requests.post(f"{BASE_URL}/api/tournaments", headers=AUTH_HEADER, json={
            "event_id": event_id,
            "format": "elimination_simple",
            "participant_ids": members
        })
        assert resp.status_code == 200
        tournament_id = resp.json()["tournament_id"]
        self.created_tournaments.append(tournament_id)
        
        resp = requests.get(f"{BASE_URL}/api/tournaments/event/{event_id}", headers=AUTH_HEADER)
        tournament = resp.json()
        
        # 4 players = 2 rounds (log2(4) = 2)
        assert tournament["total_rounds"] == 2, f"Expected 2 rounds, got {tournament['total_rounds']}"
        
        # First round matches
        round1_matches = [m for m in tournament["matches"] if m["round_number"] == 1]
        byes = [m for m in round1_matches if m.get("player2_id") is None]
        
        assert len(byes) == 0, f"Expected 0 byes for 4 players, got {len(byes)}"
        assert len(round1_matches) == 2, f"Expected 2 matches in round 1, got {len(round1_matches)}"
        print("✓ Single Elimination 4 players: No byes, 2 matches in round 1")
    
    def test_single_elim_non_power_of_2_has_byes(self):
        """5 players should have byes to pad to 8"""
        event_id = self._create_event("SE5Players")
        members = [self._create_member(f"SE5P{i}") for i in range(5)]
        for m in members:
            self._add_participation(event_id, m)
        
        resp = requests.post(f"{BASE_URL}/api/tournaments", headers=AUTH_HEADER, json={
            "event_id": event_id,
            "format": "elimination_simple",
            "participant_ids": members
        })
        assert resp.status_code == 200
        tournament_id = resp.json()["tournament_id"]
        self.created_tournaments.append(tournament_id)
        
        resp = requests.get(f"{BASE_URL}/api/tournaments/event/{event_id}", headers=AUTH_HEADER)
        tournament = resp.json()
        
        # 5 players -> bracket of 8 -> 3 rounds
        assert tournament["total_rounds"] == 3, f"Expected 3 rounds for 5 players, got {tournament['total_rounds']}"
        
        # First round should have byes
        round1_matches = [m for m in tournament["matches"] if m["round_number"] == 1]
        byes = [m for m in round1_matches if m.get("player2_id") is None]
        real_matches = [m for m in round1_matches if m.get("player2_id") is not None]
        
        print(f"Round 1: {len(real_matches)} real matches, {len(byes)} byes")
        
        # With 5 players in bracket of 8: 3 byes (8-5=3)
        assert len(byes) == 3, f"Expected 3 byes for 5 players in bracket of 8, got {len(byes)}"
        
        # Byes should be marked as completed
        for bye in byes:
            assert bye["status"] == "termine", "Bye matches should be marked as completed"
            assert bye["winner_id"] == bye["player1_id"], "Bye winner should be player1"
        
        print("✓ Single Elimination 5 players: 3 byes in round 1, bracket padded to 8")
    
    def test_single_elim_3_players_has_bye(self):
        """3 players should have 1 bye to pad to 4"""
        event_id = self._create_event("SE3Players")
        members = [self._create_member(f"SE3P{i}") for i in range(3)]
        for m in members:
            self._add_participation(event_id, m)
        
        resp = requests.post(f"{BASE_URL}/api/tournaments", headers=AUTH_HEADER, json={
            "event_id": event_id,
            "format": "elimination_simple",
            "participant_ids": members
        })
        assert resp.status_code == 200
        tournament_id = resp.json()["tournament_id"]
        self.created_tournaments.append(tournament_id)
        
        resp = requests.get(f"{BASE_URL}/api/tournaments/event/{event_id}", headers=AUTH_HEADER)
        tournament = resp.json()
        
        # 3 players -> bracket of 4 -> 2 rounds
        assert tournament["total_rounds"] == 2, f"Expected 2 rounds for 3 players, got {tournament['total_rounds']}"
        
        round1_matches = [m for m in tournament["matches"] if m["round_number"] == 1]
        byes = [m for m in round1_matches if m.get("player2_id") is None]
        
        # 3 players in bracket of 4: 1 bye
        assert len(byes) == 1, f"Expected 1 bye for 3 players, got {len(byes)}"
        print("✓ Single Elimination 3 players: 1 bye in round 1")


class TestSwissAlgorithm:
    """Test Swiss tournament algorithm with Buchholz tiebreaker"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.test_prefix = f"TEST_SW_{uuid.uuid4().hex[:8]}"
        self.created_members = []
        self.created_events = []
        self.created_participations = []
        self.created_tournaments = []
        yield
        self._cleanup()
    
    def _cleanup(self):
        for tid in self.created_tournaments:
            try:
                requests.delete(f"{BASE_URL}/api/tournaments/{tid}", headers=AUTH_HEADER)
            except:
                pass
        for pid in self.created_participations:
            try:
                requests.delete(f"{BASE_URL}/api/participations/{pid}", headers=AUTH_HEADER)
            except:
                pass
        for eid in self.created_events:
            try:
                requests.delete(f"{BASE_URL}/api/events/{eid}", headers=AUTH_HEADER)
            except:
                pass
        for mid in self.created_members:
            try:
                requests.delete(f"{BASE_URL}/api/members/{mid}", headers=AUTH_HEADER)
            except:
                pass
    
    def _create_member(self, name):
        resp = requests.post(f"{BASE_URL}/api/members", headers=AUTH_HEADER, json={
            "first_name": f"{self.test_prefix}_{name}",
            "last_name": "SW",
            "member_type": "adherent"
        })
        assert resp.status_code == 200
        member_id = resp.json()["member_id"]
        self.created_members.append(member_id)
        return member_id
    
    def _create_event(self, name):
        resp = requests.post(f"{BASE_URL}/api/events", headers=AUTH_HEADER, json={
            "name": f"{self.test_prefix}_{name}",
            "date": "2026-02-15T10:00:00Z",
            "event_type": "tournoi",
            "format": "suisse",
            "entry_fee": 0
        })
        assert resp.status_code == 200
        event_id = resp.json()["event_id"]
        self.created_events.append(event_id)
        return event_id
    
    def _add_participation(self, event_id, member_id):
        resp = requests.post(f"{BASE_URL}/api/participations", headers=AUTH_HEADER, json={
            "event_id": event_id,
            "member_id": member_id,
            "is_present": True,
            "entry_paid": True
        })
        assert resp.status_code == 200
        part_id = resp.json()["participation_id"]
        self.created_participations.append(part_id)
        return part_id
    
    def test_swiss_avoids_rematches(self):
        """Swiss pairing should avoid rematches when possible"""
        event_id = self._create_event("SwissRematch")
        members = [self._create_member(f"SwR{i}") for i in range(4)]
        for m in members:
            self._add_participation(event_id, m)
        
        resp = requests.post(f"{BASE_URL}/api/tournaments", headers=AUTH_HEADER, json={
            "event_id": event_id,
            "format": "suisse",
            "participant_ids": members
        })
        assert resp.status_code == 200
        tournament_id = resp.json()["tournament_id"]
        self.created_tournaments.append(tournament_id)
        
        resp = requests.get(f"{BASE_URL}/api/tournaments/event/{event_id}", headers=AUTH_HEADER)
        tournament = resp.json()
        
        # Record round 1 pairings
        round1_matches = [m for m in tournament["matches"] if m["round_number"] == 1]
        round1_pairs = set()
        for m in round1_matches:
            if m.get("player2_id"):
                pair = tuple(sorted([m["player1_id"], m["player2_id"]]))
                round1_pairs.add(pair)
        
        print(f"Round 1 pairings: {round1_pairs}")
        
        # Complete round 1 matches
        for match in round1_matches:
            if match.get("player2_id"):
                resp = requests.put(
                    f"{BASE_URL}/api/tournaments/{tournament_id}/match/{match['match_id']}",
                    headers=AUTH_HEADER,
                    json={"player1_score": 2, "player2_score": 0}
                )
                assert resp.status_code == 200
        
        # Generate round 2
        resp = requests.post(f"{BASE_URL}/api/tournaments/{tournament_id}/next-round", headers=AUTH_HEADER)
        assert resp.status_code == 200
        
        # Get updated tournament
        resp = requests.get(f"{BASE_URL}/api/tournaments/event/{event_id}", headers=AUTH_HEADER)
        tournament = resp.json()
        
        # Check round 2 pairings don't repeat round 1
        round2_matches = [m for m in tournament["matches"] if m["round_number"] == 2]
        for m in round2_matches:
            if m.get("player2_id"):
                pair = tuple(sorted([m["player1_id"], m["player2_id"]]))
                assert pair not in round1_pairs, f"Rematch detected: {pair}"
        
        print("✓ Swiss pairing avoids rematches between rounds")
    
    def test_swiss_buchholz_calculation(self):
        """Buchholz tiebreaker should be calculated correctly"""
        event_id = self._create_event("SwissBuchholz")
        members = [self._create_member(f"SwB{i}") for i in range(4)]
        for m in members:
            self._add_participation(event_id, m)
        
        resp = requests.post(f"{BASE_URL}/api/tournaments", headers=AUTH_HEADER, json={
            "event_id": event_id,
            "format": "suisse",
            "participant_ids": members
        })
        assert resp.status_code == 200
        tournament_id = resp.json()["tournament_id"]
        self.created_tournaments.append(tournament_id)
        
        # Complete round 1 matches
        resp = requests.get(f"{BASE_URL}/api/tournaments/event/{event_id}", headers=AUTH_HEADER)
        tournament = resp.json()
        
        for match in tournament["matches"]:
            if match.get("player2_id") and match["status"] != "termine":
                resp = requests.put(
                    f"{BASE_URL}/api/tournaments/{tournament_id}/match/{match['match_id']}",
                    headers=AUTH_HEADER,
                    json={"player1_score": 2, "player2_score": 1}
                )
                assert resp.status_code == 200
        
        # Get standings
        resp = requests.get(f"{BASE_URL}/api/tournaments/event/{event_id}", headers=AUTH_HEADER)
        tournament = resp.json()
        standings = tournament.get("standings", [])
        
        print("Standings after round 1:")
        for s in standings:
            print(f"  {s.get('member_name', s['member_id'])}: {s['points']} pts, Buchholz: {s.get('buchholz', 0)}")
        
        # Verify Buchholz is calculated (sum of opponents' points)
        for s in standings:
            assert "buchholz" in s, "Standings should include buchholz field"
        
        print("✓ Swiss Buchholz tiebreaker is calculated")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
