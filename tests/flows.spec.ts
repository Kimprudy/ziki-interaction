import { expect, test } from '@playwright/test';
import { answerEscalation, go, pendingBadge } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('starts with three items waiting on a human', async ({ page }) => {
  await expect(page.locator('.metric-grid')).toContainText('Needs your decision3');
  await expect(page.locator('.attention-item')).toHaveCount(3);
  await expect(page.getByRole('heading', { name: 'See how a person and an agent work together' })).toBeVisible();
  await page.getByRole('button', { name: 'Start: answer the agent →' }).click();
  await expect(page.locator('.escalation-status')).toContainText('waiting for your decision');
});

test('decision form validates input and can keep the agent paused', async ({ page }) => {
  await go(page, 'Inbox');
  await page.getByRole('button', { name: /Send decision/ }).click();
  await expect(page.locator('#response-error')).toContainText('Choose one of the options');
  await page.getByLabel(/Something else/).check();
  await page.getByRole('button', { name: /Send decision/ }).click();
  await expect(page.locator('#response-error')).toContainText('Write the guidance');

  await page.getByRole('button', { name: 'Keep paused' }).click();
  await expect(page.locator('.escalation-status')).toContainText('Kept paused');
  await expect(pendingBadge(page)).toHaveText('3');
  await expect(page.locator('.decision-options')).toBeVisible();
});

test('full loop: decision → plan → changes → approve → test → send back → merge', async ({ page }) => {
  await go(page, 'Inbox');
  await answerEscalation(page, 'Also cover passkey accounts.');
  await expect(page.locator('.inbox-list-panel')).toContainText('Agent drafting');

  // The agent returns a plan built from the decision and the note.
  await page.getByRole('button', { name: 'Review the agent’s plan →' }).click();
  await expect(page.locator('.proposal-card')).toContainText('Require two-factor after Google sign-in');
  await expect(page.locator('.proposal-card')).toContainText('passkey');

  // Request changes: a comment is required, then the agent revises.
  await page.getByRole('button', { name: 'Request changes' }).click();
  await page.getByRole('button', { name: 'Send feedback to agent' }).click();
  await expect(page.locator('#plan-feedback-error')).toBeVisible();
  await page.locator('#plan-feedback').fill('Add a rollout flag');
  await page.getByRole('button', { name: 'Send feedback to agent' }).click();
  await expect(page.locator('.approval-state')).toContainText('agent revising');
  await expect(page.locator('.approval-state')).toContainText('Revision 2 needs your approval');
  await expect(page.locator('.proposal-card')).toContainText('Add a rollout flag');

  // Approve: the agent delivers, an independent tester verifies, then the merge comes back to the human.
  await page.getByRole('button', { name: 'Approve plan' }).click();
  await expect(page.locator('.agent-progress')).toContainText('You approve the merge');
  await page.getByRole('button', { name: 'Review the merge →' }).click({ timeout: 12_000 });
  await expect(page.locator('.approval-state')).toContainText('Tests passed · ready to merge');

  // Send back once, then merge.
  await page.getByRole('button', { name: 'Send back' }).click();
  await page.locator('#merge-feedback').fill('Log when the 2FA challenge is shown');
  await page.getByRole('button', { name: 'Send back to agent' }).click();
  await expect(page.locator('.approval-state')).toContainText('Sent back');
  await expect(page.locator('.approval-state')).toContainText('Tests passed · ready to merge', { timeout: 12_000 });
  await page.getByRole('button', { name: 'Approve & merge' }).click();
  await expect(page.locator('.approval-state')).toContainText('Merged · issue closed');

  // Every section reflects the outcome.
  await go(page, 'Issues');
  const row = page.locator('.issue-table tbody tr', { hasText: '#388' });
  await expect(row).toContainText('Merged');
  await expect(page.getByRole('list', { name: 'Lifecycle: complete' })).toBeVisible();
  await expect(page.locator('.issue-history-step')).toContainText(['Ziki Tester']);

  await go(page, 'Activity');
  await page.getByLabel('Actor').selectOption('Agent');
  await expect(page.locator('.activity-entry').first()).toBeVisible();
  await expect(page.locator('.activity-list')).toContainText('submitted revision 2');
  await expect(page.locator('.activity-list')).toContainText('Ziki Tester');

  await go(page, 'Console');
  await expect(page.getByRole('heading', { name: 'Walkthrough complete' })).toBeVisible();
});

