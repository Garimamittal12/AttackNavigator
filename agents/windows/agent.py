"""Windows-only AttackNavigator agent: scenario IDs only, never arbitrary commands."""
from __future__ import annotations

import json, os, socket, subprocess, time
from datetime import datetime, timezone
from urllib.request import Request, urlopen

BASE = os.environ.get("ATTACKNAVIGATOR_API_URL", "http://ATTACKNAVIGATOR-HOST:8000/api").rstrip("/")
TOKEN = os.environ.get("ATTACKNAVIGATOR_AGENT_TOKEN", "")
AGENT_ID = os.environ.get("ATTACKNAVIGATOR_AGENT_ID", socket.gethostname())
HEADERS = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}
SCENARIO_COMMANDS = {
    "POWERSHELL_001": ["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", "Write-Output 'AttackNavigator POWERSHELL_001'"],
    "CMD_001": ["cmd.exe", "/d", "/c", "ver"],
    "DISCOVERY_WIN_001": ["systeminfo.exe"],
    "DISCOVERY_WIN_002": ["tasklist.exe"],
}


def api(method: str, path: str, body: dict | None = None) -> dict:
    request = Request(f"{BASE}{path}", data=json.dumps(body).encode() if body is not None else None, method=method, headers=HEADERS)
    with urlopen(request, timeout=20) as response: return json.loads(response.read() or b"{}")


def execute(scenario_id: str) -> None:
    command = SCENARIO_COMMANDS.get(scenario_id)
    if not command: raise ValueError(f"scenario is not allowlisted: {scenario_id}")
    # Fixed benign commands only; this agent never accepts a command string from the backend.
    subprocess.run(command, check=True, timeout=60, capture_output=True)


def latest_sysmon_xml(after: datetime) -> str | None:
    script = "Get-WinEvent -FilterHashtable @{LogName='Microsoft-Windows-Sysmon/Operational'; Id=1; StartTime=[datetime]'%s'} -MaxEvents 1 | ForEach-Object { $_.ToXml() }" % after.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    result = subprocess.run(["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", script], capture_output=True, text=True, timeout=30, check=True)
    return result.stdout.strip() or None


def main() -> None:
    if not TOKEN: raise RuntimeError("ATTACKNAVIGATOR_AGENT_TOKEN must be configured")
    api("POST", "/agents/register", {"id": AGENT_ID, "hostname": socket.gethostname(), "platform": "windows", "supported_scenarios": list(SCENARIO_COMMANDS)})
    while True:
        api("POST", f"/agents/{AGENT_ID}/heartbeat")
        job = api("GET", f"/agents/{AGENT_ID}/jobs/next").get("job")
        if job:
            began = datetime.now(timezone.utc)
            try:
                execute(job["scenario_id"]); api("POST", f"/runs/{job['run_id']}/agent-result", {"success": True})
                xml = latest_sysmon_xml(began)
                if xml: api("POST", "/logs/sysmon", {"run_id": job["run_id"], "xml": xml})
            except Exception as exc: api("POST", f"/runs/{job['run_id']}/agent-result", {"success": False, "error": str(exc)})
        time.sleep(5)


if __name__ == "__main__": main()
