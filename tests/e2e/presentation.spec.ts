import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/** Walk forward until the slide with this title is showing. */
async function goToSlide(page: Page, title: string): Promise<void> {
  const next = page.getByRole('button', { name: 'Next →' });
  const heading = page.getByRole('heading', { name: title });

  for (let step = 0; step < 24; step += 1) {
    if (await heading.isVisible().catch(() => false)) {
      return;
    }
    if (!(await next.isEnabled())) {
      break;
    }
    await next.click();
  }

  await expect(heading).toBeVisible();
}

test.describe('presenter view', () => {
  test('walks every slide to the end', async ({ page }) => {
    await page.goto('./#present');

    await expect(page.getByText('FIELD NOTES / A 15–20 MINUTE TALK')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open the lab ↗' })).toBeVisible();

    const counter = page.locator('.slide-controls__counter');
    const previous = page.getByRole('button', { name: '← Previous' });
    const next = page.getByRole('button', { name: 'Next →' });

    await expect(counter).toHaveText('01 / 11');
    await expect(previous).toBeDisabled();

    await expect(
      page.getByRole('heading', { name: 'Does this decision need a conversation?' }),
    ).toBeVisible();
    await expect(page.getByRole('region', { name: 'Presenter notes' })).toBeVisible();

    let visited = 1;
    while (await next.isEnabled()) {
      await next.click();
      visited += 1;
    }

    expect(visited).toBe(11);
    await expect(counter).toHaveText('11 / 11');
    await expect(next).toBeDisabled();
    await expect(
      page.getByRole('heading', { name: 'Use each component for its strengths.' }),
    ).toBeVisible();
  });

  test('uses a different accent per slide', async ({ page }) => {
    await page.goto('./#present');

    const slide = page.locator('.slide');
    const quoteColour = () =>
      page.locator('.slide__quote').evaluate((element) => getComputedStyle(element).color);

    await expect(slide).toHaveAttribute('data-accent', 'green');
    const green = await quoteColour();

    await goToSlide(page, 'The people who built chat, betting against chat.');
    await expect(slide).toHaveAttribute('data-accent', 'amber');
    const amber = await quoteColour();

    await goToSlide(page, 'All the answers at once, inside a fixed shape.');
    await expect(slide).toHaveAttribute('data-accent', 'blue');
    const blue = await quoteColour();

    expect(amber).not.toBe(green);
    expect(blue).not.toBe(green);
    expect(blue).not.toBe(amber);
  });

  test('carries the origin and mechanics material', async ({ page }) => {
    await page.goto('./#present');

    await goToSlide(page, 'Fast decisions. Slow reasoning. Different jobs.');
    await expect(page.getByText('System 1 — fast, intuitive')).toBeVisible();
    await expect(page.getByText('System 2 — slow, deliberate')).toBeVisible();

    await goToSlide(page, 'The people who built chat, betting against chat.');
    await expect(page.getByText('RLCD — calibrated decisions')).toBeVisible();
    await expect(page.getByText('15 September 2026 — Jev released in early access.')).toBeVisible();

    await goToSlide(page, 'All the answers at once, inside a fixed shape.');
    await expect(page.getByText('Sequential — one token at a time')).toBeVisible();
    await expect(
      page.getByText('Parallel — every output produced in a single query.'),
    ).toBeVisible();
  });

  test('keeps the owner use cases on the deck', async ({ page }) => {
    await page.goto('./#present');

    await goToSlide(page, 'Choice. Score. Noul.');
    await expect(page.getByText('THE AI TRAFFIC COP')).toBeVisible();
    await expect(page.getByText('ONE VERIFIED LIVE CALL')).toBeVisible();
    await expect(page.getByText('not a benchmark', { exact: false })).toBeVisible();

    await goToSlide(page, 'Use each component for its strengths.');
    await expect(page.getByText('PUT JEV AT THE FRONT OF THE QUEUE')).toBeVisible();
    await expect(page.getByText("You don't waste the client's time.")).toBeVisible();
  });

  test('navigates with the arrow keys', async ({ page }) => {
    await page.goto('./#present');

    const counter = page.locator('.slide-controls__counter');
    await expect(counter).toHaveText('01 / 11');

    await page.keyboard.press('ArrowRight');
    await expect(counter).toHaveText('02 / 11');

    await page.keyboard.press('ArrowRight');
    await expect(counter).toHaveText('03 / 11');

    await page.keyboard.press('ArrowLeft');
    await expect(counter).toHaveText('02 / 11');

    // The counter stops at the ends rather than wrapping.
    for (let step = 0; step < 16; step += 1) {
      await page.keyboard.press('ArrowLeft');
    }
    await expect(counter).toHaveText('01 / 11');
  });

  test('does not steal the arrow keys from a focused control', async ({ page }) => {
    await page.goto('./#present');

    const counter = page.locator('.slide-controls__counter');
    await page.getByRole('button', { name: 'Next →' }).focus();
    await page.keyboard.press('ArrowRight');

    // Focus is inside a button, so the slide must not advance.
    await expect(counter).toHaveText('01 / 11');
  });

  test('returns to the lab without losing the comparison', async ({ page }) => {
    await page.goto('./');

    await page.getByRole('button', { name: 'Duplicate charge', exact: true }).click();
    await page.getByRole('button', { name: 'Show illustrative comparison' }).click();
    await expect(
      page.getByRole('region', { name: 'Jev result lane' }).getByRole('listitem'),
    ).toHaveCount(5);

    await page.getByRole('link', { name: 'Present', exact: true }).click();
    await page.getByRole('button', { name: 'Open the lab ↗' }).click();

    await expect(
      page.getByRole('region', { name: 'Jev result lane' }).getByRole('listitem'),
    ).toHaveCount(5);
  });
});
