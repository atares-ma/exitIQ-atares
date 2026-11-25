// Sections 10 and 11: rules, tasks, the checklist of documents and the result
// object that the pages and the Excel export render. Pure and deterministic.

import { CATALOGUE_VERSION, CHAPTERS, DEPENDENCIES, DOMAIN_LEAD, QUESTION_BY_ID, REPORT_VERSION, SCORING_VERSION } from './catalogue';
import { TOPIC_SHORT } from './options';
import {
  activeModules, contributorOf, domainLead, isOpenScope, isPart, q26Auto, q09Auto, questionText, sellerUnresolved, shownQuestions, uncertainTopics,
} from './routing';
import { computeScores, contradictedIds, isKnown, type ScoreResult } from './scoring';
import type { AnswerMap, AssessmentContext, Horizon, QuestionDef, RouteCode, Topic } from './types';

// ── rules (section 10) ───────────────────────────────────────────────────────

export type RuleId = 'LIQ' | 'R02' | 'R03' | 'R04' | 'R05' | 'R06' | 'R07';

export interface Risk {
  rule: RuleId;
  severity: 'critical' | 'review';
  title: string;
  text: string;
  questionIds: string[];
  /** Task text for the plan. */
  action: string;
}

/** Order of critical items at the top of the plan: the liquidity task and R04 go first (RG8, PE acceptance case). */
const RULE_ORDER: RuleId[] = ['LIQ', 'R04', 'R02', 'R03', 'R05', 'R06', 'R07'];

const pts = (answers: AnswerMap, id: string) => (isKnown(answers[id]) ? answers[id].points : null);

/**
 * No rule is ever triggered by a status answer, by "Noch unklar" or by an
 * uncertain topic (section 10, "nie aus Unbekanntem").
 */
