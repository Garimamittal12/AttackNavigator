# Implementation gap report and plan

## Audit findings

The original vertical slice was functional in source for one Windows scenario: registration, heartbeat, queued run, Sysmon Event ID 1 ingestion, normalization, YAML detection, SQLite persistence, and a backend-driven UI. It was not real-lab verified. The catalog, agent allowlist, parser, rules, and UI were all PowerShell-specific.

## Completed in this increment

- YAML scenario registry with explicit prerequisites, safety, cleanup, and verification flags.
- Six fixed scenario implementations across Windows and Linux.
- Curated metadata for the four ATT&CK techniques actually represented by those scenarios.
- Generic YAML rule loading and evaluation; multiple rules per YAML file.
- Linux auditd EXECVE collector path and Linux agent.
- Dynamic scenario selection, capability-gated agents, investigation details, and honest matrix states.

## Next increments (in order)

1. Execute and evidence every listed scenario in the isolated VMs; only then set registry verification flags.
2. Add integration tests using an isolated temporary SQLite database for registration, job delivery, ingestion, and detection detail APIs.
3. Add Sysmon Event IDs 3/11/13 only alongside specific safe scenarios and reviewed configurations.
4. Add offline auditd upload and pagination/filtering for raw logs, events, runs, and detections.
5. Add Kali or attacker-victim scenarios only after the required isolated topology and telemetry source are configured.
6. Add state-changing scenarios only with an idempotent cleanup implementation and real-lab verification.

## Explicitly not implemented

No persistence, privilege escalation, credential access, lateral movement, C2, exfiltration, impact, cloud, Active Directory, macOS, or Kali-attacker scenario is claimed. Each needs additional infrastructure, telemetry, and safety review.
