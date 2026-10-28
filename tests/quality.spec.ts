import { expect, test } from '@playwright/test';
import { go } from './helpers';

const sections = ['Console', 'Inbox', 'Issues', 'Ranking', 'Activity'];

test('no console errors or failed requests', async ({ page }) => {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => { if (['error', 'warning'].includes(message.type())) problems.push(message.text()); });
  page.on('response', (response) => { if (response.status() >= 400) problems.push(`${response.status()} ${response.url()}`); });
  await page.goto('/');
  for (const section of sections) await go(page, section);
  expect(problems).toEqual([]);
});

test('text is at least 10px with 4.5:1 contrast in every section', async ({ page }) => {
  await page.goto('/');
  for (const section of sections) {
    await go(page, section);
    const problems = await page.evaluate(() => {
      const luminance = (color: string) => {
        const [r, g, b] = color.match(/\d+(\.\d+)?/g)!.slice(0, 3).map(Number).map((c) => {
          const v = c / 255;
          return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const found: string[] = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const el = node.parentElement!;
        if (!node.textContent!.trim() || !el.getClientRects().length || el.closest('.visually-hidden')) continue;
        const style = getComputedStyle(el);
        if (parseFloat(style.fontSize) < 10) found.push(`${el.className}: ${style.fontSize}`);
        let parent: Element | null = el;
        let background = 'rgba(0, 0, 0, 0)';
        while (parent && /rgba\(0, 0, 0, 0\)|transparent/.test(background)) { background = getComputedStyle(parent).backgroundColor; parent = parent.parentElement; }
        if (background.startsWith('rgba')) continue; // translucent layer: not measurable this way
        const [a, b] = [luminance(style.color), luminance(background)];
        const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        if (ratio < 4.5) found.push(`${el.className || el.tagName} "${node.textContent!.trim().slice(0, 20)}": ${ratio.toFixed(2)}`);
      }
      return found;
    });
    expect(problems, section).toEqual([]);
  }
});

for (const [width, height] of [[1024, 768], [390, 844], [320, 640]]) {
  test(`no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    for (const section of sections) {
      await go(page, section);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, section).toBeLessThanOrEqual(0);
    }
  });
}
