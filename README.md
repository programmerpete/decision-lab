# Decision Lab

A personal, interactive field guide to **TypeSafe Jev and LLMs**: where typed
decisions fit, where language generation fits, and how to compare them fairly.

**Default release: fixture-only teaching demo.** No model APIs are connected in fixture
mode, which is what loads by default. Every probability and score in a fixture is
authored. The two lanes intentionally display the same illustration; they do not
simulate two model runs. Latency, cost, tokens, and model identity are unknown, not
zero. Edited inputs without an exact fixture are rejected.

**Opt-in live mode** calls a server-side proxy for the Jev lane only. It requires a
presenter token, is off by default, and never falls back to fixtures on failure. See
[Live mode](#live-mode).

## Run locally

Requires Node 22.12+ and npm.

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. Use **Explore** for the playground, **Learn** for
Choice/Score/Noul, **Present** for eight slides with speaker notes, and **Method**
for the evaluation rules. No API key is needed.

## Included

- Four scenarios: support routing, code-review risk triage, moderation/PII, and agent
  tool selection.
- Fourteen synthetic presets, including negation, ambiguity, injection, safe
  lookalikes, and obfuscated contact details.
- Five typed judgments per example, an illustrative routing threshold, and a
  provenance-labelled JSON export.
- Responsive dark UI and a lazy-loaded Three.js illustration, paused offscreen, static
  under reduced motion, and replaced by a CSS illustration if WebGL or the chunk fails.
- Eight-slide presentation with speaker notes, generated into
  [PRESENTATION-SLIDES.md](PRESENTATION-SLIDES.md), plus the presenter guide
  [PRESENTATION.md](PRESENTATION.md).
- [Implementation plan](PLAN.md), [home-AI handoff](HANDOFF.md), and the
  [verified transport contract](VERIFIED-TRANSPORT.md) for the future live phase.

Not yet included: real benchmark results, question-count experiments, actual code
reviews, redaction, tool execution, hybrid orchestration, or a live adapter for the LLM
lane.

## Live mode

Live mode is for the presenter. Open **Presenter: live mode** in the input panel,
choose **Live**, and enter the presenter token. Then submit as usual.

- The token lives in memory for that tab only. It is never written to storage, never
  placed in a URL, and never built into the bundle. Vite inlines every `VITE_*`
  variable into public JavaScript, so a key must never live there.
- The browser calls a Cloudflare Worker that holds the provider key server-side. It
  never contacts the provider directly. The Worker enforces the model allowlist, a
  bearer token, an origin allowlist, a rate limit, a body-size limit, a daily spend
  ceiling, and timeouts.
- Only the Jev lane has a live adapter. In live mode the LLM lane states plainly that
  it has none, rather than showing a number it did not measure.
- A failed call renders the failure with its status, kind, and detail. It never falls
  back to fixture values, and a partly valid response is rejected whole.
- A live result is labelled with the resolved model id, the request id, provider
  latency, tokens, and reported cost.

Verify the deployed endpoint by hand (this is the only command that spends money, and
it never runs in CI):

```sh
LIVE_TOKEN='…' npm run smoke:live
```

It proves transport and response shape only. It is not a quality result.

### CORS

The Worker allowlists specific origins. If you serve the site from somewhere else, the
Worker returns 403 and the lane will say so. Origins currently allowlisted:
`https://programmerpete.github.io`, `http://localhost:5173`, `http://127.0.0.1:5174`.

## Verify

```sh
npm run format:check
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

`npm test` runs the unit suite and then checks that `PRESENTATION-SLIDES.md` matches
`src/presentation.json`. Browser tests run against the production build with a nested
`/decision-lab/` base path, matching a GitHub project site, on desktop and mobile
Chromium.

Unit tests check fixture provenance, exact-input matching, mutation isolation, the
routing threshold, and the safety-related directions of the authored examples.
Browser tests check all fourteen presets, stale-output clearing, the export, keyboard
behaviour, resilience, and that no request leaves the preview origin. These tests
validate the demo, **not model quality**.

Regenerate the slide export after editing `src/presentation.json`:

```sh
npm run presentation:write
```

## Publish

Target repository: `programmerpete/decision-lab`. Intended public URL:
**https://programmerpete.github.io/decision-lab/**

The URL becomes live only after the repository exists, Pages is enabled, and the
deployment succeeds. In GitHub **Settings → Pages**, choose **GitHub Actions**. Push
to `main` or run the **Checks and Pages** workflow. Pull requests run checks without
deploying.

GitHub Pages hosts only static assets. Later, a separately deployed server must hold
OpenRouter/TypeSafe credentials, validate requests, and enforce access and spending
limits. Never put a secret in a `VITE_*` variable, browser storage, a public file, or
a GitHub Pages build. See [HANDOFF.md](HANDOFF.md) and
[VERIFIED-TRANSPORT.md](VERIFIED-TRANSPORT.md).

## Source map

| Location                   | Responsibility                                                         |
| -------------------------- | ---------------------------------------------------------------------- |
| `src/domain.ts`            | Contracts, catalogue validation, exact-input matching, routing, export |
| `src/scenarios.ts`         | Synthetic inputs, policies, and the fourteen authored illustrations    |
| `src/App.tsx`              | Header, view switch, playground, Learn, Method                         |
| `src/ResultLane.tsx`       | One labelled result lane: five judgments and the null metric footer    |
| `src/Presentation.tsx`     | Slide rendering, controls, keyboard navigation, speaker notes          |
| `src/presentation.json`    | Canonical slide content for all eight slides                           |
| `src/Orbit.tsx`            | Decorative Three.js visual only; receives no results                   |
| `src/LazyOrbit.tsx`        | Lazy load, suspense fallback, and error boundary for the orbit         |
| `src/live.ts`              | Live request building and response validation against the Worker       |
| `tests/unit/`              | Domain invariants, slide parity, live parsing, contract checks         |
| `tests/e2e/`               | Browser behaviour against the production build under the nested base   |
| `scripts/presentation.mjs` | Renders and checks `PRESENTATION-SLIDES.md`                            |
| `scripts/live-smoke.mjs`   | Opt-in smoke test against the deployed endpoint; never runs in CI      |

### How the types keep the demo honest

- Metric fields are typed `null`, so an authored number cannot be assigned to a
  latency, cost, or token field.
- Fixture runs have no `live` source member, and live runs are a separate type, so the
  two can never be merged into one ambiguous envelope.
- Both lanes are built from one shared `Illustration` in fixture mode, so there is no
  way to give them different answers.
- Noul answers carry no `confidence` property, matching the verified API shape.
- A lane state is a discriminated union, so "not run", "failed", and "here is a
  result" are distinct values rather than an empty result with missing fields.

This is an independent experiment, not affiliated with TypeSafe, LangChain, or
OpenRouter. Use synthetic data only. The site self-hosts its fonts. In fixture mode it
sends no scenario input anywhere; in live mode it sends the scenario text to the
deployed proxy and nowhere else.
