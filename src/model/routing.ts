// Routing (section 5), perspective (EI5), wording variants (sections 7–8),
// status lines and contact persons (section 6). Pure and deterministic.

import { CHAPTERS, QUESTIONS, QUESTION_BY_ID } from './catalogue';
import { INTENT_OPTIONS, SELLER_OPTIONS } from './options';
import type {
  AnswerMap, AssessmentContext, DomainKey, Intent, Objective, OwnershipTag, Perimeter, Profile, QuestionDef, QuestionText, RouteCode,
  RouteMap, Topic,
} from './types';

// ── context predicates ───────────────────────────────────────────────────────

const has = (ctx: AssessmentContext, t: OwnershipTag) => ctx.ownershipTags.includes(t);
const wants = (ctx: AssessmentContext, i: Intent) => ctx.intents.includes(i);

export const hasPE = (ctx: AssessmentContext) => has(ctx, 'pe');
export const hasVC = (ctx: AssessmentContext) => has(ctx, 'vc');
export const hasCorporate = (ctx: AssessmentContext) => has(ctx, 'corporate_group');
/** K1 only Konzern. */
export const onlyCorporate = (ctx: AssessmentContext) => ctx.ownershipTags.length === 1 && hasCorporate(ctx);
/** "Familie" = K1 without PE, VC and Konzern. */
export const isFamily = (ctx: AssessmentContext) => ctx.ownershipTags.length > 0 && !hasPE(ctx) && !hasVC(ctx) && !hasCorporate(ctx);
export const isOwnerLed = (ctx: AssessmentContext) => ctx.managementModel === 'owner_led';
export const isEmployedOrMixed = (ctx: AssessmentContext) => ctx.managementModel === 'employed' || ctx.managementModel === 'mixed';
/** "Teil" = K3 option 2 (a business unit or site). */
export const isPart = (ctx: AssessmentContext) => wants(ctx, 'part');
/** K3 option 1 (the whole company). */
export const isWhole = (ctx: AssessmentContext) => wants(ctx, 'whole');
export const isOpenScope = (ctx: AssessmentContext) => wants(ctx, 'open');
export const investorWording = (ctx: AssessmentContext) => wants(ctx, 'shares') || wants(ctx, 'investor');

/** Crisis end (AB5): K4 acute or K3 "Krise oder Sanierung". */
export function crisisReason(ctx: AssessmentContext): 'liquidity' | 'crisis' | null {
  if (ctx.liquidity === 'acute') return 'liquidity';
  if (wants(ctx, 'crisis')) return 'crisis';
  return null;
}

// ── K3 option rules (KO5) ────────────────────────────────────────────────────

/** 1 and 2 exclude each other; 1 or 2 exclude 3 and 4; 3 and 4 combine; 5 and 6 only alone. */
export function toggleIntent(current: Intent[], v: Intent): Intent[] {
  if (current.includes(v)) return current.filter((x) => x !== v);
  if (v === 'open' || v === 'crisis') return [v];
  const base = current.filter((x) => x !== 'open' && x !== 'crisis');
  if (v === 'whole' || v === 'part') return [v];
  // shares / investor: drop whole and part, keep the other of the two.
  return [...base.filter((x) => x === 'shares' || x === 'investor'), v];
}

export function intentLabel(ctx: AssessmentContext, v: Intent): string {
  if (v === 'whole' && hasCorporate(ctx)) return 'Das ganze Unternehmen verkaufen (Tochtergesellschaft)';
  return INTENT_OPTIONS.find((o) => o.value === v)!.label;
}

/** Codes stored for reporting (KO5 table). Konzern at option 1 without succession. */
export function objectivesOf(ctx: AssessmentContext): Objective[] {
  const out: Objective[] = [];
  for (const i of ctx.intents) {
    if (i === 'whole') out.push('full_sale', ...(hasCorporate(ctx) ? [] : ['succession' as const]));
    if (i === 'part') out.push('full_sale');
    if (i === 'shares') out.push('partial_sale');
    if (i === 'investor') out.push('growth_capital');
    if (i === 'open') out.push('exploration');
    if (i === 'crisis') out.push('distress');
  }
  return [...new Set(out)];
}

