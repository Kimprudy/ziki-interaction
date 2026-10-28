// Workspace state: the one place where human decisions and simulated agent
// steps change the app. Every section reads from here, so they always agree.

import { useEffect, useRef, useState } from 'react';
import {
  type ActivityEntry, type Actor, type DecisionOption, type EventType, type Plan, type Priority, type Stage, type Tone,
  bumpIdPast, commitFor, decisionOptions, initialActivity, initialPlan402, newId, plan405, planFor388,
} from './data';

export type EscalationState = 'waiting' | 'paused' | 'takenOver' | 'resumed';
export type ReportState = 'pending' | 'confirmed' | 'rejected';
export type DeliveryState = 'delivering' | 'testing' | 'verified' | 'merged';
export type Delivery = { state: DeliveryState; round: number; feedback?: string };
export type Decision = { option: DecisionOption; note: string };

export type IssueStatus = { label: string; tone: Tone; stage: Stage; owner: string; next: string; inboxKey?: string; complete?: boolean };
export type InboxKind = 'Agent question' | 'Plan approval' | 'Merge approval' | 'Report review';
export type InboxItem = {
  key: string; issueId: string; kind: InboxKind; priority: Priority;
  summary: string; group: 'needs' | 'agent' | 'done'; statusLabel: string;
};
export type Notice = { id: number; title: string; body: string; inboxKey: string };

type Saved = {
  version: 1;
  escalation: EscalationState;
  decision: Decision | null;
  report: ReportState;
  reportReason?: string;
  plans: Record<string, Plan>;
  delivery: Record<string, Delivery>;
  activity: ActivityEntry[];
};

const STORAGE_KEY = 'ziki-prototype-state-v1';

/** Simulated agent timing (ms): short enough to watch, long enough to notice. */
export const AGENT_STEP = 1400;

const initialState = (): Saved => ({
  version: 1, escalation: 'waiting', decision: null, report: 'pending',
  plans: { '#402': initialPlan402 }, delivery: {}, activity: initialActivity,
});

function loadSaved(): Saved | null {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Saved | null;
    if (saved?.version !== 1 || !Array.isArray(saved.activity)) return null;
    bumpIdPast(Math.max(0, ...saved.activity.map((entry) => entry.id)));
    return saved;
  } catch {
    return null;
  }
}

const clock = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const entry = (actor: Actor, name: string, action: string, issueId: string, type: EventType): ActivityEntry =>
  ({ id: newId(), actor, name, action, issueId, type, when: `Today · ${clock()}` });

