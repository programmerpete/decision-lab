/**
 * Decision Lab — domain contracts.
 *
 * This module owns the shape of everything the site can say about a decision, and it
 * owns the rules that stop the site from saying more than it knows.
 *
 * The central invariant: a lane's metrics are typed `Unmeasured` (that is, `null`), so
 * an authored number cannot be assigned to a latency, cost, or token field even by
 * mistake. There is no `'live'` member of `RunSource` in this release. Both lanes are
 * built from one shared `Illustration`, so there is no API for giving the two lanes
 * different answers.
 *
 * No React imports belong in this file.
 */

/* -------------------------------------------------------------------------- */
/* Primitives                                                                  */
/* -------------------------------------------------------------------------- */

/** The three typed judgments a System One model can return. */
export type Primitive = 'choice' | 'score' | 'noul';

/**
 * What application code is allowed to do with a winning option. Only
 * `recommendation` can produce a suggestion in the routing illustration; everything
 * else routes to human review regardless of probability.
 */
export type Disposition = 'recommendation' | 'human-review' | 'clarification' | 'no-tool';

export const PRIMITIVE_LABEL: Readonly<Record<Primitive, string>> = {
  choice: 'Choice',
  score: 'Score',
  noul: 'Noul',
};

/* -------------------------------------------------------------------------- */
/* Questions                                                                   */
/* -------------------------------------------------------------------------- */

export interface ChoiceOption {
  readonly key: string;
  readonly label: string;
  readonly disposition: Disposition;
}

export interface ChoiceQuestion {
  readonly primitive: 'choice';
  readonly id: string;
  readonly title: string;
  /** The question text sent to a model. Displayed as the decision policy. */
  readonly prompt: string;
  readonly options: readonly ChoiceOption[];
  /** Option key to description. Mirrors the verified `criteria` object map. */
  readonly criteria: Readonly<Record<string, string>>;
}

export interface ScoreQuestion {
  readonly primitive: 'score';
  readonly id: string;
  readonly title: string;
  readonly prompt: string;
  /** Ordered level descriptions. A score is a position in [0, length - 1], not a bucket. */
  readonly criteria: readonly string[];
}

export interface NoulQuestion {
  readonly primitive: 'noul';
  readonly id: string;
  readonly title: string;
  readonly prompt: string;
  /** Optional in the verified API shape, and optional here. */
  readonly criteria?: string;
}

export type Question = ChoiceQuestion | ScoreQuestion | NoulQuestion;

/** Every scenario asks exactly five judgments, and the first one drives routing. */
export type QuestionSet = readonly [ChoiceQuestion, Question, Question, Question, Question];

/* -------------------------------------------------------------------------- */
/* Answers — these mirror the verified wire shapes exactly                      */
/* -------------------------------------------------------------------------- */

export interface ChoiceAnswer {
  readonly type: 'choice';
  readonly choice: string;
  readonly confidence: number;
  readonly probabilities: Readonly<Record<string, number>>;
}

export interface ScoreAnswer {
  readonly type: 'score';
  /** Continuous position on the rubric, not an integer index. */
  readonly score: number;
  readonly confidence: number;
  /** Stringified rubric index to level description, exactly as the provider returns it. */
  readonly legend: Readonly<Record<string, string>>;
  /** Stringified rubric index to probability. Mirrors the provider's object map. */
  readonly probabilities: Readonly<Record<string, number>>;
}

export interface NoulAnswer {
  readonly type: 'noul';
  /**
   * Probability that the proposition is true. There is deliberately no `confidence`
   * field: the verified API does not return one for noul, and the probability is the
   * answer.
   */
  readonly noul: number;
}

export type AuthoredAnswer = ChoiceAnswer | ScoreAnswer | NoulAnswer;

export type AnswerSet = readonly [
  AuthoredAnswer,
  AuthoredAnswer,
  AuthoredAnswer,
  AuthoredAnswer,
  AuthoredAnswer,
];

/* -------------------------------------------------------------------------- */
/* Scenarios and presets                                                       */
/* -------------------------------------------------------------------------- */

