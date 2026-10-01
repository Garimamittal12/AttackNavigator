# Scenario catalog and verification status

| Scenario | Platform | ATT&CK | Telemetry | Status |
|---|---|---|---|---|
| POWERSHELL_001 | Windows | T1059.001 | Sysmon Event ID 1 | Implemented; lab verification pending |
| CMD_001 | Windows | T1059.003 | Sysmon Event ID 1 | Implemented; lab verification pending |
| DISCOVERY_WIN_001 | Windows | T1082 | Sysmon Event ID 1 | Implemented; lab verification pending |
| DISCOVERY_WIN_002 | Windows | T1057 | Sysmon Event ID 1 | Implemented; lab verification pending |
| DISCOVERY_LINUX_001 | Linux | T1082 | auditd EXECVE | Implemented; lab verification pending |
| DISCOVERY_LINUX_002 | Linux | T1057 | auditd EXECVE | Implemented; lab verification pending |

The catalog deliberately excludes persistence, credential access, lateral movement, exfiltration, impact, and Kali-attacker scenarios for now. They require additional telemetry and/or infrastructure and must not appear as coverage until an allowlisted implementation, parser, rule, and real lab validation exist.
