from __future__ import annotations

import argparse
import json

from .reverse import ReverseGloss
from .translator import Translator


def main() -> None:
    parser = argparse.ArgumentParser(prog="cthuvian", description="Translate English to RC-1 Cthuvian or gloss RC-1 text.")
    sub = parser.add_subparsers(dest="command", required=True)

    translate = sub.add_parser("translate", help="Translate English to RC-1")
    translate.add_argument("text")
    translate.add_argument("--register", choices=["low", "high"], default="low")
    translate.add_argument("--json", action="store_true")

    gloss = sub.add_parser("gloss", help="Produce an English gloss for RC-1 text")
    gloss.add_argument("text")
    gloss.add_argument("--json", action="store_true")

    args = parser.parse_args()

    if args.command == "translate":
        result = Translator().translate(args.text, register=args.register)
        if args.json:
            print(json.dumps(_translation_to_json(result), ensure_ascii=False, indent=2))
        else:
            print(result.cthuvian)
        return

    result = ReverseGloss().gloss(args.text)
    if args.json:
        print(json.dumps(_reverse_to_json(result), ensure_ascii=False, indent=2))
    else:
        print(result.best_gloss)


def _translation_to_json(result):
    return {
        "source": result.source,
        "cthuvian": result.cthuvian,
        "register": result.register,
        "roundtrip_ok": result.roundtrip_ok,
        "warnings": list(result.warnings),
        "ir": None
        if result.ir is None
        else {
            "predicate": result.ir.predicate,
            "tam": result.ir.tam,
            "polarity": result.ir.polarity,
            "arguments": [argument.__dict__ for argument in result.ir.arguments],
        },
    }


def _reverse_to_json(result):
    return {
        "source": result.source,
        "best_gloss": result.best_gloss,
        "analyses": [analysis.__dict__ for analysis in result.analyses],
        "notes": list(result.notes),
    }


if __name__ == "__main__":
    main()
