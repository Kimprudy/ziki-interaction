import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import {
  type ActivityEntry, type Actor, type DecisionOption, type EventType, type Plan, type Priority, type Section, type Stage, type Tone,
  decisionOptions, escalationEvidence, initialActivity, initialPlan402, issueById, issues, newId, planFor388, ranking, stageHelp, stages,
} from './data';

type EscalationState = 'waiting' | 'paused' | 'takenOver' | 'resumed';
type Delivery = 'delivering' | 'testing';
type Decision = { option: DecisionOption; note: string };

type IssueStatus = { label: string; tone: Tone; stage: Stage; owner: string; next: string; inboxKey?: string };
type InboxItem = {
  key: string; issueId: string; kind: 'Agent question' | 'Plan approval'; priority: Priority;
  summary: string; group: 'needs' | 'agent' | 'done'; statusLabel: string;
};
type IssuesUi = { search: string; stage: string; status: string; category: string; selectedId: string };

const sections: { name: Section; icon: string }[] = [
  { name: 'Console', icon: '⌂' },
  { name: 'Inbox', icon: '▤' },
  { name: 'Issues', icon: '◉' },
  { name: 'Ranking', icon: '↗' },
  { name: 'Activity', icon: '◷' },
];

// Simulated agent timing (ms). Short enough to watch, long enough to notice.
const AGENT_STEP = 1400;

const sentence = (action: string) => action.charAt(0).toLowerCase() + action.slice(1);
const clock = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/* ------------------------------------------------------------------ */
/* Workspace state: one place where decisions change the whole app.    */
/* ------------------------------------------------------------------ */

