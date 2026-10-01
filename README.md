# AttackNavigator

AttackNavigator is a controlled Purple-Team laboratory, not an attack framework or a production SIEM. It uses a YAML scenario catalog and scenario-ID-only agents; it has no arbitrary-command API.

## What is implemented

- FastAPI + SQLite persistence for agents, runs, raw Sysmon XML, normalized events, and detections.
- Authenticated agent registration, heartbeat, polling job delivery, and result reporting.
- Sysmon Event ID 1 and auditd EXECVE collection/parser/normalizer paths.
- Six fixed, benign Windows/Linux execution and discovery scenarios with YAML rules and curated ATT&CK metadata.
- React dashboard with empty-state honesty: no seed rows, fake alerts, or fabricated telemetry.
- Offline upload endpoint for an actual Sysmon Event XML record using the same pipeline.

## Run the host

Install Python 3.11+ and Node 20+. Copy `.env.example` to `.env`, choose a strong agent token, and export the values (or use your environment loader). From `backend`, run `python -m pip install -r requirements.txt` and `uvicorn app.main:app --reload --port 8000`. From `frontend`, run `npm install` and `npm run dev`.

The dashboard is intentionally empty until a real agent connects. See the [scenario catalog](docs/scenarios.md), [Windows guide](docs/windows-setup.md), [Linux guide](docs/linux-setup.md), [testing guide](docs/testing.md), and [architecture](docs/architecture.md). VM integration remains to be verified in the configured lab.

## Limits and safety

Coverage is limited to implemented rules and telemetry configuration. The project has no claim of detection accuracy or complete ATT&CK coverage. Run it only on systems and networks you own or are authorized to test. Keep the lab network isolated from normal LAN traffic.
