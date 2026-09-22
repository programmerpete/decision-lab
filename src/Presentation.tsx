import { useCallback, useEffect, useState } from 'react';

import data from './presentation.json';

export interface SlideCard {
  readonly title: string;
  readonly lines: readonly string[];
  readonly footer: string | null;
}

export interface Slide {
  readonly number: number;
  readonly timing: string;
  /** Which accent the slide uses. Colour carries meaning, so it is explicit data. */
  readonly accent: SlideAccent;
  readonly eyebrow: string;
  readonly kicker: string | null;
  readonly title: string;
  readonly subtitle: string;
  readonly pullQuote: string;
  readonly cards: readonly SlideCard[] | null;
  readonly notes: readonly string[];
}

export type SlideAccent = 'green' | 'amber' | 'blue' | 'violet';

const ACCENTS: readonly SlideAccent[] = ['green', 'amber', 'blue', 'violet'];

function isAccent(value: string): value is SlideAccent {
  return (ACCENTS as readonly string[]).includes(value);
}

/**
 * Canonical slide content, validated at the boundary. `PRESENTATION-SLIDES.md` is
 * generated from this, and `accent` is checked rather than cast so a typo in the JSON
 * fails the build instead of silently rendering an unstyled slide.
 */
export const SLIDES: readonly Slide[] = data.slides.map((slide) => {
  if (!isAccent(slide.accent)) {
    throw new Error(`Slide ${slide.number} has an unknown accent "${slide.accent}".`);
  }

  return {
    number: slide.number,
    timing: slide.timing,
    accent: slide.accent,
    eyebrow: slide.eyebrow,
    kicker: slide.kicker,
    title: slide.title,
    subtitle: slide.subtitle,
    pullQuote: slide.pullQuote,
    cards: slide.cards,
    notes: slide.notes,
  };
});

export const TALK = data.talk;

/** Elements that own the arrow keys while focused. */
const INTERACTIVE =
  'button, a, input, textarea, select, summary, [role="slider"], [contenteditable="true"]';

interface PresentationProps {
  /** Returns to the Explore view without losing the current comparison. */
  readonly onOpenLab: () => void;
}

export default function Presentation({ onOpenLab }: PresentationProps) {
  const [index, setIndex] = useState(0);
  const total = SLIDES.length;
  const slide = SLIDES[index] ?? SLIDES[0]!;
  const atStart = index === 0;
  const atEnd = index >= total - 1;

  const go = useCallback(
    (next: number) => {
      setIndex(Math.max(0, Math.min(next, total - 1)));
    },
    [total],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      // Never hijack the arrow keys from a control, an editable field, or a slider.
      if (event.target instanceof Element && event.target.closest(INTERACTIVE)) {
        return;
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        setIndex((current) => Math.min(current + 1, total - 1));
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setIndex((current) => Math.max(current - 1, 0));
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [total]);

  return (
    <div className="present wrap">
      <div className="present__head">
        <p className="eyebrow">{TALK.eyebrow}</p>
        <button type="button" className="link-button" onClick={onOpenLab}>
          {TALK.labLinkLabel}
        </button>
      </div>

      <article
        className="slide"
        data-accent={slide.accent}
        aria-label={`Slide ${slide.number} of ${total}`}
      >
        <p className="slide__eyebrow">{slide.eyebrow}</p>
        <h2 className="slide__title">{slide.title}</h2>
        <p className="slide__sub">{slide.subtitle}</p>

        {slide.cards ? (
          <div className="slide__cards">
            {slide.cards.map((card) => (
              <div className="slide-card" key={card.title}>
                <p className="slide-card__title">{card.title}</p>
                <ul className="slide-card__lines">
                  {card.lines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                {card.footer ? <p className="slide-card__footer">{card.footer}</p> : null}
              </div>
            ))}
          </div>
        ) : null}

        <hr className="slide__rule" />

        {slide.kicker ? <p className="slide__kicker">{slide.kicker}</p> : null}
        <p className="slide__quote">{slide.pullQuote}</p>
      </article>

      <div className="slide-controls">
        <button type="button" className="button" onClick={() => go(index - 1)} disabled={atStart}>
          ← Previous
        </button>
        <span className="slide-controls__counter">
          {String(slide.number).padStart(2, '0')} / {String(total).padStart(2, '0')}
        </span>
        <button type="button" className="button" onClick={() => go(index + 1)} disabled={atEnd}>
          Next →
        </button>
      </div>

      <div className="slide-dots" role="group" aria-label="Jump to a slide">
        {SLIDES.map((entry, entryIndex) => (
          <button
            type="button"
            key={entry.number}
            className="slide-dot"
            aria-label={`Slide ${entry.number}: ${entry.title}`}
            aria-current={entryIndex === index}
            onClick={() => go(entryIndex)}
          />
        ))}
      </div>

      <section className="card notes" aria-label="Presenter notes">
        <div className="notes__meta">
          <p className="eyebrow">Presenter notes</p>
          <span className="eyebrow">{slide.timing}</span>
        </div>
        <ul className="notes__list">
          {slide.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
