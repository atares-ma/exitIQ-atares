import { useState } from 'react';
import { CheckboxGroup, Field, Glossed, RadioGroup } from '../../components/ui';
import { positionsLabel, setup1Complete, setup2Complete } from '../../lib/journey';
import { ProgressCounter } from './Progress';
import { Notice } from './Notice';
import { go, setContext, useAssessment } from '../../lib/store';
import {
  BUSINESS_MODELS, COUNTRY_OPTIONS, EARNINGS_OPTIONS, EMPLOYEE_BANDS, HORIZON_OPTIONS, LARGEST_CUSTOMER_OPTIONS, OWNERSHIP_OPTIONS,
  RECURRING_OPTIONS, REVENUE_BANDS, SELLER_TAX_OPTIONS, TOPIC_OPTIONS, type Opt,
} from '../../model/options';
import { asksPerspective, asksSellerTax, investorWording, isPart, perspectiveCandidates, profileOf, sellerOptions } from '../../model/routing';
import type { CompanyProfile, OwnershipTag, Profile, Topic } from '../../model/types';

const PERSPECTIVE_TAGS: Record<Profile, OwnershipTag[]> = {
  OWNER: ['private_family', 'other'], CORPORATE: ['corporate_group'], PE: ['pe'], VC: ['vc'],
};

/** Setup page 1 (EI1–EI6): time horizon, the perspective only when K1 mixes perspectives, optional company details. */
export function Setup1() {
  const { ctx } = useAssessment();
  const ok = setup1Complete(ctx);
  const setCompany = (patch: Partial<CompanyProfile>) => setContext({ company: { ...ctx.company, ...patch } });
  const horizonLabel = investorWording(ctx) ? 'Wann möchten Sie potenzielle Investoren ansprechen?' : 'Wann möchten Sie potenzielle Käufer ansprechen?';
  const candidates = perspectiveCandidates(ctx);
  const perspectiveLabel = (p: Profile) =>
    OWNERSHIP_OPTIONS.filter((o) => PERSPECTIVE_TAGS[p].includes(o.value) && ctx.ownershipTags.includes(o.value)).map((o) => o.label).join(' / ');

  return (
    <main className="app-main">
      <div className="page-head">
        <ProgressCounter label={positionsLabel(5, asksPerspective(ctx) ? 6 : 5)} />
        <h1 className="h1 page-title">Starten wir mit der Detailbewertung.</h1>
      </div>
      <Notice />
      <Field id="f-hor" label={horizonLabel}>
        <RadioGroup label={horizonLabel} choices={HORIZON_OPTIONS} value={ctx.horizon} onChange={(horizon) => setContext({ horizon })} min="200px" />
      </Field>
      {asksPerspective(ctx) && (
        <Field id="f-prof" label="Wessen Sicht steht beim Verkauf im Vordergrund?">
          <RadioGroup label="Wessen Sicht steht beim Verkauf im Vordergrund?" value={ctx.profileOverride}
            choices={candidates.map((p) => ({ value: p, label: perspectiveLabel(p) }))} onChange={(profileOverride) => setContext({ profileOverride })} />
        </Field>
      )}
      <Field id="f-company" label="Unternehmensangaben (optional)">
        <div className="company-grid">
          <Select label="Geschäftsmodell" value={ctx.company.businessModel} options={BUSINESS_MODELS.map((v) => ({ value: v, label: v }))} onChange={(businessModel) => setCompany({ businessModel })} />
          <label className="select-field">
            Branche
            <input className="input" value={ctx.company.sector ?? ''} maxLength={80} placeholder="z. B. Medizintechnik" onChange={(e) => setCompany({ sector: e.target.value || null })} />
          </label>
          <Select label="Jahresumsatz" value={ctx.company.revenueBand} options={REVENUE_BANDS.map((v) => ({ value: v, label: v }))} onChange={(revenueBand) => setCompany({ revenueBand })} />
          <Select label="Mitarbeitende" value={ctx.company.employeeBand} options={EMPLOYEE_BANDS.map((v) => ({ value: v, label: v }))} onChange={(employeeBand) => setCompany({ employeeBand })} />
          <Select label="Land" value={ctx.company.country} options={COUNTRY_OPTIONS} onChange={(country) => setCompany({ country })} />
          <Select label="Ergebnis" value={ctx.company.earnings} options={EARNINGS_OPTIONS} onChange={(earnings) => setCompany({ earnings })} />
          <Select label={<Glossed text="Wie hoch ist der Anteil wiederkehrender Umsätze?" />} value={ctx.company.recurringShare} options={RECURRING_OPTIONS} onChange={(recurringShare) => setCompany({ recurringShare })} />
          <Select label="Wie viel Prozent Ihres Umsatzes macht Ihr größter Kunde aus?" value={ctx.company.largestCustomer} options={LARGEST_CUSTOMER_OPTIONS} onChange={(largestCustomer) => setCompany({ largestCustomer })} />
        </div>
      </Field>
      <div className="nav-row">
        <button type="button" className="btn btn-ghost" onClick={() => go('context')}>Zurück</button>
        <div className="right">
          {!ok && <span className="hint">Bitte beantworten Sie die Pflichtfragen.</span>}
          <button type="button" className="btn btn-lime" disabled={!ok} onClick={() => go('setup2')}>Weiter</button>
        </div>
      </div>
    </main>
  );
}

