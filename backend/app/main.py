from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import Depends, FastAPI, Header, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from .config import AGENT_TOKEN, STALE_SECONDS
from .database import Base, SessionLocal, engine
from .attack import TECHNIQUES
from .detection import evaluate, load_rules
from .models import Detection, LabAgent, NormalizedEvent, RawLog, ScenarioRun
from .parsing import parse_linux_audit_execve, parse_sysmon_process_creation
from .scenarios import get_scenario, load_scenarios
from .schemas import AgentRegistration, AgentResult, AuditdIngest, SysmonIngest

app = FastAPI(title="AttackNavigator", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173"], allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
def startup() -> None:
    Base.metadata.create_all(engine)


def db_session():
    db = SessionLocal()
    try: yield db
    finally: db.close()


def verify_agent_token(authorization: str | None = Header(default=None)) -> None:
    # An empty configured token is intentionally rejected, avoiding an accidentally open collector.
    if not AGENT_TOKEN or authorization != f"Bearer {AGENT_TOKEN}":
        raise HTTPException(401, "agent authentication failed")


def serialize_run(run: ScenarioRun) -> dict:
    return {key: getattr(run, key) for key in ("id", "scenario_id", "agent_id", "started_at", "completed_at", "simulation_status", "telemetry_status", "parsing_status", "detection_status", "attack_mapping_status", "expected_attack", "actual_attack", "error")}


@app.get("/health")
def health(): return {"status": "ok"}


@app.post("/api/agents/register", dependencies=[Depends(verify_agent_token)])
def register(agent: AgentRegistration, db: Session = Depends(db_session)):
    item = db.get(LabAgent, agent.id)
    if item is None:
        item = LabAgent(id=agent.id, hostname=agent.hostname, platform=agent.platform, supported_scenarios=agent.supported_scenarios, last_heartbeat=datetime.now(timezone.utc))
        db.add(item)
    else:
        item.hostname, item.platform, item.supported_scenarios, item.last_heartbeat = agent.hostname, agent.platform, agent.supported_scenarios, datetime.now(timezone.utc)
    db.commit(); return {"registered": True}


@app.post("/api/agents/{agent_id}/heartbeat", dependencies=[Depends(verify_agent_token)])
def heartbeat(agent_id: str, db: Session = Depends(db_session)):
    agent = db.get(LabAgent, agent_id)
    if not agent: raise HTTPException(404, "agent not registered")
    agent.last_heartbeat = datetime.now(timezone.utc); db.commit(); return {"status": "ok"}


@app.get("/api/lab/status")
def lab_status(db: Session = Depends(db_session)):
    cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(seconds=STALE_SECONDS)
    agents = db.scalars(select(LabAgent)).all()
    return [{"id": a.id, "hostname": a.hostname, "platform": a.platform, "supported_scenarios": a.supported_scenarios, "online": a.last_heartbeat >= cutoff, "last_heartbeat": a.last_heartbeat} for a in agents]


@app.get("/api/legacy/scenarios")
def scenarios(): return list(load_scenarios().values())


@app.post("/api/scenarios/{scenario_id}/runs")
def queue_run(scenario_id: str, agent_id: str, db: Session = Depends(db_session)):
    scenario = get_scenario(scenario_id)
    agent = db.get(LabAgent, agent_id)
    if not scenario: raise HTTPException(404, "unknown scenario")
    if not agent or scenario_id not in agent.supported_scenarios: raise HTTPException(409, "selected agent does not support this scenario")
    if agent.platform != scenario["platform"]: raise HTTPException(409, "scenario platform does not match agent")
    run = ScenarioRun(id=str(uuid4()), scenario_id=scenario_id, agent_id=agent_id, started_at=datetime.now(timezone.utc), expected_attack=scenario["techniques"][0])
    db.add(run); db.commit(); return serialize_run(run)


@app.get("/api/agents/{agent_id}/jobs/next", dependencies=[Depends(verify_agent_token)])
def next_job(agent_id: str, db: Session = Depends(db_session)):
    run = db.scalars(select(ScenarioRun).where(ScenarioRun.agent_id == agent_id, ScenarioRun.simulation_status == "queued").order_by(ScenarioRun.started_at)).first()
    if not run: return {"job": None}
    run.simulation_status = "running"; db.commit()
    return {"job": {"run_id": run.id, "scenario_id": run.scenario_id}}


@app.post("/api/runs/{run_id}/agent-result", dependencies=[Depends(verify_agent_token)])
def agent_result(run_id: str, result: AgentResult, db: Session = Depends(db_session)):
    run = db.get(ScenarioRun, run_id)
    if not run: raise HTTPException(404, "run not found")
    run.simulation_status = "success" if result.success else "failed"; run.error = result.error; run.completed_at = datetime.now(timezone.utc)
    db.commit(); return serialize_run(run)


@app.post("/api/logs/sysmon", dependencies=[Depends(verify_agent_token)])
def ingest_sysmon(payload: SysmonIngest, db: Session = Depends(db_session)):
    raw = RawLog(run_id=payload.run_id, received_at=datetime.now(timezone.utc), source="sysmon", content=payload.xml); db.add(raw); db.flush()
    event = parse_sysmon_process_creation(payload.xml)
    if not event:
        db.commit(); return {"raw_log_id": raw.id, "parsed": False, "reason": "not a Sysmon Event ID 1 record"}
    normalized = NormalizedEvent(raw_log_id=raw.id, run_id=payload.run_id, **event); db.add(normalized); db.flush()
    if payload.run_id and (run := db.get(ScenarioRun, payload.run_id)):
        run.telemetry_status, run.parsing_status = "success", "success"
    detections = []
    for rule, matched in evaluate(event):
        detection = Detection(event_id=normalized.id, run_id=payload.run_id, created_at=datetime.now(timezone.utc), rule_id=rule["id"], name=rule["name"], severity=rule["severity"], technique=rule["mitre"]["technique"], tactic=rule["mitre"]["tactic"], matched_conditions=matched)
        db.add(detection); db.flush(); detections.append(detection.id)
        if payload.run_id and (run := db.get(ScenarioRun, payload.run_id)):
            run.detection_status, run.attack_mapping_status, run.actual_attack = "success", "success", detection.technique
    db.commit(); return {"raw_log_id": raw.id, "normalized_event_id": normalized.id, "detection_ids": detections}


@app.post("/api/logs/auditd", dependencies=[Depends(verify_agent_token)])
def ingest_auditd(payload: AuditdIngest, db: Session = Depends(db_session)):
    raw = RawLog(run_id=payload.run_id, received_at=datetime.now(timezone.utc), source="auditd", content=payload.record); db.add(raw); db.flush()
    event = parse_linux_audit_execve(payload.record)
    if not event:
        db.commit(); return {"raw_log_id": raw.id, "parsed": False, "reason": "not an auditd EXECVE record"}
    normalized = NormalizedEvent(raw_log_id=raw.id, run_id=payload.run_id, **event); db.add(normalized); db.flush()
    if payload.run_id and (run := db.get(ScenarioRun, payload.run_id)):
        run.telemetry_status, run.parsing_status = "success", "success"
    detection_ids = []
    for rule, matched in evaluate(event):
        detection = Detection(event_id=normalized.id, run_id=payload.run_id, created_at=datetime.now(timezone.utc), rule_id=rule["id"], name=rule["name"], severity=rule["severity"], technique=rule["mitre"]["technique"], tactic=rule["mitre"]["tactic"], matched_conditions=matched)
        db.add(detection); db.flush(); detection_ids.append(detection.id)
        if payload.run_id and (run := db.get(ScenarioRun, payload.run_id)):
            run.detection_status, run.attack_mapping_status, run.actual_attack = "success", "success", detection.technique
    db.commit(); return {"raw_log_id": raw.id, "normalized_event_id": normalized.id, "detection_ids": detection_ids}


@app.post("/api/logs/upload")
async def upload_sysmon(file: UploadFile, db: Session = Depends(db_session)):
    """Offline path: upload one actual Sysmon Event XML record; it uses the same parser and rules."""
    xml = (await file.read()).decode("utf-8", errors="replace")
    return ingest_sysmon(SysmonIngest(xml=xml), db)


@app.get("/api/runs/{run_id}")
def get_run(run_id: str, db: Session = Depends(db_session)):
    run = db.get(ScenarioRun, run_id)
    if not run: raise HTTPException(404, "run not found")
    return serialize_run(run)


@app.get("/api/legacy/detections")
def detections(db: Session = Depends(db_session)):
    return [{"id": d.id, "name": d.name, "severity": d.severity, "technique": d.technique, "tactic": d.tactic, "created_at": d.created_at, "event_id": d.event_id, "run_id": d.run_id} for d in db.scalars(select(Detection).order_by(Detection.created_at.desc())).all()]


@app.get("/api/legacy/detections/{detection_id}")
def detection_detail(detection_id: int, db: Session = Depends(db_session)):
    detection = db.get(Detection, detection_id)
    if not detection: raise HTTPException(404, "detection not found")
    event = db.get(NormalizedEvent, detection.event_id); raw = db.get(RawLog, event.raw_log_id)
    return {"detection": {"id": detection.id, "name": detection.name, "rule_id": detection.rule_id, "severity": detection.severity, "technique": detection.technique, "tactic": detection.tactic, "matched_conditions": detection.matched_conditions, "created_at": detection.created_at}, "normalized_event": {"id": event.id, "timestamp": event.timestamp, "host": event.host, "platform": event.platform, "source": event.source, "event_type": event.event_type, "process": event.process, "user": event.user, "command_line": event.command_line, "event_id": event.event_id, "data": event.data}, "raw_log": {"id": raw.id, "content": raw.content}}


@app.get("/api/logs/{raw_log_id}")
def raw_log(raw_log_id: int, db: Session = Depends(db_session)):
    item = db.get(RawLog, raw_log_id)
    if not item: raise HTTPException(404, "raw log not found")
    event = db.scalars(select(NormalizedEvent).where(NormalizedEvent.raw_log_id == item.id)).first()
    detection = db.scalars(select(Detection).where(Detection.event_id == event.id)).first() if event else None
    run = db.get(ScenarioRun, item.run_id) if item.run_id else None
    return {"id": str(item.id), "timestamp": _iso(item.received_at), "host": event.host if event else "unknown", "platform": event.platform if event else "multi", "source": item.source, "event_type": event.event_type if event else "unparsed", "event_id": event.event_id if event else "", "process": event.process if event else None, "raw_data": item.content, "normalized_event_id": str(event.id) if event else None, "detection_id": str(detection.id) if detection else None, "simulation_id": item.run_id, "scenario_id": run.scenario_id if run else None}


@app.get("/api/events/{event_id}")
def normalized_event(event_id: int, db: Session = Depends(db_session)):
    item = db.get(NormalizedEvent, event_id)
    if not item: raise HTTPException(404, "normalized event not found")
    return {"id": item.id, "raw_log_id": item.raw_log_id, "run_id": item.run_id, "timestamp": item.timestamp, "host": item.host, "platform": item.platform, "source": item.source, "event_type": item.event_type, "process": item.process, "user": item.user, "command_line": item.command_line, "event_id": item.event_id, "data": item.data}


@app.get("/api/legacy/dashboard/stats")
def dashboard_stats(db: Session = Depends(db_session)):
    # Counts are calculated from persisted records only; the endpoint never supplies display defaults.
    return {"agents": len(db.scalars(select(LabAgent)).all()), "raw_logs": len(db.scalars(select(RawLog)).all()), "events": len(db.scalars(select(NormalizedEvent)).all()), "detections": len(db.scalars(select(Detection)).all())}


@app.get("/api/attack/matrix")
def matrix(db: Session = Depends(db_session)):
    runs = db.scalars(select(ScenarioRun)).all()
    detected = {d.technique for d in db.scalars(select(Detection)).all()}
    # A simulation alone is not an ATT&CK test: telemetry must have arrived before a technique can be missed.
    tested = {run.expected_attack for run in runs if run.telemetry_status == "success"}
    return [{**metadata, "state": "detected" if technique in detected else "missed" if technique in tested else "not_tested"} for technique, metadata in TECHNIQUES.items()]


@app.get("/api/legacy/attack/techniques")
def techniques():
    return list(TECHNIQUES.values())


# Dashboard API -------------------------------------------------------------
# The React dashboard uses these presentation endpoints.  They are adapters over
# the collector tables above: no sample data or client-side mock state is used.

def _iso(value):
    return value.isoformat() if value else None


def _agent_view(agent: LabAgent) -> dict:
    cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(seconds=STALE_SECONDS)
    return {
        "id": agent.id, "hostname": agent.hostname, "platform": agent.platform,
        "os": agent.platform.title(), "ip": "", "version": "",
        "status": "online" if agent.last_heartbeat >= cutoff else "offline",
        "last_heartbeat": _iso(agent.last_heartbeat), "supported_scenarios": agent.supported_scenarios,
        "registered_at": None,
    }


def _scenario_view(item: dict) -> dict:
    technique = TECHNIQUES[item["techniques"][0]]
    return {
        "id": item["id"], "name": item["name"], "description": item["description"],
        "tactic": item["tactic"], "technique_id": technique["id"], "technique_name": technique["name"],
        "platform": item["platform"], "target": "", "expected_telemetry": item["expected_telemetry"],
        "expected_event": ", ".join(item["expected_event_types"]),
        "expected_detection_rule": item["detection_rules"][0] if item["detection_rules"] else "",
        "detection_rule_id": item["detection_rules"][0] if item["detection_rules"] else None,
        "status": item.get("implementation_status", "implemented"), "prerequisites": item.get("prerequisites", []),
    }


def _run_view(run: ScenarioRun, db: Session) -> dict:
    scenario = get_scenario(run.scenario_id) or {}
    technique = TECHNIQUES.get(run.expected_attack, {"id": run.expected_attack, "name": run.expected_attack, "tactic": "Unknown"})
    agent = db.get(LabAgent, run.agent_id)
    detections_for_run = db.scalars(select(Detection).where(Detection.run_id == run.id)).all()
    raw_logs = db.scalars(select(RawLog).where(RawLog.run_id == run.id)).all()
    events = db.scalars(select(NormalizedEvent).where(NormalizedEvent.run_id == run.id)).all()
    simulation_status = {"queued": "pending", "running": "running", "success": "success", "failed": "failed"}.get(run.simulation_status, run.simulation_status)
    telemetry_status = "received" if run.telemetry_status == "success" else run.telemetry_status
    detection_status = "detected" if run.detection_status == "success" else ("missed" if telemetry_status == "received" and simulation_status == "success" else "pending")
    rule = next((r for r in load_rules() if r["id"] in scenario.get("detection_rules", [])), None)
    return {
        "id": run.id, "scenario_id": run.scenario_id, "scenario_name": scenario.get("name", run.scenario_id),
        "target_agent_id": run.agent_id, "target_hostname": agent.hostname if agent else run.agent_id,
        "attacker_agent_id": None, "attacker_hostname": None, "status": simulation_status,
        "telemetry_status": telemetry_status, "parsing_status": "completed" if run.parsing_status == "success" else run.parsing_status,
        "detection_status": detection_status, "attack_technique_id": technique["id"], "attack_technique_name": technique["name"],
        "severity": (rule or {}).get("severity", "info").lower(), "created_at": _iso(run.started_at), "completed_at": _iso(run.completed_at),
        "timeline": [],
        "expected": {"telemetry": scenario.get("expected_telemetry", ""), "event_type": ", ".join(scenario.get("expected_event_types", [])), "attack_technique_id": technique["id"], "attack_technique_name": technique["name"], "detection_rule_id": (rule or {}).get("id", ""), "detection_rule_name": (rule or {}).get("name", ""), "tactic": technique["tactic"], "severity": (rule or {}).get("severity", "info").lower()},
        "actual": None, "raw_log_ids": [str(x.id) for x in raw_logs], "normalized_event_ids": [str(x.id) for x in events], "detection_ids": [str(x.id) for x in detections_for_run],
    }


def _detection_view(detection: Detection, db: Session) -> dict:
    event = db.get(NormalizedEvent, detection.event_id)
    raw = db.get(RawLog, event.raw_log_id) if event else None
    run = db.get(ScenarioRun, detection.run_id) if detection.run_id else None
    scenario = get_scenario(run.scenario_id) if run else None
    technique = TECHNIQUES.get(detection.technique, {"name": detection.technique})
    fields = [{"field": key, "operator": next(iter(value["condition"]), "equals"), "expected": str(next(iter(value["condition"].values()), "")), "actual": value["actual"]} for key, value in (detection.matched_conditions or {}).items()]
    return {"id": str(detection.id), "rule_id": detection.rule_id, "rule_name": detection.name,
            "host": event.host if event else "unknown", "platform": event.platform if event else "multi",
            "severity": detection.severity.lower(), "attack_technique_id": detection.technique,
            "attack_technique_name": technique["name"], "tactic": detection.tactic,
            "timestamp": _iso(detection.created_at), "scenario_id": run.scenario_id if run else None,
            "scenario_name": scenario.get("name") if scenario else None, "simulation_id": detection.run_id,
            "normalized_event_id": str(event.id) if event else None, "raw_log_id": str(raw.id) if raw else None,
            "matched_fields": fields}


@app.get("/api/agents")
def dashboard_agents(db: Session = Depends(db_session)):
    return [_agent_view(item) for item in db.scalars(select(LabAgent)).all()]


@app.get("/api/scenarios")
def dashboard_scenarios():
    return [_scenario_view(item) for item in load_scenarios().values()]


@app.post("/api/simulations/run")
def dashboard_queue_run(payload: dict, db: Session = Depends(db_session)):
    scenario_id, agent_id = payload.get("scenario_id"), payload.get("target_agent_id")
    scenario, agent = get_scenario(scenario_id), db.get(LabAgent, agent_id)
    if not scenario: raise HTTPException(404, "unknown scenario")
    if not agent or scenario_id not in agent.supported_scenarios: raise HTTPException(409, "selected agent does not support this scenario")
    if agent.platform != scenario["platform"]: raise HTTPException(409, "scenario platform does not match agent")
    run = ScenarioRun(id=str(uuid4()), scenario_id=scenario_id, agent_id=agent_id, started_at=datetime.now(timezone.utc), expected_attack=scenario["techniques"][0])
    db.add(run); db.commit(); return _run_view(run, db)


@app.get("/api/simulations")
def dashboard_runs(page: int = 1, page_size: int = 50, db: Session = Depends(db_session)):
    rows = db.scalars(select(ScenarioRun).order_by(ScenarioRun.started_at.desc())).all()
    start = max(page - 1, 0) * page_size
    return {"items": [_run_view(row, db) for row in rows[start:start + page_size]], "total": len(rows), "page": page, "page_size": page_size}


@app.get("/api/simulations/{run_id}")
@app.get("/api/simulations/{run_id}/status")
def dashboard_run(run_id: str, db: Session = Depends(db_session)):
    run = db.get(ScenarioRun, run_id)
    if not run: raise HTTPException(404, "run not found")
    return _run_view(run, db)


@app.get("/api/detections")
def dashboard_detections(page: int = 1, page_size: int = 50, db: Session = Depends(db_session)):
    rows = db.scalars(select(Detection).order_by(Detection.created_at.desc())).all()
    start = max(page - 1, 0) * page_size
    return {"items": [_detection_view(row, db) for row in rows[start:start + page_size]], "total": len(rows), "page": page, "page_size": page_size}


@app.get("/api/detections/{detection_id}")
def dashboard_detection(detection_id: int, db: Session = Depends(db_session)):
    item = db.get(Detection, detection_id)
    if not item: raise HTTPException(404, "detection not found")
    return _detection_view(item, db)


@app.get("/api/rules")
def dashboard_rules():
    return [{"id": r["id"], "name": r["name"], "description": r.get("description", ""), "event_type": r["event_types"][0], "conditions": r.get("conditions", {}), "severity": r["severity"].lower(), "attack_technique_id": r["mitre"]["technique"], "attack_technique_name": TECHNIQUES[r["mitre"]["technique"]]["name"], "tactic": r["mitre"]["tactic"], "enabled": r.get("enabled", True), "yaml": ""} for r in load_rules()]


@app.get("/api/dashboard/stats")
def dashboard_statistics(db: Session = Depends(db_session)):
    runs = db.scalars(select(ScenarioRun)).all()
    detected = {d.technique for d in db.scalars(select(Detection)).all()}
    tested = {r.expected_attack for r in runs if r.telemetry_status == "success"}
    return {"connected_agents": sum(1 for a in db.scalars(select(LabAgent)).all() if _agent_view(a)["status"] == "online"), "simulation_runs": len(runs), "detections": db.scalar(select(func.count()).select_from(Detection)) or 0, "detection_gaps": sum(1 for r in runs if r.telemetry_status == "success" and r.expected_attack not in detected), "techniques_tested": len(tested), "techniques_detected": len(tested & detected)}


@app.get("/api/dashboard/recent-simulations")
def dashboard_recent_runs(limit: int = 8, db: Session = Depends(db_session)):
    return [_run_view(row, db) for row in db.scalars(select(ScenarioRun).order_by(ScenarioRun.started_at.desc()).limit(limit)).all()]


@app.get("/api/dashboard/recent-detections")
def dashboard_recent_detections(limit: int = 8, db: Session = Depends(db_session)):
    return [_detection_view(row, db) for row in db.scalars(select(Detection).order_by(Detection.created_at.desc()).limit(limit)).all()]


@app.get("/api/dashboard/detection-gaps")
def dashboard_gaps(db: Session = Depends(db_session)):
    detected = {d.technique for d in db.scalars(select(Detection)).all()}
    result = []
    for run in db.scalars(select(ScenarioRun).where(ScenarioRun.telemetry_status == "success")).all():
        if run.expected_attack not in detected:
            scenario = get_scenario(run.scenario_id) or {}
            result.append({"id": run.id, "scenario_id": run.scenario_id, "scenario_name": scenario.get("name", run.scenario_id), "expected_technique_id": run.expected_attack, "expected_technique_name": TECHNIQUES.get(run.expected_attack, {}).get("name", run.expected_attack), "telemetry_status": "received", "detection_status": "missed", "simulation_id": run.id, "timestamp": _iso(run.completed_at or run.started_at), "explanation": "Telemetry arrived but no matching detection was stored."})
    return result


@app.get("/api/attack/coverage")
def dashboard_coverage(db: Session = Depends(db_session)):
    runs = db.scalars(select(ScenarioRun)).all(); detected = {d.technique for d in db.scalars(select(Detection)).all()}
    tested = {r.expected_attack for r in runs if r.telemetry_status == "success"}
    tactics = sorted({item["tactic"] for item in TECHNIQUES.values()})
    by_tactic = []
    for tactic in tactics:
        ids = {key for key, value in TECHNIQUES.items() if value["tactic"] == tactic}
        by_tactic.append({"tactic": tactic, "tested": len(ids & tested), "detected": len(ids & tested & detected), "missed": len(ids & tested - detected), "total": len(ids)})
    return {"techniques_tested": len(tested), "techniques_detected": len(tested & detected), "techniques_missed": len(tested - detected), "by_tactic": by_tactic}


@app.get("/api/system/status")
def dashboard_system_status(db: Session = Depends(db_session)):
    agents = db.scalars(select(LabAgent)).all()
    return {"backend_connected": True, "api_base_url": "/api", "environment": "lab", "database": "sqlite", "detection_rules_loaded": len(load_rules()), "attack_metadata_loaded": len(TECHNIQUES), "collector_status": "online" if any(_agent_view(a)["status"] == "online" for a in agents) else "offline", "agent_count": len(agents)}


@app.post("/api/upload/analyze")
async def dashboard_upload(files: list[UploadFile] = File(...), db: Session = Depends(db_session)):
    parsed = normalized = detections_created = 0; errors = []
    for file in files:
        content = (await file.read()).decode("utf-8", errors="replace")
        try:
            response = ingest_sysmon(SysmonIngest(xml=content), db) if "<Event" in content else ingest_auditd(AuditdIngest(record=content), db)
            if response.get("parsed") is not False:
                parsed += 1; normalized += 1; detections_created += len(response.get("detection_ids", []))
            else: errors.append(f"{file.filename}: {response.get('reason', 'unsupported telemetry')}")
        except Exception as exc:
            errors.append(f"{file.filename}: {exc}")
    return {"id": str(uuid4()), "filename": ", ".join(f.filename or "upload" for f in files), "status": "completed" if parsed else "failed", "events_parsed": parsed, "events_normalized": normalized, "detections_generated": detections_created, "attack_techniques_mapped": detections_created, "errors": errors}


@app.get("/api/logs")
def dashboard_logs(page: int = 1, page_size: int = 50, db: Session = Depends(db_session)):
    rows = db.scalars(select(RawLog).order_by(RawLog.received_at.desc())).all()
    start = max(page - 1, 0) * page_size
    return {"items": [raw_log(row.id, db) for row in rows[start:start + page_size]], "total": len(rows), "page": page, "page_size": page_size}


@app.get("/api/logs/{raw_log_id}/normalized")
def dashboard_normalized_log(raw_log_id: int, db: Session = Depends(db_session)):
    item = db.scalars(select(NormalizedEvent).where(NormalizedEvent.raw_log_id == raw_log_id)).first()
    if not item: raise HTTPException(404, "normalized event not found")
    detection = db.scalars(select(Detection).where(Detection.event_id == item.id)).first()
    run = db.get(ScenarioRun, item.run_id) if item.run_id else None
    return {"id": str(item.id), "timestamp": _iso(item.timestamp), "host": item.host, "platform": item.platform, "source": item.source, "event_type": item.event_type, "event_id": item.event_id, "fields": item.data, "raw_log_id": str(item.raw_log_id), "detection_id": str(detection.id) if detection else None, "simulation_id": item.run_id, "scenario_id": run.scenario_id if run else None}


def _technique_view(technique_id: str, metadata: dict, db: Session) -> dict:
    runs = db.scalars(select(ScenarioRun).where(ScenarioRun.expected_attack == technique_id)).all()
    detections_for_technique = db.scalars(select(Detection).where(Detection.technique == technique_id)).all()
    tested = any(run.telemetry_status == "success" for run in runs)
    return {"id": technique_id, "name": metadata["name"], "tactic": metadata["tactic"], "description": "Controlled lab coverage metadata. A technique is only marked tested after telemetry is ingested.", "platform": metadata["platforms"], "subtechniques": [], "status": "detected" if detections_for_technique else "missed" if tested else "not_tested", "tested": tested, "scenarios": [run.scenario_id for run in runs], "detections": [str(item.id) for item in detections_for_technique], "detection_count": len(detections_for_technique), "test_count": len(runs)}


@app.get("/api/attack/techniques")
def dashboard_techniques(db: Session = Depends(db_session)):
    return [_technique_view(key, value, db) for key, value in TECHNIQUES.items()]


@app.get("/api/attack/tactics")
def dashboard_tactics(db: Session = Depends(db_session)):
    result = []
    for tactic in sorted({item["tactic"] for item in TECHNIQUES.values()}):
        items = [_technique_view(key, value, db) for key, value in TECHNIQUES.items() if value["tactic"] == tactic]
        result.append({"id": tactic.lower().replace(" ", "-"), "name": tactic, "techniques": items, "tested_count": sum(item["tested"] for item in items), "detected_count": sum(item["status"] == "detected" for item in items), "missed_count": sum(item["status"] == "missed" for item in items)})
    return result
