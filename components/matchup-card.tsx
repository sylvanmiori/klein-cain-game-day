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
  facts: Fact[];
  showLiveDot?: boolean;
};

function TeamBlock({ team, status, side }: { team: Side; status: Props['status']; side: 'away' | 'home' }) {
  const identity = (
    <div>
      <h2>{team.name}</h2>
      <span>{team.mascot}</span>
      {status === 'scheduled' ? <strong>{team.record}</strong> : <b className="team-score">{team.score}</b>}
    </div>
  );
  const logo = <img src={sitePath(team.logo)} alt={`${team.name} ${team.mascot} logo`} />;

  return (
    <div className={`team ${side}`}>
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
  facts,
  showLiveDot,
}: Props) {
  const isScheduled = status === 'scheduled';

  return (
    <div className={`matchup-card ${status}`} aria-label={`${away.name} at ${home.name} matchup`}>
      <div className="score-status">
        {showLiveDot && <span className="live-dot" aria-hidden="true" />}
        <strong>{statusLabel}</strong>
        {statusDetail}
      </div>

      <div className="matchup-teams">
        <TeamBlock team={away} status={status} side="away" />
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
        <TeamBlock team={home} status={status} side="home" />
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
