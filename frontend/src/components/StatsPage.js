import React, { useState, useEffect, useMemo } from 'react';
import { getPrimaryPos, getStats } from '../App';
import { apiFetch } from '../api';
import './StatsPage.css';

const POS_COLORS = {
  HFB: '#388bfd', HOK: '#3fb950', CTW: '#e3b341',
  FRF: '#f0883e', '2RF': '#a371f7', WFB: '#39d353', FLB: '#f778ba',
};

export default function StatsPage({ players }) {
  const [ownershipData, setOwnershipData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [posFilter, setPosFilter] = useState('');
  const [sortKey, setSortKey] = useState('ownership');

  useEffect(() => {
    apiFetch('/api/all-teams-stats')
      .then(r => r.json())
      .then(data => {
        setOwnershipData(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const playerMap = useMemo(() => {
    const m = new Map();
    players.forEach(p => m.set(String(p.id), p));
    return m;
  }, [players]);

  const rows = useMemo(() => {
    if (!ownershipData) return [];
    const { total_teams = 0, player_counts = {}, captain_counts = {}, vc_counts = {} } = ownershipData;

    return Object.entries(player_counts)
      .map(([pid, count]) => {
        const p = playerMap.get(pid);
        if (!p) return null;
        const s = getStats(p);
        const pct = total_teams > 0 ? ((count / total_teams) * 100).toFixed(1) : '0.0';
        const capPct = total_teams > 0 && captain_counts[pid]
          ? ((captain_counts[pid] / total_teams) * 100).toFixed(1)
          : null;
        const vcPct = total_teams > 0 && vc_counts[pid]
          ? ((vc_counts[pid] / total_teams) * 100).toFixed(1)
          : null;
        return {
          id: pid,
          player: p,
          count,
          pct: parseFloat(pct),
          capPct: capPct ? parseFloat(capPct) : 0,
          vcPct: vcPct ? parseFloat(vcPct) : 0,
          avg: s.avg,
          price: s.price,
          pos: getPrimaryPos(p),
        };
      })
      .filter(Boolean)
      .filter(r => !posFilter || r.pos === posFilter);
  }, [ownershipData, playerMap, posFilter]);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      if (sortKey === 'ownership') return b.pct - a.pct;
      if (sortKey === 'captain') return b.capPct - a.capPct;
      if (sortKey === 'avg') return b.avg - a.avg;
      return 0;
    });
  }, [rows, sortKey]);

  const positions = useMemo(() => {
    const s = new Set(players.map(p => getPrimaryPos(p)));
    return [...s].filter(Boolean).sort();
  }, [players]);

  if (loading) return <div className="stats-loading">Loading ownership data…</div>;
  if (!ownershipData) return <div className="stats-loading">Could not load stats.</div>;

  const { total_teams = 0 } = ownershipData;

  return (
    <div className="stats-page">
      <div className="stats-header">
        <div>
          <h2 className="stats-title">Player Ownership Stats</h2>
          <p className="stats-sub">Based on {total_teams} registered squad{total_teams !== 1 ? 's' : ''}</p>
        </div>
        <div className="stats-filters">
          <select
            className="stats-select"
            value={posFilter}
            onChange={e => setPosFilter(e.target.value)}
          >
            <option value="">All positions</option>
            {positions.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <div className="stats-sort-btns">
            {[['ownership', 'Ownership'], ['captain', 'Captain %'], ['avg', 'Avg score']].map(([key, label]) => (
              <button
                key={key}
                className={`stats-sort-btn ${sortKey === key ? 'active' : ''}`}
                onClick={() => setSortKey(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="stats-table-wrap">
        <table className="stats-table">
          <thead>
            <tr>
              <th className="st-rank">#</th>
              <th className="st-player">Player</th>
              <th className="st-pos">Pos</th>
              <th className="st-bar">Ownership</th>
              <th className="st-num">%</th>
              <th className="st-cap">Cap %</th>
              <th className="st-vc">VC %</th>
              <th className="st-avg">Avg</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, idx) => {
              const pc = POS_COLORS[row.pos] || '#484f58';
              return (
                <tr key={row.id} className="st-row">
                  <td className="st-rank">{idx + 1}</td>
                  <td className="st-player">
                    {row.player.first_name} {row.player.last_name}
                    <span className="st-club">{row.player.nrl_club || row.player.team?.abbrev}</span>
                  </td>
                  <td className="st-pos">
                    <span className="st-pos-badge" style={{ color: pc, borderColor: pc + '55' }}>{row.pos}</span>
                  </td>
                  <td className="st-bar">
                    <div className="ownership-bar-wrap">
                      <div
                        className="ownership-bar"
                        style={{ width: `${Math.min(100, row.pct)}%`, background: pc }}
                      />
                    </div>
                  </td>
                  <td className="st-num">{row.pct}%</td>
                  <td className="st-cap">{row.capPct > 0 ? `${row.capPct}%` : '—'}</td>
                  <td className="st-vc">{row.vcPct > 0 ? `${row.vcPct}%` : '—'}</td>
                  <td className="st-avg">{row.avg || '—'}</td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr><td colSpan={8} className="st-empty">No data available yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
