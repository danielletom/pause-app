import { test, expect } from '@playwright/test';

/**
 * Frontend Rendering Smoke Tests
 *
 * These verify the Expo web build renders the key pipeline UI elements.
 * Run with: EXPO_WEB_URL=http://localhost:8081 npx playwright test tests/frontend-rendering.spec.ts
 *
 * Prerequisites:
 * 1. Start Expo web: npx expo start --web
 * 2. Set EXPO_WEB_URL env var
 */

const WEB_URL = process.env.EXPO_WEB_URL || 'http://localhost:8081';

test.describe('Frontend Smoke Tests', () => {
  test.skip(!process.env.EXPO_WEB_URL, 'Skipping: EXPO_WEB_URL not set — start Expo web first');

  test('App loads without crash', async ({ page }) => {
    await page.goto(WEB_URL);
    // Should see some content (Clerk login or app content)
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('No "pp" text appears in the app', async ({ page }) => {
    await page.goto(WEB_URL);
    await page.waitForTimeout(3000);
    const bodyText = await page.textContent('body');
    // Check that "pp" as a unit doesn't appear (but "app", "happy" etc are fine)
    // Look specifically for patterns like "35pp" or "pp." which indicate the old format
    const ppMatches = bodyText?.match(/\d+pp\b/g);
    expect(ppMatches).toBeNull();
  });
});
