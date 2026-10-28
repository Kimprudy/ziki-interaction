// Issues: tracking every issue through Ziki's lifecycle.

import { issues, stages } from '../data';
import { Lifecycle, PageHeader, StatusPill, initialsOf, sentence } from '../components';
import type { Workspace } from '../workspace';

export type IssuesUi = { search: string; stage: string; status: string; category: string; selectedId: string };

export function IssuesView({ ws, ui, setUi, onOpenInbox }: { ws: Workspace; ui: IssuesUi; setUi: React.Dispatch<React.SetStateAction<IssuesUi>>; onOpenInbox: (key: string) => void }) {
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
  // Keep the details panel on an issue the filters still show.
  const selected = filtered.find((row) => row.issue.id === ui.selectedId) ?? filtered[0] ?? rows.find((row) => row.issue.id === ui.selectedId) ?? rows[0];
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
              <td><span className="table-agent"><span className="mini-agent-avatar">{initialsOf(status.owner)}</span>{status.owner}</span></td>
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
      <Lifecycle current={selected.status.stage} complete={selected.status.complete} />
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
