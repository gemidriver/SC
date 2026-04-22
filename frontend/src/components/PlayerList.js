import React from 'react';
import { getPrimaryPos, getStats } from '../App';
import './PlayerList.css';

const POS_COLORS = {
  HFB: '#388bfd', HOK: '#3fb950', CTW: '#e3b341',
  FRF: '#f0883e', '2RF': '#a371f7', WFB: '#39d353', FLB: '#f778ba',
};

export function fmtPrice(n) {
  if (!n) return '—';
  if (n >= 1000000) return `$${(n / 1000000).toFixed(2)}m`;
  return `$${Math.round(n / 1000)}k`;
}

function fmtPriceChange(n) {
  if (!n) return null;
  const abs = Math.abs(n);
  const str = abs >= 1000 ? `$${Math.round(abs / 1000)}k` : `$${abs}`;
  return { str, up: n > 0 };
}

const COLS = [
  { key: 'name',        label: 'Player', align: 'left'   },
  { key: 'price',       label: 'Price',  align: 'right'  },
  { key: 'priceChange', label: '±',      align: 'right'  },
  { key: 'avg',         label: 'Avg',    align: 'center' },
  { key: 'avg3',        label: 'Avg3',   align: 'center' },
  { key: 'total',       label: 'Total',  align: 'center' },
  { key: 'played',      label: 'Gms',    align: 'center' },
];

export default function PlayerList({ players, loading, error, teamPlayerIds, remaining, sortCol, sortDir, onSort, onToggle, onSelect }) {
  if (loading) return (
    <div className="pl-state">
      <div className="pl-spinner" />
      <span>Fetching players from SuperCoach...</span>
    </div>
  );

  if (error) return (
    <div className="pl-state pl-error">
      <div className="pl-error-icon">!</div>
      <div className="pl-error-title">Could not load players</div>
      <div className="pl-error-msg">{error}</div>
      <div className="pl-error-hint">Make sure the Python backend is running on port 5000</div>
    </div>
  );

  return (
    <div className="player-list-wrap">
      <div className="pl-header">
        <div className="pl-col pl-pos-col" />
        {COLS.map(c => (
          <div
            key={c.key}
            className={`pl-col pl-col-${c.align} ${sortCol === c.key ? 'sorted' : ''}`}
            onClick={() => onSort(c.key)}
          >
            {c.label}
            {sortCol === c.key && <span className="sort-arrow">{sortDir === -1 ? ' ↓' : ' ↑'}</span>}
          </div>
        ))}
        <div className="pl-col pl-action-col" />
      </div>

      <div className="pl-body">
        {players.length === 0 && (
          <div className="pl-state">No players match your filters</div>
        )}
        {players.map((p, i) => {
          const pos = getPrimaryPos(p);
          const s = getStats(p);
          const inTeam = teamPlayerIds.has(p.id);
          const overBudget = !inTeam && s.price > 0 && s.price > remaining;
          const posColor = POS_COLORS[pos] || '#484f58';
          const pc = fmtPriceChange(s.priceChange);
          const injStatus = p.injury_suspension_status;

          return (
            <div
              key={p.id || i}
              className={`pl-row ${inTeam ? 'in-team' : ''} ${injStatus ? 'injured' : ''} ${overBudget ? 'over-budget' : ''}`}
              onClick={() => onSelect(p)}
            >
              <div className="pl-col pl-pos-col">
                <span className="pos-dot" style={{ background: posColor }} />
                <span className="pos-label" style={{ color: posColor }}>{pos}</span>
              </div>

              <div className="pl-col pl-col-left">
                <div className="pl-name-row">
                  <span className="pl-name">{p.first_name} {p.last_name}</span>
                  {injStatus && <span className="inj-tag" title={p.injury_suspension_status_text}>⚠</span>}
                </div>
                <div className="pl-club">{p.team?.abbrev || p.nrl_club || '—'}{s.nextOpp ? ` · vs ${s.nextOpp}` : ''}</div>
              </div>

              <div className="pl-col pl-col-right">
                <div className="pl-price">{fmtPrice(s.price)}</div>
              </div>

              <div className="pl-col pl-col-right">
                {pc ? (
                  <div className={`pl-price-change ${pc.up ? 'up' : 'down'}`}>
                    {pc.up ? '▲' : '▼'} {pc.str}
                  </div>
                ) : <span className="pl-muted">—</span>}
              </div>

              <div className="pl-col pl-col-center pl-stat pl-avg-main">{s.avg || '—'}</div>
              <div className="pl-col pl-col-center pl-stat">{s.avg3 || '—'}</div>
              <div className="pl-col pl-col-center pl-stat">{s.total || '—'}</div>
              <div className="pl-col pl-col-center pl-stat pl-muted">{s.played || '—'}</div>

              <div className="pl-col pl-action-col">
                <button
                  className={`add-btn ${inTeam ? 'added' : ''} ${overBudget ? 'over-budget' : ''}`}
                  onClick={e => { e.stopPropagation(); if (!overBudget) onToggle(p); }}
                  title={inTeam ? 'Remove from team' : overBudget ? 'Not enough budget' : 'Add to team'}
                  disabled={overBudget}
                >
                  {inTeam ? '✓' : overBudget ? '✕' : '+'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