export function evaluateRisks(ctx: AssessmentContext, answers: AnswerMap, score: ScoreResult): Risk[] {
  if (score.crisis) return [];
  const inScope = new Set(score.applicable.map((q) => q.id));
  const p = (id: string) => (inScope.has(id) ? pts(answers, id) : null);
  const r: Risk[] = [];

  // RG8: liquidity probably fine but not planned → critical task at the very top.
  if (ctx.liquidity === 'potential' && p('Q08') === 0) {
    r.push({ rule: 'LIQ', severity: 'critical', title: 'Liquidität der nächsten 12 Monate nicht geplant',
      text: 'Sie sind nicht sicher, ob alle Zahlungen der nächsten sechs Monate gesichert sind, und es gibt keine laufende Liquiditätsplanung.',
      action: 'Liquiditätsplanung für die nächsten 12 Monate aufstellen und Finanzierungsbedarf klären', questionIds: ['Q08'] });
  }
  // R04 via the extra line at Q28 = 100 (RG4).
  if (p('Q28') === 100 && answers.Q28?.followUp === 'yes') {
    r.push({ rule: 'R04', severity: 'critical', title: 'Steuerliche Frist betrifft den Zeitplan',
      text: 'Ihr Steuerberater hat eine Frist oder Einschränkung aus früheren Umstrukturierungen festgestellt, die den geplanten Zeitplan betrifft.',
      action: 'Zeitplan mit dem Steuerberater an die Frist anpassen, bevor Käufer angesprochen werden', questionIds: ['Q28'] });
  }
  // R02: approvals not clarified and buyers are to be approached within six months.
  if (p('Q04') === 0 && ctx.horizon === 'under_6') {
    r.push({ rule: 'R02', severity: 'critical', title: 'Zustimmungen ungeklärt, Ansprache bald geplant',
      text: 'Sie möchten in weniger als sechs Monaten Käufer ansprechen, haben aber nicht geklärt, wer dem Verkauf zustimmen muss.',
      action: 'Klären, wer dem Verkauf zustimmen muss, und den Ablauf festhalten', questionIds: ['Q04'] });
  }
  // R03: essential rights (Q32, Q33 at 0; Q37 via its extra line, RG3).
  const rights: string[] = [];
  const texts: string[] = [];
  if (p('Q32') === 0) { rights.push('Q32'); texts.push('Das Eigentum an den Anteilen ist nicht lückenlos belegt.'); }
  if (p('Q33') === 0) { rights.push('Q33'); texts.push('Die Rechte an Software, Marken oder Inhalten sind nicht geregelt.'); }
  if ((p('Q37') === 50 || p('Q37') === 100) && answers.Q37?.followUp === 'yes') { rights.push('Q37'); texts.push('Eine Genehmigung, ohne die Sie nicht arbeiten dürfen, fällt beim Verkauf weg.'); }
  if (rights.length) {
    r.push({ rule: 'R03', severity: 'critical', title: 'Wesentliche Rechte nicht gesichert', text: texts.join(' '),
      action: 'Eigentum und wesentliche Rechte mit Ihrem Anwalt sichern, bevor Käufer angesprochen werden', questionIds: rights });
  }
  // R05: shared services without a solution, or without a planned transition agreement (J7).
  if (score.routes.SEPARATION) {
    const q46 = p('Q46');
    const q48 = p('Q48');
    if (q46 === 0 || (q48 === 0 && q46 != null && q46 < 100)) {
      r.push({ rule: 'R05', severity: 'critical', title: 'Weiterlaufen gemeinsam genutzter Leistungen ungeklärt',
        text: q46 === 0
          ? 'Für Leistungen, die heute vom Konzern oder vom übrigen Unternehmen kommen, gibt es noch keine Lösung.'
          : 'Offene Leistungen sollen weiterlaufen, aber Übergangsvereinbarungen sind nicht geplant.',
        action: 'Für jede gemeinsam genutzte Leistung eine Lösung oder Übergangsvereinbarung festlegen', questionIds: q46 === 0 ? ['Q46'] : ['Q46', 'Q48'] });
    }
  }
  // R06: confirmed funding gap (asked only when the perspective is not the owner's).
  if (score.profile !== 'OWNER' && ctx.fundingGapConfirmed === 'yes') {
    r.push({ rule: 'R06', severity: 'critical', title: 'Finanzierungslücke vor dem Verkauf',
      text: 'Bis zum geplanten Verkauf besteht eine bestätigte Finanzierungslücke ohne vereinbarte Überbrückung.',
      action: 'Überbrückung der Finanzierungslücke vereinbaren', questionIds: ['Q08'] });
  }
  // R07: contradiction (RG7), a review item, not critical.
  const contra = contradictedIds(answers).filter((id) => inScope.has(id));
  if (contra.length) {
    r.push({ rule: 'R07', severity: 'review', title: 'Antworten widersprechen sich',
      text: 'Sie haben angegeben, dass die Ziele noch nicht festgelegt sind, die Verkaufswege aber schon gegen diese Ziele abgewogen wurden. Bitte prüfen Sie beide Antworten.',
      action: 'Antworten zu Zielen und Verkaufswegen prüfen', questionIds: contra });
  }
  return r.sort((a, b) => RULE_ORDER.indexOf(a.rule) - RULE_ORDER.indexOf(b.rule));
}

// ── tasks ────────────────────────────────────────────────────────────────────

export type TaskKind = 'critical' | 'scope' | 'gap' | 'status' | 'open' | 'reconfirm' | 'setting' | 'review';

export interface Task {
  key: string;
  kind: TaskKind;
  title: string;
  /** "Heute: … Ziel: …" for gaps; otherwise a short reason. */
  reason: string | null;
  /** Nachweis (ER10). */
  evidence: string | null;
  owner: string | null;
  questionIds: string[];
  chapter: number | null;
  ruleId: RuleId | null;
  impact: number;
  timingRank: number;
  suggestedTiming: string;
  dependencies: string[];
  waitingFor: string[];
  /** 1 critical, 2 needs review / settings, 3 everything else (tasks table). */
  priorityClass: 1 | 2 | 3;
}

