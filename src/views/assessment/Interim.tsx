import { useEffect, useMemo } from 'react';
import { deepList, firstIndexOfChapter } from '../../lib/journey';
import { go, openQuestion, useAssessment } from '../../lib/store';
import { INTERIM_AFTER_CHAPTER, QUESTION_BY_ID } from '../../model/catalogue';
import { buildResult } from '../../model/plan';
import { track } from '../../lib/remote';
import { MissingLinks, ValueCard } from './Values';

/** Interim result after chapter 4 (ER1, ER2). */
export function Interim() {
  const s = useAssessment();
  const r = useMemo(() => buildResult(s.ctx, s.answers), [s.ctx, s.answers]);
  const [S, O] = r.dimensions;
  const shown = [S, O].filter((d) => d.displayIndex != null);
  const missing = [S, O].filter((d) => d.displayIndex == null);
  const n = r.remainingLater.length;
  const list = deepList(s.ctx, s.answers);
  const toFinance = () => go('deep', { qIdx: Math.max(0, firstIndexOfChapter(list, INTERIM_AFTER_CHAPTER + 1)) });

  useEffect(() => {
    track('stage_view', s.remoteId, { stage: 'INTERIM_RESULT', profile: r.profile });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div className="page-head">
        <span className="kicker">Zwischenergebnis</span>
        <h1 className="h1 page-title">{shown.length === 2 ? 'Zwischenergebnis: Zwei von drei Werten stehen fest' : shown.length === 1 ? 'Zwischenergebnis: Ein Wert steht fest' : 'Zwischenergebnis'}</h1>
      </div>
      <div className="value-grid">
        {shown.map((d) => <ValueCard key={d.key} d={d} returnTo="interim" />)}
      </div>
      {missing.map((d) => (
        <div key={d.key} className="glass interim-missing">
          {d.openIds.length === 1 ? (
            <p>Für die {d.name} fehlt noch eine Antwort: {QUESTION_BY_ID[d.openIds[0]].name}.{' '}
              <button type="button" className="link-inline" onClick={() => openQuestion(d.openIds[0], 'interim')}>Jetzt beantworten</button>
            </p>
          ) : (
            <>
              <p>Für die {d.name} fehlen noch {d.openIds.length} Antworten.</p>
              <MissingLinks d={d} returnTo="interim" />
            </>
          )}
        </div>
      ))}
      <p className="lead page-sub">
        {n > 0
          ? `Für den dritten Wert, die Transaktionsvorbereitung, fehlen noch ${n} ${n === 1 ? 'Frage' : 'Fragen'} zu Finanzen, Steuern, Recht und Ablauf. Ihre Antworten sind gespeichert.`
          : 'Ihre Antworten sind gespeichert.'}
      </p>
      <div className="nav-row">
        <button type="button" className="btn btn-ghost" onClick={() => go('saved')}>Später fortsetzen</button>
        <div className="right">
          <button type="button" className="btn btn-lime" onClick={n > 0 ? toFinance : () => go('result')}>{n > 0 ? 'Weiter zu Finanzen' : 'Zum Ergebnis'} <span aria-hidden="true">→</span></button>
        </div>
      </div>
    </>
  );
}
