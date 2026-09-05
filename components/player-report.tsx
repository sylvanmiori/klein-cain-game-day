type Player = {
  team: string;
  number: string;
  name: string;
  image: string;
  role: string;
  tag: string;
  rating: string;
  copy: string;
};

function Portrait({ player }: { player: Player }) {
  return <img className="player-photo" src={player.image || './player-placeholder.svg'} alt={`${player.name}, ${player.team} football`} />;
}

function Identity({ player }: { player: Player }) {
  return (
    <div className="player-identity">
      <div className="player-top"><span>{player.team}</span><b>#{player.number}</b></div>
      <h3>{player.name}</h3>
      <p className="role">{player.role}</p>
    </div>
  );
}

function Report({ player }: { player: Player }) {
  return (
    <>
      <div className="rating"><strong>{player.tag}</strong><span>{player.rating}</span></div>
      <p className="player-copy">{player.copy}</p>
    </>
  );
}

export function PlayerReport({ player }: { player: Player }) {
  const teamClass = player.team === 'OAK RIDGE' ? 'red' : '';

  return (
    <>
      <article className={`player-card player-card-desktop ${teamClass}`}>
        <Portrait player={player} />
        <Identity player={player} />
        <Report player={player} />
      </article>
      <details className={`player-card player-card-mobile ${teamClass}`}>
        <summary>
          <Portrait player={player} />
          <Identity player={player} />
            <span className="player-toggle">
              <span className="toggle-closed">Read report</span>
              <span className="toggle-open">Close report</span>
              <svg aria-hidden="true" viewBox="0 0 16 16">
                <path d="m3 6 5 5 5-5" />
              </svg>
            </span>
        </summary>
        <div className="mobile-player-details">
          <Report player={player} />
        </div>
      </details>
    </>
  );
}
