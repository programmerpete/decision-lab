import { expect, test } from '@playwright/test';

test.describe('presenter view', () => {
  test('walks all eight slides', async ({ page }) => {
    await page.goto('./#present');

    await expect(page.getByText('FIELD NOTES / A 15–20 MINUTE TALK')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open the lab ↗' })).toBeVisible();

    const counter = page.locator('.slide-controls__counter');
    const previous = page.getByRole('button', { name: '← Previous' });
    const next = page.getByRole('button', { name: 'Next →' });

    await expect(counter).toHaveText('01 / 08');
    await expect(previous).toBeDisabled();

    await expect(
      page.getByRole('heading', { name: 'Does this decision need a conversation?' }),
    ).toBeVisible();
    await expect(page.getByRole('region', { name: 'Presenter notes' })).toBeVisible();

    for (let slide = 2; slide <= 8; slide += 1) {
      await next.click();
      await expect(counter).toHaveText(`${String(slide).padStart(2, '0')} / 08`);
    }

    await expect(next).toBeDisabled();
    await expect(
      page.getByRole('heading', { name: 'Use each component for its strengths.' }),
    ).toBeVisible();
  });

  test('keeps the owner use cases on the deck', async ({ page }) => {
    await page.goto('./#present');

    const next = page.getByRole('button', { name: 'Next →' });
    await next.click();

    await expect(page.getByRole('heading', { name: 'Choice. Score. Noul.' })).toBeVisible();
    await expect(page.getByText('THE AI TRAFFIC COP')).toBeVisible();
    await expect(page.getByText('ONE VERIFIED LIVE CALL')).toBeVisible();
    await expect(page.getByText('not a benchmark', { exact: false })).toBeVisible();

    for (let step = 0; step < 6; step += 1) {
      await next.click();
    }

    await expect(page.getByText('PUT JEV AT THE FRONT OF THE QUEUE')).toBeVisible();
    await expect(page.getByText("You don't waste the client's time.")).toBeVisible();
  });

  test('navigates with the arrow keys', async ({ page }) => {
    await page.goto('./#present');

    const counter = page.locator('.slide-controls__counter');
    await expect(counter).toHaveText('01 / 08');

    await page.keyboard.press('ArrowRight');
    await expect(counter).toHaveText('02 / 08');

    await page.keyboard.press('ArrowRight');
    await expect(counter).toHaveText('03 / 08');

    await page.keyboard.press('ArrowLeft');
    await expect(counter).toHaveText('02 / 08');

    // The counter stops at the ends rather than wrapping.
    for (let step = 0; step < 12; step += 1) {
      await page.keyboard.press('ArrowLeft');
    }
    await expect(counter).toHaveText('01 / 08');
  });

  test('does not steal the arrow keys from a focused control', async ({ page }) => {
    await page.goto('./#present');

    const counter = page.locator('.slide-controls__counter');
    await page.getByRole('button', { name: 'Next →' }).focus();
    await page.keyboard.press('ArrowRight');

    // Focus is inside a button, so the slide must not advance.
    await expect(counter).toHaveText('01 / 08');
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
