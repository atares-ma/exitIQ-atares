// Pure comparison of the local assessment with what the database holds, used
// by syncAll() to push only what differs. Kept free of Supabase so it is
// unit-tested.

import type { Answer } from '../model/types';

/** The fields of a current_answers row that matter for comparison. */
export interface RemoteAnswerRow {
  id: string;
  question_id: string;
  status: string;
  points: number | null;
  value: { followUp?: string | null } | null;
  requires_reconfirmation: boolean | null;
  inactive_since: string | null;
}

/** True when the latest remote row already records this local answer (null = cleared / never answered). */
export function answerMatches(local: Answer | null | undefined, remote: RemoteAnswerRow | undefined): boolean {
  if (!local) return !remote || remote.status === 'cleared';
  if (!remote) return false;
  const points = local.status === 'substantive' ? local.points ?? null : null;
  return remote.status === local.status
    && (remote.points ?? null) === points
    && (remote.value?.followUp ?? null) === (local.followUp ?? null)
    && !!remote.requires_reconfirmation === !!local.requiresReconfirmation
    && !!remote.inactive_since === !!local.inactiveSince;
}
