import { describe, expect, it } from 'vitest';

import { SLIDES, TALK } from '../../src/Presentation';

/** The run-sheet timings from PRESENTATION.md, in order. */
const RUN_SHEET_TIMINGS = [
  '0–2 min',
  '2–3.5 min',
  '3.5–5 min',
  '5–6.5 min',
  '6.5–8 min',
  '8–10.5 min',
  '10.5–12 min',
  '12–13.5 min',
  '13.5–15 min',
  '15–17.5 min',
  '17.5–20 min',
];

function slideTitled(title: string) {
  const found = SLIDES.find((slide) => slide.title === title);
  if (!found) {
    throw new Error(`No slide titled "${title}".`);
  }
  return found;
}

describe('presentation', () => {
  it('numbers every slide in order', () => {
    expect(SLIDES.length).toBeGreaterThanOrEqual(8);
    expect(SLIDES.map((slide) => slide.number)).toEqual(SLIDES.map((_, index) => index + 1));
  });

  it('keeps the run-sheet timings', () => {
    expect(SLIDES.map((slide) => slide.timing)).toEqual(RUN_SHEET_TIMINGS);
  });

  it('fills every required field', () => {
    for (const slide of SLIDES) {
      expect(slide.eyebrow.length).toBeGreaterThan(0);
      expect(slide.title.length).toBeGreaterThan(0);
      expect(slide.subtitle.length).toBeGreaterThan(0);
      expect(slide.pullQuote.length).toBeGreaterThan(0);
      expect(slide.notes.length).toBeGreaterThanOrEqual(3);
      expect(slide.notes.length).toBeLessThanOrEqual(5);
    }
  });

  it('names the talk and links back to the lab', () => {
    expect(TALK.eyebrow).toContain('FIELD NOTES');
    expect(TALK.labLinkLabel).toContain('Open the lab');
  });

  it('carries the owner use cases', () => {
    const allText = JSON.stringify(SLIDES);

    expect(allText).toContain('THE AI TRAFFIC COP');
    expect(allText).toContain('PUT JEV AT THE FRONT OF THE QUEUE');
    expect(allText).toContain('Keep Jev in an advisory role');
    expect(allText).toContain("You don't waste the client's time");
  });

  it('attributes the live smoke test as a smoke test, not a benchmark', () => {
    const primitives = slideTitled('Choice. Score. Noul.');
    const cards = primitives.cards ?? [];
    const liveCall = cards.find((card) => card.title === 'ONE VERIFIED LIVE CALL');

    expect(liveCall).toBeDefined();
    expect(liveCall?.footer).toContain('not a benchmark');
    expect(liveCall?.footer).toContain('vendor reports');
  });

  it('shows both recorded runs, so either live outcome is predicted', () => {
    const experiment = slideTitled('The experiment.');
    const allText = JSON.stringify(SLIDES);

    // A presenter who reproduces the demo live may get either result. The deck shows
    // both rather than betting on one, and must not imply that choosing the right
    // scenario guarantees a disagreement.
    expect(allText).toContain('TWO RUNS OF THE SAME SCENARIO');
    expect(allText).toContain('Run A');
    expect(allText).toContain('Run B');
    expect(allText).toContain('varies by scenario and between runs');
    expect(allText).not.toContain('scenario-dependent');
    expect(allText).toContain('promise neither');
    // Provenance: one of the two runs was not recorded by this project's author.
    expect(allText).toContain('reproduced independently');

    // The stable claim is separated from the unstable one.
    expect(experiment.cards?.some((card) => card.title === 'WHAT IS STABLE ACROSS RUNS')).toBe(
      true,
    );
  });

  it('explains where Jev came from and how it works', () => {
    const allText = JSON.stringify(SLIDES);

    // The origin and mechanics material, following the structure of the reference talk.
    expect(allText).toContain('System 1');
    expect(allText).toContain('System 2');
    expect(allText).toContain('RLCD');
    expect(allText).toContain('calibrated decisions');
    expect(allText).toContain('never makes type errors');
    expect(allText).toContain('single query');
  });

  it('attributes the vendor framing rather than asserting it', () => {
    const origin = slideTitled('The people who built chat, betting against chat.');

    // The System One framing and the criticism of RLHF are TypeSafe's position, so the
    // notes must say so rather than presenting them as settled.
    const notes = origin.notes.join(' ');
    expect(notes).toContain('theirs');
    expect(notes).toContain('not as settled science');
  });

  it('gives every slide an accent from the palette', () => {
    const allowed = new Set(['green', 'amber', 'blue', 'violet']);
    for (const slide of SLIDES) {
      expect(allowed.has(slide.accent)).toBe(true);
    }
    // Colour is doing work, so the deck is not monochrome.
    expect(new Set(SLIDES.map((slide) => slide.accent)).size).toBeGreaterThan(1);
  });

  it('confines vendor speed and cost claims to attributed context', () => {
    const experiment = slideTitled('The experiment.');
    const notes = experiment.notes.join(' ');

    expect(notes).toContain('193.6×');
    expect(notes).toContain('not our measurements');

    for (const slide of SLIDES) {
      expect(slide.title).not.toContain('193.6');
      expect(slide.pullQuote).not.toContain('444.6');
    }
  });
});
