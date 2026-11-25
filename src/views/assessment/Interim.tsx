import { useEffect, useMemo, useState } from 'react';
import { deepList, firstIndexOfChapter, needsVisit, progressDone, progressTotal, totalLabel } from '../../lib/journey';
import { track } from '../../lib/remote';
import { go, openQuestion, useAssessment } from '../../lib/store';
import { namesOf } from '../../model/cards';
import { CHAPTERS, INTERIM_AFTER_CHAPTER, QUESTION_BY_ID } from '../../model/catalogue';
import { buildResult } from '../../model/plan';
import type { DimensionResult } from '../../model/scoring';
import { ValueCard } from './Values';

/** Interim result after chapter 4 (ER1, ER2), with progress (R2-01), contradictions (R2-02) and a way back (R2-10). */
export function Interim() {
  const s = useAssessment();
  const r = useMemo(() => buildResult(s.ctx, s.answers), [s.ctx, s.answers]);
  const [showChapters, setShowChapters] = useState(false);
  const [S, O] = r.dimensions;
  const shown = [S, O].filter((d) => d.displayIndex != null);
  const missing = [S, O].filter((d) => d.displayIndex == null);
  const n = r.remainingLater.length;
  const list = deepList(s.ctx, s.answers);
  const total = progressTotal(s.ctx, s.answers);
  const done = progressDone(s.ctx, s.answers);
  const lastFirstPart = list.map((x) => x.chapter).lastIndexOf(INTERIM_AFTER_CHAPTER);
  const toFinance = () => go('deep', { qIdx: Math.max(0, firstIndexOfChapter(list, INTERIM_AFTER_CHAPTER + 1)), returnTo: null });

  useEffect(() => {
    track('stage_view', s.remoteId, { stage: 'INTERIM_RESULT', profile: r.profile });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div className="page-head">
        <span className="kicker">Zwischenergebnis</span>
        <h1 className="h1 page-title">{shown.length === 2 ? 'Zwischenergebnis: Zwei von drei Werten stehen fest' : shown.length === 1 ? 'Zwischenergebnis: Ein Wert steht fest' : 'Zwischenergebnis'}</h1>
        <p className="page-done">{done} von {totalLabel(total)} Angaben erledigt.</p>
      </div>
      <div className="value-grid">
        {shown.map((d) => <ValueCard key={d.key} d={d} score={r.score} returnTo="interim" />)}
      </div>
      {missing.map((d) => <MissingBlock key={d.key} d={d} />)}
      <p className="lead page-sub">
        {n > 0
          ? `Für den dritten Wert, die Transaktionsvorbereitung, fehlen noch ${n} ${n === 1 ? 'Frage' : 'Fragen'} zu Finanzen, Steuern, Recht und Ablauf. Ihre Antworten sind gespeichert.`
          : 'Ihre Antworten sind gespeichert.'}
      </p>

      <div className="interim-back">
        <button type="button" className="link-inline" aria-expanded={showChapters} onClick={() => setShowChapters((x) => !x)}>Antworten in Kapitel 1 bis 4 ändern</button>
        {showChapters && (
          <ol className="chapter-list-open">
            {CHAPTERS.slice(0, INTERIM_AFTER_CHAPTER + 1).map((ch, j) => {
              const items = list.map((x, k) => ({ ...x, k })).filter((x) => x.chapter === j);
              if (!items.length) return null;
              const answered = items.filter((x) => !needsVisit(x.q.id, s.answers)).length;
              return (
                <li key={ch.title}>
                  <button type="button" className="chapter-link" onClick={() => go('deep', { qIdx: items[0].k, returnTo: null })}>
                    <span>{j + 1}. {ch.title}</span><span className="chapter-n">{answered} von {items.length}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <div className="nav-row">
        <button type="button" className="btn btn-ghost" onClick={() => go('deep', { qIdx: Math.max(0, lastFirstPart), returnTo: null })}>Zurück</button>
        <div className="right">
          <button type="button" className="btn btn-ghost" onClick={() => go('saved')}>Später fortsetzen</button>
          <button type="button" className="btn btn-lime" onClick={n > 0 ? toFinance : () => go('result')}>{n > 0 ? 'Weiter zu Finanzen' : 'Zum Ergebnis'} <span aria-hidden="true">→</span></button>
        </div>
      </div>
    </>
  );
}

/** ER2 with R2-02: first the contradiction, then a missing answer. */
function MissingBlock({ d }: { d: DimensionResult }) {
  const contradiction = d.reasons.find((x) => x.kind === 'contradiction');
  const contra = contradiction?.kind === 'contradiction' ? contradiction.ids : [];
  const open = d.openIds;
  return (
    <div className="glass interim-missing">
      {contra.length > 0 && (
        <p>Für die {d.name} widersprechen sich {contra.length} Antworten: {namesOf(contra)}.{' '}
          <button type="button" className="link-inline" onClick={() => openQuestion(contra[0], 'interim')}>Jetzt prüfen</button>
        </p>
      )}
      {open.length === 1 && (
        <p>{contra.length ? 'Eine Antwort fehlt noch' : `Für die ${d.name} fehlt noch eine Antwort`}: {QUESTION_BY_ID[open[0]].name}.{' '}
          <button type="button" className="link-inline" onClick={() => openQuestion(open[0], 'interim')}>Jetzt beantworten</button>
        </p>
      )}
      {open.length > 1 && (
        <p>{contra.length ? `${open.length} Antworten fehlen noch.` : `Für die ${d.name} fehlen noch ${open.length} Antworten.`}{' '}
          <button type="button" className="link-inline" onClick={() => openQuestion(open[0], 'interim')}>{open.length} offene Fragen beantworten</button>
        </p>
      )}
    </div>
  );
}
