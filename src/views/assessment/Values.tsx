import { Bar } from '../../components/ui';
import { go, openQuestion, type State } from '../../lib/store';
import { QUESTION_BY_ID } from '../../model/catalogue';
import { TOPIC_SHORT } from '../../model/options';
import type { DimensionResult } from '../../model/scoring';

/** "vorläufig · [Thema] noch ungeklärt" etc. (BW5). */
export function statusText(d: DimensionResult): string {
  if (d.status === 'complete') return 'Vollständig';
  if (d.status === 'insufficient') return 'Noch kein Wert';
  const r = d.reasons.find((x) => x.kind === 'topic' || x.kind === 'seller');
  if (r?.kind === 'topic') return `vorläufig · ${TOPIC_SHORT[r.topic]} noch ungeklärt`;
  if (r?.kind === 'seller') return 'vorläufig · Verkäufer noch ungeklärt';
  if (d.reasons.some((x) => x.kind === 'contradiction')) return 'vorläufig · Antworten widersprechen sich';
  return 'vorläufig';
}

/** ER3: what is missing under a provisional (or not yet shown) value, with links. */
export function MissingLinks({ d, returnTo, light = false }: { d: DimensionResult; returnTo: State['returnTo']; light?: boolean }) {
  if (d.status === 'complete') return null;
  const open = d.openIds;
  const cls = light ? 'missing missing-light' : 'missing';
  const settings = d.reasons.filter((r) => r.kind === 'topic' || r.kind === 'seller');
  return (
    <div className={cls}>
      {open.length === 1 && (
        <p>Eine Antwort fehlt noch: {QUESTION_BY_ID[open[0]].name}.{' '}
          <button type="button" className="link-inline" onClick={() => openQuestion(open[0], returnTo)}>Jetzt beantworten</button>
        </p>
      )}
      {open.length > 1 && (
        <details>
          <summary>{open.length} Antworten fehlen noch</summary>
          <ul>
            {open.map((id) => (
              <li key={id}><button type="button" className="link-inline" onClick={() => openQuestion(id, returnTo)}>{QUESTION_BY_ID[id].name}</button></li>
            ))}
          </ul>
        </details>
      )}
      {settings.length > 0 && (
        <p>{settings.map((r) => (r.kind === 'topic' ? `${TOPIC_SHORT[r.topic]} noch ungeklärt` : 'Verkäufer noch ungeklärt')).join(' · ')}.{' '}
          <button type="button" className="link-inline" onClick={() => go('setup2')}>In den Einstellungen klären</button>
        </p>
      )}
    </div>
  );
}

/** One readiness value: number, status, range when provisional, and domain bars. */
export function ValueCard({ d, returnTo, light = false, domains = true }: { d: DimensionResult; returnTo: State['returnTo']; light?: boolean; domains?: boolean }) {
  const shown = d.displayIndex != null;
  const range = d.status === 'provisional' && Math.round(d.upper) !== Math.round(d.lower) ? `Spanne ${Math.round(d.lower)} bis ${Math.round(d.upper)}` : null;
  return (
    <article className={light ? 'dim-card' : 'glass value-card'} aria-labelledby={`dim-${d.key}`}>
      <div className="value-head">
        <h3 id={`dim-${d.key}`}>{d.name}</h3>
        <span className={`value-pill value-${d.status}`}>{statusText(d)}</span>
      </div>
      <div className="value-num">
        <span className={shown ? 'big-index' : 'big-index big-index-off'}>{shown ? d.displayIndex : '–'}</span>
        {range && <span className="value-range">{range}</span>}
        {!shown && <span className="value-range">Wird ab 80 % beantworteter Fragen angezeigt.</span>}
      </div>
      <MissingLinks d={d} returnTo={returnTo} light={light} />
      {domains && light && (
        <div className="value-domains">
          {d.domains.map((m) => {
            const lc = m.localCoverage;
            const label = m.index == null ? 'offen' : `${Math.round(m.index)}${lc < 1 ? ` · ${Math.round(lc * 100)} % beantwortet` : ''}`;
            return (
              <div key={m.key} className="value-domain">
                <div className="value-domain-row"><b>{m.name}</b><span>{label}</span></div>
                <Bar value={(m.index ?? 0) * lc} open={(1 - lc) * 100} label={`${m.name}: ${label}`} />
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}
