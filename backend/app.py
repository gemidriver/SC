from flask import Flask, jsonify, request, session
from flask_cors import CORS
import requests
import json
import os
from dotenv import load_dotenv
load_dotenv()
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'sc-dev-key-please-change-in-production')

_allowed_origins = [o.strip() for o in os.environ.get('ALLOWED_ORIGINS', 'http://localhost:3000').split(',')]
CORS(app, supports_credentials=True, origins=_allowed_origins)

BASE_URL = "https://supercoach.heraldsun.com.au/2026/api/nrl/classic/v1"

SUPABASE_URL = os.environ.get('SUPABASE_URL', '').rstrip('/')
SUPABASE_SERVICE_KEY = os.environ.get('SUPABASE_SERVICE_KEY', '')
DEFAULT_AVATAR_KEY = 'captain'
ALLOWED_AVATAR_KEYS = {
    'captain',
    'hooker',
    'fatty',
    'rocket',
    'phantom',
    'volt',
}
MAX_DISPLAY_NAME_LENGTH = 40


def _sb_headers(extra=None):
    h = {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}',
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
    }
    if extra:
        h.update(extra)
    return h


def sb_select(table, params):
    """GET rows matching params (col: value becomes col=eq.value)."""
    qs = {k: f'eq.{v}' for k, v in params.items()}
    r = requests.get(f'{SUPABASE_URL}/rest/v1/{table}', headers=_sb_headers(), params=qs, timeout=10)
    r.raise_for_status()
    return r.json()  # always a list


def sb_insert(table, data):
    """INSERT a row. Returns the inserted row dict or raises on conflict."""
    r = requests.post(f'{SUPABASE_URL}/rest/v1/{table}', headers=_sb_headers(), json=data, timeout=10)
    if r.status_code == 409:
        raise ValueError('conflict')
    r.raise_for_status()
    rows = r.json()
    return rows[0] if rows else None


def sb_upsert(table, data):
    """INSERT or UPDATE (upsert) a row."""
    headers = _sb_headers({'Prefer': 'resolution=merge-duplicates,return=representation'})
    r = requests.post(f'{SUPABASE_URL}/rest/v1/{table}', headers=headers, json=data, timeout=10)
    r.raise_for_status()
    rows = r.json()
    return rows[0] if rows else None


def sb_update(table, data, match):
    """PATCH rows matching match. Returns the updated row dict."""
    qs = {k: f'eq.{v}' for k, v in match.items()}
    r = requests.patch(f'{SUPABASE_URL}/rest/v1/{table}', headers=_sb_headers(), params=qs, json=data, timeout=10)
    r.raise_for_status()
    rows = r.json()
    return rows[0] if rows else None


def normalize_display_name(value, username):
    display_name = (value or '').strip()
    if not display_name:
        return username
    if len(display_name) > MAX_DISPLAY_NAME_LENGTH:
        raise ValueError(f'Display name must be {MAX_DISPLAY_NAME_LENGTH} characters or fewer')
    return display_name


def normalize_avatar_key(value):
    avatar_key = (value or DEFAULT_AVATAR_KEY).strip().lower()
    if avatar_key not in ALLOWED_AVATAR_KEYS:
        raise ValueError('Please choose a valid avatar')
    return avatar_key


def build_user_payload(row):
    username = row['username']
    display_name = (row.get('display_name') or '').strip() or username
    avatar_key = row.get('avatar_key') or DEFAULT_AVATAR_KEY
    if avatar_key not in ALLOWED_AVATAR_KEYS:
        avatar_key = DEFAULT_AVATAR_KEY
    return {
        'username': username,
        'displayName': display_name,
        'avatarKey': avatar_key,
    }


