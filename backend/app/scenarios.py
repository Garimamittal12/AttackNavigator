"""Registry-driven scenario definitions. Definitions declare intent; agents own safe execution."""
from pathlib import Path
from typing import Any
import yaml

CATALOG = Path(__file__).resolve().parents[1] / "scenarios"


def load_scenarios() -> dict[str, dict[str, Any]]:
    scenarios: dict[str, dict[str, Any]] = {}
    for path in CATALOG.rglob("*.yaml"):
        data = yaml.safe_load(path.read_text(encoding="utf-8"))
        if not isinstance(data, dict) or not data.get("id"):
            raise ValueError(f"invalid scenario file: {path}")
        if data["id"] in scenarios:
            raise ValueError(f"duplicate scenario ID: {data['id']}")
        scenarios[data["id"]] = data
    return scenarios


def get_scenario(scenario_id: str) -> dict[str, Any] | None:
    return load_scenarios().get(scenario_id)
