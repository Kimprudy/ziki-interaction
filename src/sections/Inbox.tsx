// Inbox: the human review queue. The list is grouped by who the item is waiting on.

import { issueById } from '../data';
import { PageHeader } from '../components';
import type { InboxItem, Workspace } from '../workspace';
import { EscalationPanel, MergePanel, PlanPanel, ReportPanel } from './InboxPanels';

type Props = { ws: Workspace; selectedKey: string; onSelect: (key: string) => void; onOpenIssue: (id: string) => void };

const groups: { id: InboxItem['group']; title: string; empty?: string }[] = [
  { id: 'needs', title: 'Needs your decision', empty: 'All caught up. Agents will ask here when they need you.' },
  { id: 'agent', title: 'With agents' },
  { id: 'done', title: 'Handled' },
];

export function InboxView({ ws, selectedKey, onSelect, onOpenIssue }: Props) {
  const selected = ws.inbox.find((item) => item.key === selectedKey) ?? ws.inbox.find((item) => item.group === 'needs') ?? ws.inbox[0];
  const panelProps = { ws, issueId: selected.issueId, onSelect, onOpenIssue };

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
        {selected.kind === 'Agent question' && <EscalationPanel {...panelProps} />}
        {selected.kind === 'Plan approval' && <PlanPanel key={selected.key} {...panelProps} />}
        {selected.kind === 'Merge approval' && <MergePanel key={selected.key} {...panelProps} />}
        {selected.kind === 'Report review' && <ReportPanel {...panelProps} />}
      </section>
    </div>
  </>;
}
