# Testing

Run backend unit tests from `backend`:

```powershell
py -3 -m pytest -q
```

Run the frontend production build from `frontend`:

```powershell
npm run build
```

These validate registry consistency, YAML loading, detection matching, and compilation. They do not validate a VM.

For each real-lab scenario, record: agent registration, run ID, raw Sysmon/auditd record, normalized event, detection ID, expected vs actual ATT&CK result, and cleanup. Mark the YAML scenario `telemetry_verified` and `detection_verified` true only after that evidence is reviewed.
