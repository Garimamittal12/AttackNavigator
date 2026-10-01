from __future__ import annotations

import os
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
DATABASE_URL = os.getenv("ATTACKNAVIGATOR_DATABASE_URL", f"sqlite:///{ROOT / 'attacknavigator.db'}")
AGENT_TOKEN = os.getenv("ATTACKNAVIGATOR_AGENT_TOKEN", "")
STALE_SECONDS = int(os.getenv("ATTACKNAVIGATOR_AGENT_STALE_SECONDS", "45"))