@app.route("/api/register", methods=["POST"])
def register():
    body = request.get_json() or {}
    username = (body.get('username') or '').strip().lower()
    password = body.get('password') or ''

    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400
    if len(username) < 5:
        return jsonify({'error': 'Username must be at least 5 characters'}), 400
    if len(password) < 8:
        return jsonify({'error': 'Password must be at least 8 characters'}), 400

    try:
        display_name = normalize_display_name(body.get('displayName'), username)
        avatar_key = normalize_avatar_key(body.get('avatarKey'))
    except ValueError as e:
        return jsonify({'error': str(e)}), 400

    hashed = generate_password_hash(password)
    try:
        user = sb_insert('users', {
            'username': username,
            'password': hashed,
            'display_name': display_name,
            'avatar_key': avatar_key,
        })
    except ValueError:
        return jsonify({'error': 'Username already taken'}), 409

    session['username'] = username
    payload = build_user_payload(user)
    return jsonify({'username': username, 'user': payload}), 201


@app.route("/api/login", methods=["POST"])
def login():
    body = request.get_json() or {}
    username = (body.get('username') or '').strip().lower()
    password = body.get('password') or ''

    rows = sb_select('users', {'username': username})
    user = rows[0] if rows else None

    if not user or not check_password_hash(user['password'], password):
        return jsonify({'error': 'Invalid username or password'}), 401

    session['username'] = username
    payload = build_user_payload(user)
    return jsonify({'username': username, 'user': payload})


