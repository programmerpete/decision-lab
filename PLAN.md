# Decision Lab — POC plan

## Goal and audience

Build a public, presentation-ready lab that answers: **when does a task benefit from a typed decision model instead of, or alongside, an LLM?**

Assume a mixed engineering/leadership audience and a 15–20 minute talk. Success is an understandable demonstration and a reproducible comparison, not a predetermined Jev win. “LLMs versus Jev” describes different interfaces and workloads, not a claim that their underlying architectures are entirely unrelated.

The starter uses React, TypeScript, Vite, and decorative Three.js. GitHub Pages is the persistent frontend host. Amp can build and iterate; an idle development orb is not the permanent API service.

## Established facts and open questions

- Jev exposes typed Choice, Score, and Noul judgments rather than generated prose. Choice returns a distribution over supplied alternatives; Score uses ordered levels; Noul estimates a proposition's probability.
- Many questions can share one state/request. This is central to the demo and must also be offered to the LLM baseline.
- TypeSafe documents `POST https://api.typesafe.ai/v1/systemone` with a TypeSafe API key. A model alias such as `jev-latest` may change; record the resolved version where available.
- **The OpenRouter decisions transport is verified by live calls** (HTTP 200, 254–412 ms, roughly $0.00002 per call): `POST https://openrouter.ai/api/alpha/decisions` with model slug `~typesafe/jev-latest`, which resolves to a dated id such as `typesafe/jev-1.13-20260917`. It is not chat completions. `score` is a continuous float, `confidence` exists on choice and score but not on noul, `probabilities` carries the full distribution, and one request carries every question for a state. See [VERIFIED-TRANSPORT.md](VERIFIED-TRANSPORT.md). Account rate limits, host runtime compatibility, usage/cost fields, and retention policy are still unverified and must be checked before an adapter is written. Direct TypeSafe remains documented but uncalled.
- Confidence is not maximum probability or measured accuracy. Jev confidence depends on the primitive; Noul does not expose the separate confidence measure. Preserve provider-specific semantics.
- Vendor 200× speed / 400× cost claims are workload-specific claims, not acceptance criteria or results for this project.
- Schema compliance does not imply correct or safe decisions. Jev documentation discusses math, indirection, distracting context, and adversarial weaknesses. Include failure cases.

## Product surfaces

1. **Learn:** three primitive cards; compare categorical, ordinal, and probabilistic outputs. Show where an LLM's prose is useful.
2. **Explore:** shared input and policy, curated presets, independently labelled Jev/LLM result lanes, raw validated output, provenance, error states, and later measured metrics.
3. **Present:** eight slides, speaker notes, quick return to the lab; useful without live credentials or internet.
4. **Method:** explain experimental controls, safety boundaries, cost provenance, and limitations.
5. **Benchmark (future):** run a bounded labelled suite and question-count sweep; export per-request evidence and aggregates. No public unbounded batch execution.

The Three.js orbit is a conceptual illustration. It must never suggest that it exposes model internals or represents measured throughput. No animation may delay or obscure results. The UI must remain usable if WebGL or remote fonts fail.

## Scenarios and what to measure

| Scenario       | Questions                                                                                    | Contrasts                                                                  | Boundary / quality measure                                                                            |
| -------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Support triage | Team, refund intent, urgency, frustration, injection                                         | Refund versus explicit negation; vague issue; injected route instruction   | Routing isn't refund permission. Team accuracy, refund precision/recall, review rate.                 |
| Code review    | Review specialist, weakened authorisation, sensitive logging, visible test changes, scrutiny | Removed sole auth check; raw token logging; redacted logging               | Risk triage, not full review or approval. Missed seeded defects and safe-code false alarms.           |
| Moderation/PII | Allow/review/block, contact details, targeted abuse, harm, credential scam                   | Scam versus warning; synthetic address; obfuscated address                 | Classification isn't span extraction/redaction. PII/scam recall, false positives, policy correctness. |
| Agent tools    | Catalogue choice, missing context, destructive intent, injection, complexity                 | Documentation query; missing order number; unsupported destructive request | Selection isn't execution. Tool-choice accuracy, correct clarification/no-tool rate.                  |

Expand PII coverage later to names with context, phone/address, identifiers, and public-versus-private information using synthetic values and explicit policy. Treat actual redaction as a separate task with span-level precision/recall. For code review, add repository context only after a synthetic diff benchmark works; never publish private code.

## Architecture for the live phase

```text
GitHub Pages browser
  ├─ authored fixture evaluator (local, explicitly labelled)
  └─ HTTPS evaluation request
       └─ authenticated, rate-limited server
            ├─ request / policy / model allowlist validation
            ├─ OpenRouter structured-output LLM adapter
            ├─ verified Jev transport adapter
            ├─ output validation and measurement
            └─ normalized results + provenance (no secrets)
```

Use a small TypeScript server on a separately hosted service such as Cloudflare Workers or a Node-compatible host. Choose after verifying both provider clients and deployment constraints. CORS is a browser restriction, **not authentication**. For the first public demo, allow only presenter-authenticated live calls; everyone else can use fixtures. Avoid public bring-your-own-key entry in this phase.

Proposed request: `scenarioId`, `policyVersion`, `input`, allowed `modelIds`, and `questionSetId`. Resolve prompts and question definitions on the server. Never accept arbitrary provider URLs, executable tools, or an unrestricted system prompt. Use a separate server-side batch runner for benchmarks.

Proposed result envelope: discriminated `source` (`live` or `illustrative-fixture`); request ID; scenario and policy versions; individual provider outcome (`success`, `error`, `timeout`, `cancelled`); validated judgments; provider and resolved model ID; timestamps; input/output usage; server-to-provider duration; total browser duration; retries; schema validity; billed/estimated/unknown cost with currency and pricing timestamp. Unknown is `null`, not zero. Keep raw responses only in bounded, redacted local exports. Never merge fixture values into an incomplete live response.

