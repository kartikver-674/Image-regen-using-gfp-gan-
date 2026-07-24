# M1 — Smart Engine + Local API — Design Spec

**Date:** 2026-07-25
**Status:** Approved (design), pending implementation plan
**Author:** kartikver-674
**Builds on:** M0 (engine extraction — GFPGAN 1.4 in-process behind `FaceRestorer`), merged to `main`.

## Summary

Enrich the M0 engine with a second face model (CodeFormer), a cheap analysis
stage, and a transparent rule-based router; then expose it through a **local
FastAPI** with an async job contract. This is the full spec-M1 "smart engine +
API" bundle, built **local-first** (Modal deploy is a later, separate milestone).

**Decisions locked in this brainstorm:**
- Scope: full bundle (smart engine **and** API) in M1.
- Deploy: **local FastAPI first**; Modal deferred. Same contract moves to Modal later.
- CodeFormer: **spike-first with graceful GFPGAN-only fallback** — the architecture is identical whether or not CodeFormer loads.
- Concurrency: **serialize jobs** (threadpool size 1); single local user.

## Part A — Engine enrichment

All additions sit **behind the existing `FaceRestorer` interface** and keep the
`engine/` package free of web/cloud imports.

### A1. Analysis (`engine/restore_engine/analysis.py`)
One cheap pass over a BGR image → an `Analysis` dataclass. No heavy model.
- `is_grayscale: bool` — channel-correlation / near-zero saturation heuristic.
- `blur_score: float` — variance of the Laplacian (higher = sharper).
- `width, height, megapixels`.
- `faces: list[FaceInfo]` — from facexlib detection: `bbox`, `det_score`, `crop_size`.
- Derived: `n_faces`, `min_face_size`, `heavy_blur` (threshold), `low_res` (threshold).
- Thresholds live in `config.py` (calibration knobs).
- *Known cost:* the restorer's `FaceRestoreHelper` detects faces again internally, so detection runs twice. Accepted for M1 (clean separation); a shared-detection optimization is a future note.

### A2. Router (`engine/restore_engine/router.py`)
Pure function `route(analysis: Analysis, options: RestoreOptions) -> RoutePlan`.
- **Manual mode:** honor `options.model` / `fidelity` / `upscale` / `background_upscale` verbatim.
- **Auto mode rules (transparent, ordered):**
  - no faces → face restore skipped; Real-ESRGAN only. Rationale: "no faces detected → background upscale only".
  - small or low-confidence faces (heavily degraded) → **CodeFormer**, fidelity ~0.7 (lean faithful). Rationale: "small/low-quality faces → CodeFormer (robust)".
  - clear faces → **GFPGAN**. Rationale: "clear faces → GFPGAN (natural)".
  - grayscale → set `colorize_recommended=True` (surfaced only; DDColor is deferred F2).
  - Real-ESRGAN background upscaling on unless disabled.
- **Fallback:** if CodeFormer is unavailable, every face route resolves to GFPGAN and the rationale notes the fallback.
- `RoutePlan`: `{ face_model, fidelity, upscale, background_upscale, colorize_recommended, rationale }`.

### A3. CodeFormer (`engine/restore_engine/models/codeformer_restorer.py`) — spike-gated
- Implements the same `FaceRestorer` ABC as GFPGAN (`name="codeformer"`, `device`, `restore(image_bgr) -> Restoration`).
- Fidelity `w` (0 = sharper/more invented ↔ 1 = faithful) set at construction; `build_codeformer_restorer(device=None, upscale=2, fidelity=0.7, use_bg_upsampler=True)`.
- **Spike is M1's first task**: prove CodeFormer runs in-process on the pinned stack (torch 2.1.2 / torchvision 0.16.2 / numpy<2) reusing facexlib's detect/align/paste-back, swapping the generator net. If it can't be made clean, the restorer registers as unavailable and the router falls back to GFPGAN. Milestone is never blocked by CodeFormer packaging.

### A4. Fidelity
Maps to CodeFormer's `w`. Meaningful for CodeFormer; **ignored for GFPGAN** (documented). Auto mode sets it via the router; manual mode takes it from the user.

### A5. Pipeline (`pipeline.py`, extended)
Add `restore_smart(image_bgr, options, restorers: dict[str, FaceRestorer], analyze=..., route=...) -> RestoreResult`:
analysis → router → select a **preloaded** restorer by `RoutePlan.face_model` → restore → attach `analysis` + `routing` to the result. Keeps dependency injection (fakes for tests). `restorers` is a name→instance dict built once and passed in (never constructed inside the pipeline).

### A6. Types (`types.py`, extended)
- `RestoreOptions(mode, model, fidelity, upscale, background_upscale)`.
- `FaceInfo(bbox, det_score, crop_size)`; `Analysis(...)` (fields above); `RoutePlan(...)`.
- `RestoreResult` gains `analysis: Analysis` and `routing: RoutePlan` (existing fields unchanged for back-compat).

## Part B — Local API (`api/`, new package)

