import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Scenario } from '../../src/domain';
import { buildLiveRequest, requestDecision } from '../../src/live';
import { SCENARIOS } from '../../src/scenarios';

const TOKEN = 'test-token-not-a-real-credential';

function scenario(id: string): Scenario {
  const found = SCENARIOS.find((entry) => entry.id === id);
  if (!found) {
    throw new Error(`Test expected a scenario with id "${id}".`);
  }
  return found;
}

/** A response body that satisfies every question in a scenario. */
function validAnswers(target: Scenario): Record<string, unknown> {
  const answers: Record<string, unknown> = {};

  for (const question of target.questions) {
    if (question.primitive === 'choice') {
      const probabilities: Record<string, number> = {};
      question.options.forEach((option, index) => {
        probabilities[option.key] = index === 0 ? 0.9 : 0.1 / (question.options.length - 1);
      });
      answers[question.id] = {
        type: 'choice',
        choice: question.options[0]!.key,
        probabilities,
        confidence: 0.88,
      };
      continue;
    }

    if (question.primitive === 'score') {
      const legend: Record<string, string> = {};
      const probabilities: Record<string, number> = {};
      question.criteria.forEach((level, index) => {
        legend[String(index)] = level;
        probabilities[String(index)] = index === 0 ? 1 : 0;
      });
      answers[question.id] = {
        type: 'score',
        score: 1.04,
        legend,
        probabilities,
        confidence: 0.71,
      };
      continue;
    }

    answers[question.id] = { type: 'noul', noul: 0.97 };
  }

  return answers;
}

function successPayload(target: Scenario, overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    source: 'live',
    provider: 'TypeSafe',
    model: 'typesafe/jev-1.13-20260917',
    generationId: 'gen-dec-1790079135-8gbnhRR7gs8soXPKtrIm',
    answers: validAnswers(target),
    usage: { inputTokens: 643, outputTokens: 122, cost: 0.000027006 },
    latencyMs: 259,
    ...overrides,
  };
}