test('take over stops the agent and makes you the owner', async ({ page }) => {
  await go(page, 'Inbox');
  await page.getByRole('button', { name: 'Take over' }).click();
  await expect(page.locator('.assignment-row')).toContainText('Jordan D. (you)');
  await go(page, 'Console');
  await expect(page.locator('.console-grid')).toContainText('Stopped · you took over');
  await expect(page.locator('.walkthrough')).toContainText('Reset the scenario');
  await page.getByRole('button', { name: 'Reset #388' }).click();
  await expect(page.locator('.walkthrough')).toContainText('An agent is waiting');
});

test('report review: confirming starts agent work; rejecting closes it', async ({ page }) => {
  await go(page, 'Inbox');
  await page.locator('.inbox-item', { hasText: 'Report review' }).click();
  await expect(page.locator('.approval-state')).toContainText('Second review needed');
  await page.getByRole('button', { name: 'Confirm report' }).click();
  await expect(page.locator('.approval-state')).toContainText('Report confirmed');
  await page.getByRole('button', { name: 'View the agent’s plan →' }).click();
  await expect(page.locator('.proposal-card')).toContainText('Add an empty state to Saved items');

  await page.locator('.inbox-item', { hasText: 'Report review' }).click();
  await page.getByRole('button', { name: 'Reset scenario' }).click();
  await page.getByRole('button', { name: 'Can’t confirm' }).click();
  await page.getByRole('button', { name: 'Close report' }).click();
  await expect(page.locator('#report-reason-error')).toBeVisible();
  await page.locator('#report-reason').fill('Could not reproduce with a new account');
  await page.getByRole('button', { name: 'Close report' }).click();
  await expect(page.locator('.approval-state')).toContainText('Closed · not confirmed');
  await go(page, 'Issues');
  await expect(page.locator('.issue-table tbody tr', { hasText: '#405' })).toContainText('Closed · not confirmed');
});

test('a notification appears when the agent finishes while you are elsewhere', async ({ page }) => {
  await go(page, 'Inbox');
  await answerEscalation(page);
  await go(page, 'Issues');
  const toast = page.locator('.toast', { hasText: 'Ziki Reviewer sent a plan' });
  await expect(toast).toBeVisible();
  await toast.getByRole('button', { name: 'Review →' }).click();
  await expect(page.locator('.approval-state')).toContainText('Plan needs your approval');
  await expect(page.locator('.toast')).toHaveCount(0);
});

test('progress survives a reload, including agent work in progress', async ({ page }) => {
  await go(page, 'Inbox');
  await answerEscalation(page);
  await page.reload();
  // Still on Inbox, decision kept, and the agent carries on drafting after the reload.
  await expect(page.locator('.topbar-breadcrumb')).toContainText('Inbox');
  await expect(page.locator('.inbox-list-panel')).toContainText('Answered');
  await expect(page.locator('.inbox-list-panel')).toContainText('Approval needed');

  await page.getByRole('button', { name: 'Reset demo' }).click();
  await expect(page.locator('.topbar-breadcrumb')).toContainText('Console');
  await expect(page.locator('.metric-grid')).toContainText('Needs your decision3');
  await page.reload();
  await expect(page.locator('.metric-grid')).toContainText('Needs your decision3');
});

test('filters and cross-links connect Console, Issues and Activity', async ({ page }) => {
  await page.locator('.stage-cell', { hasText: 'Confirm' }).click();
  await expect(page.locator('.issue-table tbody tr')).toHaveCount(1);
  await go(page, 'Console');
  await go(page, 'Issues');
  await expect(page.getByLabel('Stage')).toHaveValue('Confirm');
  await page.getByRole('button', { name: 'Open in Inbox →' }).click();
  await expect(page.locator('.approval-state')).toContainText('Second review needed');

  await go(page, 'Activity');
  await page.getByLabel('Actor').selectOption('System');
  await expect(page.locator('.activity-entry')).not.toHaveCount(0);
  await page.getByLabel('Actor').selectOption('All actors');
  await page.locator('.activity-issue-link', { hasText: '#400' }).first().click();
  await expect(page.locator('.issue-inspector')).toContainText('#400');
});
