// Section 9: deterministic scoring. The formula and the domain weights per
// perspective are unchanged; thresholds, status logic and the handling of
// automatic or dropped questions follow BW1–BW11.
//
// For a dimension: p_d = domain percentage, A_d = questions in scope of the
// domain (without "Trifft auf uns nicht zu"), u_q = local weight.
//   e_q = p_d * u_q / sum(u_j, j in A_d)
// K = questions with a usable answer (three statements, or answered
// automatically with 100 points).
//   C = sum(e_q, K) / 100                     answer coverage
//   R = sum(e_q * a_q, K) / sum(e_q, K)       value (null when K is empty)
//   L = sum(e_q * a_q, K) / 100,  U = L + sum(e_q, outside K)   range
// A value is shown from 80 % coverage (BW4); 80–99 % is "vorläufig" with the
// range. The 50 %-per-domain rule is gone.

import { DIMENSIONS, DOMAIN_NAMES, PROFILE_WEIGHTS } from './catalogue';
import { crisisReason, isAutoAnswered, profileOf, resolveRoutes, scopeQuestions, sellerUnresolved, uncertainTopics } from './routing';
import type { Answer, AnswerMap, AssessmentContext, DimensionKey, DomainKey, Points, Profile, QuestionDef, RouteMap, Topic } from './types';

export const DISPLAY_COVERAGE_MIN = 0.8;
const EPS = 1e-9;

export type DimensionStatus = 'complete' | 'provisional' | 'insufficient';

/** Why a dimension is provisional (BW5, BW6). */
export type ProvisionalReason =
  | { kind: 'open'; ids: string[] }
  | { kind: 'topic'; topic: Topic }
  | { kind: 'seller' }
  | { kind: 'contradiction'; ids: string[] };

export interface ControlResult {
  id: string;
  domain: DomainKey;
  effectiveWeight: number;
  points: Points | null;
  known: boolean;
  auto: boolean;
}

export interface DomainResult {
  key: DomainKey;
  name: string;
  weight: number;
  index: number | null;
  localCoverage: number;
}

export interface DimensionResult {
  key: DimensionKey;
  name: string;
  status: DimensionStatus;
  rawIndex: number | null;
  displayIndex: number | null;
  coverage: number;
  lower: number;
  upper: number;
  /** Questions in scope without a usable answer, in chapter order. */
  openIds: string[];
  reasons: ProvisionalReason[];
  domains: DomainResult[];
}

export interface ScoreResult {
  profile: Profile;
  routes: RouteMap;
  /** Questions in scope (auto-answered ones included, "Trifft auf uns nicht zu" excluded). */
  applicable: QuestionDef[];
  controls: Record<string, ControlResult>;
  dimensions: DimensionResult[];
  crisis: 'liquidity' | 'crisis' | null;
  dataComplete: boolean;
}

/** A usable answer: one of the three statements, active and confirmed. */
export function isKnown(a: Answer | undefined): a is Answer & { points: Points } {
  return !!a && a.status === 'substantive' && a.points != null && !a.requiresReconfirmation && !a.inactiveSince;
}

/** R07 (RG7): Q01 = 0 and Q05 = 100 contradict each other. Both leave the coverage until one changes. */
export function contradictedIds(answers: AnswerMap): string[] {
  const p = (id: string) => (isKnown(answers[id]) ? answers[id].points : null);
  return p('Q01') === 0 && p('Q05') === 100 ? ['Q01', 'Q05'] : [];
}

/** Dimensions an unresolved topic marks as provisional (EI9 column "vorläufig an"). */
export const TOPIC_DIMENSIONS: Record<Topic, DimensionKey[]> = {
  debt: ['T'], acquisitions: ['O'], employee_equity: ['T'], regulated: ['T'], contingent: ['T'],
  shared_services: ['S', 'O', 'T'], restructuring: ['T'], cross_border_ops: ['T'],
};

export function computeScores(ctx: AssessmentContext, answers: AnswerMap): ScoreResult {
  const routes = resolveRoutes(ctx);
  const profile = profileOf(ctx);
  const crisis = crisisReason(ctx);
  const weights = PROFILE_WEIGHTS[profile];
  const inScope = crisis ? [] : scopeQuestions(ctx, answers);
  // "Trifft auf uns nicht zu" removes the local weight at once (BW7).
  const applicable = inScope.filter((q) => !(answers[q.id]?.status === 'not_applicable' && !answers[q.id]?.inactiveSince));
  const contradicted = new Set(contradictedIds(answers));
  const controls: Record<string, ControlResult> = {};
  const unsure = uncertainTopics(ctx);

  const dimensions: DimensionResult[] = DIMENSIONS.map((D) => {
    let knownWeight = 0;
    let weightedPoints = 0;
    let unknownWeight = 0;
    const openIds: string[] = [];
    const domains: DomainResult[] = D.domains.map((d) => {
      const A = applicable.filter((q) => q.domain === d);
      const sumU = A.reduce((s, q) => s + q.localWeight, 0);
      const p = weights[d];
      let kU = 0;
      let kPts = 0;
      for (const q of A) {
        const e = sumU ? (p * q.localWeight) / sumU : 0;
        const auto = isAutoAnswered(q.id, ctx);
        const a = answers[q.id];
        const points: Points | null = auto ? 100 : isKnown(a) && !contradicted.has(q.id) ? a.points : null;
        const known = points != null;
        controls[q.id] = { id: q.id, domain: d, effectiveWeight: e, points, known, auto };
        if (known) {
          knownWeight += e;
          weightedPoints += e * points;
          kU += q.localWeight;
          kPts += q.localWeight * points;
        } else {
          unknownWeight += e;
          openIds.push(q.id);
        }
      }
      return { key: d, name: DOMAIN_NAMES[d], weight: p, index: kU ? kPts / kU : null, localCoverage: sumU ? kU / sumU : 0 };
    });

    const coverage = knownWeight / 100;
    const rawIndex = knownWeight > EPS ? weightedPoints / knownWeight : null;
    const reasons: ProvisionalReason[] = [];
    const ordered = applicable.map((q) => q.id).filter((id) => openIds.includes(id));
    const dimContradicted = [...contradicted].filter((id) => controls[id]?.domain[0] === D.key);
    if (ordered.length) reasons.push({ kind: 'open', ids: ordered });
    if (dimContradicted.length) reasons.push({ kind: 'contradiction', ids: dimContradicted });
    for (const topic of unsure) if (TOPIC_DIMENSIONS[topic].includes(D.key)) reasons.push({ kind: 'topic', topic });
    if (D.key === 'T' && sellerUnresolved(ctx)) reasons.push({ kind: 'seller' });

    let status: DimensionStatus;
    if (crisis || rawIndex == null || coverage + EPS < DISPLAY_COVERAGE_MIN) status = 'insufficient';
    else status = reasons.length ? 'provisional' : 'complete';

    return {
      key: D.key, name: D.name, status, rawIndex,
      displayIndex: status !== 'insufficient' && rawIndex != null ? Math.round(rawIndex) : null,
      coverage, lower: weightedPoints / 100, upper: weightedPoints / 100 + unknownWeight, openIds: ordered, reasons, domains,
    };
  });

  return {
    profile, routes, applicable, controls, dimensions, crisis,
    dataComplete: !crisis && dimensions.every((d) => d.status === 'complete'),
  };
}
