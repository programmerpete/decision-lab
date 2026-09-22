# Verified transport (future phase — do not implement yet)

This file records the provider contract as **verified by real calls**, replacing the
"unverified" caveats in [PLAN.md](PLAN.md) and [HANDOFF.md](HANDOFF.md). It is
reference material for the future live phase. **No adapter code exists in this
release, and none should be added until the pre-adapter checks at the bottom pass.**

Source: a separate OpenRouter prep thread that made live calls (HTTP 200, 254–412 ms,
roughly $0.00002 per call) and captured byte-faithful response fixtures.

## Routes

| Route                | Endpoint                                             | Requested model        | Status                     |
| -------------------- | ---------------------------------------------------- | ---------------------- | -------------------------- |
| Deployed proxy       | `POST https://decision-lab-live.petersk.workers.dev` | `~typesafe/jev-latest` | Live and verified          |
| OpenRouter decisions | `POST https://openrouter.ai/api/alpha/decisions`     | `~typesafe/jev-latest` | Verified with live calls   |
| TypeSafe direct      | `POST https://api.typesafe.ai/v1/systemone`          | `jev-latest`           | Documented, not yet called |

**The site calls the proxy, never the provider.** The proxy holds the OpenRouter key
server-side and enforces a bearer presenter token (401), an origin allowlist (403), a
model allowlist (400), body and state size limits (413), a rate limit of 30 requests
per minute (429), a daily spend ceiling that fails closed (503), and timeouts (504).
Its failure shape is `{ ok: false, kind, status, message, detail? }` and it
structurally cannot carry answers, so a failure can never be mistaken for a result.

The proxy's request shape is the same `{ state, questions }` body below, with a `lane`
field (`"jev"` or `"llm"`, defaulting to `"jev"`) and no `model` field: sending one is a 400. Each lane has its own model allowlist, so the typed slug is rejected on the LLM
lane and vice versa. Its success shape adds `lane`, `provider`, `generationId`,
`usage` (`inputTokens`, `outputTokens`, `cost`), and `latencyMs`.

The LLM lane is pinned to `anthropic/claude-haiku-4.5`, chosen by measuring four
candidates on the same request rather than from memory: reasoning models were an order
of magnitude slower, which matters when someone is watching. Expect **2–4 seconds** on
that lane against a few hundred milliseconds on the typed lane. Both arms receive
identical input and identical questions; the rubric `legend` is derived server-side from
the criteria sent, so both always carry one.

Both accept `Authorization: Bearer <key>` and a JSON body of the same shape:

```json
{
  "model": "~typesafe/jev-latest",
  "state": "unstructured input, or a structured object/array",
  "questions": {
    "team": {
      "type": "choice",
      "instructions": "Which team should handle this message?",
      "criteria": { "billing": "Charges, invoices, refunds" }
    }
  }
}
```

The OpenRouter decisions endpoint is **not** chat completions. It is a distinct
endpoint (`/api/alpha/decisions`), and the TypeScript SDK reaches it through
`openrouter.alpha.decisions.create({ decisionsRequest })`.

## Verified response semantics

- **Resolved model id.** `~typesafe/jev-latest` resolves to a dated id such as
  `typesafe/jev-1.13-20260917`. The response `model` field carries the **resolved**
  id, not the alias that was requested. Provenance must record both.
- **Choice** answers are `{ type, choice, confidence, probabilities }`, where
  `probabilities` is the full distribution over the supplied option keys.
- **Score** answers are `{ type, score, confidence, legend, probabilities }`.
  `score` is a **continuous float**, not an integer index: 1.04 on a three-level
  rubric and 2.64 on a four-level rubric were both observed. It is a position on the
  rubric, so it must not be rounded in the interface.
- **Noul** answers are `{ type, noul }` with **no separate confidence field**. The
  probability is the answer. Never present confidence as uniform across the three
  primitives.
- **Criteria.** Choice criteria is an object mapping option key to description.
  Score criteria is an ordered array of level descriptions. Noul criteria is
  optional; choice and score criteria are required.
- **One round trip.** A single request carries every question for a state, so a
  four-judgment call is one round trip rather than four.

## Why this matters for the presentation

One live four-question call was reproduced five times with the same result. It is useful
teaching material precisely because the point estimate and the routing answer
disagree:

```
intent             new_business    confidence 0.95   (0.97 of the distribution)
importance         2.64            confidence 0.64   <- lowest of the four
                   nearest level 3 "High: a human should respond now" (distance 0.36)
next_step          automate        confidence 0.70   (human_now only 0.20)
is_time_pressured  0.98
```

A workflow keyed off the rounded score alone would escalate. One keyed off
`next_step` alone would automate. Reading the distribution is what makes the
disagreement visible.

**Label this honestly.** It is one smoke-test call on a synthetic input. It proves
transport and response shape. It is not a benchmark, not a quality result, and it
must never be presented as this project's accuracy or latency measurement. The
fixture-only site continues to show `null` for every metric.

**Two timings, and they are not interchangeable.** The provider reports its own
latency for the call. The browser measures the whole round trip: request, proxy,
provider, and response parsing. From the published site that was 268 ms end to end
against 201 ms of provider latency; a second measurement from a different host came in
at 450 ms against 310 ms, because the end-to-end figure includes the network path.
Quote the end-to-end figure when describing what a person waits for, name the origin
you measured from, and keep the provider figure as the provider's own measurement. The
lane shows both, labelled `Provider latency` and `End to end`.

## Pre-adapter checks still outstanding

These were **not** covered by the smoke test and must be verified before any adapter
is written:

- Account availability and rate limits on the owner's actual account.
- Whether usage/cost fields are returned for every model, and in what units.
- Provider data retention policy and consent language.
- Failure behaviour beyond what has been exercised: partial answers, schema rejection,
  and error bodies for each failure kind.

Two of these are now resolved by the deployed proxy:

- **Runtime compatibility** — verified. The Worker runs the call and returns
  `latencyMs`, `usage`, and a `generationId` on every success.
- **Failure behaviour** — the Worker returns `ok: false` with `kind`, `status`,
  `message`, and optional `detail` for auth, origin, shape, size, rate limit, provider,
  network, invalid response, spend ceiling, and timeout. A failure can never carry
  answers.

Also outstanding from [HANDOFF.md](HANDOFF.md): secrets live on the Worker and nowhere
else — never in a `VITE_*` variable, browser storage, a public file, or a GitHub Pages
build. The presenter token is typed into the page and held in memory for that tab.
