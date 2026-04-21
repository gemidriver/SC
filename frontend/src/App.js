import React, { useState, useEffect, useMemo, useCallback } from 'react';
import PlayerList from './components/PlayerList';
import TeamPanel from './components/TeamPanel';
import PlayerModal from './components/PlayerModal';
import Header from './components/Header';
import Login from './components/Login';
import { apiFetch } from './api';
import './App.css';

const BUDGET = 6000000;

const TEAM_STRUCTURE = [
  { pos: 'WFB', label: 'Fullback' },
  { pos: 'CTW', label: 'Wing' },
  { pos: 'CTW', label: 'Centre' },
  { pos: 'CTW', label: 'Centre' },
  { pos: 'CTW', label: 'Wing' },
  { pos: 'HFB', label: 'Five-eighth' },
  { pos: 'HFB', label: 'Halfback' },
  { pos: 'HOK', label: 'Hooker' },
  { pos: 'FRF', label: 'Prop' },
  { pos: 'FRF', label: 'Prop' },
  { pos: '2RF', label: '2nd Row' },
  { pos: '2RF', label: '2nd Row' },
  { pos: '2RF', label: 'Lock' },
];

export function getPrimaryPos(p) {
  if (p.positions && p.positions.length > 0) return p.positions[0].position;
  const s = p.player_stats && p.player_stats[0];
  if (s?.position_ranks?.length > 0) return s.position_ranks[0].pos_rank_pos;
  return '?';
}

export function getStats(p) {
  const s = p.player_stats && p.player_stats[0];
  return {
    avg: s ? Math.round(s.avg || 0) : 0,
    avg3: s ? Math.round(s.avg3 || 0) : 0,
    avg5: s ? Math.round(s.avg5 || 0) : 0,
    total: s ? Math.round(s.total_points || 0) : 0,
    played: s ? (s.total_games || 0) : 0,
    price: s ? (s.price || 0) : (p.price || 0),
    priceChange: s ? (s.total_price_change || 0) : 0,
    lastPoints: s ? (s.ppts1 || 0) : 0,
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
  const [myTeam, setMyTeam] = useState(new Array(13).fill(null));
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
        if (!data || !data.team || !data.team.length) return;
        // data.team is array of player IDs (or null slots)
        setPlayers(prev => {
          const idMap = new Map(prev.map(p => [p.id, p]));
          setMyTeam(data.team.map(id => (id != null ? idMap.get(id) || null : null)));
          return prev;
        });
      })
      .catch(e => {
        setError(e.message);
        setLoading(false);
      });
  }, [user]);

  const positions = useMemo(() => {
    const s = new Set(players.map(p => getPrimaryPos(p)));
    return [...s].filter(Boolean).sort();
  }, [players]);

  const nrlTeams = useMemo(() => {
    const s = new Set(players.map(p => p.nrl_club).filter(Boolean));
    return [...s].sort();
  }, [players]);

  const filtered = useMemo(() => {
    let list = players.filter(p => {
      const name = `${p.first_name || ''} ${p.last_name || ''}`.toLowerCase();
      if (search && !name.includes(search.toLowerCase())) return false;
      if (posFilter && getPrimaryPos(p) !== posFilter) return false;
      if (teamFilter && p.nrl_club !== teamFilter) return false;
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
        team[existingIdx] = null;
        return team;
      }

      const pos = getPrimaryPos(player);
      const slotIdx = TEAM_STRUCTURE.findIndex((s, i) => s.pos === pos && !team[i]);
      if (slotIdx !== -1) {
        team[slotIdx] = player;
      } else {
        const anyEmpty = team.findIndex(x => !x);
        if (anyEmpty !== -1) team[anyEmpty] = player;
        else {
          alert('Team is full! Remove a player first.');
          return prev;
        }
      }
      return team;
    });
  }, []);

  const handleRemoveFromSlot = useCallback((slotIdx) => {
    setMyTeam(prev => {
      const team = [...prev];
      team[slotIdx] = null;
      return team;
    });
  }, []);

  const handleSwapSlot = useCallback((slotIdx, player) => {
    setMyTeam(prev => {
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

  const totalCost = useMemo(() =>
    myTeam.filter(Boolean).reduce((s, p) => s + getStats(p).price, 0),
    [myTeam]
  );

  const filledCount = myTeam.filter(Boolean).length;

  const handleLogin = useCallback((username) => {
    setUser(username);
    setMyTeam(new Array(13).fill(null));
    setPlayers([]);
    setLoading(true);
    setError(null);
  }, []);

  const handleLogout = useCallback(() => {
    apiFetch('/api/logout', { method: 'POST' })
      .finally(() => {
        setUser(null);
        setMyTeam(new Array(13).fill(null));
        setPlayers([]);
        setLoading(true);
        setError(null);
      });
  }, []);

  const handleSaveTeam = useCallback(async () => {
    setSaveStatus('saving');
    const teamIds = myTeam.map(p => (p ? p.id : null));
    try {
      const res = await apiFetch('/api/save-team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team: teamIds }),
      });
      setSaveStatus(res.ok ? 'saved' : 'error');
    } catch {
      setSaveStatus('error');
    }
    setTimeout(() => setSaveStatus(null), 2500);
  }, [myTeam]);

  if (authLoading) return null;
  if (!user) return <Login onLogin={handleLogin} />;

  return (
    <div className="app-wrap">
      <Header filledCount={filledCount} totalCost={totalCost} budget={BUDGET} user={user} onLogout={handleLogout} />

      <div className="main-layout">
        <div className="left-panel">
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

        <div className="right-panel">
          <TeamPanel
            team={myTeam}
            structure={TEAM_STRUCTURE}
            budget={BUDGET}
            totalCost={totalCost}
            onRemove={handleRemoveFromSlot}
            onSelect={setSelectedPlayer}
            onSave={handleSaveTeam}
            saveStatus={saveStatus}
          />
        </div>
      </div>

      {selectedPlayer && (
        <PlayerModal
          player={selectedPlayer}
          inTeam={teamPlayerIds.has(selectedPlayer.id)}
          onToggle={handleTogglePlayer}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </div>
  );
}
