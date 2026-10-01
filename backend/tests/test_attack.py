from app.attack import TECHNIQUES
from app.detection import load_rules
from app.scenarios import load_scenarios


def test_scenario_techniques_and_rules_are_backed_by_metadata():
    rule_ids = {rule["id"] for rule in load_rules()}
    for scenario in load_scenarios().values():
        assert set(scenario["techniques"]).issubset(TECHNIQUES)
        assert set(scenario["detection_rules"]).issubset(rule_ids)
