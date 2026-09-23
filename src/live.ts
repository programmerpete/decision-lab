/**
 * Live transport.
 *
 * The browser never talks to OpenRouter and never holds the OpenRouter key. It talks
 * to a Cloudflare Worker that holds the key server-side, authenticates the presenter
 * with a bearer token, enforces the model allowlist, rate limits, body limits, a daily
 * spend ceiling, and timeouts.
 *
 * Two rules this module exists to enforce:
 *
 * 1. A failure is never rendered with fixture values. The worker's failure shape
 *    structurally cannot carry answers, and this parser refuses a response that
 *    claims `ok: false` while carrying them.
 * 2. Nothing is partially filled. If one of the five answers is malformed, the whole
 *    response is rejected rather than rendered with holes.
 */

import type { AnswerSet, Lane, Primitive, Scenario } from './domain';

export const LIVE_ENDPOINT = 'https://decision-lab-live.petersk.workers.dev';

/** The worker allowlists one model per lane. Sending `model` at all is a 400. */
export const LIVE_MODEL_SLUG = '~typesafe/jev-latest';

export interface LiveRequestQuestion {
  readonly type: Primitive;
  readonly instructions: string;
  readonly criteria?: Readonly<Record<string, string>> | readonly string[];
}

export interface LiveRequest {
  /** The worker defaults this to `jev`, so it is always sent explicitly. */
  readonly lane: Lane;
  readonly state: string;
  readonly questions: Readonly<Record<string, LiveRequestQuestion>>;
}

/**
 * Derive the request from the same versioned question definitions the fixtures use, so
 * every arm asks semantically identical questions about identical input. A fair
 * comparison needs the same task, the same contract, and the same context.
 */
export function buildLiveRequest(scenario: Scenario, state: string, lane: Lane): LiveRequest {
  const questions: Record<string, LiveRequestQuestion> = {};

  for (const question of scenario.questions) {
    if (question.primitive === 'choice') {
      questions[question.id] = {
        type: 'choice',
        instructions: question.prompt,
        criteria: question.criteria,
      };
      continue;
    }

    if (question.primitive === 'score') {
      questions[question.id] = {
        type: 'score',
        instructions: question.prompt,
        criteria: question.criteria,
      };
      continue;
    }

    // Noul criteria is optional and the wire shape for it is a true/false object, so
    // any authored guidance joins the instructions instead.
    questions[question.id] = {
      type: 'noul',
      instructions: question.criteria ? `${question.prompt} ${question.criteria}` : question.prompt,
    };
  }

  return { lane, state, questions };
}

export interface LiveUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly costUsd: number;
}

/**
 * What was actually sent and what actually came back, kept for display. The presenter
 * can open this on stage, so it must be the real exchange rather than a reconstruction.
 */
export interface LiveExchange {
  readonly request: LiveRequest;
  /** The parsed response body, or null when nothing arrived. */
  readonly response: unknown;
  readonly status: number;
}

export interface LiveSuccess {
  readonly ok: true;
  /** Which arm answered. Recorded so a response can never be attributed to the wrong lane. */
  readonly lane: Lane;
  readonly provider: string;
  readonly model: string;
  readonly generationId: string;
  readonly answers: AnswerSet;
  readonly usage: LiveUsage;
  /** What the provider reported for its own work. */
  readonly latencyMs: number;
  /**
   * The whole round trip as this browser observed it: request, Worker, provider, and
   * response parsing. This is the number to quote when describing the user's wait,
   * because the provider's figure excludes the Worker and the network.
   */
  readonly clientDurationMs: number;
  readonly exchange: LiveExchange;
}

export interface LiveFailure {
  readonly ok: false;
  readonly kind: string;
  readonly status: number;
  readonly message: string;
  readonly detail: string | null;
  readonly exchange: LiveExchange;
}

export type LiveOutcome = LiveSuccess | LiveFailure;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function unitInterval(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0 && value <= 1;
}

function failure(
  kind: string,
  status: number,
  message: string,
  detail: string | null,
  exchange: LiveExchange,
): LiveFailure {
  return { ok: false, kind, status, message, detail, exchange };
}

function readNumberRecord(value: unknown): Record<string, number> | null {
  if (!isRecord(value)) {
    return null;
  }
  const result: Record<string, number> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!unitInterval(entry)) {
      return null;
    }
    result[key] = entry;
  }
  return result;
}

function readStringRecord(value: unknown): Record<string, string> | null {
  if (!isRecord(value)) {
    return null;
  }
  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== 'string') {
      return null;
    }
    result[key] = entry;
  }
  return result;
}

/**
 * Validate the provider's answers against the questions that were asked. Returns null
 * if anything is missing, mistyped, or out of range, so the caller fails the whole call
 * rather than rendering a partly filled lane.
 */
