import io as _io
import json
import time

import numpy as np
from fastapi.testclient import TestClient
from PIL import Image

from restore_api.app import create_app


class FakeService:
    """Stands in for EngineService — writes a fake restored file, no models."""
    codeformer_available = True

    def run(self, input_path, options, output_dir):
        from restore_engine.types import Analysis, RestoreResult, RoutePlan
        img = np.full((8, 8, 3), 30, dtype=np.uint8)
        result = RestoreResult(
            input_path=str(input_path), restored_image=img, faces=[], model="gfpgan",
            device="cpu", elapsed_s=0.1,
            analysis=Analysis(8, 8, 0.0, False, 100.0, []),
            routing=RoutePlan("gfpgan", None, 2, True, False, "test"),
        )
        from restore_engine.pipeline import write_outputs
        write_outputs(result, output_dir)
        return result


def _png_bytes():
    buf = _io.BytesIO()
    Image.new("RGB", (8, 8), (10, 20, 30)).save(buf, format="PNG")
    return buf.getvalue()


def _client(tmp_path):
    app = create_app(service=FakeService(), results_root=tmp_path / "results")
    return TestClient(app)


def test_healthz(tmp_path):
    assert _client(tmp_path).get("/healthz").json() == {"ok": True}


def test_post_job_then_poll_to_done(tmp_path):
    c = _client(tmp_path)
    resp = c.post("/jobs",
                  files={"file": ("in.png", _png_bytes(), "image/png")},
                  data={"options": json.dumps({"mode": "auto"})})
    assert resp.status_code == 202
    jid = resp.json()["job_id"]

    for _ in range(50):
        body = c.get(f"/jobs/{jid}").json()
        if body["status"] in ("done", "error"):
            break
        time.sleep(0.05)
    assert body["status"] == "done"
    assert body["result"]["routing"]["model_used"] == "gfpgan"
    restored_url = body["result"]["restored_url"]
    assert c.get(restored_url).status_code == 200  # served file


def test_get_unknown_job_404(tmp_path):
    assert _client(tmp_path).get("/jobs/nope").status_code == 404


def test_rejects_oversize_upload(tmp_path):
    c = _client(tmp_path)
    big = b"x" * (26 * 1024 * 1024 + 1)
    resp = c.post("/jobs", files={"file": ("big.png", big, "image/png")},
                  data={"options": json.dumps({"mode": "auto"})})
    assert resp.status_code == 413


def test_rejects_bad_options_json(tmp_path):
    c = _client(tmp_path)
    resp = c.post("/jobs",
                  files={"file": ("in.png", _png_bytes(), "image/png")},
                  data={"options": "{not valid json"})
    assert resp.status_code == 422


def test_path_traversal_filename_stays_in_job_dir(tmp_path):
    results_root = tmp_path / "results"
    c = TestClient(create_app(service=FakeService(), results_root=results_root))
    resp = c.post("/jobs",
                  files={"file": ("../../evil.png", _png_bytes(), "image/png")},
                  data={"options": json.dumps({"mode": "auto"})})
    assert resp.status_code == 202
    jid = resp.json()["job_id"]

    body = {}
    for _ in range(50):
        body = c.get(f"/jobs/{jid}").json()
        if body["status"] in ("done", "error"):
            break
        time.sleep(0.05)
    assert body["status"] == "done"

    # The sanitized basename may legitimately land inside the job dir under
    # results_root — that's fine. What must NOT happen is escaping above
    # results_root (e.g. straight into tmp_path via "../../evil.png").
    assert not (tmp_path / "evil.png").exists()
    escaped = [p for p in tmp_path.rglob("evil.png") if results_root not in p.parents]
    assert escaped == [], f"path traversal wrote outside results_root: {escaped}"
    # And it did land where expected: inside this job's own directory.
    assert (results_root / jid / "evil.png").exists()