/** The perimeter is only ever set from K3 (EI3). */
export function perimeterOf(ctx: AssessmentContext): Perimeter | null {
  if (isPart(ctx)) return 'business_unit_assets';
  if (isOpenScope(ctx)) return 'undecided';
  if (isWhole(ctx)) return hasCorporate(ctx) ? 'subsidiary' : 'whole_business';
  if (wants(ctx, 'shares') || wants(ctx, 'investor')) return 'whole_business';
  return null;
}

export function sellerLabel(ctx: AssessmentContext, v: (typeof SELLER_OPTIONS)[number]['value']): string {
  if (v === 'holding' && isFamily(ctx)) return 'Eine Holding-GmbH der Gesellschafter';
  return SELLER_OPTIONS.find((o) => o.value === v)!.label;
}

/** Investment funds are not offered to families (EI10). */
export function sellerOptions(ctx: AssessmentContext) {
  return SELLER_OPTIONS.filter((o) => !(o.value === 'funds' && isFamily(ctx))).map((o) => ({ ...o, label: sellerLabel(ctx, o.value) }));
}

/** The tax-residence follow-up is asked for holdings, funds and mixed sellers only. */
export const asksSellerTax = (ctx: AssessmentContext) => ctx.seller === 'holding' || ctx.seller === 'funds' || ctx.seller === 'mixed';

/** Seller not resolved (P7): "Noch unklar", or tax residence "Nicht sicher". */
export function sellerUnresolved(ctx: AssessmentContext): boolean {
  return ctx.seller === 'unknown' || (asksSellerTax(ctx) && ctx.sellerTax === 'unknown');
}

// ── perspective (EI5) ────────────────────────────────────────────────────────

const PERSPECTIVE_OF: Record<OwnershipTag, Profile> = {
  private_family: 'OWNER', other: 'OWNER', corporate_group: 'CORPORATE', pe: 'PE', vc: 'VC',
};

/** Perspectives the K1 answer contains, in a fixed order. */
export function perspectiveCandidates(ctx: AssessmentContext): Profile[] {
  const set = new Set(ctx.ownershipTags.map((t) => PERSPECTIVE_OF[t]));
  return (['OWNER', 'CORPORATE', 'PE', 'VC'] as Profile[]).filter((p) => set.has(p));
}

/** Only asked when K1 contains options with different perspectives. */
export const asksPerspective = (ctx: AssessmentContext) => perspectiveCandidates(ctx).length > 1;

/** Automatic perspective from K1 (Ag logic): PE, then VC, then Konzern, otherwise owner. */
export function autoProfile(ctx: AssessmentContext): Profile {
  if (hasPE(ctx)) return 'PE';
  if (hasVC(ctx)) return 'VC';
  if (hasCorporate(ctx)) return 'CORPORATE';
  return 'OWNER';
}

/** Every session has a perspective (BW11): the chosen one, else the automatic one. */
export function profileOf(ctx: AssessmentContext): Profile {
  return ctx.profileOverride ?? autoProfile(ctx);
}

// ── topics and modules (RO2) ─────────────────────────────────────────────────

/** Selected topics that count. With "Teil", the shared-services topic is preselected and cannot be removed (J11). */
export function activeTopics(ctx: AssessmentContext): Topic[] {
  const chosen = ctx.topicsNone ? [] : ctx.topics.filter((t) => !ctx.uncertainTopics.includes(t));
  if (isPart(ctx) && !chosen.includes('shared_services')) return [...chosen, 'shared_services'];
  return chosen;
}

/** Topics marked as uncertain (P9). Never active. */
export function uncertainTopics(ctx: AssessmentContext): Topic[] {
  return ctx.uncertainTopics.filter((t) => !(t === 'shared_services' && isPart(ctx)));
}

