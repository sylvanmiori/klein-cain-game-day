'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import type { LiveScore } from './live-score-card';

type View = 'final' | 'preview';

type Props = {
  initialStatus: LiveScore['status'];
  finalView: ReactNode;
  previewView: ReactNode;
};

const previewHashes = new Set(['#players', '#recruiting', '#keys', '#game-info', '#preview']);

export function GameReportTabs({ initialStatus, finalView, previewView }: Props) {
  const [status, setStatus] = useState(initialStatus);
  const [view, setView] = useState<View>(initialStatus === 'final' ? 'final' : 'preview');

  useEffect(() => {
    const selectFromHash = () => {
      const hash = window.location.hash;
      if (previewHashes.has(hash)) {
        setView('preview');
        if (hash !== '#preview') {
          window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => document.querySelector(hash)?.scrollIntoView());
          });
        }
      }
      if (hash === '#final') setView('final');
    };
    const receiveScore = (event: Event) => {
      const nextStatus = (event as CustomEvent<LiveScore['status']>).detail;
      setStatus(nextStatus);
      if (nextStatus !== 'final') setView('preview');
    };

    selectFromHash();
    window.addEventListener('hashchange', selectFromHash);
    window.addEventListener('cain-score-status', receiveScore);
    return () => {
      window.removeEventListener('hashchange', selectFromHash);
      window.removeEventListener('cain-score-status', receiveScore);
    };
  }, []);

  const selectView = (nextView: View) => {
    setView(nextView);
    window.history.replaceState(null, '', nextView === 'final' ? '#final' : '#preview');
  };

  if (status !== 'final') return <>{previewView}</>;

  return (
    <div className="game-report" id="game-view">
      <div className="report-tabs" role="tablist" aria-label="Game report views">
        <button
          id="final-tab"
          type="button"
          role="tab"
          aria-selected={view === 'final'}
          aria-controls="final-panel"
          onClick={() => selectView('final')}
        >
          Final
        </button>
        <button
          id="preview-tab"
          type="button"
          role="tab"
          aria-selected={view === 'preview'}
          aria-controls="preview-panel"
          onClick={() => selectView('preview')}
        >
          Game Preview
        </button>
      </div>

      <div id="final-panel" role="tabpanel" aria-labelledby="final-tab" hidden={view !== 'final'}>
        {finalView}
      </div>
      <div id="preview-panel" role="tabpanel" aria-labelledby="preview-tab" hidden={view !== 'preview'}>
        {previewView}
      </div>
    </div>
  );
}
