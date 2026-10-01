"""Linux AttackNavigator agent. It executes only local, allowlisted read-only scenarios."""
from __future__ import annotations
import json, os, socket, subprocess, time
from urllib.request import Request, urlopen

BASE = os.environ.get("ATTACKNAVIGATOR_API_URL", "http://ATTACKNAVIGATOR-HOST:8000/api").rstrip("/")
TOKEN = os.environ.get("ATTACKNAVIGATOR_AGENT_TOKEN", "")
AGENT_ID = os.environ.get("ATTACKNAVIGATOR_AGENT_ID", socket.gethostname())
HEADERS = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}
COMMANDS = {"DISCOVERY_LINUX_001": ["uname", "-a"], "DISCOVERY_LINUX_002": ["ps", "-ef"]}


def api(method: str, path: str, body: dict | None = None) -> dict:
    request = Request(f"{BASE}{path}", data=json.dumps(body).encode() if body else None, method=method, headers=HEADERS)
    with urlopen(request, timeout=20) as response: return json.loads(response.read() or b"{}")


def audit_record(command: str) -> str | None:
    result = subprocess.run(["ausearch", "-m", "EXECVE", "-ts", "recent", "-i"], text=True, capture_output=True, timeout=20)
    return next((line for line in reversed(result.stdout.splitlines()) if "type=EXECVE" in line and f'a0="{command}"' in line), None)


def main() -> None:
    if not TOKEN: raise RuntimeError("ATTACKNAVIGATOR_AGENT_TOKEN must be configured")
    api("POST", "/agents/register", {"id": AGENT_ID, "hostname": socket.gethostname(), "platform": "linux", "supported_scenarios": list(COMMANDS)})
    while True:
        api("POST", f"/agents/{AGENT_ID}/heartbeat")
        job = api("GET", f"/agents/{AGENT_ID}/jobs/next").get("job")
        if job:
            command = COMMANDS.get(job["scenario_id"])
            if not command:
                api("POST", f"/runs/{job['run_id']}/agent-result", {"success": False, "error": "scenario is not allowlisted"})
            else:
                try:
                    subprocess.run(command, check=True, timeout=30, capture_output=True)
                    api("POST", f"/runs/{job['run_id']}/agent-result", {"success": True})
                    if record := audit_record(command[0]): api("POST", "/logs/auditd", {"run_id": job["run_id"], "record": record})
                except Exception as exc: api("POST", f"/runs/{job['run_id']}/agent-result", {"success": False, "error": str(exc)})
        time.sleep(5)


if __name__ == "__main__": main()
