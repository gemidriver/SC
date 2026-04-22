import React, { useState, useEffect, useMemo } from 'react';
import { getPrimaryPos, getStats, TEAM_STRUCTURE } from '../App';
import { apiFetch } from '../api';
import './MatchupPage.css';

function calcTeamScore(teamIds, playerMap, captainId, vcId) {
  let total = 0;
  teamIds.slice(0, 13).forEach(id => {
    if (id == null) return;
    const p = playerMap.get(Number(id));
    if (!p) return;
    const pts = getStats(p).lastPoints;
    const mult = id === captainId ? 2 : id === vcId ? 1.5 : 1;
    total += pts * mult;
  });
  return Math.round(total);
}

function TeamColumn({ label, username, teamIds, captainId, vcId, playerMap, isMe }) {
  const score = calcTeamScore(teamIds, playerMap, captainId, vcId);

  return (
    <div className={`matchup-col ${isMe ? 'my-col' : 'opp-col'}`}>
      <div className="matchup-col-header">
        <div className="matchup-col-name">{label}</div>
        {username && <div className="matchup-col-user">@{username}</div>}
        <div className={`matchup-score ${isMe ? 'my-score' : 'opp-score'}`}>{score} pts</div>
      </div>
      <div className="matchup-players">
        {TEAM_STRUCTURE.slice(0, 13).map((slot, i) => {
          const id = teamIds[i];
          const p = id != null ? playerMap.get(Number(id)) : null;
          const s = p ? getStats(p) : null;
          const isCap = id != null && Number(id) === Number(captainId);
          const isVC = id != null && Number(id) === Number(vcId);
          const pts = s ? s.lastPoints : 0;
          const displayPts = isCap ? pts * 2 : isVC ? pts * 1.5 : pts;

          return (
            <div key={i} className="matchup-player-row">
              <span className="mp-label">{slot.label}</span>
              {p ? (
                <>
                  <span className="mp-name">
                    {isCap && <span className="mp-badge cap">C</span>}
                    {isVC && <span className="mp-badge vc">VC</span>}
                    {p.first_name} {p.last_name}
                  </span>
                  <span className={`mp-pts ${isCap ? 'cap-pts' : isVC ? 'vc-pts' : ''}`}>
                    {Math.round(displayPts) || '—'}
                  </span>
                </>
              ) : (
                <span className="mp-empty">—</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function MatchupPage({ players, myTeam, captainId, vcId, user }) {
  const [matchupData, setMatchupData] = useState(null);
  const [oppTeamData, setOppTeamData] = useState(null);
  const [round, setRound] = useState('');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genRound, setGenRound] = useState('');
  const [genMsg, setGenMsg] = useState(null);

  const playerMap = useMemo(() => {
    const m = new Map();
    players.forEach(p => m.set(p.id, p));
    return m;
  }, [players]);

  const myTeamIds = myTeam.map(p => p ? p.id : null);
  const myScore = calcTeamScore(myTeamIds, playerMap, captainId, vcId);

  const fetchMatchup = (r) => {
    setLoading(true);
    setMatchupData(null);
    setOppTeamData(null);
    const qs = r ? `?round=${r}` : '';
    apiFetch(`/api/matchups${qs}`)
      .then(res => res.json())
      .then(data => {
        const m = data.matchups && data.matchups[0];
        setMatchupData(m || null);
        if (m) {
          const oppR = r ? `?round=${r}` : '';
          return apiFetch(`/api/opponent-team${oppR}`).then(res => res.json());
        }
        return null;
      })
      .then(opp => {
        setOppTeamData(opp);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchMatchup(''); }, []); // eslint-disable-line

  const handleGenerate = async () => {
    if (!genRound) return;
    setGenerating(true);
    setGenMsg(null);
    try {
      const res = await apiFetch('/api/matchups/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ round: parseInt(genRound, 10) }),
      });
      const data = await res.json();
      if (res.ok) {
        setGenMsg(`Round ${genRound} matchups created (${data.matchups_created} pairs)`);
        fetchMatchup(genRound);
      } else {
        setGenMsg(data.error || 'Failed');
      }
    } catch {
      setGenMsg('Error generating matchups');
    }
    setGenerating(false);
  };

  const opponent = matchupData
    ? (matchupData.user1 === user.username ? matchupData.user2 : matchupData.user1)
    : null;

  const oppIds = oppTeamData?.team || [];
  const oppCapId = oppTeamData?.captain_id || null;
  const oppVcId = oppTeamData?.vice_captain_id || null;
  const oppScore = calcTeamScore(oppIds, playerMap, oppCapId, oppVcId);

  return (
    <div className="matchup-page">
      <div className="matchup-header">
        <h2 className="matchup-title">Round Matchup</h2>
        <div className="matchup-controls">
          <input
            className="round-input"
            type="number"
            min="1"
            placeholder="Round #"
            value={round}
            onChange={e => setRound(e.target.value)}
          />
          <button className="matchup-btn" onClick={() => fetchMatchup(round)}>
            Load
          </button>
        </div>
      </div>

      {loading && <div className="matchup-loading">Loading matchup…</div>}

      {!loading && !matchupData && (
        <div className="matchup-empty">
          <div className="matchup-empty-icon">⚔️</div>
          <div className="matchup-empty-title">No matchup found for this round</div>
          <div className="matchup-empty-sub">Matchups are generated by the league admin.</div>
        </div>
      )}

      {!loading && matchupData && (
        <div className="matchup-versus">
          <div className="versus-scores">
            <div className={`vs-score ${myScore > oppScore ? 'winning' : myScore < oppScore ? 'losing' : ''}`}>
              {myScore}
            </div>
            <div className="vs-label">vs</div>
            <div className={`vs-score ${oppScore > myScore ? 'winning' : oppScore < myScore ? 'losing' : ''}`}>
              {oppScore}
            </div>
          </div>
          {myScore > oppScore && <div className="vs-result winning-msg">You're winning!</div>}
          {myScore < oppScore && <div className="vs-result losing-msg">You're trailing</div>}
          {myScore === oppScore && myScore > 0 && <div className="vs-result">All square</div>}

          <div className="matchup-cols">
            <TeamColumn
              label="Your Team"
              username={user.username}
              teamIds={myTeamIds}
              captainId={captainId}
              vcId={vcId}
              playerMap={playerMap}
              isMe
            />
            <div className="matchup-divider" />
            <TeamColumn
              label="Opponent"
              username={opponent}
              teamIds={oppIds}
              captainId={oppCapId}
              vcId={oppVcId}
              playerMap={playerMap}
              isMe={false}
            />
          </div>
        </div>
      )}

      <div className="matchup-admin">
        <div className="admin-label">Admin — Generate matchups</div>
        <div className="admin-row">
          <input
            className="round-input"
            type="number"
            min="1"
            placeholder="Round #"
            value={genRound}
            onChange={e => setGenRound(e.target.value)}
          />
          <button
            className="matchup-btn generate-btn"
            onClick={handleGenerate}
            disabled={!genRound || generating}
          >
            {generating ? 'Generating…' : 'Generate Matchups'}
          </button>
        </div>
        {genMsg && <div className="gen-msg">{genMsg}</div>}
      </div>
    </div>
  );
}
