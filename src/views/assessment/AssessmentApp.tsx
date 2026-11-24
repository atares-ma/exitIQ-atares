import { useEffect, useState } from 'react';
import { Brand } from '../../components/ui';
import { formatTime } from '../../lib/i18n';
import { deepList, STEPS, stepOf } from '../../lib/journey';
import { onSyncStatus, type BackupHealth, type SyncStatus } from '../../lib/remote';
import { SUPABASE_URL } from '../../lib/supabase';
import { go, hasProgress, hydrateFromRemote, syncAll, useAssessment, type Screen } from '../../lib/store';
import { privacyUrl } from '../../lib/links';
import { ContextScreen, CrisisScreen } from './Context';
import { Deep } from './Deep';
import { Interim } from './Interim';
import { Overview } from './Overview';
import { Result } from './Result';
import { Saved } from './Saved';
import { Setup1, Setup2 } from './Setup';
import { useBackupHealth } from './useBackupHealth';

const SUPABASE_PROJECT = SUPABASE_URL.replace(/^https?:\/\//, '').replace(/\.supabase\.co\/?$/, '');

/** Question screens get the calmer, uniform surface; result-like screens keep the brand artwork. */
const CALM: Screen[] = ['setup1', 'setup2', 'deep'];

function useSync(): SyncStatus {
  const [s, set] = useState<SyncStatus>('idle');
  useEffect(() => onSyncStatus((a) => set(a)), []);
  return s;
}

export default function AssessmentApp() {
  const state = useAssessment();
  const sync = useSync();
  const health = useBackupHealth();
  const [ready, setReady] = useState(hasProgress(state));

  useEffect(() => {
    document.title = 'ExitIQ: Ihre Selbsteinschätzung';
  }, []);

  useEffect(() => {
    if (ready) return;
    void hydrateFromRemote().finally(() => setReady(true));
  }, [ready]);

  useEffect(() => {
    if (ready && hasProgress()) void syncAll();
  }, [ready]);

  const list = deepList(state.ctx, state.answers);
  const chapter = state.screen === 'deep' ? list[Math.min(state.qIdx, list.length - 1)]?.chapter ?? null : null;
  const at = stepOf(state.screen === 'saved' ? state.resumeTo ?? 'context' : state.screen, chapter);
  const time = state.savedAt ? formatTime(new Date(state.savedAt)) : null;
  const saveLabel = !time ? 'Wird laufend gespeichert'
    : sync === 'saving' && health.online !== false ? 'Speichert …'
    : health.online === true ? `Gespeichert ${time}`
    : `In diesem Browser gespeichert ${time}`;

  return (
    <div className={`app-bg${CALM.includes(state.screen) ? ' calm' : ''}`}>
      <a href="#main" className="sr-only">Zum Inhalt springen</a>
      <header className="app-header no-print">
        <div className="app-header-inner">
          <Brand />
          <ol className="stepper" aria-label="Fortschritt">
            {STEPS.map((l, i) => {
              const st = state.screen === 'saved' ? (i < at ? 'done' : '') : i < at ? 'done' : i === at ? 'current' : '';
              return (
                <li key={l} className={st} aria-current={st === 'current' ? 'step' : undefined}>
                  <span className="dot" aria-hidden="true">{st === 'done' ? '✓' : i + 1}</span>
                  <span className="label">{l}</span>
                </li>
              );
            })}
          </ol>
          <div className="save-state">
            <span aria-live="polite">{saveLabel}</span>
            {state.screen !== 'saved' && state.screen !== 'result' && hasProgress(state) && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => go('saved')}>Pausieren</button>
            )}
          </div>
        </div>
      </header>
      {hasProgress(state) && <BackupNotice health={health} />}

      <div id="main" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {!ready ? <main className="app-main"><p className="muted-light">Wird geladen …</p></main> : <Screens />}
      </div>

      {state.screen !== 'result' && (
        <footer className="app-footer no-print">
          <p>Ihre Angaben behandeln wir vertraulich. Details in der <a href={privacyUrl()}>Datenschutzerklärung</a>.</p>
          <p>ExitIQ ist eine strukturierte Selbsteinschätzung. Sie ersetzt keine rechtliche, steuerliche oder finanzielle Beratung und ist keine Unternehmensbewertung.</p>
        </footer>
      )}
    </div>
  );
}

/** Calm notice while the online backup does not work; "Erneut versuchen" pushes the full state. */
function BackupNotice({ health }: { health: BackupHealth }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  if (health.online !== false) return null;
  const retry = async () => {
    setBusy(true);
    setFailed(false);
    const ok = await syncAll();
    setBusy(false);
    if (!ok) setFailed(true);
  };
  return (
    <div className="backup-notice no-print" role="status">
      <div className="backup-inner">
        <span className="backup-dot" aria-hidden="true" />
        <span className="backup-text">
          Ihre Angaben sind in diesem Browser gespeichert. Die Online-Sicherung ist gerade nicht erreichbar.
          {failed && !busy && <span className="backup-sub">Noch nicht erreichbar. Ihre Angaben bleiben in diesem Browser.</span>}
        </span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={retry} disabled={busy}>{busy ? 'Wird versucht …' : 'Erneut versuchen'}</button>
        {health.detail && (
          <details className="backup-details">
            <summary>Technische Details</summary>
            <code>{health.detail}</code>
            <code>Supabase-Projekt: {SUPABASE_PROJECT}</code>
          </details>
        )}
      </div>
    </div>
  );
}

function Screens() {
  const s = useAssessment();
  switch (s.screen) {
    case 'context': return <ContextScreen />;
    case 'crisis': return <Wrap><CrisisScreen /></Wrap>;
    case 'setup1': return <Setup1 />;
    case 'setup2': return <Setup2 />;
    case 'overview': return <Wrap><Overview /></Wrap>;
    case 'deep': return <Wrap><Deep /></Wrap>;
    case 'interim': return <Wrap><Interim /></Wrap>;
    case 'result': return <Result />;
    case 'saved': return <Wrap><Saved /></Wrap>;
  }
}

function Wrap({ children }: { children: React.ReactNode }) {
  return <main className="app-main">{children}</main>;
}
