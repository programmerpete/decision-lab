import type { AnswerSet, ChoiceQuestion, Illustration, Lane, QuestionSet } from './domain';
import {
  LANES,
  PRIMITIVE_LABEL,
  formatCost,
  formatPercent,
  formatScore,
  legendText,
  nearestLevel,
} from './domain';

/** Provenance for one live call. Every field is reported by the provider or measured here. */
export interface LiveProvenance {
  readonly provider: string;
  readonly model: string;
  readonly generationId: string;
  /** What the provider reported for its own work. */
  readonly latencyMs: number;
  /** The whole round trip as this browser observed it, including the Worker. */
  readonly clientDurationMs: number;
  readonly costUsd: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
}

/**
 * What a lane is currently showing. The variants exist so that "we have not run
 * anything" and "we ran something and it failed" cannot be confused with "here is a
 * result" — and so a live failure can never be rendered with fixture values.
 */
export type LaneState =
  | { readonly kind: 'empty' }
  | { readonly kind: 'fixture'; readonly illustration: Illustration }
  | { readonly kind: 'loading' }
  | {
      readonly kind: 'live';
      readonly answers: AnswerSet;
      readonly provenance: LiveProvenance;
    }
  | {
      readonly kind: 'error';
      readonly status: number;
      readonly message: string;
      readonly detail: string | null;
    }
  | { readonly kind: 'unavailable'; readonly reason: string };

interface JudgmentProps {
  readonly question: QuestionSet[number];
  readonly answer: AnswerSet[number];
}

function ChoiceJudgment({
  question,
  answer,
}: {
  readonly question: ChoiceQuestion;
  readonly answer: Extract<AnswerSet[number], { type: 'choice' }>;
}) {
  const selected = question.options.find((option) => option.key === answer.choice);

  return (
    <>
      <p className="judgment__answer">{selected?.label ?? answer.choice}</p>
      <div className="bars">
        {question.options.map((option) => {
          const probability = answer.probabilities[option.key] ?? 0;
          const isWinner = option.key === answer.choice;

          return (
            <div className={isWinner ? 'bar bar--winner' : 'bar'} key={option.key}>
              <span className="bar__label">{option.label}</span>
              <span className="bar__track" aria-hidden="true">
                <span
                  className="bar__fill"
                  style={{ width: `${Math.max(probability * 100, 1)}%` }}
                />
              </span>
              <span className="bar__value">{formatPercent(probability)}</span>
            </div>
          );
        })}
      </div>
      <p className="judgment__caption">Confidence {answer.confidence.toFixed(2)}</p>
    </>
  );
}

function ScoreJudgment({
  question,
  answer,
}: {
  readonly question: Extract<QuestionSet[number], { primitive: 'score' }>;
  readonly answer: Extract<AnswerSet[number], { type: 'score' }>;
}) {
  const nearest = nearestLevel(answer.score, question.criteria);

  return (
    <>
      {/* The raw position stays visible. A score is not an integer bucket. */}
      <p className="judgment__answer">{formatScore(answer.score, question.criteria)}</p>
      <p className="judgment__legend">{legendText(answer.legend)}</p>
      {nearest ? (
        <p className="judgment__caption">
          Nearest level {nearest.index}: {nearest.label} · confidence {answer.confidence.toFixed(2)}
        </p>
      ) : null}
    </>
  );
}

function NoulJudgment({
  answer,
  illustrative,
}: {
  readonly answer: Extract<AnswerSet[number], { type: 'noul' }>;
  readonly illustrative: boolean;
}) {
  return (
    <>
      <p className="judgment__answer">{formatPercent(answer.noul)}</p>
      <p className="judgment__caption">
        {illustrative ? 'Illustrative probability of yes' : 'Probability of yes'}
      </p>
    </>
  );
}

function Judgment({
  question,
  answer,
  illustrative,
}: JudgmentProps & { readonly illustrative: boolean }) {
  return (
    <li className="judgment">
      <div className="judgment__head">
        <h4 className="judgment__title">{question.title}</h4>
        <span className="badge badge--chip">{PRIMITIVE_LABEL[question.primitive]}</span>
      </div>

      {answer.type === 'choice' && question.primitive === 'choice' ? (
        <ChoiceJudgment question={question} answer={answer} />
      ) : null}

      {answer.type === 'score' && question.primitive === 'score' ? (
        <ScoreJudgment question={question} answer={answer} />
      ) : null}

      {answer.type === 'noul' ? <NoulJudgment answer={answer} illustrative={illustrative} /> : null}
    </li>
  );
}

