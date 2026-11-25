import { navigate } from '../../App';
import { CheckboxGroup, Field, RadioGroup } from '../../components/ui';
import { contextComplete, setupComplete } from '../../lib/journey';
import { ProgressCounter } from './Progress';
import { Notice } from './Notice';
import { go, setContext, useAssessment } from '../../lib/store';
import { INTENT_OPTIONS, LIQUIDITY_OPTIONS, MANAGEMENT_OPTIONS, OWNERSHIP_OPTIONS } from '../../model/options';
import { crisisReason, intentLabel, onlyCorporate, toggleIntent } from '../../model/routing';
import type { OwnershipTag } from '../../model/types';

function toggle<T>(xs: T[], v: T): T[] {
  return xs.includes(v) ? xs.filter((x) => x !== v) : [...xs, v];
}

/** Context page: four required questions, no explanations, no "Nicht sicher" (section 3). */
export function ContextScreen() {
  const { ctx } = useAssessment();
  const ok = contextComplete(ctx);
  const corpOnly = onlyCorporate(ctx);

  const setOwnership = (v: OwnershipTag) => {
    const ownershipTags = toggle(ctx.ownershipTags, v);
    const next = { ...ctx, ownershipTags };
    // "Inhabergeführt" is locked when K1 is only Konzern (KO3).
    setContext({ ownershipTags, ...(onlyCorporate(next) && ctx.managementModel === 'owner_led' ? { managementModel: null } : {}), profileOverride: null });
  };

  return (
    <main className="app-main">
      <p className="effort-line">Dauer etwa 15 Minuten, rund 40 Angaben. Sie können jederzeit pausieren.</p>
      <ProgressCounter label="Fragen 1 bis 4" />
      <div className="page-head">
        <h1 className="h1 page-title">Zunächst ein wenig zu Ihrem Unternehmen.</h1>
        <p className="lead page-sub">Vier kurze Fragen, damit Sie nur Fragen erhalten, die zu Ihrer Situation passen.</p>
      </div>
      <Notice />
      <Field id="k1" label="Wem gehört das Unternehmen heute?" note="Mehrfachauswahl möglich">
        <CheckboxGroup label="Wem gehört das Unternehmen heute?" choices={OWNERSHIP_OPTIONS} values={ctx.ownershipTags} onToggle={setOwnership} />
      </Field>
      <Field id="k2" label="Wer führt das Tagesgeschäft?">
        <RadioGroup label="Wer führt das Tagesgeschäft?" value={ctx.managementModel}
          choices={MANAGEMENT_OPTIONS.map((o) => ({ ...o, disabled: o.value === 'owner_led' && corpOnly }))}
          onChange={(managementModel) => setContext({ managementModel })} />
      </Field>
      <Field id="k3" label="Was haben Sie mit dem Unternehmen vor?" note="Mehrfachauswahl möglich">
        <CheckboxGroup label="Was haben Sie mit dem Unternehmen vor?" layout="list" values={ctx.intents}
          choices={INTENT_OPTIONS.map((o) => ({ value: o.value, label: intentLabel(ctx, o.value) }))}
          onToggle={(v) => setContext({ intents: toggleIntent(ctx.intents, v) })} />
      </Field>
      <Field id="k4" label="Kann Ihr Unternehmen alle Zahlungen der nächsten sechs Monate sicher leisten?">
        <RadioGroup label="Kann Ihr Unternehmen alle Zahlungen der nächsten sechs Monate sicher leisten?" layout="list" value={ctx.liquidity}
          choices={LIQUIDITY_OPTIONS} onChange={(liquidity) => setContext({ liquidity })} />
      </Field>
      <div className="nav-row">
        <button type="button" className="btn btn-ghost" onClick={() => navigate('/')}>Zurück</button>
        <div className="right">
          {!ok && <span className="hint">Bitte beantworten Sie alle vier Fragen.</span>}
          <button type="button" className="btn btn-lime" disabled={!ok}
            onClick={() => go(crisisReason(ctx) ? 'crisis' : setupComplete(ctx) ? 'overview' : 'setup1')}>Weiter</button>
        </div>
      </div>
    </main>
  );
}

/** Crisis end (AB5, ER9): no setup, no values, no atares button. The answers stay saved. */
export function CrisisScreen() {
  const { ctx } = useAssessment();
  const reason = crisisReason(ctx);
  const text = reason === 'liquidity'
    ? 'Bei akuten Zahlungsschwierigkeiten ist ein Verkauf in der Regel erst nach einer Stabilisierung möglich. ExitIQ zeigt deshalb keine Readiness-Bewertung. Wir empfehlen, zuerst einen Sanierungsspezialisten hinzuzuziehen.'
    : 'Bei einer Krise steht zuerst die Stabilisierung des Unternehmens im Vordergrund. ExitIQ zeigt deshalb keine Readiness-Bewertung. Wir empfehlen, zuerst einen Sanierungsspezialisten hinzuzuziehen.';
  return (
    <section className="glass crisis-card" aria-labelledby="crisis-title">
      <h1 id="crisis-title" className="h3">Zuerst die Stabilisierung</h1>
      <p>{text}</p>
      <p className="muted-light">Ihre Angaben sind gespeichert.</p>
      <div>
        <button type="button" className="btn btn-ghost" onClick={() => go('context')}>Angaben ändern</button>
      </div>
    </section>
  );
}