export function resolveRoutes(ctx: AssessmentContext): RouteMap {
  const topics = new Set(activeTopics(ctx));
  const crisis = crisisReason(ctx) !== null;
  const on = (b: boolean) => !crisis && b;
  const sellerAbroad = ctx.seller === 'individuals_foreign'
    || (asksSellerTax(ctx) && (ctx.sellerTax === 'different' || ctx.sellerTax === 'multiple'));
  return {
    CORE: on(true),
    RESTRUCTURING: on(topics.has('restructuring')),
    DEBT: on(topics.has('debt')),
    ACQUISITIONS: on(topics.has('acquisitions')),
    CONTINGENT: on(topics.has('contingent')),
    REGULATED: on(topics.has('regulated')),
    EMPLOYEE_EQUITY: on(topics.has('employee_equity')),
    INVESTOR_RIGHTS: on(hasPE(ctx) || hasVC(ctx)),
    PE_CONTEXT: on(hasPE(ctx)),
    SEPARATION: on(isPart(ctx) || topics.has('shared_services')),
    ASSET_TRANSFER: on(isPart(ctx)),
    CROSS_BORDER: on(sellerAbroad || topics.has('cross_border_ops')),
    PARTIAL: on(wants(ctx, 'shares') || wants(ctx, 'investor')),
    PRIMARY_CAPITAL: on(wants(ctx, 'investor')),
  };
}

export function activeModules(routes: RouteMap): RouteCode[] {
  return (Object.keys(routes) as RouteCode[]).filter((k) => k !== 'CORE' && routes[k]);
}

// ── automatic answers (RO4, RO5) ─────────────────────────────────────────────

/** Q09 = 100 without asking: largest customer under 10 %, not for Konzern or "Teil" (J8). */
export const q09Auto = (ctx: AssessmentContext) => ctx.company.largestCustomer === 'u10' && !hasCorporate(ctx) && !isPart(ctx);

/** Q26 = 100 without asking: private sellers all taxed at home, or K1 only Konzern with a holding/parent taxed at home (J5). */
export function q26Auto(ctx: AssessmentContext): 'individuals' | 'group' | null {
  if (ctx.seller === 'individuals_domestic') return 'individuals';
  if (onlyCorporate(ctx) && ctx.seller === 'holding' && ctx.sellerTax === 'same') return 'group';
  return null;
}

export function isAutoAnswered(id: string, ctx: AssessmentContext): boolean {
  return (id === 'Q09' && q09Auto(ctx)) || (id === 'Q26' && q26Auto(ctx) !== null);
}

// ── scope ────────────────────────────────────────────────────────────────────

/**
 * Questions in the current scope, in chapter order (RO10), including the
 * automatically answered ones. Q21 is replaced by Q45 when only a part is sold
 * (RO6); with a part sold, Q34 only follows when Q53 is "Trifft auf uns nicht
 * zu" (RO7). Answers marked "Trifft auf uns nicht zu" stay in scope here and
 * drop out of the weighting in scoring.ts.
 */
export function scopeQuestions(ctx: AssessmentContext, answers: AnswerMap): QuestionDef[] {
  const routes = resolveRoutes(ctx);
  const part = isPart(ctx);
  return CHAPTERS.flatMap((ch) => ch.ids.map((id) => QUESTION_BY_ID[id])).filter((q) => {
    if (!routes[q.route]) return false;
    if (q.id === 'Q21' && part) return false;
    if (q.id === 'Q34' && part) return answers.Q53?.status === 'not_applicable' && !answers.Q53.inactiveSince;
    return true;
  });
}

/** Questions the user sees ("Frage x von y" counts these, AB7). */
export function shownQuestions(ctx: AssessmentContext, answers: AnswerMap): QuestionDef[] {
  return scopeQuestions(ctx, answers).filter((q) => !isAutoAnswered(q.id, ctx));
}

// ── wording (sections 7 and 8) ───────────────────────────────────────────────

const ex = (base: string, from: string, to: string) => {
  if (!base.includes(from)) throw new Error(`Variant text not found: ${from}`);
  return base.replace(from, to);
};

const Q11_EXAMPLE: Record<string, string> = {
  'Software / SaaS': 'ein Cloud- oder Hosting-Anbieter',
  'IT- und Technologiedienstleistungen': 'ein Subunternehmer oder Cloud-Anbieter',
  Industrietechnologie: 'ein Zulieferer wichtiger Komponenten',
  Produktion: 'ein Zulieferer',
  Projektgeschäft: 'ein Subunternehmer',
  'Handel und Distribution': 'ein Hersteller, dessen Produkte Sie vertreiben, oder ein Logistikdienstleister',
  'Sonstige Dienstleistungen': 'ein Subunternehmer oder Software-Anbieter',
};

