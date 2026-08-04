import base64
import json
from pathlib import Path

import cv2
import httpx
from pydantic import ValidationError

from .config import Settings
from .schemas import VisionAssessment


class VisionServiceError(RuntimeError):
    """The external semantic vision service was unavailable or returned invalid data."""


def analyze_cv(source: Path, evidence: Path) -> dict:
    image = cv2.imread(str(source))
    if image is None:
        raise ValueError("Unsupported or corrupted image")
    height, width = image.shape[:2]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blur_score = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    edges = cv2.Canny(gray, 70, 180)
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    significant = [c for c in contours if cv2.contourArea(c) >= width * height * 0.001]
    overlay = image.copy()
    boxes: list[dict] = []
    for contour in sorted(significant, key=cv2.contourArea, reverse=True)[:20]:
        x, y, w, h = cv2.boundingRect(contour)
        boxes.append({"x": x, "y": y, "width": w, "height": h})
        cv2.rectangle(overlay, (x, y), (x + w, y + h), (103, 232, 203), 3)
    result = cv2.addWeighted(image, 0.72, overlay, 0.28, 0)
    cv2.imwrite(str(evidence), result)
    return {
        "width": width,
        "height": height,
        "blur_score": round(blur_score, 2),
        "quality": "acceptable" if blur_score >= 45 else "blurry",
        "regions": boxes,
        "region_count": len(boxes),
    }


async def analyze_gemini(source: Path, settings: Settings) -> VisionAssessment:
    if not settings.gemini_api_key:
        return VisionAssessment(
            category="unknown",
            confidence=0,
            severity="unknown",
            summary="Gemini is not configured; operator review is required.",
            recommendation="Review the original image and classify the observation manually.",
            requires_human_review=True,
        )
    mime = "image/png" if source.suffix.lower() == ".png" else "image/jpeg"
    encoded = base64.b64encode(source.read_bytes()).decode("ascii")
    prompt = (
        "Analyze this Caspian Sea environmental observation. Return JSON only. "
        "Do not claim petroleum is confirmed from an image; use oil_like_surface_anomaly. "
        "Use category plastic_waste, oil_like_surface_anomaly, large_debris, dead_fish, "
        "wildlife, clean, or unknown. Include confidence 0..1, severity low/medium/high/critical/unknown, "
        "summary, objects, recommendation, and requires_human_review=true unless clearly clean. "
        "Write summary, object names and recommendation in Russian."
    )
    payload = {
        "contents": [{"parts": [{"text": prompt}, {"inline_data": {"mime_type": mime, "data": encoded}}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseJsonSchema": VisionAssessment.model_json_schema(),
        },
    }
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.gemini_model}:generateContent"
    try:
        async with httpx.AsyncClient(timeout=45) as client:
            response = await client.post(url, params={"key": settings.gemini_api_key}, json=payload)
            response.raise_for_status()
        raw = response.json()["candidates"][0]["content"]["parts"][0]["text"]
        return VisionAssessment.model_validate(json.loads(raw))
    except (httpx.HTTPError, KeyError, IndexError, json.JSONDecodeError, ValidationError) as exc:
        raise VisionServiceError("Gemini analysis failed validation") from exc
