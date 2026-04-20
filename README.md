# SuperCoach NRL Team Builder

A local web app to browse NRL players and build your SuperCoach team.

## Project Structure

```
supercoach-app/
├── backend/
│   ├── app.py              ← Python Flask proxy server
│   └── requirements.txt
└── frontend/
    ├── public/index.html
    ├── package.json
    └── src/
        ├── App.js
        ├── components/
        │   ├── Header.js
        │   ├── PlayerList.js
        │   ├── TeamPanel.js
        │   └── PlayerModal.js
        └── ...
```

---

## Setup & Running

You need **two terminals** — one for the backend, one for the frontend.

### Terminal 1 — Python Backend

```bash
cd backend

# Create a virtual environment (recommended)
python -m venv venv

# Activate it
# macOS/Linux:
source venv/bin/activate
# Windows:
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start the server
python app.py
```

The backend will run at **http://localhost:5000**

### Terminal 2 — React Frontend

```bash
cd frontend

# Install dependencies (first time only)
npm install

# Start the app
npm start
```

The app will open at **http://localhost:3000**

---

## How It Works

- The React frontend calls `/api/players` 
- The `"proxy": "http://localhost:5000"` in `package.json` forwards that to the Flask backend
- Flask fetches from the SuperCoach API and returns the data

Since the request comes from your machine (not a browser), it bypasses any CORS restrictions.

---

## Features

- **Browse all players** — sorted by avg points, price, total, games played
- **Filter** by position or NRL club, search by name
- **Click any player** to see full detailed stats in a modal
- **Add/remove players** to build your 13-player team
- **Budget tracker** — $6m cap, shows spending in real time
- **Auto-positioning** — players slot into the correct position automatically

---

## Troubleshooting

**"Could not load players" error in the browser:**
- Make sure the Python backend is running (`python app.py`)
- Check http://localhost:5000/health in your browser — should return `{"status": "ok"}`

**npm install fails:**
- Make sure you have Node.js 16+ installed: `node --version`

**Python import errors:**
- Make sure your virtual environment is activated
- Re-run `pip install -r requirements.txt`
