# Presentation run sheet

Target: 15–20 minutes, mixed technical and leadership audience. Open **Present** in the website; eight slides include speaker notes. Browser fullscreen is optional. Use buttons or arrow keys when focus is outside controls.

| Time      | Slide / demo                            | Talk track                                                                                                                                                                  |
| --------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0–2 min   | Does this decision need a conversation? | Ask where teams pay for an LLM to return only a category. LLMs are useful for generation, explanation, and deeper reasoning; typed decision APIs target bounded judgments.  |
| 2–4 min   | Choice / Score / Noul; open Learn       | Explain categories, ordered scores, and probability of a proposition. A 50% probability is uncertainty, not a middling score. Probability is not confidence or accuracy.    |
| 4–7 min   | Support triage; open Explore            | Run Duplicate charge, Negation, and Ambiguous. Show five questions, explicit review route, raw JSON. An intent classifier cannot approve a refund.                          |
| 7–9 min   | Code review                             | Compare raw token logging with redacted logging; then removed authorisation. A model that flags everything is not useful. Small snippets cannot prove complete code safety. |
| 9–12 min  | Moderation / PII                        | Compare Scam warning and Credential scam; show obfuscated synthetic address. Context matters. Detection does not mean exact span identification or safe redaction.          |
| 12–14 min | Agent tools                             | Search documentation, missing order number, unsupported deletion. A fixed catalogue is inspectable. Selection grants no permissions; no tool is actually called.            |
| 14–17 min | The experiment                          | Show measured results only after API/evaluation phases. Discuss accuracy, misses, false alarms, review rate, p50/p95 latency, total cost, and failures together.            |
| 17–20 min | Use each component for its strengths    | Explain a measured hybrid workflow and its tradeoffs. Land the two application use cases below. End on evidence and limitations.                                            |

## Application use cases

Both belong in the closing section. Use case A also illustrates the primitives slide,
because it maps one-to-one onto Choice, Score, and Noul in a single call.

### A — The AI traffic cop

- **IN:** incoming form leads, support tickets, emails.
- **Jev asks (~200 ms):** What is it? (choice) · How important? (score) · What next? (choice or noul).
- One request carries every judgment, so four questions cost one round trip.
- **HIGH** → a human, now ("It's the CMO of Coca-Cola.") · **MIDDLE** → automate it, or an LLM drafts the reply · **LOW** → ignore it (confidence too low to act on).
- Supporting stat cards: _Design agency_ — lead scored 0–1, 98% = reply fast. _Support desk_ — routed to the right team in ~200 ms.
- Takeaway: **keep Jev in an advisory role.**

### B — Put Jev at the front of the queue

- **Before:** "Get an instant quote" → "We'll email you by end of day."
- **After:** "I need my driveway power washed" → Jev scores nearby businesses → best match and quote, instantly.
- Takeaway: **you don't waste the client's time.**

### One live result worth showing

A single verified smoke-test call, reproduced five times out of five, is the clearest
argument for reading the whole distribution rather than one number: the enquiry is
time-pressured (0.98) and its importance score of 2.64 sits nearest "High: a human
should respond now", yet `next_step` says `automate` and importance confidence is only
0.64, with the top two levels split 0.35/0.65. A workflow keyed off the rounded score
alone would escalate; one keyed off `next_step` alone would automate. Five runs of the
same authored input make that a stable property of the scenario — they measure
consistency, not correctness.

**Quote the end-to-end number, not the provider number.** The provider reported 201 ms
for that call; the published site observed **268 ms** from submit to a complete answer,
the difference being the proxy and the network. The lane shows both, labelled
`Provider latency` and `End to end`. A person waiting on the screen experiences the
second one.

Treat any single figure as one sample, because the end-to-end number depends on the
path. A second measurement from a different host came in at 450 ms end to end against
310 ms of provider latency — same code, same Worker, different route. Say "a few
hundred milliseconds", and name the origin you measured from.

### Both lanes, live

The site runs both arms in parallel on the same input and the same five questions, each
labelled with its own provider, model, request id, latency, and reported cost. Two
recorded runs of the **same** support-triage scenario:

|                  | Run A: Jev   | Run A: model | Run B: Jev                  | Run B: model                |
| ---------------- | ------------ | ------------ | --------------------------- | --------------------------- |
| Route            | Billing 100% | Billing 95%  | Billing 52% / Technical 48% | Technical 65% / Billing 25% |
| Confidence       | 1.00         | 0.98         | 0.35                        | 0.72                        |
| Provider latency | 317 ms       | 2,496 ms     | 249 ms                      | 2,351 ms                    |
| Reported cost    | $0.0000216   | $0.001793    | $0.0000206                  | $0.0017690                  |

**The arms agreed on Run A and disagreed on Run B, on the same scenario and the same
input.** So agreement is not guaranteed in either direction — it varies by scenario _and
between runs_. Do not promise a disagreement, and do not promise an agreement. Run B is
the more interesting shape when it happens: the arms differed in both the decision and
the stated certainty, which is the substance of the comparison.

**What is stable across both runs is the order of magnitude:** roughly 9–18× slower and
80–86× more expensive on the model lane. That is the claim to stand behind.

Two calls per arm is still a smoke test of the comparison, not a benchmark — it measures
nothing about accuracy.

Label it for what it is: one call on synthetic input that proves transport and shape.
It is not a benchmark and not a quality result. See
[VERIFIED-TRANSPORT.md](VERIFIED-TRANSPORT.md).

## State the mode aloud

**Current fixture talk:** “These are authored examples illustrating the interfaces. Neither model has run. These numbers are not accuracy, latency, or cost results.” Keep the fixture badge and disclaimer visible. Edited inputs deliberately fail rather than generate invented answers.

**Future live talk:** identify actual model IDs, provider, run date, and whether costs are billed or estimated. If networking fails, explicitly switch to fixtures; never present a replay as a live model run. Ask the audience for a synthetic challenge input, not a real customer ticket or private code snippet.

## Rehearsal

Run the site locally or load the public page before presenting. Verify zoom/projector readability and keyboard navigation. Keep a local build available for network failure. Three.js is decorative: the presentation still works if WebGL fails or reduced motion is enabled. Do not display terminals containing API keys or account billing details.

Avoid “Jev understands everything”, “LLMs are obsolete”, or “200× faster” without the original benchmark context and your own measurements. The strongest demonstration includes a failure or ambiguous case and explains how application code contains it.
