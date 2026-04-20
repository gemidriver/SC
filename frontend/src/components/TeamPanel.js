import React from 'react';
import { getStats } from '../App';
import { fmtPrice } from './PlayerList';
import './TeamPanel.css';

const POS_COLORS = {
  HFB: '#388bfd', HOK: '#3fb950', CTW: '#e3b341',
  FRF: '#f0883e', '2RF': '#a371f7', WFB: '#39d353', FLB: '#f778ba',
};

export default function TeamPanel({ team, structure, budget, totalCost, onRemove, onSelect, onSave, saveStatus }) {
  const remaining = budget - totalCost;
  const pct = Math.min(100, (totalCost / budget) * 100);
  const over = remaining < 0;
  const filledCount = team.filter(Boolean).length;

  const avgScore = (() => {
    const filled = team.filter(Boolean);
    if (!filled.length) return 0;
    const total = filled.reduce((s, p) => s + getStats(p).avg, 0);
    return Math.round(total / filled.length);
  })();

  return (
    <div className="team-panel">
      <div className="team-header">
        <span className="team-title">My Team</span>
        <span className="team-meta">{filledCount}/13 · avg {avgScore || '—'}</span>
      </div>

      <div className="team-slots">
        {structure.map((slot, i) => {
          const p = team[i];
          const pc = POS_COLORS[slot.pos] || '#484f58';
          const s = p ? getStats(p) : null;

          return (
            <div key={i} className={`team-slot ${p ? 'filled' : 'empty'}`}>
              <div className="slot-pos" style={{ color: pc, borderColor: pc + '33' }}>
                {slot.label}
              </div>
              {p ? (
                <div className="slot-info" onClick={() => onSelect(p)}>
                  <div className="slot-name">{p.first_name} {p.last_name}</div>
                  <div className="slot-details">
                    <span className="slot-club">{p.team?.abbrev || p.nrl_club}</span>
                    <span className="slot-price">{fmtPrice(s.price)}</span>
                    <span className="slot-avg">{s.avg} avg</span>
                    {s.breakeven > 0 && <span className="slot-be" title="Breakeven">BE {s.breakeven}</span>}
                  </div>
                </div>
              ) : (
                <div className="slot-empty-label">Empty</div>
              )}
              {p && (
                <button className="slot-remove" onClick={() => onRemove(i)} title="Remove">×</button>
              )}
            </div>
          );
        })}
      </div>

      <div className="team-footer">
        <div className="budget-row">
          <span className="budget-label">Total spent</span>
          <span className="budget-val">{fmtPrice(totalCost)}</span>
        </div>
        <div className="budget-row">
          <span className="budget-label">Remaining</span>
          <span className={`budget-val ${over ? 'over' : 'good'}`}>
            {over ? '-' : ''}{fmtPrice(Math.abs(remaining))}
          </span>
        </div>
        <div className="budget-bar-wrap">
          <div
            className="budget-bar"
            style={{ width: `${pct}%`, background: over ? '#f85149' : '#3fb950' }}
          />
        </div>
        <button
          className={`save-btn ${saveStatus === 'saved' ? 'save-btn-ok' : saveStatus === 'error' ? 'save-btn-err' : ''}`}
          onClick={onSave}
          disabled={saveStatus === 'saving' || filledCount === 0}
        >
          {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved ✓' : saveStatus === 'error' ? 'Error — try again' : 'Save team'}
        </button>
      </div>
    </div>
  );
}