function Metric({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="metric">
      <span className="metric__label">{label}</span>
      <span className="metric__value">{value}</span>
    </div>
  );
}

function LaneFooter({ state }: { readonly state: LaneState }) {
  if (state.kind === 'live') {
    return (
      <footer className="lane__footer">
        <Metric label="Provider latency" value={`${state.provenance.latencyMs} ms`} />
        <Metric label="End to end" value={`${state.provenance.clientDurationMs} ms`} />
        <Metric label="API cost" value={`${formatCost(state.provenance.costUsd)} reported`} />
        <Metric label="Live connection" value="Configured" />
        <Metric label="Model" value={state.provenance.model} />
        <Metric
          label="Tokens"
          value={`${state.provenance.inputTokens} in / ${state.provenance.outputTokens} out`}
        />
        <Metric label="Request" value={state.provenance.generationId} />
      </footer>
    );
  }

  return (
    <footer className="lane__footer">
      <Metric label="Latency" value={state.kind === 'loading' ? 'In flight' : 'Not measured'} />
      <Metric label="API cost" value="Not measured" />
      <Metric
        label="Live connection"
        value={
          state.kind === 'loading'
            ? 'Configured'
            : state.kind === 'error'
              ? 'Failed'
              : 'Not configured'
        }
      />
    </footer>
  );
}

function LaneBody({
  lane,
  questions,
  state,
}: {
  readonly lane: Lane;
  readonly questions: QuestionSet;
  readonly state: LaneState;
}) {
  if (state.kind === 'loading') {
    return (
      <div className="lane__empty">
        <strong>Waiting for the provider.</strong>
        <span>One request carries all five judgments.</span>
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <div className="lane__error" role="alert">
        <p className="lane__error-head">Live call failed · HTTP {state.status}</p>
        <p>{state.message}</p>
        {state.detail ? <p className="lane__error-detail">{state.detail}</p> : null}
        <p className="lane__error-note">
          No fixture values are shown in their place. Fix the cause and submit again, or switch back
          to fixture mode.
        </p>
      </div>
    );
  }

  if (state.kind === 'unavailable') {
    return (
      <div className="lane__empty">
        <strong>No live adapter for this lane.</strong>
        <span>{state.reason}</span>
      </div>
    );
  }

  if (state.kind === 'fixture' || state.kind === 'live') {
    const illustrative = state.kind === 'fixture';
    const answers = illustrative ? state.illustration.answers : state.answers;

    return (
      <ol className="judgments">
        {questions.map((question, index) => {
          const answer = answers[index];
          if (!answer) {
            return null;
          }
          return (
            <Judgment
              key={`${lane}-${question.id}`}
              question={question}
              answer={answer}
              illustrative={illustrative}
            />
          );
        })}
      </ol>
    );
  }

  return (
    <div className="lane__empty">
      <strong>The same question. A different kind of model.</strong>
      <span>Awaiting illustrative example.</span>
    </div>
  );
}

interface ResultLaneProps {
  readonly lane: Lane;
  readonly questions: QuestionSet;
  readonly state: LaneState;
}

export default function ResultLane({ lane, questions, state }: ResultLaneProps) {
  const meta = LANES[lane];

  return (
    <section className="card panel lane" aria-label={`${meta.name} result lane`}>
      <header className="lane__head">
        <span className="lane__glyph" aria-hidden="true">
          {meta.glyph}
        </span>
        <span className="lane__heading">
          <span className="lane__title">{meta.name}</span>
          <span className="lane__sub">{meta.interfaceLabel}</span>
        </span>
        <span className={state.kind === 'live' ? 'badge badge--live' : 'badge badge--fixture'}>
          {state.kind === 'live' ? 'Live' : 'Fixture'}
        </span>
      </header>

      <LaneBody lane={lane} questions={questions} state={state} />
      <LaneFooter state={state} />
    </section>
  );
}