export interface Preset {
  readonly id: string;
  readonly label: string;
  /** The exact string that must be submitted verbatim for this fixture to match. */
  readonly input: string;
  readonly answers: AnswerSet;
  /** Why these authored values teach what they teach. */
  readonly note: string;
}

export interface Scenario {
  readonly id: string;
  readonly index: number;
  readonly tabLabel: string;
  readonly title: string;
  readonly sub: string;
  readonly inputBadge: string;
  readonly inputPrompt: string;
  readonly policy: string;
  readonly boundary: string;
  readonly questionSetVersion: number;
  readonly policyVersion: number;
  /** How a winning option is phrased, e.g. "Suggested route". */
  readonly suggestionLabel: string;
  readonly questions: QuestionSet;
  readonly presets: readonly Preset[];
}

/* -------------------------------------------------------------------------- */
/* Provenance wall                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Only `null` is assignable. A measured number cannot reach a metric field, because
 * no numeric value is a member of this type.
 */
export type Unmeasured = null;

export interface LaneDescriptor {
  readonly outcome: 'not-run';
  readonly provider: null;
  readonly modelId: null;
  readonly connection: 'not-configured';
  readonly latencyMs: Unmeasured;
  readonly apiCostUsd: Unmeasured;
  readonly tokens: Unmeasured;
}

export type Lane = 'jev' | 'llm';

export interface LaneMeta {
  readonly lane: Lane;
  readonly name: string;
  readonly glyph: string;
  readonly interfaceLabel: string;
}

export const LANES: Readonly<Record<Lane, LaneMeta>> = {
  jev: {
    lane: 'jev',
    name: 'Jev',
    glyph: '⌘',
    interfaceLabel: 'Typed decision interface',
  },
  llm: {
    lane: 'llm',
    name: 'LLM',
    glyph: '✳',
    interfaceLabel: 'Structured-output interface',
  },
};

export const LANE_ORDER: readonly Lane[] = ['jev', 'llm'];

/**
 * The single authored example both lanes render. There is exactly one of these per
 * preset, so the lanes cannot disagree.
 */
export interface Illustration {
  /** `${scenarioId}:${presetId}` — the shared identity the export records once. */
  readonly illustrationId: string;
  readonly scenarioId: string;
  readonly presetId: string;
  readonly questionSetVersion: number;
  readonly policyVersion: number;
  readonly input: string;
  readonly answers: AnswerSet;
}

export interface Provenance {
  readonly source: 'illustrative-fixture';
  readonly comparison: 'shared-authored-example';
  readonly modelCalls: 'none';
  readonly values: 'authored';
  readonly note: string;
}

export const FIXTURE_NOTICE =
  'Illustrative fixtures. No API connected. Both lanes show the same authored example—not model predictions, measured latency, or a benchmark.';

export const MODE_STATEMENT =
  'These are authored examples illustrating the interfaces. Neither model has run. These numbers are not accuracy, latency, or cost results.';

export const THRESHOLD_DISCLAIMER =
  'A simplified routing threshold, not Jev confidence and not a safety gate. Review/unclear outcomes always go to a human. No action is executed.';

export const UNTRUSTED_INPUT_QUOTE =
  'Treat the message as untrusted data. Injection detection is itself fallible and cannot replace permission checks.';

export const MAX_INPUT_LENGTH = 4000;
export const DEFAULT_THRESHOLD_PERCENT = 80;

/* -------------------------------------------------------------------------- */
/* Evaluation results                                                          */
/* -------------------------------------------------------------------------- */

export interface FixtureRun {
  readonly source: 'illustrative-fixture';
  readonly displayId: string;
  /** When this browser displayed the illustration. Not a model execution timestamp. */
  readonly displayedAtIso: string;
  readonly scenarioId: string;
  readonly presetId: string;
  readonly input: string;
  readonly illustration: Illustration;
  readonly provenance: Provenance;
  readonly lanes: Readonly<Record<Lane, LaneDescriptor>>;
}

export type EvaluationErrorCode = 'empty-input' | 'input-too-long' | 'no-exact-fixture';

