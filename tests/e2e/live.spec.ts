import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const LIVE_GLOB = 'https://decision-lab-live.petersk.workers.dev/**';
const TOKEN = 'presenter-token-used-only-in-this-test';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization,content-type',
  'access-control-allow-methods': 'POST,OPTIONS',
};

/** A support-triage response shaped exactly like the verified worker contract. */
const SUPPORT_RESPONSE = {
  ok: true,
  source: 'live',
  provider: 'TypeSafe',
  model: 'typesafe/jev-1.13-20260917',
  generationId: 'gen-dec-test-0001',
  answers: {
    team: {
      type: 'choice',
      choice: 'billing',
      probabilities: { billing: 0.91, technical: 0.05, sales: 0.01, unclear: 0.03 },
      confidence: 0.93,
    },
    refund: { type: 'noul', noul: 0.88 },
    urgent: { type: 'noul', noul: 0.42 },
    frustration: {
      type: 'score',
      score: 1.65,
      legend: { '1': 'Frustrated', '2': 'Very angry' },
      probabilities: { '1': 0.35, '2': 0.65 },
      confidence: 0.65,
    },
    injection: { type: 'noul', noul: 0.01 },
  },
  usage: { inputTokens: 643, outputTokens: 122, cost: 0.000027006 },
  latencyMs: 259,
};

/**
 * The real worker allowlists specific origins, and this suite runs on a different one,
 * so the mock answers the preflight too. Without the CORS headers the browser would
 * reject the response before the app ever saw it.
 */
async function mockLive(page: Page, status: number, body: unknown): Promise<void> {
  await page.route(LIVE_GLOB, (route) => {
    if (route.request().method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: CORS_HEADERS });
    }
    return route.fulfill({
      status,
      headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  });
}

function lane(page: Page, name: string) {
  return page.getByRole('region', { name: `${name} result lane` });
}

async function enterLiveMode(page: Page): Promise<void> {
  await page.getByText('Presenter: live mode').click();
  await page.getByLabel('Live', { exact: true }).check();
  await page.getByLabel('Presenter token').fill(TOKEN);
}

