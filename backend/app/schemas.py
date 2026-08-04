from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class VisionAssessment(BaseModel):
    category: Literal[
        "plastic_waste",
        "oil_like_surface_anomaly",
        "large_debris",
        "dead_fish",
        "wildlife",
        "clean",
        "unknown",
    ] = "unknown"
    confidence: float = Field(ge=0, le=1)
    severity: Literal["low", "medium", "high", "critical", "unknown"] = "unknown"
    summary: str = Field(max_length=600)
    objects: list[str] = Field(default_factory=list, max_length=20)
    recommendation: str = Field(max_length=600)
    requires_human_review: bool = True


class ObservationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    created_at: datetime
    latitude: float
    longitude: float
    source: str
    status: str
    category: str
    confidence: float
    severity: str
    summary: str
    objects: list[Any]
    cv_metrics: dict[str, Any]
    original_url: str
    evidence_url: str | None


class ReviewRequest(BaseModel):
    approved: bool
    recommendation: str | None = Field(default=None, max_length=600)


class TicketUpdate(BaseModel):
    status: Literal["OPEN", "ASSIGNED", "COMPLETED", "VERIFIED"]
    assignee: str | None = Field(default=None, max_length=120)

