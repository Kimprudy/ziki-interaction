// Sample data and shared types for the Ziki interaction prototype.
// Everything here is fictional demonstration content; nothing is fetched from Ziki.

export type Section = 'Console' | 'Inbox' | 'Issues' | 'Ranking' | 'Activity';
export type Actor = 'Human' | 'Agent' | 'System';
export type EventType = 'Handoff' | 'Approval' | 'Agent work' | 'Status change' | 'Issue work';
export type Stage = 'Report' | 'Confirm' | 'Authorize' | 'Deliver' | 'Prove' | 'Merge';
export type Priority = 'High' | 'Medium' | 'Low';
export type Tone = 'needs' | 'agent' | 'human' | 'paused' | 'open' | 'done';

/** Ziki's published issue lifecycle (ziki.dev → How it works). */
export const stages: Stage[] = ['Report', 'Confirm', 'Authorize', 'Deliver', 'Prove', 'Merge'];

export const stageHelp: Record<Stage, string> = {
  Report: 'Filed with context and duplicate protection',
  Confirm: 'Two independent reviewers verify the report',
  Authorize: 'Agent shares its approach; the owner approves',
  Deliver: 'Solver writes the fix and links a pull request',
  Prove: 'Independent testers verify the exact commit',
  Merge: 'A merger checks approvals and passing tests',
};

export type ActivityEntry = {
  id: number;
  actor: Actor;
  name: string;
  action: string;
  issueId: string;
  type: EventType;
  when: string;
  sample?: boolean;
};

export type Issue = {
  id: string;
  title: string;
  shortTitle: string;
  priority: Priority;
  category: string;
  agent: string;
};

export const issues: Issue[] = [
  { id: '#388', title: 'Google sign-in skips two-factor for a password account', shortTitle: 'Google sign-in skips two-factor', priority: 'High', category: 'Authentication', agent: 'Ziki Reviewer' },
  { id: '#400', title: 'Profile page shows stale details after an update', shortTitle: 'Profile page shows stale details', priority: 'Medium', category: 'Profile', agent: 'ASA3 Solver' },
  { id: '#402', title: 'Update account recovery guidance', shortTitle: 'Account recovery guidance', priority: 'Medium', category: 'Documentation', agent: 'Ziki Writer' },
  { id: '#405', title: 'Add a clearer empty state to saved items', shortTitle: 'Saved items empty state', priority: 'Low', category: 'Experience', agent: 'Unassigned' },
];

export const issueById = (id: string) => issues.find((issue) => issue.id === id)!;

let nextId = 1;
export const newId = () => nextId++;

const sample = (actor: Actor, name: string, action: string, issueId: string, type: EventType): ActivityEntry => ({
  id: newId(), actor, name, action, issueId, type, when: 'Sample', sample: true,
});

// Newest first.
export const initialActivity: ActivityEntry[] = [
  sample('Agent', 'Ziki Reviewer', 'Paused and escalated: a security policy decision is needed', '#388', 'Handoff'),
  sample('Agent', 'Ziki Writer', 'Proposed a plan to clarify account recovery options (est. 30 min)', '#402', 'Approval'),
  sample('Agent', 'Ziki Reviewer', 'Reproduced the bypass: Google sign-in reaches the dashboard without a 2FA prompt', '#388', 'Agent work'),
  sample('System', 'Ziki', 'Moved to Prove: waiting for an independent tester', '#400', 'Status change'),
  sample('Agent', 'ASA3 Solver', 'Linked a pull request with the profile cache fix', '#400', 'Agent work'),
  sample('System', 'Ziki', 'Confirmed by two reviewers; moved to Authorize', '#388', 'Status change'),
  sample('Human', 'Mina K.', 'Reported the issue with reproduction steps', '#405', 'Issue work'),
  sample('Human', 'Mina K.', 'Reported the issue with reproduction steps', '#388', 'Issue work'),
];

// The escalation on #388: what the agent knows and the choices it offers.
export type DecisionOption = 'require' | 'trust' | 'other';

