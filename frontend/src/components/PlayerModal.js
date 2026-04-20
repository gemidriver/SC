import React, { useEffect } from 'react';
import { getPrimaryPos, getStats } from '../App';
import { fmtPrice } from './PlayerList';
import './PlayerModal.css';

const POS_COLORS = {
  HFB: '#388bfd', HOK: '#3fb950', CTW: '#e3b341',
  FRF: '#f0883e', '2RF': '#a371f7', WFB: '#39d353', FLB: '#f778ba',
};

function StatRow({ label, value, sub, highlight, good, bad }) {
  const cls = highlight ? 'highlight' : good ? 'good' : bad ? 'bad' : '';
  return (
    <div className="stat-row">
      <span className="stat-label">{label}</span>
      <span className={`stat-value ${cls}`}>{value ?? '—'}{sub && <span className="stat-sub"> {sub}</span>}</span>
    </div>
  );
}

export default function PlayerModal({ player: p, inTeam, onToggle, onClose }) {
  const pos = getPrimaryPos(p);
  const s = getStats(p);
  const ps = p.player_stats && p.player_stats[0];
  const pc = POS_COLORS[pos] || '#484f58';
  const initials = `${(p.first_name || '')[0] || ''}${(p.last_name || '')[0] || ''}`.toUpperCase();
  const priceChangeVal = s.priceChange;
  const owned = ps ? (ps.owned * 100).toFixed(1) : null;

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>

        <div className="modal-hero">
          <div className="modal-avatar" style={{ borderColor: pc }}>
            <span style={{ color: pc }}>{initials}</span>
          </div>
          <div className="modal-hero-info">
            <div className="modal-name">{p.first_name} {p.last_name}</div>
            <div className="modal-meta">
              <span className="modal-pos-badge" style={{ color: pc, borderColor: pc + '55' }}>{pos}</span>
              <span className="modal-club">{p.team?.name || p.nrl_club || '—'}</span>
              {p.injury_suspension_status && (
                <span className="modal-inj" title={p.injury_suspension_status_text}>⚠ {p.injury_suspension_status}</span>
              )}
            </div>
            {p.played_status && (
              <div className="modal-status">{p.played_status.display}</div>
            )}
          </div>
        </div>

        <div className="modal-price-row">
          <div className="price-block">
            <div className="price-label">Price</div>
            <div className="price-val" style={{ color: '#3fb950' }}>{fmtPrice(s.price)}</div>
            {priceChangeVal !== 0 && (
              <div className={`price-change-badge ${priceChangeVal > 0 ? 'up' : 'down'}`}>
                {priceChangeVal > 0 ? '▲' : '▼'} {fmtPrice(Math.abs(priceChangeVal))}
              </div>
            )}
          </div>
          <div className="price-block">
            <div className="price-label">Season avg</div>
            <div className="price-val">{s.avg || '—'}</div>
          </div>
          <div className="price-block">
            <div className="price-label">3-round avg</div>
            <div className="price-val">{s.avg3 || '—'}</div>
          </div>
          <div className="price-block">
            <div className="price-label">Last score</div>
            <div className="price-val">{s.lastPoints || '—'}</div>
          </div>
        </div>

        <div className="modal-stats-grid">
          <div className="stats-section">
            <div className="stats-section-title">Form & value</div>
            <StatRow label="Total points" value={s.total} />
            <StatRow label="Games played" value={s.played} />
            <StatRow label="5-round avg" value={s.avg5} />
            <StatRow label="Breakeven" value={s.breakeven} highlight />
            <StatRow label="Ownership" value={owned ? `${owned}%` : null} />
            <StatRow label="Pts / min" value={s.ptsPerMin ? s.ptsPerMin.toFixed(3) : null} />
            <StatRow label="Minutes played" value={s.minutesPlayed} />
            {s.posRank && <StatRow label={`Rank (${s.posRankPos})`} value={`#${s.posRank}`} />}
            {ps?.opp && <StatRow label="Next opp" value={ps.opp.abbrev} />}
            {ps?.oppavg != null && <StatRow label="Opp avg conceded" value={Math.round(ps.oppavg)} />}
          </div>

          <div className="stats-section">
            <div className="stats-section-title">Season stats</div>
            <StatRow label="Tries" value={s.tries} good={s.tries > 3} />
            <StatRow label="Try assists" value={s.tryAssists} />
            <StatRow label="Line breaks" value={s.lineBreaks} />
            <StatRow label="Tackle breaks" value={s.tackleBreaks} />
            <StatRow label="Tackles" value={s.tackles} />
            <StatRow label="Hitups" value={s.hitups} />
            <StatRow label="Errors" value={s.errors < 0 ? s.errors : s.errors} bad={s.errors > 5} />
            {ps?.total_goals > 0 && <StatRow label="Goals" value={ps.total_goals} />}
            {ps?.total_field_goals > 0 && <StatRow label="Field goals" value={ps.total_field_goals} />}
          </div>
        </div>

        {p.notes && p.notes.length > 0 && (
          <div className="modal-notes">
            <div className="stats-section-title">Notes</div>
            {p.notes.map((n, i) => (
              <div key={i} className="note-item">{n.note || n.text || JSON.stringify(n)}</div>
            ))}
          </div>
        )}

        <div className="modal-actions">
          <button
            className={`modal-btn ${inTeam ? 'btn-remove' : 'btn-add'}`}
            onClick={() => { onToggle(p); onClose(); }}
          >
            {inTeam ? '— Remove from team' : '+ Add to team'}
          </button>
          <button className="modal-btn btn-cancel" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
