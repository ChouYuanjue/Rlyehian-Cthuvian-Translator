# Netlify Registry Strategy

On Netlify, the registry must be external persistent state. Do not rely on runtime-writable files, serverless function memory, or deployed JSON files for learned terms.

Recommended layers:

```text
Git core registry       immutable rules and seed vocabulary
Postgres registry       accepted learned terminology
Blobs/cache snapshots   read acceleration and exported snapshots
```

## Why Not Just Write JSON?

Netlify deploys are atomic and immutable. That is excellent for static rule files such as `data/lexemes.yaml`, but it is not a safe place for runtime learning.

Serverless functions also cannot be treated as durable state. A function instance may disappear, restart, or run in parallel with other instances.

## Source Of Truth

Use Postgres, such as Netlify Database or an external managed Postgres, for accepted learned terms.

The database gives the registry:

- unique constraints
- transactions
- row locking
- audit events
- versioned schema migrations
- reproducible snapshots
- concurrency control

## Minimal Tables

```sql
create table rc_registry_keys (
  key_hash text primary key,
  language_version text not null,
  namespace text not null,
  source_lang text not null,
  normalized_source text not null,
  status text not null check (status in ('accepted', 'pending', 'rejected', 'sealed')),
  accepted_term_id uuid,
  lease_token uuid,
  lease_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (language_version, namespace, source_lang, normalized_source)
);

create table rc_registry_terms (
  id uuid primary key default gen_random_uuid(),
  key_hash text not null references rc_registry_keys(key_hash),
  rc_surface text not null,
  rc_underlying text,
  components jsonb not null default '[]'::jsonb,
  literal_gloss text,
  semantic_frame text,
  language_version text not null,
  lexicon_version text not null,
  generator_version text not null,
  source_kind text not null check (source_kind in ('core', 'rule', 'llm_assisted', 'manual', 'sealed')),
  model_profile text,
  prompt_hash text,
  schema_hash text,
  decoding jsonb,
  validator_report jsonb not null default '{}'::jsonb,
  accepted_at timestamptz not null default now(),
  unique (key_hash)
);

create table rc_registry_events (
  id bigserial primary key,
  key_hash text not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  language_version text not null,
  actor text not null default 'system',
  created_at timestamptz not null default now()
);

create table rc_llm_cache (
  cache_key text primary key,
  task text not null,
  payload_hash text not null,
  model_profile text not null,
  prompt_hash text not null,
  schema_hash text not null,
  decoding jsonb not null,
  output jsonb not null,
  accepted boolean not null default false,
  created_at timestamptz not null default now()
);
```

## Registry Keys

The accepted term key should include language state:

```json
{
  "language_version": "RC-1.0",
  "namespace": "terms",
  "source_lang": "en",
  "normalized_source": "microscope",
  "domain": "general"
}
```

Hash this canonical JSON with SHA-256. Do not include model name in the accepted term key. The accepted term is a language fact, not a model artifact.

LLM cache keys should include model, prompt, schema, decoding parameters, and payload hash.

## Reservation Flow

Use a reservation/lease flow to prevent two concurrent requests from accepting different words for the same source term.

```text
lookup accepted term
  -> if found, return it
insert pending key with lease token
  -> if conflict, return pending or retry
call LLM outside transaction
validate proposal
accept with conditional update using lease token
write event
return accepted term
```

The LLM call must happen outside the database transaction. Long transactions around model calls will exhaust connections and create avoidable lock contention.

## Conditional Acceptance

The accept query must check:

- `key_hash` matches
- `status = 'pending'`
- `lease_token` matches
- `lease_expires_at > now()`

Late model responses must not overwrite already accepted terms.

## Netlify Blobs

Use Netlify Blobs only as cache or snapshot storage.

Good uses:

- accepted term read cache
- canonical registry snapshots
- LLM cache cold storage
- public dictionary export

Avoid using Blobs as the only learned registry if you need complex queries, multi-row transactions, or strong concurrency guarantees.

## Deploy Previews

Deploy previews should not directly teach production language facts.

Recommended flow:

```text
preview deploy
  -> test generated terms and prompts
  -> export candidate events
  -> review
  -> accept into production registry through migration or admin endpoint
```

This keeps experimental terminology from leaking into production RC-1.

## API Boundaries

Do not let the browser write the registry directly.

Suggested functions:

```text
/api/translate
/api/registry/lookup
/api/registry/reserve
/api/registry/accept
/api/registry/reject
/api/registry/snapshot
```

Public users should only call `/api/translate`. Acceptance endpoints should require server-side credentials or administrator authorization.

