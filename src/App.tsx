import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import LazyOrbit from './LazyOrbit';
import Presentation from './Presentation';
import ResultLane from './ResultLane';
import type { LaneState } from './ResultLane';
import {
  DEFAULT_THRESHOLD_PERCENT,
  FIXTURE_NOTICE,
  LANES,
  LANE_ORDER,
  MAX_INPUT_LENGTH,
  MODE_STATEMENT,
  PRIMITIVE_LABEL,
  THRESHOLD_DISCLAIMER,
  UNTRUSTED_INPUT_QUOTE,
  buildExport,
  evaluateFixture,
  exportFilename,
  formatCost,
  formatPercent,
  illustrateRouting,
  routingDetail,
  routingSentence,
} from './domain';
import type {
  AnswerSet,
  EvaluationError,
  FixtureEvaluation,
  FixtureRun,
  Lane,
  RoutingIllustration,
  Scenario,
} from './domain';
import { requestDecision } from './live';
import type { LiveFailure, LiveSuccess } from './live';
import { DEFAULT_SCENARIO, SCENARIOS } from './scenarios';

/* -------------------------------------------------------------------------- */
/* Modes                                                                       */
/* -------------------------------------------------------------------------- */

type Mode = 'fixture' | 'live';

/** One arm's live-call state. Fixture mode never touches these. */
type LiveLane =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading' }
  | {
      readonly kind: 'success';
      readonly run: LiveSuccess;
      readonly input: string;
      readonly scenarioId: string;
    }
  | {
      readonly kind: 'error';
      readonly failure: LiveFailure;
      readonly input: string;
      readonly scenarioId: string;
    };

const IDLE_LANES: Readonly<Record<Lane, LiveLane>> = {
  jev: { kind: 'idle' },
  llm: { kind: 'idle' },
};

/* -------------------------------------------------------------------------- */
/* Views                                                                       */
/* -------------------------------------------------------------------------- */

type View = 'explore' | 'learn' | 'present' | 'method';

const VIEWS = [
  { id: 'explore', label: 'Explore' },
  { id: 'learn', label: 'Learn' },
  { id: 'present', label: 'Present' },
  { id: 'method', label: 'Method' },
] as const satisfies readonly { readonly id: View; readonly label: string }[];

function isView(value: string): value is View {
  return VIEWS.some((view) => view.id === value);
}

