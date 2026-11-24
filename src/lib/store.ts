// Assessment state: one source of truth for the UI, saved to this browser on
// every change and appended to Supabase as an audit trail when available.
//
// Storage key v2: sessions saved with the old structure (discovery, Q27, Q30,
// Q40–Q43, Q51, old statuses) are not migrated but start fresh (H6).

import { useSyncExternalStore } from 'react';
import { TOPIC_SHORT } from '../model/options';
import { buildResult, snapshotOf } from '../model/plan';
import { activeModules, crisisReason, profileOf, reconcileScope, resolveRoutes } from '../model/routing';
import type { Answer, AnswerMap, AssessmentContext, Topic } from '../model/types';
import { blankContext } from './context';
import { deepList, firstOpenIndex, normalizeScreen, type Screen } from './journey';
import { answerMatches } from './reconcile';
import * as remote from './remote';

export type { Screen } from './journey';
export type TaskStatus = 'open' | 'in_progress' | 'done';
export type TaskResolution = remote.TaskResolution;

export interface TaskMeta { status: TaskStatus; dueDate: string | null; resolution: TaskResolution | null }

export function taskMetaOf(s: Pick<State, 'tasks'>, key: string): TaskMeta {
  return s.tasks[key] ?? { status: 'open', dueDate: null, resolution: null };
}

export interface State {
  v: 2;
  remoteId: string | null;
  answerIds: Record<string, string>;
  screen: Screen;
  resumeTo: Screen | null;
  ctx: AssessmentContext;
  answers: AnswerMap;
  qIdx: number;
  /** Set when a question was opened from the interim result, the result or the overview; "Weiter" returns there. */
  returnTo: 'interim' | 'result' | 'overview' | null;
  /** One-off notice, e.g. "Wir haben … in Ihren Einstellungen abgewählt." (ST3). */
  notice: string | null;
  tasks: Record<string, TaskMeta>;
  lastSnapshotKey: string | null;
  startedAt: string | null;
  savedAt: string | null;
}

const KEY = 'exitiq-assessment-v2';

function blank(): State {
  return {
    v: 2, remoteId: null, answerIds: {}, screen: 'context', resumeTo: null, ctx: blankContext(), answers: {}, qIdx: 0, returnTo: null,
    notice: null, tasks: {}, lastSnapshotKey: null, startedAt: null, savedAt: null,
  };
}

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return blank();
    const s = JSON.parse(raw) as State;
    if (s.v !== 2) return blank();
    return {
      ...blank(), ...s, ctx: { ...blankContext(), ...s.ctx, company: { ...blankContext().company, ...s.ctx?.company } },
      screen: s.screen === 'saved' ? 'saved' : normalizeScreen(s.screen), resumeTo: s.resumeTo ? normalizeScreen(s.resumeTo) : null,
    };
  } catch {
    return blank();
  }
}

let state: State = typeof localStorage !== 'undefined' ? load() : blank();
const subs = new Set<() => void>();

function write(next: State) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* private mode or quota: the in-memory state still works */
  }
  subs.forEach((f) => f());
}

export function useAssessment(): State {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => state,
    () => state,
  );
}

export function getState(): State {
  return state;
}

export function hasProgress(s: State = state): boolean {
  return !!s.startedAt;
}

// ── remote mirroring ─────────────────────────────────────────────────────────

const STAGE: Record<Screen, remote.Stage> = {
  context: 'CONTEXT', crisis: 'CRISIS', setup1: 'SETUP', setup2: 'SETUP', overview: 'OVERVIEW', deep: 'DEEP_ASSESSMENT',
  interim: 'INTERIM', result: 'RESULT', saved: 'SAVED',
};

/** Analytics stage names (H7): stage views, starts, chapter completion, result views. */
const TRACK_STAGE: Record<Screen, string> = {
  context: 'CONTEXT', crisis: 'CRISIS', setup1: 'SETUP_1', setup2: 'SETUP_2', overview: 'OVERVIEW', deep: 'DEEP_ASSESSMENT',
  interim: 'INTERIM_RESULT', result: 'RESULT', saved: 'SAVED',
};

