// The illustrative values on the landing page, calculated with the live model
// (never hard-coded), so example and real results use the same formula.

import { blankContext } from '../lib/context';
import { evaluateRisks, type Risk } from '../model/plan';
import { computeScores, type DimensionResult } from '../model/scoring';
import type { Answer, AnswerMap, AssessmentContext, Points } from '../model/types';

const T = '2026-11-24T09:00:00.000Z';

export const EXAMPLE_CONTEXT: AssessmentContext = {
  ...blankContext(),
  ownershipTags: ['private_family'], managementModel: 'owner_led', intents: ['whole'], liquidity: 'no_pressure', horizon: 'under_6',
  topicsNone: true, seller: 'individuals_domestic',
  company: { ...blankContext().company, businessModel: 'IT- und Technologiedienstleistungen', largestCustomer: '20_30' },
};

const sub = (points: Points): Answer => ({ status: 'substantive', points, answeredAt: T });
const open = (status: Answer['status']): Answer => ({ status, answeredAt: T });

export const EXAMPLE_ANSWERS: AnswerMap = {
  Q01: sub(100), Q02: sub(50), Q05: sub(50), Q06: sub(100), Q03: sub(100), Q04: sub(0),
  Q07: sub(100), Q08: sub(100), Q19: sub(50), Q20: sub(50), Q09: sub(50), Q10: sub(100), Q11: sub(100), Q15: sub(50), Q16: open('clarify'), Q17: sub(100),
  Q12: sub(50), Q13: sub(100), Q14: sub(50),
  Q21: sub(100), Q22: sub(50), Q23: sub(50), Q25: sub(0), Q29: open('clarify'), Q32: sub(100), Q33: sub(50), Q41: sub(50),
};

export interface ExampleDimension { result: DimensionResult; risk: Risk | null }

export function exampleReport(): ExampleDimension[] {
  const score = computeScores(EXAMPLE_CONTEXT, EXAMPLE_ANSWERS);
  const risks = evaluateRisks(EXAMPLE_CONTEXT, EXAMPLE_ANSWERS, score);
  return score.dimensions.map((d) => ({ result: d, risk: d.key === 'S' ? risks.find((r) => r.rule === 'R02') ?? null : null }));
}
