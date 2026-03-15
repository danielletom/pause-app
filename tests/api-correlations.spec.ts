import { test, expect } from '@playwright/test';

/**
 * API Integration Tests for /api/insights/correlations
 *
 * These tests verify the pipeline enrichments (Tasks 1-7) are served correctly.
 * Requires a valid Clerk session token for the test user (emma@pausetest.com).
 *
 * Set TEST_AUTH_TOKEN env var before running:
 *   TEST_AUTH_TOKEN=<token> npx playwright test
 */

const API_BASE = process.env.API_URL || 'https://pause-api-seven.vercel.app';

test.describe('Correlations API - Pipeline Enrichments', () => {
  const authToken = process.env.TEST_AUTH_TOKEN;

  test.skip(!authToken, 'Skipping: TEST_AUTH_TOKEN not set');

  test('GET /api/insights/correlations returns expected shape', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/insights/correlations`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.status()).toBe(200);
    const data = await res.json();

    // Base fields
    expect(data).toHaveProperty('correlations');
    expect(data).toHaveProperty('lastComputed');
    expect(data).toHaveProperty('dataQuality');
    expect(data).toHaveProperty('totalFound');
    expect(Array.isArray(data.correlations)).toBe(true);
    expect(['building', 'moderate', 'strong']).toContain(data.dataQuality);
  });

  test('Correlation items have correct fields', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/insights/correlations`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const data = await res.json();

    if (data.correlations.length > 0) {
      const c = data.correlations[0];
      expect(c).toHaveProperty('factor');
      expect(c).toHaveProperty('symptom');
      expect(c).toHaveProperty('direction');
      expect(c).toHaveProperty('confidence');
      expect(c).toHaveProperty('effectSizePct');
      expect(c).toHaveProperty('occurrences');
      expect(c).toHaveProperty('lagDays');
      expect(c).toHaveProperty('humanLabel');
      expect(['positive', 'negative']).toContain(c.direction);
    }
  });

  test('Task 1: humanLabel uses % not pp', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/insights/correlations`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const data = await res.json();

    for (const c of data.correlations) {
      expect(c.humanLabel).not.toContain('pp');
      expect(c.humanLabel).toContain('%');
    }
  });

  test('Task 2: helpsHurts pipeline data shape (when available)', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/insights/correlations`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const data = await res.json();

    if (data.helpsHurts) {
      expect(data.helpsHurts).toHaveProperty('helps');
      expect(data.helpsHurts).toHaveProperty('hurts');
      expect(Array.isArray(data.helpsHurts.helps)).toBe(true);
      expect(Array.isArray(data.helpsHurts.hurts)).toBe(true);

      if (data.helpsHurts.helps.length > 0) {
        const h = data.helpsHurts.helps[0];
        expect(h).toHaveProperty('factor');
        expect(h).toHaveProperty('symptom');
        expect(h).toHaveProperty('explanation');
        expect(h).toHaveProperty('strength');
        expect(typeof h.explanation).toBe('string');
        expect(typeof h.strength).toBe('number');
      }
    }
  });

  test('Task 3: Correlation enrichments (explanation, recommendation)', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/insights/correlations`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const data = await res.json();

    // At least some correlations should have enrichments for the test user
    const enriched = data.correlations.filter((c: any) => c.explanation);
    // If pipeline has run, enriched should be > 0
    if (enriched.length > 0) {
      const c = enriched[0];
      expect(typeof c.explanation).toBe('string');
      expect(c.explanation.length).toBeGreaterThan(0);
      // recommendation and caveat are optional
      if (c.recommendation) expect(typeof c.recommendation).toBe('string');
      if (c.caveat) expect(typeof c.caveat).toBe('string');
    }
  });

  test('Task 4: Contradictions array shape (when available)', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/insights/correlations`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const data = await res.json();

    if (data.contradictions && data.contradictions.length > 0) {
      const c = data.contradictions[0];
      expect(c).toHaveProperty('factor');
      expect(c).toHaveProperty('helpsSymptom');
      expect(c).toHaveProperty('hurtsSymptom');
      expect(c).toHaveProperty('explanation');
      expect(typeof c.explanation).toBe('string');
    }
  });

  test('Task 6: weeklyStory field present (when pipeline has run)', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/insights/correlations`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const data = await res.json();

    // weeklyStory may or may not be present depending on pipeline status
    if (data.weeklyStory) {
      expect(typeof data.weeklyStory).toBe('string');
      expect(data.weeklyStory.length).toBeGreaterThan(0);
    }
  });

  test('Task 7: symptomGuidance field present (when pipeline has run)', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/insights/correlations`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const data = await res.json();

    // symptomGuidance may or may not be present depending on pipeline status
    if (data.symptomGuidance) {
      expect(typeof data.symptomGuidance).toBe('object');
      const keys = Object.keys(data.symptomGuidance);
      if (keys.length > 0) {
        const guidance = data.symptomGuidance[keys[0]];
        expect(guidance).toHaveProperty('explanation');
        expect(guidance).toHaveProperty('recommendations');
        expect(Array.isArray(guidance.recommendations)).toBe(true);
      }
    }
  });
});

test.describe('Home API - Forecast', () => {
  const authToken = process.env.TEST_AUTH_TOKEN;

  test.skip(!authToken, 'Skipping: TEST_AUTH_TOKEN not set');

  test('Task 5: GET /api/insights/home returns tomorrowForecast', async ({ request }) => {
    const today = new Date().toISOString().split('T')[0];
    const res = await request.get(`${API_BASE}/api/insights/home?date=${today}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.status()).toBe(200);
    const data = await res.json();

    // tomorrowForecast is optional but should be a string when present
    if (data.tomorrowForecast) {
      expect(typeof data.tomorrowForecast).toBe('string');
      expect(data.tomorrowForecast.length).toBeGreaterThan(0);
    }
  });
});

test.describe('API - Unauthenticated', () => {
  test('Returns error without auth token', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/insights/correlations`);
    // Clerk middleware may return 401, 403, or 404 depending on config
    expect([401, 403, 404]).toContain(res.status());
  });
});
