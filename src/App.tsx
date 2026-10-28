// App shell: navigation, prototype banner, notifications, and section routing.

import { useEffect, useState } from 'react';
import type { Section, Stage } from './data';
import { type Notice, useWorkspace } from './workspace';
import { ConsoleView } from './sections/Console';
import { InboxView } from './sections/Inbox';
import { type IssuesUi, IssuesView } from './sections/Issues';
import { RankingView } from './sections/Ranking';
import { ActivityView } from './sections/Activity';

const sections: { name: Section; icon: string }[] = [
  { name: 'Console', icon: '⌂' },
  { name: 'Inbox', icon: '▤' },
  { name: 'Issues', icon: '◉' },
  { name: 'Ranking', icon: '↗' },
  { name: 'Activity', icon: '◷' },
];

const UI_KEY = 'ziki-prototype-ui-v1';
const defaultIssuesUi: IssuesUi = { search: '', stage: 'All stages', status: 'All statuses', category: 'All categories', selectedId: '#388' };

function loadUi(): { section: Section; inboxKey: string } {
  try {
    const saved = JSON.parse(localStorage.getItem(UI_KEY) ?? 'null');
    if (saved && sections.some((item) => item.name === saved.section)) return saved;
  } catch { /* fall through to defaults */ }
  return { section: 'Console', inboxKey: 'esc-#388' };
}

export function App() {
  const ws = useWorkspace();
  const [section, setSection] = useState<Section>(() => loadUi().section);
  const [inboxKey, setInboxKey] = useState(() => loadUi().inboxKey);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [issuesUi, setIssuesUi] = useState<IssuesUi>(defaultIssuesUi);

  useEffect(() => { localStorage.setItem(UI_KEY, JSON.stringify({ section, inboxKey })); }, [section, inboxKey]);

  // A notice about the item you're already looking at is redundant.
  const viewing = section === 'Inbox' ? inboxKey : null;
  useEffect(() => {
    ws.notices.filter((notice) => notice.inboxKey === viewing).forEach((notice) => ws.dismissNotice(notice.id));
  }, [ws.notices, viewing]);

  function navigate(next: Section) {
    setSection(next);
    setMobileNavOpen(false);
    window.scrollTo({ top: 0 });
  }
  const openInbox = (key: string) => { setInboxKey(key); navigate('Inbox'); };
  const openIssue = (id: string) => { setIssuesUi((ui) => ({ ...ui, selectedId: id, search: '', stage: 'All stages', status: 'All statuses', category: 'All categories' })); navigate('Issues'); };
  const openStage = (stage: Stage) => { setIssuesUi((ui) => ({ ...ui, stage, search: '', status: 'All statuses', category: 'All categories' })); navigate('Issues'); };
  function resetDemo() {
    ws.actions.resetAll();
    setIssuesUi(defaultIssuesUi);
    setInboxKey('esc-#388');
    navigate('Console');
  }

  return (
    <div className="app-frame">
      {mobileNavOpen && <button className="nav-scrim" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}
      <aside className={`sidebar ${mobileNavOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-brand">
          <span className="brand-symbol" aria-hidden="true">z</span>
          <span className="brand-word">ziki</span>
          <span className="demo-tag">PROTOTYPE</span>
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
          <div className="topbar-breadcrumb"><span className="crumb-brand">Ziki</span><span className="crumb-slash" aria-hidden="true">/</span><strong aria-current="page">{section}</strong></div>
          <div className="topbar-right"><span className="top-avatar">JD</span></div>
        </header>
        <div className="prototype-banner" role="note">
          <span><strong>Prototype</strong> Sample workspace. Agent behaviour is simulated in your browser and nothing is sent to Ziki. Your progress is saved in this browser.</span>
          <button className="banner-reset" onClick={resetDemo}>Reset demo</button>
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

      <div className="toast-region" role="status" aria-live="polite">
        {ws.notices.filter((notice) => notice.inboxKey !== viewing).map((notice) => (
          <Toast key={notice.id} notice={notice} onDismiss={() => ws.dismissNotice(notice.id)} onOpen={() => { ws.dismissNotice(notice.id); openInbox(notice.inboxKey); }} />
        ))}
      </div>
    </div>
  );
}

function Toast({ notice, onDismiss, onOpen }: { notice: Notice; onDismiss: () => void; onOpen: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, 9000);
    return () => clearTimeout(timer);
  }, [notice.id]);
  return (
    <div className="toast">
      <span className="toast-icon" aria-hidden="true">✳</span>
      <span className="toast-copy"><strong>{notice.title}</strong><small>{notice.body}</small></span>
      <button className="toast-open" onClick={onOpen}>Review →</button>
      <button className="toast-close" aria-label="Dismiss notification" onClick={onDismiss}>×</button>
    </div>
  );
}
