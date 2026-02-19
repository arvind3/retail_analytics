import { test, expect } from '@playwright/test';

test('executive dashboard loads', async ({ page }) => {
  await page.goto('./#/');
  await expect(page.getByTestId('duckdb-status')).toHaveText(/Ready|loading/i, { timeout: 120000 });
  await expect(page.getByTestId('chart-revenue').locator('canvas')).toBeVisible({ timeout: 120000 });
});

test('insights page loads', async ({ page }) => {
  await page.goto('./#/insights');
  await expect(page.getByTestId('duckdb-status')).toHaveText(/Ready|loading/i, { timeout: 120000 });
  await expect(page.getByTestId('chart-cohort').locator('canvas')).toBeVisible({ timeout: 120000 });
});

test('sql studio runs a query', async ({ page }) => {
  await page.goto('./#/sql-studio');
  await page.getByRole('button', { name: 'Run query' }).click();
  await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 120000 });
});