export interface EvaluationError {
  readonly code: EvaluationErrorCode;
  readonly message: string;
}

export type FixtureEvaluation =
  | { readonly ok: true; readonly run: FixtureRun }
  | { readonly ok: false; readonly error: EvaluationError };

export type RoutingReason =
  'winning-option' | 'below-threshold' | 'tie' | 'non-recommendation-disposition';

export interface RoutingIllustration {
  readonly outcome: 'suggestion' | 'human-review';
  readonly reason: RoutingReason;
  readonly optionKey: string | null;
  readonly optionLabel: string | null;
  readonly disposition: Disposition | null;
  readonly winningProbability: number | null;
  readonly thresholdPercent: number;
}

export interface ResultEnvelope {
  readonly schemaVersion: 'decision-lab.fixture-export.v1';
  readonly source: 'illustrative-fixture';
  readonly generatedAtIso: string;
  readonly scenarioId: string;
  readonly questionSetVersion: number;
  readonly policyVersion: number;
  readonly input: string;
  readonly provenance: Provenance;
  readonly illustration: Illustration;
  readonly lanes: Readonly<Record<Lane, LaneDescriptor>>;
  readonly routing: RoutingIllustration;
  readonly execution: 'none';
}

/* -------------------------------------------------------------------------- */
/* Construction                                                                */
/* -------------------------------------------------------------------------- */

function unmeasuredLane(): LaneDescriptor {
  return {
    outcome: 'not-run',
    provider: null,
    modelId: null,
    connection: 'not-configured',
    latencyMs: null,
    apiCostUsd: null,
    tokens: null,
  };
}

export function illustrationFor(scenario: Scenario, preset: Preset): Illustration {
  return {
    illustrationId: `${scenario.id}:${preset.id}`,
    scenarioId: scenario.id,
    presetId: preset.id,
    questionSetVersion: scenario.questionSetVersion,
    policyVersion: scenario.policyVersion,
    input: preset.input,
    answers: preset.answers,
  };
}

/**
 * Match submitted text against the authored catalogue.
 *
 * Matching is exact. No trimming, case folding, keyword matching, Unicode
 * normalization, fuzzy matching, or fallback. An unmatched input is an explicit
 * error, because inventing an answer would misrepresent what the site knows.
 */
