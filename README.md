# Caspian Sentinel AI

Hackathon MVP by **Two Brothers Lab** for detecting, mapping and coordinating the cleanup of pollution in the Caspian Sea.

The core demonstrable workflow is:

`PWA camera -> OpenCV evidence -> Gemini Vision classification -> human review -> GIS incident -> volunteer ticket -> before/after closure`

AI output is advisory and requires operator confirmation before an incident is dispatched.

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