const largestCustomerAtLeast10 = (ctx: AssessmentContext) =>
  ctx.company.largestCustomer === '10_20' || ctx.company.largestCustomer === '20_30' || ctx.company.largestCustomer === 'o30';

/** Q07 growth wording: loss from deliberate growth investment, or no answer and K1 contains VC (J1). */
export const q07Growth = (ctx: AssessmentContext) =>
  ctx.company.earnings === 'growth_loss' || (ctx.company.earnings == null && hasVC(ctx));

/** The wording a question shows under the current context and answers. Same points and meaning in every variant. */
export function questionText(q: QuestionDef, ctx: AssessmentContext, answers: AnswerMap = {}): QuestionText {
  const b = q.base;
  const [a0, a50, a100] = b.anchors;
  const T = (question: string, anchors: [string, string, string] = b.anchors): QuestionText => ({ question, anchors });
  switch (q.id) {
    case 'Q01': {
      const question = isEmployedOrMixed(ctx) ? ex(b.question, 'Mitarbeitende, Ihre Rolle oder der Zeitpunkt', 'Mitarbeitende, die Rolle der Geschäftsführung oder der Zeitpunkt') : b.question;
      return T(question, [a0, a50, isOpenScope(ctx) ? 'Ja, Ziele und Reihenfolge sind schriftlich festgehalten, einschließlich der Möglichkeit, nicht zu verkaufen.' : a100]);
    }
    case 'Q02':
      return T(investorWording(ctx) ? ex(b.question, 'Ansprache der Käufer', 'Ansprache der Investoren') : b.question);
    case 'Q44':
      return T(isWhole(ctx) ? ex(b.question, 'zum verkauften Teil gehört', 'zum verkauften Unternehmen gehört') : b.question);
    case 'Q05': {
      const question = isFamily(ctx) ? b.question : ex(b.question, 'einen Finanzinvestor, Ihr Management oder in der Familie?', 'einen Finanzinvestor oder Ihr Management?');
      return T(question, [a0, a50, isOpenScope(ctx) ? 'Ja, Vor- und Nachteile sind gegen unsere Ziele abgewogen und festgehalten, einschließlich Weiterführen ohne Verkauf.' : a100]);
    }
    case 'Q06':
      return T(isEmployedOrMixed(ctx) ? 'Ist festgelegt, welche Rolle die heutige Geschäftsführung nach dem Verkauf übernimmt und wie lange?' : b.question);
    case 'Q03':
      return T(b.question, [a0, a50, isEmployedOrMixed(ctx) ? 'Ja, gemeinsam beschlossen, oder eine Person entscheidet allein.' : a100]);
    case 'Q04':
      if (hasCorporate(ctx)) return T(ex(b.question, '(z. B. Mitgesellschafter, Beirat, Ehepartner)', '(z. B. Vorstand, Aufsichtsrat)'));
      if (hasPE(ctx) || hasVC(ctx)) return T(ex(b.question, '(z. B. Mitgesellschafter, Beirat, Ehepartner)', '(z. B. Mitgesellschafter, Beirat, Investmentkomitee)'));
      return T(b.question);
    case 'Q07':
      return q07Growth(ctx)
        ? T('Können Sie zeigen, wie sich Ihr Wachstum in dauerhaften Gewinn übersetzt?', ['Nein, noch nicht.', 'Die Kennzahlen kennen wir, ein belegter Weg fehlt.', 'Ja, mit abgestimmten Kennzahlen je Kunde und dokumentiertem Weg zur Profitabilität.'])
        : T(b.question);
    case 'Q08':
      return isPart(ctx)
        ? T('Wissen Sie, wie viel Liquidität der verkaufte Teil nach dem Verkauf eigenständig braucht, z. B. für das Working Capital?', ['Nein, das haben wir nicht ermittelt.', 'Grob ja, eine Planung über 12 Monate fehlt.', 'Ja, mit Planung über 12 Monate und Szenarien.'])
        : T(b.question);
    case 'Q09': {
      const question = hasCorporate(ctx) || isPart(ctx) ? 'Wissen Sie, was Sie tun würden, wenn ein großer Kunde wegfällt, auch der Konzern oder das übrige Unternehmen als Abnehmer?' : b.question;
      return T(question, [a0, a50, largestCustomerAtLeast10(ctx) ? 'Ja, Gegenmaßnahmen sind festgehalten.' : a100]);
    }
    case 'Q11': {
      const example = Q11_EXAMPLE[ctx.company.businessModel ?? ''] ?? 'ein Zulieferer oder Cloud-Anbieter';
      return T(ex(b.question, 'ein Zulieferer oder Cloud-Anbieter', example));
    }
    case 'Q47':
      return T(isWhole(ctx) ? ex(b.question, 'der verkaufte Teil seine', 'das verkaufte Unternehmen seine') : b.question);
    case 'Q12':
      if (ctx.managementModel === 'employed') return T('Was würde ins Stocken geraten, wenn eine zentrale Führungskraft vier Wochen nicht da wäre?');
      if (ctx.managementModel === 'mixed') return T('Was würde ins Stocken geraten, wenn ein zentraler Entscheider vier Wochen nicht da wäre?');
      return T(b.question);
    case 'Q46':
      return T(isWhole(ctx) ? ex(b.question, 'vom Konzern oder vom übrigen Unternehmen kommen', 'vom Konzern oder von einer anderen Firma des Eigentümers kommen') : b.question);
    case 'Q21':
      return activeTopics(ctx).includes('acquisitions')
        ? T(b.question, [a0, 'Abschlüsse und Monatszahlen liegen vor, die Bereinigung um Einmaliges oder die Zahlen der Zukäufe fehlen.', 'Ja, Monatszahlen, Abschlüsse und die Bereinigung um einmalige Erträge und Kosten passen zusammen, auch für die zugekauften Unternehmen.'])
        : T(b.question);
    case 'Q45':
      return isWhole(ctx)
        ? T('Können Sie die Zahlen des verkauften Unternehmens so zeigen, als wäre es schon eigenständig?', ['Nein, eigene Zahlen für das Unternehmen gibt es nicht.', a50, a100])
        : T(b.question);
    case 'Q22': {
      const p = answers.Q08?.status === 'substantive' && !answers.Q08.inactiveSince ? answers.Q08.points : undefined;
      return p === 50 || p === 100
        ? T('Sie haben angegeben, dass es eine Planung gibt. Können Sie die Annahmen dahinter erklären, z. B. zu Kunden, Preisen und Personal?', ['Nein, die Annahmen sind nicht festgehalten und schwer zu erklären.', a50, a100])
        : T(b.question);
    }
    case 'Q23': {
      const topics = activeTopics(ctx);
      const extra = [
        topics.includes('acquisitions') ? 'offene Kaufpreiszahlungen aus Zukäufen' : null,
        topics.includes('employee_equity') ? 'Auszahlungen aus Mitarbeiterbeteiligungen' : null,
      ].filter(Boolean);
      return extra.length ? T(ex(b.question, 'Schulden, Pensionszusagen und Bankguthaben', `Schulden, Pensionszusagen, ${extra.join(', ')} und Bankguthaben`)) : T(b.question);
    }
    case 'Q24':
      return hasPE(ctx) || hasVC(ctx) || hasCorporate(ctx) ? T(ex(b.question, 'z. B. Ihre persönlichen Bürgschaften', 'z. B. Bürgschaften')) : T(b.question);
    case 'Q32':
      if (isPart(ctx)) return T('Können Sie belegen, dass Ihnen die Gesellschaften und Vermögenswerte gehören, die zum verkauften Teil gehören?', [a0, a50, 'Ja, Eigentum an Anteilen und wichtigen Vermögenswerten ist belegt.']);
      if (hasVC(ctx)) return T('Können Sie belegen, wem die Anteile gehören, einschließlich aller Optionen und Wandelrechte?', ['Nein, es gibt Lücken.', a50, 'Ja, die voll verwässerte Beteiligungsübersicht ist mit allen Verträgen abgestimmt.']);
      return T(b.question);
    case 'Q34':
      return largestCustomerAtLeast10(ctx) ? T(ex(b.question, 'z. B. mit großen Kunden, Lieferanten', 'z. B. mit Ihrem größten Kunden, Lieferanten')) : T(b.question);
    case 'Q48':
      return T(isWhole(ctx) ? ex(b.question, 'der Konzern oder das übrige Unternehmen', 'der Konzern oder eine andere Firma des Eigentümers') : b.question);
    case 'Q49':
      return T(isWhole(ctx) ? ex(b.question, 'des verkauften Teils', 'des verkauften Unternehmens') : b.question);
    default:
      return T(b.question);
  }
}

