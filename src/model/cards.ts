// Display data for the three value cards (R2-09). Presentation only: the
// value, the 80 % rule and the ranges come unchanged from scoring.ts.

import { QUESTION_BY_ID } from './catalogue';
import { isAutoAnswered } from './routing';
import { DISPLAY_COVERAGE_MIN, isKnown, type DimensionResult, type ScoreResult } from './scoring';
import type { AnswerMap, AssessmentContext, DomainKey } from './types';

export interface AreaLine {
  key: DomainKey;
  name: string;
  answered: number;
  total: number;
  /** Rounded area value, only when the card has a value and at least 80 % of the area's questions are answered. */
  value: number | null;
}

export interface CardData {
  /** Questions the user sees in this dimension (automatic ones not counted). */
  answered: number;
  total: number;
  /**
   * Answered questions from which the value appears when the open questions
   * are answered in the order offered (the 80 % rule applies to weights, so
   * this is the count for the guided path). Null when not reachable.
   */
  valueFrom: number | null;
  /** Open questions in this card, in chapter order. */
  openIds: string[];
  /** Contradicting answers (R2-02). */
  contradictedIds: string[];
  /** True when the value is missing only because of the contradiction. */
  blockedByContradiction: boolean;
  areas: AreaLine[];
}

export function cardData(d: DimensionResult, score: ScoreResult, ctx: AssessmentContext, answers: AnswerMap): CardData {
  const contradiction = d.reasons.find((r) => r.kind === 'contradiction');
  const contradictedIds = contradiction?.kind === 'contradiction' ? contradiction.ids : [];
  const shown = score.applicable.filter((q) => q.domain[0] === d.key && !isAutoAnswered(q.id, ctx));
  const given = (id: string) => isKnown(answers[id]); // a contradicting answer is still an answer the user gave
  const answered = shown.filter((q) => given(q.id)).length;

  let valueFrom: number | null = null;
  if (d.displayIndex == null) {
    let cov = d.coverage + d.contradictedCoverage;
    let n = answered;
    if (cov + 1e-9 >= DISPLAY_COVERAGE_MIN) valueFrom = contradictedIds.length ? null : n;
    else {
      for (const id of d.openIds) {
        cov += (score.controls[id]?.effectiveWeight ?? 0) / 100;
        n++;
        if (cov + 1e-9 >= DISPLAY_COVERAGE_MIN) { valueFrom = n; break; }
      }
    }
  }

  const areas: AreaLine[] = d.domains.map((m) => {
    const qs = shown.filter((q) => q.domain === m.key);
    const a = qs.filter((q) => given(q.id)).length;
    const enough = qs.length > 0 && a / qs.length >= 0.8 - 1e-9;
    return {
      key: m.key, name: m.name, answered: a, total: qs.length,
      value: d.displayIndex != null && enough && m.index != null ? Math.round(m.index) : null,
    };
  }).filter((x) => x.total > 0 || x.value != null);

  return {
    answered, total: shown.length, valueFrom, openIds: d.openIds, contradictedIds,
    blockedByContradiction: d.displayIndex == null && contradictedIds.length > 0 && d.coverage + d.contradictedCoverage + 1e-9 >= DISPLAY_COVERAGE_MIN,
    areas,
  };
}

/** "Ziele des Verkaufs, Wege für den Verkauf" */
export const namesOf = (ids: string[]) => ids.map((id) => QUESTION_BY_ID[id].name).join(', ');
