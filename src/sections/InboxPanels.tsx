// Detail panels for each kind of Inbox item.

import { useState } from 'react';
import { type DecisionOption, commitFor, decisionOptions, escalationEvidence, report405 } from '../data';
import { AgentProgress, FeedbackForm, IssueHeading } from '../components';
import type { Decision, EscalationState, Workspace } from '../workspace';

type PanelProps = { ws: Workspace; issueId: string; onSelect: (key: string) => void; onOpenIssue: (id: string) => void };

function Banner({ tone, symbol, title, body }: { tone: string; symbol: string; title: string; body: string }) {
  return (
    <div className={`approval-state ${tone}`} role="status">
      <span aria-hidden="true">{symbol}</span>
      <div><strong>{title}</strong><small>{body}</small></div>
    </div>
  );
}

function Consequences({ items }: { items: [string, string][] }) {
  return <ul className="action-consequences">{items.map(([action, result]) => <li key={action}><b>{action}:</b> {result}</li>)}</ul>;
}

function FooterActions({ ws, issueId, onOpenIssue, children }: { ws: Workspace; issueId: string; onOpenIssue: (id: string) => void; children?: React.ReactNode }) {
  return (
    <div className="completed-actions">
      {children ?? <button className="button button-outline" onClick={() => onOpenIssue(issueId)}>Open in Issues</button>}
      <button className="button button-quiet" onClick={() => ws.actions.resetScenario(issueId)}>Reset scenario</button>
    </div>
  );
}

/* ---------- Agent question (#388) ---------- */

const escalationBanner: Record<EscalationState, { title: string; body: string; badge: string; symbol: string }> = {
  waiting: { title: 'Agent paused · waiting for your decision', body: 'Ziki Reviewer stopped before choosing a security rule. It will not continue until you decide.', badge: 'PAUSED', symbol: 'Ⅱ' },
  paused: { title: 'Kept paused', body: 'The agent stays paused and this stays in your queue. Answer or take over whenever you’re ready.', badge: 'PAUSED', symbol: 'Ⅱ' },
  resumed: { title: 'Agent resumed with your decision', body: 'Ziki Reviewer is acting on your answer. Follow its progress below (simulated).', badge: 'RESUMED', symbol: '↻' },
  takenOver: { title: 'You own this issue', body: 'The agent stopped working on #388. You are responsible for the next step.', badge: 'HUMAN-OWNED', symbol: '✓' },
};

export function EscalationPanel({ ws, onSelect, onOpenIssue }: PanelProps) {
  const { escalation, decision } = ws;
  const status = ws.statusOf('#388');
  const plan = ws.plans['#388'];
  const open = escalation === 'waiting' || escalation === 'paused';

  return <>
    <div className={`escalation-status ${escalation}`} role="status">
      <span className="status-symbol" aria-hidden="true">{escalationBanner[escalation].symbol}</span>
      <span><strong>{escalationBanner[escalation].title}</strong><small>{escalationBanner[escalation].body}</small></span>
      <b className="status-badge">{escalationBanner[escalation].badge}</b>
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
      <AgentProgress title="What happens next" steps={[
        { label: 'Decision sent to Ziki Reviewer', done: true },
        { label: 'Agent drafts a plan from your decision', done: plan?.state !== 'drafting', active: plan?.state === 'drafting' },
        { label: 'Plan comes back to you for approval', done: plan?.state === 'approved', active: plan?.state === 'pending' || plan?.state === 'changes' },
      ]} />
      <FooterActions ws={ws} issueId="#388" onOpenIssue={onOpenIssue}>
        {plan && plan.state !== 'drafting'
          ? <button className="button button-primary" onClick={() => onSelect('plan-#388')}>{plan.state === 'pending' ? 'Review the agent’s plan →' : 'View the plan →'}</button>
          : <span className="completion-note">The agent’s plan will appear in your Inbox.</span>}
      </FooterActions>
    </>}

    {escalation === 'takenOver' && <>
      <AgentProgress title="What changed" steps={[
        { label: 'Ziki Reviewer stopped working on #388', done: true },
        { label: 'Owner changed to Jordan D. (you)', done: true },
        { label: 'Next: you deliver the fix and link a pull request' },
      ]} />
      <FooterActions ws={ws} issueId="#388" onOpenIssue={onOpenIssue} />
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
      <Consequences items={[
        ['Send & resume', 'the agent continues and returns a plan for your approval.'],
        ['Take over', 'you become the owner and the agent stops working on this issue.'],
        ...(paused ? [] : [['Keep paused', 'nothing changes; it stays in your queue.'] as [string, string]]),
      ]} />
    </form>
  );
}

/* ---------- Plan approval (Authorize) ---------- */