function useWorkspace() {
  const [escalation, setEscalation] = useState<EscalationState>('waiting');
  const [decision, setDecision] = useState<Decision | null>(null);
  const [plans, setPlans] = useState<Record<string, Plan>>({ '#402': initialPlan402 });
  const [delivery, setDelivery] = useState<Record<string, Delivery>>({});
  const [activity, setActivity] = useState<ActivityEntry[]>(initialActivity);
  const timers = useRef<Record<string, number[]>>({});

  useEffect(() => () => Object.values(timers.current).flat().forEach(clearTimeout), []);

  const log = (actor: Actor, name: string, action: string, issueId: string, type: EventType) =>
    setActivity((current) => [{ id: newId(), actor, name, action, issueId, type, when: `${clock()} · this session` }, ...current]);

  const schedule = (issueId: string, ms: number, fn: () => void) => {
    const id = window.setTimeout(fn, ms);
    (timers.current[issueId] ??= []).push(id);
  };
  const cancel = (issueId: string) => {
    (timers.current[issueId] ?? []).forEach(clearTimeout);
    timers.current[issueId] = [];
  };
  const updatePlan = (issueId: string, patch: Partial<Plan>) =>
    setPlans((current) => (current[issueId] ? { ...current, [issueId]: { ...current[issueId], ...patch } } : current));

  function respond(next: Decision) {
    const plan = planFor388(next.option, next.note);
    const label = decisionOptions.find((option) => option.id === next.option)!.label;
    setDecision(next);
    setEscalation('resumed');
    setPlans((current) => ({ ...current, '#388': plan }));
    log('Human', 'Jordan D.', `Answered the escalation: “${next.option === 'other' ? next.note : label}”`, '#388', 'Handoff');
    schedule('#388', AGENT_STEP, () => log('Agent', 'Ziki Reviewer', 'Resumed with your decision and started drafting a plan', '#388', 'Agent work'));
    schedule('#388', AGENT_STEP * 2.2, () => {
      updatePlan('#388', { state: 'pending' });
      log('Agent', 'Ziki Reviewer', `Submitted a plan for approval: ${plan.title} (est. ${plan.estimate})`, '#388', 'Approval');
    });
  }

  function takeOver() {
    cancel('#388');
    setEscalation('takenOver');
    log('Human', 'Jordan D.', 'Took over the issue; the agent stopped working on it', '#388', 'Handoff');
    log('System', 'Ziki', 'Owner changed from Ziki Reviewer to Jordan D.', '#388', 'Status change');
  }

  function keepPaused() {
    setEscalation('paused');
    log('Human', 'Jordan D.', 'Kept the agent paused for now', '#388', 'Handoff');
  }

  function approvePlan(issueId: string) {
    const plan = plans[issueId];
    updatePlan(issueId, { state: 'approved' });
    setDelivery((current) => ({ ...current, [issueId]: 'delivering' }));
    log('Human', 'Jordan D.', `Approved the plan (revision ${plan.revision})`, issueId, 'Approval');
    log('System', 'Ziki', 'Plan authorized; moved to Deliver', issueId, 'Status change');
    schedule(issueId, AGENT_STEP * 1.6, () => {
      setDelivery((current) => ({ ...current, [issueId]: 'testing' }));
      log('Agent', plan.agent, 'Linked a pull request with the fix (simulated)', issueId, 'Agent work');
      log('System', 'Ziki', 'Moved to Prove: waiting for an independent tester', issueId, 'Status change');
    });
  }

  function requestChanges(issueId: string, feedback: string) {
    const plan = plans[issueId];
    updatePlan(issueId, { state: 'changes', feedback });
    log('Human', 'Jordan D.', `Requested changes: “${feedback}”`, issueId, 'Approval');
    schedule(issueId, AGENT_STEP, () => log('Agent', plan.agent, 'Picked up your feedback and is revising the plan', issueId, 'Agent work'));
    schedule(issueId, AGENT_STEP * 2.2, () => {
      setPlans((current) => {
        const p = current[issueId];
        if (!p || p.state !== 'changes') return current;
        const steps = [...p.steps.filter((step) => !step.startsWith('Address your feedback')), `Address your feedback: “${feedback}”`];
        return { ...current, [issueId]: { ...p, steps, revision: p.revision + 1, state: 'pending' } };
      });
      log('Agent', plan.agent, `Submitted revision ${plan.revision + 1} of the plan for approval`, issueId, 'Approval');
    });
  }

  function resetScenario(issueId: string) {
    cancel(issueId);
    setDelivery(({ [issueId]: _removed, ...rest }) => rest);
    if (issueId === '#388') {
      setEscalation('waiting');
      setDecision(null);
      setPlans(({ '#388': _removed, ...rest }) => rest);
    } else {
      setPlans((current) => ({ ...current, [issueId]: initialPlan402 }));
    }
    log('System', 'Ziki', 'Scenario reset in this browser session', issueId, 'Status change');
  }

  /* Derived status: every section reads from here, so they always agree. */
  function planStatus(issueId: string, owner: string): IssueStatus {
    const plan = plans[issueId];
    const inboxKey = `plan-${issueId}`;
    if (!plan || plan.state === 'drafting') return { label: 'Agent working', tone: 'agent', stage: 'Authorize', owner, next: 'Agent is drafting a plan from your decision' };
    if (plan.state === 'pending') return { label: 'Plan awaiting approval', tone: 'needs', stage: 'Authorize', owner, next: 'Approve the plan or request changes in Inbox', inboxKey };
    if (plan.state === 'changes') return { label: 'Agent revising', tone: 'agent', stage: 'Authorize', owner, next: 'Agent is revising the plan using your feedback' };
    if (delivery[issueId] === 'testing') return { label: 'In testing', tone: 'agent', stage: 'Prove', owner, next: 'An independent tester verifies the fix before merge' };
    return { label: 'In delivery', tone: 'agent', stage: 'Deliver', owner, next: 'Agent is writing the fix and will link a pull request' };
  }

  function statusOf(issueId: string): IssueStatus {
    if (issueId === '#388') {
      if (escalation === 'waiting') return { label: 'Needs your decision', tone: 'needs', stage: 'Authorize', owner: 'Ziki Reviewer', next: 'Answer the agent’s question in Inbox', inboxKey: 'esc-#388' };
      if (escalation === 'paused') return { label: 'Paused by you', tone: 'paused', stage: 'Authorize', owner: 'Ziki Reviewer', next: 'Agent stays paused until you answer in Inbox', inboxKey: 'esc-#388' };
      if (escalation === 'takenOver') return { label: 'Human-owned', tone: 'human', stage: 'Deliver', owner: 'Jordan D. (you)', next: 'You deliver the fix; the agent has stopped' };
      return planStatus('#388', 'Ziki Reviewer');
    }
    if (issueId === '#402') return planStatus('#402', 'Ziki Writer');
    if (issueId === '#400') return { label: 'In testing', tone: 'agent', stage: 'Prove', owner: 'ASA3 Solver', next: 'An independent tester verifies the fix before merge' };
    return { label: 'Awaiting confirmation', tone: 'open', stage: 'Report', owner: 'Unassigned', next: 'Two reviewers confirm the report before work starts' };
  }

  function planInboxItem(issueId: string, priority: Priority): InboxItem | null {
    const plan = plans[issueId];
    if (!plan) return null;
    const base = { key: `plan-${issueId}`, issueId, kind: 'Plan approval' as const, priority };
    if (plan.state === 'drafting') return { ...base, group: 'agent', statusLabel: 'Agent drafting', summary: `${plan.agent} is turning your decision into a plan.` };
    if (plan.state === 'pending') return { ...base, group: 'needs', statusLabel: plan.revision > 1 ? `Revision ${plan.revision} ready` : 'Approval needed', summary: `${plan.agent} proposes: ${plan.title}.` };
    if (plan.state === 'changes') return { ...base, group: 'agent', statusLabel: 'Agent revising', summary: `${plan.agent} is revising the plan using your feedback.` };
    return { ...base, group: 'done', statusLabel: delivery[issueId] === 'testing' ? 'Approved · in testing' : 'Approved · in delivery', summary: `You approved: ${plan.title}.` };
  }

  const escalationItem: InboxItem = {
    key: 'esc-#388', issueId: '#388', kind: 'Agent question', priority: 'High',
    group: escalation === 'waiting' || escalation === 'paused' ? 'needs' : 'done',
    statusLabel: escalation === 'waiting' ? 'Waiting for you' : escalation === 'paused' ? 'Kept paused' : escalation === 'takenOver' ? 'You took over' : 'Answered',
    summary: escalation === 'waiting' || escalation === 'paused' ? 'Ziki Reviewer paused and needs a security policy decision.' : escalation === 'takenOver' ? 'You took responsibility for this issue.' : 'Your decision was sent to the agent.',
  };
  const priorityRank: Record<Priority, number> = { High: 0, Medium: 1, Low: 2 };
  const inbox = [escalationItem, planInboxItem('#388', 'High'), planInboxItem('#402', 'Medium')]
    .filter((item): item is InboxItem => item !== null)
    .sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]);

  return {
    escalation, decision, plans, activity, inbox, statusOf,
    pendingCount: inbox.filter((item) => item.group === 'needs').length,
    actions: { respond, takeOver, keepPaused, approvePlan, requestChanges, resetScenario },
  };
}

type Workspace = ReturnType<typeof useWorkspace>;

/* ------------------------------------------------------------------ */
/* App shell                                                           */
/* ------------------------------------------------------------------ */

