import Link from 'next/link';

const LINKS = [
  { href: '/baseball', label: 'Home' },
  { href: '/baseball/schedule', label: 'Schedule' },
  { href: '/baseball/roster', label: 'Roster' },
  { href: '/baseball/stats', label: 'Stats' },
  { href: '/baseball/submit', label: 'Submit' },
];

export function BaseballSubnav() {
  return (
    <nav aria-label="4:13 Baseball sections" className="mt-3 flex flex-wrap gap-2">
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className="rounded-full border border-[#c9dcec] bg-white px-3.5 py-1.5 text-[12px] font-bold text-[#12324e] transition-colors hover:border-[#7BAFD4] hover:bg-[#eef5fb]"
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
