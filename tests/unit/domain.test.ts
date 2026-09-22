import { describe, expect, it } from 'vitest';

import type { AnswerSet, Preset, Scenario } from '../../src/domain';
import {
  DEFAULT_THRESHOLD_PERCENT,
  MAX_INPUT_LENGTH,
  buildExport,
  evaluateFixture,
  exportFilename,
  illustrateRouting,
  validateCatalogue,
} from '../../src/domain';
import { SCENARIOS } from '../../src/scenarios';

function scenario(id: string): Scenario {
  const found = SCENARIOS.find((entry) => entry.id === id);
  if (!found) {
    throw new Error(`Test expected a scenario with id "${id}".`);
  }
  return found;
}

function preset(scenarioId: string, presetId: string): Preset {
  const found = scenario(scenarioId).presets.find((entry) => entry.id === presetId);
  if (!found) {
    throw new Error(`Test expected preset "${presetId}" in "${scenarioId}".`);
  }
  return found;
}

function answersOf(scenarioId: string, presetId: string): AnswerSet {
  return preset(scenarioId, presetId).answers;
}

function choiceOf(scenarioId: string, presetId: string) {
  const answer = answersOf(scenarioId, presetId)[0];
  if (answer.type !== 'choice') {
    throw new Error('The first judgment is always a Choice.');
  }
  return answer;
}

function noulAt(scenarioId: string, presetId: string, index: number): number {
  const answer = answersOf(scenarioId, presetId)[index];
  if (!answer || answer.type !== 'noul') {
    throw new Error(`Expected a noul answer at index ${index}.`);
  }
  return answer.noul;
}

function scoreAt(scenarioId: string, presetId: string, index: number): number {
  const answer = answersOf(scenarioId, presetId)[index];
  if (!answer || answer.type !== 'score') {
    throw new Error(`Expected a score answer at index ${index}.`);
  }
  return answer.score;
}

function evaluate(scenarioId: string, presetId: string) {
  const target = scenario(scenarioId);
  const result = evaluateFixture(target, preset(target.id, presetId).input);
  if (!result.ok) {
    throw new Error(`Expected preset "${presetId}" to evaluate: ${result.error.message}`);
  }
  return result.run;
}

describe('catalogue', () => {
  it('passes its own structural validation', () => {
    expect(validateCatalogue(SCENARIOS)).toEqual([]);
  });

  it('contains four scenarios, five judgments each, and fourteen presets', () => {
    expect(SCENARIOS).toHaveLength(4);

    for (const entry of SCENARIOS) {
      expect(entry.questions).toHaveLength(5);
      expect(entry.questions[0].primitive).toBe('choice');
      expect(entry.presets.length).toBeGreaterThanOrEqual(3);
    }

    const totalPresets = SCENARIOS.reduce((sum, entry) => sum + entry.presets.length, 0);
    expect(totalPresets).toBe(14);
  });

  it('keeps every preset input unique across the whole catalogue', () => {
    const inputs = SCENARIOS.flatMap((entry) => entry.presets.map((item) => item.input));
    expect(new Set(inputs).size).toBe(inputs.length);
  });

  it('keeps every judgment answer free of a confidence field on noul', () => {
    for (const entry of SCENARIOS) {
      for (const item of entry.presets) {
        item.answers.forEach((answer, index) => {
          if (answer.type === 'noul') {
            expect(Object.keys(answer).sort()).toEqual(['noul', 'type']);
          }
          expect(answer.type).toBe(entry.questions[index]?.primitive);
        });
      }
    }
  });
});

describe('exact-input matching', () => {
  it('accepts each authored preset verbatim', () => {
    for (const entry of SCENARIOS) {
      for (const item of entry.presets) {
        const result = evaluateFixture(entry, item.input);
        expect(result.ok).toBe(true);
      }
    }
  });

  it('refuses an empty input', () => {
    const result = evaluateFixture(scenario('support-triage'), '');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('empty-input');
    }
  });

  it('refuses an input over the limit', () => {
    const result = evaluateFixture(scenario('support-triage'), 'x'.repeat(MAX_INPUT_LENGTH + 1));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('input-too-long');
    }
  });

  it('does not trim, case-fold, normalize, or fuzzy-match', () => {
    const target = scenario('support-triage');
    const exact = target.presets[0]!.input;

    const variants = [
      ` ${exact}`,
      `${exact} `,
      exact.toUpperCase(),
      exact.toLowerCase(),
      exact.replace('September', 'September\n'),
      exact.normalize('NFD'),
    ];

    for (const variant of variants) {
      if (variant === exact) {
        continue;
      }
      const result = evaluateFixture(target, variant);
      expect(result.ok, `expected "${variant.slice(0, 24)}…" not to match`).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('no-exact-fixture');
      }
    }
  });

  it('does not match a preset from a different scenario', () => {
    const foreign = scenario('code-review').presets[0]!.input;
    const result = evaluateFixture(scenario('support-triage'), foreign);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('no-exact-fixture');
    }
  });
});

