from flask import Flask, jsonify, request, session
from flask_cors import CORS
import requests
import json
import os
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'sc-dev-key-please-change-in-production')

_allowed_origins = [o.strip() for o in os.environ.get('ALLOWED_ORIGINS', 'http://localhost:3000').split(',')]
CORS(app, supports_credentials=True, origins=_allowed_origins)

BASE_URL = "https://supercoach.heraldsun.com.au/2026/api/nrl/classic/v1"

DATA_FILE = os.path.join(os.path.dirname(__file__), 'data.json')


def load_data():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r') as f:
            return json.load(f)
    return {'users': {}, 'teams': {}}


def save_data(data):
    with open(DATA_FILE, 'w') as f:
        json.dump(data, f, indent=2)


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

    data = load_data()
    if username in data['users']:
        return jsonify({'error': 'Username already taken'}), 409

    data['users'][username] = {'password': generate_password_hash(password)}
    save_data(data)
    session['username'] = username
    return jsonify({'username': username}), 201


@app.route("/api/login", methods=["POST"])
def login():
    body = request.get_json() or {}
    username = (body.get('username') or '').strip().lower()
    password = body.get('password') or ''

    data = load_data()
    user = data['users'].get(username)
    if not user or not check_password_hash(user['password'], password):
        return jsonify({'error': 'Invalid username or password'}), 401

    session['username'] = username
    return jsonify({'username': username})


@app.route("/api/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({'ok': True})


@app.route("/api/me")
def me():
    username = session.get('username')
    return jsonify({'user': username or None})


@app.route("/api/save-team", methods=["POST"])
def save_team():
    username = session.get('username')
    if not username:
        return jsonify({'error': 'Not authenticated'}), 401

    body = request.get_json() or {}
    team = body.get('team', [])  # list of player IDs (int or None)

    data = load_data()
    data['teams'][username] = team
    save_data(data)
    return jsonify({'ok': True})


@app.route("/api/my-team")
def my_team():
    username = session.get('username')
    if not username:
        return jsonify({'error': 'Not authenticated'}), 401

    data = load_data()
    team = data['teams'].get(username, [])
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
