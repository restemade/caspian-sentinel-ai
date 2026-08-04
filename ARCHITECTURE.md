# Architecture

## Product boundary

Caspian Sentinel AI is a software MVP. It does not claim that a physical monitoring station has been manufactured or that demo observations are verified measurements from the Caspian Sea.

## Components

- **Web/PWA:** React, TypeScript and Vite. Captures images and geolocation, renders evidence, map, incidents and volunteer tickets.
- **API:** FastAPI with Pydantic validation and generated OpenAPI documentation.
- **Vision pipeline:** OpenCV performs deterministic quality checks, contour extraction and evidence rendering. Gemini Vision classifies environmental content and returns a strict structured assessment.
- **Workflow:** Every AI assessment requiring action enters human review. Approved assessments create incidents and tickets with an immutable audit trail.
- **Database:** PostgreSQL through SQLAlchemy and Alembic.
- **Deployment:** Nginx, Docker Compose and container health checks.

## Trust model

Gemini is used for semantic image understanding, not arithmetic, geometry or authoritative environmental diagnosis. OpenCV-derived regions are the only regions drawn in debug evidence. Low-confidence and unknown results remain in review and cannot automatically dispatch volunteers.

## Data classification

- `USER_SUBMITTED`: captured or uploaded by a user with consent.
- `DEMO`: bundled or generated for demonstration.
- `AI_INFERENCE`: non-authoritative model output.
- `HUMAN_VERIFIED`: explicitly reviewed by an operator.

