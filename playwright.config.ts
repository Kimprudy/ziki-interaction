import { defineConfig, devices } from '@playwright/test';

const ci = Boolean(process.env.CI);

export default defineConfig({
  testDir: 'tests',
  timeout: 60_000,
  // Simulated agent steps take a few seconds each.
  expect: { timeout: 8_000 },
  fullyParallel: true,
  retries: ci ? 1 : 0,
  reporter: ci ? [['github'], ['list']] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
  },
  projects: [{
    name: 'chrome',
    // Locally, use the installed Google Chrome so no browser download is needed.
    use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, ...(ci ? {} : { channel: 'chrome' }) },
  }],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !ci,
    timeout: 120_000,
  },
});
