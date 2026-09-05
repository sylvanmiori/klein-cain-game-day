type Team = {
  name: string;
  mascot: string;
  logo: string;
  record: string;
  score?: number;
};

type Fact = {
  label: string;
  value: string;
  href?: string;
};

type Props = {
  status: 'Final' | 'Preview';
  statusDetail: string;
  venue: string;
  left: Team;
  right: Team;
  facts: Fact[];
};

export function StaticMatchupCard({ status, statusDetail, venue, left, right, facts }: Props) {
  const isFinal = status === 'Final';
  return (
    <div className={`matchup-card ${isFinal ? 'final' : 'scheduled'}`} aria-label={`${left.name} at ${right.name} matchup`}>
      <div className="score-status"><strong>{status}</strong><span>{statusDetail}</span></div>
      <div className="matchup-teams">
        <div className="team away">
          <img src={left.logo} alt={`${left.name} ${left.mascot} logo`} />
          <div><h2>{left.name}</h2><span>{left.mascot}</span>{isFinal ? <b className="team-score">{left.score}</b> : <strong>{left.record}</strong>}</div>
        </div>
        <div className="game-time"><strong>{isFinal ? 'Final' : statusDetail}</strong><small>{venue}</small></div>
        <div className="team home">
          <div><h2>{right.name}</h2><span>{right.mascot}</span>{isFinal ? <b className="team-score">{right.score}</b> : <strong>{right.record}</strong>}</div>
          <img src={right.logo} alt={`${right.name} ${right.mascot} logo`} />
        </div>
      </div>
      <ul className="game-facts">
        {facts.map((fact) => <li key={fact.label}><span>{fact.label}</span>{fact.href ? <a href={fact.href} target="_blank" rel="noreferrer">{fact.value} ↗</a> : <strong>{fact.value}</strong>}</li>)}
      </ul>
    </div>
  );
}