export const decisionOptions: { id: DecisionOption; label: string; consequence: string; recommended?: boolean }[] = [
  {
    id: 'require',
    label: 'Require two-factor after Google sign-in when it’s enabled',
    consequence: 'Agent drafts a fix that shows the 2FA challenge before a session is created. Affected users see one extra step.',
    recommended: true,
  },
  {
    id: 'trust',
    label: 'Trust Google’s verification and keep the current behaviour',
    consequence: 'Agent documents the exception instead of changing code. The bypass for password accounts remains.',
  },
  {
    id: 'other',
    label: 'Something else — I’ll explain',
    consequence: 'Agent drafts a plan from your written guidance.',
  },
];

export const escalationEvidence = {
  task: { title: 'Review the authentication flow', body: 'Trace Google sign-in and confirm when two-factor verification should be required.' },
  attempted: ['Compared Google sign-in with password sign-in', 'Located where the two-factor challenge is triggered', 'Reproduced the issue on a test account'],
  blocker: 'The expected policy for Google sign-in on accounts with 2FA is not written down. Either behaviour is defensible, so the agent paused instead of choosing a security rule on your behalf.',
  findings: [
    { label: 'Reproduction', value: 'Password account with 2FA → “Continue with Google” → dashboard. No 2FA prompt.' },
    { label: 'Code path', value: 'The Google callback creates the session before the second-factor check runs.' },
    { label: 'Risk', value: 'High — anyone with access to the linked Google account skips the account’s second factor.' },
    { label: 'Agent confidence', value: 'Sure about the cause. Not sure which behaviour you want.' },
  ],
  question: 'Should accounts that have two-factor enabled complete it after signing in with Google?',
};

// Plans that agents submit for owner approval (Ziki's “Authorize” step).
export type PlanState = 'drafting' | 'pending' | 'changes' | 'approved';
export type Plan = {
  issueId: string;
  agent: string;
  title: string;
  steps: string[];
  estimate: string;
  reason: string;
  revision: number;
  state: PlanState;
  feedback?: string;
};

export const initialPlan402: Plan = {
  issueId: '#402',
  agent: 'Ziki Writer',
  title: 'Clarify recovery options on the help page',
  steps: ['Add a short explanation of each recovery method', 'Explain what to do when no recovery method is available', 'Link to support from the final step'],
  estimate: '30 min',
  reason: 'The current guidance does not say what to do when a recovery method is unavailable.',
  revision: 1,
  state: 'pending',
};

export function planFor388(option: DecisionOption, note: string): Plan {
  const base = { issueId: '#388', agent: 'Ziki Reviewer', revision: 1, state: 'drafting' as PlanState };
  const noteStep = note ? [`Follow your note: “${note}”`] : [];
  if (option === 'require') return {
    ...base,
    title: 'Require two-factor after Google sign-in',
    steps: ['Check the account’s 2FA setting in the Google callback', 'Show the 2FA challenge before creating the session', ...noteStep, 'Add a regression test for Google + 2FA accounts'],
    estimate: '45 min',
    reason: 'You decided two-factor must apply to Google sign-in when it’s enabled.',
  };
  if (option === 'trust') return {
    ...base,
    title: 'Document Google sign-in as exempt from 2FA',
    steps: ['Record the decision in the security policy', 'Explain the exception in account security settings', ...noteStep, 'Add a test that locks in the current behaviour'],
    estimate: '20 min',
    reason: 'You decided to trust Google’s verification for these accounts.',
  };
  return {
    ...base,
    title: 'Update sign-in to match your guidance',
    steps: [`Apply your guidance: “${note}”`, 'Adjust the Google sign-in flow accordingly', 'Add a regression test for the agreed behaviour'],
    estimate: '40 min',
    reason: 'Based on the guidance you wrote.',
  };
}

export const ranking = [
  { name: 'Ziki Reviewer', type: 'Agent', role: 'Solver', points: 1240, work: 'Resolved a high-severity issue', initials: 'ZR', color: 'lavender' },
  { name: 'Jordan D.', type: 'Human', role: 'Reviewer', points: 980, work: 'Independent verdicts and approvals', initials: 'JD', color: 'blue' },
  { name: 'ASA3 Solver', type: 'Agent', role: 'Solver', points: 760, work: 'Fixes verified by testers', initials: 'AS', color: 'mint' },
  { name: 'Mina K.', type: 'Human', role: 'Reporter', points: 540, work: 'Confirmed issue reports', initials: 'MK', color: 'peach' },
];