function respondWith(payload: unknown, status = 200) {
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('live request shape', () => {
  it('never sends a model field, and always names the lane', () => {
    const request = buildLiveRequest(scenario('support-triage'), 'hello', 'llm');
    expect(Object.keys(request)).toEqual(['lane', 'state', 'questions']);
    expect(request.lane).toBe('llm');
    expect(JSON.stringify(request)).not.toContain('"model"');
  });

  it('asks every judgment in one request', () => {
    const target = scenario('support-triage');
    const request = buildLiveRequest(target, 'hello', 'jev');
    expect(Object.keys(request.questions)).toEqual(target.questions.map((q) => q.id));
  });

  it('maps criteria to the verified wire shapes', () => {
    const request = buildLiveRequest(scenario('support-triage'), 'hello', 'jev');

    expect(request.questions.team?.criteria).toEqual(
      scenario('support-triage').questions[0].primitive === 'choice'
        ? scenario('support-triage').questions[0].criteria
        : {},
    );

    // Score criteria is an ordered array; noul criteria is omitted because the wire
    // shape for it is a true/false object and the authored guidance is prose.
    expect(Array.isArray(request.questions.frustration?.criteria)).toBe(true);
    expect(request.questions.refund?.criteria).toBeUndefined();
    expect(request.questions.refund?.instructions).toContain('negation');
  });

  it('carries the state verbatim', () => {
    const state = '  Exact text, with spacing.  ';
    expect(buildLiveRequest(scenario('support-triage'), state, 'jev').state).toBe(state);
  });
});

describe('live transport', () => {
  it('returns validated answers and provenance on success', async () => {
    const target = scenario('support-triage');
    respondWith(successPayload(target));

    const outcome = await requestDecision({
      scenario: target,
      state: 'hello',
      lane: 'jev',
      token: TOKEN,
    });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) {
      return;
    }

    expect(outcome.model).toBe('typesafe/jev-1.13-20260917');
    expect(outcome.generationId).toContain('gen-dec-');
    expect(outcome.latencyMs).toBe(259);
    expect(outcome.clientDurationMs).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(outcome.clientDurationMs)).toBe(true);
    expect(outcome.usage.costUsd).toBeCloseTo(0.000027006, 12);
    expect(outcome.answers).toHaveLength(5);
    expect(outcome.answers[0]?.type).toBe('choice');
  });

  it('sends the token in the header and never in the body', async () => {
    const target = scenario('support-triage');
    respondWith(successPayload(target));

    await requestDecision({ scenario: target, state: 'hello', lane: 'jev', token: TOKEN });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.stringify(init.headers)).toContain('Bearer');
    expect(String(init.body)).not.toContain(TOKEN);
  });

  it('refuses to call the provider without a token', async () => {
    const outcome = await requestDecision({
      scenario: scenario('support-triage'),
      state: 'hello',
      lane: 'jev',
      token: '   ',
    });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.kind).toBe('auth');
      expect(outcome.status).toBe(401);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('surfaces a provider failure with its status, kind, and detail', async () => {
    respondWith(
      {
        ok: false,
        kind: 'auth',
        status: 502,
        message: 'Provider rejected the credential.',
        detail: 'invalid_api_key',
      },
      502,
    );

    const outcome = await requestDecision({
      scenario: scenario('support-triage'),
      state: 'hello',
      lane: 'jev',
      token: TOKEN,
    });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.kind).toBe('auth');
      expect(outcome.status).toBe(502);
      expect(outcome.detail).toBe('invalid_api_key');
    }
  });

  it('refuses a failure that also carries answers', async () => {
    const target = scenario('support-triage');
    respondWith(
      { ok: false, kind: 'provider', status: 502, message: 'boom', answers: validAnswers(target) },
      502,
    );

    const outcome = await requestDecision({
      scenario: target,
      state: 'hello',
      lane: 'jev',
      token: TOKEN,
    });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.kind).toBe('invalid_response');
      expect(outcome.message).toContain('also carried answers');
    }
  });

  it('rejects a response that is missing one of the answers', async () => {
    const target = scenario('support-triage');
    const answers = validAnswers(target);
    delete answers.frustration;

    respondWith(successPayload(target, { answers }));

    const outcome = await requestDecision({
      scenario: target,
      state: 'hello',
      lane: 'jev',
      token: TOKEN,
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.kind).toBe('invalid_response');
    }
  });

  it('rejects an answer whose type does not match the question', async () => {
    const target = scenario('support-triage');
    const answers = validAnswers(target);
    answers.team = { type: 'noul', noul: 0.5 };

    respondWith(successPayload(target, { answers }));

    const outcome = await requestDecision({
      scenario: target,
      state: 'hello',
      lane: 'jev',
      token: TOKEN,
    });
    expect(outcome.ok).toBe(false);
  });

  it('rejects a score that is not a finite number', async () => {
    const target = scenario('support-triage');
    const answers = validAnswers(target);
    answers.frustration = {
      type: 'score',
      score: Number.NaN,
      legend: { '0': 'Calm', '1': 'Frustrated', '2': 'Very angry' },
      probabilities: { '0': 1 },
      confidence: 0.5,
    };

    respondWith(successPayload(target, { answers }));

    const outcome = await requestDecision({
      scenario: target,
      state: 'hello',
      lane: 'jev',
      token: TOKEN,
    });
    expect(outcome.ok).toBe(false);
  });

  it('accepts a score that sits outside the nominal rubric', async () => {
    const target = scenario('support-triage');
    const answers = validAnswers(target);
    // The provider reports positions, not buckets. A position slightly below the
    // lowest level is still a valid answer and must not fail the whole call.
    answers.frustration = {
      type: 'score',
      score: -0.05,
      legend: { '0': 'Calm' },
      probabilities: { '0': 1 },
      confidence: 0.4,
    };

    respondWith(successPayload(target, { answers }));

    const outcome = await requestDecision({
      scenario: target,
      state: 'hello',
      lane: 'jev',
      token: TOKEN,
    });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      const answer = outcome.answers[3];
      if (answer?.type === 'score') {
        expect(answer.score).toBe(-0.05);
      } else {
        throw new Error('expected a score answer');
      }
    }
  });

  it('accepts a partial score distribution, because the provider omits zero levels', async () => {
    const target = scenario('support-triage');
    const answers = validAnswers(target);
    answers.frustration = {
      type: 'score',
      score: 1.65,
      legend: { '1': 'Frustrated', '2': 'Very angry' },
      probabilities: { '1': 0.35, '2': 0.65 },
      confidence: 0.65,
    };

    respondWith(successPayload(target, { answers }));

    const outcome = await requestDecision({
      scenario: target,
      state: 'hello',
      lane: 'jev',
      token: TOKEN,
    });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      const answer = outcome.answers[3];
      expect(answer?.type).toBe('score');
      if (answer?.type === 'score') {
        // A continuous position is preserved, never rounded to an index.
        expect(answer.score).toBe(1.65);
      }
    }
  });

  it('reports a network failure rather than inventing a result', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const outcome = await requestDecision({
      scenario: scenario('support-triage'),
      state: 'hello',
      lane: 'jev',
      token: TOKEN,
    });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.kind).toBe('network');
    }
  });

  it('reports a cancelled request distinctly', async () => {
    fetchMock.mockRejectedValue(new DOMException('aborted', 'AbortError'));

    const outcome = await requestDecision({
      scenario: scenario('support-triage'),
      state: 'hello',
      lane: 'jev',
      token: TOKEN,
    });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.kind).toBe('cancelled');
    }
  });

  it('rejects a response that answers for the wrong lane', async () => {
    const target = scenario('support-triage');
    respondWith({ ...successPayload(target), lane: 'llm' });

    const outcome = await requestDecision({
      scenario: target,
      state: 'hello',
      lane: 'jev',
      token: TOKEN,
    });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.kind).toBe('invalid_response');
      expect(outcome.message).toContain('"llm" lane');
    }
  });

  it('accepts a response that echoes the requested lane', async () => {
    const target = scenario('support-triage');
    respondWith({ ...successPayload(target), lane: 'llm' });

    const outcome = await requestDecision({
      scenario: target,
      state: 'hello',
      lane: 'llm',
      token: TOKEN,
    });

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.lane).toBe('llm');
    }
  });

  it('rejects a non-JSON body', async () => {
    fetchMock.mockResolvedValue(new Response('<html>502</html>', { status: 502 }));

    const outcome = await requestDecision({
      scenario: scenario('support-triage'),
      state: 'hello',
      lane: 'jev',
      token: TOKEN,
    });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.kind).toBe('invalid_response');
    }
  });
});
