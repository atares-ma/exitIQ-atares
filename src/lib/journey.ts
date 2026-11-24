// Pure journey rules (section 2): screen order, question list, navigation,
// progress and the input counts used by the acceptance cases (section 12).
// No React and no storage here.

import { INTERIM_AFTER_CHAPTER } from '../model/catalogue';
import { asksPerspective, asksSellerTax, crisisReason, followUpQuestion, isPart, perspectiveCandidates, shownQuestions } from '../model/routing';
import type { Answer, AnswerMap, AssessmentContext, QuestionDef } from '../model/types';

/**
 * Kontext → (Krisenende) → Einrichtung 1 → Einrichtung 2 → Übersicht →
 * Kapitel 1–4 → Zwischenergebnis → Kapitel 5–8 → Ergebnis. `saved` is the pause screen.
 */
export type Screen = 'context' | 'crisis' | 'setup1' | 'setup2' | 'overview' | 'deep' | 'interim' | 'result' | 'saved';
export const SCREENS: Screen[] = ['context', 'crisis', 'setup1', 'setup2', 'overview', 'deep', 'interim', 'result', 'saved'];

export function normalizeScreen(s: string | null | undefined): Screen {
  return SCREENS.includes(s as Screen) ? (s as Screen) : 'context';
}

// ── completeness ("Weiter" locks, EI13) ──────────────────────────────────────

export function contextComplete(ctx: AssessmentContext): boolean {
  return ctx.ownershipTags.length > 0 && !!ctx.managementModel && ctx.intents.length > 0 && !!ctx.liquidity;
}

/** Page 1: time horizon, plus the perspective when it is asked. */
export function setup1Complete(ctx: AssessmentContext): boolean {
  const perspectiveOk = !asksPerspective(ctx) || (!!ctx.profileOverride && perspectiveCandidates(ctx).includes(ctx.profileOverride));
  return !!ctx.horizon && perspectiveOk;
}

/** Page 2: specialist topics (one input), seller, plus the tax residence when asked. */
export function setup2Complete(ctx: AssessmentContext): boolean {
  const topicsOk = ctx.topicsNone || ctx.topics.length > 0 || ctx.uncertainTopics.length > 0 || isPart(ctx);
  return topicsOk && !!ctx.seller && (!asksSellerTax(ctx) || !!ctx.sellerTax);
}

export function setupComplete(ctx: AssessmentContext): boolean {
  return contextComplete(ctx) && setup1Complete(ctx) && setup2Complete(ctx);
}

/** Required setup inputs (section 12 counting): horizon, perspective if asked, topics, seller, tax residence if asked. */
export function setupInputs(ctx: AssessmentContext): number {
  return 1 + (asksPerspective(ctx) ? 1 : 0) + 1 + 1 + (asksSellerTax(ctx) ? 1 : 0);
}

// ── question list ────────────────────────────────────────────────────────────

export interface DeepItem { q: QuestionDef; chapter: number }

/** The questions the user answers, in chapter order (RO10, AB7). */
export function deepList(ctx: AssessmentContext, answers: AnswerMap): DeepItem[] {
  if (crisisReason(ctx)) return [];
  return shownQuestions(ctx, answers).map((q) => ({ q, chapter: q.chapter }));
}

/** A response that lets the user move on: one of the statements, a status or "Trifft auf uns nicht zu", plus the extra line when shown. */
export function hasResponse(id: string, a: Answer | undefined, answers: AnswerMap): boolean {
  if (!a || a.requiresReconfirmation || a.inactiveSince) return false;
  if (followUpQuestion(id, answers) && !a.followUp) return false;
  return true;
}

export function needsVisit(id: string, answers: AnswerMap): boolean {
  return !hasResponse(id, answers[id], answers);
}

export function firstOpenIndex(list: DeepItem[], answers: AnswerMap, from = 0): number {
  for (let i = from; i < list.length; i++) if (needsVisit(list[i].q.id, answers)) return i;
  return -1;
}

/** Index of the first question of a chapter at or after `chapter`, or -1. */
export function firstIndexOfChapter(list: DeepItem[], chapter: number): number {
  return list.findIndex((x) => x.chapter >= chapter);
}

/** True when the question at `i` is the last one of chapters 1–4 (the interim result follows). */
export function endsFirstPart(list: DeepItem[], i: number): boolean {
  return list[i]?.chapter <= INTERIM_AFTER_CHAPTER && (list[i + 1] == null || list[i + 1].chapter > INTERIM_AFTER_CHAPTER);
}

export interface Progress { answered: number; total: number }

export function progressCounts(list: DeepItem[], answers: AnswerMap): Progress {
  return { answered: list.filter((x) => !needsVisit(x.q.id, answers)).length, total: list.length };
}

/** Number of chapters that have at least one question in scope. */
export function chapterCount(list: DeepItem[]): number {
  return new Set(list.map((x) => x.chapter)).size;
}

// ── stepper ──────────────────────────────────────────────────────────────────

export const STEPS = ['Kontext', 'Einrichtung', 'Kapitel 1–4', 'Kapitel 5–8', 'Ergebnis'];

export function stepOf(screen: Screen, chapter: number | null): number {
  switch (screen) {
    case 'context': case 'crisis': return 0;
    case 'setup1': case 'setup2': case 'overview': return 1;
    case 'deep': return chapter != null && chapter > INTERIM_AFTER_CHAPTER ? 3 : 2;
    case 'interim': return 2;
    case 'result': return 4;
    default: return -1;
  }
}

/** Number of required inputs (context + setup + shown questions + extra lines) up to and including chapter `lastChapter`. Section 12. */
export function inputsUpTo(ctx: AssessmentContext, answers: AnswerMap, lastChapter: number): number {
  const list = deepList(ctx, answers).filter((x) => x.chapter <= lastChapter);
  const extra = list.filter((x) => followUpQuestion(x.q.id, answers)).length;
  return 4 + setupInputs(ctx) + list.length + extra;
}

