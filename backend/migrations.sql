-- Run these in the Supabase SQL editor (Database > SQL Editor)

-- 1. Add captain/vice-captain columns to teams table
ALTER TABLE teams ADD COLUMN IF NOT EXISTS captain_id INTEGER;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS vice_captain_id INTEGER;

-- 2. Create the matchups table
CREATE TABLE IF NOT EXISTS matchups (
    id SERIAL PRIMARY KEY,
    round INTEGER NOT NULL,
    user1 TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
    user2 TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
    UNIQUE(round, user1),
    UNIQUE(round, user2)
);
