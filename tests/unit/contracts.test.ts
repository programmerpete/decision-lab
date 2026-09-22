/**
 * Compile-time contract tests.
 *
 * `tsc -b` type-checks this file as part of `npm run build`, so an `@ts-expect-error`
 * that stops being an error fails the build. That is the assertion: the types make a
 * mislabelled value impossible to write, not merely unlikely.
 */

import { describe, expect, it } from 'vitest';

import type { FixtureRun, LaneDescriptor, NoulAnswer, Provenance } from '../../src/domain';

describe('fixture provenance contracts', () => {
  it('rejects a measured latency on a fixture lane', () => {
    const lane: LaneDescriptor = {
      outcome: 'not-run',
      provider: null,
      modelId: null,
      connection: 'not-configured',
      latencyMs: null,
      apiCostUsd: null,
      tokens: null,
    };

    expect(lane.latencyMs).toBeNull();

    // @ts-expect-error a measured latency cannot be assigned to an unmeasured field
    const measured: LaneDescriptor = { ...lane, latencyMs: 42 };
    expect(measured.latencyMs).toBe(42);

    // @ts-expect-error a fixture run cannot claim a provider cost
    const billed: LaneDescriptor = { ...lane, apiCostUsd: 0.00002 };
    expect(billed.apiCostUsd).toBe(0.00002);
  });

  it('has no live source in this release', () => {
    // @ts-expect-error `live` is not a member of the source union
    const live: FixtureRun['source'] = 'live';
    expect(live).toBe('live');

    const fixture: FixtureRun['source'] = 'illustrative-fixture';
    expect(fixture).toBe('illustrative-fixture');
  });

  it('cannot claim a successful outcome for a fixture lane', () => {
    // @ts-expect-error `success` is not a member of the outcome union
    const outcome: LaneDescriptor['outcome'] = 'success';
    expect(outcome).toBe('success');
  });

  it('does not let a noul answer grow a confidence field', () => {
    const honest: NoulAnswer = { type: 'noul', noul: 0.5 };
    expect(honest.noul).toBe(0.5);

    // @ts-expect-error noul answers carry the probability alone
    const invented: NoulAnswer = { type: 'noul', noul: 0.5, confidence: 0.9 };
    expect(invented).toBeDefined();
  });

  it('does not let authored values be labelled as measured', () => {
    // @ts-expect-error values are authored, not measured
    const measured: Provenance['values'] = 'measured';
    expect(measured).toBe('measured');
  });
});