export function useWorkspace() {
  const [data, setData] = useState<Saved>(() => loadSaved() ?? initialState());
  const [notices, setNotices] = useState<Notice[]>([]);
  const latest = useRef(data);
  latest.current = data;
  const timers = useRef(new Map<string, number>());

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }, [data]);

  /* ---------- small helpers ---------- */

  const update = (fn: (s: Saved) => Partial<Saved>, ...logs: ActivityEntry[]) =>
    setData((s) => ({ ...s, ...fn(s), activity: [...[...logs].reverse(), ...s.activity] }));
  const withPlan = (s: Saved, id: string, patch: Partial<Plan>) => ({ ...s.plans, [id]: { ...s.plans[id], ...patch } });
  const notify = (title: string, body: string, inboxKey: string) =>
    setNotices((current) => [...current.filter((n) => n.inboxKey !== inboxKey), { id: newId(), title, body, inboxKey }].slice(-3));
  const dismissNotice = (id: number) => setNotices((current) => current.filter((n) => n.id !== id));
  const cancelTimers = (issueId: string) => {
    for (const [key, timer] of timers.current) if (key.startsWith(`${issueId}:`)) { clearTimeout(timer); timers.current.delete(key); }
  };

  /* ---------- simulated agent steps, driven by state so they survive a reload ---------- */

  function finishDraft(id: string, revision: number) {
    const plan = latest.current.plans[id];
    if (plan?.state !== 'drafting' || plan.revision !== revision) return;
    update((s) => ({ plans: withPlan(s, id, { state: 'pending' }) }),
      entry('Agent', plan.agent, `Submitted a plan for approval: ${plan.title} (est. ${plan.estimate})`, id, 'Approval'));
    notify(`${plan.agent} sent a plan`, `${id} · ${plan.title}`, `plan-${id}`);
  }

  function finishRevision(id: string, revision: number) {
    const plan = latest.current.plans[id];
    if (plan?.state !== 'changes' || plan.revision !== revision) return;
    const steps = [...plan.steps.filter((step) => !step.startsWith('Address your feedback')), `Address your feedback: “${plan.feedback}”`];
    update((s) => ({ plans: withPlan(s, id, { steps, revision: revision + 1, state: 'pending' }) }),
      entry('Agent', plan.agent, `Submitted revision ${revision + 1} of the plan for approval`, id, 'Approval'));
    notify(`${plan.agent} revised the plan`, `${id} · revision ${revision + 1} is ready`, `plan-${id}`);
  }

  function finishDelivery(id: string, round: number) {
    const d = latest.current.delivery[id];
    const plan = latest.current.plans[id];
    if (d?.state !== 'delivering' || d.round !== round || !plan) return;
    update((s) => ({ delivery: { ...s.delivery, [id]: { ...d, state: 'testing' } } }),
      entry('Agent', plan.agent, `${round > 1 ? 'Updated the pull request' : 'Linked a pull request'} with the fix (commit ${commitFor(id, round)}, simulated)`, id, 'Agent work'),
      entry('System', 'Ziki', 'Moved to Prove: waiting for an independent tester', id, 'Status change'));
  }

  function finishTesting(id: string, round: number) {
    const d = latest.current.delivery[id];
    if (d?.state !== 'testing' || d.round !== round) return;
    update((s) => ({ delivery: { ...s.delivery, [id]: { ...d, state: 'verified' } } }),
      entry('Agent', 'Ziki Tester', `Verified commit ${commitFor(id, round)}: reproduced the issue before the fix, all checks pass after it`, id, 'Agent work'),
      entry('System', 'Ziki', 'Moved to Merge: waiting for a human to approve the merge', id, 'Status change'));
    notify(`${id} passed testing`, 'Ziki Tester verified the fix. Approve the merge?', `merge-${id}`);
  }

  // Clear timers on a real unmount (and on React's dev-only double mount).
  useEffect(() => () => { timers.current.forEach(clearTimeout); timers.current.clear(); }, []);

  useEffect(() => {
    const due: [string, number, () => void][] = [];
    for (const [id, plan] of Object.entries(data.plans)) {
      if (plan.state === 'drafting') due.push([`${id}:draft:${plan.revision}`, AGENT_STEP * 2, () => finishDraft(id, plan.revision)]);
      if (plan.state === 'changes') due.push([`${id}:revise:${plan.revision}`, AGENT_STEP * 2, () => finishRevision(id, plan.revision)]);
    }
    for (const [id, d] of Object.entries(data.delivery)) {
      if (d.state === 'delivering') due.push([`${id}:deliver:${d.round}`, AGENT_STEP * 1.6, () => finishDelivery(id, d.round)]);
      if (d.state === 'testing') due.push([`${id}:test:${d.round}`, AGENT_STEP * 2, () => finishTesting(id, d.round)]);
    }
    for (const [key, ms, run] of due) {
      if (timers.current.has(key)) continue;
      timers.current.set(key, window.setTimeout(() => { timers.current.delete(key); run(); }, ms));
    }
  });

  /* ---------- human actions ---------- */

  function respond(next: Decision) {
    const label = decisionOptions.find((option) => option.id === next.option)!.label;
    update((s) => ({ escalation: 'resumed', decision: next, plans: { ...s.plans, '#388': planFor388(next.option, next.note) } }),
      entry('Human', 'Jordan D.', `Answered the escalation: “${next.option === 'other' ? next.note : label}”`, '#388', 'Handoff'),
      entry('Agent', 'Ziki Reviewer', 'Resumed with your decision and started drafting a plan', '#388', 'Agent work'));
  }

  function takeOver() {
    cancelTimers('#388');
    update(() => ({ escalation: 'takenOver' }),
      entry('Human', 'Jordan D.', 'Took over the issue; the agent stopped working on it', '#388', 'Handoff'),
      entry('System', 'Ziki', 'Owner changed from Ziki Reviewer to Jordan D.', '#388', 'Status change'));
  }

  function keepPaused() {
    update(() => ({ escalation: 'paused' }), entry('Human', 'Jordan D.', 'Kept the agent paused for now', '#388', 'Handoff'));
  }

  function approvePlan(id: string) {
    const plan = latest.current.plans[id];
    update((s) => ({ plans: withPlan(s, id, { state: 'approved' }), delivery: { ...s.delivery, [id]: { state: 'delivering', round: 1 } } }),
      entry('Human', 'Jordan D.', `Approved the plan (revision ${plan.revision})`, id, 'Approval'),
      entry('System', 'Ziki', 'Plan authorized; moved to Deliver', id, 'Status change'));
  }

  function requestChanges(id: string, feedback: string) {
    const plan = latest.current.plans[id];
    update((s) => ({ plans: withPlan(s, id, { state: 'changes', feedback }) }),
      entry('Human', 'Jordan D.', `Requested changes: “${feedback}”`, id, 'Approval'),
      entry('Agent', plan.agent, 'Picked up your feedback and is revising the plan', id, 'Agent work'));
  }

  function approveMerge(id: string) {
    update((s) => ({ delivery: { ...s.delivery, [id]: { ...s.delivery[id], state: 'merged' } } }),
      entry('Human', 'Jordan D.', 'Approved the merge', id, 'Approval'),
      entry('System', 'Ziki', 'Merged and closed the issue (simulated)', id, 'Status change'));
  }

  function sendBack(id: string, feedback: string) {
    const d = latest.current.delivery[id];
    const plan = latest.current.plans[id];
    update((s) => ({ delivery: { ...s.delivery, [id]: { state: 'delivering', round: d.round + 1, feedback } } }),
      entry('Human', 'Jordan D.', `Sent the fix back before merging: “${feedback}”`, id, 'Approval'),
      entry('Agent', plan.agent, 'Picked up your feedback and is updating the fix', id, 'Agent work'),
      entry('System', 'Ziki', 'Moved back to Deliver', id, 'Status change'));
  }

  function confirmReport() {
    update((s) => ({ report: 'confirmed', plans: { ...s.plans, '#405': plan405 } }),
      entry('Human', 'Jordan D.', 'Confirmed the report as the second independent reviewer', '#405', 'Handoff'),
      entry('System', 'Ziki', 'Confirmed by two reviewers; moved to Authorize', '#405', 'Status change'),
      entry('Agent', plan405.agent, 'Claimed the issue and started drafting a plan', '#405', 'Agent work'));
  }

  function rejectReport(reason: string) {
    update(() => ({ report: 'rejected', reportReason: reason }),
      entry('Human', 'Jordan D.', `Could not confirm the report: “${reason}”`, '#405', 'Handoff'),
      entry('System', 'Ziki', 'Closed: the report was not confirmed', '#405', 'Status change'));
  }

  function resetScenario(id: string) {
    cancelTimers(id);
    setNotices((current) => current.filter((n) => !n.inboxKey.endsWith(id)));
    update((s) => {
      const { [id]: _plan, ...plans } = s.plans;
      const { [id]: _delivery, ...delivery } = s.delivery;
      if (id === '#388') return { escalation: 'waiting', decision: null, plans, delivery };
      if (id === '#405') return { report: 'pending', reportReason: undefined, plans, delivery };
      return { plans: { ...plans, [id]: initialPlan402 }, delivery };
    }, entry('System', 'Ziki', 'Scenario reset', id, 'Status change'));
  }

  function resetAll() {
    timers.current.forEach(clearTimeout);
    timers.current.clear();
    setNotices([]);
    localStorage.removeItem(STORAGE_KEY);
    setData(initialState());
  }

  /* ---------- derived status ---------- */

  function deliveryStatus(id: string, owner: string): IssueStatus {
    const d = data.delivery[id];
    if (d?.state === 'testing') return { label: 'In testing', tone: 'agent', stage: 'Prove', owner, next: 'An independent tester verifies the exact commit' };
    if (d?.state === 'verified') return { label: 'Ready to merge', tone: 'needs', stage: 'Merge', owner, next: 'Tests passed. Approve the merge in Inbox', inboxKey: `merge-${id}` };
    if (d?.state === 'merged') return { label: 'Merged', tone: 'done', stage: 'Merge', owner, next: 'Done: the fix is merged and the issue is closed', complete: true };
    return { label: d && d.round > 1 ? 'Agent updating fix' : 'In delivery', tone: 'agent', stage: 'Deliver', owner, next: 'Agent is writing the fix and will link a pull request' };
  }

  function planStatus(id: string, owner: string): IssueStatus {
    const plan = data.plans[id];
    if (!plan || plan.state === 'drafting') return { label: 'Agent drafting plan', tone: 'agent', stage: 'Authorize', owner, next: 'Agent is drafting a plan; it will ask for your approval' };
    if (plan.state === 'pending') return { label: 'Plan awaiting approval', tone: 'needs', stage: 'Authorize', owner, next: 'Approve the plan or request changes in Inbox', inboxKey: `plan-${id}` };
    if (plan.state === 'changes') return { label: 'Agent revising', tone: 'agent', stage: 'Authorize', owner, next: 'Agent is revising the plan using your feedback' };
    return deliveryStatus(id, owner);
  }

  function statusOf(id: string): IssueStatus {
    if (id === '#388') {
      if (data.escalation === 'waiting') return { label: 'Needs your decision', tone: 'needs', stage: 'Authorize', owner: 'Ziki Reviewer', next: 'Answer the agent’s question in Inbox', inboxKey: 'esc-#388' };
      if (data.escalation === 'paused') return { label: 'Paused by you', tone: 'paused', stage: 'Authorize', owner: 'Ziki Reviewer', next: 'Agent stays paused until you answer in Inbox', inboxKey: 'esc-#388' };
      if (data.escalation === 'takenOver') return { label: 'Human-owned', tone: 'human', stage: 'Deliver', owner: 'Jordan D. (you)', next: 'You deliver the fix; the agent has stopped' };
      return planStatus('#388', 'Ziki Reviewer');
    }
    if (id === '#402') return planStatus('#402', 'Ziki Writer');
    if (id === '#405') {
      if (data.report === 'pending') return { label: 'Needs your review', tone: 'needs', stage: 'Confirm', owner: 'Unassigned', next: 'Review the report as the second reviewer in Inbox', inboxKey: 'report-#405' };
      if (data.report === 'rejected') return { label: 'Closed · not confirmed', tone: 'paused', stage: 'Confirm', owner: 'Unassigned', next: 'Closed after review; no work will start' };
      return planStatus('#405', 'ASA3 Solver');
    }
    return { label: 'In testing', tone: 'agent', stage: 'Prove', owner: 'ASA3 Solver', next: 'An independent tester verifies the fix before merge' };
  }

  /* ---------- inbox ---------- */

  const deliveryLabel: Record<DeliveryState, string> = { delivering: 'Approved · in delivery', testing: 'Approved · in testing', verified: 'Approved · ready to merge', merged: 'Approved · merged' };

  function planItem(id: string, priority: Priority): InboxItem | null {
    const plan = data.plans[id];
    if (!plan) return null;
    const base = { key: `plan-${id}`, issueId: id, kind: 'Plan approval' as const, priority };
    if (plan.state === 'drafting') return { ...base, group: 'agent', statusLabel: 'Agent drafting', summary: `${plan.agent} is drafting a plan.` };
    if (plan.state === 'pending') return { ...base, group: 'needs', statusLabel: plan.revision > 1 ? `Revision ${plan.revision} ready` : 'Approval needed', summary: `${plan.agent} proposes: ${plan.title}.` };
    if (plan.state === 'changes') return { ...base, group: 'agent', statusLabel: 'Agent revising', summary: `${plan.agent} is revising the plan using your feedback.` };
    return { ...base, group: 'done', statusLabel: deliveryLabel[data.delivery[id]?.state ?? 'delivering'], summary: `You approved: ${plan.title}.` };
  }

  function mergeItem(id: string, priority: Priority): InboxItem | null {
    const d = data.delivery[id];
    if (!d || (d.round === 1 && (d.state === 'delivering' || d.state === 'testing'))) return null;
    const base = { key: `merge-${id}`, issueId: id, kind: 'Merge approval' as const, priority };
    if (d.state === 'verified') return { ...base, group: 'needs', statusLabel: 'Tests passed', summary: 'Ziki Tester verified the fix. Approve the merge or send it back.' };
    if (d.state === 'merged') return { ...base, group: 'done', statusLabel: 'Merged', summary: 'You approved the merge. The issue is closed.' };
    return { ...base, group: 'agent', statusLabel: 'Agent updating fix', summary: 'You sent the fix back; the agent is updating it.' };
  }

  const waiting = data.escalation === 'waiting' || data.escalation === 'paused';
  const escalationItem: InboxItem = {
    key: 'esc-#388', issueId: '#388', kind: 'Agent question', priority: 'High',
    group: waiting ? 'needs' : 'done',
    statusLabel: data.escalation === 'waiting' ? 'Waiting for you' : data.escalation === 'paused' ? 'Kept paused' : data.escalation === 'takenOver' ? 'You took over' : 'Answered',
    summary: waiting ? 'Ziki Reviewer paused and needs a security policy decision.' : data.escalation === 'takenOver' ? 'You took responsibility for this issue.' : 'Your decision was sent to the agent.',
  };
  const reportItem: InboxItem = {
    key: 'report-#405', issueId: '#405', kind: 'Report review', priority: 'Low',
    group: data.report === 'pending' ? 'needs' : 'done',
    statusLabel: data.report === 'pending' ? 'Second review needed' : data.report === 'confirmed' ? 'Confirmed' : 'Not confirmed',
    summary: data.report === 'pending' ? 'Confirm a bug report so work can start.' : data.report === 'confirmed' ? 'You confirmed the report.' : 'You closed the report.',
  };

  const priorityRank: Record<Priority, number> = { High: 0, Medium: 1, Low: 2 };
  const inbox = [
    escalationItem, mergeItem('#388', 'High'), planItem('#388', 'High'),
    mergeItem('#402', 'Medium'), planItem('#402', 'Medium'),
    reportItem, mergeItem('#405', 'Low'), planItem('#405', 'Low'),
  ].filter((item): item is InboxItem => item !== null)
    .sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]);

  return {
    ...data, inbox, statusOf, notices, dismissNotice,
    pendingCount: inbox.filter((item) => item.group === 'needs').length,
    actions: { respond, takeOver, keepPaused, approvePlan, requestChanges, approveMerge, sendBack, confirmReport, rejectReport, resetScenario, resetAll },
  };
}

export type Workspace = ReturnType<typeof useWorkspace>;
