# Optional Minimal LLM Plugin

LLMs may be useful for ambiguous English, unknown terminology, and high-register style suggestions. They must not be the translator.

The governing rule is:

```text
LLM proposes.
Rules decide.
Registry records.
Reverse parser validates.
Fallback seals.
```

## Interface

The project exposes a narrow protocol in `src/cthuvian_translator/llm.py`:

```python
class MinimalLLM(Protocol):
    def complete_json(
        self,
        task: str,
        payload: dict[str, Any],
        schema: dict[str, Any],
        model_profile: str,
    ) -> dict[str, Any]:
        ...
```

Every LLM response must be structured JSON. The core translator should treat it as untrusted input.

## Allowed Tasks

### English To IR Candidate

Use when the rule parser cannot confidently extract a clause.

The LLM may choose from known frames and roles. It must not emit surface Cthuvian.

### Term Decomposition

Use for unknown concepts.

Input:

```json
{
  "source_term": "microscope",
  "context": "The scientist used a microscope.",
  "known_rc1_roots": {
    "VREN": "small",
    "SEE": "see, light, reveal",
    "FMAGL": "tool, device"
  }
}
```

Output:

```json
{
  "source_term": "microscope",
  "concept_type": "instrument",
  "selected_roots": ["VREN", "SEE", "FMAGL"],
  "literal_gloss": "small-seeing-tool",
  "needs_new_root": false
}
```

The deterministic builder then creates:

```text
vren-yll-fmagl
```

### High Register Compression

The LLM may suggest which role suffixes can be omitted, but a deterministic high-register renderer should produce the final surface string.

### Reverse Gloss Smoothing

The reverse parser produces analyses. The LLM may turn those analyses into readable English, but it must not invent root analyses.

## Greedy Decoding

Use low-variance settings:

```json
{
  "temperature": 0,
  "top_p": 1,
  "max_tokens": 512
}
```

This does not guarantee cross-model or cross-version consistency. Consistency must come from:

- schema validation
- root validation
- deterministic builders
- registry acceptance
- cache keys that include model and prompt versions
- round-trip validation

## Trust Levels

| Level | Meaning | Production Default |
| --- | --- | --- |
| L0 | no LLM used | allowed |
| L1 | closed-set selection only | allowed |
| L2 | semantic decomposition, deterministic construction | allowed |
| L3 | proposes new root or rule | development only |
| L4 | directly emits surface Cthuvian | disallowed |

## Required Validators

Every LLM proposal should pass:

- JSON schema validation
- root ID validation
- semantic construction validation
- phonotactic validation
- English leakage check
- reverse parser validation
- registry uniqueness check

If any validator fails, seal the source term or return a pending/rejected state.

