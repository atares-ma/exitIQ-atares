import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { navigate } from '../../App';
import { fileDate, formatDate } from '../../lib/i18n';
import { contactMailto, CONTACT_EMAIL } from '../../lib/links';
import { track } from '../../lib/remote';
import { deleteEverything, go, openQuestion, recordResult, taskMetaOf, updateTasks, useAssessment, type TaskStatus } from '../../lib/store';
import { PROFILE_NAMES, QUESTION_BY_ID, ROUTE_LABELS } from '../../model/catalogue';
import { HORIZON_OPTIONS, labelOf } from '../../model/options';
import { buildResult, type Task } from '../../model/plan';
import { intentLabel } from '../../model/routing';
import { ValueCard } from './Values';

const STATUS: Record<TaskStatus, string> = { open: 'Offen', in_progress: 'In Arbeit', done: 'Erledigt' };

export function Result() {
  const s = useAssessment();
  const r = useMemo(() => buildResult(s.ctx, s.answers), [s.ctx, s.answers]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    recordResult();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(r.dimensions.map((d) => [d.displayIndex, d.status])), r.tasks.length]);

  // Printing shows every chapter group.
  useEffect(() => {
    let previous = document.title;
    const before = () => {
      document.querySelectorAll<HTMLDetailsElement>('details.plan-group').forEach((d) => { d.open = true; });
      previous = document.title;
      document.title = `${fileDate()}_ExitIQ_Maßnahmenplan`;
    };
    const after = () => { document.title = previous; };
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => { window.removeEventListener('beforeprint', before); window.removeEventListener('afterprint', after); };
  }, []);

  const chips = [
    PROFILE_NAMES[r.score.profile],
    ...s.ctx.intents.map((i) => intentLabel(s.ctx, i)),
    labelOf(HORIZON_OPTIONS, s.ctx.horizon),
    ...r.activeModules.map((m) => ROUTE_LABELS[m]),
  ];
  const critical = r.tasks.filter((t) => t.kind === 'critical');
  const docsDone = r.checklist.filter((c) => taskMetaOf(s, c.key).status === 'done').length;

  const download = async () => {
    setExporting(true);
    try {
      const { exportActionPlanXlsx } = await import('../../lib/exportXlsx');
      await exportActionPlanXlsx({ result: r, ctx: s.ctx, answers: s.answers, tasks: s.tasks, chips });
      track('export', s.remoteId, { stage: 'RESULT' });
    } finally {
      setExporting(false);
    }
  };

  const statusSelect = (key: string, name: string) => {
    const value = taskMetaOf(s, key).status;
    return (
      <>
        <span className="print-only task-print-status">{STATUS[value]}</span>
        <select className="input input-light no-print task-status" aria-label={`Status von ${name}`} value={value}
          onChange={(e) => updateTasks([key], { status: e.target.value as TaskStatus })}>
          {(Object.keys(STATUS) as TaskStatus[]).map((k) => <option key={k} value={k}>{STATUS[k]}</option>)}
        </select>
      </>
    );
  };

  const taskBody = (t: Task) => (
    <>
      <b className="task-title">{t.title}</b>
      {t.reason && <span className="task-reason">{t.reason}</span>}
      <div className="task-facts">
        <span>Zeitpunkt (Vorschlag): {t.suggestedTiming}</span>
        {t.waitingFor.length > 0 && <span>Wartet auf: {t.waitingFor.map((id) => QUESTION_BY_ID[id].name).join(', ')}</span>}
      </div>
      {t.evidence && <span className="task-evidence"><b>Nachweis:</b> {t.evidence}</span>}
    </>
  );
  const taskSide = (t: Task) => (
    <div className="task-side">
      {statusSelect(t.key, t.title)}
      {t.questionIds[0] && QUESTION_BY_ID[t.questionIds[0]] && (
        <button type="button" className="link-btn no-print" onClick={() => openQuestion(t.questionIds[0], 'result')}>Frage öffnen</button>
      )}
      {(t.kind === 'setting') && <button type="button" className="link-btn no-print" onClick={() => go('setup2')}>Einstellungen</button>}
      {(t.kind === 'scope') && <button type="button" className="link-btn no-print" onClick={() => go('context')}>Angaben ändern</button>}
    </div>
  );

  return (
    <main style={{ flex: 1 }}>
      <div className="print-only print-masthead" aria-hidden="true">
        <img src="/media/atares-logo-full-navy.png" alt="" />
        <div><b>ExitIQ Maßnahmenplan</b><span>{formatDate()}</span></div>
      </div>
      <section className="result-hero">
        <div className="wrap" style={{ padding: '44px 24px 36px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <span className="kicker">Ihr Ergebnis vom {formatDate()}</span>
          <h1 className="h1" style={{ color: 'var(--lime)', maxWidth: 900 }}>
            {r.dataStatus === 'data_complete' ? 'Ihre Selbsteinschätzung ist vollständig.' : 'Ihr Ergebnis und Ihre nächsten Schritte.'}
          </h1>
          <div className="chips">
            {chips.map((c) => <span key={c} className="pill hero-chip">{c}</span>)}
            <button type="button" className="btn btn-ghost btn-sm no-print" onClick={() => go('overview')}>Angaben ansehen</button>
          </div>
          <div className="glance">
            <div className={`glance-tile${critical.length ? ' alert' : ''}`}><span className="glance-n">{critical.length}</span><span className="glance-l">Kritische Voraussetzungen</span></div>
            <div className="glance-tile"><span className="glance-n">{r.tasks.length}</span><span className="glance-l">Aufgaben</span></div>
            <div className="glance-tile"><span className="glance-n">{r.checklist.length}</span><span className="glance-l">Unterlagen</span></div>
          </div>
        </div>
      </section>

      <div className="result-body">
        <div className="wrap" style={{ padding: '44px 24px 64px', display: 'flex', flexDirection: 'column', gap: 56 }}>
          <section className="rsec" aria-labelledby="values-title">
            <SectionHead n={1} id="values-title" title="Ihre drei Werte" sub="Jeder Wert zeigt, wie gut ein Bereich auf einen Verkauf vorbereitet ist, von 0 bis 100. Es gibt bewusst keinen Gesamtwert." />
            {r.scopeOpenNote && (
              <p className="scope-note" role="note">Ihr Verkaufsumfang ist noch offen. Verkaufen Sie nur einen Teil, kommen bis zu 7 Fragen hinzu, und die Werte können sich ändern.</p>
            )}
            <div className="dim-grid">
              {r.dimensions.map((d) => <ValueCard key={d.key} d={d} score={r.score} returnTo="result" light />)}
            </div>
            {r.adviserNote && (
              <div className="atares-note">
                <p>Sie haben angegeben, dass ein erfahrener Berater noch fehlt. {s.ctx.managementModel === 'owner_led' ? 'atares begleitet Inhaber durch den ganzen Verkauf.' : 'atares begleitet Gesellschafter und Management durch den ganzen Verkauf.'}</p>
                <a className="btn btn-navy btn-sm no-print" href={contactMailto()} title={CONTACT_EMAIL}
                  onClick={() => track('contact_request', s.remoteId, { stage: 'RESULT' })}>Gespräch vereinbaren</a>
              </div>
            )}
          </section>

          <section className="rsec" aria-labelledby="steps-title">
            <SectionHead n={2} id="steps-title" title="Ihre fünf wichtigsten Schritte" sub="Zuerst kritische Voraussetzungen, dann nach Zeitpunkt und Wirkung auf Ihre Werte." />
            {r.topSteps.length === 0 ? (
              <div className="steps-none">Keine offenen Aufgaben. Alle Fragen sind mit der besten Aussage beantwortet.</div>
            ) : (
              <ol className="top-steps">
                {r.topSteps.map((t, i) => (
                  <li key={t.key} className={`top-step${t.kind === 'critical' ? ' top-step-critical' : ''}`}>
                    <span className="step-n" aria-hidden="true">{i + 1}</span>
                    <div className="task-main">
                      {t.kind === 'critical' && <span className="pill crit-pill">Kritisch</span>}
                      {taskBody(t)}
                    </div>
                    {taskSide(t)}
                  </li>
                ))}
              </ol>
            )}
          </section>

          {r.groups.length > 0 && (
            <section className="rsec" aria-labelledby="more-title">
              <SectionHead n={3} id="more-title" title="Weitere Aufgaben nach Kapitel" sub={`${r.tasks.length - r.topSteps.length} weitere Aufgaben. Öffnen Sie ein Kapitel, um sie zu sehen.`} />
              <div className="plan-groups">
                {r.groups.map((g) => (
                  <details key={g.title} className="plan-group">
                    <summary><span>{g.chapter != null ? `Kapitel ${g.chapter + 1}: ` : ''}{g.title}</span><span className="plan-group-n">{g.tasks.length}</span></summary>
                    <div className="task-list">
                      {g.tasks.map((t) => (
                        <div key={t.key} className="task task-2col">
                          <div className="task-main">{taskBody(t)}</div>
                          {taskSide(t)}
                        </div>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            </section>
          )}

          {r.checklist.length > 0 && (
            <section className="rsec" aria-labelledby="docs-title">
              <SectionHead n={r.groups.length ? 4 : 3} id="docs-title" title="Unterlagen bereithalten" sub={`Checkliste ohne Einfluss auf Ihre Werte · ${docsDone} von ${r.checklist.length} erledigt`} />
              <ul className="checklist">
                {r.checklist.map((c) => {
                  const done = taskMetaOf(s, c.key).status === 'done';
                  return (
                    <li key={c.key}>
                      <label>
                        <input type="checkbox" checked={done} onChange={() => updateTasks([c.key], { status: done ? 'open' : 'done' })} />
                        <span>{c.title}{c.waitingFor.length > 0 && <span className="task-wait"> · wartet auf: {c.waitingFor.map((id) => QUESTION_BY_ID[id].name).join(', ')}</span>}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section className="next-card no-print" aria-labelledby="next-title">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 520 }}>
              <h2 className="h3" id="next-title">Wie geht es weiter?</h2>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'rgba(255,255,255,0.84)' }}>Ihre Antworten sind gespeichert. Sie können jederzeit zurückkehren, Antworten ändern und den Plan als PDF oder Excel mitnehmen.</p>
            </div>
            <div className="next-actions">
              <button type="button" className="btn btn-lime" onClick={() => go('deep', { qIdx: 0 })}>Antworten ansehen</button>
              <button type="button" className="btn btn-ghost" onClick={() => window.print()}>Als PDF speichern</button>
              <button type="button" className="btn btn-ghost" onClick={download} disabled={exporting} aria-busy={exporting}>Excel herunterladen</button>
            </div>
          </section>

          <footer className="result-foot">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 760 }}>
              <b style={{ fontSize: 13 }}>Was ExitIQ bewusst nicht zeigt</b>
              <span>Keinen Gesamtwert, keine Unternehmensbewertung, keine Verkaufswahrscheinlichkeit. Die Werte beschreiben die Vorbereitung, nicht den Preis.</span>
              <span>ExitIQ ist eine strukturierte Selbsteinschätzung. Sie ersetzt keine rechtliche, steuerliche oder finanzielle Beratung.</span>
            </div>
            <div className="print-only print-sources">
              <span>Quellen: ExitIQ-Selbsteinschätzung, Angaben des Nutzers.</span>
              <span>Notizen: 1) Modell {r.versions.catalogue}, {r.versions.scoring}. 2) Zeitangaben sind Planungsvorschläge, keine rechtlichen Fristen.</span>
            </div>
            <div className="no-print" style={{ marginLeft: 'auto' }}>
              {!confirmDelete ? (
                <button type="button" className="link-btn" onClick={() => setConfirmDelete(true)} style={{ color: 'var(--red)', fontWeight: 500 }}>Diese Einschätzung löschen</button>
              ) : (
                <span style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  Alle Angaben werden in diesem Browser und online gelöscht.
                  <button type="button" className="btn btn-sm" style={{ background: 'var(--red-strong)', color: 'var(--white)' }} onClick={async () => { await deleteEverything(); navigate('/'); }}>Löschen</button>
                  <button type="button" className="btn btn-sm btn-outline" onClick={() => setConfirmDelete(false)}>Abbrechen</button>
                </span>
              )}
            </div>
          </footer>
        </div>
      </div>
    </main>
  );
}

function SectionHead({ n, id, title, sub, children }: { n: number; id: string; title: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="rsec-head">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 760 }}>
        <span className="rsec-num">{String(n).padStart(2, '0')}</span>
        <h2 className="h3" id={id}>{title}</h2>
        {sub && <p>{sub}</p>}
      </div>
      {children}
    </div>
  );
}
