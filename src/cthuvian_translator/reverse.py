from __future__ import annotations

from dataclasses import dataclass

from .data import load_language_data
from .normalization import normalize_english
from .phonology import strip_role_suffix
from .sealing import unseal_text


@dataclass(frozen=True)
class TokenAnalysis:
    token: str
    base: str
    role: str | None
    glosses: tuple[str, ...]


@dataclass(frozen=True)
class ReverseResult:
    source: str
    best_gloss: str
    analyses: tuple[TokenAnalysis, ...]
    notes: tuple[str, ...]


class ReverseGloss:
    def __init__(self) -> None:
        self.data = load_language_data()
        self.surface_gloss = self._build_surface_gloss()
        self.role_gloss = self.data.affixes["roles"]

    def gloss(self, text: str) -> ReverseResult:
        sealed = unseal_text(text)
        if sealed is not None:
            return ReverseResult(text, sealed, (), ("sealed text decoded exactly",))
        analyses: list[TokenAnalysis] = []
        gloss_pieces: list[str] = []
        notes: list[str] = []
        for token in text.strip().split():
            base, role = strip_role_suffix(token)
            lower = normalize_english(base)
            glosses = self.surface_gloss.get(lower, ("unknown or proper name",))
            if role:
                notes.append(f"{token}: -{role} marks {self.role_gloss.get(role, 'unknown role')}.")
            analyses.append(TokenAnalysis(token=token, base=base, role=role, glosses=tuple(glosses)))
            gloss_pieces.append(glosses[0])
        return ReverseResult(
            source=text,
            best_gloss=" / ".join(gloss_pieces),
            analyses=tuple(analyses),
            notes=tuple(notes),
        )

    def _build_surface_gloss(self) -> dict[str, tuple[str, ...]]:
        gloss: dict[str, tuple[str, ...]] = {
            "ph'nglui": ("dead; beyond the threshold", "outside ordinary life"),
            "mglw'nafh": ("still living or active", "dead-yet-dreaming vitality"),
            "wgah'nagl": ("dwelling-place", "place of residence"),
            "fhtagn": ("waits, dreams, lies dormant",),
            "na": ("not, no, non-",),
            "ya": ("I, me",),
            "tha": ("you",),
            "cya": ("we, us",),
            "fya": ("they, them",),
        }
        for lexeme in self.data.lexemes["lexemes"].values():
            gloss.setdefault(normalize_english(lexeme["surface"]), (lexeme["gloss"],))
            gloss.setdefault(normalize_english("nafl'" + lexeme["surface"]), ("non-present " + lexeme["gloss"],))
        for term in self.data.lexemes["terms"].values():
            gloss.setdefault(normalize_english(term["rc"]), (term["gloss"],))
        return gloss