export interface ChecklistItem { key: string; title: string; waitingFor: string[]; questionIds: string[] }

const TIMING: Record<Horizon, [string, string, string]> = {
  under_6: ['Sofort', 'In den nächsten 4 Wochen', 'Vor der Ansprache der Käufer'],
  m6_18: ['Sofort', 'In den nächsten 2 Monaten', 'In den nächsten 6 Monaten'],
  m19_36: ['Sofort', 'In den nächsten 3 Monaten', 'In den nächsten 12 Monaten'],
  over_36: ['Sofort', 'In den nächsten 6 Monaten', 'In den nächsten 18 Monaten'],
  undecided: ['Sofort', 'Zeitnah', 'Vor der Ansprache der Käufer'],
};

/** P9: task text per uncertain topic. */
const TOPIC_TASK: Record<Topic, string> = {
  debt: 'Prüfen, ob Kredite, Gesellschafterdarlehen oder Sicherheiten bestehen',
  acquisitions: 'Prüfen, ob aus früheren Zukäufen noch Integrationsaufgaben offen sind',
  employee_equity: 'Prüfen, ob Mitarbeitende oder Geschäftsführer beteiligt sind (Anteile, Optionen oder virtuelle Beteiligung)',
  regulated: 'Prüfen, ob wichtige Genehmigungen oder Zulassungen bestehen',
  contingent: 'Klären, ob ein Earn-out oder eine Rückbeteiligung in Frage kommt',
  shared_services: 'Prüfen, welche Leistungen das Unternehmen von einer anderen Firma des Eigentümers bezieht',
  restructuring: 'Mit dem Steuerberater klären, ob es frühere Umstrukturierungen gab',
  cross_border_ops: 'Prüfen, ob es wesentliche Tätigkeit in mehreren Ländern gibt',
};

/** ST2 task text for a status answer. */
export function statusTaskTitle(q: QuestionDef, status: 'clarify' | 'lookup'): string {
  if (status === 'lookup') return `Nachsehen: ${q.name}`;
  if (q.statusType === 'F') return `Mit der Geschäftsführung klären: ${q.name}`;
  if (q.statusType === 'G') return `Mit den Gesellschaftern klären: ${q.name}`;
  return `Klären: ${q.name}`;
}

/** Dependencies of a question's task (ER12). With a part sold, Q22 and Q23 wait for Q45 instead of Q21. */
function dependenciesOf(id: string, ctx: AssessmentContext): string[] {
  const deps = DEPENDENCIES[id] ?? [];
  return isPart(ctx) ? deps.map((d) => (d === 'Q21' ? 'Q45' : d)) : deps;
}

