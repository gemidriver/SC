import React, { useState, useEffect, useMemo, useCallback } from 'react';
import PlayerList from './components/PlayerList';
import TeamPanel from './components/TeamPanel';
import PlayerModal from './components/PlayerModal';
import Header from './components/Header';
import Login from './components/Login';
import ProfilePage from './components/ProfilePage';
import FieldView from './components/FieldView';
import StatsPage from './components/StatsPage';
import MatchupPage from './components/MatchupPage';
import MembersPage from './components/MembersPage';
import { apiFetch } from './api';
import './App.css';

const BUDGET = 14000000;

// 13 starters + 4 bench + 1 emergency = 18
export const TEAM_STRUCTURE = [
  { pos: 'WFB', label: 'Fullback',    type: 'starter' },
  { pos: 'CTW', label: 'Wing',        type: 'starter' },
  { pos: 'CTW', label: 'Centre',      type: 'starter' },
  { pos: 'CTW', label: 'Centre',      type: 'starter' },
  { pos: 'CTW', label: 'Wing',        type: 'starter' },
  { pos: 'HFB', label: 'Five-eighth', type: 'starter' },
  { pos: 'HFB', label: 'Halfback',    type: 'starter' },
  { pos: 'HOK', label: 'Hooker',      type: 'starter' },
  { pos: 'FRF', label: 'Prop',        type: 'starter' },
  { pos: 'FRF', label: 'Prop',        type: 'starter' },
  { pos: '2RF', label: '2nd Row',     type: 'starter' },
  { pos: '2RF', label: '2nd Row',     type: 'starter' },
  { pos: '2RF', label: 'Lock',        type: 'starter' },
  { pos: null,  label: 'Flex',        type: 'starter' },  // 14th on-field, any position
  { pos: null,  label: 'Reserve 1',   type: 'bench' },
  { pos: null,  label: 'Reserve 2',   type: 'bench' },
  { pos: null,  label: 'Reserve 3',   type: 'bench' },
  { pos: null,  label: 'Reserve 4',   type: 'bench' },
];

/** Returns true when a player's game has started or finished (lock them in). */
export function isPlayerLocked(player) {
  // Lock when played_status.status === 'now' (game in progress)
  return player?.played_status?.status === 'now';
}

export function getPrimaryPos(p) {
  if (p.positions && p.positions.length > 0) return p.positions[0].position;
  const s = p.player_stats && p.player_stats[0];
  if (s?.position_ranks?.length > 0) return s.position_ranks[0].pos_rank_pos;
  return '?';
}

