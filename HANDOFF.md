# Continue at home

## Paste this into your AI coding session

> Work in this personal `decision-lab` repository. Read AGENTS.md, README.md, and PLAN.md. The existing React/Vite/Three.js site is an honest fixture-only teaching demo, with four scenarios and an eight-slide presentation. Continue Phase 1: verify my actual OpenRouter/Jev access, then implement one secure live support-triage comparison. Read VERIFIED-TRANSPORT.md first — the transport is already verified, so do not guess a Jev chat-completions endpoint or model ID, and do not re-derive the contract from memory. Keep keys entirely server-side; preserve fixture mode and never silently replace failed live results with fixtures. Add tests for validation, partial failure, stale requests, and metrics provenance. Build and inspect the rendered UI. Follow PLAN.md for the other scenarios and fair benchmarking. Ask before provisioning paid services or spending on a large evaluation batch.

## Start

```sh
git clone https://github.com/programmerpete/decision-lab.git
cd decision-lab
npm ci
npm run dev
```

This clone command works after the repository has been published. If transferring the local folder instead, omit `node_modules`, `dist`, `.git`, `.beads`, and `.scratch`, then install from the lockfile.

## Information the live adapter needs

| Item                        | Status / action                                                                                                                                                                                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OpenRouter API key          | Supply through the backend host's secret manager or ignored server environment file; never paste into committed code.                                                                                                                                   |
| LLM ID                      | Choose an available fast model supporting the required structured output; pin and record it.                                                                                                                                                            |
| Jev access                  | **Transport verified.** `POST https://openrouter.ai/api/alpha/decisions`, slug `~typesafe/jev-latest`, which resolves to a dated id. See [VERIFIED-TRANSPORT.md](VERIFIED-TRANSPORT.md). Account rate limits and retention still need checking.         |
| Documented direct Jev route | `POST https://api.typesafe.ai/v1/systemone`; documented but not yet called. Requires appropriate TypeSafe credentials.                                                                                                                                  |
| Backend host                | **Provisioned and verified.** A Cloudflare Worker holds the provider key server-side and enforces the presenter token, origin allowlist, rate limit, body limit, daily spend ceiling, and timeouts. See [VERIFIED-TRANSPORT.md](VERIFIED-TRANSPORT.md). |
| Public frontend             | GitHub Pages workflow is included; enable Pages with GitHub Actions.                                                                                                                                                                                    |

Do not put an API key into `VITE_OPENROUTER_API_KEY`, any other `VITE_*` setting, GitHub Pages artifacts, localStorage, URL parameters, or a public demo form. A future `VITE_API_BASE_URL` may contain only a public backend URL. CORS alone does not protect a paid endpoint.

## Existing behavior to preserve

- `evaluateFixture` accepts only exact preset text and clones data. It is not a mock classifier.
- Authored probabilities, costs, and timings never masquerade as model measurements. Unknown metrics remain null.
- The fixture threshold examines the first Choice and illustrates review routing only. Do not reuse it as a live safety gate. Injection, PII, permissions, and other policy conditions need their own explicitly tested handling.
- Code snippets and personal information are synthetic. Never import private repositories, screenshots, customer tickets, or production logs.
- Tool choices are displayed but never executed. Moderation does not redact anything.
- Editing input clears old output. Live mode must also ignore late responses for replaced inputs.

## Smallest useful next change

1. Make one manually verified synthetic request per provider from a local server; do not commit response secrets. The OpenRouter decisions transport is already verified — see [VERIFIED-TRANSPORT.md](VERIFIED-TRANSPORT.md) — so this step is about the account and host, not the wire format.
2. Introduce versioned support questions and a typed live result envelope, separate from `FixtureRun`.
3. Validate both output schemas at the server boundary. Preserve distinct failures rather than filling missing fields with defaults.
4. Connect support triage with explicit Fixture/Live controls and per-lane states. Add a request identifier/abort path so stale results cannot overwrite the current input.
5. Measure full validated completion at the server, retain usage provenance, and show errors honestly. Add authentication and durable cost limits before making the API publicly reachable.
6. Run unit/browser checks and a separately opted-in live smoke test. Do not run paid calls in default CI.

## Publish or recover deployment

Confirm `gh api --hostname github.com user --jq .login` returns `programmerpete` before creating a repository. If the repo does not yet exist:

```sh
gh auth login --hostname github.com --git-protocol https --web
GH_HOST=github.com gh repo create programmerpete/decision-lab --public --source=. --remote=origin --push
```

This assumes a local commit already exists. Do not rerun repo creation blindly if a prior call had an uncertain outcome. Check `gh repo view programmerpete/decision-lab` first. For Pages, choose **GitHub Actions** in Settings → Pages, then run **Checks and Pages** if the initial push preceded setup. The expected URL is `https://programmerpete.github.io/decision-lab/`; verify the deployment before sharing it as live.

## Final readiness

The teaching shell can ship independently. A live comparison is ready only when provider identity, output provenance, security limits, partial-failure behavior, and measurement semantics have been verified. A performance claim is ready only after the held-out evaluation, not after an attractive animation or a single successful request.

Dependency-audit follow-up: the initial install reported two moderate advisories, but the local network blocked a detailed public `npm audit` and the configured mirror did not supply audit reports. Run `npm audit` at home and resolve or document findings before the public release. This starter has not been certified vulnerability-free. The lockfile retains exact versions and integrity hashes but omits machine-specific registry URLs for portability.
