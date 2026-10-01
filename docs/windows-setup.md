# Windows lab setup

Use only an authorized, isolated VM. Place the Windows VM on a VirtualBox host-only adapter; configure the lab addresses in `.env`, never in code.

1. Install Sysmon from Microsoft Sysinternals as Administrator and apply an approved Sysmon configuration that includes Event ID 1 (Process Create). Verify with `Get-WinEvent -LogName Microsoft-Windows-Sysmon/Operational -MaxEvents 5`.
2. Install Python on the VM, copy `agents/windows/agent.py`, and set `ATTACKNAVIGATOR_API_URL`, `ATTACKNAVIGATOR_AGENT_TOKEN`, and optionally `ATTACKNAVIGATOR_AGENT_ID` as machine environment variables.
3. Start the backend with a nonempty `ATTACKNAVIGATOR_AGENT_TOKEN`, then run `py agent.py` in an elevated session that can read the Sysmon Operational log.
4. Open the dashboard. The VM is online only after real registration and heartbeat. Run `POWERSHELL_001`; the agent invokes its fixed benign command, reads the resulting Sysmon Event ID 1 XML, and sends it to the collector.

If the simulation completes but telemetry stays pending, inspect the Sysmon event log and network path to the backend. Do not mark this as a successful detection until raw XML arrives.

