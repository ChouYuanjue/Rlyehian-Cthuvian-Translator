from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .data import DATA_DIR
from .normalization import normalize_english


@dataclass(frozen=True)
class RegistryEntry:
    source: str
    rc: str
    strategy: str
    metadata: dict[str, Any]


class TermRegistry:
    """Read-only local registry used by the deterministic translator.

    Production deployments should back the same concepts with Postgres. The
    local JSON file is intentionally simple so tests and offline builds remain
    reproducible.
    """

    def __init__(self, path: Path | None = None) -> None:
        self.path = path or DATA_DIR / "registry.json"
        self.entries = self._load()

    def _load(self) -> dict[str, RegistryEntry]:
        if not self.path.exists():
            return {}
        payload = json.loads(self.path.read_text(encoding="utf-8"))
        entries: dict[str, RegistryEntry] = {}
        for source, item in payload.get("entries", {}).items():
            entries[normalize_english(source)] = RegistryEntry(
                source=source,
                rc=item["rc"],
                strategy=item.get("strategy", "unknown"),
                metadata={k: v for k, v in item.items() if k != "rc"},
            )
        return entries

    def lookup(self, source: str) -> RegistryEntry | None:
        return self.entries.get(normalize_english(source))

