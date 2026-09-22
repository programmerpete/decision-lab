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
| 17–20 min | Use each component for its strengths    | Explain a measured hybrid workflow and its tradeoffs. End on evidence and limitations.                                                                                      |

## State the mode aloud

**Current fixture talk:** “These are authored examples illustrating the interfaces. Neither model has run. These numbers are not accuracy, latency, or cost results.” Keep the fixture badge and disclaimer visible. Edited inputs deliberately fail rather than generate invented answers.

**Future live talk:** identify actual model IDs, provider, run date, and whether costs are billed or estimated. If networking fails, explicitly switch to fixtures; never present a replay as a live model run. Ask the audience for a synthetic challenge input, not a real customer ticket or private code snippet.

## Rehearsal

Run the site locally or load the public page before presenting. Verify zoom/projector readability and keyboard navigation. Keep a local build available for network failure. Three.js is decorative: the presentation still works if WebGL fails or reduced motion is enabled. Do not display terminals containing API keys or account billing details.

Avoid “Jev understands everything”, “LLMs are obsolete”, or “200× faster” without the original benchmark context and your own measurements. The strongest demonstration includes a failure or ambiguous case and explains how application code contains it.
