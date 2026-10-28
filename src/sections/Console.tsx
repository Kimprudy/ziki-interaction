// Console: overview only — what needs a human, what agents are doing, where issues sit.

import { type Section, type Stage, issueById, issues, ranking, stageHelp, stages } from '../data';
import { MetricCard, PageHeader, StatusPill } from '../components';
import type { Workspace } from '../workspace';

type Props = { ws: Workspace; onNavigate: (section: Section) => void; onOpenInbox: (key: string) => void; onOpenStage: (stage: Stage) => void };

export function ConsoleView({ ws, onNavigate, onOpenInbox, onOpenStage }: Props) {
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
    <Walkthrough ws={ws} onOpenInbox={onOpenInbox} />
    <div className="metric-grid">
      <MetricCard label="Needs your decision" value={String(ws.pendingCount)} note={ws.pendingCount ? 'Open Inbox to decide' : 'All caught up'} icon="!" tone="amber" onClick={() => onNavigate('Inbox')} />
      <MetricCard label="Agents working" value={String(working)} note="Drafting, delivering or testing" icon="✳" tone="blue" onClick={() => onNavigate('Activity')} />
      <MetricCard label="Open issues" value={String(statuses.filter(({ status }) => !status.complete && !status.label.startsWith('Closed')).length)} note="Not yet merged or closed" icon="◉" tone="indigo" onClick={() => onNavigate('Issues')} />
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

/** A guided path through the main scenario, so a first-time reviewer knows where to start. */
function Walkthrough({ ws, onOpenInbox }: { ws: Workspace; onOpenInbox: (key: string) => void }) {
  const plan = ws.plans['#388'];
  const delivery = ws.delivery['#388'];
  const answered = ws.escalation === 'resumed' || ws.escalation === 'takenOver';
  const steps = [
    { label: 'Answer Ziki Reviewer’s question', help: 'An agent paused on a security decision (#388).', done: answered },
    { label: 'Approve the plan it sends back', help: 'Or request changes and watch it revise.', done: plan?.state === 'approved' },
    { label: 'Approve the merge after testing', help: 'An independent tester checks the fix first.', done: delivery?.state === 'merged' },
  ];

  let next: { text: string; key?: string; cta?: string; reset?: boolean };
  if (!answered) next = { text: 'An agent is waiting for your decision in Inbox.', key: 'esc-#388', cta: 'Start: answer the agent →' };
  else if (ws.escalation === 'takenOver') next = { text: 'You took over #388, so the agent stopped. Reset the scenario to try the agent path.', reset: true };
  else if (plan?.state === 'pending') next = { text: 'Ziki Reviewer sent a plan based on your decision.', key: 'plan-#388', cta: 'Review the plan →' };
  else if (plan?.state === 'drafting' || plan?.state === 'changes') next = { text: 'Ziki Reviewer is working on the plan. You’ll get a notification when it’s ready.' };
  else if (delivery?.state === 'verified') next = { text: 'The fix passed independent testing.', key: 'merge-#388', cta: 'Approve the merge →' };
  else if (delivery?.state === 'merged') next = { text: 'Done: you took #388 from a paused agent to a merged fix.' };
  else next = { text: 'The agent is delivering the fix and a tester will verify it. You’ll get a notification.' };

  const done = delivery?.state === 'merged';
  return (
    <section className={`surface walkthrough ${done ? 'walkthrough-done' : ''}`} aria-labelledby="walkthrough-heading">
      <div className="walkthrough-intro">
        <span className="panel-kicker">{answered ? 'YOUR WALKTHROUGH' : 'START HERE'}</span>
        <h2 id="walkthrough-heading">{done ? 'Walkthrough complete' : 'See how a person and an agent work together'}</h2>
        <p>{next.text}</p>
        <div className="walkthrough-actions">
          {next.key && <button className="button button-primary" onClick={() => onOpenInbox(next.key!)}>{next.cta}</button>}
          {next.reset && <button className="button button-outline" onClick={() => ws.actions.resetScenario('#388')}>Reset #388</button>}
          {ws.report === 'pending' && answered && <button className="button button-quiet" onClick={() => onOpenInbox('report-#405')}>Also try: review a bug report (#405)</button>}
        </div>
      </div>
      <ol className="walkthrough-steps">
        {steps.map((step, index) => (
          <li key={step.label} className={step.done ? 'done' : ''}>
            <span className="walkthrough-dot" aria-hidden="true">{step.done ? '✓' : index + 1}</span>
            <span><strong>{step.label}</strong><small>{step.help}</small></span>
            {step.done && <span className="visually-hidden"> (done)</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}
