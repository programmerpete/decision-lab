import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const CATALOGUE = [
  {
    tab: 'Support triage',
    heading: 'Read the intent. Route the work.',
    presets: ['Duplicate charge', 'Negation', 'Ambiguous', 'Injected instruction'],
  },
  {
    tab: 'Code review',
    heading: 'Triage the risk. Keep the reviewer.',
    presets: ['Removed authorisation', 'Raw token logging', 'Safe lookalike'],
  },
  {
    tab: 'Moderation & PII',
    heading: 'Flag the harm. Protect the person.',
    presets: [
      'Scam warning',
      'Credential scam',
      'Synthetic personal details',
      'Obfuscated address',
    ],
  },
  {
    tab: 'Tool selection',
    heading: 'Choose the tool. Run nothing.',
    presets: ['Search documentation', 'Missing order number', 'Unsupported action'],
  },
] as const;

const TOTAL_PRESETS = CATALOGUE.reduce((sum, entry) => sum + entry.presets.length, 0);

function lane(page: Page, name: string) {
  return page.getByRole('region', { name: `${name} result lane` });
}

/** The visible routing outcome. Scoped, because the status region repeats it aloud. */
function outcome(page: Page) {
  return page.locator('.policy__outcome-value');
}

async function runPreset(page: Page, tab: string, preset: string): Promise<void> {
  await page.getByRole('tab', { name: new RegExp(tab) }).click();
  await page.getByRole('button', { name: preset, exact: true }).click();
  await page.getByRole('button', { name: 'Show illustrative comparison' }).click();
}

