from app.detection import evaluate, load_rules


def test_powershell_yaml_rule_matches_normalized_event():
    rules = load_rules()
    assert any(rule["id"] == "DET-PS-001" for rule in rules)
    matches = evaluate({"platform": "windows", "event_type": "process_creation", "process": "powershell.exe"})
    assert matches[0][0]["mitre"]["technique"] == "T1059.001"


def test_powershell_rule_does_not_match_other_process():
    assert evaluate({"platform": "windows", "event_type": "process_creation", "process": "notepad.exe"}) == []