/** Label of "Trifft auf uns nicht zu" (ST3). */
export function naLabel(q: QuestionDef): string {
  return q.id === 'Q53' ? 'Trifft auf uns nicht zu, der Teil wird als eigene Gesellschaft verkauft' : 'Trifft auf uns nicht zu';
}

/** Extra lines (RG3, RG4): shown below the answer, a yes answer triggers a critical rule. */
export function followUpQuestion(id: string, answers: AnswerMap): string | null {
  const a = answers[id];
  if (!a || a.status !== 'substantive') return null;
  if (id === 'Q28' && a.points === 100) return 'Betrifft eine dieser Fristen den geplanten Zeitplan?';
  if (id === 'Q37' && (a.points === 50 || a.points === 100)) return 'Fällt dabei eine Genehmigung weg, ohne die Sie nicht arbeiten dürfen?';
  return null;
}

// ── status line and contact person (section 6) ───────────────────────────────

export type StatusLine = 'clarify' | 'lookup' | null;

export const STATUS_LABEL: Record<'clarify' | 'lookup', string> = {
  clarify: 'Muss ich erst klären',
  lookup: 'Muss ich erst nachsehen',
};

/** I46: G (shareholder question) none for families; F (management question) none when owner-led; K always clarify; N always look up. */
export function statusLine(q: QuestionDef, ctx: AssessmentContext): StatusLine {
  switch (q.statusType) {
    case 'G': return isFamily(ctx) ? null : 'clarify';
    case 'F': return isOwnerLed(ctx) ? null : 'clarify';
    case 'K': return 'clarify';
    case 'N': return 'lookup';
    default: return null;
  }
}

