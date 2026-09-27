import type { Metadata } from 'next';
import { BaseballBrandLink } from '../../components/baseball/baseball-brand-link';
import { BaseballSubnav } from '../../components/baseball/baseball-subnav';

const baseballUrl = 'https://413baseball.gameday.report';
const baseballDesc =
  '4:13 Baseball 15U travel ball from Spring, TX — tournament schedules, results, roster, and season stats, covered by Game Day Report.';

export const metadata: Metadata = {
  metadataBase: new URL(baseballUrl),
  title: {
    default: '4:13 Baseball | Game Day Report',
    template: '%s | 4:13 Baseball',
  },
  description: baseballDesc,
  alternates: {
    canonical: baseballUrl,
  },
  openGraph: {
    siteName: '4:13 Baseball',
    type: 'website',
    locale: 'en_US',
    url: baseballUrl,
    title: '4:13 Baseball | Game Day Report',
    description: baseballDesc,
    images: [
      {
        url: `${baseballUrl}/brand/baseball/og.png`,
        width: 1200,
        height: 630,
        alt: '4:13 Baseball',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '4:13 Baseball | Game Day Report',
    description: baseballDesc,
    images: [`${baseballUrl}/brand/baseball/og.png`],
  },
  icons: {
    icon: [
      { url: '/brand/baseball/413-shield-48.png', sizes: '48x48', type: 'image/png' },
      { url: '/brand/baseball/413-shield-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/brand/baseball/413-shield-192.png', sizes: '192x192', type: 'image/png' }],
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
          <BaseballBrandLink />
          <BaseballSubnav />
        </div>
      </div>
      <main className="ml-auto mr-auto w-full min-w-0 max-w-3xl pb-14 pl-3 pr-3 pt-4 sm:pb-16 sm:pl-4 sm:pr-4 sm:pt-6">{children}</main>
    </div>
  );
}
