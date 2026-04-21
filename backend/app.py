from flask import Flask, jsonify, request, session
from flask_cors import CORS
import requests
import json
import os
import psycopg2
import psycopg2.extras
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'sc-dev-key-please-change-in-production')

_allowed_origins = [o.strip() for o in os.environ.get('ALLOWED_ORIGINS', 'http://localhost:3000').split(',')]
CORS(app, supports_credentials=True, origins=_allowed_origins)

BASE_URL = "https://supercoach.heraldsun.com.au/2026/api/nrl/classic/v1"

DATABASE_URL = os.environ.get('DATABASE_URL')
DEFAULT_AVATAR_KEY = 'captain'
ALLOWED_AVATAR_KEYS = {
    'captain',
    'blitz',
    'lockdown',
    'rocket',
    'phantom',
    'volt',
}
MAX_DISPLAY_NAME_LENGTH = 40


def get_db():
    return psycopg2.connect(DATABASE_URL)


def init_db():
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    username TEXT PRIMARY KEY,
                    password TEXT NOT NULL,
                    display_name TEXT,
                    avatar_key TEXT
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS teams (
                    username TEXT PRIMARY KEY REFERENCES users(username) ON DELETE CASCADE,
                    team JSONB NOT NULL DEFAULT '[]'
                )
            """)
            cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT")
            cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_key TEXT")


if DATABASE_URL:
    init_db()


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
    if len(username) < 3:
        return jsonify({'error': 'Username must be at least 3 characters'}), 400
    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400

    try:
        display_name = normalize_display_name(body.get('displayName'), username)
        avatar_key = normalize_avatar_key(body.get('avatarKey'))
    except ValueError as e:
        return jsonify({'error': str(e)}), 400

    hashed = generate_password_hash(password)
    try:
        with get_db() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    INSERT INTO users (username, password, display_name, avatar_key)
                    VALUES (%s, %s, %s, %s)
                    RETURNING username, display_name, avatar_key
                    """,
                    (username, hashed, display_name, avatar_key)
                )
                user = cur.fetchone()
    except psycopg2.errors.UniqueViolation:
        return jsonify({'error': 'Username already taken'}), 409

    session['username'] = username
    payload = build_user_payload(user)
    return jsonify({'username': username, 'user': payload}), 201


@app.route("/api/login", methods=["POST"])
def login():
    body = request.get_json() or {}
    username = (body.get('username') or '').strip().lower()
    password = body.get('password') or ''

    with get_db() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT username, password, display_name, avatar_key
                FROM users
                WHERE username = %s
                """,
                (username,)
            )
            user = cur.fetchone()

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

    with get_db() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT username, display_name, avatar_key
                FROM users
                WHERE username = %s
                """,
                (username,)
            )
            user = cur.fetchone()

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

    with get_db() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                UPDATE users
                SET display_name = %s, avatar_key = %s
                WHERE username = %s
                RETURNING username, display_name, avatar_key
                """,
                (display_name, avatar_key, username)
            )
            user = cur.fetchone()

    if not user:
        session.clear()
        return jsonify({'error': 'User not found'}), 404

    return jsonify({'user': build_user_payload(user)})


@app.route("/api/save-team", methods=["POST"])
def save_team():
    username = session.get('username')
    if not username:
        return jsonify({'error': 'Not authenticated'}), 401

    body = request.get_json() or {}
    team = body.get('team', [])  # list of player IDs (int or None)

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO teams (username, team) VALUES (%s, %s)
                ON CONFLICT (username) DO UPDATE SET team = EXCLUDED.team
            """, (username, json.dumps(team)))
    return jsonify({'ok': True})


@app.route("/api/my-team")
def my_team():
    username = session.get('username')
    if not username:
        return jsonify({'error': 'Not authenticated'}), 401

    with get_db() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT team FROM teams WHERE username = %s", (username,))
            row = cur.fetchone()

    team = row['team'] if row else []
    return jsonify({'team': team})


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