export function PlanPanel({ ws, issueId, onSelect, onOpenIssue }: PanelProps) {
  const plan = ws.plans[issueId];
  const delivery = ws.delivery[issueId];
  const status = ws.statusOf(issueId);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  if (!plan) return null;

  const banner = {
    drafting: { tone: 'changes', symbol: '…', title: 'Agent is drafting a plan', body: `${plan.agent} is preparing a plan. It will ask for your approval next.` },
    pending: { tone: 'pending', symbol: '◷', title: plan.revision > 1 ? `Revision ${plan.revision} needs your approval` : 'Plan needs your approval', body: 'Nothing is delivered until you approve. You can also send it back with changes.' },
    changes: { tone: 'changes', symbol: '↺', title: 'Changes requested · agent revising', body: `${plan.agent} is updating the plan and will ask you again.` },
    approved: delivery?.state === 'merged'
      ? { tone: 'approved', symbol: '✓', title: 'Approved · merged', body: 'The plan was delivered, tested and merged.' }
      : { tone: 'approved', symbol: '✓', title: 'Approved · agent is delivering', body: 'Progress is recorded in Activity. You’ll approve the merge once testing passes.' },
  }[plan.state];
  const after = (state: string) => ['delivering', 'testing', 'verified', 'merged'].indexOf(delivery?.state ?? '') > ['delivering', 'testing', 'verified', 'merged'].indexOf(state);

  return <>
    <Banner {...banner} />
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
      <Consequences items={[
        ['Approve', 'the agent delivers the fix, a tester verifies it, then you approve the merge.'],
        ['Request changes', 'the agent revises the plan and asks you again.'],
      ]} />
    </>}

    {plan.state === 'pending' && feedbackOpen && (
      <FeedbackForm id="plan-feedback" label="What should the agent change?" placeholder="For example: also cover accounts that use passkeys"
        submitLabel="Send feedback to agent" emptyError="Tell the agent what to change."
        onSubmit={(text) => { ws.actions.requestChanges(issueId, text); setFeedbackOpen(false); }} onCancel={() => setFeedbackOpen(false)} />
    )}

    {plan.state === 'approved' && <>
      <AgentProgress title="Delivery progress" steps={[
        { label: 'Plan approved by you', done: true },
        { label: `${plan.agent} writes the fix and links a pull request`, done: after('delivering'), active: delivery?.state === 'delivering' },
        { label: 'Ziki Tester verifies the fix independently', done: after('testing'), active: delivery?.state === 'testing' },
        { label: 'You approve the merge', done: delivery?.state === 'merged', active: delivery?.state === 'verified' },
      ]} />
      <FooterActions ws={ws} issueId={issueId} onOpenIssue={onOpenIssue}>
        {delivery?.state === 'verified'
          ? <button className="button button-primary" onClick={() => onSelect(`merge-${issueId}`)}>Review the merge →</button>
          : undefined}
      </FooterActions>
    </>}

    {(plan.state === 'drafting' || plan.state === 'changes') && <FooterActions ws={ws} issueId={issueId} onOpenIssue={onOpenIssue} />}
  </>;
}

/* ---------- Merge approval (Prove → Merge) ---------- */

