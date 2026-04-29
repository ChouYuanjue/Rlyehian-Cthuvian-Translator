from __future__ import annotations

import re


def apply_phonology(surface: str) -> str:
    """Apply conservative RC-1 morphophonological cleanup."""

    surface = surface.replace("ph-nglui", "ph'nglui")
    surface = surface.replace("l-geb", "l'geb")
    surface = surface.replace("nafl-", "nafl'")
    surface = surface.replace("c-fhayak", "cf'ayak")
    surface = re.sub(r"\s+", " ", surface).strip()
    return surface


def strip_role_suffix(token: str) -> tuple[str, str | None]:
    for suffix in ("yr", "ef", "ug", "agl", "hup", "vra", "li", "ep"):
        marker = "-" + suffix
        if token.endswith(marker):
            return token[: -len(marker)], suffix
    return token, None

