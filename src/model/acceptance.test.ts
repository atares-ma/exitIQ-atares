// Acceptance cases from section 12 of the change list (input counts, question
// counts, routing, wording, status lines, rules and the carve-out arithmetic).
// The full answer sets of the source documents are not part of this repo, so
// the value checks use the figures the change list states explicitly.

import { describe, expect, it } from 'vitest';
import { blankContext } from '../lib/context';
import { deepList, inputsUpTo, setupComplete } from '../lib/journey';
import { QUESTION_BY_ID } from './catalogue';
import { buildResult } from './plan';
import {
  asksPerspective, contributorOf, questionText, resolveRoutes, scopeQuestions, shownQuestions, statusLine, toggleIntent,
} from './routing';
import { computeScores } from './scoring';
import type { AnswerMap, AssessmentContext, Points } from './types';

const T = '2026-11-24T09:00:00.000Z';
const ctxOf = (p: Partial<AssessmentContext>): AssessmentContext => ({ ...blankContext(), ...p, company: { ...blankContext().company, ...p.company } });
const ids = (ctx: AssessmentContext, a: AnswerMap = {}) => shownQuestions(ctx, a).map((q) => q.id);
const sub = (points: Points, followUp?: 'yes' | 'no'): AnswerMap[string] => ({ status: 'substantive', points, answeredAt: T, followUp });
const laterIds = (ctx: AssessmentContext, a: AnswerMap = {}) => deepList(ctx, a).filter((x) => x.chapter > 3).map((x) => x.q.id);

const florian = ctxOf({
  ownershipTags: ['private_family'], managementModel: 'employed', intents: ['whole'], liquidity: 'no_pressure', horizon: 'm6_18',
  topics: ['debt', 'acquisitions', 'employee_equity', 'regulated', 'contingent'], seller: 'individuals_domestic',
  company: { largestCustomer: '20_30' } as AssessmentContext['company'],
});

describe('Florian (Privat, angestellt, ganz verkaufen, 5 Spezialthemen, Privatpersonen im Inland)', () => {
  it('has 35 questions in 8 chapters, Q26 answered automatically, Q28 not asked', () => {
    const list = deepList(florian, {});
    expect(list).toHaveLength(35);
    expect(new Set(list.map((x) => x.chapter)).size).toBe(8);
    expect(scopeQuestions(florian, {}).map((q) => q.id)).toContain('Q26');
    expect(ids(florian)).not.toContain('Q26');
    expect(ids(florian)).not.toContain('Q28');
    expect(setupComplete(florian)).toBe(true);
  });
  it('needs 27 inputs up to the interim result and 43 to the result (with the Q37 extra line)', () => {
    expect(inputsUpTo(florian, {}, 3)).toBe(27);
    expect(laterIds(florian)).toHaveLength(15);
    expect(inputsUpTo(florian, { Q37: sub(50, 'no') }, 7)).toBe(43);
  });
  it('shows the status lines of I46', () => {
    const line = (id: string) => statusLine(QUESTION_BY_ID[id], florian);
    expect([line('Q25'), line('Q31'), line('Q39')]).toEqual([null, null, null]);
    expect([line('Q16'), line('Q22'), line('Q29')]).toEqual(['clarify', 'clarify', 'clarify']);
    expect(line('Q32')).toBe('lookup');
    expect(line('Q41')).toBeNull();
  });
  it('uses family contact persons', () => {
    const forbidden = /Gremien|Gremienbüro|Konzern-M&A|Konzernsteuerabteilung|Separierungsleitung|Integrationsleitung|Transaktionsleitung|Finanzinvestor/;
    for (const q of scopeQuestions(florian, {})) expect(contributorOf(q, florian)).not.toMatch(forbidden);
  });
  it('words Q01 and Q06 for employed management', () => {
    expect(questionText(QUESTION_BY_ID.Q01, florian).question).toContain('die Rolle der Geschäftsführung');
    expect(questionText(QUESTION_BY_ID.Q06, florian).question).toBe('Ist festgelegt, welche Rolle die heutige Geschäftsführung nach dem Verkauf übernimmt und wie lange?');
    expect(questionText(QUESTION_BY_ID.Q05, florian).question).toContain('in der Familie');
  });
  it('counts Q26 as answered with 100 points and lists the documents', () => {
    const r = buildResult(florian, {});
    expect(r.score.controls.Q26).toMatchObject({ points: 100, known: true, auto: true });
    expect(r.checklist.map((c) => c.key)).toEqual(['DOC:Q30', 'DOC:Q40', 'DOC:Q42', 'DOC:Q43', 'DOC:Q26']);
  });
});

