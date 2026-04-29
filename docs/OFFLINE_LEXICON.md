# Offline Lexicon Generation

The generated common lexicon is built offline and committed as runtime data. The Netlify function only imports the generated module; it does not fetch word lists, call WordNet, or run heavy NLP at request time.

## Pipeline

```text
data/wordlists/google-5000-no-swears.txt
  -> scripts/generate-common-lexicon.mjs
  -> netlify/functions/common-generated.mjs
  -> data/generated/common-generated-report.json
```

The source word list is the first 5000 entries from `google-10000-english-no-swears`:

```text
https://github.com/first20hours/google-10000-english
```

The English words are not emitted as RC-1. They define a coverage set. The generator either builds a semantic RC-1 compound or falls back to a short deterministic RC-1-looking coined form.

## Matching Strategy

The generator uses a lightweight deterministic approximation of a WordNet-style decomposer:

1. Normalize word-family variants.
2. Handle common irregulars such as `children -> child` and `wrote -> write`.
3. Split compounds when both sides are common words.
4. Detect useful morphemes such as `photo`, `bio`, `geo`, `hydro`, `phone`, `scope`, `meter`, `conduct`, `crypto`, `neuro`, and `logy`.
5. Match discovered hints against `data/rc1-root-glosses.json`.
6. Build a compound when at least two meaningful RC-1 roots are found.
7. Otherwise generate a short stable coined form.

Examples:

```text
telephone   -> ghor-ai-fmagl
software    -> phlegeth-fmagl
biology     -> bthnk-kadishtu-na
photography -> yll-athg-mnahn
airport     -> hral-nglui
superconductivity -> ghrath-cthugh-zhrn-na
```

Variants share one base where possible:

```text
service  -> phlnythsuhn
services -> phlnythsuhn
```

## Why Offline

Offline generation keeps production behavior stable:

- no request-time NLP dependency
- no user-facing latency spike
- generated output can be tested and reviewed
- bad matches can be overridden in `common-terms.mjs`
- version changes are visible in Git

The current pipeline avoids large NLP packages in the Netlify bundle. A future higher-quality generator can add WordNet or embeddings offline and still emit the same compact `common-generated.mjs` runtime shape.

## Commands

```powershell
npm run generate:lexicon
npm test
```

Review suspicious entries in:

```text
data/generated/common-generated-report.json
```

Preferred corrections should go into:

```text
netlify/functions/common-terms.mjs
```

Manual terms override generated terms at runtime.

## Runtime Priority

Forward translation resolves terms in this order:

```text
proper names
  -> manual core/common terms
  -> learned registry terms
  -> offline generated terms
  -> online lightweight decomposition
  -> per-word phrase decomposition
  -> number encoding
  -> sealed reversible encoding
```

Reverse glossing builds an index in a compatible order:

```text
fixed mythos phrases and roots
  -> manual core/common terms
  -> offline generated terms
  -> learned registry terms for the request
  -> compound decomposition
  -> unknown/proper-name gloss
```

Manual terms are intentionally before generated terms in both directions. If a generated entry is awkward, add a correction to `netlify/functions/common-terms.mjs`; it will override the generated result.

## Quality Check

```powershell
npm run check:lexicon
```

The check reports:

- generated entry count
- semantic-compound count
- coined-term count
- reverse-known rate
- forward/reverse sample translations
- sealed fallback samples from the first 500 source words

Current expected property: every generated entry should be present in the reverse gloss index. That does not mean every gloss is semantically perfect; it means generated surfaces are traceable back to their source base or manual override.
