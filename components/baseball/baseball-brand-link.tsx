'use client';

import { useEffect, useState } from 'react';

// Plain <a>, not next/link: same reason as BaseballSubnav — the 413 host
// rewrites "/" to /baseball and App Router client nav can swallow taps.
export function BaseballBrandLink() {
  // On 413baseball.gameday.report the public home URL is "/". Keep /baseball
  // for the shared football host so those links still resolve.
  const [homeHref, setHomeHref] = useState('/baseball');
  useEffect(() => {
    if (typeof window !== 'undefined' && /413baseball/i.test(window.location.hostname)) {
      setHomeHref('/');
    }
  }, []);

  return (
    <a
      href={homeHref}
      aria-label="4:13 Baseball home"
      className="flex items-center gap-3 text-inherit no-underline transition-opacity hover:opacity-90"
    >
      <img
        src="/brand/baseball/413-shield-96.png"
        srcSet="/brand/baseball/413-shield-48.png 1x, /brand/baseball/413-shield-96.png 2x"
        alt=""
        width="44"
        height="44"
        className="h-11 w-11 min-w-0 shrink-0"
      />
      <div>
        <p className="text-lg font-black tracking-tight text-[#12324e]">4:13 Baseball</p>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#7BAFD4]">
          15U &middot; Spring, TX
        </p>
      </div>
    </a>
  );
}