describe('Private Nachfolge (Inhaber, IT-Dienstleister)', () => {
  const ctx = ctxOf({
    ownershipTags: ['private_family'], managementModel: 'owner_led', intents: ['whole'], liquidity: 'no_pressure', horizon: 'm19_36',
    topics: ['debt'], seller: 'individuals_domestic',
    company: { businessModel: 'IT- und Technologiedienstleistungen', largestCustomer: '10_20' } as AssessmentContext['company'],
  });
  it('needs 26 inputs up to the interim result and 38 in total', () => {
    expect(inputsUpTo(ctx, {}, 3)).toBe(26);
    expect(inputsUpTo(ctx, {}, 7)).toBe(38);
  });
  it('asks Q11 with the IT services example and Q12 in the owner wording', () => {
    expect(questionText(QUESTION_BY_ID.Q11, ctx).question).toContain('z. B. ein Subunternehmer oder Cloud-Anbieter?');
    expect(questionText(QUESTION_BY_ID.Q12, ctx).question).toBe('Was würde ins Stocken geraten, wenn Sie vier Wochen nicht da wären?');
    expect(statusLine(QUESTION_BY_ID.Q22, ctx)).toBeNull();
    expect(statusLine(QUESTION_BY_ID.Q24, ctx)).toBe('lookup');
  });
});

describe('PE Buy-and-Build', () => {
  const ctx = ctxOf({
    ownershipTags: ['pe', 'private_family'], managementModel: 'employed', intents: ['whole'], liquidity: 'no_pressure', horizon: 'under_6',
    profileOverride: 'PE', topics: ['debt', 'acquisitions', 'employee_equity', 'regulated', 'contingent', 'restructuring'],
    seller: 'funds', sellerTax: 'same', company: { largestCustomer: 'o30' } as AssessmentContext['company'],
  });
  it('asks the perspective and needs 30 inputs up to the interim result, 18 later questions, 49 in total', () => {
    expect(asksPerspective(ctx)).toBe(true);
    expect(inputsUpTo(ctx, {}, 3)).toBe(30);
    expect(laterIds(ctx)).toHaveLength(18);
    expect(inputsUpTo(ctx, { Q28: sub(100, 'yes'), Q37: sub(0) }, 7)).toBe(49);
  });
  it('puts R04 at the very top when a deadline affects the timetable', () => {
    const r = buildResult(ctx, { Q28: sub(100, 'yes') });
    expect(r.risks[0].rule).toBe('R04');
    expect(r.topSteps[0].ruleId).toBe('R04');
  });
  it('words Q04 for investors and Q24 without "persönlichen"', () => {
    expect(questionText(QUESTION_BY_ID.Q04, ctx).question).toContain('Investmentkomitee');
    expect(questionText(QUESTION_BY_ID.Q24, ctx).question).toContain('z. B. Bürgschaften oder Grundschulden');
  });
});