@app.route("/api/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({'ok': True})


@app.route("/api/me")
def me():
    username = session.get('username')
    if not username:
        return jsonify({'user': None})

    rows = sb_select('users', {'username': username})
    user = rows[0] if rows else None

    if not user:
        session.clear()
        return jsonify({'user': None})

    return jsonify({'user': build_user_payload(user)})


@app.route("/api/profile", methods=["POST"])
def update_profile():
    username = session.get('username')
    if not username:
        return jsonify({'error': 'Not authenticated'}), 401

    body = request.get_json() or {}

    try:
        display_name = normalize_display_name(body.get('displayName'), username)
        avatar_key = normalize_avatar_key(body.get('avatarKey'))
    except ValueError as e:
        return jsonify({'error': str(e)}), 400

    user = sb_update('users', {'display_name': display_name, 'avatar_key': avatar_key}, {'username': username})

    if not user:
        session.clear()
        return jsonify({'error': 'User not found'}), 404

    return jsonify({'user': build_user_payload(user)})


@app.route("/api/members")
def get_members():
    """Return all members with their team info and matchup record."""
    if not session.get('username'):
        return jsonify({'error': 'Not authenticated'}), 401

    # Fetch all users — select only known columns (created_at may not exist)
    ur = requests.get(
        f'{SUPABASE_URL}/rest/v1/users',
        headers=_sb_headers(),
        params={'select': 'username,display_name,avatar_key'},
        timeout=10,
    )
    ur.raise_for_status()
    users_list = ur.json()

    # Fetch all teams (squad sizes + captain info for round score calc)
    tr = requests.get(
        f'{SUPABASE_URL}/rest/v1/teams',
        headers=_sb_headers(),
        params={'select': 'username,team,captain_id,vice_captain_id'},
        timeout=10,
    )
    tr.raise_for_status()
    teams_list = tr.json()
    teams_by_user = {t['username']: t for t in teams_list}

    # Fetch all matchups to calculate wins
    try:
        mr = requests.get(
            f'{SUPABASE_URL}/rest/v1/matchups',
            headers=_sb_headers(),
            params={'select': 'user1,user2,winner'},
            timeout=10,
        )
        mr.raise_for_status()
        all_matchups = mr.json()
    except Exception:
        all_matchups = []

    # Tally matchup stats per user
    played = {}
    wins = {}
    for m in all_matchups:
        for u in (m.get('user1'), m.get('user2')):
            if u:
                played[u] = played.get(u, 0) + 1
        w = m.get('winner')
        if w:
            wins[w] = wins.get(w, 0) + 1

    members = []
    for u in users_list:
        uname = u['username']
        team = teams_by_user.get(uname)
        squad = (team.get('team') or []) if team else []
        filled = sum(1 for p in squad if p is not None)
        p = played.get(uname, 0)
        w = wins.get(uname, 0)
        members.append({
            'username': uname,
            'display_name': u.get('display_name') or uname,
            'avatar_key': u.get('avatar_key') or 'captain',
            'squad_size': filled,
            'team_ids': squad,
            'captain_id': team.get('captain_id') if team else None,
            'vice_captain_id': team.get('vice_captain_id') if team else None,
            'matchups_played': p,
            'matchups_won': w,
            'matchups_lost': p - w,
            'win_rate': round(w / p * 100) if p > 0 else 0,
        })

    # Sort by wins desc, then display name
    members.sort(key=lambda m: (-m['matchups_won'], m['display_name'].lower()))
    return jsonify({'members': members})


@app.route("/api/save-team", methods=["POST"])
def save_team():
    username = session.get('username')
    if not username:
        return jsonify({'error': 'Not authenticated'}), 401

    body = request.get_json() or {}
    team = body.get('team', [])          # list of 18 player IDs (int or None)
    captain_id = body.get('captain_id')  # int or None
    vice_captain_id = body.get('vice_captain_id')  # int or None

    sb_upsert('teams', {
        'username': username,
        'team': team,
        'captain_id': captain_id,
        'vice_captain_id': vice_captain_id,
    })
    return jsonify({'ok': True})


@app.route("/api/my-team")
def my_team():
    username = session.get('username')
    if not username:
        return jsonify({'error': 'Not authenticated'}), 401

    rows = sb_select('teams', {'username': username})
    if rows:
        row = rows[0]
        team = row.get('team') or []
        captain_id = row.get('captain_id')
        vice_captain_id = row.get('vice_captain_id')
    else:
        team, captain_id, vice_captain_id = [], None, None
    return jsonify({'team': team, 'captain_id': captain_id, 'vice_captain_id': vice_captain_id})


@app.route("/api/all-teams-stats")
def all_teams_stats():
    """Player ownership counts across all saved teams."""
    if not session.get('username'):
        return jsonify({'error': 'Not authenticated'}), 401

    r = requests.get(
        f'{SUPABASE_URL}/rest/v1/teams',
        headers=_sb_headers(),
        params={'select': 'username,team,captain_id,vice_captain_id'},
        timeout=10,
    )
    r.raise_for_status()
    all_teams = r.json()

    total_teams = len(all_teams)
    player_counts = {}
    captain_counts = {}
    vc_counts = {}

    for t in all_teams:
        for pid in (t.get('team') or []):
            if pid is not None:
                player_counts[str(pid)] = player_counts.get(str(pid), 0) + 1
        cap = t.get('captain_id')
        if cap:
            captain_counts[str(cap)] = captain_counts.get(str(cap), 0) + 1
        vc = t.get('vice_captain_id')
        if vc:
            vc_counts[str(vc)] = vc_counts.get(str(vc), 0) + 1

    return jsonify({
        'total_teams': total_teams,
        'player_counts': player_counts,
        'captain_counts': captain_counts,
        'vc_counts': vc_counts,
    })


@app.route("/api/matchups", methods=["GET"])
def get_matchups():
    """Get matchups for the current user, optionally filtered by round."""
    username = session.get('username')
    if not username:
        return jsonify({'error': 'Not authenticated'}), 401

    round_num = request.args.get('round', type=int)
    params = {'or': f'(user1.eq.{username},user2.eq.{username})', 'select': '*'}
    if round_num:
        params['round'] = f'eq.{round_num}'
    try:
        r = requests.get(f'{SUPABASE_URL}/rest/v1/matchups', headers=_sb_headers(), params=params, timeout=10)
        r.raise_for_status()
        matchups = r.json()
    except Exception:
        matchups = []
    return jsonify({'matchups': matchups})


@app.route("/api/matchups/generate", methods=["POST"])
def generate_matchups():
    """Randomly pair all registered users for a given round."""
    username = session.get('username')
    if not username:
        return jsonify({'error': 'Not authenticated'}), 401

    body = request.get_json() or {}
    round_num = body.get('round')
    if not round_num:
        return jsonify({'error': 'round is required'}), 400

    ur = requests.get(f'{SUPABASE_URL}/rest/v1/users', headers=_sb_headers(), params={'select': 'username'}, timeout=10)
    ur.raise_for_status()
    users = [row['username'] for row in ur.json()]

    import random
    random.shuffle(users)

    matchup_rows = [
        {'round': round_num, 'user1': users[i], 'user2': users[i + 1]}
        for i in range(0, len(users) - 1, 2)
    ]
    if matchup_rows:
        h = _sb_headers({'Prefer': 'resolution=ignore-duplicates,return=representation'})
        mr = requests.post(f'{SUPABASE_URL}/rest/v1/matchups', headers=h, json=matchup_rows, timeout=10)
        mr.raise_for_status()

    return jsonify({'ok': True, 'matchups_created': len(matchup_rows)})


@app.route("/api/opponent-team")
def opponent_team():
    """Return the opponent's saved team for the current user's matchup."""
    username = session.get('username')
    if not username:
        return jsonify({'error': 'Not authenticated'}), 401

    round_num = request.args.get('round', type=int)
    params = {'or': f'(user1.eq.{username},user2.eq.{username})', 'select': '*'}
    if round_num:
        params['round'] = f'eq.{round_num}'
    try:
        r = requests.get(f'{SUPABASE_URL}/rest/v1/matchups', headers=_sb_headers(), params=params, timeout=10)
        r.raise_for_status()
        matchups = r.json()
    except Exception:
        return jsonify({'opponent': None, 'team': [], 'captain_id': None, 'vice_captain_id': None})

    if not matchups:
        return jsonify({'opponent': None, 'team': [], 'captain_id': None, 'vice_captain_id': None})

    m = matchups[0]
    opponent = m['user2'] if m['user1'] == username else m['user1']
    opp_rows = sb_select('teams', {'username': opponent})
    if opp_rows:
        opp = opp_rows[0]
        return jsonify({
            'opponent': opponent,
            'team': opp.get('team') or [],
            'captain_id': opp.get('captain_id'),
            'vice_captain_id': opp.get('vice_captain_id'),
        })
    return jsonify({'opponent': opponent, 'team': [], 'captain_id': None, 'vice_captain_id': None})


@app.route("/api/round-scores")
def round_scores():
    """Proxy SuperCoach live round player scores."""
    round_id = request.args.get('round_id', '1')
    url = f"{BASE_URL}/rounds/{round_id}/player-scores"
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        resp.raise_for_status()
        return jsonify(resp.json())
    except requests.exceptions.RequestException as e:
        return jsonify({"error": str(e)}), 502


HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json",
    "Accept-Language": "en-AU,en;q=0.9",
    "Referer": "https://supercoach.heraldsun.com.au/",
    "Origin": "https://supercoach.heraldsun.com.au",
}


@app.route("/api/players")
def get_players():
    params = request.args.to_dict()
    embed = params.get("embed", "notes,odds,player_stats,positions")

    url = f"{BASE_URL}/players-cf"
    query = {"embed": embed}

    try:
        resp = requests.get(url, params=query, headers=HEADERS, timeout=15)
        resp.raise_for_status()
        return jsonify(resp.json())
    except requests.exceptions.RequestException as e:
        return jsonify({"error": str(e)}), 502


@app.route("/api/player/<int:player_id>")
def get_player(player_id):
    url = f"{BASE_URL}/players/{player_id}"
    query = {"embed": "notes,odds,player_stats,positions"}

    try:
        resp = requests.get(url, params=query, headers=HEADERS, timeout=10)
        resp.raise_for_status()
        return jsonify(resp.json())
    except requests.exceptions.RequestException as e:
        return jsonify({"error": str(e)}), 502


@app.route("/health")
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    print("Starting SuperCoach proxy on http://localhost:5000")
    app.run(debug=True, port=5000)
