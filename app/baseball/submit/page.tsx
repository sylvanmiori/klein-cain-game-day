import type { Metadata } from 'next';
import { BoxscoreSubmit } from '../../../components/baseball/boxscore-submit';

export const metadata: Metadata = {
  title: 'Submit Box Score',
  description: 'Password-protected 4:13 Baseball box score tools: upload GameChanger screenshots, type lines in by hand, or edit an existing game.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function BaseballSubmitPage() {
  return (
    <div className="grid gap-5">
      <header>
        <h1 className="text-2xl font-black tracking-tight text-[#12324e]">Submit Box Score</h1>
        <p className="mt-1 text-sm text-[#6e6e73]">
          Upload GameChanger screenshots, type lines in by hand, or edit an existing game.
          The whole area is password-protected.
        </p>
      </header>
      <BoxscoreSubmit />
    </div>
  );
}
