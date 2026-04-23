import React from 'react';
import { getStats, isPlayerLocked } from '../App';
import { fmtPrice } from './PlayerList';
import './TeamPanel.css';

const POS_COLORS = {
  HFB: '#388bfd', HOK: '#3fb950', CTW: '#e3b341',
  FRF: '#f0883e', '2RF': '#a371f7', WFB: '#39d353', FLB: '#f778ba',
};

export default function TeamPanel({ team, structure, budget, totalCost, captainId, vcId, onSetCaptain, onSetVC, onRemove, onSelect, onSave, saveStatus }) {
  const remaining = budget - totalCost;
  const pct = Math.min(100, (totalCost / budget) * 100);
  const over = remaining < 0;
  const filledCount = team.filter(Boolean).length;

  const starters = structure.slice(0, 14);
  const bench = structure.slice(14);

  const avgScore = (() => {
    const filled = team.slice(0, 14).filter(Boolean);
    if (!filled.length) return 0;
    const total = filled.reduce((s, p) => s + getStats(p).avg, 0);
    return Math.round(total / filled.length);
  })();

  const roundPts = (() => {
    let total = 0;
    team.slice(0, 14).forEach(p => {
      if (!p) return;
      const s = getStats(p);
      const pts = s.isLive ? s.livePoints : s.roundPoints;
      const mult = p.id === captainId ? 2 : p.id === vcId ? 1.5 : 1;
      total += pts * mult;
    });
    return Math.round(total);
  })();

  const renderSlot = (slot, i, isStarter) => {
    const p = team[i];
    const pc = POS_COLORS[slot.pos] || '#484f58';
    const s = p ? getStats(p) : null;
    const locked = p ? isPlayerLocked(p) : false;
    const isCap = p && p.id === captainId;
    const isVC = p && p.id === vcId;
    const isBench = slot.type === 'bench' || slot.type === 'reserve';

    return (
      <div key={i} className={`team-slot ${p ? 'filled' : 'empty'} ${isBench ? 'bench-slot' : ''} ${locked ? 'locked' : ''}`}>
        <div className="slot-pos" style={{ color: pc, borderColor: pc + '33' }}>
          {slot.label}
        </div>
        {p ? (
          <div className="slot-info" onClick={() => onSelect(p)}>
            <div className="slot-name">
              {isCap && <span className="role-badge cap">C</span>}
              {isVC && <span className="role-badge vc">VC</span>}
              {p.first_name} {p.last_name}
              {locked && <span className="lock-icon" title="Game in progress — locked">🔒</span>}
            </div>
            <div className="slot-details">
              <span className="slot-club">{p.team?.abbrev || p.nrl_club}</span>
              <span className="slot-price">{fmtPrice(s.price)}</span>
              <span className="slot-avg">{s.avg} avg</span>
              {s.isLive && (
                <span className="slot-pts live" title="Live score">
                  <span className="slot-live-dot" />
                  {isCap ? `${s.livePoints}×2` : isVC ? `${s.livePoints}×1.5` : s.livePoints}
                </span>
              )}
              {!s.isLive && s.roundPoints > 0 && (
                <span className="slot-pts" title="Round score">
                  {isCap ? `${s.roundPoints}×2` : isVC ? `${s.roundPoints}×1.5` : s.roundPoints} pts
                </span>
              )}
              {s.breakeven > 0 && <span className="slot-be" title="Breakeven">BE {s.breakeven}</span>}
            </div>
          </div>
        ) : (
          <div className="slot-empty-label">Empty</div>
        )}
        {p && !locked && (
          <div className="slot-actions">
            {isStarter && (
              <>
                <button
                  className={`role-btn ${isCap ? 'active-cap' : ''}`}
                  onClick={() => onSetCaptain(p.id)}
                  title={isCap ? 'Remove captain' : 'Set captain (2x points)'}
                >C</button>
                <button
                  className={`role-btn ${isVC ? 'active-vc' : ''}`}
                  onClick={() => onSetVC(p.id)}
                  title={isVC ? 'Remove vice captain' : 'Set vice captain (1.5x points)'}
                >VC</button>
              </>
            )}
            <button className="slot-remove" onClick={() => onRemove(i)} title="Remove">×</button>
          </div>
        )}
        {p && locked && (
          <div className="slot-actions" />
        )}
      </div>
    );
  };

  return (
    <div className="team-panel">
      <div className="team-header">
        <span className="team-title">My Squad</span>
        <span className="team-meta">{filledCount}/18 · avg {avgScore || '—'}{roundPts > 0 ? ` · ${roundPts} pts` : ''}</span>
      </div>

      <div className="team-slots">
        <div className="slots-section-label">Starters</div>
        {starters.map((slot, i) => renderSlot(slot, i, true))}
        <div className="slots-section-label bench-label">Bench &amp; Reserves</div>
        {bench.map((slot, i) => renderSlot(slot, 14 + i, false))}
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
          {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved ✓' : saveStatus === 'error' ? 'Error — try again' : 'Save squad'}
        </button>
      </div>
    </div>
  );
}
