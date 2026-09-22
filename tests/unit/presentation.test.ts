import { describe, expect, it } from 'vitest';

import { SLIDES, TALK } from '../../src/Presentation';

/** The run-sheet timings from PRESENTATION.md, in order. */
const RUN_SHEET_TIMINGS = [
  '0–2 min',
  '2–4 min',
  '4–7 min',
  '7–9 min',
  '9–12 min',
  '12–14 min',
  '14–17 min',
  '17–20 min',
];

describe('presentation', () => {
  it('has eight slides numbered in order', () => {
    expect(SLIDES).toHaveLength(8);
    expect(SLIDES.map((slide) => slide.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
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
    const slideTwo = SLIDES[1];
    const cards = slideTwo?.cards ?? [];
    const liveCall = cards.find((card) => card.title === 'ONE VERIFIED LIVE CALL');

    expect(liveCall).toBeDefined();
    expect(liveCall?.footer).toContain('not a benchmark');
    expect(liveCall?.footer).toContain('vendor reports');
  });

  it('shows both recorded runs, so either live outcome is predicted', () => {
    const slideSeven = SLIDES[6];
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
    expect(slideSeven?.cards?.some((card) => card.title === 'WHAT IS STABLE ACROSS RUNS')).toBe(
      true,
    );
  });

  it('confines vendor speed and cost claims to attributed context', () => {
    const slideSeven = SLIDES[6];
    const notes = (slideSeven?.notes ?? []).join(' ');

    expect(notes).toContain('193.6×');
    expect(notes).toContain('not our measurements');

    for (const slide of SLIDES) {
      expect(slide.title).not.toContain('193.6');
      expect(slide.pullQuote).not.toContain('444.6');
    }
  });
});
