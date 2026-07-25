"""Local FastAPI over the restoration engine. Async jobs, static result files."""
from __future__ import annotations

import json
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from restore_api.engine_service import EngineService
from restore_api.jobs import JobRunner, JobStore
from restore_engine import config
from restore_engine.types import RestoreOptions


def _result_payload(job_id: str, result) -> dict:
    base = f"/results/{job_id}"
    faces = [
        {
            "index": f.index,
            "cropped_url": f"{base}/cropped_faces/{Path(result.input_path).stem}_{f.index:02d}.png",
            "restored_url": f"{base}/restored_faces/{Path(result.input_path).stem}_{f.index:02d}.png",
            "comparison_url": f"{base}/comparisons/{Path(result.input_path).stem}_{f.index:02d}.png",
        }
        for f in result.faces
    ]
    return {
        "restored_url": f"{base}/restored_imgs/{Path(result.input_path).stem}.png",
        "faces": faces,
        "analysis": {
            "is_grayscale": result.analysis.is_grayscale,
            "blur_score": result.analysis.blur_score,
            "width": result.analysis.width,
            "height": result.analysis.height,
            "n_faces": result.analysis.n_faces,
            "min_face_size": result.analysis.min_face_size,
        },
        "routing": {
            "model_used": result.routing.face_model,
            "fidelity": result.routing.fidelity,
            "upscale": result.routing.upscale,
            "background_upscale": result.routing.background_upscale,
            "rationale": result.routing.rationale,
        },
        "device": result.device,
        "elapsed_s": result.elapsed_s,
    }


def create_app(service=None, results_root=None) -> FastAPI:
    results_root = Path(results_root or "results")
    results_root.mkdir(parents=True, exist_ok=True)
    store = JobStore()
    state: dict = {"service": service, "runner": None}

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        svc = state["service"] or EngineService()
        state["service"] = svc
        state["runner"] = JobRunner(svc, store, max_workers=1)
        yield
        state["runner"].shutdown(wait=False)

    app = FastAPI(lifespan=lifespan)
    app.mount("/results", StaticFiles(directory=str(results_root)), name="results")

    @app.get("/healthz")
    def healthz():
        return {"ok": True}

    @app.post("/jobs", status_code=202)
    async def create_job(file: UploadFile = File(...), options: str = Form("{}")):  # noqa: B008 (FastAPI idiom)
        data = await file.read()
        if len(data) > config.MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="file too large")
        try:
            opts = RestoreOptions(**json.loads(options))
        except (json.JSONDecodeError, TypeError) as exc:
            raise HTTPException(status_code=422, detail=f"bad options: {exc}") from exc

        jid = store.create()
        job_dir = results_root / jid
        job_dir.mkdir(parents=True, exist_ok=True)
        input_path = job_dir / (file.filename or "input.png")
        input_path.write_bytes(data)

        runner = state["runner"] or JobRunner(state["service"] or EngineService(), store, 1)
        state["runner"] = runner
        runner.submit(jid, input_path, opts, job_dir)
        return {"job_id": jid}

    @app.get("/jobs/{job_id}")
    def get_job(job_id: str):
        rec = store.get(job_id)
        if rec is None:
            raise HTTPException(status_code=404, detail="unknown job")
        result = rec["result"]
        payload = _result_payload(job_id, result) if rec["status"] == "done" else None
        return JSONResponse({"status": rec["status"], "error": rec["error"], "result": payload})

    return app
