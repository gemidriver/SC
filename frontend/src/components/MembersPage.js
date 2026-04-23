import React, { useState, useEffect, useMemo } from 'react';
import { apiFetch } from '../api';
import { getAvatarOption, getDisplayName } from '../profileOptions';
import { getStats } from '../App';
import './MembersPage.css';

function RankBadge({ rank }) {
  if (rank === 1) return <span className="rank-badge gold">🥇 1</span>;
  if (rank === 2) return <span className="rank-badge silver">🥈 2</span>;
  if (rank === 3) return <span className="rank-badge bronze">🥉 3</span>;
  return <span className="rank-badge">{rank}</span>;
}

function WinBar({ won, lost }) {
  const total = won + lost;
  if (total === 0) return <span className="win-bar-none">No matchups</span>;
  const pct = Math.round((won / total) * 100);
  return (
    <div className="win-bar-wrap" title={`${won}W / ${lost}L`}>
      <div className="win-bar-fill" style={{ width: `${pct}%` }} />
      <span className="win-bar-label">{won}W {lost}L</span>
    </div>
  );
}

function calcRoundTotal(member, playersById) {
  const ids = member.team_ids || [];
  const cap = member.captain_id;
  const vc  = member.vice_captain_id;
  let total = 0, hasLive = false;
  ids.forEach((id, i) => {
    if (!id) return;
    const p = playersById[id];
    if (!p) return;
    const s = getStats(p);
    const isStarter = i < 14;
    const mult = isStarter
      ? (id === cap ? 2 : id === vc ? 1.5 : 1)
      : 1;
    total += s.roundPoints * mult;
    if (s.isLive) hasLive = true;
  });
  return { total: Math.round(total), hasLive };
}

export default function MembersPage({ currentUser, players = [] }) {
  const playersById = useMemo(() => {
    const map = {};
    players.forEach(p => { map[p.id] = p; });
    return map;
  }, [players]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('rank'); // rank | name | squad | winrate

  useEffect(() => {
    apiFetch('/api/members')
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setMembers(data.members || []);
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  const filtered = members
    .filter(m =>
      !search ||
      m.display_name.toLowerCase().includes(search.toLowerCase()) ||
      m.username.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (sort === 'name') return a.display_name.localeCompare(b.display_name);
      if (sort === 'squad') return b.squad_size - a.squad_size;
      if (sort === 'winrate') return b.win_rate - a.win_rate;
      return 0; // rank = already sorted server-side by wins
    });

  const joinedDate = (iso) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('en-AU', { month: 'short', year: 'numeric' });
    } catch { return '—'; }
  };

  if (loading) return <div className="members-loading">Loading members…</div>;
  if (error) return <div className="members-loading error">Error: {error}</div>;

  return (
    <div className="members-page">
      <div className="members-header">
        <div>
          <h2 className="members-title">Members</h2>
          <p className="members-sub">{members.length} registered coach{members.length !== 1 ? 'es' : ''}</p>
        </div>
        <div className="members-controls">
          <input
            className="members-search"
            placeholder="Search members…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select className="members-sort" value={sort} onChange={e => setSort(e.target.value)}>
            <option value="rank">Sort: Rank</option>
            <option value="winrate">Sort: Win Rate</option>
            <option value="squad">Sort: Squad Size</option>
            <option value="name">Sort: Name</option>
          </select>
        </div>
      </div>

      <div className="members-list">
        {filtered.length === 0 && (
          <div className="members-empty">No members found.</div>
        )}
        {filtered.map((m, idx) => {
          const rank = members.indexOf(m) + 1; // rank by server-sorted position
          const avatar = getAvatarOption(m.avatar_key);
          const isMe = m.username === currentUser?.username;
          const { total: rndTotal, hasLive: rndLive } = calcRoundTotal(m, playersById);
          return (
            <div key={m.username} className={`member-card ${isMe ? 'is-me' : ''}`}>
              <div className="mc-left">
                <RankBadge rank={rank} />
                <div className="mc-avatar" style={{ background: avatar.background }}>
                  {avatar.mark}
                </div>
                <div className="mc-identity">
                  <div className="mc-name">
                    <span className="mc-name-text">{m.display_name}</span>
                    {isMe && <span className="mc-you">You</span>}
                  </div>
                  <div className="mc-username">@{m.username}</div>
                </div>
              </div>

              <div className="mc-stats">
                {players.length > 0 && (
                  <div className="mc-stat">
                    <span className="mc-stat-label rnd-label">
                      {rndLive && <span className="mc-live-dot" />}RND
                    </span>
                    <span className={`mc-stat-val ${rndLive ? 'live' : rndTotal > 0 ? 'rnd' : ''}`}>{rndTotal > 0 ? rndTotal : '—'}</span>
                  </div>
                )}
                <div className="mc-stat">
                  <span className="mc-stat-label">Squad</span>
                  <span className="mc-stat-val">{m.squad_size}<span className="mc-stat-max">/18</span></span>
                </div>
                <div className="mc-stat">
                  <span className="mc-stat-label">Matchups</span>
                  <span className="mc-stat-val">{m.matchups_played}</span>
                </div>
                <div className="mc-stat">
                  <span className="mc-stat-label">Wins</span>
                  <span className="mc-stat-val wins">{m.matchups_won}</span>
                </div>
                <div className="mc-stat">
                  <span className="mc-stat-label">Win %</span>
                  <span className="mc-stat-val">{m.matchups_played > 0 ? `${m.win_rate}%` : '—'}</span>
                </div>
              </div>

              <div className="mc-winbar">
                <WinBar won={m.matchups_won} lost={m.matchups_lost} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
