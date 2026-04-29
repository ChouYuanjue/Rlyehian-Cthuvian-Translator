from __future__ import annotations

import re
import unicodedata


TOKEN_RE = re.compile(r"[A-Za-z][A-Za-z'’-]*|\d+|[^\w\s]", re.UNICODE)


def normalize_apostrophes(text: str) -> str:
    return text.replace("’", "'").replace("‘", "'").replace("`", "'")


def normalize_english(text: str) -> str:
    text = normalize_apostrophes(text)
    text = unicodedata.normalize("NFKC", text)
    text = text.strip().lower()
    return re.sub(r"\s+", " ", text)


def tokenize(text: str) -> list[str]:
    return TOKEN_RE.findall(normalize_apostrophes(text))


def strip_determiners(tokens: list[str]) -> list[str]:
    return [token for token in tokens if token.lower() not in {"a", "an", "the"}]

