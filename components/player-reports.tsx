'use client';

import { Fragment, useId, useState } from 'react';
import type { EditionPlayer } from '../lib/edition';

function Portrait({ player }: { player: EditionPlayer }) {
  return (
    <img
      className="player-photo"
      src={player.image || './player-placeholder.svg'}
      alt={`${player.name}, ${player.team} football`}
    />
  );
}

function Identity({ player }: { player: EditionPlayer }) {
  return (
    <div className="player-identity">
      <div className="player-top">
        <span>{player.team}</span>
        <b>#{player.number}</b>
      </div>
      <h3>{player.name}</h3>
      <p className="role">{player.role}</p>
    </div>
  );
}

function Rating({ player }: { player: EditionPlayer }) {
  return (
    <div className="rating">
      <strong>{player.tag}</strong>
      <span>{player.rating}</span>
    </div>
  );
}

/**
 * Desktop shows every report in full. On a phone each report is shown
 * truncated and expands in place, one at a time, so opening a second report
 * animates the first closed rather than leaving a long scroll behind.
 */
export function PlayerReports({ players }: { players: EditionPlayer[] }) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const idPrefix = useId();

  return (
    <div className="player-grid">
      {players.map((player) => {
        const key = `${player.team}-${player.name}`;
        const isOpen = openKey === key;
        const teamClass = player.team !== 'CAIN' ? 'red' : '';
        const panelId = `${idPrefix}-${key.replace(/\W+/g, '-')}`;

        return (
          <Fragment key={key}>
            <article className={`player-card player-card-desktop ${teamClass}`}>
              <Portrait player={player} />
              <Identity player={player} />
              <Rating player={player} />
              <p className="player-copy">{player.copy}</p>
            </article>

            <article className={`player-card player-card-mobile ${teamClass} ${isOpen ? 'open' : ''}`}>
              <div className="mobile-head">
                <Portrait player={player} />
                <Identity player={player} />
              </div>
              <div className="mobile-report">
                <Rating player={player} />
                <div className="mobile-copy" id={panelId}>
                  <p className="player-copy">{player.copy}</p>
                </div>
                <button
                  type="button"
                  className="player-toggle"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpenKey(isOpen ? null : key)}
                >
                  <span className="sr-only">
                    {isOpen ? 'Collapse' : 'Expand'} the report on {player.name}
                  </span>
                  <svg aria-hidden="true" viewBox="0 0 16 16">
                    <path d="m3 6 5 5 5-5" />
                  </svg>
                </button>
              </div>
            </article>
          </Fragment>
        );
      })}
    </div>
  );
}