describe('mutation isolation', () => {
  it('returns a clone, so a careless consumer cannot corrupt the catalogue', () => {
    const target = scenario('support-triage');
    const item = target.presets[0]!;
    const canonicalBefore = { ...choiceOf('support-triage', 'duplicate-charge').probabilities };

    const first = evaluateFixture(target, item.input);
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }

    const firstAnswer = first.run.illustration.answers[0];
    if (firstAnswer.type !== 'choice') {
      throw new Error('expected a choice answer');
    }
    Object.assign(firstAnswer.probabilities, { billing: 0 });

    const canonicalAfter = choiceOf('support-triage', 'duplicate-charge').probabilities;
    expect({ ...canonicalAfter }).toEqual(canonicalBefore);

    const second = evaluateFixture(target, item.input);
    expect(second.ok).toBe(true);
    if (!second.ok) {
      return;
    }
    const secondAnswer = second.run.illustration.answers[0];
    if (secondAnswer.type !== 'choice') {
      throw new Error('expected a choice answer');
    }
    expect(secondAnswer.probabilities.billing).toBe(canonicalBefore.billing);
  });
});

describe('shared illustration and provenance', () => {
  it('points both lanes at one illustration with no measured metrics', () => {
    const run = evaluate('support-triage', 'duplicate-charge');

    expect(run.illustration.illustrationId).toBe('support-triage:duplicate-charge');
    expect(run.lanes.jev).toEqual(run.lanes.llm);
    expect(run.lanes.jev.outcome).toBe('not-run');
    expect(run.lanes.jev.provider).toBeNull();
    expect(run.lanes.jev.modelId).toBeNull();
    expect(run.lanes.jev.connection).toBe('not-configured');
    expect(run.lanes.jev.latencyMs).toBeNull();
    expect(run.lanes.jev.apiCostUsd).toBeNull();
    expect(run.lanes.jev.tokens).toBeNull();
    expect(run.source).toBe('illustrative-fixture');
    expect(run.provenance.modelCalls).toBe('none');
  });

  it('exports a labelled fixture document and never claims execution', () => {
    const target = scenario('support-triage');
    const run = evaluate('support-triage', 'duplicate-charge');
    const envelope = buildExport(run, target, DEFAULT_THRESHOLD_PERCENT);

    expect(envelope.execution).toBe('none');
    expect(envelope.source).toBe('illustrative-fixture');
    expect(envelope.input).toBe(run.input);
    expect(envelope.illustration.answers).toEqual(run.illustration.answers);
    expect(envelope.routing.outcome).toBe('suggestion');
    expect(envelope.routing.thresholdPercent).toBe(DEFAULT_THRESHOLD_PERCENT);

    const roundTripped: unknown = JSON.parse(JSON.stringify(envelope));
    expect(roundTripped).toEqual(envelope);

    expect(exportFilename('support-triage', 'duplicate-charge')).toBe(
      'decisionlab-support-triage-duplicate-charge-illustrative-fixture.json',
    );
  });
});