`api/` is a **separate package that depends on `engine/`**; the engine gains no web deps. New deps: `fastapi`, `uvicorn`, `python-multipart`.

### B1. Contract (what the web app codes against; Modal-compatible later)
```
POST /jobs   (multipart/form-data)
  file:    <image>
  options: JSON string {
    mode: "auto" | "manual",
    model?: "gfpgan" | "codeformer",     // manual only
    fidelity?: 0.0..1.0,                  // codeformer
    upscale?: 2 | 4,
    background_upscale?: bool
  }
  → 202 { "job_id": "<uuid>" }

GET /jobs/{job_id}
  → {
      "status": "queued" | "running" | "done" | "error",
      "error": string | null,
      "result": null | {
        "restored_url": "/results/{job_id}/restored.png",
        "faces": [ { "index", "cropped_url", "restored_url", "comparison_url" } ],
        "analysis": { "is_grayscale", "blur_score", "width", "height", "n_faces", "min_face_size" },
        "routing":  { "model_used", "fidelity", "upscale", "background_upscale", "rationale" },
        "device": "cpu",
        "elapsed_s": 12.3
      }
    }

GET /results/{job_id}/{filename}     # served image files
GET /healthz                          # → { "ok": true }
```

### B2. Async jobs (in-process)
- `JobStore` = in-process dict `{job_id: {status, created, result, error}}`.
- On `POST /jobs`: validate + persist the upload, create `job_id`, enqueue work on a **bounded threadpool of size 1** (jobs serialize), return 202 immediately.
- Work runs `engine_service.run(job_id, input_path, options)` → `restore_smart` → writes outputs → updates job state.
- **No Celery/Redis** — in-process covers a single-user local service; Modal's `spawn` covers it in the cloud milestone.

### B3. Model lifecycle
Restorers are loaded **once at app startup** (FastAPI `lifespan`) into app state and shared across all jobs — never rebuilt per request. On startup, attempt to build both GFPGAN and (spike permitting) CodeFormer; record which loaded. `engine_service` holds the `restorers` dict + analysis/router functions.

### B4. Guardrails (spec cost-control, also prevents local hangs)
- Reject uploads over a size cap (config).
- Auto-downscale inputs above a max dimension before processing (Real-ESRGAN on CPU is slow / OOM-prone on large images).
- Per-job timeout → job marked `error` with a message.

### B5. Result serving
Outputs written to `results/{job_id}/` (restored image, per-face cropped/restored/comparison via the existing `io.write_outputs`). Served by FastAPI `StaticFiles` mounted at `/results`. (Presigned R2 URLs replace this in the Modal milestone; the contract's `*_url` fields are unchanged.)

## Testing
- **Engine (offline, fast):**
  - `analysis`: synthetic images — a grayscale array asserts `is_grayscale`; a blurred vs sharp array asserts `blur_score` ordering; dimension fields.
  - `router`: pure-function table — (no faces / small faces / clear faces / grayscale / manual overrides) → expected `RoutePlan` + rationale substring.
  - `codeformer_restorer`: mocked like the GFPGAN test (no weights); plus an "unavailable → fallback" path test.
  - `restore_smart`: fake restorers dict; asserts routing picks the right one and result carries analysis + routing.
- **API (offline, fast):** FastAPI `TestClient` with an **injected fake engine_service** (no real models). POST a tiny image → poll `GET /jobs/{id}` to `done` → assert payload shape, that `/results/...` files are served, and that `error` status is reported on a forced failure.
- CI stays CPU-only; real-model runs remain the manual `demo`.

## New / changed files
```
engine/restore_engine/analysis.py                        (new)
engine/restore_engine/router.py                          (new)
engine/restore_engine/models/codeformer_restorer.py      (new, spike-gated)
engine/restore_engine/pipeline.py                        (+ restore_smart)
engine/restore_engine/types.py                           (+ RestoreOptions, FaceInfo, Analysis, RoutePlan; RestoreResult += analysis, routing)
engine/restore_engine/config.py                          (+ analysis thresholds, guardrail limits, codeformer weights URL)
engine/tests/test_analysis.py  test_router.py  test_codeformer_restorer.py  test_restore_smart.py   (new)
api/pyproject.toml                                       (new; depends on restore-engine, fastapi, uvicorn, python-multipart)
api/app.py            (FastAPI + lifespan model-load + routes + StaticFiles)
api/jobs.py           (JobStore + bounded threadpool execution)
api/engine_service.py (holds restorers; analysis→router→restore; writes outputs)
api/tests/test_api.py (TestClient + injected fake engine_service)
```

## Out of scope for M1 (recorded)
Modal deployment (next milestone), colorization/DDColor (F2 — only the grayscale *flag* is surfaced), batch/album (F1), auth/history (F3), scratch inpainting (F4), IQA scoring (F5), the web app itself (M2).

## Risks
1. **CodeFormer packaging** (primary) — mitigated by spike-first + GFPGAN-only fallback.
2. **CPU latency** on large images — mitigated by input downscaling + serialized jobs + per-job timeout.
3. **Double face detection** (analysis + restorer) — accepted; optimization deferred.
