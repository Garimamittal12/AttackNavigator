"""Curated ATT&CK metadata for techniques with implemented lab paths."""
TECHNIQUES = {
    "T1059.001": {"id": "T1059.001", "name": "Command and Scripting Interpreter: PowerShell", "tactic": "Execution", "platforms": ["windows"]},
    "T1059.003": {"id": "T1059.003", "name": "Command and Scripting Interpreter: Windows Command Shell", "tactic": "Execution", "platforms": ["windows"]},
    "T1082": {"id": "T1082", "name": "System Information Discovery", "tactic": "Discovery", "platforms": ["windows", "linux"]},
    "T1057": {"id": "T1057", "name": "Process Discovery", "tactic": "Discovery", "platforms": ["windows", "linux"]},
}
