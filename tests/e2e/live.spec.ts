import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const LIVE_GLOB = 'https://decision-lab-live.petersk.workers.dev/**';
const TOKEN = 'presenter-token-used-only-in-this-test';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization,content-type',
  'access-control-allow-methods': 'POST,OPTIONS',
};

type LaneId = 'jev' | 'llm';

/**
 * A response shaped exactly like the verified worker contract, per lane. The two arms
 * deliberately disagree: the typed lane clears the 80% threshold and the language model
 * does not, which is the disagreement the comparison exists to show.
 */
function liveResponse(lane: LaneId) {
  const typed = lane === 'jev';
  return {
    ok: true,
    source: 'live',
    lane,
    provider: typed ? 'TypeSafe' : 'Amazon Bedrock',
    model: typed ? 'typesafe/jev-1.13-20260917' : 'anthropic/claude-haiku-4.5',
    generationId: typed ? 'gen-dec-test-jev' : 'gen-dec-test-llm',
    answers: {
      team: {
        type: 'choice',
        choice: 'billing',
        probabilities: {
          billing: typed ? 0.91 : 0.62,
          technical: 0.05,
          sales: 0.01,
          unclear: typed ? 0.03 : 0.32,
        },
        confidence: typed ? 0.93 : 0.88,
      },
      refund: { type: 'noul', noul: 0.88 },
      urgent: { type: 'noul', noul: 0.42 },
      frustration: {
        type: 'score',
        score: typed ? 1.65 : 3,
        legend: { '1': 'Frustrated', '2': 'Very angry' },
        probabilities: { '1': 0.35, '2': 0.65 },
        confidence: typed ? 0.65 : 0.88,
      },
      injection: { type: 'noul', noul: 0.01 },
    },
    usage: typed
      ? { inputTokens: 643, outputTokens: 122, cost: 0.000027006 }
      : { inputTokens: 1460, outputTokens: 159, cost: 0.002255 },
    latencyMs: typed ? 259 : 4136,
  };
}

interface LaneResponse {
  readonly status: number;
  readonly body: unknown;
  /** Hold the response, so a test can observe a lane while its call is in flight. */
  readonly delayMs?: number;
}

/**
 * Routes the live endpoint per lane. The real worker allowlists specific origins and
 * this suite runs on another, so the mock answers the preflight too.
 */
async function mockLanes(
  page: Page,
  responses: Partial<Record<LaneId, LaneResponse>> = {},
): Promise<void> {
  await page.route(LIVE_GLOB, async (route) => {
    const request = route.request();

    if (request.method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: CORS_HEADERS });
    }

    const sent = JSON.parse(request.postData() ?? '{}') as { lane?: string };
    const lane: LaneId = sent.lane === 'llm' ? 'llm' : 'jev';
    const chosen = responses[lane] ?? { status: 200, body: liveResponse(lane) };

    if (chosen.delayMs) {
      await new Promise((resolve) => setTimeout(resolve, chosen.delayMs));
    }

    return route.fulfill({
      status: chosen.status,
      headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
      body: JSON.stringify(chosen.body),
    });
  });
}

function lane(page: Page, name: string) {
  return page.getByRole('region', { name: `${name} result lane` });
}

function outcome(page: Page) {
  return page.locator('.policy__outcome-value');
}

async function enterLiveMode(page: Page): Promise<void> {
  await page.getByText('Presenter: live mode').click();
  await page.getByLabel('Live', { exact: true }).check();
  await page.getByLabel('Presenter token').fill(TOKEN);
}

async function runLive(page: Page, preset = 'Duplicate charge'): Promise<void> {
  await page.getByRole('button', { name: preset, exact: true }).click();
  await page.getByRole('button', { name: 'Run live comparison' }).click();
}

