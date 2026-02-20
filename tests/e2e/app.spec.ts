import { test, expect, Page } from '@playwright/test';

const attachRuntimeErrorTracker = (page: Page) => {
  const errors: string[] = [];

  page.on('pageerror', (error) => {
    errors.push(`pageerror: ${error.message}`);
  });

  page.on('console', (message) => {
    if (message.type() !== 'error') {
      return;
    }
    const text = message.text();
    if (/favicon|source map|ERR_SOCKET_NOT_CONNECTED/i.test(text)) {
      return;
    }
    errors.push(`console: ${text}`);
  });

  return errors;
};

const expectNoRuntimeErrors = async (page: Page, errors: string[]) => {
  await page.waitForTimeout(300);
  expect(errors, 'Expected no browser console/page errors during scenario').toEqual([]);
};

test('executive dashboard loads', async ({ page }) => {
  const runtimeErrors = attachRuntimeErrorTracker(page);
  await page.goto('./#/');
  await expect(page.getByTestId('duckdb-status')).toHaveText(/Operational|Preparing analysis|Ready|loading/i, {
    timeout: 120000
  });
  await expect(page.getByTestId('chart-revenue').locator('canvas')).toBeVisible({ timeout: 120000 });
  await expectNoRuntimeErrors(page, runtimeErrors);
});

test('insights page loads', async ({ page }) => {
  const runtimeErrors = attachRuntimeErrorTracker(page);
  await page.goto('./#/insights');
  await expect(page.getByTestId('duckdb-status')).toHaveText(/Operational|Preparing analysis|Ready|loading/i, {
    timeout: 120000
  });
  await expect(page.getByTestId('chart-cohort').locator('canvas')).toBeVisible({ timeout: 120000 });
  await expectNoRuntimeErrors(page, runtimeErrors);
});

test('sql studio runs a query', async ({ page }) => {
  const runtimeErrors = attachRuntimeErrorTracker(page);
  await page.goto('./#/sql-studio');
  await page.getByRole('button', { name: /Run analysis|Run query/i }).click();
  await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 120000 });
  await expectNoRuntimeErrors(page, runtimeErrors);
});
