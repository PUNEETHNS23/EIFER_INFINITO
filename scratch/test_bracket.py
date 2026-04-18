import sys
import os

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from main import _generate_bracket, _set_bracket_winner

def test_9_teams():
    print("Testing 9-team bracket...")
    teams = [{"id": i, "name": f"Team {i}"} for i in range(1, 10)]
    bracket = _generate_bracket(teams)
    
    # Round 1 should have 1 match (Seed 8 vs Seed 9)
    print(f"R1 match count: {len(bracket[0])}")
    for m in bracket[0]:
        print(f"  {m['uid']}: {m['teamA']['name']} vs {m['teamB']['name']} -> Next: {m['next_match_uid']}")
    
    # Round 2 should have 4 matches (Quarterfinals)
    print(f"R2 match count: {len(bracket[1])}")
    
    # Verify linking
    playin = bracket[0][0]
    next_uid = playin['next_match_uid']
    next_slot = playin['next_match_slot']
    print(f"Play-in winner goes to {next_uid} slot {next_slot}")
    
    # Set winner for play-in
    winner = {"id": 8, "name": "Team 8"}
    bracket = _set_bracket_winner(bracket, playin['uid'], winner)
    
    # Check if winner appeared in QF
    qf_match = None
    for m in bracket[1]:
        if m['uid'] == next_uid:
            qf_match = m
            break
    print(f"QF match ({next_uid}) team {next_slot}: {qf_match[next_slot]['name']}")

if __name__ == "__main__":
    test_9_teams()