/** Records which question is on screen, so exits can be located. Only the question id is sent, never an answer. */
export function trackQuestionView(questionId: string) {
  remote.track('stage_view', state.remoteId, { stage: `QUESTION:${questionId}`, profile: profileOf(state.ctx) });
}

function rowInput(s: State): remote.AssessmentRowInput {
  const resume = s.screen === 'saved' ? s.resumeTo ?? 'context' : s.screen;
  const taskStatus = Object.fromEntries(Object.entries(s.tasks).map(([k, m]) => [k, m.status]));
  return {
    stage: STAGE[s.screen], resumeStage: STAGE[resume === 'saved' ? 'context' : resume] as remote.AssessmentRowInput['resumeStage'], ctx: s.ctx,
    uiState: { v: 2, screen: s.screen, resumeTo: s.resumeTo, qIdx: s.qIdx, taskStatus },
    activeModules: activeModules(resolveRoutes(s.ctx)),
  };
}

async function remoteId(): Promise<string | null> {
  if (state.remoteId) return state.remoteId;
  const id = await remote.createAssessment(rowInput(state));
  if (id && !state.remoteId) {
    write({ ...state, remoteId: id });
    remote.track('assessment_start', id, { stage: 'CONTEXT' });
    if (Object.keys(state.answers).length) void syncAll();
  }
  return id;
}

let syncing: Promise<boolean> | null = null;

/** Makes the online copy match this browser. Resolves true when it is complete. */
export function syncAll(): Promise<boolean> {
  if (!syncing) syncing = reconcileAll().catch(() => false).finally(() => { syncing = null; });
  return syncing;
}

async function reconcileAll(): Promise<boolean> {
  remote.resetSignIn();
  if (!(await remote.ensureUser())) return false;
  let id = state.remoteId;
  if (id) {
    const exists = await remote.saveAssessment(id, rowInput(state));
    if (exists === null) return false;
    if (!exists) {
      id = null;
      remote.resetCreation();
      write({ ...state, remoteId: null, answerIds: {} });
    }
  }
  if (!id) {
    id = await remote.createAssessment(rowInput(state));
    if (!id) return false;
    if (state.remoteId !== id) {
      write({ ...state, remoteId: id });
      remote.track('assessment_start', id, { stage: STAGE[state.screen] });
    }
  }
  const snap = await remote.fetchRemoteState(id);
  if (!snap) return false;
  const ids: Record<string, string> = { ...state.answerIds };
  const qids = new Set([...Object.keys(state.answers), ...Object.keys(snap.answers)]);
  for (const q of qids) {
    const local = state.answers[q] ?? null;
    const row = snap.answers[q];
    if (answerMatches(local, row)) {
      if (row) ids[q] = row.id;
      continue;
    }
    const newId = await remote.appendAnswer(id, q, local, row?.id ?? null);
    if (!newId) return false;
    ids[q] = newId;
  }
  write({ ...state, answerIds: ids });
  if (state.lastSnapshotKey && !snap.hasResult) {
    if (!(await remote.saveResult(id, snapshotOf(buildResult(state.ctx, state.answers))))) return false;
  }
  for (const [key, m] of Object.entries(state.tasks)) {
    if (!(await remote.setTaskMeta(id, key, m))) return false;
  }
  return true;
}

let lastOnline: boolean | null = null;
remote.onBackupHealth((h) => {
  if (lastOnline === false && h.online === true && hasProgress()) void syncAll();
  if (h.online === true) {
    const n = remote.takeSaveFailures();
    if (n) remote.track('save', state.remoteId, { stage: `SAVE_RECOVERED:${n}` });
  }
  lastOnline = h.online;
});

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleAssessmentSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const id = await remoteId();
    if (id) void remote.saveAssessment(id, rowInput(state));
  }, 600);
}

async function mirrorAnswer(questionId: string) {
  const id = await remoteId();
  if (!id) return;
  const a = state.answers[questionId] ?? null;
  const newId = await remote.appendAnswer(id, questionId, a, state.answerIds[questionId] ?? null);
  if (newId) write({ ...state, answerIds: { ...state.answerIds, [questionId]: newId } });
}