export function MergePanel({ ws, issueId, onOpenIssue }: PanelProps) {
  const plan = ws.plans[issueId];
  const delivery = ws.delivery[issueId];
  const status = ws.statusOf(issueId);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  if (!plan || !delivery) return null;

  const banner = delivery.state === 'verified'
    ? { tone: 'pending', symbol: '◷', title: 'Tests passed · ready to merge', body: 'Ziki merges only after a person approves. Approve, or send it back with what to change.' }
    : delivery.state === 'merged'
      ? { tone: 'approved', symbol: '✓', title: 'Merged · issue closed', body: 'You approved the merge. The whole lifecycle is complete.' }
      : { tone: 'changes', symbol: '↺', title: 'Sent back · agent updating the fix', body: `${plan.agent} is updating the fix. It will be tested again before it comes back to you.` };

  return <>
    <Banner {...banner} />
    <IssueHeading issueId={issueId} ownerLabel="Fix by" owner={plan.agent} status={status} />
    <div className="proposal-card">
      <div className="proposal-top"><small className="field-label">PULL REQUEST · SIMULATED</small><span className="estimate-chip">Commit {commitFor(issueId, delivery.round)}</span></div>
      <h3>Fix {issueId}: {plan.title}</h3>
      <dl className="evidence-grid pr-facts">
        <div><dt>Approved plan</dt><dd>Revision {plan.revision} · {plan.steps.length} steps</dd></div>
        <div><dt>Independent tester</dt><dd>Ziki Tester (not the author)</dd></div>
        <div><dt>Verdict</dt><dd>{delivery.state === 'delivering' || delivery.state === 'testing' ? 'Waiting for the updated fix' : 'Pass: issue reproduced before the fix, resolved after it'}</dd></div>
        <div><dt>Checks</dt><dd>{delivery.state === 'delivering' || delivery.state === 'testing' ? 'Running again…' : '12 passed · 0 failed'}</dd></div>
      </dl>
      {delivery.feedback && <div className="proposal-reason"><strong>Your earlier feedback</strong><span>“{delivery.feedback}”{delivery.state === 'delivering' || delivery.state === 'testing' ? '' : ' — addressed in this update.'}</span></div>}
    </div>

    {delivery.state === 'verified' && !feedbackOpen && <>
      <div className="approval-actions">
        <button className="button button-primary" onClick={() => ws.actions.approveMerge(issueId)}>Approve &amp; merge</button>
        <button className="button button-outline" onClick={() => setFeedbackOpen(true)}>Send back</button>
      </div>
      <Consequences items={[
        ['Approve & merge', 'the fix is merged and the issue closes.'],
        ['Send back', 'the agent updates the fix; it is tested again before it returns to you.'],
      ]} />
    </>}
    {delivery.state === 'verified' && feedbackOpen && (
      <FeedbackForm id="merge-feedback" label="What should the agent change before merging?" placeholder="For example: add a log line when the 2FA challenge is shown"
        submitLabel="Send back to agent" emptyError="Tell the agent what to change."
        onSubmit={(text) => { ws.actions.sendBack(issueId, text); setFeedbackOpen(false); }} onCancel={() => setFeedbackOpen(false)} />
    )}
    {delivery.state !== 'verified' && <FooterActions ws={ws} issueId={issueId} onOpenIssue={onOpenIssue} />}
  </>;
}

/* ---------- Report review (Confirm) ---------- */

export function ReportPanel({ ws, onSelect, onOpenIssue }: PanelProps) {
  const status = ws.statusOf('#405');
  const plan = ws.plans['#405'];
  const [rejecting, setRejecting] = useState(false);

  const banner = ws.report === 'pending'
    ? { tone: 'pending', symbol: '◷', title: 'Second review needed', body: 'Ziki needs two independent reviewers before work starts. ASA3 Solver confirmed it; you are the second.' }
    : ws.report === 'confirmed'
      ? { tone: 'approved', symbol: '✓', title: 'Report confirmed · moved to Authorize', body: 'ASA3 Solver claimed the issue. Its plan comes to you for approval.' }
      : { tone: 'paused', symbol: '✕', title: 'Closed · not confirmed', body: `Your reason: “${ws.reportReason}”. No work will start.` };

  return <>
    <Banner {...banner} />
    <IssueHeading issueId="#405" ownerLabel="Reported by" owner={report405.reporter} status={status} />
    <div className="proposal-card">
      <small className="field-label">BUG REPORT</small>
      <h3>{report405.summary}</h3>
      <strong className="report-subhead">Steps to reproduce</strong>
      <ol className="plan-steps">{report405.steps.map((step) => <li key={step}>{step}</li>)}</ol>
      <div className="proposal-reason"><strong>Expected</strong><span>{report405.expected}</span></div>
      <div className="proposal-reason"><strong>Actual</strong><span>{report405.actual}</span></div>
    </div>
    <dl className="evidence-grid report-checks" aria-label="Checks already done">
      {report405.checks.map((check) => <div key={check.label}><dt>{check.label}</dt><dd>{check.value}</dd></div>)}
    </dl>

    {ws.report === 'pending' && !rejecting && <>
      <div className="approval-actions">
        <button className="button button-primary" onClick={ws.actions.confirmReport}>Confirm report</button>
        <button className="button button-outline" onClick={() => setRejecting(true)}>Can’t confirm</button>
      </div>
      <Consequences items={[
        ['Confirm', 'the report moves to Authorize and an agent claims it and drafts a plan.'],
        ['Can’t confirm', 'the report is closed with your reason; no work starts.'],
      ]} />
    </>}
    {ws.report === 'pending' && rejecting && (
      <FeedbackForm id="report-reason" label="Why can’t you confirm it?" placeholder="For example: could not reproduce with a new account"
        submitLabel="Close report" emptyError="Give a reason so the reporter knows what happened."
        onSubmit={(text) => { ws.actions.rejectReport(text); setRejecting(false); }} onCancel={() => setRejecting(false)} />
    )}
    {ws.report !== 'pending' && (
      <FooterActions ws={ws} issueId="#405" onOpenIssue={onOpenIssue}>
        {plan && plan.state !== 'drafting'
          ? <button className="button button-primary" onClick={() => onSelect('plan-#405')}>View the agent’s plan →</button>
          : undefined}
      </FooterActions>
    )}
  </>;
}
