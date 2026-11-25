import { go, openQuestion, useAssessment, type State } from '../../lib/store';
import { cardData, namesOf } from '../../model/cards';
import { TOPIC_SHORT } from '../../model/options';
import type { DimensionResult, ScoreResult } from '../../model/scoring';

const n = (count: number, one: string, many: string) => (count === 1 ? one : many.replace('{n}', String(count)));

/**
 * One value card (R2-09): exactly one state with one clear next action.
 * With a value: value "von 100" and, if provisional, the range. Without a
 * value: answered count, a progress bar and from how many answers the value
 * appears. Notes (open topic, contradiction) sit in one line at the end.
 */
export function ValueCard({ d, score, returnTo, light = false }: { d: DimensionResult; score: ScoreResult; returnTo: State['returnTo']; light?: boolean }) {
  const s = useAssessment();
  const c = cardData(d, score, s.ctx, s.answers);
  const shown = d.displayIndex != null;
  const lo = Math.round(d.lower);
  const hi = Math.round(d.upper);
  const open = c.openIds.length;
  const openLabel = n(open, '1 offene Frage beantworten', '{n} offene Fragen beantworten');
  const settings = d.reasons.filter((r) => r.kind === 'topic' || r.kind === 'seller');

  return (
    <article className={`vcard ${light ? 'vcard-light' : 'vcard-dark'}`} aria-labelledby={`dim-${d.key}`}>
      <h3 id={`dim-${d.key}`} className="vcard-name">{d.name}</h3>

      {shown ? (
        <div className="vcard-value">
          <span className="big-index">{d.displayIndex}</span>
          <span className="vcard-of">von 100</span>
          <span className="vcard-state">{d.status === 'complete' ? 'vollständig' : lo !== hi ? `vorläufig (${lo} bis ${hi})` : 'vorläufig'}</span>
        </div>
      ) : (
        <div className="vcard-novalue">
          <p className="vcard-headline"><b>Noch kein Wert</b> · {c.answered} von {c.total} Fragen beantwortet</p>
          <div className="vcard-bar" role="img" aria-label={`${c.answered} von ${c.total} Fragen beantwortet`}>
            <i style={{ width: `${c.total ? (c.answered / c.total) * 100 : 0}%` }} />
          </div>
          {c.blockedByContradiction ? <p className="vcard-sub">Wird angezeigt, sobald der Widerspruch geklärt ist.</p>
            : c.valueFrom != null ? <p className="vcard-sub">Der Wert erscheint ab {c.valueFrom} beantworteten Fragen.</p> : null}
          {open > 0 && (
            <button type="button" className={`btn btn-sm ${light ? 'btn-navy' : 'btn-lime'} vcard-action no-print`} onClick={() => openQuestion(c.openIds[0], returnTo)}>{openLabel}</button>
          )}
        </div>
      )}

      <ul className="vcard-areas">
        {c.areas.map((a) => (
          <li key={a.key}>
            <div className="vcard-area-row">
              <span>{a.name}</span>
              <span className="vcard-area-num">{a.value != null ? a.value : shown ? `${a.answered} von ${a.total} beantwortet` : `${a.answered} von ${a.total}`}</span>
            </div>
            {a.value != null && <div className="vcard-bar vcard-bar-thin"><i style={{ width: `${a.value}%` }} /></div>}
          </li>
        ))}
      </ul>

      {shown && open > 0 && (
        <button type="button" className="link-inline vcard-link no-print" onClick={() => openQuestion(c.openIds[0], returnTo)}>{openLabel}</button>
      )}

      {(c.contradictedIds.length > 0 || settings.length > 0) && (
        <div className="vcard-notes">
          {c.contradictedIds.length > 0 && (
            <p className="vcard-note">
              {c.contradictedIds.length} Antworten widersprechen sich: {namesOf(c.contradictedIds)} ·{' '}
              <button type="button" className="link-inline no-print" onClick={() => openQuestion(c.contradictedIds[0], returnTo)}>Jetzt prüfen</button>
            </p>
          )}
          {settings.map((r) => (
            <p key={r.kind === 'topic' ? r.topic : 'seller'} className="vcard-note">
              {r.kind === 'topic' ? `${TOPIC_SHORT[r.topic]} ungeklärt` : 'Verkäufer ungeklärt'} ·{' '}
              <button type="button" className="link-inline no-print" onClick={() => go('setup2')}>In den Einstellungen klären</button>
            </p>
          ))}
        </div>
      )}
    </article>
  );
}
