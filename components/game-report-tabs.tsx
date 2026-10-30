'use client';

import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
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
  // A recap section only exists once an editor has authored one, which can
  // happen mid-game (a halftime report). Once play is underway, the recap is
  // the page's lead view; before kickoff the preview still leads.
  const [view, setView] = useState<View>(initialStatus === 'scheduled' ? 'preview' : 'final');
  // The server-rendered initial status is baked at build time and can lag
  // the real game (a pregame build says 'scheduled' until the score card's
  // first poll reports 'live'). Until the reader picks a tab themselves,
  // the view follows the live status: preview before kickoff, recap after.
  const userSelected = useRef(false);

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
      // When the game goes final, default to the recap view (2026-10-08:
      // the page sat on Game Preview after the final because the view only
      // ever synced toward preview, never toward final). An explicit
      // #preview hash (shared link) still wins. While the game is live, a
      // recap may already be published (halftime report), so leave the
      // reader's current view alone instead of forcing the preview.
      if (nextStatus === 'final' && window.location.hash !== '#preview') setView('final');
      else if (nextStatus === 'live' && !userSelected.current && window.location.hash !== '#preview') setView('final');
      else if (nextStatus === 'scheduled' && !userSelected.current) setView('preview');
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
    userSelected.current = true;
    setView(nextView);
    window.history.replaceState(null, '', nextView === 'final' ? '#final' : '#preview');
  };

  // Before kickoff (or when a recap is somehow absent from the payload)
  // there is nothing to switch to, so the preview stands alone. Once the
  // game is live or final, the authored recap gets its tab and leads.
  if (status === 'scheduled') return <>{previewView}</>;

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
          {status === 'final' ? 'Final' : 'Recap'}
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
