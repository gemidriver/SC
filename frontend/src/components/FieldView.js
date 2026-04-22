import React, { useState } from 'react';
import { getPrimaryPos, getStats, TEAM_STRUCTURE } from '../App';
import './FieldView.css';

// Realistic NRL field coordinates (% from left, % from top)
// Bottom = own try-line / fullback end  Top = attacking end (forwards set)
const POSITION_COORDS = [
  { x: 50,  y: 83 }, // 0  WFB  Fullback       — deep centre
  { x: 88,  y: 57 }, // 1  CTW  Wing (right)    — wide right
  { x: 68,  y: 52 }, // 2  CTW  Centre (right)  — right channel
  { x: 32,  y: 52 }, // 3  CTW  Centre (left)   — left channel
  { x: 12,  y: 57 }, // 4  CTW  Wing (left)     — wide left
  { x: 36,  y: 43 }, // 5  HFB  Five-eighth     — right of ruck
  { x: 64,  y: 43 }, // 6  HFB  Halfback        — left of ruck
  { x: 50,  y: 37 }, // 7  HOK  Hooker          — centre of ruck
  { x: 62,  y: 29 }, // 8  FRF  Prop (right)    — right prop
  { x: 38,  y: 29 }, // 9  FRF  Prop (left)     — left prop
  { x: 76,  y: 22 }, // 10 2RF  2nd Row (right) — right edge
  { x: 24,  y: 22 }, // 11 2RF  2nd Row (left)  — left edge
  { x: 50,  y: 17 }, // 12 2RF  Lock            — behind hooker
  { x: 78,  y: 50 }, // 13 FLX  Flex            — utility, right of halves
];

const POS_COLORS = {
  HFB: '#388bfd', HOK: '#3fb950', CTW: '#e3b341',
  FRF: '#f0883e', '2RF': '#a371f7', WFB: '#39d353', FLB: '#f778ba',
};

function PlayerToken({ player, slot, captainId, vcId, isSelected, isPendingSwap, onSelect }) {
  if (!player) {
    return (
      <div
        className={`player-token empty ${isPendingSwap ? 'swap-target' : ''}`}
        style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
        onClick={() => onSelect(null, slot.idx)}
        title="Empty — click to swap here"
      >
        <div className="token-pos">{TEAM_STRUCTURE[slot.idx]?.label?.slice(0, 3)}</div>
      </div>
    );
  }

  const pos = getPrimaryPos(player);
  const s = getStats(player);
  const color = POS_COLORS[pos] || '#484f58';
  const isCap = player.id === captainId;
  const isVC  = player.id === vcId;
  const pts   = s.lastPoints;

  return (
    <div
      className={`player-token filled ${isSelected ? 'selected' : ''} ${isPendingSwap ? 'swap-target' : ''} ${isCap ? 'is-cap' : ''} ${isVC ? 'is-vc' : ''}`}
      style={{ left: `${slot.x}%`, top: `${slot.y}%`, '--token-color': color }}
      onClick={() => onSelect(player, slot.idx)}
      title={`${player.first_name} ${player.last_name} — ${pos}${isSelected ? ' (selected — click another to swap)' : ''}`}
    >
      {(isCap || isVC) && (
        <div className="token-role">{isCap ? 'C' : 'VC'}</div>
      )}
      <div className="token-initials">
        {(player.first_name?.[0] || '')}{(player.last_name?.[0] || '')}
      </div>
      <div className="token-name">{player.last_name}</div>
      {pts > 0 && <div className="token-pts">{isCap ? Math.round(pts * 2) : isVC ? Math.round(pts * 1.5) : pts}</div>}
    </div>
  );
}