export function buildTasks(ctx: AssessmentContext, answers: AnswerMap, score: ScoreResult, risks: Risk[]): Task[] {
  if (score.crisis) return [];
  const timing = TIMING[ctx.horizon ?? 'undecided'];
  const shown = new Set(shownQuestions(ctx, answers).map((q) => q.id));
  const fullyDone = (id: string) => score.controls[id]?.points === 100 || !score.controls[id];
  const tasks: Task[] = [];

  for (const k of risks) {
    const q = k.questionIds[0] ? QUESTION_BY_ID[k.questionIds[0]] : null;
    tasks.push({
      key: `${k.rule}`, kind: k.severity === 'critical' ? 'critical' : 'review', title: k.action, reason: `${k.title}. ${k.text}`,
      evidence: q?.evidence ?? null, owner: q ? contributorOf(q, ctx) : null, questionIds: k.questionIds, chapter: q?.chapter ?? null,
      ruleId: k.rule, impact: q ? score.controls[q.id]?.effectiveWeight ?? 0 : 0, timingRank: k.severity === 'critical' ? 0 : 1,
      suggestedTiming: k.severity === 'critical' ? timing[0] : timing[1], dependencies: [], waitingFor: [], priorityClass: k.severity === 'critical' ? 1 : 2,
    });
  }

  // ER7: tasks without a question of their own.
  if (isOpenScope(ctx)) {
    tasks.push(settingTask('SCOPE', 'scope', 'Verkaufsumfang festlegen', 'Ihr Verkaufsumfang ist noch offen. Verkaufen Sie nur einen Teil, kommen bis zu 7 Fragen hinzu.', timing[1]));
  }
  for (const topic of uncertainTopics(ctx)) {
    tasks.push(settingTask(`TOPIC:${topic}`, 'setting', TOPIC_TASK[topic], `Sie waren unsicher, ob das Thema „${TOPIC_SHORT[topic]}“ zutrifft. Bis es geklärt ist, bleibt der Wert vorläufig.`, timing[1]));
  }
  if (sellerUnresolved(ctx)) {
    tasks.push(settingTask('SELLER', 'setting', 'Klären, wer verkauft und wo die Verkäufer steuerpflichtig sind', 'Bis das geklärt ist, bleibt die Transaktionsvorbereitung vorläufig.', timing[1]));
  }

  const covered = new Set(tasks.filter((t) => t.kind === 'critical').flatMap((t) => t.questionIds));
  for (const q of score.applicable) {
    if (!shown.has(q.id) || covered.has(q.id)) continue;
    const a = answers[q.id];
    const c = score.controls[q.id];
    const e = c?.effectiveWeight ?? 0;
    const deps = dependenciesOf(q.id, ctx);
    const base = {
      evidence: q.evidence, owner: contributorOf(q, ctx), questionIds: [q.id], chapter: q.chapter, ruleId: null,
      dependencies: deps, waitingFor: deps.filter((d) => score.controls[d] && !fullyDone(d)), suggestedTiming: timing[2], timingRank: 2, priorityClass: 3 as const,
    };
    if (c?.known) {
      if (c.points === 100) continue;
      const text = questionText(q, ctx, answers);
      tasks.push({ ...base, key: `Q:${q.id}`, kind: 'gap', title: q.name,
        reason: `Heute: ${text.anchors[(c.points ?? 0) / 50]} Ziel: ${text.anchors[2]}`, impact: (e * (100 - (c.points ?? 0))) / 100 });
    } else if (a?.requiresReconfirmation) {
      tasks.push({ ...base, key: `Q:${q.id}`, kind: 'reconfirm', title: `Erneut bestätigen: ${q.name}`, reason: 'Wieder im Umfang, bitte erneut bestätigen.', impact: e });
    } else if (a && (a.status === 'clarify' || a.status === 'lookup')) {
      tasks.push({ ...base, key: `Q:${q.id}`, kind: 'status', title: statusTaskTitle(q, a.status), reason: null, impact: e });
    } else if (a?.status === 'substantive' && contradictedIds(answers).includes(q.id)) {
      continue; // covered by the R07 review item
    } else {
      tasks.push({ ...base, key: `Q:${q.id}`, kind: 'open', title: `Beantworten: ${q.name}`, reason: 'Diese Frage ist noch nicht beantwortet.', impact: e });
    }
  }

  // R2-03: three urgency tiers from the timing table of the chosen horizon.
  //  1 Sofort: critical prerequisites, "Verkaufsumfang festlegen", Q02 and Q41 below 100 (timetable and team drive everything else)
  //  2 next weeks: answers with 0 points, Q01 below 100 (Q05 waits for it), status tasks, uncertain topics or seller, contradictions
  //  3 later: everything else
  const tierOf = (t: Task): number => {
    if (t.kind === 'critical' || t.kind === 'scope') return 1;
    const id = t.questionIds[0];
    if (t.ruleId == null && (id === 'Q02' || id === 'Q41')) return 1;
    if (t.kind === 'status' || t.kind === 'setting' || t.kind === 'review') return 2;
    if (t.kind === 'gap' && (score.controls[id]?.points === 0 || id === 'Q01')) return 2;
    return 3;
  };
  const tier = new Map(tasks.map((t) => [t, tierOf(t)]));
  // A task that waits for another never comes in an earlier tier than that task.
  for (let changed = true, guard = 0; changed && guard < 10; guard++) {
    changed = false;
    for (const t of tasks) {
      for (const d of t.waitingFor) {
        const dep = tasks.find((x) => x !== t && x.questionIds.includes(d));
        if (dep && tier.get(dep)! > tier.get(t)!) { tier.set(t, tier.get(dep)!); changed = true; }
      }
    }
  }
  for (const t of tasks) {
    const n = tier.get(t)!;
    t.timingRank = n - 1;
    t.suggestedTiming = timing[n - 1];
  }

  // ER6 order as in the brief: critical first (fixed order), then tier, then impact; the open sales scope leads its tier.
  const sorted = [...tasks].sort((x, y) => Number(x.kind !== 'critical') - Number(y.kind !== 'critical')
    || (x.kind === 'critical' && y.kind === 'critical' ? RULE_ORDER.indexOf(x.ruleId!) - RULE_ORDER.indexOf(y.ruleId!) : 0)
    || x.timingRank - y.timingRank
    || Number(x.kind !== 'scope') - Number(y.kind !== 'scope')
    || y.impact - x.impact);
  return dependencyOrder(sorted);
}

