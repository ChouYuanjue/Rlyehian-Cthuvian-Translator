from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class Argument:
    role: str
    concept: str
    rc: str | None = None
    suffix: str | None = None


@dataclass(frozen=True)
class ClauseIR:
    predicate: str
    tam: str = "present"
    polarity: str = "positive"
    arguments: tuple[Argument, ...] = field(default_factory=tuple)
    source: str = ""

    def concepts(self) -> tuple[str, ...]:
        return tuple(argument.concept for argument in self.arguments)

