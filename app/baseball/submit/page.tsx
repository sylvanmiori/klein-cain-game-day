import type { Metadata } from 'next';
import { BoxscoreSubmit } from '../../../components/baseball/boxscore-submit';

export const metadata: Metadata = {
  title: 'Submit Box Score',
  description: 'Upload a 4:13 Baseball box score photo and save the parsed stats to the season totals.',
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
          Upload a photo of the box score, check the parsed lines, then confirm to save.
        </p>
      </header>
      <BoxscoreSubmit />
    </div>
  );
}
