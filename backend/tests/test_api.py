from io import BytesIO

from fastapi.testclient import TestClient
from PIL import Image, ImageDraw

from app.main import app

client = TestClient(app)


def sample_image() -> bytes:
    image = Image.new("RGB", (640, 480), "#174c55")
    draw = ImageDraw.Draw(image)
    draw.rectangle((180, 130, 430, 310), fill="#e4e8d8", outline="#ffffff", width=8)
    stream = BytesIO()
    image.save(stream, format="JPEG")
    return stream.getvalue()


def test_health() -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_observation_to_incident_workflow() -> None:
    response = client.post(
        "/api/observations",
        data={"latitude": "43.635", "longitude": "51.168", "source": "DEMO"},
        files={"image": ("demo.jpg", sample_image(), "image/jpeg")},
    )
    assert response.status_code == 201, response.text
    observation = response.json()
    assert observation["status"] == "REVIEW"
    assert observation["evidence_url"]
    assert observation["cv_metrics"]["region_count"] >= 1

    reanalysis = client.post(f"/api/observations/{observation['id']}/reanalyze")
    assert reanalysis.status_code == 200
    assert reanalysis.json()["category"]

    review = client.post(
        f"/api/observations/{observation['id']}/review",
        json={"approved": True, "recommendation": "Inspect and remove the reported waste."},
    )
    assert review.status_code == 200, review.text
    assert review.json()["incident_id"]
    assert review.json()["ticket_id"]

    incidents = client.get("/api/incidents").json()
    tickets = client.get("/api/tickets").json()
    assert any(item["id"] == review.json()["incident_id"] for item in incidents)
    assert any(item["id"] == review.json()["ticket_id"] for item in tickets)

    ticket_id = review.json()["ticket_id"]
    assigned = client.patch(
        f"/api/tickets/{ticket_id}",
        json={"status": "ASSIGNED", "assignee": "Volunteer Demo"},
    )
    assert assigned.status_code == 200
    assert assigned.json()["status"] == "ASSIGNED"

    evidence = client.post(
        f"/api/tickets/{ticket_id}/evidence",
        files={"image": ("after.jpg", sample_image(), "image/jpeg")},
    )
    assert evidence.status_code == 200, evidence.text
    assert evidence.json()["status"] == "COMPLETED"
    assert evidence.json()["after_url"]

    verified = client.patch(
        f"/api/tickets/{ticket_id}",
        json={"status": "VERIFIED", "assignee": "Volunteer Demo"},
    )
    assert verified.status_code == 200
    assert verified.json()["status"] == "VERIFIED"


def test_rejects_non_image() -> None:
    response = client.post(
        "/api/observations",
        data={"latitude": "43.635", "longitude": "51.168"},
        files={"image": ("bad.txt", b"not an image", "text/plain")},
    )
    assert response.status_code == 415