export function evaluateFixture(scenario: Scenario, rawInput: string): FixtureEvaluation {
  if (rawInput.length === 0) {
    return {
      ok: false,
      error: { code: 'empty-input', message: 'Enter a message to compare against the fixtures.' },
    };
  }

  if (rawInput.length > MAX_INPUT_LENGTH) {
    return {
      ok: false,
      error: {
        code: 'input-too-long',
        message: `Input is ${rawInput.length} characters. The limit is ${MAX_INPUT_LENGTH}.`,
      },
    };
  }

  const preset = scenario.presets.find((candidate) => candidate.input === rawInput);

  if (!preset) {
    return {
      ok: false,
      error: {
        code: 'no-exact-fixture',
        message:
          'No authored fixture matches this text exactly. Edited inputs need a live provider, and this build has none, so it will not fabricate an answer. Choose a preset to see the illustration.',
      },
    };
  }

  const illustration = structuredClone(illustrationFor(scenario, preset));

  return {
    ok: true,
    run: {
      source: 'illustrative-fixture',
      displayId: illustration.illustrationId,
      displayedAtIso: new Date().toISOString(),
      scenarioId: scenario.id,
      presetId: preset.id,
      input: illustration.input,
      illustration,
      provenance: {
        source: 'illustrative-fixture',
        comparison: 'shared-authored-example',
        modelCalls: 'none',
        values: 'authored',
        note: 'Authored by the Decision Lab maintainers to illustrate an interface. No provider was contacted.',
      },
      lanes: { jev: unmeasuredLane(), llm: unmeasuredLane() },
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Application policy illustration                                             */
/* -------------------------------------------------------------------------- */

/**
 * Illustrate one application-level routing rule: look at the first Choice judgment,
 * require a clear winner that is allowed to be acted on, and require it to clear a
 * threshold the presenter sets.
 *
 * This is deliberately narrow. It is not a safety gate, it is not Jev confidence, and
 * it has no injection or PII override. A high injection reading is displayed in the
 * lane and does not change routing here.
 */
export function illustrateRouting(
  scenario: Scenario,
  answers: AnswerSet,
  thresholdPercent: number,
): RoutingIllustration {
  const question = scenario.questions[0];
  const answer = answers[0];

  if (answer.type !== 'choice') {
    throw new Error(`Scenario ${scenario.id} must lead with a Choice judgment.`);
  }

  const entries = Object.entries(answer.probabilities);
  const winningProbability = Math.max(...entries.map(([, value]) => value));
  const winners = entries.filter(([, value]) => value === winningProbability);

  if (winners.length !== 1) {
    return {
      outcome: 'human-review',
      reason: 'tie',
      optionKey: null,
      optionLabel: null,
      disposition: null,
      winningProbability,
      thresholdPercent,
    };
  }

  const winner = winners[0]!;
  const optionKey = winner[0];
  const option = question.options.find((candidate) => candidate.key === optionKey);

  if (!option) {
    throw new Error(
      `Choice answer for ${scenario.id} returned "${optionKey}", which is not an option.`,
    );
  }

  if (option.disposition !== 'recommendation') {
    return {
      outcome: 'human-review',
      reason: 'non-recommendation-disposition',
      optionKey,
      optionLabel: option.label,
      disposition: option.disposition,
      winningProbability,
      thresholdPercent,
    };
  }

  if (winningProbability * 100 < thresholdPercent) {
    return {
      outcome: 'human-review',
      reason: 'below-threshold',
      optionKey,
      optionLabel: option.label,
      disposition: option.disposition,
      winningProbability,
      thresholdPercent,
    };
  }

  return {
    outcome: 'suggestion',
    reason: 'winning-option',
    optionKey,
    optionLabel: option.label,
    disposition: option.disposition,
    winningProbability,
    thresholdPercent,
  };
}

export function routingSentence(scenario: Scenario, routing: RoutingIllustration): string {
  if (routing.outcome === 'suggestion' && routing.optionLabel) {
    return `${scenario.suggestionLabel}: ${routing.optionLabel}`;
  }

  switch (routing.reason) {
    case 'tie':
      return 'Human review: two options are tied';
    case 'non-recommendation-disposition':
      return `Human review: ${routing.optionLabel ?? 'this option'} is never auto-routed`;
    case 'below-threshold':
      return `Human review: ${routing.optionLabel ?? 'the winner'} is below the threshold`;
    default:
      return 'Human review';
  }
}

/**
 * Explain the routing illustration in one sentence.
 *
 * The two branches say deliberately different things. A definite suggestion needs the
 * reassurance that nothing was executed; a human-review outcome needs to say who acts
 * next instead, because "nothing is executed" is already covered by the threshold
 * disclaimer above it. So the "teaching illustration" wording appears only in live mode
 * with a definite outcome, and is absent otherwise by design rather than by omission.
 */
export function routingDetail(routing: RoutingIllustration | null, illustrative: boolean): string {
  if (!routing || routing.winningProbability === null) {
    return 'No winning option to evaluate yet.';
  }

  const percent = formatPercent(routing.winningProbability);
  const basis = `${percent} was the winning-option probability at a ${routing.thresholdPercent}% threshold.`;

  if (routing.outcome !== 'suggestion') {
    return `${basis} A person decides what happens next.`;
  }

  return illustrative
    ? `${basis} This is an illustration, not an execution.`
    : `${basis} The routing rule is a teaching illustration and nothing is executed.`;
}

export function buildExport(
  run: FixtureRun,
  scenario: Scenario,
  thresholdPercent: number,
): ResultEnvelope {
  return {
    schemaVersion: 'decision-lab.fixture-export.v1',
    source: 'illustrative-fixture',
    generatedAtIso: run.displayedAtIso,
    scenarioId: scenario.id,
    questionSetVersion: scenario.questionSetVersion,
    policyVersion: scenario.policyVersion,
    input: run.input,
    provenance: run.provenance,
    illustration: run.illustration,
    lanes: run.lanes,
    routing: illustrateRouting(scenario, run.illustration.answers, thresholdPercent),
    execution: 'none',
  };
}

export function exportFilename(scenarioId: string, presetId: string): string {
  return `decisionlab-${scenarioId}-${presetId}-illustrative-fixture.json`;
}

/* -------------------------------------------------------------------------- */
/* Formatting helpers                                                          */
/* -------------------------------------------------------------------------- */

export function formatPercent(value: number): string {
  const percent = value * 100;
  const rounded = Math.round(percent * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
}

export function formatScore(score: number, criteria: readonly string[]): string {
  const top = criteria.length - 1;
  const rounded = Math.round(score * 100) / 100;
  return `${rounded} / ${top}`;
}

/**
 * A score is a position, not a bucket. Return the rubric level it sits nearest to,
 * while the caller keeps the raw value visible.
 */
export function nearestLevel(
  score: number,
  criteria: readonly string[],
): { readonly index: number; readonly label: string } | null {
  const top = criteria.length - 1;
  const index = Math.round(Math.min(Math.max(score, 0), top));
  const label = criteria[index];
  return label === undefined ? null : { index, label };
}

export function legendText(legend: Readonly<Record<string, string>>): string {
  return Object.keys(legend)
    .sort((left, right) => Number(left) - Number(right))
    .map((key) => `${key} ${legend[key] ?? ''}`.trim())
    .join(' · ');
}

/** Provider-reported cost, kept at a precision that does not round a real charge to zero. */
export function formatCost(costUsd: number): string {
  if (!Number.isFinite(costUsd) || costUsd < 0) {
    return 'Not reported';
  }
  if (costUsd === 0) {
    return '$0.00';
  }
  return costUsd < 0.01 ? `$${costUsd.toFixed(7)}` : `$${costUsd.toFixed(4)}`;
}

/* -------------------------------------------------------------------------- */
/* Catalogue validation                                                        */
/* -------------------------------------------------------------------------- */

export interface CatalogueProblem {
  readonly where: string;
  readonly message: string;
}

function isFiniteUnitInterval(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

function sumsToOne(values: readonly number[]): boolean {
  const total = values.reduce((sum, value) => sum + value, 0);
  return Math.abs(total - 1) < 1e-9;
}

/**
 * Structural checks over the authored catalogue. Returns every problem it finds
 * rather than throwing on the first, so a failing test names all of them.
 */
export function validateCatalogue(scenarios: readonly Scenario[]): readonly CatalogueProblem[] {
  const problems: CatalogueProblem[] = [];
  const add = (where: string, message: string) => problems.push({ where, message });

  const scenarioIds = new Set<string>();

  for (const scenario of scenarios) {
    const at = `scenario ${scenario.id}`;

    if (scenarioIds.has(scenario.id)) {
      add(at, 'duplicate scenario id');
    }
    scenarioIds.add(scenario.id);

    if (scenario.questions.length !== 5) {
      add(at, `expected 5 questions, found ${scenario.questions.length}`);
    }

    if (scenario.questions[0].primitive !== 'choice') {
      add(at, 'the first question must be a Choice judgment because routing reads it');
    }

    const questionIds = new Set<string>();
    const optionKeys = new Set<string>();

    for (const question of scenario.questions) {
      if (questionIds.has(question.id)) {
        add(`${at} / question ${question.id}`, 'duplicate question id');
      }
      questionIds.add(question.id);

      if (question.primitive === 'score') {
        if (question.criteria.length < 2) {
          add(`${at} / ${question.id}`, 'a Score rubric needs at least two levels');
        }
      }

      if (question.primitive === 'choice') {
        const keys = question.options.map((option) => option.key);
        if (new Set(keys).size !== keys.length) {
          add(`${at} / ${question.id}`, 'duplicate option key');
        }
        for (const key of keys) {
          if (!(key in question.criteria)) {
            add(`${at} / ${question.id}`, `option "${key}" has no criteria description`);
          }
        }
        for (const key of Object.keys(question.criteria)) {
          if (!keys.includes(key)) {
            add(`${at} / ${question.id}`, `criteria describes unknown option "${key}"`);
          }
        }
        for (const key of keys) {
          optionKeys.add(`${question.id}.${key}`);
        }
      }
    }

    if (scenario.presets.length === 0) {
      add(at, 'has no presets');
    }

    const inputs = new Set<string>();
    const presetIds = new Set<string>();

    for (const preset of scenario.presets) {
      const presetAt = `${at} / preset ${preset.id}`;

      if (presetIds.has(preset.id)) {
        add(presetAt, 'duplicate preset id');
      }
      presetIds.add(preset.id);

      if (inputs.has(preset.input)) {
        add(presetAt, 'duplicate preset input within the scenario');
      }
      inputs.add(preset.input);

      if (preset.input.length === 0) {
        add(presetAt, 'empty input');
      }

      if (preset.input.length > MAX_INPUT_LENGTH) {
        add(presetAt, `input is ${preset.input.length} characters, over ${MAX_INPUT_LENGTH}`);
      }

      if (preset.answers.length !== scenario.questions.length) {
        add(
          presetAt,
          `has ${preset.answers.length} answers for ${scenario.questions.length} questions`,
        );
        continue;
      }

      preset.answers.forEach((answer, index) => {
        const question = scenario.questions[index];

        if (!question) {
          add(presetAt, 'has more answers than the scenario has questions');
          return;
        }

        const answerAt = `${presetAt} / ${question.id}`;

        if (answer.type !== question.primitive) {
          add(answerAt, `answer type "${answer.type}" does not match "${question.primitive}"`);
          return;
        }

        if (answer.type === 'choice' && question.primitive === 'choice') {
          const expectedKeys = question.options.map((option) => option.key).sort();
          const actualKeys = Object.keys(answer.probabilities).sort();

          if (expectedKeys.join('|') !== actualKeys.join('|')) {
            add(answerAt, 'probability keys do not match the option keys exactly');
            return;
          }

          const values = Object.values(answer.probabilities);
          if (!values.every(isFiniteUnitInterval)) {
            add(answerAt, 'probabilities must be finite and within [0, 1]');
          }
          if (!sumsToOne(values)) {
            add(
              answerAt,
              `probabilities must sum to 1, found ${values.reduce((a, b) => a + b, 0)}`,
            );
          }
          if (!isFiniteUnitInterval(answer.confidence)) {
            add(answerAt, 'confidence must be finite and within [0, 1]');
          }

          const max = Math.max(...values);
          if (answer.probabilities[answer.choice] !== max) {
            add(answerAt, `declared choice "${answer.choice}" is not the most probable option`);
          }
          if (!(answer.choice in answer.probabilities)) {
            add(answerAt, `declared choice "${answer.choice}" is not an option`);
          }
        }

        if (answer.type === 'score' && question.primitive === 'score') {
          const top = question.criteria.length - 1;
          const expectedKeys = question.criteria.map((_, index) => String(index)).sort();

          if (!Number.isFinite(answer.score) || answer.score < 0 || answer.score > top) {
            add(answerAt, `score must be within [0, ${top}]`);
          }
          if (!isFiniteUnitInterval(answer.confidence)) {
            add(answerAt, 'confidence must be finite and within [0, 1]');
          }
          if (Object.keys(answer.legend).sort().join('|') !== expectedKeys.join('|')) {
            add(answerAt, 'legend must describe every rubric level');
          }
          if (Object.keys(answer.probabilities).sort().join('|') !== expectedKeys.join('|')) {
            add(answerAt, 'score probabilities must cover every rubric level');
          } else if (!sumsToOne(Object.values(answer.probabilities))) {
            add(answerAt, 'score probabilities must sum to 1');
          }
          if (!Object.values(answer.probabilities).every(isFiniteUnitInterval)) {
            add(answerAt, 'score probabilities must be finite and within [0, 1]');
          }
        }

        if (answer.type === 'noul' && !isFiniteUnitInterval(answer.noul)) {
          add(answerAt, 'noul must be finite and within [0, 1]');
        }
      });
    }
  }

  return problems;
}
