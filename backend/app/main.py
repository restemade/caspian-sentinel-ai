import shutil
import uuid
from pathlib import Path

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import get_settings
from .database import Base, engine, get_db
from .models import Incident, Observation, ReportStatus, Ticket, TicketStatus
from .schemas import ObservationRead, ReviewRequest, TicketUpdate
from .vision import VisionServiceError, analyze_cv, analyze_gemini

settings = get_settings()
upload_dir = Path(settings.upload_dir)
upload_dir.mkdir(parents=True, exist_ok=True)
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Caspian Sentinel AI", version="0.1.0", docs_url="/docs")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.public_origin],
    allow_methods=["GET", "POST", "PATCH"],
    allow_headers=["*"],
)
app.mount("/uploads", StaticFiles(directory=upload_dir), name="uploads")


def observation_read(item: Observation) -> ObservationRead:
    return ObservationRead.model_validate(
        {
            **item.__dict__,
            "status": item.status.value,
            "original_url": f"/uploads/{Path(item.original_path).name}",
            "evidence_url": f"/uploads/{Path(item.evidence_path).name}" if item.evidence_path else None,
        }
    )


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "service": "caspian-sentinel-ai", "mode": "hackathon-mvp"}


@app.get("/api/observations", response_model=list[ObservationRead])
def list_observations(db: Session = Depends(get_db)) -> list[ObservationRead]:
    items = db.scalars(select(Observation).order_by(Observation.created_at.desc())).all()
    return [observation_read(item) for item in items]


@app.post("/api/observations", response_model=ObservationRead, status_code=201)
async def create_observation(
    latitude: float = Form(..., ge=-90, le=90),
    longitude: float = Form(..., ge=-180, le=180),
    source: str = Form("USER_SUBMITTED"),
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> ObservationRead:
    allowed = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
    if image.content_type not in allowed:
        raise HTTPException(415, "Only JPEG, PNG and WebP images are accepted")
    identifier = str(uuid.uuid4())
    original = upload_dir / f"{identifier}-original{allowed[image.content_type]}"
    evidence = upload_dir / f"{identifier}-evidence.jpg"
    with original.open("wb") as target:
        shutil.copyfileobj(image.file, target)
    if original.stat().st_size > settings.max_upload_mb * 1024 * 1024:
        original.unlink(missing_ok=True)
        raise HTTPException(413, "Image is too large")
    try:
        cv_metrics = analyze_cv(original, evidence)
        assessment = await analyze_gemini(original, settings)
    except ValueError as exc:
        original.unlink(missing_ok=True)
        evidence.unlink(missing_ok=True)
        raise HTTPException(422, str(exc)) from exc
    except VisionServiceError as exc:
        assessment = None
        cv_metrics = analyze_cv(original, evidence)
        ai_error = type(exc).__name__
    item = Observation(
        id=identifier,
        latitude=latitude,
        longitude=longitude,
        source=source,
        status=ReportStatus.review,
        original_path=str(original),
        evidence_path=str(evidence),
        category=assessment.category if assessment else "unknown",
        confidence=assessment.confidence if assessment else 0,
        severity=assessment.severity if assessment else "unknown",
        summary=assessment.summary if assessment else "AI unavailable; manual review required.",
        objects=assessment.objects if assessment else [],
        cv_metrics=cv_metrics,
        ai_payload=assessment.model_dump() if assessment else {"error": ai_error},
    )
    db.add(item)
    db.commit()
    return observation_read(item)


@app.post("/api/observations/{observation_id}/review")
def review_observation(observation_id: str, body: ReviewRequest, db: Session = Depends(get_db)) -> dict:
    item = db.get(Observation, observation_id)
    if not item:
        raise HTTPException(404, "Observation not found")
    if not body.approved:
        item.status = ReportStatus.rejected
        db.commit()
        return {"status": "REJECTED"}
    item.status = ReportStatus.approved
    recommendation = body.recommendation or item.ai_payload.get("recommendation", "Inspect and clean the area safely.")
    if item.incident:
        incident = item.incident
        ticket = incident.ticket
    else:
        incident = Incident(
            observation=item,
            title=f"{item.category.replace('_', ' ').title()} observation",
            recommendation=recommendation,
            audit_log=[{"event": "HUMAN_APPROVED", "source": "operator"}],
        )
        db.add(incident)
        db.flush()
        ticket = Ticket(incident=incident)
        db.add(ticket)
    db.commit()
    if ticket is None:
        raise HTTPException(409, "Approved incident has no cleanup ticket")
    return {"status": "APPROVED", "incident_id": incident.id, "ticket_id": ticket.id}


@app.get("/api/incidents")
def list_incidents(db: Session = Depends(get_db)) -> list[dict]:
    incidents = db.scalars(select(Incident).order_by(Incident.created_at.desc())).all()
    return [
        {
            "id": i.id,
            "status": i.status.value,
            "title": i.title,
            "recommendation": i.recommendation,
            "created_at": i.created_at,
            "latitude": i.observation.latitude,
            "longitude": i.observation.longitude,
            "category": i.observation.category,
            "severity": i.observation.severity,
            "confidence": i.observation.confidence,
            "ticket_id": i.ticket.id if i.ticket else None,
        }
        for i in incidents
    ]


@app.get("/api/tickets")
def list_tickets(db: Session = Depends(get_db)) -> list[dict]:
    tickets = db.scalars(select(Ticket).order_by(Ticket.created_at.desc())).all()
    return [
        {"id": t.id, "incident_id": t.incident_id, "status": t.status.value, "assignee": t.assignee}
        for t in tickets
    ]


@app.patch("/api/tickets/{ticket_id}")
def update_ticket(ticket_id: str, body: TicketUpdate, db: Session = Depends(get_db)) -> dict:
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(404, "Ticket not found")
    ticket.status = TicketStatus(body.status)
    ticket.assignee = body.assignee
    db.commit()
    return {"id": ticket.id, "status": ticket.status.value, "assignee": ticket.assignee}