function viewFromHash(): View {
  const hash = window.location.hash.replace(/^#/, '');
  return isView(hash) ? hash : 'explore';
}

/* -------------------------------------------------------------------------- */
/* Header                                                                      */
/* -------------------------------------------------------------------------- */

function BrandMark() {
  return (
    <svg className="brand__mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <path d="M16 3 29 16 16 29 3 16Z" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M16 10.5 21.5 16 16 21.5 10.5 16Z" fill="currentColor" />
    </svg>
  );
}

interface HeaderProps {
  readonly view: View;
  readonly mode: Mode;
  readonly onNavigate: (view: View) => void;
}

function Header({ view, mode, onNavigate }: HeaderProps) {
  return (
    <header className="header">
      <div className="wrap header__inner">
        <a
          className="brand"
          href="#explore"
          onClick={() => onNavigate('explore')}
          aria-label="Decision Lab, version 0.1"
        >
          <BrandMark />
          <span className="brand__name">decisionlab</span>
          <span className="brand__version">/ 0.1</span>
        </a>

        <nav className="nav" aria-label="Views">
          {VIEWS.map((entry) => (
            <a
              key={entry.id}
              className="nav__link"
              href={`#${entry.id}`}
              aria-current={view === entry.id ? 'page' : undefined}
              onClick={() => onNavigate(entry.id)}
            >
              {entry.label}
            </a>
          ))}
        </nav>

        <a
          className={mode === 'live' ? 'fixture-pill fixture-pill--live' : 'fixture-pill'}
          href="#method"
          onClick={() => onNavigate('method')}
        >
          {mode === 'live' ? 'Live mode' : 'Fixture mode'}
        </a>
      </div>
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/* Explore                                                                     */
/* -------------------------------------------------------------------------- */

interface ExploreProps {
  readonly scenario: Scenario;
  readonly input: string;
  readonly run: FixtureRun | null;
  readonly error: EvaluationError | null;
  readonly mode: Mode;
  readonly token: string;
  readonly jevState: LaneState;
  readonly llmState: LaneState;
  readonly jevRouting: RoutingIllustration | null;
  readonly llmRouting: RoutingIllustration | null;
  readonly liveSummary: string;
  readonly threshold: number;
  readonly exportJson: string | null;
  readonly announcement: string;
  readonly onSelectScenario: (scenarioId: string) => void;
  readonly onInputChange: (value: string) => void;
  readonly onSelectPreset: (input: string) => void;
  readonly onSubmit: () => void;
  readonly onThresholdChange: (value: number) => void;
  readonly onDownload: () => void;
  readonly onModeChange: (mode: Mode) => void;
  readonly onTokenChange: (token: string) => void;
}

function Explore({
  scenario,
  input,
  run,
  error,
  mode,
  token,
  jevState,
  llmState,
  jevRouting,
  llmRouting,
  liveSummary,
  threshold,
  exportJson,
  announcement,
  onSelectScenario,
  onInputChange,
  onSelectPreset,
  onSubmit,
  onThresholdChange,
  onDownload,
  onModeChange,
  onTokenChange,
}: ExploreProps) {
  const selectedPreset = scenario.presets.find((preset) => preset.input === input);

  // The two arms can disagree. When they do, show both outcomes side by side: the
  // difference in confidence is what changes the routing decision, and that is the
  // most useful thing on this card.
  const lanesDisagree =
    jevRouting !== null &&
    llmRouting !== null &&
    JSON.stringify(jevRouting) !== JSON.stringify(llmRouting);

  const routingRows: readonly {
    readonly lane: Lane | null;
    readonly routing: RoutingIllustration;
  }[] =
    lanesDisagree && jevRouting && llmRouting
      ? [
          { lane: 'jev', routing: jevRouting },
          { lane: 'llm', routing: llmRouting },
        ]
      : jevRouting
        ? [{ lane: null, routing: jevRouting }]
        : llmRouting
          ? [{ lane: null, routing: llmRouting }]
          : [];

  return (
    <>
      <div className="wrap">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero__body">
            <p className="eyebrow">An interactive field guide / Jev × LLMs</p>
            <h1 className="hero__title" id="hero-title">
              Not every decision needs a conversation.
            </h1>
            <p className="lede">
              Explore where structured decisions fit. Compare the approaches. Keep the evidence—and
              your code—in control.
            </p>
            <a className="hero__link" href="#learn">
              New to Jev? Start with the three primitives ↗
            </a>
          </div>

          <div className="hero__visual">
            <LazyOrbit />
            <p className="orbit-caption">
              <span>State → judgment → action</span>
              <span>Conceptual illustration</span>
            </p>
          </div>
        </section>

        <section className="section" aria-labelledby="playground-title">
          <div className="section__head">
            <h2 className="eyebrow" id="playground-title">
              The decision playground
            </h2>
            <p className="section__note">04 scenarios · one shared experiment</p>
          </div>

          <div className="scenarios" role="tablist" aria-label="Scenarios">
            {SCENARIOS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                role="tab"
                id={`tab-${entry.id}`}
                aria-selected={entry.id === scenario.id}
                aria-controls="scenario-panel"
                tabIndex={entry.id === scenario.id ? 0 : -1}
                className="scenario-tab"
                onClick={() => onSelectScenario(entry.id)}
                onKeyDown={(event) => {
                  const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
                  if (step === 0) {
                    return;
                  }
                  event.preventDefault();
                  const current = SCENARIOS.findIndex((candidate) => candidate.id === scenario.id);
                  const next = (current + step + SCENARIOS.length) % SCENARIOS.length;
                  const target = SCENARIOS[next];
                  if (target) {
                    onSelectScenario(target.id);
                    document.getElementById(`tab-${target.id}`)?.focus();
                  }
                }}
              >
                <span className="scenario-tab__index">{String(entry.index).padStart(2, '0')}</span>
                <span className="scenario-tab__label">{entry.tabLabel}</span>
              </button>
            ))}
          </div>

          <div
            id="scenario-panel"
            role="tabpanel"
            aria-labelledby={`tab-${scenario.id}`}
            tabIndex={-1}
          >
            <div className="scenario-head">
              <div>
                <h3 className="scenario-head__title">{scenario.title}</h3>
                <p className="scenario-head__desc">{scenario.sub}</p>
              </div>
              <span className="badge badge--fixture">
                {scenario.questions.length} judgments / {mode === 'live' ? 'live' : 'fixture'}
              </span>
            </div>

            <p className={mode === 'live' ? 'banner banner--live' : 'banner'}>
              <span className="banner__mark" aria-hidden="true">
                {mode === 'live' ? 'Live' : 'Fixture'}
              </span>
              <span>
                {mode === 'live'
                  ? 'Live mode. Both lanes call a server-side proxy that holds the provider key and enforces a per-lane model allowlist. Each lane is labelled with its own provider, resolved model, request id, latency, and reported cost, and neither falls back to fixtures.'
                  : FIXTURE_NOTICE}
              </span>
            </p>

            <div className="playground">
              <section className="card panel panel--input" aria-labelledby="input-title">
                <div className="panel__head">
                  <p className="eyebrow">01 / The input</p>
                  <span className="badge badge--chip">{scenario.inputBadge}</span>
                </div>

                <div className="field">
                  <label className="field__label" htmlFor="lab-input">
                    {scenario.inputPrompt}
                  </label>
                  <textarea
                    id="lab-input"
                    className={
                      scenario.id === 'code-review' ? 'textarea textarea--code' : 'textarea'
                    }
                    value={input}
                    maxLength={MAX_INPUT_LENGTH}
                    spellCheck={false}
                    aria-describedby="lab-input-hint"
                    onChange={(event) => onInputChange(event.target.value)}
                    onKeyDown={(event) => {
                      if (
                        (event.metaKey || event.ctrlKey) &&
                        event.key === 'Enter' &&
                        !event.nativeEvent.isComposing
                      ) {
                        event.preventDefault();
                        onSubmit();
                      }
                    }}
                  />
                  <p className="field__meta" id="lab-input-hint">
                    <span>
                      {input.length} / {MAX_INPUT_LENGTH}
                    </span>
                    <span>⌘ / Ctrl + Enter</span>
                  </p>
                  <p className="field__hint">
                    {mode === 'live'
                      ? 'Choose a synthetic preset, or type any synthetic text. Live mode sends it to the provider and shows the answers, or the failure.'
                      : 'Choose a synthetic preset. Edited inputs need a live provider; this starter will not fabricate an answer.'}
                  </p>
                </div>

                <div className="presets">
                  <p className="presets__label">Try a different signal</p>
                  <div className="presets__list">
                    {scenario.presets.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        className="preset"
                        aria-pressed={preset.input === input}
                        onClick={() => onSelectPreset(preset.input)}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="panel__actions">
                  <button type="button" className="button button--primary" onClick={onSubmit}>
                    {mode === 'live' ? 'Run live comparison' : 'Show illustrative comparison'}
                  </button>
                </div>

                {error ? (
                  <p className="error" role="alert">
                    {error.message}
                  </p>
                ) : null}

                <details className="disclosure">
                  <summary className="disclosure__summary">Presenter: live mode</summary>
                  <div className="disclosure__body">
                    <div className="mode-switch">
                      <label className="mode-switch__option">
                        <input
                          type="radio"
                          name="comparison-mode"
                          checked={mode === 'fixture'}
                          onChange={() => onModeChange('fixture')}
                        />
                        <span>Fixture</span>
                      </label>
                      <label className="mode-switch__option">
                        <input
                          type="radio"
                          name="comparison-mode"
                          checked={mode === 'live'}
                          onChange={() => onModeChange('live')}
                        />
                        <span>Live</span>
                      </label>
                    </div>

                    {mode === 'live' ? (
                      <>
                        <label className="field__label" htmlFor="live-token">
                          Presenter token
                        </label>
                        <input
                          id="live-token"
                          className="input"
                          type="password"
                          value={token}
                          autoComplete="off"
                          spellCheck={false}
                          onChange={(event) => onTokenChange(event.target.value)}
                        />
                        <p className="field__hint">
                          Held in memory for this tab only. It is never written to storage, never
                          placed in a URL, and never built into the bundle — Vite inlines every
                          <code>VITE_*</code> variable into public JavaScript, so a key must never
                          live there. Anyone without the token keeps seeing fixtures.
                        </p>
                      </>
                    ) : null}

                    <p className="field__hint">
                      Live calls go to a server-side proxy that holds the provider key. The browser
                      never contacts the provider directly. If a live call fails, the lane shows the
                      failure — it never falls back to fixture values.
                    </p>
                  </div>
                </details>

                <details className="disclosure">
                  <summary className="disclosure__summary">Read the decision policy</summary>
                  <div className="disclosure__body">
                    <p>{scenario.policy}</p>
                    <ul>
                      {scenario.questions.map((question) => (
                        <li key={question.id}>
                          <strong>{question.title}</strong> ({PRIMITIVE_LABEL[question.primitive]})
                          — {question.prompt}
                        </li>
                      ))}
                    </ul>
                    <p>
                      Question set v{scenario.questionSetVersion} · policy v{scenario.policyVersion}
                    </p>
                  </div>
                </details>

                <div className="boundary">
                  <p className="boundary__label">The boundary</p>
                  <p className="boundary__text">{scenario.boundary}</p>
                </div>
              </section>

              {LANE_ORDER.map((lane) => (
                <ResultLane
                  key={lane}
                  lane={lane}
                  questions={scenario.questions}
                  state={lane === 'jev' ? jevState : llmState}
                />
              ))}

              <section className="card policy" aria-labelledby="policy-title">
                <div className="policy__grid">
                  <div>
                    <div className="panel__head">
                      <p className="eyebrow" id="policy-title">
                        02 / Application policy illustration
                      </p>
                      <span className="badge">Human review</span>
                    </div>

                    <label className="field__label" htmlFor="threshold">
                      Minimum winning-option probability
                    </label>
                    <input
                      id="threshold"
                      className="slider"
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={threshold}
                      onChange={(event) => onThresholdChange(Number(event.target.value))}
                    />
                    <p className="policy__readout">
                      <span>{threshold}%</span>
                      <span>A tie or an unclear winner always goes to a person</span>
                    </p>

                    <p className="policy__note">{THRESHOLD_DISCLAIMER}</p>
                    {lanesDisagree ? null : (
                      <p className="policy__note">
                        {routingDetail(jevRouting, mode === 'fixture')}
                      </p>
                    )}
                  </div>

                  <div className="policy__outcome">
                    <p className="policy__outcome-label">
                      {mode === 'live' ? 'Outcome of this rule' : 'Illustrated outcome'}
                    </p>

                    {routingRows.length === 0 ? (
                      <p className="policy__outcome-value">No result yet</p>
                    ) : (
                      routingRows.map((row) => (
                        <div className="policy__outcome-row" key={row.lane ?? 'single'}>
                          {row.lane ? (
                            <span className="policy__outcome-lane">{LANES[row.lane].name}</span>
                          ) : null}
                          <p className="policy__outcome-value">
                            {routingSentence(scenario, row.routing)}
                            {lanesDisagree && row.routing.winningProbability !== null ? (
                              <span className="policy__outcome-prob">
                                {' '}
                                · {formatPercent(row.routing.winningProbability)} winning option
                              </span>
                            ) : null}
                          </p>
                        </div>
                      ))
                    )}

                    <p className="policy__outcome-reason">
                      {mode === 'live'
                        ? liveSummary
                        : selectedPreset
                          ? `Authored example: ${selectedPreset.note}`
                          : 'Choose a preset to see the illustration.'}
                    </p>
                    <blockquote className="quote">{UNTRUSTED_INPUT_QUOTE}</blockquote>
                  </div>
                </div>

                {run && exportJson ? (
                  <div className="policy__export">
                    <details className="disclosure disclosure--inline">
                      <summary className="disclosure__summary">Inspect fixture JSON</summary>
                      <pre className="policy__json">{exportJson}</pre>
                    </details>
                    <button type="button" className="button" onClick={onDownload}>
                      Download labelled fixture JSON ↓
                    </button>
                  </div>
                ) : null}
              </section>
            </div>
          </div>
        </section>
      </div>

      <p className="visually-hidden" role="status">
        {announcement}
      </p>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Learn                                                                       */
/* -------------------------------------------------------------------------- */

const PRIMITIVE_CARDS = [
  {
    name: 'Choice',
    type: 'Categorical',
    body: 'Selects one option from a set you define, and returns the full distribution over those options. Use it to route, label, or pick.',
    example: 'team → billing 84% · technical 6% · sales 2% · unclear 8%',
  },
  {
    name: 'Score',
    type: 'Ordinal',
    body: 'Places an item on an ordered rubric. The result is a continuous position, not a bucket, so 1.4 and 1.6 sit either side of a level boundary.',
    example: 'scrutiny → 1.6 / 2, nearest level "Deep review"',
  },
  {
    name: 'Noul',
    type: 'Probabilistic',
    body: 'Estimates the probability that a proposition is true. A 50% reading is uncertainty about a yes/no question, not a middling severity.',
    example: 'refund requested → 6%',
  },
] as const;

function Learn() {
  return (
    <div className="wrap section">
      <div className="section__head">
        <h2 className="eyebrow">The primitives</h2>
        <p className="section__note">Three output shapes</p>
      </div>

      <div className="primitives">
        {PRIMITIVE_CARDS.map((card) => (
          <article className="card primitive" key={card.name}>
            <p className="primitive__type">{card.type}</p>
            <h3 className="primitive__name">{card.name}</h3>
            <p className="primitive__body">{card.body}</p>
            <p className="primitive__example">{card.example}</p>
          </article>
        ))}
      </div>

      <div className="learn-grid">
        <article className="card learn-card">
          <h3>Probability, confidence, and accuracy are three different things</h3>
          <ul>
            <li>
              A <strong>probability</strong> answers a question. “Is this time-sensitive?” → 0.98.
            </li>
            <li>
              <strong>Confidence</strong> describes the model&apos;s own answer quality for that
              judgment. It is self-reported and not automatically calibrated.
            </li>
            <li>
              <strong>Accuracy</strong> is measured against independent labels. Nothing on this site
              has been measured against anything.
            </li>
            <li>
              Noul returns no separate confidence value. The probability is the answer, which is why
              the two should not be treated as interchangeable.
            </li>
          </ul>
        </article>

        <article className="card learn-card">
          <h3>Where a language model is the better tool</h3>
          <ul>
            <li>Writing the reply, the summary, or the explanation a person actually reads.</li>
            <li>Open-ended reasoning where the shape of the answer is not known in advance.</li>
            <li>
              Working over long, sequential context where the task is comprehension, not a label.
            </li>
            <li>
              A typed decision interface gives up text generation on purpose. It cannot write the
              email for you; it can tell your code which queue the email belongs in.
            </li>
          </ul>
        </article>

        <article className="card learn-card">
          <h3>Why one request can hold many judgments</h3>
          <ul>
            <li>
              Questions over the same state are evaluated independently and in parallel, so a
              five-judgment call is one round trip rather than five.
            </li>
            <li>
              One answer cannot become hidden context for another, which keeps each judgment
              inspectable on its own.
            </li>
            <li>
              Your code composes the answers with thresholds, weights, and explicit review routes.
            </li>
          </ul>
        </article>

        <article className="card learn-card">
          <h3>What typed output does not buy you</h3>
          <ul>
            <li>
              Schema compliance is not correctness. A well-formed answer can still be the wrong
              answer.
            </li>
            <li>
              Detection is not action. Knowing a message contains an instruction does not make the
              message safe to follow.
            </li>
            <li>
              Classification is not extraction. Knowing a post contains contact details does not
              locate every span for redaction.
            </li>
            <li>
              A confidence reading is not a permission. High-impact actions need their own checks.
            </li>
          </ul>
        </article>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Method                                                                      */
/* -------------------------------------------------------------------------- */

const TRANSPORT_ROWS = [
  {
    route: 'OpenRouter decisions (verified)',
    endpoint: 'POST https://openrouter.ai/api/alpha/decisions',
    model: '~typesafe/jev-latest',
  },
  {
    route: 'TypeSafe direct (documented)',
    endpoint: 'POST https://api.typesafe.ai/v1/systemone',
    model: 'jev-latest',
  },
];

function Method() {
  return (
    <div className="wrap section">
      <div className="section__head">
        <h2 className="eyebrow">Method</h2>
        <p className="section__note">What is implemented, and what is not</p>
      </div>

      <p className="lede" style={{ marginTop: '1rem' }}>
        {MODE_STATEMENT}
      </p>

      <div className="method-grid">
        <article className="card method-card">
          <h3>Implemented in this release</h3>
          <ul>
            <li>Four scenarios, five judgments each, and fourteen synthetic presets.</li>
            <li>
              One authored illustration per preset, rendered identically in both lanes and labelled
              as a fixture in each.
            </li>
            <li>
              Exact-input matching. Edited text is rejected with an explicit error instead of a
              generated answer.
            </li>
            <li>
              An opt-in live mode that calls a server-side proxy for the Jev lane only, labelled
              with the resolved model id, request id, provider latency, tokens, and reported cost.
            </li>
            <li>
              A labelled JSON export containing the question and policy versions, the authored
              provenance, and null metrics.
            </li>
          </ul>
        </article>

        <article className="card method-card">
          <h3>Not implemented, and not claimed</h3>
          <ul>
            <li>
              Fixture mode connects to nothing and is the default. Live mode is opt-in per session
              and requires a presenter token that is never stored or bundled.
            </li>
            <li>
              Both lanes have a live adapter and run in parallel on the same input. Each is labelled
              with its own provider, resolved model, request id, latency, and reported cost, and
              each completes independently.
            </li>
            <li>
              No latency, token, or cost measurement exists in fixture mode. Those fields are null,
              not zero.
            </li>
            <li>
              No benchmark has been run, and no accuracy figure is reported anywhere. One live
              result is not a result about model quality.
            </li>
            <li>No tool is executed, no refund is approved, and no content is redacted.</li>
          </ul>
        </article>

        <article className="card method-card method-card--wide">
          <h3>How live mode is kept honest</h3>
          <ul>
            <li>
              The browser never holds the provider key. It calls a Cloudflare Worker that holds the
              key server-side and enforces a model allowlist, a presenter token, an origin
              allowlist, a rate limit, a body-size limit, a daily spend ceiling, and timeouts.
            </li>
            <li>
              A failed live call renders the failure. It never falls back to fixture values, and the
              endpoint&apos;s failure shape cannot carry answers at all.
            </li>
            <li>
              A response is validated against the questions that were asked before anything is
              rendered. A partly valid response is rejected whole rather than shown with holes.
            </li>
            <li>
              Late responses for replaced input are discarded, so a slow call can never overwrite a
              newer one.
            </li>
            <li>
              Two timings are reported because they measure different things: the provider&apos;s
              own latency, and the full round trip this browser observed including the proxy and the
              network. Quote the second one when describing a person&apos;s wait.
            </li>
          </ul>
        </article>

        <article className="card method-card method-card--wide">
          <h3>The two lanes are not the same kind of measurement</h3>
          <p>
            The typed lane&apos;s probabilities are produced by a training objective aimed at
            calibrated decisions. The language model&apos;s probabilities and confidence are{' '}
            <strong>self-reported</strong>: they are the model&apos;s own claim about its answer,
            and they are not calibrated or directly comparable. The lane says so on the card.
          </p>
          <p>
            They are also not the same order of cost. In one measured pair of calls on the same
            input, the typed lane returned in 217 ms for $0.0000216 while the language model took
            3932 ms and $0.001793. That is one call per arm — a smoke test of the comparison, not a
            benchmark — but the order of magnitude is the durable part.
          </p>
          <p>
            When the two arms disagree on the routing illustration, both outcomes are shown. When
            they agree, one outcome is shown, because there is nothing to compare. Neither outcome
            is executed.
          </p>
        </article>

        <article className="card method-card method-card--wide">
          <h3>Transport verified separately</h3>
          <p>
            The OpenRouter decisions transport was verified by real calls before this interface was
            wired to it, and a separate smoke test exercises the deployed proxy. That proves access
            and shape. It is not a quality result, and none of its numbers appear in fixture mode.
          </p>
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Route</th>
                <th scope="col">Endpoint</th>
                <th scope="col">Requested model</th>
              </tr>
            </thead>
            <tbody>
              {TRANSPORT_ROWS.map((row) => (
                <tr key={row.route}>
                  <td>{row.route}</td>
                  <td>
                    <code>{row.endpoint}</code>
                  </td>
                  <td>
                    <code>{row.model}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul>
            <li>
              <code>~typesafe/jev-latest</code> resolved to a dated model id, so provenance must
              record the resolved id alongside the requested alias.
            </li>
            <li>
              Score is a continuous position on the rubric, not an integer index, and it is never
              rounded in this interface.
            </li>
            <li>
              Confidence exists on choice and score answers. Noul returns the probability alone.
            </li>
            <li>
              One request carries every question for a state, so several judgments share one round
              trip.
            </li>
          </ul>
        </article>

        <article className="card method-card method-card--wide">
          <h3>Vendor claims, kept at arm&apos;s length</h3>
          <p>
            TypeSafe reports roughly 193.6× faster and 444.6× cheaper on its own workflow
            evaluations, an end-to-end range of 70–500 ms, input at $0.042 per million tokens, and
            free output. The vendor describes the speed and cost multiples as workflow-specific and
            on the high end of real-world gains.
          </p>
          <p>
            They are attributed here as vendor-reported context. They are not this project&apos;s
            measurements, they are not acceptance criteria, and a speed or cost headline is
            meaningless without the quality result and workload it came from.
          </p>
        </article>

        <article className="card method-card method-card--wide">
          <h3>How to read the routing slider</h3>
          <p>{THRESHOLD_DISCLAIMER}</p>
          <p>{UNTRUSTED_INPUT_QUOTE}</p>
          <ul>
            <li>
              It reads only the first Choice judgment. Nothing else in the illustration moves it.
            </li>
            <li>
              A tie, an unclear winner, a clarification request, or a no-tool outcome goes to a
              person at every threshold setting.
            </li>
            <li>
              A high injection reading is displayed and does not change routing. That is deliberate:
              this slider is not a security mechanism.
            </li>
            <li>No outcome is ever labelled approved, safe, or authorized.</li>
          </ul>
        </article>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* App                                                                         */
/* -------------------------------------------------------------------------- */

export default function App() {
  const [view, setView] = useState<View>(() => viewFromHash());

  const [scenarioId, setScenarioId] = useState<string>(DEFAULT_SCENARIO.id);
  const scenario = SCENARIOS.find((entry) => entry.id === scenarioId) ?? DEFAULT_SCENARIO;

  const [input, setInput] = useState('');
  const [result, setResult] = useState<
    { readonly scenarioId: string; readonly evaluation: FixtureEvaluation } | undefined
  >(undefined);
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD_PERCENT);
  const [mode, setMode] = useState<Mode>('fixture');
  const [token, setToken] = useState('');
  const [liveRuns, setLiveRuns] = useState<Readonly<Record<Lane, LiveLane>>>(IDLE_LANES);

  // One abort path and one sequence per lane, so a slow LLM call cannot cancel or
  // overwrite a fast typed call, and vice versa.
  const abortRef = useRef<Record<Lane, AbortController | null>>({ jev: null, llm: null });
  const seqRef = useRef<Record<Lane, number>>({ jev: 0, llm: 0 });

  useEffect(() => {
    const onHashChange = () => setView(viewFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(
    () => () => {
      for (const lane of LANE_ORDER) {
        abortRef.current[lane]?.abort();
      }
    },
    [],
  );

  const navigate = useCallback((next: View) => {
    window.location.hash = next;
    setView(next);
  }, []);

  /**
   * Clear every output and invalidate anything still in flight. A result belongs to the
   * scenario and the exact input that produced it; anything else is stale by definition
   * and is never rendered.
   */
  const resetOutputs = useCallback(() => {
    for (const lane of LANE_ORDER) {
      abortRef.current[lane]?.abort();
      abortRef.current[lane] = null;
      seqRef.current[lane] += 1;
    }
    setResult(undefined);
    setLiveRuns(IDLE_LANES);
  }, []);

  const active = result && result.scenarioId === scenario.id ? result.evaluation : undefined;
  const run = active?.ok && active.run.input === input ? active.run : null;
  const error = active && !active.ok ? active.error : null;

  const handleSelectScenario = useCallback(
    (next: string) => {
      setScenarioId(next);
      setInput('');
      resetOutputs();
    },
    [resetOutputs],
  );

  const handleInputChange = useCallback(
    (value: string) => {
      setInput(value);
      resetOutputs();
    },
    [resetOutputs],
  );

  const handleSelectPreset = useCallback(
    (value: string) => {
      setInput(value);
      resetOutputs();
    },
    [resetOutputs],
  );

  const handleModeChange = useCallback(
    (next: Mode) => {
      setMode(next);
      resetOutputs();
    },
    [resetOutputs],
  );

  /** Fire one arm. Each lane completes independently and never blocks the other. */
  const startLane = useCallback(
    (lane: Lane, target: Scenario, submittedInput: string) => {
      abortRef.current[lane]?.abort();
      const controller = new AbortController();
      abortRef.current[lane] = controller;

      const requestId = seqRef.current[lane] + 1;
      seqRef.current[lane] = requestId;

      setLiveRuns((current) => ({ ...current, [lane]: { kind: 'loading' } }));

      void requestDecision({
        scenario: target,
        state: submittedInput,
        lane,
        token,
        signal: controller.signal,
      }).then((outcome) => {
        // A late response for a replaced input must never reach the screen.
        if (seqRef.current[lane] !== requestId) {
          return;
        }

        const next: LiveLane = outcome.ok
          ? {
              kind: 'success',
              run: outcome,
              input: submittedInput,
              scenarioId: target.id,
            }
          : outcome.kind === 'cancelled'
            ? { kind: 'idle' }
            : {
                kind: 'error',
                failure: outcome,
                input: submittedInput,
                scenarioId: target.id,
              };

        setLiveRuns((current) => ({ ...current, [lane]: next }));
      });
    },
    [token],
  );

  const handleSubmit = useCallback(() => {
    if (mode === 'fixture') {
      setResult({ scenarioId: scenario.id, evaluation: evaluateFixture(scenario, input) });
      return;
    }

    // Both arms run in parallel on the same input, each with its own abort path and
    // its own completion. The LLM lane takes seconds where the typed lane takes
    // milliseconds, so serialising them would make the demo needlessly slow and would
    // hide the difference the comparison exists to show.
    for (const lane of LANE_ORDER) {
      startLane(lane, scenario, input);
    }
  }, [mode, scenario, input, startLane]);

  const laneStateFor = useCallback(
    (lane: Lane): LaneState => {
      if (mode === 'fixture') {
        return run
          ? { kind: 'fixture', illustration: run.illustration }
          : { kind: 'empty', illustrative: true };
      }

      const state = liveRuns[lane];

      if (state.kind === 'loading') {
        return { kind: 'loading' };
      }

      const isCurrent =
        (state.kind === 'success' || state.kind === 'error') &&
        state.input === input &&
        state.scenarioId === scenario.id;

      if (state.kind === 'success' && isCurrent) {
        return {
          kind: 'live',
          answers: state.run.answers,
          provenance: {
            provider: state.run.provider,
            model: state.run.model,
            generationId: state.run.generationId,
            latencyMs: state.run.latencyMs,
            clientDurationMs: state.run.clientDurationMs,
            costUsd: state.run.usage.costUsd,
            inputTokens: state.run.usage.inputTokens,
            outputTokens: state.run.usage.outputTokens,
          },
        };
      }

      if (state.kind === 'error' && isCurrent) {
        return {
          kind: 'error',
          status: state.failure.status,
          message: state.failure.message,
          detail: state.failure.detail,
        };
      }

      return { kind: 'empty', illustrative: false };
    },
    [mode, run, liveRuns, input, scenario.id],
  );

  const jevState = laneStateFor('jev');
  const llmState = laneStateFor('llm');

  const answersFor = useCallback(
    (lane: Lane): AnswerSet | null => {
      if (mode === 'fixture') {
        return run?.illustration.answers ?? null;
      }
      const state = liveRuns[lane];
      return state.kind === 'success' && state.input === input && state.scenarioId === scenario.id
        ? state.run.answers
        : null;
    },
    [mode, run, liveRuns, input, scenario.id],
  );

  const routeFor = useCallback(
    (lane: Lane): RoutingIllustration | null => {
      const answers = answersFor(lane);
      return answers ? illustrateRouting(scenario, answers, threshold) : null;
    },
    [answersFor, scenario, threshold],
  );

  const jevRouting = routeFor('jev');
  const llmRouting = routeFor('llm');

  const exportJson = useMemo(
    () =>
      mode === 'fixture' && run
        ? JSON.stringify(buildExport(run, scenario, threshold), null, 2)
        : null,
    [mode, run, scenario, threshold],
  );

  /**
   * Built on demand rather than held in state: a blob URL is a side effect, and a
   * fixture that is no longer on screen must not still be downloadable.
   */
  const handleDownload = useCallback(() => {
    if (!exportJson || !run) {
      return;
    }

    const url = URL.createObjectURL(new Blob([exportJson], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = exportFilename(scenario.id, run.presetId);
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [exportJson, run, scenario.id]);

  const liveSummary = useMemo(() => {
    if (mode !== 'live') {
      return '';
    }

    const jev = liveRuns.jev;
    const llm = liveRuns.llm;

    if (jev.kind === 'loading' || llm.kind === 'loading') {
      const waiting = jev.kind === 'loading' ? 'the typed lane' : 'the language model';
      return `Waiting for ${waiting}. The two arms run in parallel and finish independently.`;
    }

    if (jev.kind === 'success' && llm.kind === 'success') {
      return `Live: ${jev.run.model} in ${jev.run.clientDurationMs} ms for ${formatCost(jev.run.usage.costUsd)}, against ${llm.run.model} via ${llm.run.provider} in ${llm.run.clientDurationMs} ms for ${formatCost(llm.run.usage.costUsd)}.`;
    }

    const failed = [jev, llm].find((entry) => entry.kind === 'error');
    if (failed && failed.kind === 'error') {
      return `Live call failed (HTTP ${failed.failure.status}): ${failed.failure.message}`;
    }

    if (jev.kind === 'success') {
      return `Typed lane answered in ${jev.run.clientDurationMs} ms. The other lane has not returned.`;
    }

    if (llm.kind === 'success') {
      return `Language model answered in ${llm.run.clientDurationMs} ms. The other lane has not returned.`;
    }

    return 'Live mode is on. Submit to call both providers.';
  }, [mode, liveRuns]);

  const announcement = useMemo(() => {
    if (mode === 'fixture') {
      return run && jevRouting
        ? `Illustrative comparison shown. ${routingSentence(scenario, jevRouting)}`
        : '';
    }

    if (liveRuns.jev.kind === 'loading' || liveRuns.llm.kind === 'loading') {
      return 'Live comparison in progress.';
    }

    if (jevRouting) {
      return `Live comparison complete. ${routingSentence(scenario, jevRouting)}`;
    }

    const failed = liveRuns.jev.kind === 'error' ? liveRuns.jev : null;
    return failed ? `Live call failed: ${failed.failure.message}` : '';
  }, [mode, run, jevRouting, scenario, liveRuns]);

  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <Header view={view} mode={mode} onNavigate={navigate} />

      <main id="main">
        {view === 'explore' ? (
          <Explore
            scenario={scenario}
            input={input}
            run={run}
            error={error}
            mode={mode}
            token={token}
            jevState={jevState}
            llmState={llmState}
            jevRouting={jevRouting}
            llmRouting={llmRouting}
            liveSummary={liveSummary}
            threshold={threshold}
            exportJson={exportJson}
            announcement={announcement}
            onSelectScenario={handleSelectScenario}
            onInputChange={handleInputChange}
            onSelectPreset={handleSelectPreset}
            onSubmit={handleSubmit}
            onThresholdChange={setThreshold}
            onDownload={handleDownload}
            onModeChange={handleModeChange}
            onTokenChange={setToken}
          />
        ) : null}

        {view === 'learn' ? <Learn /> : null}
        {view === 'present' ? <Presentation onOpenLab={() => navigate('explore')} /> : null}
        {view === 'method' ? <Method /> : null}
      </main>

      <footer className="footer wrap">
        <p>
          Decision Lab is an independent experiment. It is not affiliated with TypeSafe, LangChain,
          or OpenRouter.
        </p>
        <p>
          Every input here is synthetic and every number is authored. No model is called, no tool is
          executed, and no scenario text leaves this page.
        </p>
        <p className="footer__links">
          <a href="#method">Method</a>
          <a href="#learn">Primitives</a>
          <a href="#present">Presenter guide</a>
        </p>
      </footer>
    </div>
  );
}
