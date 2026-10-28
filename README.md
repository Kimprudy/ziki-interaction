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
4. **The agent responds (simulated).** After a decision, the agent resumes, drafts a plan based on what you chose, and sends that plan back to Inbox for approval. This is Ziki's *Authorize* step.
5. **Approve or request changes.** Approving moves the issue to *Deliver*; the agent links a pull request and it moves to *Prove*. Requesting changes needs a comment; the agent revises the plan and asks again (revision 2, 3…).

Every step is written to Activity with its actor (Human, Agent or Ziki), and Console, Inbox, Issues and Activity all read from the same state, so they always agree.

## Sections

- **Console:** overview only. Shows what's waiting on a human, what each agent is doing, and how many issues are at each lifecycle stage (click a stage to filter Issues).
- **Inbox:** the human review queue. Items are grouped into *Needs your decision*, *With agents* and *Handled*, with an "All caught up" state when nothing is pending.
- **Issues:** issue tracking through Ziki's lifecycle (Report → Confirm → Authorize → Deliver → Prove → Merge). Includes search and stage/status/category filters, a lifecycle stepper, owner and next step, and a work log built from that issue's actual Activity events. Filters are kept when you switch sections.
- **Ranking:** sample contribution points for agents and humans by role (Solver, Reviewer, Reporter), following Ziki's rule that only validated work earns points.
- **Activity:** an attributed audit trail with actor, event-type and search filters. Each entry links to its issue.

## What is real and what is simulated

- **Real (in the browser):** navigation, filters, validation, every decision, cross-section state, and the Activity log for this session.
- **Simulated:** the agent's follow-up steps (resuming, drafting and revising plans, linking a pull request). These run on short timers in your browser. No AI model or Ziki API is called.
- **Sample:** issues, agents, evidence, points and the initial Activity entries (marked "Sample").
- **Not included:** authentication, persistence (a reload resets everything), and any connection to Ziki or GitHub.

A single banner at the top of every page states this.

## Run locally

Requires Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev        # http://localhost:5173
npm run typecheck  # TypeScript only
npm run build      # typecheck + production build
npm run preview    # serve the build
```

## Manual test checklist

1. **Console:** two items wait on a human; the agents panel shows each agent's state; the stage strip shows counts per stage.
2. **Escalation:** open the #388 agent question. Submitting with no option shows an error; choosing "Something else" requires written guidance.
3. **Keep paused:** the banner changes, the item stays pending and the form remains.
4. **Resume:** choose an option, optionally add a note, then send. The agent resumes, the item moves to *With agents*, and within a few seconds a plan appears for approval that reflects your choice and note.
5. **Request changes:** an empty comment is rejected. After sending one, the agent revises and returns revision 2 with your feedback included.
6. **Approve:** the plan moves to Deliver, then to Prove after the agent links a pull request.
7. **Caught up:** approve #402 too. The Inbox badge disappears and both Inbox and Console show "All caught up".
8. **Issues:** statuses, stages and owners match Inbox; the #388 work log lists every step; "Open in Inbox" appears while a decision is pending.
9. **Take over:** use *Reset scenario* on #388, then *Take over*. You become the owner and Console shows the agent stopped.
10. **Activity:** filter by actor (including System) and event type; issue links open that issue.
11. **Responsive:** check desktop, tablet (1024px) and phone (390px / 320px) widths; the sidebar becomes a menu on small screens.
