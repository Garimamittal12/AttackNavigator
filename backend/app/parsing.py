from __future__ import annotations
from datetime import datetime, timezone
from xml.etree import ElementTree as ET
import re


def parse_sysmon_process_creation(xml: str) -> dict | None:
    """Parse a real Sysmon Event ID 1 XML record; reject other records."""
    root = ET.fromstring(xml)
    ns = {"e": "http://schemas.microsoft.com/win/2004/08/events/event"}
    system = root.find("e:System", ns)
    if system is None or system.findtext("e:EventID", namespaces=ns) != "1":
        return None
    data = {item.attrib.get("Name"): item.text or "" for item in root.findall(".//e:EventData/e:Data", ns)}
    time_node = system.find("e:TimeCreated", ns)
    timestamp = (time_node.attrib.get("SystemTime") if time_node is not None else None)
    return {
        "timestamp": datetime.fromisoformat(timestamp.replace("Z", "+00:00")) if timestamp else datetime.now(timezone.utc),
        "host": system.findtext("e:Computer", default="unknown", namespaces=ns),
        "platform": "windows", "source": "sysmon", "event_type": "process_creation", "event_id": "1",
        "process": data.get("Image", "").rsplit("\\", 1)[-1].lower() or None,
        "user": data.get("User"), "command_line": data.get("CommandLine"), "data": data,
    }


def parse_linux_audit_execve(record: str) -> dict | None:
    """Parse an actual auditd EXECVE line collected from ausearch output."""
    if "type=EXECVE" not in record:
        return None
    values = dict(re.findall(r'(\w+)=((?:"[^"]*")|\S+)', record))
    executable = values.get("a0", "").strip('"').rsplit("/", 1)[-1]
    if not executable:
        return None
    return {
        "timestamp": datetime.now(timezone.utc), "host": values.get("node", "unknown"),
        "platform": "linux", "source": "auditd", "event_type": "process_creation", "event_id": "EXECVE",
        "process": executable, "user": values.get("uid"), "command_line": " ".join(v.strip('"') for k, v in values.items() if k.startswith("a")), "data": values,
    }
