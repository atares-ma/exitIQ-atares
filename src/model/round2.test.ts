// Acceptance criteria of "261125 ExitIQ Änderungsliste Runde 2".

import { describe, expect, it } from 'vitest';
import { blankContext } from '../lib/context';
import { deepList, progressTotal, questionPosition, totalLabel } from '../lib/journey';
import { changeNotice } from '../lib/store';
import { cardData } from './cards';
import { QUESTIONS } from './catalogue';
import { buildResult } from './plan';
import type { AnswerMap, AssessmentContext, Points } from './types';

const T = '2026-11-25T09:00:00.000Z';
const ctxOf = (p: Partial<AssessmentContext>): AssessmentContext => ({ ...blankContext(), ...p, company: { ...blankContext().company, ...p.company } });
const sub = (points: Points): AnswerMap[string] => ({ status: 'substantive', points, answeredAt: T });
const pos = (ctx: AssessmentContext, id: string, a: AnswerMap = {}) => questionPosition(ctx, deepList(ctx, a).findIndex((x) => x.q.id === id));

const florian = ctxOf({
  ownershipTags: ['private_family'], managementModel: 'employed', intents: ['whole'], liquidity: 'no_pressure', horizon: 'm6_18',
  topics: ['debt', 'acquisitions', 'employee_equity', 'regulated', 'contingent'], seller: 'individuals_domestic',
  company: { largestCustomer: '20_30' } as AssessmentContext['company'],
});

describe('R2-01 Fortschrittsanzeige', () => {
  it('estimates ca. 40 before and right after K1 to K3', () => {
    expect(totalLabel(progressTotal(blankContext(), {}))).toBe('ca. 40');
    const k = ctxOf({ ownershipTags: ['private_family'], managementModel: 'employed', intents: ['whole'], liquidity: 'no_pressure' });
    expect(totalLabel(progressTotal(k, {}))).toBe('ca. 40');
  });
  it('counts the Florian case exactly: Q01 8, Q19 16, Q14 27, Q41 42 of 42', () => {
    expect(progressTotal(florian, {})).toEqual({ total: 42, approx: false });
    expect(pos(florian, 'Q01')).toBe(8);
    expect(pos(florian, 'Q19')).toBe(16);
    expect(pos(florian, 'Q14')).toBe(27);
    expect(pos(florian, 'Q41')).toBe(42);
  });
  it('never raises the total when only a part is sold; a statement at Q53 lowers it by 1', () => {
    const part = ctxOf({ ownershipTags: ['corporate_group'], managementModel: 'employed', intents: ['part'], liquidity: 'no_pressure', horizon: 'm6_18', seller: 'holding', sellerTax: 'same' });
    const t0 = progressTotal(part, {}).total;
    expect(progressTotal(part, { Q53: { status: 'not_applicable', answeredAt: T } }).total).toBe(t0);
    expect(progressTotal(part, { Q53: sub(50) }).total).toBe(t0 - 1);
  });
  it('words the change notice', () => {
    expect(changeNotice(2)).toBe('Durch Ihre Änderung kommen 2 Fragen hinzu.');
    expect(changeNotice(-2)).toBe('Durch Ihre Änderung entfallen 2 Fragen.');
  });
});

describe('R2-02 Widerspruch statt fehlende Antworten', () => {
  const ctx = ctxOf({ ownershipTags: ['private_family'], managementModel: 'owner_led', intents: ['open'], liquidity: 'no_pressure', horizon: 'undecided', topicsNone: true, seller: 'individuals_domestic' });
  const answers: AnswerMap = {};
  for (const x of deepList(ctx, {})) answers[x.q.id] = sub(100);
  answers.Q01 = sub(0);
  answers.Q05 = sub(100);
  it('reports Q01 and Q05 as a contradiction, not as missing', () => {
    const r = buildResult(ctx, answers);
    const S = r.dimensions[0];
    expect(S.openIds).not.toContain('Q01');
    expect(S.openIds).not.toContain('Q05');
    expect(S.reasons).toContainEqual({ kind: 'contradiction', ids: ['Q01', 'Q05'] });
    const c = cardData(S, r.score, ctx, answers);
    expect(S.displayIndex).toBeNull();
    expect(c.blockedByContradiction).toBe(true);
    expect(c.contradictedIds).toEqual(['Q01', 'Q05']);
  });
});