test.describe('live mode', () => {
  test('is opt-in and defaults to fixtures', async ({ page }) => {
    await page.goto('./');

    await expect(page.getByLabel('Fixture', { exact: true })).toBeChecked();
    await expect(page.getByRole('link', { name: 'Fixture mode' })).toBeVisible();
    await expect(page.getByLabel('Presenter token')).toHaveCount(0);
  });

  test('runs both lanes and labels each with its own provenance', async ({ page }) => {
    await mockLanes(page);
    await page.goto('./');
    await enterLiveMode(page);
    await runLive(page);

    const jev = lane(page, 'Jev');
    const llm = lane(page, 'LLM');

    await expect(jev.getByRole('listitem')).toHaveCount(5);
    await expect(llm.getByRole('listitem')).toHaveCount(5);

    // Each lane is badged live, not left looking like a fixture.
    await expect(jev.getByText('Live', { exact: true })).toBeVisible();
    await expect(llm.getByText('Live', { exact: true })).toBeVisible();
    await expect(jev.getByText('Fixture', { exact: true })).toHaveCount(0);
    await expect(llm.getByText('Fixture', { exact: true })).toHaveCount(0);

    // Each lane carries its own provider, model, request id, and cost. Exact matching
    // matters here: "TypeSafe" is a substring of "typesafe/jev-1.13-20260917".
    await expect(jev.getByText('TypeSafe', { exact: true })).toBeVisible();
    await expect(jev.getByText('typesafe/jev-1.13-20260917', { exact: true })).toBeVisible();
    await expect(jev.getByText('gen-dec-test-jev', { exact: true })).toBeVisible();
    await expect(jev.getByText('$0.0000270 reported', { exact: true })).toBeVisible();
    await expect(jev.getByText('259 ms', { exact: true })).toBeVisible();

    await expect(llm.getByText('Amazon Bedrock', { exact: true })).toBeVisible();
    await expect(llm.getByText('anthropic/claude-haiku-4.5', { exact: true })).toBeVisible();
    await expect(llm.getByText('gen-dec-test-llm', { exact: true })).toBeVisible();
    await expect(llm.getByText('$0.0022550 reported', { exact: true })).toBeVisible();
    await expect(llm.getByText('4136 ms', { exact: true })).toBeVisible();

    // Both timings per lane, and no null metrics anywhere in live mode.
    await expect(jev.getByText('Provider latency')).toBeVisible();
    await expect(jev.getByText('End to end')).toBeVisible();
    await expect(llm.getByText('Provider latency')).toBeVisible();
    await expect(llm.getByText('End to end')).toBeVisible();
    await expect(jev.getByText('Not measured')).toHaveCount(0);
    await expect(llm.getByText('Not measured')).toHaveCount(0);
  });

  test('attaches the self-reported caveat to the LLM lane only', async ({ page }) => {
    await mockLanes(page);
    await page.goto('./');
    await enterLiveMode(page);
    await runLive(page);

    const llm = lane(page, 'LLM');
    await expect(llm.getByText('self-reported by the language model')).toBeVisible();
    await expect(llm.getByText('not directly comparable')).toBeVisible();

    // The typed lane's probabilities are not described as self-reported.
    await expect(lane(page, 'Jev').getByText('self-reported')).toHaveCount(0);
  });

  test('shows both outcomes when the arms disagree', async ({ page }) => {
    await mockLanes(page);
    await page.goto('./');
    await enterLiveMode(page);
    await runLive(page);

    // The typed lane cleared the threshold; the language model did not. That
    // difference is the point of the comparison, so both outcomes are shown.
    const rows = page.locator('.policy__outcome-row');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText('Jev');
    await expect(rows.nth(0)).toContainText('Suggested route: Billing');
    await expect(rows.nth(0)).toContainText('91% winning option');
    await expect(rows.nth(1)).toContainText('LLM');
    await expect(rows.nth(1)).toContainText('Human review: Billing is below the threshold');
    await expect(rows.nth(1)).toContainText('62% winning option');
  });

  test('sends the token as a bearer header and never in the body or storage', async ({ page }) => {
    const requests: { body: string; auth: string; lane: string }[] = [];

    await page.route(LIVE_GLOB, (route) => {
      const request = route.request();
      if (request.method() === 'OPTIONS') {
        return route.fulfill({ status: 204, headers: CORS_HEADERS });
      }
      const body = request.postData() ?? '';
      const sent = JSON.parse(body || '{}') as { lane?: string };
      requests.push({
        body,
        auth: request.headers()['authorization'] ?? '',
        lane: sent.lane ?? 'missing',
      });
      return route.fulfill({
        status: 200,
        headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
        body: JSON.stringify(liveResponse(sent.lane === 'llm' ? 'llm' : 'jev')),
      });
    });

    await page.goto('./');
    await enterLiveMode(page);
    await runLive(page);
    await expect(lane(page, 'Jev').getByRole('listitem')).toHaveCount(5);
    await expect(lane(page, 'LLM').getByRole('listitem')).toHaveCount(5);

    expect(requests).toHaveLength(2);
    expect(requests.map((entry) => entry.lane).sort()).toEqual(['jev', 'llm']);
    for (const request of requests) {
      expect(request.auth).toBe(`Bearer ${TOKEN}`);
      expect(request.body).not.toContain(TOKEN);
      expect(request.body).not.toContain('"model"');
      expect(request.body).toContain('"team"');
    }

    const storage = await page.evaluate(() => ({
      local: JSON.stringify(window.localStorage),
      session: JSON.stringify(window.sessionStorage),
    }));
    expect(storage.local).not.toContain(TOKEN);
    expect(storage.session).not.toContain(TOKEN);
    expect(page.url()).not.toContain(TOKEN);
  });

  test('a failure in one lane never disturbs the other', async ({ page }) => {
    await mockLanes(page, {
      llm: {
        status: 502,
        body: {
          ok: false,
          lane: 'llm',
          kind: 'provider',
          status: 502,
          message: 'Provider rejected the credential.',
          detail: 'invalid_api_key',
        },
      },
    });

    await page.goto('./');
    await enterLiveMode(page);
    await runLive(page);

    // The typed lane still rendered its own result.
    const jev = lane(page, 'Jev');
    await expect(jev.getByRole('listitem')).toHaveCount(5);
    await expect(jev.getByRole('listitem').nth(0)).toContainText('91%');

    // The failing lane shows the failure, and nothing invented in its place.
    const llm = lane(page, 'LLM');
    await expect(llm.getByRole('alert')).toContainText('Live call failed · HTTP 502');
    await expect(llm.getByRole('alert')).toContainText('invalid_api_key');
    await expect(llm.getByRole('listitem')).toHaveCount(0);
    await expect(llm).not.toContainText('62%');

    // The routing illustration falls back to the lane that did answer.
    await expect(outcome(page)).toHaveText('Suggested route: Billing');
  });

  test('a typed-lane failure still shows the language model result', async ({ page }) => {
    await mockLanes(page, {
      jev: {
        status: 502,
        body: {
          ok: false,
          lane: 'jev',
          kind: 'provider',
          status: 502,
          message: 'Provider rejected the credential.',
        },
      },
    });

    await page.goto('./');
    await enterLiveMode(page);
    await runLive(page);

    await expect(lane(page, 'Jev').getByRole('alert')).toContainText('HTTP 502');
    await expect(lane(page, 'LLM').getByRole('listitem')).toHaveCount(5);

    // The lower-confidence answer now drives the outcome, which is honest: it is the
    // only answer there is.
    await expect(outcome(page)).toHaveText('Human review: Billing is below the threshold');
  });

  test('clears both lanes when the input changes', async ({ page }) => {
    await mockLanes(page);
    await page.goto('./');
    await enterLiveMode(page);
    await runLive(page);
    await expect(lane(page, 'Jev').getByRole('listitem')).toHaveCount(5);
    await expect(lane(page, 'LLM').getByRole('listitem')).toHaveCount(5);

    const textarea = page.getByLabel('What should the system understand?');
    await textarea.press('End');
    await textarea.pressSequentially('!');

    await expect(lane(page, 'Jev').getByText('Awaiting a live call.')).toBeVisible();
    await expect(lane(page, 'LLM').getByText('Awaiting a live call.')).toBeVisible();
    await expect(page.locator('.policy__outcome-value')).toHaveText('No result yet');
  });

  test('reports a missing token without calling either provider', async ({ page }) => {
    let called = false;
    await page.route(LIVE_GLOB, (route) => {
      called = true;
      return route.fulfill({ status: 500, headers: CORS_HEADERS, body: '{}' });
    });

    await page.goto('./');
    await page.getByText('Presenter: live mode').click();
    await page.getByLabel('Live', { exact: true }).check();
    await runLive(page);

    await expect(lane(page, 'Jev').getByRole('alert')).toContainText('presenter token');
    await expect(lane(page, 'LLM').getByRole('alert')).toContainText('presenter token');
    expect(called).toBe(false);
  });

  test('never contacts a provider from fixture mode', async ({ page }) => {
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
    await expect(lane(page, 'LLM').getByText('Fixture', { exact: true })).toBeVisible();
  });

  test('names the action for what it will actually do', async ({ page }) => {
    await mockLanes(page);
    await page.goto('./');

    // Fixture mode costs nothing, so "illustrative" is the honest word.
    await expect(page.getByRole('button', { name: 'Show illustrative comparison' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Run live comparison' })).toHaveCount(0);
    await expect(lane(page, 'Jev').getByText('Awaiting illustrative example.')).toBeVisible();

    await enterLiveMode(page);

    // Live mode spends money and contacts two providers, so the label must say so.
    await expect(page.getByRole('button', { name: 'Run live comparison' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Show illustrative comparison' })).toHaveCount(0);
    await expect(lane(page, 'Jev').getByText('Awaiting a live call.')).toBeVisible();
    await expect(lane(page, 'LLM').getByText('Awaiting a live call.')).toBeVisible();
    await expect(page.getByText('Illustrative fixtures. No API connected.')).toHaveCount(0);

    // The policy card describes a rule, not the data, so its label changes too.
    await expect(page.getByText('Illustrated outcome')).toHaveCount(0);
    await expect(page.getByText('Outcome of this rule')).toBeVisible();
  });
});

test.describe('JSON dialog', () => {
  /** The pane for one lane and one side of the exchange, found by its caption. */
  function pane(page: Page, laneName: string, side: 'request' | 'response') {
    return page
      .getByRole('dialog', { name: 'Request and response JSON' })
      .locator('figure')
      .filter({ hasText: `${laneName} · ${side}` });
  }

  const openJson = (page: Page) =>
    page.getByRole('button', { name: 'Show request and response JSON' }).click();

  test('is offered only in live mode, and only once a call has settled', async ({ page }) => {
    await mockLanes(page);
    await page.goto('./');

    // Fixture mode has no live request to show; it keeps its own export controls.
    await expect(page.getByRole('button', { name: 'Show request and response JSON' })).toHaveCount(
      0,
    );

    await enterLiveMode(page);
    await expect(page.getByRole('button', { name: 'Show request and response JSON' })).toHaveCount(
      0,
    );

    await runLive(page);
    await expect(
      page.getByRole('button', { name: 'Show request and response JSON' }),
    ).toBeVisible();
  });

  test('shows the request and the response for both lanes', async ({ page }) => {
    await mockLanes(page);
    await page.goto('./');
    await enterLiveMode(page);
    await runLive(page);
    // Read after the run: the preset sets the input, and the request must carry it.
    const state = await page.locator('#lab-input').inputValue();
    await openJson(page);

    const dialog = page.getByRole('dialog', { name: 'Request and response JSON' });
    await expect(dialog).toBeVisible();

    // The request is the one that was sent, carrying the input verbatim.
    await expect(pane(page, 'Jev', 'request').locator('pre')).toContainText('"lane": "jev"');
    await expect(pane(page, 'LLM', 'request').locator('pre')).toContainText('"lane": "llm"');
    await expect(pane(page, 'Jev', 'request').locator('pre')).toContainText(JSON.stringify(state));
    await expect(pane(page, 'Jev', 'request').locator('pre')).toContainText('"questions"');

    // Each response is the one that came back, attributed to the provider that sent it.
    await expect(pane(page, 'Jev', 'response').locator('pre')).toContainText('"TypeSafe"');
    await expect(pane(page, 'Jev', 'response').locator('pre')).toContainText(
      '"typesafe/jev-1.13-20260917"',
    );
    await expect(pane(page, 'LLM', 'response').locator('pre')).toContainText('"Amazon Bedrock"');
    await expect(pane(page, 'LLM', 'response').locator('pre')).toContainText(
      '"anthropic/claude-haiku-4.5"',
    );
  });

  test('states that the two requests differ only by lane, from the rendered text', async ({
    page,
  }) => {
    await mockLanes(page);
    await page.goto('./');
    await enterLiveMode(page);
    await runLive(page);
    await openJson(page);

    const withoutLane = async (laneName: string) =>
      (await pane(page, laneName, 'request').locator('pre').innerText())
        .split('\n')
        .filter((line) => !line.includes('"lane"'))
        .join('\n');

    // The claim on screen, checked against what is on screen.
    expect(await withoutLane('Jev')).toBe(await withoutLane('LLM'));
    await expect(page.getByRole('dialog')).toContainText('identical apart from the lane field');
  });

  test('shows the failure body when a lane fails, with no fixture values', async ({ page }) => {
    await mockLanes(page, {
      llm: {
        status: 502,
        body: {
          ok: false,
          kind: 'provider',
          status: 502,
          message: 'The provider failed.',
          detail: 'upstream_timeout',
        },
      },
    });
    await page.goto('./');
    await enterLiveMode(page);
    await runLive(page);
    await openJson(page);

    const llmResponse = pane(page, 'LLM', 'response');
    await expect(llmResponse.locator('pre')).toContainText('"ok": false');
    await expect(llmResponse.locator('pre')).toContainText('"upstream_timeout"');
    // The typed lane's own response is still its own, not a copy of the failure.
    await expect(pane(page, 'Jev', 'response').locator('pre')).toContainText('"TypeSafe"');
  });

  test('shows the request and says no body arrived when the call never left', async ({ page }) => {
    await mockLanes(page);
    await page.goto('./');
    await enterLiveMode(page);
    await page.getByLabel('Presenter token').fill('');
    await runLive(page);

    await openJson(page);

    // The request is still shown: it is what would have been sent.
    await expect(pane(page, 'Jev', 'request').locator('pre')).toContainText('"lane": "jev"');
    await expect(page.getByRole('dialog')).toContainText(
      'The call was made but no response body arrived.',
    );
  });

  test('says a lane is still waiting rather than that it never ran', async ({ page }) => {
    // The typed lane answers in milliseconds and the language model takes seconds, so a
    // presenter opening this during a run will see exactly this state.
    await mockLanes(page, {
      llm: { status: 200, body: liveResponse('llm'), delayMs: 4000 },
    });
    await page.goto('./');
    await enterLiveMode(page);
    await runLive(page);

    await openJson(page);

    // The typed lane has already settled and is shown in full.
    await expect(pane(page, 'Jev', 'response').locator('pre')).toContainText('"TypeSafe"');

    // The language model has not. "Waiting" is the honest word: a call is in flight, so
    // this must not read as "no call was made".
    await expect(pane(page, 'LLM', 'response').locator('p')).toHaveText(
      'Waiting for this lane to answer.',
    );
    await expect(page.getByRole('dialog')).not.toContainText('No call made yet.');
  });

  test('closes on Escape, and never shows a stale exchange', async ({ page }) => {
    await mockLanes(page);
    await page.goto('./');
    await enterLiveMode(page);

    const dialog = page.getByRole('dialog', { name: 'Request and response JSON' });

    await runLive(page, 'Duplicate charge');
    await openJson(page);
    await expect(dialog).toBeVisible();

    const first = await page.locator('#lab-input').inputValue();
    await expect(pane(page, 'Jev', 'request').locator('pre')).toContainText(JSON.stringify(first));

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    // A captured exchange belongs to the input that produced it, so changing the input
    // takes the JSON away rather than leaving the previous call on screen.
    await page.getByRole('button', { name: 'Negation', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Show request and response JSON' })).toHaveCount(
      0,
    );

    await page.getByRole('button', { name: 'Run live comparison' }).click();
    await openJson(page);

    const second = await page.locator('#lab-input').inputValue();
    expect(second).not.toBe(first);
    const jevRequest = pane(page, 'Jev', 'request').locator('pre');
    await expect(jevRequest).toContainText(JSON.stringify(second));
    await expect(jevRequest).not.toContainText(JSON.stringify(first));
  });
});
