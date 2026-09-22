#!/usr/bin/env node
/**
 * Opt-in live smoke test.
 *
 * This is the only thing in the repository that spends money, so it is deliberately
 * NOT part of `npm test` or CI. Run it by hand when you need to prove the deployed
 * endpoint still works:
 *
 *   LIVE_TOKEN='…' node scripts/live-smoke.mjs
 *
 * It proves transport and response shape. It is not a quality result, and it is not a
 * benchmark. The token is read from the environment and never written anywhere.
 */

import { LIVE_ENDPOINT } from './live-endpoint.mjs';

const token = process.env.LIVE_TOKEN;

if (!token) {
  console.error('Set LIVE_TOKEN to run the live smoke test. It is never committed.');
  process.exit(1);
}

// The worker allowlists specific browser origins. Node does not send one, so this
// declares the same origin the site uses when served locally.
const ORIGIN = 'http://localhost:5173';

const body = {
  state: 'Hi — I was charged twice for my September subscription. Can you refund the duplicate?',
  questions: {
    team: {
      type: 'choice',
      instructions: 'Which team should handle this message?',
      criteria: {
        billing: 'Charges, invoices, subscriptions, duplicate payments',
        technical: 'Bugs, errors, integration failures',
        sales: 'Pricing, upgrades, new accounts',
        unclear: 'The message does not identify a clear owner',
      },
    },
    refund: {
      type: 'noul',
      instructions: 'The customer explicitly requests a refund or credit.',
    },
    frustration: {
      type: 'score',
      instructions: 'How frustrated does the customer appear?',
      criteria: ['Calm', 'Frustrated', 'Very angry'],
    },
  },
};

const started = Date.now();

const response = await fetch(LIVE_ENDPOINT, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Origin: ORIGIN,
  },
  body: JSON.stringify(body),
});

const wallClockMs = Date.now() - started;
const payload = await response.json().catch(() => null);

if (!payload) {
  console.error(`FAIL — HTTP ${response.status} with a body that is not JSON.`);
  process.exit(1);
}

if (payload.ok !== true) {
  console.error(`FAIL — HTTP ${response.status}: ${payload.message ?? 'no message'}`);
  if (payload.detail) {
    console.error(`detail: ${payload.detail}`);
  }
  process.exit(1);
}

const problems = [];

if (typeof payload.model !== 'string' || !payload.model.includes('jev')) {
  problems.push('the response did not name a resolved Jev model');
}
if (typeof payload.generationId !== 'string') {
  problems.push('no generation id, so the call cannot be cited');
}
if (typeof payload.latencyMs !== 'number') {
  problems.push('no provider latency');
}
if (typeof payload.usage?.cost !== 'number') {
  problems.push('no reported cost');
}
if (Object.keys(payload.answers ?? {}).length !== Object.keys(body.questions).length) {
  problems.push('the response did not answer every question');
}
if (payload.answers?.refund && 'confidence' in payload.answers.refund) {
  problems.push('a noul answer carried a confidence field, which the contract forbids');
}
if (payload.answers?.frustration && typeof payload.answers.frustration.score !== 'number') {
  problems.push('the score was not returned as a number');
}

console.log(`HTTP ${response.status} in ${wallClockMs} ms wall clock`);
console.log(`  model      ${payload.model}`);
console.log(`  request    ${payload.generationId}`);
console.log(`  latency    ${payload.latencyMs} ms reported by the provider`);
console.log(`  cost       $${payload.usage?.cost ?? 'unreported'} reported`);
console.log(
  `  tokens     ${payload.usage?.inputTokens ?? '?'} in / ${payload.usage?.outputTokens ?? '?'} out`,
);
console.log(`  team       ${payload.answers?.team?.choice ?? '?'}`);
console.log(`  refund     ${payload.answers?.refund?.noul ?? '?'}`);
console.log(`  frustration ${payload.answers?.frustration?.score ?? '?'} / 2`);

if (problems.length > 0) {
  console.error('\nFAIL — the response broke the verified contract:');
  for (const problem of problems) {
    console.error(`  - ${problem}`);
  }
  process.exit(1);
}

console.log('\nPASS — transport and response shape only. Not a quality result.');