test.describe('the lab shell', () => {
  test('presents the field guide and two empty lanes', async ({ page }) => {
    await page.goto('./');

    await expect(page).toHaveTitle(/Decision Lab/);
    await expect(page.getByRole('link', { name: 'Decision Lab, version 0.1' })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Not every decision needs a conversation.' }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'The decision playground' })).toBeVisible();
    await expect(page.getByText('04 scenarios · one shared experiment')).toBeVisible();
    await expect(page.getByText('Illustrative fixtures. No API connected.')).toBeVisible();

    await expect(lane(page, 'Jev').getByText('Awaiting illustrative example.')).toBeVisible();
    await expect(lane(page, 'LLM').getByText('Awaiting illustrative example.')).toBeVisible();

    for (const name of ['Jev', 'LLM']) {
      const target = lane(page, name);
      await expect(target.getByText('Not measured')).toHaveCount(2);
      await expect(target.getByText('Not configured')).toBeVisible();
    }
  });

  test('offers exactly four scenarios and fourteen presets', async ({ page }) => {
    await page.goto('./');

    await expect(page.getByRole('tab')).toHaveCount(4);

    let seen = 0;
    for (const entry of CATALOGUE) {
      await page.getByRole('tab', { name: new RegExp(entry.tab) }).click();
      await expect(page.getByRole('heading', { name: entry.heading })).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Show illustrative comparison' }),
      ).toBeVisible();
      for (const preset of entry.presets) {
        await expect(page.getByRole('button', { name: preset, exact: true })).toBeVisible();
        seen += 1;
      }
    }

    expect(seen).toBe(TOTAL_PRESETS);
  });

  test('refuses to invent an answer for edited input', async ({ page }) => {
    await page.goto('./');

    const textarea = page.getByLabel('What should the system understand?');
    await runPreset(page, 'Support triage', 'Duplicate charge');
    await expect(lane(page, 'Jev').getByRole('listitem')).toHaveCount(5);

    // Editing clears the old comparison immediately.
    await textarea.press('End');
    await textarea.pressSequentially('!');
    await expect(lane(page, 'Jev').getByText('Awaiting illustrative example.')).toBeVisible();
    await expect(page.getByText('Inspect fixture JSON')).toHaveCount(0);

    await page.getByRole('button', { name: 'Show illustrative comparison' }).click();
    await expect(page.getByRole('alert')).toContainText('will not fabricate an answer');

    // Reverting the text does not resurrect the old result.
    await textarea.press('Backspace');
    await expect(lane(page, 'Jev').getByText('Awaiting illustrative example.')).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('clears results when the scenario changes', async ({ page }) => {
    await page.goto('./');

    await runPreset(page, 'Support triage', 'Duplicate charge');
    await expect(lane(page, 'Jev').getByRole('listitem')).toHaveCount(5);

    await page.getByRole('tab', { name: /Code review/ }).click();
    await expect(lane(page, 'Jev').getByText('Awaiting illustrative example.')).toBeVisible();
  });
});

test.describe('authored illustrations', () => {
  test('renders every preset identically in both lanes', async ({ page }) => {
    await page.goto('./');

    for (const entry of CATALOGUE) {
      for (const preset of entry.presets) {
        await runPreset(page, entry.tab, preset);

        const jev = lane(page, 'Jev');
        const llm = lane(page, 'LLM');

        await expect(jev.getByRole('listitem')).toHaveCount(5);
        await expect(llm.getByRole('listitem')).toHaveCount(5);

        // The strongest form of "one shared authored example": byte-identical content.
        expect(await llm.getByRole('list').innerText()).toBe(
          await jev.getByRole('list').innerText(),
        );
      }
    }
  });

  test('renders the injected support preset with its authored values', async ({ page }) => {
    await page.goto('./');
    await runPreset(page, 'Support triage', 'Injected instruction');

    for (const name of ['Jev', 'LLM']) {
      const judgments = lane(page, name).getByRole('listitem');

      await expect(judgments.nth(0)).toContainText('Billing');
      await expect(judgments.nth(0)).toContainText('56%');
      await expect(judgments.nth(0)).toContainText('22%');
      await expect(judgments.nth(0)).toContainText('2%');
      await expect(judgments.nth(0)).toContainText('20%');

      await expect(judgments.nth(1)).toContainText('6%');
      await expect(judgments.nth(1)).toContainText('Illustrative probability of yes');
      await expect(judgments.nth(2)).toContainText('20%');
      await expect(judgments.nth(3)).toContainText('0.5 / 2');
      await expect(judgments.nth(3)).toContainText('0 Calm · 1 Frustrated · 2 Very angry');
      await expect(judgments.nth(4)).toContainText('97%');
    }
  });

  test('shows a score as a continuous position, not a rounded bucket', async ({ page }) => {
    await page.goto('./');
    await runPreset(page, 'Moderation & PII', 'Credential scam');

    await expect(lane(page, 'Jev').getByRole('listitem').nth(3)).toContainText('1.6 / 2');
  });
});

test.describe('application policy illustration', () => {
  test('follows the threshold and stays non-executing', async ({ page }) => {
    await page.goto('./');
    await runPreset(page, 'Support triage', 'Duplicate charge');

    const slider = page.getByLabel('Minimum winning-option probability');

    await expect(outcome(page)).toHaveText('Suggested route: Billing');

    // A stricter threshold sends the same 84% winner to a human.
    await slider.fill('90');
    await expect(outcome(page)).toHaveText('Human review: Billing is below the threshold');

    // Equality passes.
    await slider.fill('84');
    await expect(outcome(page)).toHaveText('Suggested route: Billing');

    await expect(page.getByText('not a safety gate')).toBeVisible();
  });

  test('sends an unclear winner to a human at every threshold', async ({ page }) => {
    await page.goto('./');
    await runPreset(page, 'Support triage', 'Ambiguous');

    const slider = page.getByLabel('Minimum winning-option probability');

    for (const value of ['0', '50', '100']) {
      await slider.fill(value);
      await expect(outcome(page)).toHaveText('Human review: Unclear is never auto-routed');
    }
  });

  test('does not treat a high injection reading as a safety gate', async ({ page }) => {
    await page.goto('./');
    await runPreset(page, 'Support triage', 'Injected instruction');

    const slider = page.getByLabel('Minimum winning-option probability');

    await expect(outcome(page)).toHaveText('Human review: Billing is below the threshold');

    // Deliberately permissive: the illustration still routes, which is why the
    // disclaimer says this slider is not a security mechanism.
    await slider.fill('50');
    await expect(outcome(page)).toHaveText('Suggested route: Billing');
    await expect(lane(page, 'Jev').getByRole('listitem').nth(4)).toContainText('97%');
  });
});

test.describe('fixture export', () => {
  test('inspects and downloads a labelled fixture document', async ({ page }) => {
    await page.goto('./');
    await runPreset(page, 'Support triage', 'Duplicate charge');

    await page.getByText('Inspect fixture JSON').click();
    const json = page.locator('.policy__json');
    await expect(json).toBeVisible();

    const parsed = JSON.parse((await json.innerText()) || '{}') as Record<string, unknown>;
    expect(parsed.source).toBe('illustrative-fixture');
    expect(parsed.execution).toBe('none');
    expect(parsed.scenarioId).toBe('support-triage');

    const downloadEvent = page.waitForEvent('download');
    await page.getByRole('button', { name: /Download labelled fixture JSON/ }).click();
    const download = await downloadEvent;

    expect(download.suggestedFilename()).toBe(
      'decisionlab-support-triage-duplicate-charge-illustrative-fixture.json',
    );
  });
});

test.describe('input behaviour', () => {
  test('submits with the keyboard shortcut', async ({ page }) => {
    await page.goto('./');

    await page.getByRole('button', { name: 'Negation', exact: true }).click();
    const textarea = page.getByLabel('What should the system understand?');
    await textarea.press('ControlOrMeta+Enter');

    await expect(lane(page, 'Jev').getByRole('listitem')).toHaveCount(5);
    await expect(outcome(page)).not.toHaveText('Suggested route: Billing');
    await expect(outcome(page)).toHaveText('Human review: Billing is below the threshold');
  });

  test('counts characters against the limit', async ({ page }) => {
    await page.goto('./');

    const textarea = page.getByLabel('What should the system understand?');
    await expect(page.getByText('0 / 4000')).toBeVisible();
    await textarea.fill('abc');
    await expect(page.getByText('3 / 4000')).toBeVisible();
  });
});

test.describe('resilience and privacy', () => {
  test('sends no request to a third party', async ({ page, baseURL }) => {
    const offOrigin: string[] = [];

    page.on('request', (request) => {
      const url = request.url();
      if (url.startsWith('data:') || url.startsWith('blob:')) {
        return;
      }
      if (baseURL && url.startsWith(baseURL)) {
        return;
      }
      offOrigin.push(url);
    });

    await page.goto('./');
    await runPreset(page, 'Support triage', 'Duplicate charge');
    await page.getByRole('tab', { name: /Moderation/ }).click();
    await page.getByRole('button', { name: 'Obfuscated address', exact: true }).click();
    await page.getByRole('button', { name: 'Show illustrative comparison' }).click();

    expect(offOrigin).toEqual([]);
  });

  test('stays usable when the decorative chunk fails to load', async ({ page }) => {
    await page.route('**/assets/Orbit-*.js', (route) => route.abort());
    await page.goto('./');

    await expect(
      page.getByRole('heading', { name: 'Not every decision needs a conversation.' }),
    ).toBeVisible();
    await expect(page.getByText('State → judgment → action')).toBeVisible();

    await runPreset(page, 'Support triage', 'Duplicate charge');
    await expect(lane(page, 'Jev').getByRole('listitem')).toHaveCount(5);
  });

  test('stays usable under reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('./');

    await expect(
      page.getByRole('heading', { name: 'Not every decision needs a conversation.' }),
    ).toBeVisible();

    await runPreset(page, 'Support triage', 'Duplicate charge');
    await expect(lane(page, 'Jev').getByRole('listitem')).toHaveCount(5);
  });

  test('does not overflow horizontally', async ({ page }) => {
    await page.goto('./');
    await runPreset(page, 'Moderation & PII', 'Obfuscated address');

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});

test.describe('method and learn', () => {
  test('states what is not implemented', async ({ page }) => {
    await page.goto('./#method');

    await expect(page.getByRole('heading', { name: 'Method' })).toBeVisible();
    await expect(page.getByText('No benchmark has been run')).toBeVisible();
    await expect(page.getByText('193.6×')).toBeVisible();
  });

  test('explains the three primitives', async ({ page }) => {
    await page.goto('./#learn');

    await expect(page.getByRole('heading', { name: 'Choice', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Score', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Noul', exact: true })).toBeVisible();
    await expect(page.getByText('A 50% reading is uncertainty')).toBeVisible();
  });
});
