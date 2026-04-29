from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol


class MinimalLLM(Protocol):
    """Narrow interface for optional LLM-assisted proposals.

    Implementations must return JSON-like dicts. The deterministic translator
    treats every response as an untrusted proposal that must pass validation.
    """

    def complete_json(
        self,
        task: str,
        payload: dict[str, Any],
        schema: dict[str, Any],
        model_profile: str,
    ) -> dict[str, Any]:
        ...


@dataclass(frozen=True)
class LLMPolicy:
    enabled: bool = False
    model_profile: str = "disabled"
    temperature: float = 0.0
    top_p: float = 1.0
    max_tokens: int = 512
    allow_surface_cthuvian_generation: bool = False


TERM_DECOMPOSITION_SCHEMA: dict[str, Any] = {
    "type": "object",
    "required": [
        "source_term",
        "concept_type",
        "selected_roots",
        "literal_gloss",
        "needs_new_root",
    ],
    "properties": {
        "source_term": {"type": "string"},
        "concept_type": {
            "type": "string",
            "enum": ["object", "person", "place", "instrument", "abstract", "event"],
        },
        "selected_roots": {"type": "array", "items": {"type": "string"}},
        "literal_gloss": {"type": "string"},
        "needs_new_root": {"type": "boolean"},
    },
}

