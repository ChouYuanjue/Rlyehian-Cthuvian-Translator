from __future__ import annotations

from dataclasses import dataclass, field

from .data import load_language_data
from .ir import Argument, ClauseIR
from .normalization import normalize_english, strip_determiners, tokenize
from .phonology import apply_phonology
from .registry import TermRegistry
from .sealing import seal_text


PAST_FORMS = {"wrote", "signed", "knew", "saw", "waited", "dreamed", "slept", "offered", "used", "transformed", "changed", "remembered"}
AUXILIARIES = {"do", "does", "did"}
NEGATORS = {"not", "n't", "never", "no"}
PREPOSITIONS = {
    "to": "ug",
    "for": "ug",
    "in": "agl",
    "inside": "agl",
    "at": "agl",
    "on": "agl",
    "beyond": "agl",
    "from": "hup",
    "of": "hup",
    "with": "vra",
    "by": "li",
    "using": "li",
    "into": "ep",
    "as": "ep",
    "about": None,
    "concerning": None,
}


@dataclass(frozen=True)
class TranslationResult:
    source: str
    cthuvian: str
    register: str
    ir: ClauseIR | None = None
    warnings: tuple[str, ...] = field(default_factory=tuple)
    roundtrip_ok: bool = False


class Translator:
    def __init__(self, registry: TermRegistry | None = None) -> None:
        self.data = load_language_data()
        self.registry = registry or TermRegistry()
        self._verb_index = self._build_verb_index()
        self._terms = {
            normalize_english(key): value
            for key, value in self.data.lexemes.get("terms", {}).items()
        }
        self._proper_names = {
            normalize_english(key): value
            for key, value in self.data.lexemes.get("proper_names", {}).items()
        }
        self._pronouns = {
            normalize_english(key): value
            for key, value in self.data.lexemes.get("pronouns", {}).items()
        }

    def translate(self, text: str, register: str = "low") -> TranslationResult:
        ir = self.parse_english(text)
        if ir is None:
            sealed = seal_text(text)
            return TranslationResult(text, sealed, register, warnings=("sealed_fallback",))
        low = self.realize_low(ir)
        surface = apply_phonology(low)
        if register == "high":
            surface = self.compress_high(surface)
        roundtrip_ok = self.roundtrip_ok(surface, ir)
        if not roundtrip_ok and register == "low":
            surface = seal_text(text)
        return TranslationResult(text, surface, register, ir=ir, roundtrip_ok=roundtrip_ok)

    def parse_english(self, text: str) -> ClauseIR | None:
        normalized = normalize_english(text).rstrip(".?!")
        tokens = [token for token in tokenize(normalized) if token.isalnum() or "'" in token or "-" in token]
        if not tokens:
            return None
        tokens = strip_determiners(tokens)
        lower = [token.lower() for token in tokens]
        predicate_index = self._find_predicate(lower)
        if predicate_index is None:
            return None
        predicate_id = self._verb_index[lower[predicate_index]]
        lexeme = self.data.lexemes["lexemes"][predicate_id]
        polarity = "negative" if any(token in NEGATORS or token.endswith("n't") for token in lower) else "positive"
        tam = "past" if lower[predicate_index] in PAST_FORMS else "present"

        subject_tokens = [token for token in tokens[:predicate_index] if token.lower() not in NEGATORS and token.lower() not in {"do", "does", "did"}]
        rest = tokens[predicate_index + 1 :]

        arguments: list[Argument] = []
        subject = self._phrase_to_argument(subject_tokens, "subject", lexeme["roles"].get("subject", "yr"))
        if subject:
            arguments.append(subject)

        object_tokens, prep_phrases = self._split_prepositions(rest)
        object_tokens = [token for token in object_tokens if token.lower() not in NEGATORS]
        obj = self._phrase_to_argument(object_tokens, "object", lexeme["roles"].get("object", "ef"))
        if obj:
            arguments.append(obj)

        for preposition, phrase in prep_phrases:
            suffix = PREPOSITIONS.get(preposition)
            if preposition in {"about", "concerning"}:
                phrase = ["l"] + phrase
                suffix = None
            argument = self._phrase_to_argument(phrase, preposition, suffix)
            if argument:
                arguments.append(argument)

        return ClauseIR(predicate=predicate_id, tam=tam, polarity=polarity, arguments=tuple(arguments), source=text)

    def realize_low(self, ir: ClauseIR) -> str:
        lexeme = self.data.lexemes["lexemes"][ir.predicate]
        predicate = lexeme["surface"]
        if ir.tam == "past":
            predicate = "nafl'" + predicate
        pieces: list[str] = []
        subject = [arg for arg in ir.arguments if arg.role == "subject"]
        objects = [arg for arg in ir.arguments if arg.role == "object"]
        others = [arg for arg in ir.arguments if arg.role not in {"subject", "object"}]
        pieces.extend(self._realize_argument(arg) for arg in subject)
        if ir.polarity == "negative":
            pieces.append("na")
        pieces.append(predicate)
        pieces.extend(self._realize_argument(arg) for arg in objects)
        pieces.extend(self._realize_argument(arg) for arg in others)
        return " ".join(piece for piece in pieces if piece)

    def compress_high(self, low_surface: str) -> str:
        tokens = []
        for token in low_surface.split():
            if "-" in token:
                base, suffix = token.rsplit("-", 1)
                if suffix in {"yr", "ef"}:
                    token = base
            tokens.append(token)
        return " ".join(tokens)

    def roundtrip_ok(self, surface: str, ir: ClauseIR) -> bool:
        lexeme_surface = self.data.lexemes["lexemes"][ir.predicate]["surface"]
        return lexeme_surface in surface or ("nafl'" + lexeme_surface) in surface

    def _build_verb_index(self) -> dict[str, str]:
        index: dict[str, str] = {}
        for lexeme_id, lexeme in self.data.lexemes.get("lexemes", {}).items():
            for word in lexeme.get("english", []):
                index[normalize_english(word)] = lexeme_id
        return index

    def _find_predicate(self, lower_tokens: list[str]) -> int | None:
        for index, token in enumerate(lower_tokens):
            if token in AUXILIARIES and any(later in self._verb_index for later in lower_tokens[index + 1 :]):
                continue
            if token in self._verb_index:
                return index
        return None

    def _split_prepositions(self, tokens: list[str]) -> tuple[list[str], list[tuple[str, list[str]]]]:
        object_tokens: list[str] = []
        phrases: list[tuple[str, list[str]]] = []
        current_prep: str | None = None
        current: list[str] = []
        for token in tokens:
            lower = token.lower()
            if lower in PREPOSITIONS:
                if current_prep is None:
                    object_tokens = current
                else:
                    phrases.append((current_prep, current))
                current_prep = lower
                current = []
            else:
                current.append(token)
        if current_prep is None:
            object_tokens = current
        else:
            phrases.append((current_prep, current))
        return object_tokens, phrases

    def _phrase_to_argument(self, tokens: list[str], role: str, suffix: str | None) -> Argument | None:
        tokens = strip_determiners(tokens)
        if not tokens:
            return None
        if tokens[0].lower() == "l":
            phrase = " ".join(tokens[1:])
            rc = "l'" + self.lookup_term(phrase)
            return Argument(role=role, concept=phrase, rc=rc, suffix=suffix)
        phrase = " ".join(tokens)
        lower = normalize_english(phrase)
        if lower in self._pronouns:
            pronoun = self._pronouns[lower]
            return Argument(role=role, concept=lower, rc=pronoun["rc"], suffix=suffix or pronoun.get("role"))
        rc = self.lookup_term(phrase)
        return Argument(role=role, concept=phrase, rc=rc, suffix=suffix)

    def lookup_term(self, phrase: str) -> str:
        lower = normalize_english(phrase)
        if lower in self._proper_names:
            return self._proper_names[lower]
        if lower in self._terms:
            return self._terms[lower]["rc"]
        entry = self.registry.lookup(lower)
        if entry:
            return entry.rc
        if lower.isdigit():
            return self._number_to_rc(lower)
        return seal_text(phrase)

    def _realize_argument(self, argument: Argument) -> str:
        rc = argument.rc or self.lookup_term(argument.concept)
        if argument.suffix:
            return f"{rc}-{argument.suffix}"
        return rc

    def _number_to_rc(self, digits: str) -> str:
        names = {
            "0": "nyl",
            "1": "yak",
            "2": "ghal",
            "3": "thog",
            "4": "khrun",
            "5": "vlag",
            "6": "shuth",
            "7": "zhral",
            "8": "fhtan",
            "9": "mglun",
        }
        return "zhrn " + "-".join(names[digit] for digit in digits)