function App() {
  const ws = useWorkspace();
  const [section, setSection] = useState<Section>('Console');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [inboxKey, setInboxKey] = useState('esc-#388');
  const [issuesUi, setIssuesUi] = useState<IssuesUi>({ search: '', stage: 'All stages', status: 'All statuses', category: 'All categories', selectedId: '#388' });

  function navigate(next: Section) {
    setSection(next);
    setMobileNavOpen(false);
    window.scrollTo({ top: 0 });
  }
  const openInbox = (key: string) => { setInboxKey(key); navigate('Inbox'); };
  const openIssue = (id: string) => { setIssuesUi((ui) => ({ ...ui, selectedId: id, search: '', stage: 'All stages', status: 'All statuses', category: 'All categories' })); navigate('Issues'); };
  const openStage = (stage: Stage) => { setIssuesUi((ui) => ({ ...ui, stage, search: '', status: 'All statuses', category: 'All categories' })); navigate('Issues'); };

  return (
    <div className="app-frame">
      {mobileNavOpen && <button className="nav-scrim" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}
      <aside className={`sidebar ${mobileNavOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-brand">
          <span className="brand-symbol" aria-hidden="true">z</span>
          <span className="brand-word">ziki</span>
          <span className="demo-tag">PROTOTYPE</span>
        </div>
        <div className="workspace-switcher">
          <span className="workspace-avatar">N</span>
          <span className="workspace-copy"><strong>Northstar Studio</strong><small>Sample workspace</small></span>
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          {sections.map((item) => (
            <button key={item.name} className={`nav-item ${section === item.name ? 'active' : ''}`} onClick={() => navigate(item.name)} aria-current={section === item.name ? 'page' : undefined}>
              <span className="nav-icon" aria-hidden="true">{item.icon}</span>
              <span>{item.name}</span>
              {item.name === 'Inbox' && ws.pendingCount > 0 && <span className="nav-count" aria-label={`${ws.pendingCount} pending`}>{ws.pendingCount}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="human-control">
            <span className="control-icon" aria-hidden="true">✓</span>
            <div><strong>Human in control</strong><small>Agents wait for your approval</small></div>
          </div>
          <div className="sidebar-profile">
            <span className="profile-avatar">JD</span>
            <span><strong>Jordan D.</strong><small>Workspace owner</small></span>
          </div>
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <button className="mobile-menu" aria-label="Open navigation" onClick={() => setMobileNavOpen(true)}>☰</button>
          <div className="topbar-breadcrumb"><span>Northstar Studio</span><span className="crumb-slash">/</span><strong>{section}</strong></div>
          <div className="topbar-right"><span className="top-avatar">JD</span></div>
        </header>
        <div className="prototype-banner" role="note">
          <strong>Prototype</strong> Sample workspace. Agent behaviour is simulated in your browser, nothing is sent to Ziki, and changes reset when you reload.
        </div>

        <main className="page-content" key={section}>
          {section === 'Console' && <ConsoleView ws={ws} onNavigate={navigate} onOpenInbox={openInbox} onOpenStage={openStage} />}
          {section === 'Inbox' && <InboxView ws={ws} selectedKey={inboxKey} onSelect={setInboxKey} onOpenIssue={openIssue} />}
          {section === 'Issues' && <IssuesView ws={ws} ui={issuesUi} setUi={setIssuesUi} onOpenInbox={openInbox} />}
          {section === 'Ranking' && <RankingView />}
          {section === 'Activity' && <ActivityView activity={ws.activity} onOpenIssue={openIssue} />}
        </main>
        <footer className="global-footer"><span>Ziki human-agent interaction prototype</span><span>No production connection</span></footer>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shared pieces                                                       */
/* ------------------------------------------------------------------ */

function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="page-header">
      <div>
        <div className="page-eyebrow">{eyebrow}</div>
        <div className="page-title-row"><h1>{title}</h1>{action}</div>
        <p>{description}</p>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: Pick<IssueStatus, 'label' | 'tone'> }) {
  return <span className={`table-status tone-${status.tone}`}>{status.label}</span>;
}

function Lifecycle({ current, compact = false }: { current: Stage; compact?: boolean }) {
  const currentIndex = stages.indexOf(current);
  return (
    <ol className={`lifecycle ${compact ? 'lifecycle-compact' : ''}`} aria-label={`Lifecycle: currently ${current}`}>
      {stages.map((stage, index) => {
        const state = index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'todo';
        return (
          <li key={stage} className={`lifecycle-step ${state}`} aria-current={state === 'current' ? 'step' : undefined}>
            <span className="lifecycle-dot" aria-hidden="true">{state === 'done' ? '✓' : index + 1}</span>
            <span className="lifecycle-copy"><strong>{stage}</strong>{!compact && <small>{stageHelp[stage]}</small>}</span>
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------------------------ */
/* Console: overview only                                              */
/* ------------------------------------------------------------------ */

function ConsoleView({ ws, onNavigate, onOpenInbox, onOpenStage }: {
  ws: Workspace; onNavigate: (section: Section) => void; onOpenInbox: (key: string) => void; onOpenStage: (stage: Stage) => void;
}) {
  const statuses = issues.map((issue) => ({ issue, status: ws.statusOf(issue.id) }));
  const agentRows = [
    { name: 'Ziki Reviewer', issueId: '#388', avatar: 'ZR' },
    { name: 'Ziki Writer', issueId: '#402', avatar: 'ZW' },
    { name: 'ASA3 Solver', issueId: '#400', avatar: 'AS' },
  ];
  const working = statuses.filter(({ status }) => status.tone === 'agent').length;
  const pending = ws.inbox.filter((item) => item.group === 'needs');
  const topPoints = ranking[0];

  return <>
    <PageHeader eyebrow="WORKSPACE OVERVIEW" title="Console" description="See what needs you, what your agents are doing, and where each issue sits in the Ziki lifecycle." />
    <div className="metric-grid">
      <MetricCard label="Needs your decision" value={String(ws.pendingCount)} note={ws.pendingCount ? 'Open Inbox to decide' : 'All caught up'} icon="!" tone="amber" onClick={() => onNavigate('Inbox')} />
      <MetricCard label="Agents working" value={String(working)} note="Drafting, delivering or testing" icon="✳" tone="blue" onClick={() => onNavigate('Activity')} />
      <MetricCard label="Open issues" value={String(issues.length)} note="Across all lifecycle stages" icon="◉" tone="indigo" onClick={() => onNavigate('Issues')} />
      <MetricCard label="Top contributor" value={topPoints.points.toLocaleString()} note={`${topPoints.name} · sample points`} icon="↗" tone="green" onClick={() => onNavigate('Ranking')} />
    </div>

    <div className="console-grid">
      <section className="surface console-panel" aria-labelledby="attention-heading">
        <div className="panel-heading"><div><span className="panel-kicker">NEEDS YOU</span><h2 id="attention-heading">Waiting on a human</h2></div></div>
        {pending.length === 0 ? (
          <div className="empty-state"><strong>All caught up</strong><span>Agents will ask in Inbox when they need a decision.</span></div>
        ) : pending.map((item) => (
          <button key={item.key} className="attention-item" onClick={() => onOpenInbox(item.key)}>
            <span className={`attention-icon ${item.kind === 'Agent question' ? 'urgent' : 'approval'}`} aria-hidden="true">{item.kind === 'Agent question' ? 'Ⅱ' : '✓'}</span>
            <span className="attention-copy"><strong>{item.kind} · {item.issueId}</strong><small>{item.summary}</small></span>
            <span className="attention-cta">Review →</span>
          </button>
        ))}
      </section>

      <section className="surface console-panel" aria-labelledby="agents-heading">
        <div className="panel-heading"><div><span className="panel-kicker">AGENTS</span><h2 id="agents-heading">What agents are doing</h2></div></div>
        {agentRows.map((agent) => {
          const status = ws.statusOf(agent.issueId);
          return (
            <div className="agent-summary" key={agent.name}>
              <span className="agent-avatar">{agent.avatar}</span>
              <span className="agent-info"><strong>{agent.name}</strong><small>{agent.issueId} · {issueById(agent.issueId).shortTitle}</small></span>
              <StatusPill status={status.owner.startsWith('Jordan') ? { label: 'Stopped · you took over', tone: 'human' } : status} />
            </div>
          );
        })}
      </section>
    </div>

    <section className="surface stage-strip" aria-labelledby="stage-heading">
      <div className="panel-heading"><div><span className="panel-kicker">LIFECYCLE</span><h2 id="stage-heading">Issues by stage</h2></div></div>
      <div className="stage-grid">
        {stages.map((stage) => {
          const count = statuses.filter(({ status }) => status.stage === stage).length;
          return (
            <button key={stage} className={`stage-cell ${count ? '' : 'stage-empty'}`} onClick={() => onOpenStage(stage)} disabled={!count} title={stageHelp[stage]}>
              <strong>{count}</strong><span>{stage}</span>
            </button>
          );
        })}
      </div>
    </section>
  </>;
}

function MetricCard({ label, value, note, icon, tone, onClick }: { label: string; value: string; note: string; icon: string; tone: string; onClick: () => void }) {
  return (
    <button className="metric-card surface" onClick={onClick}>
      <span className={`metric-icon ${tone}`} aria-hidden="true">{icon}</span>
      <span className="metric-label">{label}</span>
      <strong className="metric-value">{value}</strong>
      <span className="metric-note">{note}</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Inbox: human review                                                 */
/* ------------------------------------------------------------------ */

function InboxView({ ws, selectedKey, onSelect, onOpenIssue }: { ws: Workspace; selectedKey: string; onSelect: (key: string) => void; onOpenIssue: (id: string) => void }) {
  const selected = ws.inbox.find((item) => item.key === selectedKey) ?? ws.inbox[0];
  const groups: { id: InboxItem['group']; title: string; empty?: string }[] = [
    { id: 'needs', title: 'Needs your decision', empty: 'All caught up. Agents will ask here when they need you.' },
    { id: 'agent', title: 'With agents' },
    { id: 'done', title: 'Handled' },
  ];

  return <>
    <PageHeader
      eyebrow="HUMAN REVIEW QUEUE"
      title="Inbox"
      description="Agents pause here when they need a decision or your approval. Your choice is sent back to the agent and the outcome shows across the workspace."
      action={<span className="inbox-total"><b>{ws.pendingCount}</b> {ws.pendingCount === 1 ? 'item needs' : 'items need'} you</span>}
    />
    <div className="inbox-layout">
      <section className="surface inbox-list-panel" aria-label="Review queue">
        {groups.map((group) => {
          const items = ws.inbox.filter((item) => item.group === group.id);
          if (!items.length && !group.empty) return null;
          return (
            <div className="inbox-group" key={group.id}>
              <div className="list-toolbar"><span className="list-heading">{group.title} <span className="count-badge">{items.length}</span></span></div>
              {items.length === 0 && <p className="inbox-empty">{group.empty}</p>}
              {items.map((item) => (
                <button key={item.key} className={`inbox-item ${selected.key === item.key ? 'selected' : ''}`} onClick={() => onSelect(item.key)} aria-pressed={selected.key === item.key}>
                  <span className={`inbox-priority-dot ${item.group === 'done' ? 'done' : item.group === 'agent' ? 'agent' : item.priority.toLowerCase()}`} aria-hidden="true" />
                  <span className="inbox-item-copy">
                    <span className="inbox-item-top"><b>{item.kind}</b><span className={`priority-text ${item.priority.toLowerCase()}-text`}>{item.priority.toUpperCase()}</span></span>
                    <strong>{item.issueId} · {issueById(item.issueId).shortTitle}</strong>
                    <small>{item.summary}</small>
                    <span className="inbox-item-foot">{item.statusLabel}<i />{issueById(item.issueId).category}</span>
                  </span>
                </button>
              ))}
            </div>
          );
        })}
      </section>
      <section className="surface inbox-detail-panel" aria-live="polite">
        {selected.kind === 'Agent question'
          ? <EscalationPanel ws={ws} onOpenPlan={() => onSelect('plan-#388')} onOpenIssue={onOpenIssue} />
          : <PlanPanel key={selected.key} ws={ws} issueId={selected.issueId} onOpenIssue={onOpenIssue} />}
      </section>
    </div>
  </>;
}

const escalationBanner: Record<EscalationState, { title: string; body: string; badge: string; symbol: string }> = {
  waiting: { title: 'Agent paused · waiting for your decision', body: 'Ziki Reviewer stopped before choosing a security rule. It will not continue until you decide.', badge: 'PAUSED', symbol: 'Ⅱ' },
  paused: { title: 'Kept paused', body: 'The agent stays paused and this stays in your queue. Answer or take over whenever you’re ready.', badge: 'PAUSED', symbol: 'Ⅱ' },
  resumed: { title: 'Agent resumed with your decision', body: 'Ziki Reviewer is acting on your answer. Follow its progress below (simulated).', badge: 'RESUMED', symbol: '↻' },
  takenOver: { title: 'You own this issue', body: 'The agent stopped working on #388. You are responsible for the next step.', badge: 'HUMAN-OWNED', symbol: '✓' },
};

function IssueHeading({ issueId, ownerLabel, owner, status }: { issueId: string; ownerLabel: string; owner: string; status: IssueStatus }) {
  const issue = issueById(issueId);
  const initials = owner.startsWith('Jordan') ? 'JD' : owner.split(' ').map((part) => part[0]).join('').slice(0, 2);
  return (
    <div className="detail-issue-heading">
      <div className="issue-label-row">
        <span className="issue-number">ISSUE {issueId}</span>
        <span className={`priority-chip ${issue.priority.toLowerCase()}-chip`}>● {issue.priority}</span>
        <StatusPill status={status} />
      </div>
      <h2>{issue.title}</h2>
      <div className="assignment-row">
        <span className="assigned-avatar">{initials}</span>
        <span>{ownerLabel} <strong>{owner}</strong></span>
        <span className="category-tag">{issue.category}</span>
      </div>
      <Lifecycle current={status.stage} compact />
    </div>
  );
}

function EscalationPanel({ ws, onOpenPlan, onOpenIssue }: { ws: Workspace; onOpenPlan: () => void; onOpenIssue: (id: string) => void }) {
  const { escalation, decision } = ws;
  const status = ws.statusOf('#388');
  const banner = escalationBanner[escalation];
  const open = escalation === 'waiting' || escalation === 'paused';

  return <>
    <div className={`escalation-status ${escalation}`} role="status">
      <span className="status-symbol" aria-hidden="true">{banner.symbol}</span>
      <span><strong>{banner.title}</strong><small>{banner.body}</small></span>
      <b className="status-badge">{banner.badge}</b>
    </div>
    <IssueHeading issueId="#388" ownerLabel="Assigned to" owner={status.owner} status={status} />

    <div className="task-box">
      <div className="task-icon-small" aria-hidden="true">⌘</div>
      <div><small className="field-label">WHAT THE AGENT WAS DOING</small><strong>{escalationEvidence.task.title}</strong><p>{escalationEvidence.task.body}</p></div>
    </div>
    <div className="escalation-details">
      <div className="detail-column">
        <h3><span className="detail-check" aria-hidden="true">✓</span> Steps attempted</h3>
        <ul>{escalationEvidence.attempted.map((step) => <li key={step}>{step}</li>)}</ul>
      </div>
      <div className="detail-column blocker-column">
        <h3><span className="detail-alert" aria-hidden="true">!</span> Why it needs you</h3>
        <p>{escalationEvidence.blocker}</p>
      </div>
    </div>
    <dl className="evidence-grid" aria-label="Evidence the agent collected">
      {escalationEvidence.findings.map((finding) => <div key={finding.label}><dt>{finding.label}</dt><dd>{finding.value}</dd></div>)}
    </dl>
    <div className="decision-question"><small>DECISION NEEDED</small><p>{escalationEvidence.question}</p></div>

    {open && <DecisionForm onRespond={ws.actions.respond} onTakeOver={ws.actions.takeOver} onKeepPaused={ws.actions.keepPaused} paused={escalation === 'paused'} />}

    {escalation === 'resumed' && decision && <>
      <div className="response-receipt">
        <strong>Your decision</strong>
        <p>{decision.option === 'other' ? `“${decision.note}”` : decisionOptions.find((option) => option.id === decision.option)!.label}{decision.option !== 'other' && decision.note && <><br /><span className="receipt-note">Note: “{decision.note}”</span></>}</p>
      </div>
      <AgentProgress
        title="What happens next"
        steps={[
          { label: 'Decision sent to Ziki Reviewer', done: true },
          { label: 'Agent drafts a plan from your decision', done: ws.plans['#388']?.state !== 'drafting', active: ws.plans['#388']?.state === 'drafting' },
          { label: 'Plan comes back to you for approval', done: ws.plans['#388']?.state === 'approved', active: ws.plans['#388']?.state === 'pending' || ws.plans['#388']?.state === 'changes' },
        ]}
      />
      <div className="completed-actions">
        {ws.plans['#388'] && ws.plans['#388'].state !== 'drafting'
          ? <button className="button button-primary" onClick={onOpenPlan}>{ws.plans['#388'].state === 'pending' ? 'Review the agent’s plan →' : 'View the plan →'}</button>
          : <span className="completion-note">The agent’s plan will appear in your Inbox.</span>}
        <button className="button button-quiet" onClick={() => ws.actions.resetScenario('#388')}>Reset scenario</button>
      </div>
    </>}

    {escalation === 'takenOver' && <>
      <AgentProgress title="What changed" steps={[
        { label: 'Ziki Reviewer stopped working on #388', done: true },
        { label: 'Owner changed to Jordan D. (you)', done: true },
        { label: 'Next: you deliver the fix and link a pull request' },
      ]} />
      <div className="completed-actions">
        <button className="button button-outline" onClick={() => onOpenIssue('#388')}>Open in Issues</button>
        <button className="button button-quiet" onClick={() => ws.actions.resetScenario('#388')}>Reset scenario</button>
      </div>
    </>}
  </>;
}

function DecisionForm({ onRespond, onTakeOver, onKeepPaused, paused }: {
  onRespond: (decision: Decision) => void; onTakeOver: () => void; onKeepPaused: () => void; paused: boolean;
}) {
  const [option, setOption] = useState<DecisionOption | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = note.trim();
    if (!option) return setError('Choose one of the options above before resuming the agent.');
    if (option === 'other' && !trimmed) return setError('Write the guidance the agent should follow.');
    setError('');
    onRespond({ option, note: trimmed });
  }

  return (
    <form className="escalation-form" onSubmit={submit} noValidate>
      <fieldset className="decision-options">
        <legend>Your decision</legend>
        {decisionOptions.map((choice) => (
          <label key={choice.id} className={`decision-option ${option === choice.id ? 'chosen' : ''}`}>
            <input type="radio" name="decision" value={choice.id} checked={option === choice.id} onChange={() => { setOption(choice.id); setError(''); }} />
            <span>
              <strong>{choice.label}{choice.recommended && <em className="recommended-tag">Agent recommends</em>}</strong>
              <small>If you choose this: {choice.consequence}</small>
            </span>
          </label>
        ))}
      </fieldset>
      <label htmlFor="human-response">{option === 'other' ? 'Guidance for the agent (required)' : 'Add a note for the agent (optional)'}</label>
      <textarea id="human-response" value={note} onChange={(event) => { setNote(event.target.value); if (error) setError(''); }} placeholder="Explain what behaviour you expect…" rows={3} aria-describedby={error ? 'response-error' : undefined} aria-invalid={Boolean(error)} />
      {error && <p id="response-error" className="form-hint error-text" role="alert">{error}</p>}
      <div className="escalation-actions">
        <button className="button button-primary" type="submit">Send decision &amp; resume agent <span aria-hidden="true">→</span></button>
        <button className="button button-outline" type="button" onClick={onTakeOver}>Take over</button>
        {!paused && <button className="button button-quiet" type="button" onClick={onKeepPaused}>Keep paused</button>}
      </div>
      <ul className="action-consequences">
        <li><b>Send &amp; resume:</b> the agent continues and returns a plan for your approval.</li>
        <li><b>Take over:</b> you become the owner and the agent stops working on this issue.</li>
        {!paused && <li><b>Keep paused:</b> nothing changes; it stays in your queue.</li>}
      </ul>
    </form>
  );
}

function AgentProgress({ title, steps }: { title: string; steps: { label: string; done?: boolean; active?: boolean }[] }) {
  return (
    <div className="agent-progress">
      <small className="field-label">{title.toUpperCase()}</small>
      <ol>
        {steps.map((step) => (
          <li key={step.label} className={step.done ? 'done' : step.active ? 'active' : ''}>
            <span className="progress-dot" aria-hidden="true">{step.done ? '✓' : ''}</span>
            {step.label}
            {step.active && !step.done && <span className="visually-hidden"> (in progress)</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}

function PlanPanel({ ws, issueId, onOpenIssue }: { ws: Workspace; issueId: string; onOpenIssue: (id: string) => void }) {
  const plan = ws.plans[issueId];
  const status = ws.statusOf(issueId);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  if (!plan) return null;

  const banner = {
    drafting: { cls: 'changes', symbol: '…', title: 'Agent is drafting a plan', body: `${plan.agent} is turning your decision into a plan. It will ask for your approval next.` },
    pending: { cls: 'pending', symbol: '◷', title: plan.revision > 1 ? `Revision ${plan.revision} needs your approval` : 'Plan needs your approval', body: 'Nothing is delivered until you approve. You can also send it back with changes.' },
    changes: { cls: 'changes', symbol: '↺', title: 'Changes requested · agent revising', body: `${plan.agent} is updating the plan and will ask you again.` },
    approved: { cls: 'approved', symbol: '✓', title: 'Approved · agent is delivering', body: 'The issue moved to Deliver. Progress is recorded in Activity.' },
  }[plan.state];

  function sendFeedback(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!feedback.trim()) return setError('Tell the agent what to change.');
    ws.actions.requestChanges(issueId, feedback.trim());
    setFeedback(''); setFeedbackOpen(false); setError('');
  }

  return <>
    <div className={`approval-state ${banner.cls}`} role="status">
      <span aria-hidden="true">{banner.symbol}</span>
      <div><strong>{banner.title}</strong><small>{banner.body}</small></div>
    </div>
    <IssueHeading issueId={issueId} ownerLabel="Plan by" owner={plan.agent} status={status} />
    <div className="proposal-card">
      <div className="proposal-top"><small className="field-label">PROPOSED PLAN · REVISION {plan.revision}</small><span className="estimate-chip">Est. {plan.estimate}</span></div>
      <h3>{plan.title}</h3>
      <ol className="plan-steps">{plan.steps.map((step) => <li key={step}>{step}</li>)}</ol>
      <div className="proposal-reason"><strong>Why this plan</strong><span>{plan.reason}</span></div>
      {plan.feedback && plan.revision > 1 && <div className="proposal-reason"><strong>Your earlier feedback</strong><span>“{plan.feedback}” — addressed in this revision.</span></div>}
    </div>

    {plan.state === 'pending' && !feedbackOpen && <>
      <div className="approval-actions">
        <button className="button button-primary" onClick={() => ws.actions.approvePlan(issueId)}>Approve plan</button>
        <button className="button button-outline" onClick={() => setFeedbackOpen(true)}>Request changes</button>
      </div>
      <ul className="action-consequences">
        <li><b>Approve:</b> the agent starts delivering and links a pull request for testing.</li>
        <li><b>Request changes:</b> the agent revises the plan and asks you again.</li>
      </ul>
    </>}

    {plan.state === 'pending' && feedbackOpen && (
      <form className="escalation-form" onSubmit={sendFeedback} noValidate>
        <label htmlFor="plan-feedback">What should the agent change?</label>
        <textarea id="plan-feedback" autoFocus value={feedback} onChange={(event) => { setFeedback(event.target.value); if (error) setError(''); }} rows={3} placeholder="For example: also cover accounts that use passkeys" aria-invalid={Boolean(error)} aria-describedby={error ? 'feedback-error' : undefined} />
        {error && <p id="feedback-error" className="form-hint error-text" role="alert">{error}</p>}
        <div className="approval-actions">
          <button className="button button-primary" type="submit">Send feedback to agent</button>
          <button className="button button-quiet" type="button" onClick={() => { setFeedbackOpen(false); setError(''); }}>Cancel</button>
        </div>
      </form>
    )}

    {plan.state === 'approved' && (
      <AgentProgress title="Delivery progress" steps={[
        { label: 'Plan approved by you', done: true },
        { label: `${plan.agent} writes the fix and links a pull request`, done: status.stage === 'Prove', active: status.stage === 'Deliver' },
        { label: 'Independent tester verifies the fix', active: status.stage === 'Prove' },
      ]} />
    )}

    {plan.state !== 'pending' && (
      <div className="completed-actions">
        <button className="button button-outline" onClick={() => onOpenIssue(issueId)}>Open in Issues</button>
        <button className="button button-quiet" onClick={() => ws.actions.resetScenario(issueId)}>Reset scenario</button>
      </div>
    )}
  </>;
}

/* ------------------------------------------------------------------ */
/* Issues: tracking                                                    */
/* ------------------------------------------------------------------ */

function IssuesView({ ws, ui, setUi, onOpenInbox }: { ws: Workspace; ui: IssuesUi; setUi: React.Dispatch<React.SetStateAction<IssuesUi>>; onOpenInbox: (key: string) => void }) {
  const set = (patch: Partial<IssuesUi>) => setUi((current) => ({ ...current, ...patch }));
  const rows = issues.map((issue) => ({ issue, status: ws.statusOf(issue.id) }));
  const statusOptions = ['All statuses', ...Array.from(new Set(rows.map((row) => row.status.label)))];
  const categories = ['All categories', ...issues.map((issue) => issue.category)];
  const statusFilter = statusOptions.includes(ui.status) ? ui.status : 'All statuses';
  const query = ui.search.trim().toLowerCase();
  const filtered = rows.filter(({ issue, status }) =>
    (ui.stage === 'All stages' || status.stage === ui.stage)
    && (statusFilter === 'All statuses' || status.label === statusFilter)
    && (ui.category === 'All categories' || issue.category === ui.category)
    && (!query || `${issue.id} ${issue.title} ${issue.category} ${status.owner}`.toLowerCase().includes(query)));
  const selected = rows.find((row) => row.issue.id === ui.selectedId) ?? rows[0];
  const log = ws.activity.filter((entry) => entry.issueId === selected.issue.id);

  return <>
    <PageHeader eyebrow="ISSUE TRACKING" title="Issues" description="Track every issue through Ziki’s lifecycle: who owns it, which stage it is in, and what happens next." />
    <div className="issue-controls">
      <label className="issue-search-label">Search issues<input value={ui.search} onChange={(event) => set({ search: event.target.value })} placeholder="Search title, ID, owner…" /></label>
      <label>Stage<select value={ui.stage} onChange={(event) => set({ stage: event.target.value })}>{['All stages', ...stages].map((stage) => <option key={stage}>{stage}</option>)}</select></label>
      <label>Status<select value={statusFilter} onChange={(event) => set({ status: event.target.value })}>{statusOptions.map((status) => <option key={status}>{status}</option>)}</select></label>
      <label>Category<select value={ui.category} onChange={(event) => set({ category: event.target.value })}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
      <span className="table-caption" aria-live="polite">{filtered.length} of {issues.length} issues</span>
    </div>

    <section className="surface issue-table-wrap">
      <table className="issue-table">
        <thead><tr><th>ISSUE</th><th>STAGE</th><th>STATUS</th><th>PRIORITY</th><th>OWNER</th></tr></thead>
        <tbody>
          {filtered.map(({ issue, status }) => (
            <tr key={issue.id} className={selected.issue.id === issue.id ? 'selected-issue-row' : ''}>
              <td>
                <button className="issue-select-button" onClick={() => set({ selectedId: issue.id })} aria-pressed={selected.issue.id === issue.id}>
                  <span className="issue-cell"><span className="issue-cell-id">{issue.id}</span><strong>{issue.title}</strong><small>{issue.category}</small></span>
                </button>
              </td>
              <td><span className="stage-label">{status.stage}</span></td>
              <td><StatusPill status={status} /></td>
              <td><span className={`priority-cell ${issue.priority.toLowerCase()}`}><i />{issue.priority}</span></td>
              <td><span className="table-agent"><span className="mini-agent-avatar">{status.owner.startsWith('Jordan') ? 'JD' : status.owner === 'Unassigned' ? '—' : status.owner.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span>{status.owner}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
      {filtered.length === 0 && (
        <div className="issues-empty">
          <strong>No matching issues</strong>
          <span>Try another stage, status, category or search term.</span>
          <button className="button button-outline" onClick={() => set({ search: '', stage: 'All stages', status: 'All statuses', category: 'All categories' })}>Clear filters</button>
        </div>
      )}
    </section>

    <section className="surface issue-inspector" aria-labelledby="inspector-heading">
      <div className="issue-inspector-heading">
        <div><span className="panel-kicker">ISSUE DETAILS · {selected.issue.id}</span><h2 id="inspector-heading">{selected.issue.title}</h2></div>
        <StatusPill status={selected.status} />
      </div>
      <Lifecycle current={selected.status.stage} />
      <div className="issue-detail-grid">
        <div><small>Priority</small><strong>{selected.issue.priority}</strong></div>
        <div><small>Category</small><strong>{selected.issue.category}</strong></div>
        <div><small>Owner</small><strong>{selected.status.owner}</strong></div>
        <div className={selected.status.inboxKey ? 'next-step-needs' : ''}><small>Next step</small><strong>{selected.status.next}</strong></div>
      </div>
      {selected.status.inboxKey && <button className="button button-primary inspector-cta" onClick={() => onOpenInbox(selected.status.inboxKey!)}>Open in Inbox →</button>}
      <div className="issue-history">
        <div className="issue-history-heading"><div><span className="panel-kicker">WORK LOG</span><h3>Everything that happened on {selected.issue.id}</h3></div></div>
        {log.length === 0 ? <p className="empty-activity">No events yet.</p> : (
          <ol className="issue-history-list">
            {log.map((entry) => (
              <li className="issue-history-step" key={entry.id}>
                <span className={`issue-history-dot ${entry.actor.toLowerCase()}`} aria-hidden="true" />
                <div><strong><span className="history-actor">{entry.name}</span> {sentence(entry.action)}</strong><small>{entry.actor} · {entry.when}</small></div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  </>;
}

/* ------------------------------------------------------------------ */
/* Ranking: contribution points                                         */
/* ------------------------------------------------------------------ */

function RankingView() {
  const top = ranking[0].points;
  const humanPoints = ranking.filter((person) => person.type === 'Human').reduce((sum, person) => sum + person.points, 0);
  const agentPoints = ranking.filter((person) => person.type === 'Agent').reduce((sum, person) => sum + person.points, 0);
  return <>
    <PageHeader eyebrow="CONTRIBUTIONS" title="Ranking" description="Ziki awards points only for validated work: confirmed reports, independent review verdicts, and fixes that pass testing. These figures are sample data." />
    <div className="ranking-summary">
      <div className="surface rank-highlight"><span className="rank-cup" aria-hidden="true">✳</span><div><small>AGENT CONTRIBUTIONS</small><strong>{agentPoints.toLocaleString()} points</strong><span>Validated fixes by sample agents</span></div></div>
      <div className="surface rank-highlight"><span className="rank-cup human-cup" aria-hidden="true">✦</span><div><small>HUMAN CONTRIBUTIONS</small><strong>{humanPoints.toLocaleString()} points</strong><span>Reports and review verdicts</span></div></div>
    </div>
    <section className="surface ranking-table" aria-labelledby="board-heading">
      <div className="panel-heading"><div><span className="panel-kicker">NORTHSTAR STUDIO · SAMPLE PERIOD</span><h2 id="board-heading">Contribution board</h2></div></div>
      {ranking.map((person, index) => {
        const percent = Math.round((person.points / top) * 100);
        return (
          <div className="ranking-row" key={person.name}>
            <span className="ranking-place">{String(index + 1).padStart(2, '0')}</span>
            <span className={`ranking-avatar ${person.color}`}>{person.initials}</span>
            <span className="ranking-person">
              <strong>{person.name} <span className={`actor-tag ${person.type.toLowerCase()}`}>{person.type}</span></strong>
              <small>{person.role} · {person.work}</small>
              <span className="ranking-progress" role="img" aria-label={`${percent}% of the top score`}><span style={{ width: `${percent}%` }} /></span>
            </span>
            <span className="ranking-points"><b>{person.points.toLocaleString()}</b><small>points</small></span>
          </div>
        );
      })}
      <div className="ranking-footnote">Sample figures. Real Ziki points are recorded in an append-only ledger and vary by project rules.</div>
    </section>
  </>;
}

/* ------------------------------------------------------------------ */
/* Activity: attributed timeline                                       */
/* ------------------------------------------------------------------ */

const eventTypes: EventType[] = ['Handoff', 'Approval', 'Agent work', 'Status change', 'Issue work'];

function ActivityView({ activity, onOpenIssue }: { activity: ActivityEntry[]; onOpenIssue: (id: string) => void }) {
  const [actor, setActor] = useState('All actors');
  const [type, setType] = useState('All events');
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const filtered = activity.filter((item) =>
    (actor === 'All actors' || item.actor === actor)
    && (type === 'All events' || item.type === type)
    && (!q || `${item.name} ${item.action} ${item.issueId} ${issueById(item.issueId).shortTitle}`.toLowerCase().includes(q)));
  const sessionCount = activity.filter((item) => !item.sample).length;

  return <>
    <PageHeader eyebrow="ATTRIBUTED AUDIT TRAIL" title="Activity" description="Every action by a person, an agent or Ziki itself, newest first. Watch agents respond to your decisions here." action={<span className="activity-counter"><span aria-hidden="true" /> {sessionCount} this session</span>} />
    <section className="surface activity-feed activity-feed-full">
      <div className="activity-filters">
        <label>Search timeline<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search actor, action or issue…" /></label>
        <label>Actor<select value={actor} onChange={(event) => setActor(event.target.value)}>{['All actors', 'Human', 'Agent', 'System'].map((option) => <option key={option}>{option}</option>)}</select></label>
        <label>Event type<select value={type} onChange={(event) => setType(event.target.value)}>{['All events', ...eventTypes].map((option) => <option key={option}>{option}</option>)}</select></label>
        <span className="table-caption" aria-live="polite">{filtered.length} events</span>
      </div>
      {filtered.length === 0 ? (
        <div className="issues-empty"><strong>No matching events</strong><span>Try another actor, event type or search term.</span><button className="button button-outline" onClick={() => { setActor('All actors'); setType('All events'); setQuery(''); }}>Clear filters</button></div>
      ) : (
        <div className="activity-list">
          {filtered.map((item) => (
            <article className={`activity-entry ${item.sample ? '' : 'session-entry'}`} key={item.id}>
              <span className={`activity-actor-icon ${item.actor.toLowerCase()}`} aria-hidden="true">{item.actor === 'Agent' ? '✳' : item.actor === 'System' ? 'z' : item.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span>
              <span className="activity-entry-copy">
                <span className="activity-action"><strong>{item.name}</strong> {sentence(item.action)}</span>
                <button className="activity-issue-link" onClick={() => onOpenIssue(item.issueId)}>{item.issueId} · {issueById(item.issueId).shortTitle}</button>
              </span>
              <span className="activity-meta"><span className={`actor-tag ${item.actor.toLowerCase()}`}>{item.actor}</span><span className="event-type">{item.type}</span></span>
              <time>{item.when}</time>
            </article>
          ))}
        </div>
      )}
    </section>
  </>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