function settingTask(key: string, kind: TaskKind, title: string, reason: string, suggestedTiming: string): Task {
  return {
    key, kind, title, reason, evidence: null, owner: null, questionIds: [], chapter: null, ruleId: null, impact: 0, timingRank: 1,
    suggestedTiming, dependencies: [], waitingFor: [], priorityClass: 2,
  };
}

/** Within the same tier a task never comes before a task it depends on. Stable otherwise. */
export function dependencyOrder(sorted: Task[]): Task[] {
  const out: Task[] = [];
  const placed = new Set<Task>();
  const visiting = new Set<Task>();
  const visit = (t: Task) => {
    if (placed.has(t) || visiting.has(t)) return;
    visiting.add(t);
    for (const d of t.dependencies) {
      const dep = sorted.find((x) => x !== t && x.timingRank === t.timingRank && x.kind !== 'critical' && t.kind !== 'critical' && x.questionIds.includes(d));
      if (dep) visit(dep);
    }
    visiting.delete(t);
    placed.add(t);
    out.push(t);
  };
  sorted.forEach(visit);
  return out;
}

/** ER7: documents without weight, kept as a checklist apart from the tasks. */
export function buildChecklist(ctx: AssessmentContext, score: ScoreResult): ChecklistItem[] {
  if (score.crisis) return [];
  const q41Open = !(score.controls.Q41?.points === 100);
  const items: ChecklistItem[] = [
    { key: 'DOC:Q30', title: 'Steuerunterlagen seit der letzten Betriebsprüfung geordnet in den Datenraum', waitingFor: [], questionIds: [] },
    { key: 'DOC:Q40', title: 'Dokumentenindex für den Datenraum mit Verantwortlichen und Lückenliste anlegen', waitingFor: q41Open ? ['Q41'] : [], questionIds: [] },
    { key: 'DOC:Q42', title: 'Liste offener Punkte führen (Export der Aufgabenliste aus ExitIQ)', waitingFor: [], questionIds: [] },
    { key: 'DOC:Q43', title: 'Festlegen, wer welche vertraulichen Informationen wann sieht', waitingFor: q41Open ? ['Q41'] : [], questionIds: [] },
  ];
  if (score.controls.Q09 && (q09Auto(ctx) || score.controls.Q09.known)) {
    items.push({ key: 'DOC:Q09', title: 'Kundenliste mit Umsatzanteilen bereithalten', waitingFor: [], questionIds: ['Q09'] });
  }
  const auto26 = score.controls.Q26 ? q26Auto(ctx) : null;
  if (auto26 === 'individuals') {
    items.push({ key: 'DOC:Q26', title: 'Gesellschafterliste, Gesellschaftsvertrag und Urkunden aller Anteilsübertragungen bereithalten', waitingFor: [], questionIds: ['Q26', 'Q32'] });
  } else if (auto26 === 'group') {
    items.push({ key: 'DOC:Q26', title: 'Konzernorganigramm mit verkaufender Gesellschaft bereithalten', waitingFor: [], questionIds: ['Q26'] });
  }
  return items;
}

