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


// ── progress across all inputs (R2-01) ───────────────────────────────────────

/**
 * Required setup inputs that the counter shows as questions: time horizon,
 * perspective (when asked), specialist topics, seller. The tax-residence
 * follow-up sits on the same page and is not counted (R2-01 rule 1).
 */
export function setupCounted(ctx: AssessmentContext): number {
  return 1 + (asksPerspective(ctx) ? 1 : 0) + 1 + 1;
}

/** Setup inputs the user has already given (same items as setupCounted). */
export function setupCountedDone(ctx: AssessmentContext): number {
  const topics = ctx.topicsNone || ctx.topics.length > 0 || ctx.uncertainTopics.length > 0 || isPart(ctx);
  const perspective = asksPerspective(ctx) && !!ctx.profileOverride && perspectiveCandidates(ctx).includes(ctx.profileOverride);
  return Number(!!ctx.horizon) + Number(perspective) + Number(topics) + Number(!!ctx.seller);
}

export function contextDone(ctx: AssessmentContext): number {
  return Number(ctx.ownershipTags.length > 0) + Number(!!ctx.managementModel) + Number(ctx.intents.length > 0) + Number(!!ctx.liquidity);
}

/**
 * Detail questions counted in the total. With a part sold, Q34 counts from
 * the start, so the total never rises; it drops by one when Q53 gets a
 * statement instead of "Trifft auf uns nicht zu" (R2-01 rule 4).
 */
export function detailCount(ctx: AssessmentContext, answers: AnswerMap): number {
  const list = deepList(ctx, answers);
  if (!isPart(ctx) || list.some((x) => x.q.id === 'Q34')) return list.length;
  const q53 = answers.Q53;
  const statement = !!q53 && q53.status !== 'not_applicable' && !q53.inactiveSince && !q53.requiresReconfirmation;
  return list.length + (statement ? 0 : 1);
}

/** Experience value for the specialist topics while they are not chosen yet (assumption, to be replaced by the analytics mean). */
export const TOPICS_ESTIMATE = 3;
export const DEFAULT_ESTIMATE = 40;

export interface Total { total: number; approx: boolean }

/** Total number of inputs from the first click to the result. Approximate ("ca.") until topics and seller are set. */
export function progressTotal(ctx: AssessmentContext, answers: AnswerMap): Total {
  if (crisisReason(ctx)) return { total: 4, approx: false };
  if (setup2Complete(ctx) && contextComplete(ctx)) return { total: 4 + setupCounted(ctx) + detailCount(ctx, answers), approx: false };
  if (!ctx.ownershipTags.length || !ctx.intents.length) return { total: DEFAULT_ESTIMATE, approx: true };
  // Questions triggered by K1 and K3 alone: no topics, seller not known yet.
  const base: AssessmentContext = { ...ctx, topics: [], topicsNone: true, uncertainTopics: [], seller: null, sellerTax: null };
  const raw = 4 + setupCounted(ctx) + detailCount(base, {}) + TOPICS_ESTIMATE;
  return { total: Math.round(raw / 5) * 5, approx: true };
}

export const totalLabel = (t: Total) => (t.approx ? `ca. ${t.total}` : `${t.total}`);

/** Inputs given so far: context, setup, detail questions with a response. */
export function progressDone(ctx: AssessmentContext, answers: AnswerMap): number {
  return contextDone(ctx) + setupCountedDone(ctx) + progressCounts(deepList(ctx, answers), answers).answered;
}

/** Position (1-based) of the detail question at list index i. */
export function questionPosition(ctx: AssessmentContext, i: number): number {
  return 4 + setupCounted(ctx) + i + 1;
}

/** Number of inputs up to and including chapter 4 (where the interim result sits on the bar). */
export function interimPosition(ctx: AssessmentContext, answers: AnswerMap): number {
  return 4 + setupCounted(ctx) + deepList(ctx, answers).filter((x) => x.chapter <= INTERIM_AFTER_CHAPTER).length;
}

/** "Frage 5" or "Fragen 5 und 6" or "Fragen 1 bis 4". */
export function positionsLabel(from: number, to: number): string {
  if (to <= from) return `Frage ${from}`;
  return to === from + 1 ? `Fragen ${from} und ${to}` : `Fragen ${from} bis ${to}`;
}
