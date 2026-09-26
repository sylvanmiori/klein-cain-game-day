import type { Metadata } from 'next';
import { BaseballSubnav } from '../../components/baseball/baseball-subnav';

export const metadata: Metadata = {
  title: {
    default: '4:13 Baseball | Game Day Report',
    template: '%s | 4:13 Baseball',
  },
  description:
    '4:13 Baseball 15U travel ball from Spring, TX — tournament schedules, results, roster, and season stats, covered by Game Day Report.',
  icons: {
    
  },
};

export default function BaseballLayout({ children }: { children: React.ReactNode }) {
  return (
    // Never wider than the visible screen: the Muse iOS webview reports
    // 100vw as ~16px wider than the physical screen, so cap at
    // calc(100vw - 16px) to bind the page to the actual visible width.
    // overflow-x-clip: the page must never scroll horizontally on phones.
    // Physical pl/pr/ml/mr (not logical px/mx): sidesteps any logical-property
    // quirk in embedded webviews that could drop the inline-end padding.
    <div className="ml-auto mr-auto min-h-screen w-full max-w-[100vw] overflow-x-clip bg-[#f5f7fa] text-[#111114]">
      <div className="border-b border-[#dde7f0] bg-white">
        <div className="ml-auto mr-auto w-full max-w-3xl pb-3 pl-3 pr-3 pt-4 sm:pb-4 sm:pl-4 sm:pr-4 sm:pt-5">
          <div className="flex items-center gap-3">
            <img src="/brand/baseball/413-shield-96.png" srcSet="/brand/baseball/413-shield-48.png 1x, /brand/baseball/413-shield-96.png 2x" alt="4:13 Baseball shield" width="44" height="44" className="h-11 w-11 min-w-0 shrink-0" />
            <div>
              <p className="text-lg font-black tracking-tight text-[#12324e]">4:13 Baseball</p>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#7BAFD4]">
                15U &middot; Spring, TX
              </p>
            </div>
          </div>
          <BaseballSubnav />
        </div>
      </div>
      <main className="ml-auto mr-auto w-full max-w-3xl pb-14 pl-3 pr-3 pt-4 sm:pb-16 sm:pl-4 sm:pr-4 sm:pt-6">{children}</main>
    </div>
  );
}