describe('VC-finanziert, Wachstum (CFO, gemischt)', () => {
  const ctx = ctxOf({
    ownershipTags: ['vc'], managementModel: 'mixed', intents: ['investor'], liquidity: 'no_pressure', horizon: 'm6_18',
    topicsNone: true, seller: 'mixed', sellerTax: 'same', company: { largestCustomer: 'u10' } as AssessmentContext['company'],
  });
  it('needs 27 inputs up to the interim result and 41 in total; Q09 automatic', () => {
    expect(inputsUpTo(ctx, {}, 3)).toBe(27);
    expect(inputsUpTo(ctx, {}, 7)).toBe(41);
    expect(ids(ctx)).not.toContain('Q09');
  });
  it('uses the growth wording for Q07 without an earnings answer and the profit wording with it', () => {
    expect(questionText(QUESTION_BY_ID.Q07, ctx).question).toBe('Können Sie zeigen, wie sich Ihr Wachstum in dauerhaften Gewinn übersetzt?');
    const profit = ctxOf({ ...ctx, company: { ...ctx.company, earnings: 'profit' } });
    expect(questionText(QUESTION_BY_ID.Q07, profit).question).toContain('dauerhaft erwirtschaftet');
  });
});

describe('Konzern-Carve-out (Geschäftsbereich)', () => {
  const ctx = ctxOf({
    ownershipTags: ['corporate_group'], managementModel: 'employed', intents: ['part'], liquidity: 'no_pressure', horizon: 'm6_18',
    seller: 'holding', sellerTax: 'same', company: { largestCustomer: 'u10' } as AssessmentContext['company'],
  });
  it('needs 30 inputs up to the interim result and 43 in total', () => {
    expect(inputsUpTo(ctx, {}, 3)).toBe(30);
    expect(inputsUpTo(ctx, {}, 7)).toBe(43);
  });
  it('asks Q45 instead of Q21, Q53 instead of Q34, answers Q26 automatically and still asks Q09', () => {
    const list = ids(ctx);
    expect(list).toContain('Q45');
    expect(list).not.toContain('Q21');
    expect(list).toContain('Q53');
    expect(list).not.toContain('Q34');
    expect(list).not.toContain('Q26');
    expect(list).toContain('Q09');
    // Q53 "Trifft auf uns nicht zu" brings Q34 back.
    expect(ids(ctx, { Q53: { status: 'not_applicable', answeredAt: T } })).toContain('Q34');
  });
  it('calculates T1 = 29 from Q22 50, Q23 50 and Q45 0', () => {
    const s = computeScores(ctx, { Q22: sub(50), Q23: sub(50), Q45: sub(0) });
    const t1 = s.dimensions[2].domains.find((d) => d.key === 'T1')!;
    expect(Math.round(t1.index!)).toBe(29);
  });
  it('does not trigger R05 with Q46 = 50', () => {
    const r = buildResult(ctx, { Q46: sub(50), Q48: sub(50) });
    expect(r.risks.find((k) => k.rule === 'R05')).toBeUndefined();
  });
  it('has 37 questions as a subsidiary with the shared-services topic, without Q53', () => {
    const sub37 = ctxOf({ ...ctx, intents: ['whole'], topics: ['shared_services'], seller: 'unknown', sellerTax: null });
    expect(ids(sub37)).toHaveLength(37);
    expect(ids(sub37)).not.toContain('Q53');
  });
});

describe('Krise', () => {
  it('ends after the context page without questions or values', () => {
    for (const p of [{ liquidity: 'acute' as const, intents: ['whole' as const] }, { liquidity: 'no_pressure' as const, intents: ['crisis' as const] }]) {
      const ctx = ctxOf({ ownershipTags: ['private_family'], managementModel: 'owner_led', ...p });
      expect(deepList(ctx, {})).toHaveLength(0);
      const r = buildResult(ctx, {});
      expect(r.crisis).not.toBeNull();
      expect(r.tasks).toHaveLength(0);
      expect(r.dimensions.every((d) => d.displayIndex == null)).toBe(true);
    }
  });
});

