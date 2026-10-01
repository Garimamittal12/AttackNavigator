from __future__ import annotations

from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


class LabAgent(Base):
    __tablename__ = "lab_agents"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    hostname: Mapped[str] = mapped_column(String)
    platform: Mapped[str] = mapped_column(String)
    supported_scenarios: Mapped[list] = mapped_column(JSON, default=list)
    last_heartbeat: Mapped[datetime] = mapped_column(DateTime)


class ScenarioRun(Base):
    __tablename__ = "simulation_runs"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    scenario_id: Mapped[str] = mapped_column(String)
    agent_id: Mapped[str] = mapped_column(ForeignKey("lab_agents.id"))
    started_at: Mapped[datetime] = mapped_column(DateTime)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    simulation_status: Mapped[str] = mapped_column(String, default="queued")
    telemetry_status: Mapped[str] = mapped_column(String, default="pending")
    parsing_status: Mapped[str] = mapped_column(String, default="pending")
    detection_status: Mapped[str] = mapped_column(String, default="pending")
    attack_mapping_status: Mapped[str] = mapped_column(String, default="pending")
    expected_attack: Mapped[str] = mapped_column(String)
    actual_attack: Mapped[str | None] = mapped_column(String, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)


class RawLog(Base):
    __tablename__ = "raw_logs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    run_id: Mapped[str | None] = mapped_column(ForeignKey("simulation_runs.id"), nullable=True)
    received_at: Mapped[datetime] = mapped_column(DateTime)
    source: Mapped[str] = mapped_column(String)
    content: Mapped[str] = mapped_column(Text)


class NormalizedEvent(Base):
    __tablename__ = "normalized_events"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    raw_log_id: Mapped[int] = mapped_column(ForeignKey("raw_logs.id"))
    run_id: Mapped[str | None] = mapped_column(ForeignKey("simulation_runs.id"), nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime)
    host: Mapped[str] = mapped_column(String)
    platform: Mapped[str] = mapped_column(String)
    source: Mapped[str] = mapped_column(String)
    event_type: Mapped[str] = mapped_column(String)
    process: Mapped[str | None] = mapped_column(String, nullable=True)
    user: Mapped[str | None] = mapped_column(String, nullable=True)
    command_line: Mapped[str | None] = mapped_column(Text, nullable=True)
    event_id: Mapped[str] = mapped_column(String)
    data: Mapped[dict] = mapped_column(JSON)


class Detection(Base):
    __tablename__ = "detections"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("normalized_events.id"))
    run_id: Mapped[str | None] = mapped_column(ForeignKey("simulation_runs.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime)
    rule_id: Mapped[str] = mapped_column(String)
    name: Mapped[str] = mapped_column(String)
    severity: Mapped[str] = mapped_column(String)
    technique: Mapped[str] = mapped_column(String)
    tactic: Mapped[str] = mapped_column(String)
    matched_conditions: Mapped[dict] = mapped_column(JSON)

