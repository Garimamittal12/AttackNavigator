from app.scenarios import load_scenarios


def test_catalog_contains_only_well_described_allowlist_scenarios():
    scenarios = load_scenarios()
    assert "POWERSHELL_001" in scenarios
    assert scenarios["POWERSHELL_001"]["platform"] == "windows"
    assert scenarios["DISCOVERY_LINUX_001"]["techniques"] == ["T1082"]
    for scenario in scenarios.values():
        assert scenario["safety_notes"]
        assert scenario["cleanup"]
