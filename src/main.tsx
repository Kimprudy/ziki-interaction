import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

type Section = 'Console' | 'Inbox' | 'Issues' | 'Ranking' | 'Activity';
type AgentState = 'waiting' | 'resumed' | 'takenOver' | 'paused';
type InboxSelection = 'escalation' | 'approval';
type Actor = 'Human' | 'Agent' | 'System';

type ActivityEntry = {
  id: number;
  actor: Actor;
  name: string;
  action: string;
  issue: string;
  when: string;
};

const sections: { name: Section; icon: string }[] = [
  { name: 'Console', icon: '⌂' },
  { name: 'Inbox', icon: '▤' },
  { name: 'Issues', icon: '◉' },
  { name: 'Ranking', icon: '↗' },
  { name: 'Activity', icon: '◷' },
];

const initialActivity: ActivityEntry[] = [
  { id: 1, actor: 'Agent', name: 'Ziki Reviewer', action: 'Paused and asked for a product decision', issue: '#388 · Google sign-in skips two-factor', when: 'Sample entry' },
  { id: 2, actor: 'Human', name: 'Jordan D.', action: 'Added a triage note for review', issue: '#402 · Update account recovery guidance', when: 'Sample entry' },
  { id: 3, actor: 'Agent', name: 'ASA3 Solver', action: 'Completed a local reproduction checklist', issue: '#400 · Profile page shows stale details', when: 'Sample entry' },
  { id: 4, actor: 'Human', name: 'Jordan D.', action: 'Confirmed issue priority', issue: '#400 · Profile page shows stale details', when: 'Sample entry' },
];

const issues = [
  { id: '#388', title: 'Google sign-in skips two-factor for a password account', priority: 'High', status: 'Needs your input', agent: 'Ziki Reviewer', category: 'Authentication' },
  { id: '#400', title: 'Profile page shows stale details after an update', priority: 'Medium', status: 'In review', agent: 'ASA3 Solver', category: 'Profile' },
  { id: '#402', title: 'Update account recovery guidance', priority: 'Medium', status: 'Approval needed', agent: 'Ziki Reviewer', category: 'Documentation' },
  { id: '#405', title: 'Add a clearer empty state to saved items', priority: 'Low', status: 'Open', agent: 'Unassigned', category: 'Experience' },
];

const stateCopy: Record<AgentState, { title: string; description: string; badge: string }> = {
  waiting: { title: 'Waiting for your input', description: 'The agent is paused. It will not continue until you choose what happens next.', badge: 'PAUSED' },
  paused: { title: 'Kept paused', description: 'The agent remains paused. You can respond or take over whenever you’re ready.', badge: 'PAUSED' },
  resumed: { title: 'Simulated: response received', description: 'Your guidance is recorded in this page and the sample status is resumed. No real agent was contacted.', badge: 'SIMULATED RESUME' },
  takenOver: { title: 'You are responsible', description: 'This issue is marked as human-owned in the prototype. No agent action was triggered.', badge: 'HUMAN-OWNED' },
};

