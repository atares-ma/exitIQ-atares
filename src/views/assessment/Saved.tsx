import { useEffect, useState } from 'react';
import { navigate } from '../../App';
import { deepList, progressCounts } from '../../lib/journey';
import { formatDate, formatTime } from '../../lib/i18n';
import { linkEmail } from '../../lib/remote';
import { deleteEverything, resume, startNew, syncAll, useAssessment } from '../../lib/store';
import { useBackupHealth } from './useBackupHealth';

export function Saved() {
  const s = useAssessment();
  const health = useBackupHealth();
  const [checking, setChecking] = useState(false);
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<'delete' | 'new' | null>(null);
  const { answered, total } = progressCounts(deepList(s.ctx, s.answers), s.answers);

  useEffect(() => {
    if (health.online === true) return;
    setChecking(true);
    void syncAll().finally(() => setChecking(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const backup = health.online === true ? 'on' : checking || health.online === null ? 'checking' : 'off';
  const when = s.savedAt ? `${formatDate(new Date(s.savedAt))}, ${formatTime(new Date(s.savedAt))}` : null;

  return (
    <>
      <div className="page-head">
        <span className="kicker">Pausiert</span>
        <h1 className="h1 page-title">Ihr Fortschritt ist gespeichert.</h1>
        <p className="lead page-sub">
          {total > 0 ? `${answered} von ${total} Fragen beantwortet.` : 'Ihre Angaben sind gespeichert.'}{when ? ` Zuletzt gespeichert am ${when}.` : ''} Sie machen an der letzten offenen Stelle weiter.
        </p>
      </div>

      <div className="save-status glass">
        <dl style={{ margin: 0 }}><dt>In diesem Browser</dt><dd><span className="status-dot on" aria-hidden="true" />Gespeichert</dd></dl>
        <dl style={{ margin: 0 }}>
          <dt>Online-Sicherung</dt>
          <dd><span className={`status-dot ${backup}`} aria-hidden="true" />{backup === 'on' ? 'Aktiv' : backup === 'off' ? 'Nicht erreichbar' : 'Wird geprüft …'}</dd>
        </dl>
        {backup === 'off' && (
          <div className="save-status-wide">
            <p>Ihre Angaben bleiben in diesem Browser. Auf einem anderen Gerät können Sie erst fortsetzen, wenn die Online-Sicherung wieder erreichbar ist.</p>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setChecking(true); void syncAll().finally(() => setChecking(false)); }}>Erneut versuchen</button>
          </div>
        )}
      </div>

      {backup === 'on' && (
        <section className="glass" style={{ display: 'flex', flexDirection: 'column', gap: 12 }} aria-labelledby="link-title">
          <h2 id="link-title" style={{ margin: 0, fontSize: 18 }}>Auf einem anderen Gerät fortsetzen</h2>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'rgba(255,255,255,0.8)' }}>
            Geben Sie Ihre E-Mail-Adresse an. Sie erhalten einen Link, mit dem Sie Ihre Einschätzung auf jedem Gerät öffnen können.
          </p>
          <form style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }} onSubmit={async (e) => { e.preventDefault(); setBusy(true); setMsg(await linkEmail(email)); setBusy(false); }}>
            <label className="sr-only" htmlFor="save-email">E-Mail-Adresse</label>
            <input id="save-email" className="input" style={{ flex: '1 1 260px' }} type="email" required autoComplete="email" placeholder="name@unternehmen.de" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button type="submit" className="btn btn-lime" disabled={busy}>{busy ? 'Wird gesendet …' : 'Link senden'}</button>
          </form>
          {msg && <p role="status" style={{ margin: 0, fontSize: 14, color: msg.ok ? 'var(--lime)' : 'var(--lime-2)' }}>{msg.message}</p>}
        </section>
      )}

      <div className="nav-row">
        <button type="button" className="btn btn-ghost" onClick={() => navigate('/')}>Zur Startseite</button>
        <div className="right">
          <button type="button" className="btn btn-lime" onClick={resume}>Fortsetzen <span aria-hidden="true">→</span></button>
        </div>
      </div>

      <section className="saved-foot">
        {confirm === null && (
          <>
            <button type="button" className="btn-link" onClick={() => setConfirm('new')}>Neue Einschätzung beginnen</button>
            <button type="button" className="btn-link" style={{ color: '#ff9c8f' }} onClick={() => setConfirm('delete')}>Diese Einschätzung löschen</button>
          </>
        )}
        {confirm === 'new' && (
          <span className="confirm-row">
            Neu beginnen? Ihre bisherigen Angaben werden in diesem Browser verworfen.
            <button type="button" className="btn btn-lime btn-sm" onClick={() => startNew()}>Neu beginnen</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirm(null)}>Abbrechen</button>
          </span>
        )}
        {confirm === 'delete' && (
          <span className="confirm-row">
            Alle Angaben werden in diesem Browser und online gelöscht.
            <button type="button" className="btn btn-sm" style={{ background: 'var(--red-strong)', color: 'var(--white)' }} onClick={async () => { await deleteEverything(); navigate('/'); }}>Löschen</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirm(null)}>Abbrechen</button>
          </span>
        )}
      </section>
    </>
  );
}