LLM probabilities, if requested, are self-reported and not automatically calibrated or comparable to Jev's. Show their source. Compare final decisions against independent labels; evaluate calibration separately.

## Delivery sequence and acceptance gates

### Phase 0 — Teaching shell (implemented locally)

Four scenarios and 14 presets, primitive guide, slides, responsive UI, JSON export, honest fixture labels, disabled-by-absence live integration. Exact unmatched input returns a clear error. Output clears when input or scenario changes. Tests and production build must pass; inspect desktop/mobile and result states before release.

### Phase 1 — Verify provider access and build one live vertical slice (implemented)

**Done.** Transport verified by live calls, and the site now has an opt-in live mode for the Jev lane: presenter token held in memory, per-lane states, provider-identity and usage provenance, abort and stale-response handling, schema validation that rejects a partly valid response whole, and an explicit failure state that never falls back to fixtures. The LLM lane has no live adapter and says so. `npm run smoke:live` exercises the deployed endpoint by hand and never runs in CI.

At home, inspect the OpenRouter account/model catalogue and TypeSafe docs. Capture one successful, synthetic request/response for each provider; redact keys. Record exact model IDs and supported structured schemas, rate limits, usage/cost fields, and retention policy. Complete support triage first; do not add a generic adapter framework before transport is understood.

Acceptance: real independently returned results, abort/timeout handling, per-provider failures visible, schema rejection, no stale response after editing, no secret in browser/build/network responses, no silent fixture fallback. A synthetic live smoke test proves access, not model quality.

### Phase 2 — Expand scenarios and secure the public live surface

Move each scenario's questions/options/scales into a shared versioned definition; derive both Jev requests and the LLM output schema from it. Keep authored display fixtures separate from test labels. Add preset/custom-input modes, independent lane completion, provider identity, and real metrics. Tool selection remains non-executing.

Acceptance: presenter authentication, server-side model allowlist, input/response byte limits, per-user/IP rate limits, maximum concurrency, timeouts, bounded retries, daily spend cap backed by durable accounting/reservations, and kill switch. Fail closed if budget accounting is unavailable. No request-body logging by default; document provider retention and consent. Verify forged origins do not bypass authentication. Keep the public fixture site functional when the API is unavailable.

### Phase 3 — Reproducible evaluation

Build at least 25 independently labelled cases per scenario for an initial 100-case exploratory set. Freeze a held-out portion before tuning; expand before making strong statistical claims. Include both positives and safe counterparts, negation, ambiguity, multilingual text, distracting context, input-length boundaries, and injection. Have a second reviewer resolve ambiguous labels where possible. Record policy version and label rationale; do not use a model's own output as ground truth.

Compare Jev with one current fast/economical OpenRouter LLM and optionally one larger LLM. Choose IDs from the actual account catalogue, not memory. Give each the same semantic task and structured output contract, all questions in one request, equivalent context, and no requirement for prose in only one arm. Record reasoning settings, temperature where supported, token limits, provider routing, caching, version, run date, and server region. Randomize/interleave order; bound concurrency; separate cold and warm runs.

Report per-scenario accuracy and class-level precision/recall/F1; ordinal error for scores; calibration where justified; review/abstention coverage; schema/transport errors and timeouts. Do not hide failures by averaging only successful easy requests. Show latency p50/p95 with sample count, paired input lengths, and browser versus provider timing. Include all retries and failed-call cost when usage is available. Report estimated list-price cost separately from provider-reported billing; show unknown usage explicitly. Bootstrap paired intervals if the sample supports them, and state uncertainty.

Run 1/5/10/20-question sweeps using genuinely distinct, comparable questions. Avoid duplicated questions that artificially inflate the apparent advantage. Show total cost and cost per valid decision, not only tokens. Add deterministic regex/rule baselines where appropriate so the comparison is not artificially restricted to models.

Acceptance: downloadable raw normalized run records, frozen labels separate from fixtures, repeatable command, visible uncertainty and failure rates, and no speed/cost headline without its quality and workload context.

### Phase 4 — Hybrid story and presentation rehearsal

Test a workflow where Jev proposes a route and an LLM explains or handles difficult cases, with human review for unresolved risk. Tune escalation on development data; evaluate on held-out data. Compare whole-workflow cost/latency and missed escalations against LLM-only. Additional calls can make the hybrid slower or more expensive.

Acceptance: no autonomous high-impact actions; full workflow measurement; 15–20 minute rehearsed talk; network-failure fallback to explicitly labelled fixtures; public site checked on laptop and phone; presenter credentials rotated if exposed. Final slide states where each method worked and failed rather than crowning a universal winner.

## Non-goals

Training a model, proving vendor architecture claims, production moderation, automated refunds, merging pull requests, running arbitrary tools, processing workplace/customer data, or publishing a universal model leaderboard.

## Sources

Re-check these when implementing live APIs; API shapes and model aliases can change.

- [LangChain: Building a harness with Jev](https://www.langchain.com/blog/building-a-harness-with-jev)
- [TypeSafe quickstart](https://docs.typesafe.ai/introduction/quickstart)
- [Introducing System One models and Jev](https://typesafe.ai/blog/introducing-system-one-models-and-jev)
- [Jev 1.13 jaggedness / limitations](https://docs.typesafe.ai/model-jaggedness/jev-1.13)
- [Confidence semantics](https://docs.typesafe.ai/confidence)
- [OpenRouter documentation](https://openrouter.ai/docs)
- [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages)
- [Amp orbs](https://ampcode.com/docs/orbs)
