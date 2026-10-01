from __future__ import annotations
from pathlib import Path
import yaml


def load_rules() -> list[dict]:
    rules = []
    for path in Path(__file__).resolve().parents[1].joinpath("rules").glob("*.yaml"):
        for document in yaml.safe_load_all(path.read_text(encoding="utf-8")):
            if document:
                rules.append(document)
    return rules


def evaluate(event: dict) -> list[tuple[dict, dict]]:
    matches = []
    for rule in load_rules():
        if not rule.get("enabled", True) or event["event_type"] not in rule.get("event_types", [rule.get("event_type")]):
            continue
        if rule.get("platforms") and event.get("platform") not in rule["platforms"]:
            continue
        matched = {}
        for field, condition in rule.get("conditions", {}).items():
            actual = str(event.get(field) or "")
            expected = str(condition.get("equals", ""))
            if "equals" in condition and actual.lower() != expected.lower():
                break
            if "contains" in condition and str(condition["contains"]).lower() not in actual.lower():
                break
            matched[field] = {"condition": condition, "actual": actual}
        else:
            matches.append((rule, matched))
    return matches