test.describe('live mode', () => {
  test('is opt-in and defaults to fixtures', async ({ page }) => {
    await page.goto('./');

    await expect(page.getByLabel('Fixture', { exact: true })).toBeChecked();
    await expect(page.getByRole('link', { name: 'Fixture mode' })).toBeVisible();
    await expect(page.getByLabel('Presenter token')).toHaveCount(0);
  });

  test('renders a live result with its provenance', async ({ page }) => {
    await mockLive(page, 200, SUPPORT_RESPONSE);

    await page.goto('./');
    await enterLiveMode(page);

    await page.getByRole('button', { name: 'Duplicate charge', exact: true }).click();
    await page.getByRole('button', { name: 'Run live comparison' }).click();

    const jev = lane(page, 'Jev');
    await expect(jev.getByRole('listitem')).toHaveCount(5);
    await expect(jev.getByText('Live', { exact: true })).toBeVisible();
    await expect(jev.getByRole('listitem').nth(0)).toContainText('Billing');
    await expect(jev.getByRole('listitem').nth(0)).toContainText('91%');
    await expect(jev.getByRole('listitem').nth(1)).toContainText('88%');

    // A continuous score stays continuous, and the nearest level is named.
    await expect(jev.getByRole('listitem').nth(3)).toContainText('1.65 / 2');
    await expect(jev.getByRole('listitem').nth(3)).toContainText('Nearest level 2: Very angry');

    // Provenance, not just an answer. Two timings, because they measure different things.
    await expect(jev.getByText('Provider latency')).toBeVisible();
    await expect(jev.getByText('259 ms')).toBeVisible();
    await expect(jev.getByText('End to end')).toBeVisible();
    await expect(jev.getByText('typesafe/jev-1.13-20260917')).toBeVisible();
    await expect(jev.getByText('gen-dec-test-0001')).toBeVisible();
    await expect(jev.getByText('$0.0000270 reported')).toBeVisible();
    await expect(jev.getByText('643 in / 122 out')).toBeVisible();
    await expect(jev.getByText('Not measured')).toHaveCount(0);

    // The LLM lane says plainly that it has no live adapter.
    await expect(lane(page, 'LLM').getByText('No live adapter for this lane.')).toBeVisible();
  });

  test('sends the token as a bearer header and never in the body or storage', async ({ page }) => {
    let capturedBody = '';
    let capturedAuth = '';

    await page.route(LIVE_GLOB, (route) => {
      if (route.request().method() === 'OPTIONS') {
        return route.fulfill({ status: 204, headers: CORS_HEADERS });
      }
      capturedBody = route.request().postData() ?? '';
      capturedAuth = route.request().headers()['authorization'] ?? '';
      return route.fulfill({
        status: 200,
        headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
        body: JSON.stringify(SUPPORT_RESPONSE),
      });
    });

    await page.goto('./');
    await enterLiveMode(page);
    await page.getByRole('button', { name: 'Duplicate charge', exact: true }).click();
    await page.getByRole('button', { name: 'Run live comparison' }).click();
    await expect(lane(page, 'Jev').getByRole('listitem')).toHaveCount(5);

    expect(capturedAuth).toBe(`Bearer ${TOKEN}`);
    expect(capturedBody).not.toContain(TOKEN);
    expect(capturedBody).not.toContain('"model"');
    expect(capturedBody).toContain('"team"');

    const storage = await page.evaluate(() => ({
      local: JSON.stringify(window.localStorage),
      session: JSON.stringify(window.sessionStorage),
    }));
    expect(storage.local).not.toContain(TOKEN);
    expect(storage.session).not.toContain(TOKEN);
    expect(page.url()).not.toContain(TOKEN);
  });

  test('shows the failure and never falls back to fixture values', async ({ page }) => {
    await mockLive(page, 502, {
      ok: false,
      kind: 'auth',
      status: 502,
      message: 'Provider rejected the credential.',
      detail: 'invalid_api_key',
    });

    await page.goto('./');
    await enterLiveMode(page);
    await page.getByRole('button', { name: 'Duplicate charge', exact: true }).click();
    await page.getByRole('button', { name: 'Run live comparison' }).click();

    const jev = lane(page, 'Jev');
    await expect(jev.getByRole('alert')).toContainText('Live call failed · HTTP 502');
    await expect(jev.getByRole('alert')).toContainText('Provider rejected the credential.');
    await expect(jev.getByRole('alert')).toContainText('invalid_api_key');

    // The authored fixture for this preset would show 84% Billing and 93% refund.
    await expect(jev.getByRole('listitem')).toHaveCount(0);
    await expect(jev).not.toContainText('84%');
    await expect(jev).not.toContainText('93%');
    await expect(jev.getByText('Not measured')).toHaveCount(2);
  });

  test('clears a live result when the input changes', async ({ page }) => {
    await mockLive(page, 200, SUPPORT_RESPONSE);

    await page.goto('./');
    await enterLiveMode(page);
    await page.getByRole('button', { name: 'Duplicate charge', exact: true }).click();
    await page.getByRole('button', { name: 'Run live comparison' }).click();
    await expect(lane(page, 'Jev').getByRole('listitem')).toHaveCount(5);

    const textarea = page.getByLabel('What should the system understand?');
    await textarea.press('End');
    await textarea.pressSequentially('!');

    await expect(lane(page, 'Jev').getByText('Awaiting a live call.')).toBeVisible();
    await expect(lane(page, 'Jev')).not.toContainText('91%');
  });

  test('reports a missing token without calling the provider', async ({ page }) => {
    let called = false;
    await page.route(LIVE_GLOB, (route) => {
      called = true;
      return route.fulfill({ status: 500, headers: CORS_HEADERS, body: '{}' });
    });

    await page.goto('./');
    await page.getByText('Presenter: live mode').click();
    await page.getByLabel('Live', { exact: true }).check();
    await page.getByRole('button', { name: 'Duplicate charge', exact: true }).click();
    await page.getByRole('button', { name: 'Run live comparison' }).click();

    await expect(lane(page, 'Jev').getByRole('alert')).toContainText('presenter token');
    expect(called).toBe(false);
  });

  test('never contacts the provider from fixture mode', async ({ page }) => {
    let called = false;
    await page.route(LIVE_GLOB, (route) => {
      called = true;
      return route.fulfill({ status: 500, headers: CORS_HEADERS, body: '{}' });
    });

    await page.goto('./');
    await page.getByRole('button', { name: 'Duplicate charge', exact: true }).click();
    await page.getByRole('button', { name: 'Show illustrative comparison' }).click();
    await expect(lane(page, 'Jev').getByRole('listitem')).toHaveCount(5);

    expect(called).toBe(false);
    await expect(lane(page, 'Jev').getByText('Fixture', { exact: true })).toBeVisible();
  });

  test('names the action for what it will actually do', async ({ page }) => {
    await mockLive(page, 200, SUPPORT_RESPONSE);
    await page.goto('./');

    // Fixture mode costs nothing, so "illustrative" is the honest word.
    await expect(page.getByRole('button', { name: 'Show illustrative comparison' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Run live comparison' })).toHaveCount(0);
    await expect(lane(page, 'Jev').getByText('Awaiting illustrative example.')).toBeVisible();

    await enterLiveMode(page);

    // Live mode spends money and contacts a provider, so the label must say so.
    await expect(page.getByRole('button', { name: 'Run live comparison' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Show illustrative comparison' })).toHaveCount(0);
    await expect(lane(page, 'Jev').getByText('Awaiting a live call.')).toBeVisible();
    await expect(page.getByText('Illustrative fixtures. No API connected.')).toHaveCount(0);

    // The policy card describes a rule, not the data, so its label changes too.
    await expect(page.getByText('Illustrated outcome')).toHaveCount(0);
    await expect(page.getByText('Outcome of this rule')).toBeVisible();
  });
});
