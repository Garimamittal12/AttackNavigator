# Linux lab setup

Use an authorized Ubuntu VM on the isolated lab network. The Linux agent supports only two fixed read-only scenarios: `DISCOVERY_LINUX_001` (`uname -a`) and `DISCOVERY_LINUX_002` (`ps -ef`). It never receives shell commands from AttackNavigator.

Install auditd and enable execution auditing before claiming these scenarios work:

```bash
sudo apt update && sudo apt install -y auditd
sudo auditctl -a always,exit -F arch=b64 -S execve -k attacknavigator-exec
sudo ausearch -k attacknavigator-exec -i | tail
```

Install Python 3, copy `agents/linux/agent.py`, then set `ATTACKNAVIGATOR_API_URL`, `ATTACKNAVIGATOR_AGENT_TOKEN`, and optionally `ATTACKNAVIGATOR_AGENT_ID`. Run `python3 agent.py` with permission to invoke `ausearch`.

The agent posts only a real `auditd` `EXECVE` record obtained after its fixed command has run. If no record arrives, the simulation correctly remains without telemetry; inspect auditd rules, journal/audit permissions, and the VM-to-host route.

The audit rule above is session-local. Persist a reviewed equivalent under `/etc/audit/rules.d/` only in your dedicated lab, and remove it after testing if it is no longer wanted.
