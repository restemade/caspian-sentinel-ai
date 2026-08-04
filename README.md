# Caspian Sentinel AI

Hackathon MVP by **Two Brothers Lab** for detecting, mapping and coordinating the cleanup of pollution in the Caspian Sea.

The core demonstrable workflow is:

`PWA camera -> OpenCV evidence -> Gemini Vision classification -> human review -> GIS incident -> volunteer ticket -> before/after closure`

All environmental observations in the demo environment are user-submitted or explicitly marked demonstration data. AI output is advisory and never confirms petroleum contamination without human review.

## Status

Active hackathon development started on 5 August 2026 after publication of the official technical assignment. This repository does not contain code, assets or history from the earlier concept prototype.

## Quick start

1. Copy `.env.example` to `.env` and set a strong database password.
2. Optionally set `GEMINI_API_KEY` for live vision classification.
3. Run:

```bash
docker compose up -d --build
```

Open:

- Application: <http://localhost:8080>
- API: <http://localhost:8080/api>
- Swagger: <http://localhost:8080/docs>
- Health: <http://localhost:8080/api/health>

## Safety

Never commit `.env`, API keys, SSH credentials, private user photographs or production database dumps.

Detailed architecture and implementation milestones are documented in [ARCHITECTURE.md](ARCHITECTURE.md) and [PLAN.md](PLAN.md).

