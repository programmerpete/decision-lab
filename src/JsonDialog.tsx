import { useEffect, useMemo, useRef } from 'react';
import { LANES, LANE_ORDER, type Lane } from './domain';
import type { LiveExchange } from './live';

/**
 * One lane's captured exchange, plus whether its call is still in flight. The two are
 * separate because "nothing has been run" and "the call is running right now" read very
 * differently on screen: the typed lane answers in about 250 ms and the language model
 * takes seconds, so the waiting state is one a presenter will actually see.
 */
export interface JsonLaneView {
  readonly exchange: LiveExchange | null;
  readonly loading: boolean;
}

export interface JsonDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly lanes: Readonly<Record<Lane, JsonLaneView>>;
}

function pretty(value: unknown): string {
  if (value === undefined) {
    return '';
  }
  const text = JSON.stringify(value, null, 2);
  return text === undefined ? String(value) : text;
}

/**
 * Compares the two requests with the lane field removed. `null` means one or both
 * requests are not available yet.
 */
function requestsMatchApartFromLane(lanes: Readonly<Record<Lane, JsonLaneView>>): boolean | null {
  const jev = lanes.jev.exchange?.request;
  const llm = lanes.llm.exchange?.request;
  if (!jev || !llm) {
    return null;
  }
  return pretty({ ...jev, lane: null }) === pretty({ ...llm, lane: null });
}

/** Why a pane is empty. "Still running" is not the same as "never run". */
function emptyMessage(view: JsonLaneView, side: 'request' | 'response'): string {
  if (view.loading) {
    return 'Waiting for this lane to answer.';
  }
  if (!view.exchange) {
    return 'No call made yet.';
  }
  return side === 'request'
    ? 'No request was captured for this lane.'
    : 'The call was made but no response body arrived. The lane shows the error.';
}

function Pane({
  lane,
  title,
  value,
  emptyMessage,
}: {
  readonly lane: Lane;
  readonly title: string;
  readonly value: unknown;
  readonly emptyMessage: string;
}) {
  const meta = LANES[lane];
  const text = pretty(value);
  const present = value !== null && value !== undefined;

  return (
    <figure className="json-pane">
      <figcaption className="json-pane__head">
        <span className="json-pane__lane">
          <span aria-hidden="true" className="json-pane__glyph">
            {meta.glyph}
          </span>
          {meta.name} · {title}
        </span>
        {present ? (
          <button
            type="button"
            className="button button--quiet button--small"
            onClick={() => {
              void navigator.clipboard?.writeText(text).catch(() => undefined);
            }}
          >
            Copy
          </button>
        ) : null}
      </figcaption>
      {present ? (
        <pre className="json-pane__body" tabIndex={0}>
          {text}
        </pre>
      ) : (
        <p className="json-pane__empty">{emptyMessage}</p>
      )}
    </figure>
  );
}

export default function JsonDialog({ open, onClose, lanes }: JsonDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
    }
    if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const sameRequest = useMemo(() => requestsMatchApartFromLane(lanes), [lanes]);

  const note =
    sameRequest === null
      ? 'Run a live comparison to capture both requests.'
      : sameRequest
        ? 'The two requests are identical apart from the lane field: one function builds both, so the input, the questions and the criteria are the same object. That is what makes the comparison fair.'
        : 'The two requests differ beyond the lane field. That should not happen—treat this comparison as invalid.';

  return (
    <dialog
      ref={ref}
      className="json-dialog"
      aria-labelledby="json-dialog-title"
      onClose={onClose}
      onClick={(event) => {
        // Clicking the backdrop (the dialog element itself, outside its content) closes.
        if (event.target === ref.current) {
          onClose();
        }
      }}
    >
      <div className="json-dialog__panel">
        <header className="json-dialog__head">
          <h2 id="json-dialog-title">Request and response JSON</h2>
          <button type="button" className="button button--quiet" onClick={onClose}>
            Close
          </button>
        </header>

        <p className="json-dialog__note">{note}</p>

        <section className="json-dialog__section" aria-labelledby="json-dialog-request">
          <h3 id="json-dialog-request" className="json-dialog__section-title">
            Request sent
          </h3>
          <div className="json-dialog__panes">
            {LANE_ORDER.map((lane) => (
              <Pane
                key={lane}
                lane={lane}
                title="request"
                value={lanes[lane].exchange?.request ?? null}
                emptyMessage={emptyMessage(lanes[lane], 'request')}
              />
            ))}
          </div>
        </section>

        <section className="json-dialog__section" aria-labelledby="json-dialog-response">
          <h3 id="json-dialog-response" className="json-dialog__section-title">
            Response received
          </h3>
          <div className="json-dialog__panes">
            {LANE_ORDER.map((lane) => (
              <Pane
                key={lane}
                lane={lane}
                title="response"
                value={lanes[lane].exchange?.response ?? null}
                emptyMessage={emptyMessage(lanes[lane], 'response')}
              />
            ))}
          </div>
        </section>
      </div>
    </dialog>
  );
}
