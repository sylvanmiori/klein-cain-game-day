'use client';

import { usePathname } from 'next/navigation';

// Plain <a> tags, not next/link: the baseball host rewrites "/" to the
// /baseball route, which breaks the App Router's client-side navigation
// (taps are silently swallowed). Full-page loads always work.
const LINKS = [
  { href: '/baseball', label: 'Home', match: 'home' as const },
  { href: '/baseball/schedule', label: 'Schedule', match: 'path' as const },
  { href: '/baseball/roster', label: 'Roster', match: 'path' as const },
  { href: '/baseball/stats', label: 'Stats', match: 'path' as const },
  { href: '/baseball/submit', label: 'Submit', match: 'path' as const },
];

function isActive(pathname: string, href: string, match: 'home' | 'path') {
  const path = pathname || '/';
  if (match === 'home') {
    return path === '/' || path === '/baseball' || path === '/baseball/';
  }
  return path === href || path.startsWith(`${href}/`);
}

export function BaseballSubnav() {
  const pathname = usePathname() || '/';

  return (
    <nav aria-label="4:13 Baseball sections" className="mt-3 flex flex-wrap gap-2">
      {LINKS.map((l) => {
        const active = isActive(pathname, l.href, l.match);
        return (
          <a
            key={l.href}
            href={l.href}
            aria-current={active ? 'page' : undefined}
            className={
              active
                ? 'rounded-full bg-[#12324e] px-3.5 py-1.5 text-[12px] font-bold text-white'
                : 'rounded-full border border-[#c9dcec] bg-white px-3.5 py-1.5 text-[12px] font-bold text-[#12324e] transition-colors hover:border-[#7BAFD4] hover:bg-[#eef5fb]'
            }
          >
            {l.label}
          </a>
        );
      })}
    </nav>
  );
}
