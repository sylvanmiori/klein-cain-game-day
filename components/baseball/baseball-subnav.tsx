'use client';

import { useEffect, useState } from 'react';
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

function isHomePath(path: string) {
  return path === '/' || path === '/baseball' || path === '/baseball/';
}

function isActive(pathname: string, href: string, match: 'home' | 'path') {
  const path = pathname || '/';
  if (match === 'home') return isHomePath(path);
  return path === href || path.startsWith(`${href}/`);
}

export function BaseballSubnav() {
  const pathname = usePathname() || '/';
  // On 413baseball.gameday.report the public home URL is "/". Keep /baseball
  // for the shared football host so those links still resolve.
  const [homeHref, setHomeHref] = useState('/baseball');
  useEffect(() => {
    if (typeof window !== 'undefined' && /413baseball/i.test(window.location.hostname)) {
      setHomeHref('/');
    }
  }, []);

  return (
    <nav aria-label="4:13 Baseball sections" className="mt-3 flex flex-wrap gap-2">
      {LINKS.map((l) => {
        const href = l.match === 'home' ? homeHref : l.href;
        const active = isActive(pathname, l.href, l.match);
        return (
          <a
            key={l.label}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={
              active
                ? 'rounded-full px-3.5 py-1.5 text-[12px] font-bold'
                : 'rounded-full border border-[#c9dcec] bg-white px-3.5 py-1.5 text-[12px] font-bold text-[#12324e] transition-colors hover:border-[#7BAFD4] hover:bg-[#eef5fb]'
            }
            style={
              active
                ? { backgroundColor: '#12324e', color: '#ffffff' }
                : undefined
            }
          >
            {l.label}
          </a>
        );
      })}
    </nav>
  );
}