describe('R2-03 Zeitpunkte nach Dringlichkeit', () => {
  const answers: AnswerMap = {};
  for (const x of deepList(florian, {})) answers[x.q.id] = sub(100);
  Object.assign(answers, {
    Q41: sub(50), Q02: sub(0), Q06: sub(0), Q01: sub(50), Q12: sub(0), Q14: sub(0), Q39: sub(0),
    Q16: { status: 'clarify', answeredAt: T }, Q21: sub(50), Q23: sub(0), Q24: sub(0),
  });
  const r = buildResult(florian, answers);
  const tierOf = (id: string) => r.tasks.find((t) => t.questionIds[0] === id)!.suggestedTiming;
  it('puts Q41 and Q02 first, then Q06, Q01, Q12', () => {
    expect(r.topSteps.map((t) => t.questionIds[0])).toEqual(['Q41', 'Q02', 'Q06', 'Q01', 'Q12']);
  });
  it('uses three tiers and keeps waiting tasks behind what they wait for', () => {
    expect(tierOf('Q41')).toBe('Sofort');
    expect(tierOf('Q02')).toBe('Sofort');
    for (const id of ['Q06', 'Q01', 'Q12', 'Q14', 'Q39', 'Q16']) expect(tierOf(id)).toBe('In den nächsten 2 Monaten');
    expect(tierOf('Q23')).toBe('In den nächsten 6 Monaten');
    expect(tierOf('Q24')).toBe('In den nächsten 6 Monaten');
  });
});

describe('R2-04 Keine Frage-IDs in Nutzertexten', () => {
  it('has no question id in evidence, task or checklist texts', () => {
    const ID = /\bQ\d{2}\b/;
    for (const q of QUESTIONS) expect(q.evidence).not.toMatch(ID);
    const r = buildResult(florian, { Q01: sub(0), Q05: sub(100), Q08: sub(0) });
    for (const t of r.tasks) expect(`${t.title} ${t.reason ?? ''} ${t.evidence ?? ''}`).not.toMatch(ID);
    for (const c of r.checklist) expect(c.title).not.toMatch(ID);
  });
});

describe('R2-09 Ergebniskarten', () => {
  it('shows "3 von 4" for Finanzielle Vorbereitung in the private succession with Q24 open', () => {
    const ctx = ctxOf({
      ownershipTags: ['private_family'], managementModel: 'owner_led', intents: ['whole'], liquidity: 'no_pressure', horizon: 'm19_36',
      topics: ['debt'], seller: 'individuals_domestic', company: { largestCustomer: '10_20' } as AssessmentContext['company'],
    });
    const answers: AnswerMap = {};
    for (const x of deepList(ctx, {})) answers[x.q.id] = sub(50);
    answers.Q24 = { status: 'lookup', answeredAt: T };
    const r = buildResult(ctx, answers);
    const T3 = r.dimensions[2];
    const t1 = cardData(T3, r.score, ctx, answers).areas.find((a) => a.key === 'T1')!;
    expect([t1.answered, t1.total, t1.value]).toEqual([3, 4, null]);
  });
  it('without a value shows the answered count and from how many answers the value appears', () => {
    const answers: AnswerMap = {};
    deepList(florian, {}).filter((x) => x.q.domain[0] === 'O').slice(0, 5).forEach((x) => { answers[x.q.id] = sub(100); });
    const r = buildResult(florian, answers);
    const c = cardData(r.dimensions[1], r.score, florian, answers);
    expect(r.dimensions[1].displayIndex).toBeNull();
    expect(c.answered).toBe(5);
    expect(c.valueFrom).toBeGreaterThan(5);
    expect(c.areas.every((a) => a.value == null)).toBe(true);
  });
});
