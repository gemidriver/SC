import React from 'react';
import './Header.css';
import { getAvatarOption, getDisplayName } from '../profileOptions';

export default function Header({
  filledCount,
  totalCost,
  budget,
  user,
  activeView,
  onNavigate,
  onLogout,
}) {
  const remaining = budget - totalCost;
  const pct = Math.min(100, (totalCost / budget) * 100);
  const over = remaining < 0;
  const avatar = user ? getAvatarOption(user.avatarKey) : null;

  const fmtM = (n) => {
    if (n >= 1000000 || n <= -1000000) return `$${(n / 1000000).toFixed(2)}m`;
    return `$${Math.round(n / 1000)}k`;
  };

  return (
    <header className="header">
      <div className="header-brand">
        <span className="header-logo">BJ</span>
        <div>
          <div className="header-title">Gemidriver NRL</div>
          <div className="header-sub">Team Builder 2026</div>
        </div>
      </div>

      <div className="header-stats">
        <div className="hstat">
          <span className="hstat-label">Squad</span>
          <span className="hstat-val">{filledCount}<span className="hstat-max">/18</span></span>
        </div>
        <div className="hstat">
          <span className="hstat-label">Spent</span>
          <span className="hstat-val">{fmtM(totalCost)}</span>
        </div>
        <div className="hstat">
          <span className="hstat-label">Remaining</span>
          <span className={`hstat-val ${over ? 'over' : 'good'}`}>{over ? '-' : ''}{fmtM(Math.abs(remaining))}</span>
        </div>
        <div className="budget-track">
          <div className="budget-fill" style={{ width: `${pct}%`, background: over ? '#f85149' : '#3fb950' }} />
        </div>
      </div>

      {user && (
        <div className="header-user">
          <div className="header-nav">
            <button
              className={`header-nav-btn ${activeView === 'players' ? 'active' : ''}`}
              onClick={() => onNavigate('players')}
              type="button"
            >
              Team
            </button>
            <button
              className={`header-nav-btn ${activeView === 'field' ? 'active' : ''}`}
              onClick={() => onNavigate('field')}
              type="button"
            >
              Field
            </button>
            <button
              className={`header-nav-btn ${activeView === 'matchup' ? 'active' : ''}`}
              onClick={() => onNavigate('matchup')}
              type="button"
            >
              Matchup
            </button>
            <button
              className={`header-nav-btn ${activeView === 'stats' ? 'active' : ''}`}
              onClick={() => onNavigate('stats')}
              type="button"
            >
              Stats
            </button>
            <button
              className={`header-nav-btn ${activeView === 'profile' ? 'active' : ''}`}
              onClick={() => onNavigate('profile')}
              type="button"
            >
              Profile
            </button>
          </div>
          <div className="header-user-badge">
            <div className="header-avatar" style={{ background: avatar.background }}>
              {avatar.mark}
            </div>
            <div className="header-user-copy">
              <span className="header-display-name">{getDisplayName(user)}</span>
              <span className="header-username">@{user.username}</span>
            </div>
          </div>
          <button className="header-logout" onClick={onLogout}>Sign out</button>
        </div>
      )}
    </header>
  );
}
