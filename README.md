# Ziki Human-Agent Interaction Prototype

A local React + TypeScript + Vite prototype that expands the earlier paused-agent handoff into a small, navigable workspace. It demonstrates a human-in-control escalation experience inside an app shell with Console, Inbox, Issues, Ranking, and Activity sections.

This is a new prototype, not the original Ziki production application. The Ziki dashboard requires authentication, and this project has no access to its private source, APIs, data, or backend. The public Ziki pages and the Ziki for Humans activity page informed the broad interaction direction; exact original colors, spacing, typography, and application behavior are not claimed. The dashboard uses sample data and a consistent blue-and-white visual system.

## User problem and proposed improvement

When an agent reaches an ambiguous product or policy decision, people need to understand what the agent is doing, why it is blocked, and what will happen if they respond. Quietly guessing or proceeding would undermine user control and trust.

The improvement is a clear, attributed human handoff. The paused agent explains its current task and attempted steps, names its blocker, and asks a direct question. The person can provide guidance and simulate resuming, take responsibility, or leave the agent paused. Attention items are surfaced in Inbox, issue ownership and priority are visible in Issues, and human choices are distinguished from sample agent events in Activity.

## Application sections

- **Console:** sample overview metrics, statuses, attention items, and recent attributed events. Metric cards and attention items navigate to relevant sections.
- **Inbox:** a priority-ordered sample escalation and an approval request. Selecting an item opens its details. The escalation offers response, takeover, and keep-paused choices; the approval request has local approve and request-changes actions.
- **Issues:** sample issues with status, priority, category, and assigned agent or human. Status filters work, and the #388 handoff is available directly below the list.
- **Ranking:** clearly labeled fictional sample contribution points for humans and agents.
- **Activity:** an attributed sample timeline. Actions made in Inbox or Issues are added to the local feed and distinguish human actions from agent sample events.

The sidebar navigation is persistent on desktop and opens as a menu on small screens.

## Escalation interaction flow

1. Open **Inbox** and select the high-priority agent question, or open **Issues** and review issue **#388**.
2. Confirm the sample issue's priority, status, assigned agent, current task, attempted steps, blocker, and direct decision question. The initial state shows that the agent is paused and waiting for human input.
3. Choose an action:
   - **Respond and resume:** a blank or whitespace-only response is rejected and the agent remains paused. A non-empty response is shown in the interface, the status becomes **Simulated: response received**, and a human-attributed local event appears in Activity. No real agent resumes.
   - **Take over:** the issue is marked **Human-owned**, the assignment changes to Jordan D. in the prototype, and Activity records the human action. No agent action is triggered.
   - **Keep paused:** the issue stays paused and the form remains available for a later response or takeover.
4. Use **Reset demo state** to return the escalation to its initial waiting state. Local Activity entries remain visible for the current page session.
5. In Inbox, select the approval item and choose **Approve proposal** or **Request changes** to see its local outcome and Activity attribution.

## Sample data and limitations

- All issue, ranking, agent, and initial activity content is fictional demonstration data. Times and statuses are not real-time.
- Interaction state and response text live only in browser memory. Reloading resets the prototype; there is no database or durable persistence.
- Respond/resume, takeover, keep paused, issue approval, filters, and navigation are local demonstration behaviors only.
- Responses are not sent to Ziki or any agent; approvals do not publish or change actual issue content.
- The prototype does not authenticate users, access Ziki private APIs, read dashboard data, run agents, or control any production system.
- Visual styling is an original approximation informed by public-facing references, not a verified reproduction of Ziki's precise design. No external screenshots were supplied for pixel-matching.

## Run locally

Requirements: Node.js 20.19+ or 22.12+ recommended, and npm.

From the project directory:

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`). The project dependencies are declared in `package.json`; no additional backend or service setup is needed.

To create and serve a production build locally:

```bash
npm run build
npm run preview
```

## Manual test checklist

1. **Console:** confirm overview metrics, two attention items, sample agent statuses, and recent activity are shown. Click an attention item or metric and confirm it navigates to the corresponding section.
2. **Navigation:** visit Console, Inbox, Issues, Ranking, and Activity. Confirm each section has its own content. At a narrow viewport, open and close the sidebar menu.
3. **Inbox escalation:** select the #388 item. Confirm the paused status, issue metadata, assigned agent, task, attempted steps, blocker, and decision question are clear.
4. **Empty response:** submit an empty or whitespace-only response. Confirm validation appears and the agent stays paused.
5. **Respond and resume:** enter guidance and submit. Confirm the response receipt, simulated (not real) resumed state, and human-attributed Activity entry.
6. **Take over:** reload to reset, then take over the escalation. Confirm human ownership and attribution; no agent completion is implied.
7. **Keep paused:** reload to reset, choose Keep paused, and confirm the paused status and response/takeover actions remain available.
8. **Approval:** open the second Inbox item and try both Approve proposal and Request changes. Confirm the displayed result and corresponding human Activity event.
9. **Issues:** verify all issue rows and metadata. Try the All issues, Needs your input, In review, and Open filters; check that the displayed rows change.
10. **Ranking:** verify human and agent contributions are explicitly labeled sample data.
11. **Activity:** confirm actor labels differentiate agent sample events and human actions, and that local actions appear in the feed.
12. **Responsive layout:** check the app around desktop, tablet, and phone widths; confirm navigation, cards, actions, and horizontally scrollable issue table remain usable.

The project build can be checked with `npm run build`.