// ── actions ──────────────────────────────────────────────────────────────────

const now = () => new Date().toISOString();

function touch(next: Partial<State>): State {
  return { ...state, ...next, startedAt: state.startedAt ?? now(), savedAt: now() };
}

/** Applies a context change. Answers are never deleted: out-of-scope answers go inactive and need confirming on return. */
function applyContext(ctx: AssessmentContext, answers: AnswerMap, extra: Partial<State> = {}) {
  const rec = reconcileScope(answers, state.ctx, ctx, now(), state.answers);
  write(touch({ ctx, answers: rec.answers, ...extra }));
  scheduleAssessmentSave();
  [...rec.deactivated, ...rec.reactivated].forEach((q) => void mirrorAnswer(q));
  if ((rec.deactivated.length || rec.reactivated.length) && state.remoteId) remote.track('route_change', state.remoteId, { stage: 'CONTEXT' });
}

export function setContext(patch: Partial<AssessmentContext>) {
  applyContext({ ...state.ctx, ...patch }, state.answers);
}

/** "Trifft auf uns nicht zu" at Q28 or Q31 deselects the specialist topic (ST3). */
const NA_TOPIC: Record<string, Topic> = { Q28: 'restructuring', Q31: 'contingent' };

export function setAnswer(questionId: string, answer: Omit<Answer, 'answeredAt'> | null) {
  const answers = { ...state.answers };
  if (answer) {
    const prev = answers[questionId];
    const samePoints = prev?.status === 'substantive' && answer.status === 'substantive' && prev.points === answer.points;
    answers[questionId] = { ...answer, followUp: answer.followUp ?? (samePoints ? prev?.followUp ?? null : null), answeredAt: now(), requiresReconfirmation: false, inactiveSince: null };
  } else delete answers[questionId];

  const topic = answer?.status === 'not_applicable' ? NA_TOPIC[questionId] : undefined;
  if (topic) {
    const ctx = { ...state.ctx, topics: state.ctx.topics.filter((t) => t !== topic) };
    if (!ctx.topics.length && !ctx.uncertainTopics.length) ctx.topicsNone = true;
    applyContext(ctx, answers, { notice: `Wir haben „${TOPIC_SHORT[topic]}“ in Ihren Einstellungen abgewählt.` });
    void mirrorAnswer(questionId);
    return;
  }
  // An answer can change the scope (Q53 "Trifft auf uns nicht zu" brings Q34 in).
  applyContext(state.ctx, answers);
  void mirrorAnswer(questionId);
}

export function setFollowUp(questionId: string, followUp: 'yes' | 'no') {
  const a = state.answers[questionId];
  if (!a) return;
  write(touch({ answers: { ...state.answers, [questionId]: { ...a, followUp } } }));
  void mirrorAnswer(questionId);
}

/** Confirms an earlier answer unchanged after its question came back into scope. */
export function reconfirm(questionId: string) {
  const a = state.answers[questionId];
  if (!a) return;
  write(touch({ answers: { ...state.answers, [questionId]: { ...a, requiresReconfirmation: false, answeredAt: now() } } }));
  void mirrorAnswer(questionId);
}

export function dismissNotice() {
  if (state.notice) write({ ...state, notice: null });
}

