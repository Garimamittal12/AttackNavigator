from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import Depends, FastAPI, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import AGENT_TOKEN, STALE_SECONDS
from .database import Base, SessionLocal, engine
from .attack import TECHNIQUES
from .detection import evaluate
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


@app.get("/api/scenarios")
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


@app.get("/api/detections")
def detections(db: Session = Depends(db_session)):
    return [{"id": d.id, "name": d.name, "severity": d.severity, "technique": d.technique, "tactic": d.tactic, "created_at": d.created_at, "event_id": d.event_id, "run_id": d.run_id} for d in db.scalars(select(Detection).order_by(Detection.created_at.desc())).all()]


@app.get("/api/detections/{detection_id}")
def detection_detail(detection_id: int, db: Session = Depends(db_session)):
    detection = db.get(Detection, detection_id)
    if not detection: raise HTTPException(404, "detection not found")
    event = db.get(NormalizedEvent, detection.event_id); raw = db.get(RawLog, event.raw_log_id)
    return {"detection": {"id": detection.id, "name": detection.name, "rule_id": detection.rule_id, "severity": detection.severity, "technique": detection.technique, "tactic": detection.tactic, "matched_conditions": detection.matched_conditions, "created_at": detection.created_at}, "normalized_event": {"id": event.id, "timestamp": event.timestamp, "host": event.host, "platform": event.platform, "source": event.source, "event_type": event.event_type, "process": event.process, "user": event.user, "command_line": event.command_line, "event_id": event.event_id, "data": event.data}, "raw_log": {"id": raw.id, "content": raw.content}}


@app.get("/api/logs/{raw_log_id}")
def raw_log(raw_log_id: int, db: Session = Depends(db_session)):
    item = db.get(RawLog, raw_log_id)
    if not item: raise HTTPException(404, "raw log not found")
    return {"id": item.id, "run_id": item.run_id, "source": item.source, "received_at": item.received_at, "content": item.content}


@app.get("/api/events/{event_id}")
def normalized_event(event_id: int, db: Session = Depends(db_session)):
    item = db.get(NormalizedEvent, event_id)
    if not item: raise HTTPException(404, "normalized event not found")
    return {"id": item.id, "raw_log_id": item.raw_log_id, "run_id": item.run_id, "timestamp": item.timestamp, "host": item.host, "platform": item.platform, "source": item.source, "event_type": item.event_type, "process": item.process, "user": item.user, "command_line": item.command_line, "event_id": item.event_id, "data": item.data}


@app.get("/api/dashboard/stats")
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


@app.get("/api/attack/techniques")
def techniques():
    return list(TECHNIQUES.values())
