# Translator Architecture

The translator is implemented as a small compiler rather than a string replacement tool.

```text
English input
  -> normalization
  -> tokenization
  -> clause IR
  -> lexeme and registry lookup
  -> low-register morphology
  -> phonology
  -> optional high-register compression
  -> output
```

The reverse path is deliberately gloss-based:

```text
RC-1 input
  -> token splitting
  -> role suffix analysis
  -> lexical gloss lookup
  -> ambiguity notes
  -> best-effort English explanation
```

## Intermediate Representation

The IR is the stabilizing layer between English and RC-1.

Example:

```json
{
  "predicate": "KNOW",
  "tam": "present",
  "polarity": "negative",
  "arguments": [
    { "role": "subject", "concept": "i", "rc": "Ya", "suffix": "yr" },
    { "role": "object", "concept": "everything", "rc": "nilgh'ri", "suffix": "ef" }
  ]
}
```

This realizes as:

```text
Ya-yr na kadishtu nilgh'ri-ef
```

Changing word order, register style, or morphology should happen after IR creation. The English analyzer should not directly emit surface Cthuvian.

## Deterministic Data

The rule base lives in Git:

```text
data/lexemes.yaml
data/affixes.yaml
```

These files define:

- pronouns
- semantic roots
- English verb form mapping
- fixed terms
- proper names
- role suffixes
- derivational suffixes
- TAM and relation prefixes

For production, accepted learned terms should move to a database-backed registry. The local `data/registry.json` file is a seed and test fixture.

## Registry Policy

A term registry entry is an accepted language fact.

The registry should store:

- source term
- normalized source key
- RC-1 surface form
- construction strategy
- component roots
- language version
- lexicon version
- generator version
- validation report

Once accepted, a term should not be overwritten in place. To change it, create a new language version or a supersession event.

## Fallback Policy

The translator prefers graceful failure over false precision.

Order of preference:

1. use a core lexeme or term
2. use an accepted registry term
3. use deterministic semantic compounding
4. use constrained LLM proposal, if enabled
5. sealed encoding

The current implementation supports steps 1, 2, and 5 directly. The LLM interface and docs define how to add steps 3 and 4 safely.

## High Register

High register is a rendering pass over low register.

Low:

```text
Ya-yr na kadishtu nilgh'ri-ef
```

High:

```text
Ya na kadishtu nilgh'ri
```

The system should always preserve the low-register source form internally when high register is emitted. This keeps literary output traceable.

## Round-Trip Validation

The desired production invariant is:

```text
English -> IR -> RC-1 -> reverse parser -> IR'
```

`IR'` does not have to be identical to `IR`, but it must preserve:

- predicate frame
- polarity
- TAM category
- core arguments
- role suffixes where low register was requested

The current implementation includes a minimal round-trip check. A production implementation should strengthen it into structural comparison.

## Current Parser Scope

The bundled parser is deliberately small. It recognizes:

- simple subject-verb-object clauses
- basic negation
- selected past forms
- prepositional phrases
- known terms and proper names
- sealed fallback for unknown material

Recommended future upgrades:

- add spaCy or Stanza for dependency parsing
- add Lark for RC-1 grammar parsing
- add Pynini or another FST layer for reversible morphology
- add Postgres registry adapter
- add a validator suite for phonotactics and English leakage