/** Opens a screen. The detailed questions open at the first question that still needs an answer unless a position is given. */
export function go(target: Screen, extra: Partial<State> = {}) {
  let screen = target;
  // After the context page a crisis ends ExitIQ (AB5).
  if ((screen === 'setup1' || screen === 'overview' || screen === 'deep') && crisisReason(state.ctx)) screen = 'crisis';
  const resumeTo = screen === 'saved' ? (state.screen === 'saved' ? state.resumeTo : state.screen) : state.resumeTo;
  if (screen === 'deep' && extra.qIdx === undefined) {
    const list = deepList(state.ctx, state.answers);
    const first = firstOpenIndex(list, state.answers);
    extra = { ...extra, qIdx: first >= 0 ? first : Math.min(state.qIdx, Math.max(0, list.length - 1)) };
  }
  if (screen !== 'deep' && extra.returnTo === undefined) extra = { ...extra, returnTo: null };
  write(touch({ screen, resumeTo, ...extra }));
  scheduleAssessmentSave();
  remote.track(screen === 'saved' ? 'save' : 'stage_view', state.remoteId, { stage: TRACK_STAGE[screen], profile: profileOf(state.ctx) });
  try {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch {
    /* jsdom / old browsers */
  }
}

/** Opens one question, remembering where to return. */
export function openQuestion(id: string, returnTo: State['returnTo']) {
  const list = deepList(state.ctx, state.answers);
  const i = list.findIndex((x) => x.q.id === id);
  if (i >= 0) go('deep', { qIdx: i, returnTo });
}

export function setPosition(qIdx: number) {
  write(touch({ qIdx }));
  scheduleAssessmentSave();
  try {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch {
    /* ignore */
  }
}

/** Reports a finished chapter once (H7: chapter completion). */
const reportedChapters = new Set<number>();
export function chapterDone(chapter: number) {
  if (reportedChapters.has(chapter)) return;
  reportedChapters.add(chapter);
  remote.track('theme_complete', state.remoteId, { stage: `CHAPTER:${chapter + 1}`, profile: profileOf(state.ctx) });
}

export function updateTasks(keys: string[], patch: Partial<TaskMeta>) {
  const tasks = { ...state.tasks };
  for (const k of keys) {
    const next: TaskMeta = { ...taskMetaOf(state, k), ...patch };
    if (next.status !== 'done') next.resolution = null;
    tasks[k] = next;
  }
  write(touch({ tasks }));
  const id = state.remoteId;
  if (id) keys.forEach((k) => void remote.setTaskMeta(id, k, state.tasks[k]));
}

/** Called when the result is shown: stores a versioned snapshot when the result changed. */
export function recordResult() {
  const r = buildResult(state.ctx, state.answers);
  const key = JSON.stringify([r.profile, r.dimensions.map((d) => [d.displayIndex, d.status]), r.tasks.length]);
  const changed = key !== state.lastSnapshotKey;
  if (changed) write({ ...state, lastSnapshotKey: key });
  void remoteId().then((id) => {
    if (!id) return;
    if (changed) void remote.saveResult(id, snapshotOf(r));
    remote.track('result_view', id, { stage: 'RESULT', profile: r.profile });
  });
}

export function resume() {
  const target = state.resumeTo && state.resumeTo !== 'saved' ? state.resumeTo : 'context';
  remote.track('resume', state.remoteId, { stage: STAGE[target] });
  go(target, { qIdx: state.qIdx });
}

export async function hydrateFromRemote(): Promise<boolean> {
  if (hasProgress()) return false;
  try {
    const r = await remote.loadLatest();
    if (!r) return false;
    const ui = r.uiState as { v?: number; screen?: string; resumeTo?: string; qIdx?: number; taskStatus?: Record<string, TaskStatus> };
    if (ui.v !== 2) return false; // old structure: start fresh (H6)
    const tasks: Record<string, TaskMeta> = {};
    for (const [k, m] of Object.entries(r.tasks)) tasks[k] = { status: (m.status as TaskStatus) ?? 'open', dueDate: m.dueDate, resolution: m.resolution };
    write({
      ...blank(), remoteId: r.id, answerIds: r.answerIds, ctx: { ...blankContext(), ...r.ctx, company: { ...blankContext().company, ...r.ctx?.company } },
      answers: r.answers, screen: 'saved', resumeTo: normalizeScreen(ui.resumeTo ?? ui.screen), qIdx: ui.qIdx ?? 0, tasks,
      startedAt: r.updatedAt, savedAt: r.updatedAt,
    });
    return true;
  } catch {
    return false;
  }
}

export async function deleteEverything() {
  if (state.remoteId) await remote.deleteAssessment(state.remoteId);
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  remote.resetCreation();
  write(blank());
}

export function startNew() {
  remote.resetCreation();
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  write(blank());
}