/** Setup page 2 (EI8–EI11): specialist topics as one multiple choice, the seller, the optional funding gap. */
export function Setup2() {
  const { ctx } = useAssessment();
  const ok = setup2Complete(ctx);
  const part = isPart(ctx);
  const [unsureOpen, setUnsureOpen] = useState(ctx.uncertainTopics.length > 0);
  const checked: Topic[] = part && !ctx.topics.includes('shared_services') ? [...ctx.topics, 'shared_services'] : ctx.topics;
  const NONE = 'none' as const;

  const toggleTopic = (v: Topic | typeof NONE) => {
    if (v === NONE) {
      setContext(ctx.topicsNone ? { topicsNone: false } : { topicsNone: true, topics: [], uncertainTopics: [] });
      return;
    }
    const topics = ctx.topics.includes(v) ? ctx.topics.filter((x) => x !== v) : [...ctx.topics, v];
    setContext({ topics, topicsNone: false, uncertainTopics: ctx.uncertainTopics.filter((x) => x !== v) });
  };
  const toggleUnsure = (v: Topic) => {
    const uncertainTopics = ctx.uncertainTopics.includes(v) ? ctx.uncertainTopics.filter((x) => x !== v) : [...ctx.uncertainTopics, v];
    setContext({ uncertainTopics, topics: ctx.topics.filter((x) => x !== v), topicsNone: false });
  };
  const unsureChoices = TOPIC_OPTIONS.filter((o) => !(part && o.value === 'shared_services'));
  const first = asksPerspective(ctx) ? 7 : 6;

  return (
    <main className="app-main">
      <div className="page-head">
        <ProgressCounter label={positionsLabel(first, first + 1)} />
        <h1 className="h1 page-title">Noch {profileOf(ctx) !== 'OWNER' ? 'drei' : 'zwei'} Angaben zu Ihrer Situation.</h1>
      </div>
      <Notice />
      <Field id="f-topics" label="Was trifft auf Ihr Unternehmen zu?" note="Mehrfachauswahl möglich">
        <CheckboxGroup label="Was trifft auf Ihr Unternehmen zu?" layout="list"
          values={[...(ctx.topicsNone ? [NONE] : []), ...checked.filter((t) => !ctx.uncertainTopics.includes(t))] as (Topic | typeof NONE)[]}
          choices={[
            ...TOPIC_OPTIONS.map((o) => ({ value: o.value as Topic | typeof NONE, label: <Glossed nested text={o.label} />, sub: o.sub, disabled: part && o.value === 'shared_services' })),
            { value: NONE, label: 'Nichts davon', disabled: part },
          ]}
          onToggle={toggleTopic} />
        {!unsureOpen ? (
          <button type="button" className="link-inline" onClick={() => setUnsureOpen(true)}>Bei einem Punkt bin ich unsicher</button>
        ) : (
          <div className="unsure-box">
            <p className="field-why" style={{ margin: 0 }}>Bei welchen Punkten sind Sie unsicher? Wir nehmen sie als Aufgabe in Ihren Maßnahmenplan auf.</p>
            <CheckboxGroup label="Bei welchen Punkten sind Sie unsicher?" min="260px" values={ctx.uncertainTopics}
              choices={unsureChoices.map((o) => ({ value: o.value, label: o.label }))} onToggle={toggleUnsure} />
          </div>
        )}
      </Field>
      <Field id="f-seller" label="Wer würde verkaufen?">
        <RadioGroup label="Wer würde verkaufen?" layout="list" value={ctx.seller} choices={sellerOptions(ctx)}
          onChange={(seller) => setContext({ seller, sellerTax: seller === 'holding' || seller === 'funds' || seller === 'mixed' ? ctx.sellerTax : null })} />
        {asksSellerTax(ctx) && (
          <div className="followup">
            <h3 className="followup-label"><Glossed text="Wo sind die Verkäufer steuerpflichtig?" /></h3>
            <RadioGroup label="Wo sind die Verkäufer steuerpflichtig?" value={ctx.sellerTax} choices={SELLER_TAX_OPTIONS} min="200px"
              onChange={(sellerTax) => setContext({ sellerTax })} />
          </div>
        )}
      </Field>
      {profileOf(ctx) !== 'OWNER' && (
        <Field id="f-gap" label="Gibt es bis zum geplanten Verkauf eine Finanzierungslücke ohne vereinbarte Überbrückung?" note="Optional">
          <RadioGroup label="Finanzierungslücke" value={ctx.fundingGapConfirmed} min="140px"
            choices={[{ value: 'yes', label: 'Ja' }, { value: 'no', label: 'Nein' }] as Opt<'yes' | 'no'>[]}
            onChange={(fundingGapConfirmed) => setContext({ fundingGapConfirmed })} />
        </Field>
      )}
      <div className="nav-row">
        <button type="button" className="btn btn-ghost" onClick={() => go('setup1')}>Zurück</button>
        <div className="right">
          {!ok && <span className="hint">Bitte beantworten Sie die Pflichtfragen.</span>}
          <button type="button" className="btn btn-lime" disabled={!ok} onClick={() => go('overview')}>Weiter</button>
        </div>
      </div>
    </main>
  );
}

function Select<T extends string>({ label, value, options, onChange }: {
  label: React.ReactNode; value: T | null; options: { value: T; label: string }[]; onChange: (v: T | null) => void;
}) {
  return (
    <label className="select-field">
      {label}
      <select className="input" value={value ?? ''} onChange={(e) => onChange((e.target.value || null) as T | null)}>
        <option value="">Bitte wählen</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}
