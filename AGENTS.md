# Decision Lab

This is a personal, public teaching POC, not production banking software.

- Read README.md, PLAN.md, and HANDOFF.md before continuing. Implement one verified vertical slice at a time.
- React + TypeScript + Vite; Three.js is decorative. Keep the site usable without WebGL, with reduced motion, and on mobile.
- Preserve explicit fixture provenance. Never invent live outputs, model IDs, timings, tokens, or costs. Unknown metrics are null, not zero. Never silently fall back from live mode to fixtures.
- Keep secrets on a separately deployed backend. GitHub Pages is static hosting. No secret belongs in any `VITE_*` variable or browser storage. CORS is not authentication.
- Live mode is opt-in and presenter-only. The presenter token is held in memory for the tab: never in a `VITE_*` variable, never in storage, never in a URL, never committed. A failed live call renders the failure and must never fall back to fixture values, and a partly valid response must be rejected whole rather than shown with holes.
- The OpenRouter decisions transport is verified by live calls: `POST https://openrouter.ai/api/alpha/decisions` with model slug `~typesafe/jev-latest`, which resolves to a dated id. It is not chat completions. See [VERIFIED-TRANSPORT.md](VERIFIED-TRANSPORT.md). Account availability, host runtime compatibility, usage fields, and retention still need their own checks before any adapter is written. The direct TypeSafe route is documented but has not been called.
- Use only synthetic inputs and public references. No private code, customer data, workplace files, or internal service URLs.
- Do not execute tools, approve refunds, merge code, or claim to redact all PII. This is decision support and evaluation.
- Use native, labelled controls and visible focus. Clear stale results on input changes. Inspect rendered UI after visual changes.
- Run `npm run format:check`, `npm run lint`, `npm test`, `npm run build`, and `npm run test:e2e` for functional changes. Default tests must never call paid providers. Use `npm run format` for formatting and `npm run presentation:write` after editing slide content.
- Keep benchmark labels independent of model outputs and teaching fixtures. Performance claims require quality metrics, sample size, and measurement provenance.
- Do not commit `.env`, `.scratch`, test artifacts, provider credentials, or request logs. Ask before paid provisioning or large API batches.
