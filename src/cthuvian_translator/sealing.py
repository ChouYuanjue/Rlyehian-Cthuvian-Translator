from __future__ import annotations

import base64


SYLLABLES = [
    "ya",
    "bhu",
    "cth",
    "dhu",
    "ee",
    "fha",
    "ghu",
    "ha",
    "ii",
    "zhya",
    "kha",
    "lla",
    "mna",
    "ngha",
    "u",
    "pha",
    "k'wa",
    "rha",
    "sha",
    "tha",
    "uu",
    "vha",
    "wha",
    "khs",
    "yha",
    "zha",
    "agh",
    "ebh",
    "ith",
    "og",
    "ulh",
    "yr",
]


def seal_text(text: str) -> str:
    """Encode arbitrary UTF-8 text into reversible RC-1 sealed form."""

    encoded = base64.b32encode(text.encode("utf-8")).decode("ascii").rstrip("=")
    alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
    pieces = [SYLLABLES[alphabet.index(ch)] for ch in encoded]
    return "zha'" + "-".join(pieces) + "'zhro"


def unseal_text(sealed: str) -> str | None:
    if not (sealed.startswith("zha'") and sealed.endswith("'zhro")):
        return None
    body = sealed[4:-5]
    if not body:
        return ""
    reverse = {value: index for index, value in enumerate(SYLLABLES)}
    alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
    try:
        encoded = "".join(alphabet[reverse[piece]] for piece in body.split("-"))
    except KeyError:
        return None
    encoded += "=" * ((8 - len(encoded) % 8) % 8)
    try:
        return base64.b32decode(encoded.encode("ascii")).decode("utf-8")
    except Exception:
        return None

