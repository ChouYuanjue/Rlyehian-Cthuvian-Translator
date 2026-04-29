from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml


ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "data"


@dataclass(frozen=True)
class LanguageData:
    lexemes: dict[str, Any]
    affixes: dict[str, Any]


@lru_cache(maxsize=1)
def load_language_data() -> LanguageData:
    with (DATA_DIR / "lexemes.yaml").open("r", encoding="utf-8") as handle:
        lexemes = yaml.safe_load(handle)
    with (DATA_DIR / "affixes.yaml").open("r", encoding="utf-8") as handle:
        affixes = yaml.safe_load(handle)
    return LanguageData(lexemes=lexemes, affixes=affixes)