export default function FieldView({ team, structure, captainId, vcId, onSwap }) {
  const [selectedPlayer, setSelectedPlayer] = useState(null);   // for detail card
  const [swapIdx, setSwapIdx] = useState(null);                 // index of slot pending swap
  const [perspective, setPerspective] = useState(true);

  const starters = team.slice(0, 14);
  const bench    = team.slice(14, 18);

  // Handle click on a field token or bench card
  const handleTokenClick = (player, slotIdx) => {
    if (swapIdx === null) {
      // First click — select this slot for swap, also show detail
      setSwapIdx(slotIdx);
      setSelectedPlayer(player);
    } else if (swapIdx === slotIdx) {
      // Clicked same slot — cancel swap
      setSwapIdx(null);
      setSelectedPlayer(null);
    } else {
      // Second click — perform swap
      onSwap(swapIdx, slotIdx);
      setSwapIdx(null);
      setSelectedPlayer(null);
    }
  };

  const sel = swapIdx === null ? selectedPlayer : null; // hide detail card while swapping
  const selStats = sel ? getStats(sel) : null;

  return (
    <div className="field-page">
      <div className="field-toolbar">
        <span className="field-toolbar-title">Field View</span>
        <div className="field-toolbar-right">
          {swapIdx !== null && (
            <span className="swap-hint">Click another player or slot to swap</span>
          )}
          <button
            className={`perspective-toggle ${perspective ? 'active' : ''}`}
            onClick={() => setPerspective(p => !p)}
          >
            {perspective ? '3D View' : '2D View'}
          </button>
          {swapIdx !== null && (
            <button className="cancel-swap-btn" onClick={() => { setSwapIdx(null); setSelectedPlayer(null); }}>
              Cancel
            </button>
          )}
        </div>
      </div>

      <div className="field-outer">
        <div className={`field-scene ${perspective ? 'perspective' : ''}`}>
          <div className="field-surface">
            {/* Field markings */}
            <div className="field-stripe" />
            <div className="field-center-line" />
            <div className="field-ten-line top" />
            <div className="field-ten-line bottom" />
            <div className="field-twenty-line top" />
            <div className="field-twenty-line bottom" />
            <div className="field-in-goal top" />
            <div className="field-in-goal bottom" />
            <div className="field-logo">⬡</div>

            {/* Starter tokens */}
            {starters.map((player, i) => (
              <PlayerToken
                key={i}
                player={player}
                slot={{ x: POSITION_COORDS[i].x, y: POSITION_COORDS[i].y, idx: i }}
                captainId={captainId}
                vcId={vcId}
                isSelected={swapIdx === i}
                isPendingSwap={swapIdx !== null && swapIdx !== i}
                onSelect={handleTokenClick}
              />
            ))}
          </div>
        </div>

        {/* Bench sidebar */}
        <div className="bench-sidebar">
          <div className="bench-sidebar-title">Bench</div>
          {bench.map((player, i) => {
            const slotIdx = 14 + i;
            const slotInfo = structure[slotIdx];
            const pos = player ? getPrimaryPos(player) : null;
            const color = pos ? (POS_COLORS[pos] || '#484f58') : '#484f58';
            const s = player ? getStats(player) : null;
            const isSwapSelected = swapIdx === slotIdx;
            const isSwapTarget = swapIdx !== null && swapIdx !== slotIdx;
            return (
              <div
                key={i}
                className={`bench-card ${player ? 'filled' : 'empty'} ${isSwapSelected ? 'selected' : ''} ${isSwapTarget ? 'swap-target' : ''}`}
                onClick={() => handleTokenClick(player, slotIdx)}
                title={isSwapSelected ? 'Selected — click another to swap' : swapIdx !== null ? 'Click to swap here' : player ? 'Click to select for swap' : 'Empty bench slot'}
              >
                <div className="bench-card-pos" style={{ color }}>{slotInfo?.label}</div>
                {player ? (
                  <>
                    <div className="bench-card-name">{player.first_name} {player.last_name}</div>
                    <div className="bench-card-avg">{s.avg} avg</div>
                  </>
                ) : (
                  <div className="bench-card-empty">Empty</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Player detail card — shown when nothing is pending swap */}
      {sel && selStats && (
        <div className="field-detail-card">
          <button className="field-detail-close" onClick={() => setSelectedPlayer(null)}>×</button>
          <div className="fdc-name">
            {sel.id === captainId && <span className="fdc-badge cap">C</span>}
            {sel.id === vcId && <span className="fdc-badge vc">VC</span>}
            {sel.first_name} {sel.last_name}
          </div>
          <div className="fdc-club">{sel.team?.name || sel.nrl_club}</div>
          <div className="fdc-stats">
            <div className="fdc-stat"><span>Avg</span><strong>{selStats.avg}</strong></div>
            <div className="fdc-stat"><span>Last</span><strong>{selStats.lastPoints || '—'}</strong></div>
            <div className="fdc-stat"><span>Total</span><strong>{selStats.total}</strong></div>
            <div className="fdc-stat"><span>BE</span><strong>{selStats.breakeven || '—'}</strong></div>
          </div>
        </div>
      )}
    </div>
  );
}