describe('routing illustration', () => {
  it('suggests the winning option when it clears the threshold', () => {
    const routing = illustrateRouting(
      scenario('support-triage'),
      answersOf('support-triage', 'duplicate-charge'),
      DEFAULT_THRESHOLD_PERCENT,
    );

    expect(routing.outcome).toBe('suggestion');
    expect(routing.optionLabel).toBe('Billing');
    expect(routing.reason).toBe('winning-option');
  });

  it('passes when the winning probability equals the threshold exactly', () => {
    const routing = illustrateRouting(
      scenario('support-triage'),
      answersOf('support-triage', 'duplicate-charge'),
      84,
    );

    expect(routing.outcome).toBe('suggestion');
    expect(routing.winningProbability).toBeCloseTo(0.84, 10);
  });

  it('sends the winner to a human when it falls below the threshold', () => {
    const routing = illustrateRouting(
      scenario('support-triage'),
      answersOf('support-triage', 'duplicate-charge'),
      85,
    );

    expect(routing.outcome).toBe('human-review');
    expect(routing.reason).toBe('below-threshold');
  });

  it('sends a tie to a human', () => {
    const target = scenario('support-triage');
    const base = target.presets[0]!.answers;
    const tied: AnswerSet = [
      {
        type: 'choice',
        choice: 'billing',
        confidence: 0.5,
        probabilities: { billing: 0.5, technical: 0.5, sales: 0, unclear: 0 },
      },
      base[1],
      base[2],
      base[3],
      base[4],
    ];

    const routing = illustrateRouting(target, tied, 10);
    expect(routing.outcome).toBe('human-review');
    expect(routing.reason).toBe('tie');
  });

  it('sends a clarification option to a human at every threshold', () => {
    const target = scenario('support-triage');
    const answers = answersOf('support-triage', 'ambiguous');

    for (const threshold of [0, 50, 80, 100]) {
      const routing = illustrateRouting(target, answers, threshold);
      expect(routing.outcome).toBe('human-review');
      expect(routing.reason).toBe('non-recommendation-disposition');
    }
  });

  it('sends a no-tool option to a human at every threshold', () => {
    const target = scenario('tool-selection');
    const answers = answersOf('tool-selection', 'unsupported-action');

    for (const threshold of [0, 50, 80, 100]) {
      const routing = illustrateRouting(target, answers, threshold);
      expect(routing.outcome).toBe('human-review');
      expect(routing.reason).toBe('non-recommendation-disposition');
    }
  });

  it('lets the safe code lookalike clear the default threshold', () => {
    const routing = illustrateRouting(
      scenario('code-review'),
      answersOf('code-review', 'safe-lookalike'),
      DEFAULT_THRESHOLD_PERCENT,
    );

    expect(routing.outcome).toBe('suggestion');
    expect(routing.optionLabel).toBe('General');
  });

  it('is threshold-driven and blind to a high injection reading', () => {
    const target = scenario('support-triage');
    const answers = answersOf('support-triage', 'injected-instruction');

    expect(noulAt('support-triage', 'injected-instruction', 4)).toBe(0.97);

    // At a low threshold the injected message still produces a routing suggestion,
    // which is the point: this slider is not a security mechanism.
    const permissive = illustrateRouting(target, answers, 50);
    expect(permissive.outcome).toBe('suggestion');
    expect(permissive.optionLabel).toBe('Billing');

    const strict = illustrateRouting(target, answers, DEFAULT_THRESHOLD_PERCENT);
    expect(strict.outcome).toBe('human-review');
    expect(strict.reason).toBe('below-threshold');
  });

  it('never mutates the authored answers', () => {
    const target = scenario('support-triage');
    const answers = answersOf('support-triage', 'duplicate-charge');
    const before = JSON.stringify(answers);

    illustrateRouting(target, answers, 0);
    illustrateRouting(target, answers, 100);

    expect(JSON.stringify(answers)).toBe(before);
  });
});

describe('authored safety directions', () => {
  it('separates a refund request from a negated one', () => {
    expect(noulAt('support-triage', 'duplicate-charge', 1)).toBeGreaterThan(0.9);
    expect(noulAt('support-triage', 'negation', 1)).toBeLessThan(0.1);
  });

  it('keeps the safe code lookalike low-risk even though it mentions a token', () => {
    const safe = choiceOf('code-review', 'safe-lookalike');
    expect(safe.choice).toBe('general');
    expect(noulAt('code-review', 'safe-lookalike', 2)).toBeLessThan(0.1);
    expect(scoreAt('code-review', 'safe-lookalike', 4)).toBeLessThan(0.5);

    expect(noulAt('code-review', 'removed-authorization', 1)).toBeGreaterThan(0.9);
    expect(noulAt('code-review', 'raw-token-logging', 2)).toBeGreaterThan(0.9);
  });

  it('separates a scam warning from a credential scam', () => {
    expect(noulAt('moderation-pii', 'scam-warning', 4)).toBeLessThan(0.1);
    expect(choiceOf('moderation-pii', 'scam-warning').choice).toBe('allow');

    expect(noulAt('moderation-pii', 'credential-scam', 4)).toBeGreaterThan(0.9);
    expect(choiceOf('moderation-pii', 'credential-scam').choice).toBe('block');
  });

  it('reads an obfuscated contact detail as present', () => {
    expect(noulAt('moderation-pii', 'obfuscated-address', 1)).toBeGreaterThan(0.8);
    expect(choiceOf('moderation-pii', 'obfuscated-address').choice).toBe('review');
  });

  it('asks for the missing identifier rather than inventing one', () => {
    expect(noulAt('tool-selection', 'missing-order', 1)).toBeGreaterThan(0.8);
    expect(choiceOf('tool-selection', 'missing-order').choice).toBe('no-tool');
  });

  it('reads a destructive request as destructive and unavailable', () => {
    expect(noulAt('tool-selection', 'unsupported-action', 2)).toBeGreaterThan(0.9);
    expect(choiceOf('tool-selection', 'unsupported-action').choice).toBe('no-tool');
  });
});
