import type { Fact, Team } from '../lib/edition';
import { sitePath } from '../lib/site-path';

type Side = Team & { score?: number | null };

type Props = {
  /** Drives the card styling and whether records or scores are shown. */
  status: 'scheduled' | 'live' | 'final';
  statusLabel: string;
  /** Right-hand slot in the status bar: a date, or the live refresh button. */
  statusDetail?: React.ReactNode;
  dateShort: string;
  kickoff: string;
  venue: string;
  away: Side;
  home: Side;
  /** The school this publication follows; receives the explicit W/L marker. */
  featuredTeamName: string;
  facts: Fact[];
  showLiveDot?: boolean;
};

function TeamBlock({
  team,
  status,
  side,
  result,
  lost,
}: {
  team: Side;
  status: Props['status'];
  side: 'away' | 'home';
  result: 'win' | 'loss' | null;
  lost: boolean;
}) {
  const identity = (
    <div>
      <h2>{team.name}</h2>
      <span>{team.mascot}</span>
      {status === 'scheduled'
        ? <strong>{team.record}</strong>
        : (
          <div className="score-line">
            <b className="team-score">{team.score}</b>
            {result && (
              <i className={`result-mark ${result}`} aria-label={result === 'win' ? 'Win' : 'Loss'} />
            )}
          </div>
        )}
    </div>
  );
  const logo = <img src={sitePath(team.logo)} alt={`${team.name} ${team.mascot} logo`} />;

  return (
    <div className={`team ${side}${lost ? ' is-loser' : ''}`}>
      {side === 'away' ? logo : identity}
      {side === 'away' ? identity : logo}
    </div>
  );
}

export function MatchupCard({
  status,
  statusLabel,
  statusDetail,
  dateShort,
  kickoff,
  venue,
  away,
  home,
  featuredTeamName,
  facts,
  showLiveDot,
}: Props) {
  const isScheduled = status === 'scheduled';
  const decided = status === 'final' && Number.isFinite(away.score) && Number.isFinite(home.score)
    && away.score !== home.score;
  const awayWon = decided && Number(away.score) > Number(home.score);
  const homeWon = decided && Number(home.score) > Number(away.score);
  const resultFor = (team: Side, won: boolean): 'win' | 'loss' | null => {
    if (!decided || team.name !== featuredTeamName) return null;
    return won ? 'win' : 'loss';
  };

  return (
    <div className={`matchup-card ${status}`} aria-label={`${away.name} at ${home.name} matchup`}>
      <div className="score-status">
        {showLiveDot && <span className="live-dot" aria-hidden="true" />}
        <strong>{statusLabel}</strong>
        {statusDetail}
      </div>

      <div className="matchup-teams">
        <TeamBlock team={away} status={status} side="away" result={resultFor(away, awayWon)} lost={decided && !awayWon} />
        <div className="game-time">
          {isScheduled ? (
            <>
              <span>{dateShort}</span>
              <strong>{kickoff}</strong>
            </>
          ) : (
            <strong>{statusLabel}</strong>
          )}
          <small>{venue}</small>
        </div>
        <TeamBlock team={home} status={status} side="home" result={resultFor(home, homeWon)} lost={decided && !homeWon} />
      </div>

      <ul className={`game-facts${isScheduled ? '' : ' final-facts'}`}>
        {facts.map((fact) => (
          <li key={fact.label}>
            <span>{fact.label}</span>
            {fact.href ? (
              <a href={fact.href} target="_blank" rel="noreferrer">
                {fact.value}
              </a>
            ) : (
              <strong>{fact.value}</strong>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