// ── result object ────────────────────────────────────────────────────────────

export const TOP_STEPS = 5;

export interface ChapterGroup { chapter: number | null; title: string; tasks: Task[] }

export interface ResultSnapshot {
  versions: { catalogue: string; scoring: string; report: string };
  generatedAt: string;
  context: AssessmentContext;
  profile: string;
  activeModules: RouteCode[];
  dimensions: ScoreResult['dimensions'];
  dataStatus: 'data_complete' | 'data_incomplete';
  riskStatus: 'critical' | 'review' | 'none';
  crisis: ScoreResult['crisis'];
  risks: Risk[];
  tasks: Task[];
  checklist: ChecklistItem[];
}

export interface Result extends ResultSnapshot {
  score: ScoreResult;
  topSteps: Task[];
  /** The remaining tasks grouped by chapter (ER6); tasks without a chapter come last. */
  groups: ChapterGroup[];
  /** ER4: sales scope still open. */
  scopeOpenNote: boolean;
  /** ER5: an experienced adviser is still missing (Q41 = 0 or 50). */
  adviserNote: boolean;
  /** Questions of chapters 5–8 in scope that still need an answer (ER1). */
  remainingLater: string[];
}

export function buildResult(ctx: AssessmentContext, answers: AnswerMap, now = new Date().toISOString()): Result {
  const score = computeScores(ctx, answers);
  const risks = evaluateRisks(ctx, answers, score);
  const tasks = buildTasks(ctx, answers, score, risks);
  const checklist = buildChecklist(ctx, score);
  const topSteps = tasks.slice(0, TOP_STEPS);
  const rest = tasks.slice(TOP_STEPS);
  const groups: ChapterGroup[] = [];
  CHAPTERS.forEach((ch, i) => {
    const ts = rest.filter((t) => t.chapter === i);
    if (ts.length) groups.push({ chapter: i, title: ch.title, tasks: ts });
  });
  const other = rest.filter((t) => t.chapter == null);
  if (other.length) groups.push({ chapter: null, title: 'Ihre Angaben', tasks: other });
  const q41 = score.controls.Q41;
  const shown = shownQuestions(ctx, answers);
  return {
    score,
    versions: { catalogue: CATALOGUE_VERSION, scoring: SCORING_VERSION, report: REPORT_VERSION },
    generatedAt: now,
    context: ctx,
    profile: score.profile,
    activeModules: activeModules(score.routes),
    dimensions: score.dimensions,
    dataStatus: score.dataComplete ? 'data_complete' : 'data_incomplete',
    riskStatus: risks.some((k) => k.severity === 'critical') ? 'critical' : risks.length ? 'review' : 'none',
    crisis: score.crisis,
    risks,
    tasks,
    checklist,
    topSteps,
    groups,
    scopeOpenNote: isOpenScope(ctx),
    adviserNote: !score.crisis && !!q41 && q41.known && (q41.points === 0 || q41.points === 50),
    remainingLater: shown.filter((q) => q.chapter > 3 && !isKnown(answers[q.id]) && answers[q.id]?.status !== 'not_applicable').map((q) => q.id),
  };
}

/** The stored snapshot (no derived score internals). */
export function snapshotOf(r: Result): ResultSnapshot {
  const { score: _s, topSteps: _t, groups: _g, scopeOpenNote: _o, adviserNote: _a, remainingLater: _r, ...snap } = r;
  return snap;
}

/** Suggested lead per domain for the result page (ER11). */
export function leadFor(domain: QuestionDef['domain'], ctx: AssessmentContext): string {
  return domainLead(domain, DOMAIN_LEAD, ctx);
}

