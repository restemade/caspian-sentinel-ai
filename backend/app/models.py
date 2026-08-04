import enum
import uuid
from datetime import UTC, datetime

from sqlalchemy import JSON, DateTime, Enum, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def now_utc() -> datetime:
    return datetime.now(UTC)


class ReportStatus(str, enum.Enum):
    processing = "PROCESSING"
    review = "REVIEW"
    approved = "APPROVED"
    rejected = "REJECTED"


class IncidentStatus(str, enum.Enum):
    new = "NEW"
    acknowledged = "ACKNOWLEDGED"
    resolved = "RESOLVED"


class TicketStatus(str, enum.Enum):
    open = "OPEN"
    assigned = "ASSIGNED"
    completed = "COMPLETED"
    verified = "VERIFIED"


class Observation(Base):
    __tablename__ = "observations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    source: Mapped[str] = mapped_column(String(32), default="USER_SUBMITTED")
    status: Mapped[ReportStatus] = mapped_column(Enum(ReportStatus), default=ReportStatus.processing)
    original_path: Mapped[str] = mapped_column(String(500))
    evidence_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    category: Mapped[str] = mapped_column(String(80), default="unknown")
    confidence: Mapped[float] = mapped_column(Float, default=0)
    severity: Mapped[str] = mapped_column(String(20), default="unknown")
    summary: Mapped[str] = mapped_column(Text, default="")
    objects: Mapped[list] = mapped_column(JSON, default=list)
    cv_metrics: Mapped[dict] = mapped_column(JSON, default=dict)
    ai_payload: Mapped[dict] = mapped_column(JSON, default=dict)
    incident: Mapped["Incident | None"] = relationship(back_populates="observation")


class Incident(Base):
    __tablename__ = "incidents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    observation_id: Mapped[str] = mapped_column(ForeignKey("observations.id"), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    status: Mapped[IncidentStatus] = mapped_column(Enum(IncidentStatus), default=IncidentStatus.new)
    title: Mapped[str] = mapped_column(String(160))
    recommendation: Mapped[str] = mapped_column(Text)
    audit_log: Mapped[list] = mapped_column(JSON, default=list)
    observation: Mapped[Observation] = relationship(back_populates="incident")
    ticket: Mapped["Ticket | None"] = relationship(back_populates="incident")


class Ticket(Base):
    __tablename__ = "tickets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    incident_id: Mapped[str] = mapped_column(ForeignKey("incidents.id"), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    status: Mapped[TicketStatus] = mapped_column(Enum(TicketStatus), default=TicketStatus.open)
    assignee: Mapped[str | None] = mapped_column(String(120), nullable=True)
    after_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    incident: Mapped[Incident] = relationship(back_populates="ticket")
