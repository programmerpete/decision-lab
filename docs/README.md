# Decision Lab

A personal, interactive field guide to **TypeSafe Jev and LLMs**: where typed decisions fit, where language generation fits, and how to compare them fairly.

**Current release: fixture-only teaching demo.** No model APIs are connected. Every probability and score is authored. The two lanes intentionally display the same illustration; they do not simulate two model runs. Latency, cost, tokens, and model identity are unknown, not zero. Edited inputs without an exact fixture are rejected.

## Run locally

Requires Node 22.12+ and npm.

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. Use **Explore** for the playground, **Learn** for Choice/Score/Noul, **Present** for eight slides with speaker notes, and **Method** for the evaluation rules. No API key is needed.

## Included

- Four scenarios: support routing, code-review risk triage, moderation/PII, and agent tool selection.
- Fourteen synthetic presets, including negation, ambiguity, injection, safe lookalikes, and obfuscated contact details.
- Five typed judgments per example, illustrative review threshold, and provenance-labelled JSON export.
- Responsive dark UI and a lazy-loaded Three.js illustration, paused offscreen and with reduced motion.
- Eight-slide presentation and a [presenter guide](PRESENTATION.md).
- [Implementation plan](PLAN.md), [home-AI handoff](HANDOFF.md), and GitHub Pages workflow.

Not yet included: live APIs, real benchmark results, question-count experiments, actual code reviews, redaction, tool execution, or hybrid orchestration.

## Verify

```sh
npm test
npm run build
npm run format:check
npx playwright install chromium
npm run test:e2e
```

Browser tests run against the production build with a nested `/decision-lab/` base path, matching a GitHub project site. Unit tests check fixture provenance, mutation isolation, review thresholds, and safety-related routing outcomes. These tests validate the demo, **not model quality**.

## Publish

Target repository: `programmerpete/decision-lab`. Intended public URL:
**https://programmerpete.github.io/decision-lab/**

The URL becomes live only after the repository exists, Pages is enabled, and the deployment succeeds. In GitHub **Settings → Pages**, choose **GitHub Actions**. Push to `main` or run the **Checks and Pages** workflow. Pull requests run checks without deploying.

GitHub Pages hosts only static assets. Later, a separately deployed server must hold OpenRouter/TypeSafe credentials, validate requests, and enforce access and spending limits. Never put a secret in a `VITE_*` variable, browser storage, a public file, or a GitHub Pages build. See [HANDOFF.md](HANDOFF.md).

## Source map

| Location               | Responsibility                                                    |
| ---------------------- | ----------------------------------------------------------------- |
| `src/domain.ts`        | Typed fixture results, exact-input matching, illustrative routing |
| `src/scenarios.ts`     | Synthetic inputs, policies, authored illustrations                |
| `src/App.tsx`          | Playground, primitives guide, methodology                         |
| `src/Presentation.tsx` | Slides and speaker notes                                          |
| `src/Orbit.tsx`        | Decorative Three.js visual only                                   |
| `tests/`               | Domain and browser behavior checks                                |

This is an independent experiment, not affiliated with TypeSafe, LangChain, or OpenRouter. Use synthetic data only. The current site uses Google Fonts but sends no scenario input to any model or server.
