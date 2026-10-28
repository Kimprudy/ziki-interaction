# Ziki Human-Agent Interaction Prototype

A React + TypeScript + Vite prototype of what happens in a Ziki workspace when an AI agent pauses and needs a person: the agent explains what it was doing and why it stopped, the person decides, and the agent visibly carries that decision forward.

This is not the Ziki production application. The Ziki dashboard requires sign-in, and this project has no access to its source, APIs or data. The issue lifecycle, roles and points model follow the public description on [ziki.dev](https://ziki.dev/); colours and type follow the public site (Manrope / DM Sans, `#2864d7` blue on white). All data is fictional and all agent behaviour is simulated in the browser.

## The interaction

1. **An agent pauses.** Ziki Reviewer was tracing a sign-in bug (#388) and found that the intended security policy isn't written down. Rather than choose a security rule itself, it pauses and escalates to the workspace owner.
2. **The human gets context.** In Inbox the escalation shows what the agent was doing, the steps it tried, why it needs a person, the evidence it collected (reproduction, code path, risk, confidence) and a direct question.
3. **The human decides.** Each choice states its consequence before you pick it:
   - **Send decision & resume agent:** choose one of the agent's options (it marks the one it recommends) or write your own guidance.
   - **Take over:** you become the owner and the agent stops.
   - **Keep paused:** nothing changes; the item stays in your queue.
4. **The agent responds (simulated).** It resumes, drafts a plan based on what you chose, and sends it back for approval (Ziki's *Authorize* step). Request changes with a comment and it returns a revised plan.
5. **Delivery and independent testing.** After you approve, the agent links a pull request (*Deliver*) and a separate tester agent verifies the exact commit (*Prove*).
6. **The human approves the merge.** Ziki merges only after a person approves. Approve & merge closes the issue (*Merge*); Send back returns the fix to the agent, which is tested again before it comes back to you.

A notification appears when an agent finishes a step while you're in another section. Every step is written to Activity with its actor (Human, Agent or Ziki), and Console, Inbox, Issues and Activity all read from the same state, so they always agree.

A second, shorter scenario covers Ziki's *Confirm* step: bug report #405 needs a second independent reviewer. Confirming it lets an agent claim the issue and send a plan; "Can't confirm" closes it with your reason.

## Sections

- **Console:** overview only. A "Start here" walkthrough guides a first-time viewer through the main scenario, then shows what's waiting on a human, what each agent is doing, and how many issues are at each lifecycle stage (click a stage to filter Issues).
- **Inbox:** the human review queue: agent questions, plan approvals, merge approvals and report reviews, grouped into *Needs your decision*, *With agents* and *Handled*, with an "All caught up" state.
- **Issues:** issue tracking through Ziki's lifecycle (Report → Confirm → Authorize → Deliver → Prove → Merge). Includes search and stage/status/category filters, a lifecycle stepper, owner and next step, and a work log built from that issue's actual Activity events.
- **Ranking:** sample contribution points for agents and humans by role (Solver, Reviewer, Reporter), following Ziki's rule that only validated work earns points.
- **Activity:** an attributed audit trail with actor, event-type and search filters. Each entry links to its issue.

## What is real and what is simulated

- **Real (in the browser):** navigation, filters, validation, every decision, cross-section state, notifications and the Activity log. Progress is saved in the browser's local storage, so a reload keeps your place; **Reset demo** in the banner starts over.
- **Simulated:** agent and tester steps (resuming, drafting and revising plans, linking and updating a pull request, test verdicts). They run on short timers in your browser and carry on after a reload. No AI model, Ziki API or GitHub is called; commit hashes are made up.
- **Sample:** issues, agents, evidence, points and the initial Activity entries (marked "Sample").
- **Not included:** authentication, a server-side database, or any connection to Ziki or GitHub.

## Code layout

- `src/data.ts`: sample data and the Ziki lifecycle.
- `src/workspace.ts`: all state, human actions, simulated agent steps, saving to local storage, and the derived status every section reads.
- `src/App.tsx`: the shell (navigation, banner, notifications).
- `src/sections/`: one file per section; `InboxPanels.tsx` holds the panel for each kind of Inbox item.
- `src/components.tsx`: shared UI pieces.
- `tests/`: Playwright browser tests.

## Run locally

Requires Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev        # http://localhost:5173
npm run typecheck  # TypeScript only
npm run build      # typecheck + production build
npm run preview    # serve the build
npm test           # build, serve and run the browser tests
```

`npm test` uses your installed Google Chrome locally. In CI (GitHub Actions, on every push and pull request) it installs Playwright's Chromium instead. The suite covers every decision path, the full lifecycle, notifications, reload persistence, the report scenario, cross-section links, text size and contrast in every section, console errors, and layout at 1024, 390 and 320px wide.
