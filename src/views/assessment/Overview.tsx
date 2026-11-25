import { useState } from 'react';
import { RadioGroup } from '../../components/ui';
import { chapterCount, contextDone, deepList, progressTotal, setupCountedDone, totalLabel } from '../../lib/journey';
import { go, setContext, useAssessment, type Screen } from '../../lib/store';
import { PROFILE_NAMES } from '../../model/catalogue';
import {
  COUNTRY_OPTIONS, EARNINGS_OPTIONS, HORIZON_OPTIONS, LARGEST_CUSTOMER_OPTIONS, RECURRING_OPTIONS, LIQUIDITY_OPTIONS, MANAGEMENT_OPTIONS, OWNERSHIP_OPTIONS, SELLER_TAX_OPTIONS, TOPIC_SHORT, labelOf,
} from '../../model/options';
import {
  activeTopics, asksSellerTax, autoProfile, intentLabel, investorWording, isAutoAnswered, profileOf, scopeQuestions, sellerLabel, uncertainTopics,
} from '../../model/routing';
import type { Profile } from '../../model/types';
import { Notice } from './Notice';

/** Overview of the settings before the questions (EI12). */
export function Overview() {
  const s = useAssessment();
  const { ctx } = s;
  const [editProfile, setEditProfile] = useState(false);
  const list = deepList(ctx, s.answers);
  const n = list.length;
  const k = chapterCount(list);
  const m = scopeQuestions(ctx, s.answers).filter((q) => isAutoAnswered(q.id, ctx)).length;
  const started = list.some((x) => !!s.answers[x.q.id]);
  const total = progressTotal(ctx, s.answers);
  const given = contextDone(ctx) + setupCountedDone(ctx);
  const sub = [
    `${given} von ${totalLabel(total)} Angaben haben Sie schon gemacht. Es folgen ${n} Fragen in ${k} Kapiteln.`,
    m === 1 ? 'Eine Frage ist durch Ihre Angaben bereits beantwortet.' : m > 1 ? `${m} Fragen sind durch Ihre Angaben bereits beantwortet.` : null,
    'Nach Kapitel 4 sehen Sie ein erstes Zwischenergebnis.',
  ].filter(Boolean).join(' ');

  // R2-12: every filled field counts; the largest customer (it steers Q09) comes first.
  const company = [
    ctx.company.largestCustomer ? `Größter Kunde: ${labelOf(LARGEST_CUSTOMER_OPTIONS, ctx.company.largestCustomer)}` : null,
    ctx.company.businessModel, ctx.company.sector, ctx.company.revenueBand ? `Umsatz: ${ctx.company.revenueBand}` : null,
    ctx.company.employeeBand ? `Mitarbeitende: ${ctx.company.employeeBand}` : null,
    ctx.company.country ? labelOf(COUNTRY_OPTIONS, ctx.company.country) : null,
    ctx.company.recurringShare ? `Wiederkehrende Umsätze: ${labelOf(RECURRING_OPTIONS, ctx.company.recurringShare)}` : null,
    ctx.company.earnings ? `Ergebnis: ${labelOf(EARNINGS_OPTIONS, ctx.company.earnings)}` : null,
  ].filter(Boolean).join(' · ');
  const topics = activeTopics(ctx);
  const unsure = uncertainTopics(ctx);

  const rows: { label: string; value: string; chips?: { label: string; unsure?: boolean }[]; edit: Screen | 'profile' }[] = [
    { label: 'Eigentümer und Führung', value: `${ctx.ownershipTags.map((t) => labelOf(OWNERSHIP_OPTIONS, t)).join(', ')} · ${labelOf(MANAGEMENT_OPTIONS, ctx.managementModel)}`, edit: 'context' },
    { label: 'Vorhaben', value: ctx.intents.map((i) => intentLabel(ctx, i)).join(', '), edit: 'context' },
    { label: 'Zahlungen der nächsten sechs Monate', value: labelOf(LIQUIDITY_OPTIONS, ctx.liquidity), edit: 'context' },
    { label: 'Perspektive', value: PROFILE_NAMES[profileOf(ctx)], edit: 'profile' },
    { label: investorWording(ctx) ? 'Ansprache der Investoren' : 'Ansprache der Käufer', value: labelOf(HORIZON_OPTIONS, ctx.horizon), edit: 'setup1' },
    { label: 'Unternehmensangaben', value: company || 'Keine Angaben', edit: 'setup1' },
    {
      label: 'Spezialthemen', value: topics.length || unsure.length ? '' : 'Nichts davon', edit: 'setup2',
      chips: [...topics.map((t) => ({ label: TOPIC_SHORT[t] })), ...unsure.map((t) => ({ label: `${TOPIC_SHORT[t]}: noch ungeklärt`, unsure: true }))],
    },
    {
      label: 'Verkäufer', edit: 'setup2',
      value: ctx.seller ? `${sellerLabel(ctx, ctx.seller)}${asksSellerTax(ctx) && ctx.sellerTax ? ` · ${labelOf(SELLER_TAX_OPTIONS, ctx.sellerTax)}` : ''}` : 'Nicht angegeben',
    },
  ];

  return (
    <>
      <div className="page-head">
        <span className="kicker">Übersicht</span>
        <h1 className="h1 page-title">Ihre Angaben im Überblick</h1>
        <p className="lead page-sub">{sub}</p>
      </div>
      <Notice />
      <div className="card-light" style={{ padding: 0, overflow: 'hidden' }}>
        <dl style={{ margin: 0 }}>
          {rows.map((r) => (
            <div key={r.label} className="summary-row">
              <dt className="summary-dt">{r.label}</dt>
              <dd style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {r.value && <span style={{ fontWeight: 600 }}>{r.value}</span>}
                {r.chips && r.chips.length > 0 && (
                  <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {r.chips.map((c) => (
                      <span key={c.label} className="pill" style={c.unsure ? { background: 'var(--white)', border: '1px dashed var(--grey-3)' } : { background: 'var(--grey-1)', border: '1px solid var(--grey-2)' }}>{c.label}</span>
                    ))}
                  </span>
                )}
                {r.edit === 'profile' && editProfile && (
                  <div className="profile-edit">
                    <RadioGroup<Profile> label="Perspektive" value={profileOf(ctx)} min="180px"
                      choices={(['OWNER', 'CORPORATE', 'PE', 'VC'] as Profile[]).map((p) => ({ value: p, label: PROFILE_NAMES[p], tag: p === autoProfile(ctx) ? 'aus Ihren Angaben' : undefined }))}
                      onChange={(p) => { setContext({ profileOverride: p === autoProfile(ctx) ? null : p }); setEditProfile(false); }} />
                  </div>
                )}
              </dd>
              <dd className="summary-edit" style={{ margin: 0 }}>
                <button type="button" className="edit-link" aria-label={`${r.label} bearbeiten`}
                  onClick={() => (r.edit === 'profile' ? setEditProfile((x) => !x) : go(r.edit))}>Bearbeiten</button>
              </dd>
            </div>
          ))}
        </dl>
        <div className="summary-foot">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" className="btn btn-outline" onClick={() => go('setup2')}>Zurück</button>
            <button type="button" className="btn btn-lime" onClick={() => go('deep')}>{started ? 'Fragen fortsetzen' : 'Weiter zu Kapitel 1'} <span aria-hidden="true">→</span></button>
          </div>
        </div>
      </div>
    </>
  );
}
