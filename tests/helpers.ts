import { type Page, expect } from '@playwright/test';

export async function go(page: Page, section: string) {
  const menu = page.getByRole('button', { name: 'Open navigation' });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: new RegExp(`^${section}`) }).click();
}

export const pendingBadge = (page: Page) => page.locator('.nav-count');

/** Opens the #388 escalation and resumes the agent with the recommended option. */
export async function answerEscalation(page: Page, note = '') {
  await page.locator('.inbox-item', { hasText: 'Agent question' }).click();
  await page.getByLabel(/Require two-factor/).check();
  if (note) await page.locator('#human-response').fill(note);
  await page.getByRole('button', { name: /Send decision/ }).click();
  await expect(page.locator('.escalation-status')).toContainText('Agent resumed');
}
