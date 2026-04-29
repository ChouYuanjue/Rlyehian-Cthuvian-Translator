# Netlify Web UI Deployment

The Web UI is a static Netlify site with one serverless function:

```text
public/                 browser-only UI
netlify/functions/      server-only translation API
```

The browser never receives the LLM API key. It can only call:

```text
POST /api/translate
```

The redirect is configured in `netlify.toml`:

```toml
[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200
```

Netlify documents this redirect shape for `netlify.toml` redirects, and Netlify Functions can read runtime environment variables from the Functions scope.

## Local Setup

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

Keep `.env` local. It is ignored by Git.

## Production Environment Variables

Set these in Netlify with Functions scope:

```text
LLM_ENABLED=false
PUBLIC_LLM_ENABLED=false
LLM_GATE_TOKEN=
LLM_API_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=
LLM_MODEL=
SITE_ORIGIN=https://your-site.netlify.app
MAX_INPUT_CHARS=2000
LLM_DAILY_LIMIT_PER_IP=30
```

Important Netlify behavior: variables declared in `netlify.toml` are not available to functions at runtime. Use the Netlify UI, CLI, or API.

## LLM Gate Policy

The frontend has a "Request LLM assist" toggle. That toggle is not authorization.

The function only calls the provider when:

```text
LLM_ENABLED=true
and
(
  PUBLIC_LLM_ENABLED=true
  or request header X-RC1-LLM-GATE matches LLM_GATE_TOKEN
)
```

For public demos, keep `PUBLIC_LLM_ENABLED=false` and use a gate token only with trusted operators. For a truly public LLM feature, add user authentication and billing-aware limits before enabling it.

## Registry

The function uses three layers:

1. core terms compiled into `rc1-runtime.mjs`
2. learned terms in Netlify Blobs store `rc1-registry`
3. deterministic sealed fallback

The registry key includes RC-1 language version, namespace, source language, normalized source, and domain. Accepted terms are stored as:

```text
terms/<sha256 canonical key>.json
```

Netlify Blobs are used with strong consistency for registry reads and writes. This is fine for a compact deployable Web UI. For heavy multi-user production, move learned registry state to Postgres using the schema in `docs/NETLIFY_REGISTRY.md`.

## Common-Term Seed Layer

The function imports `netlify/functions/common-terms.mjs`, a curated first pass at everyday vocabulary inspired by controlled/basic English lists. This layer is intentionally hand-converted into RC-1 compounds instead of copied directly from English.

The current fallback order is:

```text
core terms
  -> common-term seed
  -> learned Blobs registry
  -> gated LLM semantic compound
  -> gated LLM coined surface
  -> sealed reversible encoding
```

`zha'...'zhro` is therefore kept as the final completeness mechanism for text that cannot yet be lexicalized safely.

## Abuse Controls

The function includes:

- method restriction
- JSON parsing errors
- `MAX_INPUT_CHARS`
- optional `SITE_ORIGIN`
- server-side LLM gate token
- per-IP daily LLM counter through Netlify Blobs
- constrained JSON-only LLM term decomposition
- root whitelist validation before accepting terms

These controls protect the provider key from frontend exposure and reduce casual abuse. They are not a replacement for full authentication if the LLM feature is public.

## Build

```powershell
npm run build
```

The build script keeps the static `public/` directory ready. Netlify bundles functions separately.
