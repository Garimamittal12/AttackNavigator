# Detection rules

Rules are YAML documents in `backend/rules`. They run only against normalized events, never raw XML or browser data.

Required fields are `id`, `name`, `description`, `enabled`, `platforms`, `event_types`, `conditions`, `severity`, `mitre`, and `explanation`. A condition currently supports `equals` or `contains`. MITRE IDs reference the separate curated metadata in `backend/app/attack.py`.

Rules currently correspond to fixed, benign lab activities: PowerShell, Windows command shell, Windows system/process discovery, and Linux `uname`/`ps` discovery. A rule appearing in source means the parser and agent path exist; its `telemetry_verified` and `detection_verified` catalog flags remain false until a real lab run verifies them.