function App() {
  const [section, setSection] = useState<Section>('Console');
  const [agentState, setAgentState] = useState<AgentState>('waiting');
  const [response, setResponse] = useState('');
  const [submittedResponse, setSubmittedResponse] = useState('');
  const [responseError, setResponseError] = useState('');
  const [inboxSelection, setInboxSelection] = useState<InboxSelection>('escalation');
  const [approvalState, setApprovalState] = useState<'pending' | 'approved' | 'changes'>('pending');
  const [issueFilter, setIssueFilter] = useState('All issues');
  const [activity, setActivity] = useState<ActivityEntry[]>(initialActivity);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const addActivity = (actor: Actor, name: string, action: string, issue: string) => {
    setActivity((current) => [{ id: Date.now(), actor, name, action, issue, when: 'Just now · local demo' }, ...current]);
  };

  function navigate(next: Section) {
    setSection(next);
    setMobileNavOpen(false);
  }

  function submitResponse(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = response.trim();
    if (!trimmed) {
      setResponseError('Enter guidance before marking the sample agent as resumed.');
      return;
    }
    setResponseError('');
    setSubmittedResponse(trimmed);
    setResponse('');
    setAgentState('resumed');
    addActivity('Human', 'Jordan D.', 'Responded to the escalation; sample status changed to simulated resumed', '#388 · Google sign-in skips two-factor');
  }

  function takeOver() {
    setResponseError('');
    setAgentState('takenOver');
    addActivity('Human', 'Jordan D.', 'Took responsibility for the paused issue', '#388 · Google sign-in skips two-factor');
  }

  function keepPaused() {
    setResponseError('');
    setAgentState('paused');
    addActivity('Human', 'Jordan D.', 'Chose to keep the agent paused', '#388 · Google sign-in skips two-factor');
  }

  function resetEscalation() {
    setAgentState('waiting');
    setSubmittedResponse('');
    setResponse('');
    setResponseError('');
  }

  return (
    <div className="app-frame">
      {mobileNavOpen && <button className="nav-scrim" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}
      <aside className={`sidebar ${mobileNavOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-brand">
          <span className="brand-symbol" aria-hidden="true">z</span>
          <span className="brand-word">ziki</span>
          <span className="demo-tag">DEMO</span>
        </div>
        <div className="workspace-switcher"><span className="workspace-avatar">N</span><span className="workspace-copy"><strong>Northstar Studio</strong><small>Sample workspace</small></span><span className="switcher-chevron">⌄</span></div>
        <div className="nav-label">WORKSPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          {sections.map((item) => <button key={item.name} className={`nav-item ${section === item.name ? 'active' : ''}`} onClick={() => navigate(item.name)} aria-current={section === item.name ? 'page' : undefined}>
            <span className="nav-icon" aria-hidden="true">{item.icon}</span><span>{item.name}</span>{item.name === 'Inbox' && <span className="nav-count">{(agentState === 'waiting' || agentState === 'paused' ? 1 : 0) + (approvalState === 'pending' ? 1 : 0)}</span>}
          </button>)}
        </nav>
        <div className="sidebar-bottom"><div className="human-control"><span className="control-icon">✓</span><div><strong>Human in control</strong><small>Agents wait for approval</small></div></div><div className="sidebar-profile"><span className="profile-avatar">JD</span><span><strong>Jordan D.</strong><small>Workspace owner</small></span><span className="profile-more">···</span></div></div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <button className="mobile-menu" aria-label="Open navigation" onClick={() => setMobileNavOpen(true)}>☰</button>
          <div className="topbar-breadcrumb"><span>Northstar Studio</span><span className="crumb-slash">/</span><strong>{section}</strong></div>
          <div className="topbar-right"><span className="demo-indicator"><i /> Sample data</span><button className="help-button" aria-label="Help">?</button><span className="top-avatar">JD</span></div>
        </header>

        <main className="page-content" key={section}>
          {section === 'Console' && <ConsoleView agentState={agentState} approvalState={approvalState} onNavigate={navigate} />}
          {section === 'Inbox' && <InboxView selection={inboxSelection} setSelection={setInboxSelection} agentState={agentState} response={response} setResponse={setResponse} submittedResponse={submittedResponse} error={responseError} setError={setResponseError} onSubmit={submitResponse} onTakeOver={takeOver} onKeepPaused={keepPaused} onReset={resetEscalation} approvalState={approvalState} setApprovalState={setApprovalState} addActivity={addActivity} />}
          {section === 'Issues' && <IssuesView agentState={agentState} approvalState={approvalState} issueFilter={issueFilter} setIssueFilter={setIssueFilter} />}
          {section === 'Ranking' && <RankingView />}
          {section === 'Activity' && <ActivityView activity={activity} />}
        </main>
        <footer className="global-footer"><span>Ziki interaction prototype <span className="footer-dot">·</span> Sample data only</span><span>No production connection</span></footer>
      </div>
    </div>
  );
}

function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="page-header"><div>{eyebrow && <div className="page-eyebrow">{eyebrow}</div>}<div className="page-title-row"><h1>{title}</h1>{action}</div><p>{description}</p></div></div>;
}

function ConsoleView({ agentState, approvalState, onNavigate }: { agentState: AgentState; approvalState: 'pending' | 'approved' | 'changes'; onNavigate: (section: Section) => void }) {
  const escalationPending = agentState === 'waiting' || agentState === 'paused';
  const attentionCount = (escalationPending ? 1 : 0) + (approvalState === 'pending' ? 1 : 0);
  const openIssues = 4;
  return <>
    <PageHeader eyebrow="WORKSPACE OVERVIEW · SAMPLE DATA" title="Console" description="Monitor workspace health and agent states. Open a section to review the work behind each number." action={<span className="sample-label">DEMO WORKSPACE</span>} />
    <div className="metric-grid">
      <MetricCard label="Needs human review" value={String(attentionCount)} note="Escalations and approvals" icon="!" tone="amber" onClick={() => onNavigate('Inbox')} />
      <MetricCard label="Agent states" value={agentState === 'takenOver' ? '1 owned' : agentState === 'resumed' ? '1 responded' : '1 paused'} note="One additional sample agent" icon="✳" tone="blue" onClick={() => onNavigate('Issues')} />
      <MetricCard label="Tracked issues" value={String(openIssues)} note="Across the sample workspace" icon="◉" tone="indigo" onClick={() => onNavigate('Issues')} />
      <MetricCard label="Contributors" value="4" note="Fictional ranking examples" icon="↗" tone="green" onClick={() => onNavigate('Ranking')} />
    </div>
    <div className="console-grid">
      <section className="surface agent-card console-agent-card">
        <div className="panel-heading"><div><span className="panel-kicker">CURRENT STATES</span><h2>Agent overview</h2></div><span className="sample-label">ILLUSTRATIVE</span></div>
        <AgentSummary name="Ziki Reviewer" role="Issue triage · #388" state={escalationPending ? (agentState === 'paused' ? 'Kept paused' : 'Waiting for input') : agentState === 'takenOver' ? 'Human-owned' : 'Guidance recorded · demo'} avatar="ZR" />
        <AgentSummary name="ASA3 Solver" role="Implementation review · #400" state="Sample · standing by" avatar="AS" />
        <p className="subtle-note">These are demonstration states, not connected or running agents.</p>
      </section>
      <section className="surface console-shortcuts">
        <div className="panel-heading"><div><span className="panel-kicker">WORKSPACE AREAS</span><h2>Go to a section</h2></div></div>
        <button className="console-shortcut" onClick={() => onNavigate('Inbox')}><span className="shortcut-icon">▤</span><span><strong>Inbox</strong><small>{attentionCount ? `${attentionCount} item(s) need a decision` : 'No pending human decisions'}</small></span><span className="row-arrow">→</span></button>
        <button className="console-shortcut" onClick={() => onNavigate('Issues')}><span className="shortcut-icon">◉</span><span><strong>Issues</strong><small>Track priority, status, category and owner</small></span><span className="row-arrow">→</span></button>
        <button className="console-shortcut" onClick={() => onNavigate('Ranking')}><span className="shortcut-icon">↗</span><span><strong>Ranking</strong><small>Compare fictional sample contributions</small></span><span className="row-arrow">→</span></button>
        <button className="console-shortcut" onClick={() => onNavigate('Activity')}><span className="shortcut-icon">◷</span><span><strong>Activity</strong><small>Review the attributed event timeline</small></span><span className="row-arrow">→</span></button>
      </section>
    </div>
    <p className="console-disclaimer">Console is an overview only. Review decisions in Inbox, issue ownership in Issues, and actions in Activity.</p>
  </>;
}

function MetricCard({ label, value, note, icon, tone, onClick }: { label: string; value: string; note: string; icon: string; tone: string; onClick: () => void }) {
  return <button className="metric-card surface" onClick={onClick}><span className={`metric-icon ${tone}`}>{icon}</span><span className="metric-label">{label}</span><strong className="metric-value">{value}</strong><span className="metric-note">{note}</span></button>;
}

function AgentSummary({ name, role, state, avatar }: { name: string; role: string; state: string; avatar: string }) {
  return <div className="agent-summary"><span className="agent-avatar">{avatar}</span><span className="agent-info"><strong>{name}</strong><small>{role}</small></span><span className="agent-state"><i />{state}</span></div>;
}

function InboxView(props: {
  selection: InboxSelection; setSelection: (selection: InboxSelection) => void; agentState: AgentState;
  response: string; setResponse: (value: string) => void; submittedResponse: string; error: string; setError: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void; onTakeOver: () => void; onKeepPaused: () => void; onReset: () => void;
  approvalState: 'pending' | 'approved' | 'changes'; setApprovalState: (state: 'pending' | 'approved' | 'changes') => void;
  addActivity: (actor: Actor, name: string, action: string, issue: string) => void;
}) {
  const pendingCount = (props.agentState === 'waiting' || props.agentState === 'paused' ? 1 : 0) + (props.approvalState === 'pending' ? 1 : 0);
  return <>
    <PageHeader eyebrow="HUMAN REVIEW QUEUE" title="Inbox" description="Decisions and approvals are ordered so you can handle the most important item first." action={<span className="inbox-total"><b>{pendingCount}</b> {pendingCount === 1 ? 'item needs' : 'items need'} attention</span>} />
    <div className="inbox-layout">
      <section className="surface inbox-list-panel">
        <div className="list-toolbar"><span className="list-heading">For your review <span className="count-badge">2</span></span><span className="sort-label">Priority <span>⌄</span></span></div>
        <button className={`inbox-item ${props.selection === 'escalation' ? 'selected' : ''}`} onClick={() => props.setSelection('escalation')}>
          <span className={`inbox-priority-dot ${props.agentState === 'waiting' || props.agentState === 'paused' ? 'high' : 'done'}`} /><span className="inbox-item-copy"><span className="inbox-item-top"><b>Agent question</b><span className="priority-text high-text">HIGH</span></span><strong>#388 · Google sign-in skips two-factor</strong><small>{props.agentState === 'waiting' || props.agentState === 'paused' ? 'Ziki Reviewer is paused and needs a policy decision.' : props.agentState === 'takenOver' ? 'You took responsibility for this issue.' : 'Your guidance was recorded in the local demo.'}</small><span className="inbox-item-foot">{props.agentState === 'waiting' ? 'Waiting for you' : props.agentState === 'paused' ? 'Kept paused' : props.agentState === 'takenOver' ? 'Human-owned' : 'Simulated resumed'} <i /> Authentication</span></span>
        </button>
        <button className={`inbox-item ${props.selection === 'approval' ? 'selected' : ''}`} onClick={() => props.setSelection('approval')}>
          <span className={`inbox-priority-dot ${props.approvalState === 'pending' ? 'medium' : 'done'}`} /><span className="inbox-item-copy"><span className="inbox-item-top"><b>Approval request</b><span className="priority-text medium-text">MEDIUM</span></span><strong>#402 · Account recovery guidance</strong><small>{props.approvalState === 'pending' ? 'Review a proposed update before it is marked accepted.' : props.approvalState === 'approved' ? 'You marked the sample proposal approved.' : 'You requested changes to the sample proposal.'}</small><span className="inbox-item-foot">{props.approvalState === 'pending' ? 'Approval needed' : props.approvalState === 'approved' ? 'Approved · demo' : 'Changes requested'} <i /> Documentation</span></span>
        </button>
        <div className="queue-note"><span>ⓘ</span><p>Sample queue only. Items do not update a real workspace.</p></div>
      </section>
      <section className="surface inbox-detail-panel">
        {props.selection === 'escalation' ? <EscalationPanel agentState={props.agentState} response={props.response} setResponse={props.setResponse} submittedResponse={props.submittedResponse} error={props.error} setError={props.setError} onSubmit={props.onSubmit} onTakeOver={props.onTakeOver} onKeepPaused={props.onKeepPaused} onReset={props.onReset} /> : <ApprovalPanel state={props.approvalState} setState={props.setApprovalState} addActivity={props.addActivity} />}
      </section>
    </div>
  </>;
}

function EscalationPanel({ agentState, response, setResponse, submittedResponse, error, setError, onSubmit, onTakeOver, onKeepPaused, onReset }: {
  agentState: AgentState; response: string; setResponse: (value: string) => void; submittedResponse: string; error: string; setError: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void; onTakeOver: () => void; onKeepPaused: () => void; onReset: () => void;
}) {
  const status = stateCopy[agentState];
  return <>
    <div className={`escalation-status ${agentState}`} role="status" aria-live="polite"><span className="status-symbol">{agentState === 'resumed' ? '↻' : agentState === 'takenOver' ? '✓' : 'Ⅱ'}</span><span><strong>{status.title}</strong><small>{status.description}</small></span><b className="status-badge">{status.badge}</b></div>
    <div className="detail-issue-heading"><div className="issue-label-row"><span className="issue-number">ISSUE #388</span><span className="priority-chip high-chip">● High</span><span className="issue-status-chip">{agentState === 'takenOver' ? 'Human-owned' : agentState === 'resumed' ? 'Simulated resumed' : 'Needs input'}</span></div><h2>Google sign-in skips two-factor for a password account</h2><div className="assignment-row"><span className="assigned-avatar">{agentState === 'takenOver' ? 'JD' : 'ZR'}</span><span>Assigned to <strong>{agentState === 'takenOver' ? 'Jordan D. (you)' : 'Ziki Reviewer'}</strong></span><span className="category-tag">Authentication</span></div></div>
    <div className="task-box"><div className="task-icon-small">⌘</div><div><small className="field-label">AGENT’S CURRENT TASK</small><strong>Review authentication flow</strong><p>Trace Google sign-in and confirm when two-factor verification should be required.</p></div></div>
    <div className="escalation-details"><div className="detail-column"><h3><span className="detail-check">✓</span> Steps attempted</h3><ul><li>Compared Google sign-in with password sign-in.</li><li>Checked where the two-factor challenge is triggered.</li></ul></div><div className="detail-column blocker-column"><h3><span className="detail-alert">!</span> What’s blocking the agent</h3><p>The expected policy for Google accounts is not specified. The agent has paused rather than choose a security behavior on your behalf.</p></div></div>
    <div className="decision-question"><small>DECISION NEEDED</small><p>Should Google accounts complete two-factor verification when it’s enabled on their account?</p></div>
    {submittedResponse && agentState === 'resumed' && <div className="response-receipt"><strong>Your guidance</strong><p>“{submittedResponse}”</p><small>Local prototype record · not sent to a real agent</small></div>}
    {(agentState === 'waiting' || agentState === 'paused') ? <form className="escalation-form" onSubmit={onSubmit}>
      <label htmlFor="human-response">Your response</label><textarea id="human-response" value={response} onChange={(event) => { setResponse(event.target.value); if (error) setError(''); }} placeholder="Explain what behavior you expect…" rows={3} aria-describedby={error ? 'response-error' : 'response-help'} />
      {error ? <p id="response-error" className="form-hint error-text" role="alert">{error}</p> : <p id="response-help" className="form-hint">This response changes only the local demonstration state.</p>}
      <div className="escalation-actions"><button className="button button-primary" type="submit">Respond and resume <span aria-hidden="true">→</span></button><button className="button button-outline" type="button" onClick={onTakeOver}>Take over</button><button className="button button-quiet" type="button" onClick={onKeepPaused}>Keep paused</button></div>
    </form> : <div className="completed-actions"><span className="completion-note">{agentState === 'takenOver' ? 'You are now responsible for this issue.' : 'Your response is recorded in the local demo.'}</span><button className="button button-outline" onClick={onReset}>Reset demo state</button></div>}
    <div className="no-live-note"><span>ⓘ</span><span>Sample interaction only. No real agent, Ziki account, or backend is connected.</span></div>
  </>;
}

function ApprovalPanel({ state, setState, addActivity }: { state: 'pending' | 'approved' | 'changes'; setState: (state: 'pending' | 'approved' | 'changes') => void; addActivity: (actor: Actor, name: string, action: string, issue: string) => void }) {
  function update(next: 'approved' | 'changes') {
    if (state === next) return;
    setState(next);
    addActivity('Human', 'Jordan D.', next === 'approved' ? 'Approved the sample account recovery proposal' : 'Requested changes to the sample account recovery proposal', '#402 · Account recovery guidance');
  }
  return <>
    <div className={`approval-state ${state}`}><span>{state === 'pending' ? '◷' : state === 'approved' ? '✓' : '↺'}</span><div><strong>{state === 'pending' ? 'Approval needed' : state === 'approved' ? 'Marked approved' : 'Changes requested'}</strong><small>{state === 'pending' ? 'Review the sample proposal before accepting.' : 'This outcome is recorded locally for the prototype.'}</small></div></div>
    <div className="detail-issue-heading"><div className="issue-label-row"><span className="issue-number">ISSUE #402</span><span className="priority-chip medium-chip">● Medium</span><span className="issue-status-chip">{state === 'pending' ? 'Approval needed' : state === 'approved' ? 'Approved (demo)' : 'Changes requested'}</span></div><h2>Update account recovery guidance</h2><div className="assignment-row"><span className="assigned-avatar">ZR</span><span>Proposed by <strong>Ziki Reviewer</strong></span><span className="category-tag">Documentation</span></div></div>
    <div className="proposal-card"><small className="field-label">SAMPLE PROPOSAL</small><h3>Clarify recovery options on the help page</h3><p>Add a short explanation of account recovery steps and link users to support if they can’t access their recovery method.</p><div className="proposal-reason"><strong>Why it was proposed</strong><span>The current guidance does not describe what to do when a recovery method is unavailable.</span></div></div>
    {state === 'pending' ? <div className="approval-actions"><button className="button button-primary" onClick={() => update('approved')}>Approve proposal</button><button className="button button-outline" onClick={() => update('changes')}>Request changes</button></div> : <button className="button button-outline" onClick={() => setState('pending')}>Reset approval demo</button>}
    <div className="no-live-note"><span>ⓘ</span><span>Demonstration approval only. No content is published or backend updated.</span></div>
  </>;
}

function IssuesView({ agentState, approvalState, issueFilter, setIssueFilter }: {
  agentState: AgentState;
  approvalState: 'pending' | 'approved' | 'changes';
  issueFilter: string;
  setIssueFilter: (value: string) => void;
}) {
  const [categoryFilter, setCategoryFilter] = useState('All categories');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('#388');
  const statusFor = (issue: typeof issues[number]) => {
    if (issue.id === '#388') return agentState === 'waiting' ? 'Needs your input' : agentState === 'paused' ? 'Kept paused' : agentState === 'takenOver' ? 'Human-owned' : 'Guidance recorded';
    if (issue.id === '#402') return approvalState === 'pending' ? 'Awaiting approval' : approvalState === 'approved' ? 'Approved (demo)' : 'Changes requested';
    return issue.status;
  };
  const ownerFor = (issue: typeof issues[number]) => issue.id === '#388' && agentState === 'takenOver' ? 'Jordan D. (you)' : issue.agent;
  const statuses = ['All issues', 'Needs your input', 'Kept paused', 'Human-owned', 'Guidance recorded', 'Awaiting approval', 'Approved (demo)', 'Changes requested', 'In review', 'Open'];
  const categories = ['All categories', ...Array.from(new Set(issues.map((issue) => issue.category)))];
  const filteredIssues = issues.filter((issue) => {
    const status = statusFor(issue);
    const matchesStatus = issueFilter === 'All issues' || issueFilter === 'All statuses' || status === issueFilter || (issueFilter === 'In review' && status === 'In review') || (issueFilter === 'Open' && status === 'Open');
    const matchesCategory = categoryFilter === 'All categories' || issue.category === categoryFilter;
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || `${issue.id} ${issue.title} ${issue.category} ${ownerFor(issue)}`.toLowerCase().includes(query);
    return matchesStatus && matchesCategory && matchesSearch;
  });
  const selectedIssue = issues.find((issue) => issue.id === selectedId);
  return <>
    <PageHeader eyebrow="ISSUE TRACKING" title="Issues" description="Track status, priority, category and ownership. Select an issue to inspect its current state and next step." action={<span className="sample-label">SAMPLE ISSUES</span>} />
    <div className="issue-controls">
      <label className="issue-search-label">Search issues<input aria-label="Search issues" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, ID, owner…" /></label>
      <label> Status <select aria-label="Filter by status" value={issueFilter} onChange={(event) => setIssueFilter(event.target.value)}>{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
      <label> Category <select aria-label="Filter by category" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
      <span className="table-caption">{filteredIssues.length} of {issues.length} issues</span>
    </div>
    <section className="surface issue-table-wrap"><table className="issue-table"><thead><tr><th>ISSUE</th><th>STATUS</th><th>PRIORITY</th><th>OWNER</th></tr></thead><tbody>{filteredIssues.map((issue) => {
      const status = statusFor(issue);
      const statusClass = status === 'Needs your input' || status === 'Kept paused' || status === 'Awaiting approval' ? 'waiting-status' : status === 'Human-owned' ? 'human-status' : status === 'Guidance recorded' || status === 'Approved (demo)' ? 'resumed-status' : status === 'Open' ? 'open-status' : status === 'Changes requested' ? 'approval-status' : 'review-status';
      return <tr key={issue.id} className={selectedId === issue.id ? 'featured-issue-row selected-issue-row' : ''}><td><button className="issue-select-button" onClick={() => setSelectedId(issue.id)} aria-pressed={selectedId === issue.id}><span className="issue-cell"><span className="issue-cell-id">{issue.id}</span><strong>{issue.title}</strong><small>{issue.category}</small></span></button></td><td><span className={`table-status ${statusClass}`}>{status}</span></td><td><span className={`priority-cell ${issue.priority.toLowerCase()}`}><i />{issue.priority}</span></td><td><span className="table-agent"><span className="mini-agent-avatar">{ownerFor(issue).startsWith('Jordan') ? 'JD' : issue.agent === 'ASA3 Solver' ? 'AS' : issue.agent === 'Unassigned' ? '—' : 'ZR'}</span>{ownerFor(issue)}</span></td></tr>;
    })}</tbody></table>{filteredIssues.length === 0 && <div className="issues-empty"><strong>No matching issues</strong><span>Try another status, category or search term.</span><button className="button button-outline" onClick={() => { setIssueFilter('All issues'); setCategoryFilter('All categories'); setSearch(''); }}>Clear filters</button></div>}</section>
    {selectedIssue && <section className="surface issue-inspector"><div className="issue-inspector-heading"><div><span className="panel-kicker">ISSUE DETAILS · {selectedIssue.id}</span><h2>{selectedIssue.title}</h2></div><span className={`table-status ${statusFor(selectedIssue) === 'Human-owned' ? 'human-status' : statusFor(selectedIssue) === 'Needs your input' || statusFor(selectedIssue) === 'Awaiting approval' || statusFor(selectedIssue) === 'Kept paused' ? 'waiting-status' : 'review-status'}`}>{statusFor(selectedIssue)}</span></div><div className="issue-detail-grid"><div><small>Priority</small><strong>{selectedIssue.priority}</strong></div><div><small>Category</small><strong>{selectedIssue.category}</strong></div><div><small>Owner</small><strong>{ownerFor(selectedIssue)}</strong></div><div><small>Next step</small><strong>{selectedIssue.id === '#388' ? agentState === 'takenOver' ? 'Human owner follows up outside this demo' : agentState === 'resumed' ? 'Guidance receipt is saved in this browser session' : 'Review the agent question in Inbox' : selectedIssue.id === '#402' ? approvalState === 'pending' ? 'Review the proposal in Inbox' : 'Approval outcome recorded locally' : selectedIssue.status === 'Open' ? 'Triage and assign an owner' : 'Continue issue review'}</strong></div></div><p className="issue-inspector-note">Issue status mirrors the local Inbox demo state. No real tracker is connected.</p></section>}
  </>;
}

function RankingView() {
  const ranking = [
    { place: '01', name: 'Ziki Reviewer', type: 'Sample agent', points: '1,240', work: '8 reviewed issues', initials: 'ZR', color: 'lavender' },
    { place: '02', name: 'Jordan D.', type: 'Sample human', points: '980', work: '6 decisions & reviews', initials: 'JD', color: 'blue' },
    { place: '03', name: 'ASA3 Solver', type: 'Sample agent', points: '760', work: '5 issue contributions', initials: 'AS', color: 'mint' },
    { place: '04', name: 'Mina K.', type: 'Sample human', points: '540', work: '3 issue reports', initials: 'MK', color: 'peach' },
  ];
  return <>
    <PageHeader eyebrow="CONTRIBUTIONS · DEMONSTRATION DATA" title="Ranking" description="A sample view of human and agent contributions. These figures are illustrative, not live scores." action={<span className="period-chip">Sample period · This week</span>} />
    <div className="ranking-summary"><div className="surface rank-highlight"><span className="rank-cup">↗</span><div><small>TOP SAMPLE CONTRIBUTOR</small><strong>Ziki Reviewer</strong><span>1,240 demonstration points</span></div><span className="rank-place">#1</span></div><div className="surface rank-highlight"><span className="rank-cup human-cup">✦</span><div><small>HUMAN CONTRIBUTIONS</small><strong>1,520 points</strong><span>Across sample decisions and reports</span></div></div></div>
    <section className="surface ranking-table"><div className="panel-heading"><div><span className="panel-kicker">NORTHSTAR STUDIO</span><h2>Contribution board</h2></div><span className="sample-label">SAMPLE DATA</span></div>{ranking.map((person) => <div className="ranking-row" key={person.place}><span className="ranking-place">{person.place}</span><span className={`ranking-avatar ${person.color}`}>{person.initials}</span><span className="ranking-person"><strong>{person.name}</strong><small>{person.type} · {person.work}</small></span><span className="ranking-points"><b>{person.points}</b><small>points</small></span></div>)}<div className="ranking-footnote">Points and rankings are fictional demonstration data and do not reflect actual Ziki activity.</div></section>
  </>;
}

function ActivityView({ activity }: { activity: ActivityEntry[] }) {
  const [actorFilter, setActorFilter] = useState('All actors');
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All events');
  const filteredActivity = activity.filter((item) => {
    const actorMatch = actorFilter === 'All actors' || item.actor === actorFilter;
    const category = item.action.toLowerCase().includes('approv') || item.action.toLowerCase().includes('proposal') || item.action.toLowerCase().includes('changes') ? 'Approvals' : item.action.toLowerCase().includes('paused') || item.action.toLowerCase().includes('take responsibility') || item.action.toLowerCase().includes('escalation') || item.action.toLowerCase().includes('responded') ? 'Human handoff' : 'Issue work';
    const categoryMatch = categoryFilter === 'All events' || category === categoryFilter;
    const searchMatch = !query.trim() || `${item.name} ${item.action} ${item.issue}`.toLowerCase().includes(query.trim().toLowerCase());
    return actorMatch && categoryMatch && searchMatch;
  });
  return <>
    <PageHeader eyebrow="ATTRIBUTED AUDIT TRAIL" title="Activity" description="Follow the timeline of sample agent events and the decisions made in this browser session." action={<span className="activity-counter"><span /> Local demo feed</span>} />
    <section className="surface activity-feed activity-feed-full"><div className="feed-heading"><div><span className="panel-kicker">WORKSPACE TIMELINE</span><h2>Recent events</h2><p className="activity-feed-description">Every entry names the actor, action, affected issue and whether it is sample or local.</p></div><span className="sample-label">SAMPLE + LOCAL</span></div>
      <div className="activity-filters"><label>Search timeline<input aria-label="Search activity" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search actor, action or issue…" /></label><label>Actor<select aria-label="Filter by actor" value={actorFilter} onChange={(event) => setActorFilter(event.target.value)}><option>All actors</option><option>Human</option><option>Agent</option><option>System</option></select></label><label>Event type<select aria-label="Filter by event type" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option>All events</option><option>Human handoff</option><option>Approvals</option><option>Issue work</option></select></label><span className="table-caption">{filteredActivity.length} events</span></div>
      <ActivityList items={filteredActivity} />
    </section>
    <p className="activity-disclaimer">Initial entries are fictional sample events. New human actions are recorded locally and disappear when the page reloads. Nothing is streamed from a live system.</p>
  </>;
}

function ActivityList({ items, compact = false }: { items: ActivityEntry[]; compact?: boolean }) {
  if (items.length === 0) return <p className="empty-activity">No local activity yet. Your choices in Inbox and Issues will appear here.</p>;
  return <div className={`activity-list ${compact ? 'compact' : ''}`}>{items.map((item) => <article className="activity-entry" key={item.id}><span className={`activity-actor-icon ${item.actor.toLowerCase()}`}>{item.actor === 'Agent' ? '✳' : item.actor === 'Human' ? item.name.split(' ').map((part) => part[0]).join('').slice(0, 2) : 'i'}</span><span className="activity-entry-copy"><span className="activity-action"><strong>{item.name}</strong> {item.action}</span><span className="activity-issue-link">{item.issue}</span></span><span className={`actor-tag ${item.actor.toLowerCase()}`}>{item.actor}</span><time>{item.when}</time></article>)}</div>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
