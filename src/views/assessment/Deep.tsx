import { Bar, Glossed, RadioGroup } from '../../components/ui';
import { endsFirstPart, firstIndexOfChapter, hasResponse, progressCounts, deepList, needsVisit } from '../../lib/journey';
import { chapterDone, go, reconfirm, setAnswer, setFollowUp, setPosition, useAssessment } from '../../lib/store';
import { CHAPTERS, INTERIM_AFTER_CHAPTER } from '../../model/catalogue';
import { buildResult } from '../../model/plan';
import { STATUS_LABEL, contributorOf, followUpQuestion, naLabel, questionText, statusLine } from '../../model/routing';
import type { Answer, Points } from '../../model/types';
import { Notice } from './Notice';
import { TrackQuestion } from './TrackQuestion';

type Value = Points | 'clarify' | 'lookup' | 'na';

const valueOf = (a: Answer | undefined): Value | null => {
  if (!a || a.inactiveSince) return null;
  if (a.status === 'substantive') return a.points ?? null;
  if (a.status === 'not_applicable') return 'na';
  return a.status;
};

/** True when the interim result has at least one value to show (ER2: none → straight on to chapter 5). */
export function interimHasValue(ctx: Parameters<typeof buildResult>[0], answers: Parameters<typeof buildResult>[1]): boolean {
  const r = buildResult(ctx, answers);
  return r.dimensions.slice(0, 2).some((d) => d.displayIndex != null);
}

export function Deep() {
  const s = useAssessment();
  const list = deepList(s.ctx, s.answers);
  if (!list.length) return null;
  const qi = Math.min(s.qIdx, list.length - 1);
  const { q, chapter } = list[qi];
  const a = s.answers[q.id];
  const text = questionText(q, s.ctx, s.answers);
  const line = statusLine(q, s.ctx);
  const follow = followUpQuestion(q.id, s.answers);
  const value = valueOf(a);
  const done = hasResponse(q.id, a, s.answers);
  const progress = progressCounts(list, s.answers);

  const choices = [
    ...text.anchors.map((label, i) => ({ value: (i * 50) as Value, label: <Glossed nested text={label} /> })),
    ...(line ? [{ value: line as Value, label: STATUS_LABEL[line], status: true }] : []),
    ...(q.naAllowed ? [{ value: 'na' as Value, label: naLabel(q), status: true }] : []),
  ];

  const choose = (v: Value) => {
    if (v === 'na') setAnswer(q.id, { status: 'not_applicable' });
    else if (v === 'clarify' || v === 'lookup') setAnswer(q.id, { status: v });
    else setAnswer(q.id, { status: 'substantive', points: v });
  };

  const next = () => {
    if (s.returnTo) { go(s.returnTo); return; }
    const fresh = deepList(s.ctx, s.answers); // an answer can change the list (Q53 → Q34)
    const i = fresh.findIndex((x) => x.q.id === q.id);
    if (fresh[i + 1]?.chapter !== chapter) chapterDone(chapter);
    if (i >= fresh.length - 1) { go('result'); return; }
    if (endsFirstPart(fresh, i) && interimHasValue(s.ctx, s.answers)) { go('interim'); return; }
    setPosition(i + 1);
  };
  const back = () => {
    if (qi === 0) { go('overview'); return; }
    if (chapter === INTERIM_AFTER_CHAPTER + 1 && qi === firstIndexOfChapter(list, chapter) && interimHasValue(s.ctx, s.answers)) { go('interim'); return; }
    setPosition(qi - 1);
  };

  return (
    <>
      <TrackQuestion id={q.id} />
      <div className="deep-top">
        <span className="kicker">Kapitel {chapter + 1} von {CHAPTERS.length} · {CHAPTERS[chapter].title}</span>
        <div className="deep-count">
          <span aria-live="polite">Frage {qi + 1} von {list.length}</span>
          <Bar dark value={(progress.answered / progress.total) * 100} color="var(--teal)" label={`${progress.answered} von ${progress.total} beantwortet`} />
        </div>
      </div>
      <Notice />

      <section key={q.id} className="q-card fade-up" aria-labelledby="deep-q">
        <div className="q-head">
          <h1 id="deep-q" className="q-title"><Glossed text={text.question} /></h1>
        </div>
        {a?.requiresReconfirmation && (
          <div className="banner banner-lime">
            <span>Wieder im Umfang, bitte erneut bestätigen.</span>
            <button type="button" className="btn btn-lime btn-sm" onClick={() => reconfirm(q.id)}>Unverändert bestätigen</button>
          </div>
        )}
        <RadioGroup<Value> layout="list" label={text.question} value={a?.requiresReconfirmation ? null : value} choices={choices} onChange={choose} />
        {follow && !a?.requiresReconfirmation && (
          <div className="followup">
            <h2 className="followup-label">{follow}</h2>
            <RadioGroup<'yes' | 'no'> label={follow} value={a?.followUp ?? null} min="140px"
              choices={[{ value: 'yes', label: 'Ja' }, { value: 'no', label: 'Nein' }]} onChange={(v) => setFollowUp(q.id, v)} />
          </div>
        )}
        <p className="q-meta">Ansprechperson: {contributorOf(q, s.ctx)}</p>
      </section>

      <div className="nav-row">
        <button type="button" className="btn btn-ghost" onClick={back}>Zurück</button>
        <div className="right">
          {!done && <span className="hint">Bitte wählen Sie eine Antwort.</span>}
          <button type="button" className="btn btn-lime" disabled={!done} onClick={next}>
            {s.returnTo === 'result' ? 'Zurück zum Ergebnis' : s.returnTo === 'interim' ? 'Zurück zum Zwischenergebnis' : s.returnTo === 'overview' ? 'Zurück zur Übersicht' : qi === list.length - 1 ? 'Zum Ergebnis' : 'Weiter'}
          </button>
        </div>
      </div>

      <details className="chapter-list">
        <summary>Alle Kapitel</summary>
        <ol>
          {CHAPTERS.map((ch, j) => {
            const items = list.map((x, k) => ({ ...x, k })).filter((x) => x.chapter === j);
            if (!items.length) return null;
            const n = items.filter((x) => !needsVisit(x.q.id, s.answers)).length;
            const target = items.find((x) => needsVisit(x.q.id, s.answers)) ?? items[0];
            return (
              <li key={ch.title}>
                <button type="button" className="chapter-link" aria-current={j === chapter} onClick={() => go('deep', { qIdx: target.k, returnTo: null })}>
                  <span>{j + 1}. {ch.title}</span><span className="chapter-n">{n} von {items.length}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </details>
    </>
  );
}