/** Contact person: owner-led (N10), family not owner-led (I15, I31, I47), otherwise the default. */
export function contributorOf(q: QuestionDef, ctx: AssessmentContext): string {
  if (q.id === 'Q01' && !hasPE(ctx) && !isOwnerLed(ctx) && !isFamily(ctx)) return 'Führender Gesellschafter';
  if (isOwnerLed(ctx)) return q.contributors.owner;
  if (isFamily(ctx)) return q.contributors.family ?? q.contributors.default;
  return q.contributors.default;
}

export function domainLead(domain: DomainKey, leads: Record<DomainKey, { default: string; family: string; owner: string }>, ctx: AssessmentContext): string {
  const l = leads[domain];
  return isOwnerLed(ctx) ? l.owner : isFamily(ctx) ? l.family : l.default;
}

// ── applicability changes (answers are never deleted) ───────────────────────

/**
 * Answers of questions that leave the scope are marked inactive; when a
 * question returns, its answer needs to be confirmed again ("Wieder im
 * Umfang, bitte erneut bestätigen", RO4). Returns the new answer map.
 */
export function reconcileScope(
  answers: AnswerMap, before: AssessmentContext, after: AssessmentContext, now: string, previous: AnswerMap = answers,
): { answers: AnswerMap; deactivated: string[]; reactivated: string[] } {
  const was = new Set(shownQuestions(before, previous).map((q) => q.id));
  const is = new Set(shownQuestions(after, answers).map((q) => q.id));
  const out: AnswerMap = { ...answers };
  const deactivated: string[] = [];
  const reactivated: string[] = [];
  for (const q of QUESTIONS) {
    const a = out[q.id];
    if (!a) continue;
    if (was.has(q.id) && !is.has(q.id) && !a.inactiveSince) {
      out[q.id] = { ...a, inactiveSince: now };
      deactivated.push(q.id);
    } else if (!was.has(q.id) && is.has(q.id) && a.inactiveSince) {
      out[q.id] = { ...a, inactiveSince: null, requiresReconfirmation: true };
      reactivated.push(q.id);
    }
  }
  return { answers: out, deactivated, reactivated };
}
