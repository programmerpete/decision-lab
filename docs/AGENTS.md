# Decision Lab

This is a personal, public teaching POC, not production banking software.

- Read README.md, PLAN.md, and HANDOFF.md before continuing. Implement one verified vertical slice at a time.
- React + TypeScript + Vite; Three.js is decorative. Keep the site usable without WebGL, with reduced motion, and on mobile.
- Preserve explicit fixture provenance. Never invent live outputs, model IDs, timings, tokens, or costs. Unknown metrics are null, not zero. Never silently fall back from live mode to fixtures.
- Keep secrets on a separately deployed backend. GitHub Pages is static hosting. No secret belongs in any `VITE_*` variable or browser storage. CORS is not authentication.
- Verify the actual Jev transport and account access before writing its adapter. The documented direct TypeSafe API is not assumed to be OpenRouter chat completions.
- Use only synthetic inputs and public references. No private code, customer data, workplace files, or internal service URLs.
- Do not execute tools, approve refunds, merge code, or claim to redact all PII. This is decision support and evaluation.
- Use native, labelled controls and visible focus. Clear stale results on input changes. Inspect rendered UI after visual changes.
- Run `npm test`, `npm run build`, `npm run format:check`, and `npm run test:e2e` for functional changes. Default tests must never call paid providers. Use `npm run format` for formatting.
- Keep benchmark labels independent of model outputs and teaching fixtures. Performance claims require quality metrics, sample size, and measurement provenance.
- Do not commit `.env`, `.scratch`, test artifacts, provider credentials, or request logs. Ask before paid provisioning or large API batches.
