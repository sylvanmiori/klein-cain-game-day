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
    icon: '/brand/baseball-shield.svg',
  },
};

export default function BaseballLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f5f7fa] text-[#111114]">
      <div className="border-b border-[#dde7f0] bg-white">
        <div className="mx-auto max-w-3xl px-4 pb-4 pt-5">
          <div className="flex items-center gap-3">
            <img src="/brand/baseball-shield.svg" alt="4:13 Baseball shield" className="h-11 w-11 shrink-0" />
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
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-6">{children}</main>
    </div>
  );
}
