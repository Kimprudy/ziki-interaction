// Activity: the attributed audit trail of every human, agent and system action.

import { useState } from 'react';
import { type ActivityEntry, type EventType, issueById } from '../data';
import { PageHeader, sentence } from '../components';

const eventTypes: EventType[] = ['Handoff', 'Approval', 'Agent work', 'Status change', 'Issue work'];

export function ActivityView({ activity, onOpenIssue }: { activity: ActivityEntry[]; onOpenIssue: (id: string) => void }) {
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
