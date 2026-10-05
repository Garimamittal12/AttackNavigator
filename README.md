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

Install Python 3.11+ and Node 20+. Copy `.env.example` to `.env`, choose a strong agent token, and export the values (or use your environment loader). From `backend`, run `py -3 -m pip install -r requirements.txt` and `py -3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000`. From `frontend`, run `npm install` and `npm run dev`.

Open the Vite URL shown in the terminal (normally `http://localhost:5173`). For an agent on a VM, set `ATTACKNAVIGATOR_API_URL` to the host-only IP of the backend, for example `http://192.168.56.1:8000/api`; do not leave the placeholder hostname in the agent source. The dashboard polls persisted API data every five seconds while its tab is visible.

The dashboard is intentionally empty until a real agent connects. See the [scenario catalog](docs/scenarios.md), [Windows guide](docs/windows-setup.md), [Linux guide](docs/linux-setup.md), [testing guide](docs/testing.md), and [architecture](docs/architecture.md). VM integration remains to be verified in the configured lab.

## Limits and safety

Coverage is limited to implemented rules and telemetry configuration. The project has no claim of detection accuracy or complete ATT&CK coverage. Run it only on systems and networks you own or are authorized to test. Keep the lab network isolated from normal LAN traffic.
