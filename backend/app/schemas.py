from __future__ import annotations
from datetime import datetime
from pydantic import BaseModel, Field


class AgentRegistration(BaseModel):
    id: str
    hostname: str
    platform: str
    supported_scenarios: list[str] = Field(default_factory=list)


class AgentResult(BaseModel):
    success: bool
    error: str | None = None


class SysmonIngest(BaseModel):
    run_id: str | None = None
    xml: str


class AuditdIngest(BaseModel):
    run_id: str | None = None
    record: str