describe('Inhaber, K3 „Noch offen“', () => {
  const ctx = ctxOf({
    ownershipTags: ['private_family'], managementModel: 'owner_led', intents: ['open'], liquidity: 'no_pressure', horizon: 'undecided',
    topicsNone: true, seller: 'individuals_domestic', company: { largestCustomer: '20_30' } as AssessmentContext['company'],
  });
  it('has 30 questions, none of Q44–Q49 or Q53, the scope task at the top and the note', () => {
    const list = ids(ctx);
    expect(list).toHaveLength(30);
    for (const id of ['Q44', 'Q45', 'Q46', 'Q47', 'Q48', 'Q49', 'Q53']) expect(list).not.toContain(id);
    const r = buildResult(ctx, {});
    expect(r.topSteps[0].title).toBe('Verkaufsumfang festlegen');
    expect(r.scopeOpenNote).toBe(true);
  });
  it('words Q01 and Q05 at 100 including not selling', () => {
    expect(questionText(QUESTION_BY_ID.Q01, ctx).anchors[2]).toContain('einschließlich der Möglichkeit, nicht zu verkaufen');
    expect(questionText(QUESTION_BY_ID.Q05, ctx).anchors[2]).toContain('einschließlich Weiterführen ohne Verkauf');
  });
});

describe('Bewertung und Regeln', () => {
  const owner = ctxOf({
    ownershipTags: ['private_family'], managementModel: 'owner_led', intents: ['whole'], liquidity: 'potential', horizon: 'under_6',
    topicsNone: true, seller: 'individuals_domestic',
  });
  it('shows a value from 80 % coverage as provisional with a range, without a domain threshold', () => {
    const answers: AnswerMap = {};
    for (const id of ['Q01', 'Q02', 'Q05', 'Q06', 'Q03']) answers[id] = sub(100);
    answers.Q04 = { status: 'clarify', answeredAt: T };
    const s = computeScores(owner, answers).dimensions[0];
    expect(s.status).toBe('provisional');
    expect(s.displayIndex).toBe(100);
    expect(Math.round(s.lower)).toBe(86);
    expect(Math.round(s.upper)).toBe(100);
  });
  it('triggers R07 only for Q01 = 0 with Q05 = 100, never for Q03', () => {
    expect(buildResult(owner, { Q01: sub(0), Q03: sub(100) }).risks.find((r) => r.rule === 'R07')).toBeUndefined();
    expect(buildResult(owner, { Q01: sub(0), Q05: sub(100) }).risks.find((r) => r.rule === 'R07')).toBeDefined();
  });
  it('puts the liquidity task at the very top for K4 "Wahrscheinlich" and Q08 = 0', () => {
    const r = buildResult(owner, { Q08: sub(0), Q04: sub(0) });
    expect(r.topSteps[0].title).toBe('Liquiditätsplanung für die nächsten 12 Monate aufstellen und Finanzierungsbedarf klären');
    expect(r.topSteps[1].ruleId).toBe('R02');
  });
  it('never triggers a rule from a status answer', () => {
    const r = buildResult(owner, { Q04: { status: 'clarify', answeredAt: T }, Q32: { status: 'lookup', answeredAt: T } });
    expect(r.risks).toHaveLength(0);
  });
  it('marks an uncertain topic as provisional and adds its task', () => {
    const ctx = ctxOf({ ...owner, topicsNone: false, uncertainTopics: ['debt'] });
    expect(resolveRoutes(ctx).DEBT).toBe(false);
    const r = buildResult(ctx, {});
    expect(r.tasks.map((t) => t.title)).toContain('Prüfen, ob Kredite, Gesellschafterdarlehen oder Sicherheiten bestehen');
    expect(r.dimensions[2].reasons).toContainEqual({ kind: 'topic', topic: 'debt' });
  });
  it('shows the atares note only for Q41 = 0 or 50', () => {
    expect(buildResult(owner, { Q41: sub(50) }).adviserNote).toBe(true);
    expect(buildResult(owner, { Q41: sub(100) }).adviserNote).toBe(false);
  });
});

describe('K3 option rules', () => {
  it('locks combinations', () => {
    expect(toggleIntent(['whole'], 'part')).toEqual(['part']);
    expect(toggleIntent(['whole'], 'shares')).toEqual(['shares']);
    expect(toggleIntent(['shares'], 'investor')).toEqual(['shares', 'investor']);
    expect(toggleIntent(['shares', 'investor'], 'open')).toEqual(['open']);
    expect(toggleIntent(['open'], 'whole')).toEqual(['whole']);
  });
});