export function getStats(p) {
  const s = p.player_stats && p.player_stats[0];
  const playedStatus = p.played_status?.status || 'pre';
  // livepts = live accumulating score (>0 while status='now'), final score when status='post'
  // points  = LAST round's score (never use for current round)
  // roundPoints: 'now'/'post' → livepts | 'pre' → 0
  const live  = s ? (s.livepts || 0) : 0;
  // 'now'  = game in progress → use livepts (accumulating)
  // 'post' = game finished this round → use livepts (final score for this round)
  // 'pre'  = yet to play → 0
  const round = (playedStatus === 'now' || playedStatus === 'post') ? live : 0;
  const isLive = playedStatus === 'now';
  return {
    avg: s ? Math.round(s.avg || 0) : 0,
    avg3: s ? Math.round(s.avg3 || 0) : 0,
    avg5: s ? Math.round(s.avg5 || 0) : 0,
    total: s ? Math.round(s.total_points || 0) : 0,
    played: s ? (s.total_games || 0) : 0,
    price: s ? (s.price || 0) : (p.price || 0),
    priceChange: s ? (s.total_price_change || 0) : 0,
    lastPoints: round,       // current round completed score
    roundPoints: round,      // alias for clarity
    livePoints: live,        // in-game live score (0 when not playing)
    isLive,                  // true while game is in progress
    hasPlayed: !isLive && round > 0, // game finished this round, score locked
    currentRound: s ? (s.round || 0) : 0,
    owned: s ? (s.owned || 0) : 0,
    breakeven: s ? (s.ppts || 0) : 0,
    mvpValue: s ? Math.round(s.mvp_value || 0) : 0,
    // raw stats
    tries: s ? (s.total_tries || 0) : 0,
    tryAssists: s ? (s.total_try_assists || 0) : 0,
    tackles: s ? (s.total_tackles || 0) : 0,
    errors: s ? (s.total_errors || 0) : 0,
    tackleBreaks: s ? (s.total_tackle_busts || 0) : 0,
    lineBreaks: s ? (s.total_line_breaks || 0) : 0,
    hitups: s ? (s.total_hitups_over_8m || 0) + (s.total_hitups_under_8m || 0) : 0,
    minutesPlayed: s ? (s.total_minutes_played || 0) : 0,
    ptsPerMin: s ? (s.total_points_per_min || 0) : 0,
    // opponent info
    nextOpp: s?.opp?.abbrev || null,
    posRank: s?.position_ranks?.[0]?.pos_rank || null,
    posRankPos: s?.position_ranks?.[0]?.pos_rank_pos || null,
  };
}

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [myTeam, setMyTeam] = useState(new Array(18).fill(null));
  const [captainId, setCaptainId] = useState(null);
  const [vcId, setVcId] = useState(null);
  const [search, setSearch] = useState('');
  const [posFilter, setPosFilter] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [sortCol, setSortCol] = useState('avg');
  const [sortDir, setSortDir] = useState(-1);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [activeTab, setActiveTab] = useState('players');
  const [saveStatus, setSaveStatus] = useState(null); // 'saving' | 'saved' | 'error'

  // Check if already logged in
  useEffect(() => {
    apiFetch('/api/me')
      .then(r => r.json())
      .then(data => {
        setUser(data.user || null);
        setAuthLoading(false);
      })
      .catch(() => setAuthLoading(false));
  }, []);

  // Load players + restore saved team after login
  useEffect(() => {
    if (!user) return;
    apiFetch('/api/players')
      .then(r => {
        if (!r.ok) throw new Error(`Server error: ${r.status}`);
        return r.json();
      })
      .then(data => {
        const list = Array.isArray(data) ? data : (data.players || data.data || []);
        setPlayers(list);
        setLoading(false);
        // Restore saved team
        return apiFetch('/api/my-team');
      })
      .then(r => r && r.json())
      .then(data => {
        if (!data || !data.team) return;
        setCaptainId(data.captain_id || null);
        setVcId(data.vice_captain_id || null);
        if (!data.team.length) return;
        setPlayers(prev => {
          const idMap = new Map(prev.map(p => [p.id, p]));
          // Pad to 18 if older saves had 13 slots
          const slots = [...data.team];
          while (slots.length < 18) slots.push(null);
          setMyTeam(slots.map(id => (id != null ? idMap.get(id) || null : null)));
          return prev;
        });
      })
      .catch(e => {
        setError(e.message);
        setLoading(false);
      });
  }, [user?.username]);

  const positions = useMemo(() => {
    const s = new Set(players.map(p => getPrimaryPos(p)));
    return [...s].filter(Boolean).sort();
  }, [players]);

  const nrlTeams = useMemo(() => {
    const s = new Set(players.map(p => p.team?.abbrev || p.nrl_club).filter(Boolean));
    return [...s].sort();
  }, [players]);

  const filtered = useMemo(() => {
    let list = players.filter(p => {
      const name = `${p.first_name || ''} ${p.last_name || ''}`.toLowerCase();
      if (search && !name.includes(search.toLowerCase())) return false;
      if (posFilter && getPrimaryPos(p) !== posFilter) return false;
      const club = p.team?.abbrev || p.nrl_club;
      if (teamFilter && club !== teamFilter) return false;
      return true;
    });

    list.sort((a, b) => {
      const sa = getStats(a), sb = getStats(b);
      if (sortCol === 'name') {
        const na = (a.last_name || '').toLowerCase();
        const nb = (b.last_name || '').toLowerCase();
        return sortDir * (na < nb ? -1 : na > nb ? 1 : 0);
      }
      const va = sa[sortCol] || 0;
      const vb = sb[sortCol] || 0;
      return sortDir * (va - vb);
    });

    return list;
  }, [players, search, posFilter, teamFilter, sortCol, sortDir]);

  const teamPlayerIds = useMemo(() => new Set(myTeam.filter(Boolean).map(p => p.id)), [myTeam]);

  const handleSort = useCallback((col) => {
    setSortCol(prev => {
      if (prev === col) setSortDir(d => d * -1);
      else setSortDir(-1);
      return col;
    });
  }, []);

  const handleTogglePlayer = useCallback((player) => {
    setMyTeam(prev => {
      const team = [...prev];
      const existingIdx = team.findIndex(p => p && p.id === player.id);

      if (existingIdx !== -1) {
        // Cannot remove if game has started
        if (isPlayerLocked(player)) {
          alert(`${player.first_name} ${player.last_name}'s game has started — players cannot be changed once their round has begun.`);
          return prev;
        }
        team[existingIdx] = null;
        return team;
      }

      const pos = getPrimaryPos(player);
      // Try matching position slot first (starters), then bench, then any empty
      const slotIdx = TEAM_STRUCTURE.findIndex((s, i) => s.pos === pos && !team[i]);
      if (slotIdx !== -1) {
        team[slotIdx] = player;
      } else {
        // Try bench/reserve utility slots (pos: null)
        const utilityIdx = TEAM_STRUCTURE.findIndex((s, i) => s.pos === null && !team[i]);
        if (utilityIdx !== -1) {
          team[utilityIdx] = player;
        } else {
          const anyEmpty = team.findIndex(x => !x);
          if (anyEmpty !== -1) team[anyEmpty] = player;
          else {
            alert('Squad is full (18 players)! Remove a player first.');
            return prev;
          }
        }
      }
      return team;
    });
  }, []);

  const handleRemoveFromSlot = useCallback((slotIdx) => {
    setMyTeam(prev => {
      const player = prev[slotIdx];
      if (player && isPlayerLocked(player)) {
        alert(`${player.first_name} ${player.last_name}'s game has started — players cannot be changed once their round has begun.`);
        return prev;
      }
      const team = [...prev];
      const removedId = team[slotIdx]?.id;
      team[slotIdx] = null;
      // Clear captain/vc if removed
      if (removedId) {
        setCaptainId(c => c === removedId ? null : c);
        setVcId(v => v === removedId ? null : v);
      }
      return team;
    });
  }, []);

  const handleSwapSlot = useCallback((slotIdx, player) => {
    setMyTeam(prev => {
      const occupant = prev[slotIdx];
      if (occupant && isPlayerLocked(occupant)) {
        alert(`${occupant.first_name} ${occupant.last_name}'s game has started — cannot swap this slot.`);
        return prev;
      }
      const team = [...prev];
      const existingIdx = team.findIndex(p => p && p.id === player.id);
      if (existingIdx !== -1) {
        [team[slotIdx], team[existingIdx]] = [team[existingIdx], team[slotIdx]];
      } else {
        team[slotIdx] = player;
      }
      return team;
    });
  }, []);

  const handleSetCaptain = useCallback((playerId) => {
    setCaptainId(prev => {
      if (prev === playerId) return null; // toggle off
      setVcId(v => v === playerId ? null : v); // can't be both
      return playerId;
    });
  }, []);

  const handleSetVC = useCallback((playerId) => {
    setVcId(prev => {
      if (prev === playerId) return null;
      setCaptainId(c => c === playerId ? null : c);
      return playerId;
    });
  }, []);

  // Swap two slots by index — used by FieldView to move starters to/from bench
  const handleSwapSlots = useCallback((idxA, idxB) => {
    setMyTeam(prev => {
      const playerA = prev[idxA];
      const playerB = prev[idxB];
      if (playerA && isPlayerLocked(playerA)) {
        alert(`${playerA.first_name} ${playerA.last_name}'s game has started — cannot swap.`);
        return prev;
      }
      if (playerB && isPlayerLocked(playerB)) {
        alert(`${playerB.first_name} ${playerB.last_name}'s game has started — cannot swap.`);
        return prev;
      }
      const team = [...prev];
      [team[idxA], team[idxB]] = [team[idxB], team[idxA]];
      return team;
    });
  }, []);

  const totalCost = useMemo(() =>
    myTeam.filter(Boolean).reduce((s, p) => s + getStats(p).price, 0),
    [myTeam]
  );

  const filledCount = myTeam.filter(Boolean).length;

  // Round scoring totals for the header stat bar
  const { roundTotal, hasLive, roundNum, playedCount } = useMemo(() => {
    let total = 0;
    let live = false;
    let played = 0;
    let round = 0;
    myTeam.forEach((p, i) => {
      if (!p) return;
      const s = getStats(p);
      const pts = s.roundPoints;
      // Captain/VC multipliers only apply to starters (indices 0–13)
      const isStarter = i < 14;
      const mult = isStarter ? (p.id === captainId ? 2 : p.id === vcId ? 1.5 : 1) : 1;
      total += pts * mult;
      if (s.isLive) live = true;
      if (pts > 0) played++;
      if (s.currentRound > round) round = s.currentRound;
    });
    return { roundTotal: Math.round(total), hasLive: live, roundNum: round || '', playedCount: played };
  }, [myTeam, captainId, vcId]);

  const handleLogin = useCallback((currentUser) => {
    setUser(currentUser);
    setMyTeam(new Array(18).fill(null));
    setCaptainId(null);
    setVcId(null);
    setPlayers([]);
    setLoading(true);
    setError(null);
    setActiveTab('players');
  }, []);

  const handleLogout = useCallback(() => {
    apiFetch('/api/logout', { method: 'POST' })
      .finally(() => {
        setUser(null);
        setMyTeam(new Array(18).fill(null));
        setCaptainId(null);
        setVcId(null);
        setPlayers([]);
        setLoading(true);
        setError(null);
        setActiveTab('players');
      });
  }, []);

  const handleNavigate = useCallback((nextTab) => {
    setActiveTab(nextTab);
    setSelectedPlayer(null);
  }, []);

  const handleSaveProfile = useCallback(async ({ displayName, avatarKey }) => {
    const res = await apiFetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName, avatarKey }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Could not save profile');
    }
    setUser(data.user);
  }, []);

  const handleSaveTeam = useCallback(async () => {
    setSaveStatus('saving');
    const teamIds = myTeam.map(p => (p ? p.id : null));
    try {
      const res = await apiFetch('/api/save-team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team: teamIds, captain_id: captainId, vice_captain_id: vcId }),
      });
      setSaveStatus(res.ok ? 'saved' : 'error');
    } catch {
      setSaveStatus('error');
    }
    setTimeout(() => setSaveStatus(null), 2500);
  }, [myTeam, captainId, vcId]);

  if (authLoading) return null;
  if (!user) return <Login onLogin={handleLogin} />;

  const isPlayersTab = activeTab === 'players';
  const isSquadTab   = activeTab === 'squad';

  return (
    <div className="app-wrap">
      <Header
        filledCount={filledCount}
        totalCost={totalCost}
        budget={BUDGET}
        roundTotal={roundTotal}
        hasLive={hasLive}
        roundNum={roundNum}
        playedCount={playedCount}
        user={user}
        activeView={activeTab}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
      />

      {activeTab === 'profile' ? (
        <div className="profile-layout">
          <ProfilePage user={user} onSave={handleSaveProfile} />
        </div>
      ) : activeTab === 'field' ? (
        <FieldView team={myTeam} structure={TEAM_STRUCTURE} captainId={captainId} vcId={vcId} onSwap={handleSwapSlots} />
      ) : activeTab === 'stats' ? (
        <StatsPage players={players} />
      ) : activeTab === 'matchup' ? (
        <MatchupPage players={players} myTeam={myTeam} captainId={captainId} vcId={vcId} user={user} />
      ) : activeTab === 'members' ? (
        <MembersPage currentUser={user} players={players} />
      ) : (
        <div className="main-layout">
          <div className={`left-panel${isSquadTab ? ' mobile-hidden' : ''}`}>
            <div className="filter-bar">
              <input
                className="search-input"
                placeholder="Search players..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <select className="filter-select" value={posFilter} onChange={e => setPosFilter(e.target.value)}>
                <option value="">All positions</option>
                {positions.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <select className="filter-select" value={teamFilter} onChange={e => setTeamFilter(e.target.value)}>
                <option value="">All clubs</option>
                {nrlTeams.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <span className="player-count">{filtered.length} players</span>
            </div>

            <PlayerList
              players={filtered}
              loading={loading}
              error={error}
              teamPlayerIds={teamPlayerIds}
              remaining={BUDGET - totalCost}
              sortCol={sortCol}
              sortDir={sortDir}
              onSort={handleSort}
              onToggle={handleTogglePlayer}
              onSelect={setSelectedPlayer}
            />
          </div>

          <div className={`right-panel${isSquadTab ? ' mobile-active' : ''}`}>
            <TeamPanel
              team={myTeam}
              structure={TEAM_STRUCTURE}
              budget={BUDGET}
              totalCost={totalCost}
              captainId={captainId}
              vcId={vcId}
              onSetCaptain={handleSetCaptain}
              onSetVC={handleSetVC}
              onRemove={handleRemoveFromSlot}
              onSelect={setSelectedPlayer}
              onSave={handleSaveTeam}
              saveStatus={saveStatus}
            />
          </div>
        </div>
      )}

      {selectedPlayer && (
        <PlayerModal
          player={selectedPlayer}
          inTeam={teamPlayerIds.has(selectedPlayer.id)}
          onToggle={handleTogglePlayer}
          onClose={() => setSelectedPlayer(null)}
        />
      )}

      {/* Mobile bottom navigation */}
      <nav className="mobile-bottom-nav">
        <button className={`mbn-btn${isPlayersTab ? ' active' : ''}`} onClick={() => handleNavigate('players')}>
          <span className="mbn-icon">⚡</span><span className="mbn-label">Players</span>
        </button>
        <button className={`mbn-btn${isSquadTab ? ' active' : ''}`} onClick={() => handleNavigate('squad')}>
          <span className="mbn-icon">👥</span>
          <span className="mbn-label">Squad</span>
          {filledCount > 0 && <span className="mbn-badge">{filledCount}</span>}
        </button>
        <button className={`mbn-btn${activeTab === 'field' ? ' active' : ''}`} onClick={() => handleNavigate('field')}>
          <span className="mbn-icon">🏟</span><span className="mbn-label">Field</span>
        </button>
        <button className={`mbn-btn${activeTab === 'matchup' ? ' active' : ''}`} onClick={() => handleNavigate('matchup')}>
          <span className="mbn-icon">⚔️</span><span className="mbn-label">Matchup</span>
        </button>
        <button className={`mbn-btn${activeTab === 'members' ? ' active' : ''}`} onClick={() => handleNavigate('members')}>
          <span className="mbn-icon">🏆</span><span className="mbn-label">Members</span>
        </button>
        <button className={`mbn-btn${activeTab === 'profile' ? ' active' : ''}`} onClick={() => handleNavigate('profile')}>
          <span className="mbn-icon">👤</span><span className="mbn-label">Profile</span>
        </button>
      </nav>
    </div>
  );
}