function readAnswers(scenario: Scenario, raw: unknown): AnswerSet | null {
  if (!isRecord(raw)) {
    return null;
  }

  const collected: AnswerSet[number][] = [];

  for (const question of scenario.questions) {
    const entry = raw[question.id];

    if (!isRecord(entry) || entry.type !== question.primitive) {
      return null;
    }

    if (question.primitive === 'choice') {
      const probabilities = readNumberRecord(entry.probabilities);
      if (!probabilities || typeof entry.choice !== 'string') {
        return null;
      }
      if (!(entry.choice in probabilities)) {
        return null;
      }
      if (!unitInterval(entry.confidence)) {
        return null;
      }
      collected.push({
        type: 'choice',
        choice: entry.choice,
        confidence: entry.confidence,
        probabilities,
      });
      continue;
    }

    if (question.primitive === 'score') {
      const legend = readStringRecord(entry.legend);
      const probabilities = readNumberRecord(entry.probabilities);

      if (!legend || !probabilities) {
        return null;
      }
      // A score is a continuous position and can sit outside the nominal rubric, so
      // only finiteness is required here. The renderer clamps for the nearest-level
      // hint and always shows the raw value.
      if (!isFiniteNumber(entry.score)) {
        return null;
      }
      if (!unitInterval(entry.confidence)) {
        return null;
      }
      // Deliberately not requiring the distribution to sum to 1: the provider reports
      // rounded per-level probabilities and may omit levels it scored at zero.
      collected.push({
        type: 'score',
        score: entry.score,
        confidence: entry.confidence,
        legend,
        probabilities,
      });
      continue;
    }

    if (!unitInterval(entry.noul)) {
      return null;
    }
    collected.push({ type: 'noul', noul: entry.noul });
  }

  const [first, second, third, fourth, fifth] = collected;
  if (!first || !second || !third || !fourth || !fifth) {
    return null;
  }
  return [first, second, third, fourth, fifth];
}

function readUsage(raw: unknown): LiveUsage {
  if (!isRecord(raw)) {
    return { inputTokens: 0, outputTokens: 0, costUsd: 0 };
  }
  return {
    inputTokens: isFiniteNumber(raw.inputTokens) ? raw.inputTokens : 0,
    outputTokens: isFiniteNumber(raw.outputTokens) ? raw.outputTokens : 0,
    costUsd: isFiniteNumber(raw.cost) ? raw.cost : 0,
  };
}

export interface RequestOptions {
  readonly scenario: Scenario;
  readonly state: string;
  /** Which arm to call: the typed decision model or the structured-output LLM. */
  readonly lane: Lane;
  /** Held in memory for this session only. Never persisted, never bundled. */
  readonly token: string;
  readonly signal?: AbortSignal;
}

export async function requestDecision(options: RequestOptions): Promise<LiveOutcome> {
  const { scenario, state, lane, token, signal } = options;
  const startedAt = performance.now();
  const elapsed = () => Math.round(performance.now() - startedAt);

  // Built before the call so the exact bytes that were sent stay available for display,
  // including when the call fails before a response arrives.
  const request = buildLiveRequest(scenario, state, lane);
  const exchange = (response: unknown, status: number): LiveExchange => ({
    request,
    response,
    status,
  });

  if (token.trim().length === 0) {
    return failure(
      'auth',
      401,
      'Enter the presenter token to make a live call.',
      null,
      exchange(null, 0),
    );
  }

  let response: Response;
  try {
    response = await fetch(LIVE_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      ...(signal ? { signal } : {}),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return failure(
        'cancelled',
        0,
        'The request was replaced before it finished.',
        null,
        exchange(null, 0),
      );
    }
    return failure(
      'network',
      0,
      'The request never reached the live endpoint. Check the network and try again.',
      null,
      exchange(null, 0),
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return failure(
      'invalid_response',
      response.status,
      `The endpoint returned a body that is not JSON (HTTP ${response.status}).`,
      null,
      exchange(null, response.status),
    );
  }

  if (!isRecord(payload)) {
    return failure(
      'invalid_response',
      response.status,
      'The endpoint returned an empty body.',
      null,
      exchange(payload, response.status),
    );
  }

  if (payload.ok !== true) {
    // A failure must never carry answers. If it does, refuse it rather than trusting it.
    if ('answers' in payload) {
      return failure(
        'invalid_response',
        response.status,
        'The endpoint reported a failure that also carried answers. Refusing to render it.',
        null,
        exchange(payload, response.status),
      );
    }

    return failure(
      typeof payload.kind === 'string' ? payload.kind : 'provider',
      isFiniteNumber(payload.status) ? payload.status : response.status,
      typeof payload.message === 'string'
        ? payload.message
        : `Live call failed (HTTP ${response.status}).`,
      typeof payload.detail === 'string' ? payload.detail : null,
      exchange(payload, response.status),
    );
  }

  const answers = readAnswers(scenario, payload.answers);
  if (!answers) {
    return failure(
      'invalid_response',
      response.status,
      'The endpoint returned answers that do not match the questions that were asked.',
      null,
      exchange(payload, response.status),
    );
  }

  // A response that names a different arm than the one requested must never be
  // rendered: attributing the LLM's numbers to Jev (or the reverse) would misreport
  // provenance on the one slide that depends on telling them apart.
  if (typeof payload.lane === 'string' && payload.lane !== lane) {
    return failure(
      'invalid_response',
      response.status,
      `The endpoint answered for the "${payload.lane}" lane when "${lane}" was requested.`,
      null,
      exchange(payload, response.status),
    );
  }

  return {
    ok: true,
    lane,
    provider: typeof payload.provider === 'string' ? payload.provider : 'unknown',
    model: typeof payload.model === 'string' ? payload.model : 'unknown',
    generationId: typeof payload.generationId === 'string' ? payload.generationId : 'unreported',
    answers,
    usage: readUsage(payload.usage),
    latencyMs: isFiniteNumber(payload.latencyMs) ? payload.latencyMs : 0,
    clientDurationMs: elapsed(),
    exchange: exchange(payload, response.status),
  };
}
