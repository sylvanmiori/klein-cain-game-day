// Subtle player-name link used on public baseball tables and roster cards.
// Plain <a> (not next/link): client navigation breaks on the 413 host rewrite.

type Props = {
  playerId?: number | null;
  name: string;
  className?: string;
};

const BASE =
  'text-inherit no-underline decoration-[#12324e]/40 underline-offset-2 transition-[text-decoration-color,color] hover:underline hover:decoration-[#12324e]/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7BAFD4]';

export function PlayerNameLink({ playerId, name, className = '' }: Props) {
  if (playerId == null || !Number.isFinite(playerId) || playerId <= 0) {
    return <span className={className}>{name}</span>;
  }
  // oxlint-disable-next-line next/no-html-link-for-pages
  return (
    <a href={`/baseball/player?id=${playerId}`} className={`${BASE} ${className}`.trim()}>
      {name}
    </a>
  );
}
