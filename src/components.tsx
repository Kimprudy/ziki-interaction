// Small UI pieces shared by more than one section.

import { useState } from 'react';
import { type Stage, issueById, stageHelp, stages } from './data';
import type { IssueStatus } from './workspace';

export const sentence = (action: string) => action.charAt(0).toLowerCase() + action.slice(1);
export const initialsOf = (name: string) => (name.startsWith('Jordan') ? 'JD' : name === 'Unassigned' ? '—' : name.split(' ').map((part) => part[0]).join('').slice(0, 2));

export function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
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

export function StatusPill({ status }: { status: Pick<IssueStatus, 'label' | 'tone'> }) {
  return <span className={`table-status tone-${status.tone}`}>{status.label}</span>;
}

export function Lifecycle({ current, complete = false, compact = false }: { current: Stage; complete?: boolean; compact?: boolean }) {
  const currentIndex = complete ? stages.length : stages.indexOf(current);
  return (
    <ol className={`lifecycle ${compact ? 'lifecycle-compact' : ''}`} aria-label={complete ? 'Lifecycle: complete' : `Lifecycle: currently ${current}`}>
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

export function MetricCard({ label, value, note, icon, tone, onClick }: { label: string; value: string; note: string; icon: string; tone: string; onClick: () => void }) {
  return (
    <button className="metric-card surface" onClick={onClick}>
      <span className={`metric-icon ${tone}`} aria-hidden="true">{icon}</span>
      <span className="metric-label">{label}</span>
      <strong className="metric-value">{value}</strong>
      <span className="metric-note">{note}</span>
    </button>
  );
}

export function AgentProgress({ title, steps }: { title: string; steps: { label: string; done?: boolean; active?: boolean }[] }) {
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

export function IssueHeading({ issueId, ownerLabel, owner, status }: { issueId: string; ownerLabel: string; owner: string; status: IssueStatus }) {
  const issue = issueById(issueId);
  return (
    <div className="detail-issue-heading">
      <div className="issue-label-row">
        <span className="issue-number">ISSUE {issueId}</span>
        <span className={`priority-chip ${issue.priority.toLowerCase()}-chip`}>● {issue.priority}</span>
        <StatusPill status={status} />
      </div>
      <h2>{issue.title}</h2>
      <div className="assignment-row">
        <span className="assigned-avatar">{initialsOf(owner)}</span>
        <span>{ownerLabel} <strong>{owner}</strong></span>
        <span className="category-tag">{issue.category}</span>
      </div>
      <Lifecycle current={status.stage} complete={status.complete} compact />
    </div>
  );
}

/** A required comment that goes back to an agent (request changes, send back, can't confirm). */
export function FeedbackForm({ id, label, placeholder, submitLabel, emptyError, onSubmit, onCancel }: {
  id: string; label: string; placeholder: string; submitLabel: string; emptyError: string;
  onSubmit: (text: string) => void; onCancel: () => void;
}) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!text.trim()) return setError(emptyError);
    onSubmit(text.trim());
  }
  return (
    <form className="escalation-form" onSubmit={submit} noValidate>
      <label htmlFor={id}>{label}</label>
      <textarea id={id} autoFocus value={text} onChange={(event) => { setText(event.target.value); if (error) setError(''); }} rows={3} placeholder={placeholder} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} />
      {error && <p id={`${id}-error`} className="form-hint error-text" role="alert">{error}</p>}
      <div className="approval-actions">
        <button className="button button-primary" type="submit">{submitLabel}</button>
        <button className="button button-quiet" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
