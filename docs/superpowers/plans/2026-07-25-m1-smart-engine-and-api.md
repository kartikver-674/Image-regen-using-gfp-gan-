# M1 — Smart Engine + Local API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich the M0 engine with CodeFormer + a cheap analysis stage + a transparent rule router, then expose it via a local FastAPI with an async job contract.

**Architecture:** Engine additions sit behind the existing `FaceRestorer` ABC and keep `engine/` web-free. Analysis and the router are pure/injectable and unit-tested without models. A new `api/` package depends on the engine, loads restorers once at startup, runs jobs on a size-1 threadpool, and serves results as static files. Everything is tested offline with fakes; real models run only in manual/controller smoke checks.

**Tech Stack:** Python 3.11 (venv at repo root `.venv`), PyTorch 2.1.2, GFPGAN, CodeFormer, Real-ESRGAN, facexlib, OpenCV; FastAPI + uvicorn + python-multipart; pytest + ruff.

## Global Constraints

- Work on branch `feat/m1-smart-engine-api` (already checked out).
- Python 3.11 venv at repo root `.venv` (activate: `source .venv/bin/activate`); system Python 3.14 is INCOMPATIBLE. Deps pinned `numpy<2`, `torch<2.2`, `torchvision<0.17`.
- **`engine/` has NO web/cloud imports.** FastAPI/uvicorn live only in `api/`.
- **`api/` depends on `engine/`** (path/editable install), never the reverse.
- All new model-backed code is **unit-tested with mocks/fakes** — no weight downloads in the test suite. Real-model runs are the manual `demo`/controller smoke.
- **Restorers are loaded once and cached**, never rebuilt per request.
- **Jobs serialize** (threadpool size 1).
- **No Celery/Redis** — in-process job store only.
- Ruff config already pins `known-third-party = ["gfpgan"]`; keep the lint gate green (`ruff check .` from `engine/`; add an equivalent for `api/`).
- TDD, one behavior per test, frequent commits.
- CodeFormer is **spike-first with GFPGAN-only fallback**: if it can't run cleanly in-process, the router routes GFPGAN only and marks CodeFormer unavailable. The rest of the architecture is identical either way.

---

### Task 1: CodeFormer spike (go / no-go) + restorer

> **This is an exploratory spike, not transcription.** Its purpose is to DISCOVER the correct in-process CodeFormer wiring on the pinned stack. Provide the mocked test (given below) and the restorer following the same shape as `GfpganRestorer`; the exact generator-loading lines are what the spike determines. If it cannot be made to work cleanly, deliver the "unavailable" outcome and STOP — do not fight it for hours.

**Files:**
- Create: `engine/restore_engine/models/codeformer_restorer.py`
- Create: `engine/tests/test_codeformer_restorer.py`
- Modify: `engine/restore_engine/config.py` (add `CODEFORMER_URL`)

**Interfaces:**
- Consumes: `models.base.FaceRestorer`; `types.FaceResult, Restoration`; `config.select_device`, `config.REALESRGAN_X2_URL`.
- Produces:
  - `models.codeformer_restorer.build_codeformer_restorer(device: str | None = None, upscale: int = 2, use_bg_upsampler: bool = True) -> CodeformerRestorer | None` — returns `None` if CodeFormer cannot be loaded on this machine (caller treats as unavailable).
  - `models.codeformer_restorer.CodeformerRestorer` — implements `FaceRestorer` (`name = "codeformer"`), `restore(self, image_bgr, fidelity: float | None = 0.5) -> Restoration`.

- [ ] **Step 1: Research the in-process path.** CodeFormer has no clean official pip package. Reuse the SAME `facexlib.utils.face_restoration_helper.FaceRestoreHelper` that GFPGAN uses (detect → align → restore → paste-back) and swap the generator to the CodeFormer network. Candidate sources for the net + weights (verify which installs cleanly with torch 2.1.2 / torchvision 0.16.2 / numpy<2, in the `.venv`):
  - the `basicsr`-registered `CodeFormer` arch (already have basicsr), loading weights from `CODEFORMER_URL = "https://github.com/sczhou/CodeFormer/releases/download/v0.1.0/codeformer.pth"`; OR
  - a maintained pip wrapper if one imports cleanly on the pinned stack.
  Try to import/instantiate the net and load weights. Time-box this.

- [ ] **Step 2: Write the mocked unit test** (mirrors the GFPGAN test — no weights):

```python
# engine/tests/test_codeformer_restorer.py
from unittest.mock import MagicMock, patch

import numpy as np

from restore_engine.models import codeformer_restorer as cr


def test_build_and_restore_maps_output_and_passes_fidelity():
    # Fake the underlying restore machinery the CodeformerRestorer wraps.
    # Whatever object the spike settles on, the restorer must expose it as a
    # patchable module-level name so this test can substitute a fake that
    # returns (cropped_faces, restored_faces, restored_img).
    face = np.zeros((4, 4, 3), dtype=np.uint8)
    fake_engine = MagicMock()
    fake_engine.enhance.return_value = ([face], [face + 1], np.zeros((16, 16, 3), np.uint8))

    with patch.object(cr, "_build_engine", return_value=fake_engine):
        r = cr.build_codeformer_restorer(device="cpu", use_bg_upsampler=False)
        assert r is not None
        out = r.restore(np.zeros((8, 8, 3), dtype=np.uint8), fidelity=0.7)

    assert r.name == "codeformer"
    assert out.model == "codeformer"
    assert out.restored_image.shape == (16, 16, 3)
    assert len(out.faces) == 1
    assert np.array_equal(out.faces[0].cropped, face)
    assert np.array_equal(out.faces[0].restored, face + 1)
    # fidelity was forwarded to the enhance call (w / weight kwarg)
    _, kwargs = fake_engine.enhance.call_args
    assert 0.7 in kwargs.values()
```

- [ ] **Step 3: Run it to verify it fails** — `cd engine && python -m pytest tests/test_codeformer_restorer.py -v` → FAIL (module missing).

- [ ] **Step 4: Implement `codeformer_restorer.py`** following the `GfpganRestorer` shape: a module-level `_build_engine(device, upscale, use_bg_upsampler)` that constructs the CodeFormer inference object (the part the spike discovered), a `CodeformerRestorer(FaceRestorer)` whose `restore(image_bgr, fidelity=0.5)` calls the engine's enhance with the fidelity weight and maps `(cropped, restored, restored_img)` → `Restoration(model="codeformer")`, and `build_codeformer_restorer(...)` that returns the restorer or **`None` on any import/load failure** (catch, log, return None). Add `CODEFORMER_URL` to `config.py`.

- [ ] **Step 5: Run the mocked test** → PASS (`cd engine && python -m pytest tests/test_codeformer_restorer.py -v`).

- [ ] **Step 6: Commit.**
```bash
git add engine/restore_engine/models/codeformer_restorer.py engine/tests/test_codeformer_restorer.py engine/restore_engine/config.py
git commit -m "feat(engine): CodeFormer restorer (spike) behind FaceRestorer + fallback build"
```

- [ ] **Step 7: Report the spike outcome** in the task report: did a real in-process CodeFormer run succeed (the controller will attempt a real one-image smoke), or should the router treat CodeFormer as unavailable? Either outcome is a valid DONE — say which, with the evidence (import errors, versions tried).

---

### Task 2: New types + config thresholds

**Files:**
- Modify: `engine/restore_engine/types.py`
- Modify: `engine/restore_engine/config.py`
- Test: `engine/tests/test_types.py` (new)

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `types.RestoreOptions(mode="auto", model=None, fidelity=0.7, upscale=2, background_upscale=True)`.
  - `types.FaceInfo(bbox, det_score, crop_size)`.
  - `types.Analysis(width, height, megapixels, is_grayscale, blur_score, faces)` with properties `n_faces`, `min_face_size`.
  - `types.RoutePlan(face_model, fidelity, upscale, background_upscale, colorize_recommended, rationale)`.
  - `types.RestoreResult` gains `analysis: Analysis | None = None`, `routing: RoutePlan | None = None`.
  - `config` gains: `CODEFORMER_URL` (if not added in Task 1), `BLUR_SHARP_THRESHOLD=100.0`, `SMALL_FACE_PX=256`, `LOW_DET_SCORE=0.85`, `GRAYSCALE_SAT_THRESHOLD=10.0`, `MAX_UPLOAD_BYTES=26214400`, `MAX_INPUT_DIM=2000`, `JOB_TIMEOUT_S=300`.

- [ ] **Step 1: Write the failing test**

```python
# engine/tests/test_types.py
from restore_engine.types import Analysis, FaceInfo, RestoreOptions, RoutePlan


def test_restore_options_defaults():
    o = RestoreOptions()
    assert o.mode == "auto" and o.model is None and o.upscale == 2
    assert o.fidelity == 0.7 and o.background_upscale is True


def test_analysis_face_properties():
    a = Analysis(width=100, height=50, megapixels=0.005, is_grayscale=False, blur_score=42.0,
                 faces=[FaceInfo(bbox=(0, 0, 20, 20), det_score=0.9, crop_size=20),
                        FaceInfo(bbox=(0, 0, 60, 60), det_score=0.99, crop_size=60)])
    assert a.n_faces == 2 and a.min_face_size == 20


def test_analysis_no_faces_min_size_zero():
    a = Analysis(width=10, height=10, megapixels=0.0001, is_grayscale=True, blur_score=1.0, faces=[])
    assert a.n_faces == 0 and a.min_face_size == 0


def test_routeplan_construct():
    p = RoutePlan(face_model="gfpgan", fidelity=None, upscale=2, background_upscale=True,
                  colorize_recommended=False, rationale="clear faces → GFPGAN (natural)")
    assert p.face_model == "gfpgan" and "GFPGAN" in p.rationale
```

- [ ] **Step 2: Run to verify it fails** — `cd engine && python -m pytest tests/test_types.py -v` → FAIL (imports missing).

- [ ] **Step 3: Implement.** Append to `types.py`:

```python
@dataclass
class RestoreOptions:
    mode: str = "auto"              # "auto" | "manual"
    model: str | None = None        # "gfpgan" | "codeformer" (manual only)
    fidelity: float = 0.7           # CodeFormer w (0=sharper/invented .. 1=faithful)
    upscale: int = 2
    background_upscale: bool = True


@dataclass
class FaceInfo:
    bbox: tuple[float, float, float, float]
    det_score: float
    crop_size: int                  # min(width, height) of the detected box, px


@dataclass
class Analysis:
    width: int
    height: int
    megapixels: float
    is_grayscale: bool
    blur_score: float
    faces: list[FaceInfo]

    @property
    def n_faces(self) -> int:
        return len(self.faces)

    @property
    def min_face_size(self) -> int:
        return min((f.crop_size for f in self.faces), default=0)


@dataclass
class RoutePlan:
    face_model: str                 # "gfpgan" | "codeformer"
    fidelity: float | None
    upscale: int
    background_upscale: bool
    colorize_recommended: bool
    rationale: str
```

Add to the existing `RestoreResult` dataclass (with defaults so M0 callers are unaffected):
```python
    analysis: "Analysis | None" = None
    routing: "RoutePlan | None" = None
```
Append the `config.py` constants listed in Interfaces (skip `CODEFORMER_URL` if Task 1 already added it).

- [ ] **Step 4: Run to verify pass** — `cd engine && python -m pytest tests/test_types.py -v` → PASS.

- [ ] **Step 5: Commit.**
```bash
git add engine/restore_engine/types.py engine/restore_engine/config.py engine/tests/test_types.py
git commit -m "feat(engine): analysis/routing/options types + thresholds"
```

---

### Task 3: Analysis stage

**Files:**
- Create: `engine/restore_engine/analysis.py`
- Test: `engine/tests/test_analysis.py`

**Interfaces:**
- Consumes: `config`, `types.Analysis, FaceInfo`.
- Produces:
  - `analysis.is_grayscale(image_bgr, sat_threshold=None) -> bool`
  - `analysis.blur_score(image_bgr) -> float`
  - `analysis.analyze(image_bgr, detector) -> Analysis` — `detector` is a callable `(image_bgr) -> list[tuple[bbox, det_score]]` (injected; the real one is built lazily by `build_face_detector`).
  - `analysis.build_face_detector(device: str | None = None) -> Callable[[np.ndarray], list[tuple]]` — wraps facexlib RetinaFace; NOT exercised by unit tests.

- [ ] **Step 1: Write the failing test**

```python
# engine/tests/test_analysis.py
import cv2
import numpy as np

from restore_engine import analysis


def test_is_grayscale_true_for_gray_image():
    gray = np.full((32, 32, 3), 128, dtype=np.uint8)  # equal channels => no saturation
    assert analysis.is_grayscale(gray) is True


def test_is_grayscale_false_for_colorful_image():
    img = np.zeros((32, 32, 3), dtype=np.uint8)
    img[..., 2] = 255  # saturated red (BGR)
    assert analysis.is_grayscale(img) is False


def test_blur_score_higher_for_sharp_than_blurred():
    sharp = np.zeros((64, 64, 3), dtype=np.uint8)
    sharp[::4, :] = 255  # high-frequency stripes
    blurred = cv2.GaussianBlur(sharp, (9, 9), 5)
    assert analysis.blur_score(sharp) > analysis.blur_score(blurred)


def test_analyze_uses_injected_detector():
    img = np.zeros((50, 100, 3), dtype=np.uint8)

    def fake_detector(_image):
        return [((0, 0, 20, 20), 0.9), ((0, 0, 60, 60), 0.99)]

    a = analysis.analyze(img, fake_detector)
    assert a.width == 100 and a.height == 50
    assert a.n_faces == 2 and a.min_face_size == 20
    assert a.faces[0].det_score == 0.9
```

- [ ] **Step 2: Run to verify it fails** — `cd engine && python -m pytest tests/test_analysis.py -v` → FAIL.

- [ ] **Step 3: Implement `analysis.py`**

```python
"""Cheap input analysis that feeds the router (no heavy model except an injected detector)."""
from __future__ import annotations

from collections.abc import Callable

import cv2
import numpy as np

from restore_engine import config
from restore_engine.types import Analysis, FaceInfo


def is_grayscale(image_bgr: np.ndarray, sat_threshold: float | None = None) -> bool:
    thr = config.GRAYSCALE_SAT_THRESHOLD if sat_threshold is None else sat_threshold
    hsv = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2HSV)
    return float(hsv[..., 1].mean()) < thr


def blur_score(image_bgr: np.ndarray) -> float:
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def analyze(image_bgr: np.ndarray, detector: Callable) -> Analysis:
    h, w = image_bgr.shape[:2]
    faces = []
    for bbox, score in detector(image_bgr):
        x1, y1, x2, y2 = bbox
        crop = int(min(x2 - x1, y2 - y1))
        faces.append(FaceInfo(bbox=tuple(bbox), det_score=float(score), crop_size=crop))
    return Analysis(
        width=w, height=h, megapixels=round(w * h / 1e6, 3),
        is_grayscale=is_grayscale(image_bgr), blur_score=blur_score(image_bgr), faces=faces,
    )


def build_face_detector(device: str | None = None) -> Callable:
    """Lazily build a facexlib RetinaFace detector -> callable returning [(bbox, score), ...].

    Not exercised by unit tests (tests inject a fake). Verify the facexlib return
    shape at integration time: RetinaFace.detect_faces returns an (N, 15) array
    where cols 0-3 are the bbox and col 4 is the score.
    """
    from facexlib.detection import init_detection_model

    dev = config.select_device(device)
    model = init_detection_model("retinaface_resnet50", half=False, device=dev)

    def detect(image_bgr: np.ndarray) -> list[tuple]:
        dets = model.detect_faces(image_bgr, 0.97)
        return [((d[0], d[1], d[2], d[3]), d[4]) for d in dets]

    return detect
```

- [ ] **Step 4: Run to verify pass** — `cd engine && python -m pytest tests/test_analysis.py -v` → PASS.

- [ ] **Step 5: Commit.**
```bash
git add engine/restore_engine/analysis.py engine/tests/test_analysis.py
git commit -m "feat(engine): input analysis (grayscale/blur/faces) with injectable detector"
```

---

### Task 4: Rule router

**Files:**
- Create: `engine/restore_engine/router.py`
- Test: `engine/tests/test_router.py`

**Interfaces:**
- Consumes: `config`, `types.Analysis, FaceInfo, RestoreOptions, RoutePlan`.
- Produces: `router.route(analysis: Analysis, options: RestoreOptions, codeformer_available: bool = True) -> RoutePlan`.

- [ ] **Step 1: Write the failing test**

```python
# engine/tests/test_router.py
from restore_engine import router
from restore_engine.types import Analysis, FaceInfo, RestoreOptions


def _analysis(faces, blur=500.0, gray=False, w=800, h=600):
    return Analysis(width=w, height=h, megapixels=round(w * h / 1e6, 3),
                    is_grayscale=gray, blur_score=blur, faces=faces)


def _face(size, score=0.99):
    return FaceInfo(bbox=(0, 0, size, size), det_score=score, crop_size=size)


def test_no_faces_routes_background_only():
    p = router.route(_analysis([]), RestoreOptions())
    assert p.face_model == "gfpgan"
    assert "no faces" in p.rationale.lower()


def test_clear_faces_route_gfpgan():
    p = router.route(_analysis([_face(500)]), RestoreOptions())
    assert p.face_model == "gfpgan" and p.fidelity is None
    assert "gfpgan" in p.rationale.lower()


def test_small_faces_route_codeformer_when_available():
    p = router.route(_analysis([_face(100)]), RestoreOptions(), codeformer_available=True)
    assert p.face_model == "codeformer" and p.fidelity is not None
    assert "codeformer" in p.rationale.lower()


def test_degraded_faces_fall_back_to_gfpgan_when_codeformer_unavailable():
    p = router.route(_analysis([_face(100)]), RestoreOptions(), codeformer_available=False)
    assert p.face_model == "gfpgan"
    assert "unavailable" in p.rationale.lower()


def test_manual_mode_honors_user_model():
    p = router.route(_analysis([_face(500)]),
                     RestoreOptions(mode="manual", model="codeformer", fidelity=0.3, upscale=4),
                     codeformer_available=True)
    assert p.face_model == "codeformer" and p.fidelity == 0.3 and p.upscale == 4


def test_grayscale_sets_colorize_recommended():
    p = router.route(_analysis([_face(500)], gray=True), RestoreOptions())
    assert p.colorize_recommended is True
```

- [ ] **Step 2: Run to verify it fails** — `cd engine && python -m pytest tests/test_router.py -v` → FAIL.

- [ ] **Step 3: Implement `router.py`**

```python
"""Transparent, rule-based model selection. Pure function; returns a plan + rationale."""
from __future__ import annotations

from restore_engine import config
from restore_engine.types import Analysis, RestoreOptions, RoutePlan


def route(analysis: Analysis, options: RestoreOptions, codeformer_available: bool = True) -> RoutePlan:
    upscale = options.upscale
    bg = options.background_upscale
    colorize = analysis.is_grayscale

    def plan(model, fidelity, rationale):
        return RoutePlan(face_model=model, fidelity=fidelity, upscale=upscale,
                         background_upscale=bg, colorize_recommended=colorize, rationale=rationale)

    if options.mode == "manual":
        model = options.model or "gfpgan"
        if model == "codeformer" and not codeformer_available:
            return plan("gfpgan", None, "manual: CodeFormer unavailable → GFPGAN")
        fidelity = options.fidelity if model == "codeformer" else None
        return plan(model, fidelity, f"manual: {model}")

    if analysis.n_faces == 0:
        return plan("gfpgan", None, "no faces detected → background upscale only (Real-ESRGAN)")

    degraded = (
        analysis.min_face_size < config.SMALL_FACE_PX
        or min(f.det_score for f in analysis.faces) < config.LOW_DET_SCORE
        or analysis.blur_score < config.BLUR_SHARP_THRESHOLD
    )
    if degraded:
        if codeformer_available:
            return plan("codeformer", 0.7, "small/low-quality faces → CodeFormer (robust)")
        return plan("gfpgan", None, "degraded faces but CodeFormer unavailable → GFPGAN")
    return plan("gfpgan", None, "clear faces → GFPGAN (natural)")
```

- [ ] **Step 4: Run to verify pass** — `cd engine && python -m pytest tests/test_router.py -v` → PASS.

- [ ] **Step 5: Commit.**
```bash
git add engine/restore_engine/router.py engine/tests/test_router.py
git commit -m "feat(engine): transparent rule-based model router"
```

---

### Task 5: `FaceRestorer.restore` fidelity param + `restore_smart` pipeline

**Files:**
- Modify: `engine/restore_engine/models/base.py` (add `fidelity` param)
- Modify: `engine/restore_engine/models/gfpgan_restorer.py` (accept + ignore `fidelity`)
- Modify: `engine/restore_engine/pipeline.py` (add `restore_smart`)
- Test: `engine/tests/test_restore_smart.py`

**Interfaces:**
- Consumes: `analysis.analyze`, `router.route`, `io`, `types.RestoreOptions, RestoreResult, Restoration`.
- Produces:
  - `base.FaceRestorer.restore(self, image_bgr, fidelity: float | None = None) -> Restoration` (signature change; default keeps existing callers working).
  - `pipeline.restore_smart(path, options, get_restorer, detector, output_dir=None, codeformer_available=True) -> RestoreResult` — `get_restorer` is a callable `(model: str, upscale: int) -> FaceRestorer` (injected; api supplies the caching impl).

- [ ] **Step 1: Write the failing test**

```python
# engine/tests/test_restore_smart.py
import numpy as np

from restore_engine import pipeline
from restore_engine.io import write_image
from restore_engine.models.base import FaceRestorer
from restore_engine.types import FaceResult, Restoration, RestoreOptions


class RecordingRestorer(FaceRestorer):
    def __init__(self, name):
        self.name = name
        self.device = "cpu"
        self.last_fidelity = "unset"

    def restore(self, image_bgr, fidelity=None):
        self.last_fidelity = fidelity
        f = FaceResult(index=0, cropped=image_bgr.copy(), restored=image_bgr.copy())
        return Restoration(restored_image=image_bgr.copy(), faces=[f], model=self.name)


def _img(tmp_path):
    p = tmp_path / "in.png"
    write_image(np.full((16, 16, 3), 90, dtype=np.uint8), p)
    return p


def test_restore_smart_routes_and_attaches_metadata(tmp_path):
    gfpgan = RecordingRestorer("gfpgan")
    codeformer = RecordingRestorer("codeformer")
    restorers = {"gfpgan": gfpgan, "codeformer": codeformer}

    # detector reports one tiny (degraded) face -> router picks codeformer
    def detector(_img):
        return [((0, 0, 30, 30), 0.99)]

    def get_restorer(model, upscale):
        return restorers[model]

    result = pipeline.restore_smart(
        _img(tmp_path), RestoreOptions(mode="auto"), get_restorer, detector,
        codeformer_available=True,
    )
    assert result.model == "codeformer"
    assert result.routing.face_model == "codeformer"
    assert codeformer.last_fidelity == 0.7        # router-chosen fidelity forwarded
    assert result.analysis.n_faces == 1
    assert result.device == "cpu" and result.elapsed_s >= 0


def test_restore_smart_writes_outputs(tmp_path):
    def detector(_img):
        return [((0, 0, 500, 500), 0.99)]  # clear face -> gfpgan

    r = RecordingRestorer("gfpgan")
    out = tmp_path / "out"
    pipeline.restore_smart(_img(tmp_path), RestoreOptions(), lambda m, u: r, detector,
                           output_dir=out, codeformer_available=False)
    assert (out / "restored_imgs").is_dir() and list((out / "restored_imgs").glob("*"))
```

- [ ] **Step 2: Run to verify it fails** — `cd engine && python -m pytest tests/test_restore_smart.py -v` → FAIL.

- [ ] **Step 3: Implement.**
Update `base.py` abstract signature:
```python
    @abstractmethod
    def restore(self, image_bgr: np.ndarray, fidelity: float | None = None) -> Restoration:
        raise NotImplementedError
```
Update `gfpgan_restorer.py` `restore` signature to `def restore(self, image_bgr, fidelity=None) -> Restoration:` (GFPGAN ignores `fidelity`; leave a one-line comment). Do NOT pass fidelity to `enhance`.

Append to `pipeline.py`:
```python
import time  # (already imported)

from restore_engine import analysis as _analysis
from restore_engine import router as _router
from restore_engine.types import RestoreOptions, RestoreResult


def restore_smart(path, options: RestoreOptions, get_restorer, detector,
                  output_dir=None, codeformer_available: bool = True) -> RestoreResult:
    image = io.read_image(path)
    an = _analysis.analyze(image, detector)
    plan = _router.route(an, options, codeformer_available=codeformer_available)
    restorer = get_restorer(plan.face_model, plan.upscale)
    t0 = time.perf_counter()
    r = restorer.restore(image, fidelity=plan.fidelity)
    elapsed = time.perf_counter() - t0
    result = RestoreResult(
        input_path=str(path), restored_image=r.restored_image, faces=r.faces,
        model=r.model, device=restorer.device, elapsed_s=elapsed, analysis=an, routing=plan,
    )
    if output_dir is not None:
        write_outputs(result, output_dir)
    return result
```

- [ ] **Step 4: Run to verify pass** — `cd engine && python -m pytest tests/test_restore_smart.py -v` then the full engine suite `python -m pytest -m "not slow" -q` (existing tests must still pass — the `fidelity` default keeps M0 callers working).

- [ ] **Step 5: Commit.**
```bash
git add engine/restore_engine/models/base.py engine/restore_engine/models/gfpgan_restorer.py engine/restore_engine/pipeline.py engine/tests/test_restore_smart.py
git commit -m "feat(engine): restore_smart (analysis->router->restore) + fidelity param"
```

---

### Task 6: API package — engine_service + job store (no FastAPI yet)

**Files:**
- Create: `api/pyproject.toml`
- Create: `api/restore_api/__init__.py`
- Create: `api/restore_api/engine_service.py`
- Create: `api/restore_api/jobs.py`
- Test: `api/tests/test_jobs.py`

**Interfaces:**
- Consumes (from engine): `restore_engine.pipeline.restore_smart`, `restore_engine.analysis.build_face_detector`, `restore_engine.models.gfpgan_restorer.build_gfpgan_restorer`, `restore_engine.models.codeformer_restorer.build_codeformer_restorer`, `restore_engine.types.RestoreOptions`.
- Produces:
  - `engine_service.EngineService` — holds the detector + a per-`(model, upscale)` restorer cache built lazily via the engine factories; exposes `get_restorer(model, upscale)`, `codeformer_available: bool`, and `run(input_path, options, output_dir) -> RestoreResult` (calls `restore_smart`).
  - `jobs.JobStore` — in-process dict of job records; `create() -> job_id`, `get(job_id) -> dict | None`, `set_running/set_done/set_error`.
  - `jobs.JobRunner(service, max_workers=1)` — submits `run` on a size-1 `ThreadPoolExecutor`, updating the store; `submit(job_id, input_path, options, output_dir)`.

- [ ] **Step 1: Write `api/pyproject.toml`**
```toml
[project]
name = "restore-api"
version = "0.1.0"
requires-python = ">=3.10"
dependencies = [
    "restore-engine",
    "fastapi>=0.110",
    "uvicorn>=0.29",
    "python-multipart>=0.0.9",
]

[project.optional-dependencies]
dev = ["pytest>=8.0", "ruff>=0.5", "httpx>=0.27"]

[build-system]
requires = ["setuptools>=68"]
build-backend = "setuptools.build_meta"

[tool.setuptools.packages.find]
where = ["."]
include = ["restore_api*"]

[tool.ruff]
line-length = 100

[tool.ruff.lint.isort]
known-first-party = ["restore_api", "restore_engine"]
known-third-party = ["gfpgan"]
```
Then install into the venv: `source .venv/bin/activate && uv pip install -e "api[dev]"` (the engine is already installed editable, satisfying `restore-engine`).

- [ ] **Step 2: Write the failing test**
```python
# api/tests/test_jobs.py
import time

from restore_api.jobs import JobRunner, JobStore


class FakeService:
    def __init__(self):
        self.calls = []

    def run(self, input_path, options, output_dir):
        self.calls.append((input_path, options, output_dir))
        return {"ok": True, "input": str(input_path)}


def test_jobstore_lifecycle():
    s = JobStore()
    jid = s.create()
    assert s.get(jid)["status"] == "queued"
    s.set_running(jid)
    assert s.get(jid)["status"] == "running"
    s.set_done(jid, {"restored_url": "/x"})
    rec = s.get(jid)
    assert rec["status"] == "done" and rec["result"]["restored_url"] == "/x"


def test_jobstore_error():
    s = JobStore()
    jid = s.create()
    s.set_error(jid, "boom")
    assert s.get(jid)["status"] == "error" and s.get(jid)["error"] == "boom"


def test_runner_executes_and_marks_done(tmp_path):
    store = JobStore()
    svc = FakeService()
    runner = JobRunner(svc, store, max_workers=1)
    jid = store.create()
    runner.submit(jid, tmp_path / "in.png", {"mode": "auto"}, tmp_path / "out")
    runner.shutdown(wait=True)
    assert svc.calls and store.get(jid)["status"] == "done"


def test_runner_marks_error_on_exception(tmp_path):
    class Boom:
        def run(self, *a, **k):
            raise RuntimeError("nope")

    store = JobStore()
    runner = JobRunner(Boom(), store, max_workers=1)
    jid = store.create()
    runner.submit(jid, tmp_path / "in.png", {}, tmp_path / "out")
    runner.shutdown(wait=True)
    assert store.get(jid)["status"] == "error" and "nope" in store.get(jid)["error"]
```

- [ ] **Step 3: Run to verify it fails** — `cd api && python -m pytest tests/test_jobs.py -v` → FAIL.

- [ ] **Step 4: Implement `jobs.py`**
```python
"""In-process job store + a size-1 threadpool runner. No external queue."""
from __future__ import annotations

import traceback
import uuid
from concurrent.futures import ThreadPoolExecutor
from threading import Lock


class JobStore:
    def __init__(self):
        self._jobs: dict[str, dict] = {}
        self._lock = Lock()

    def create(self) -> str:
        jid = uuid.uuid4().hex
        with self._lock:
            self._jobs[jid] = {"status": "queued", "result": None, "error": None}
        return jid

    def get(self, jid: str) -> dict | None:
        with self._lock:
            rec = self._jobs.get(jid)
            return dict(rec) if rec else None

    def _set(self, jid, **kw):
        with self._lock:
            if jid in self._jobs:
                self._jobs[jid].update(kw)

    def set_running(self, jid): self._set(jid, status="running")
    def set_done(self, jid, result): self._set(jid, status="done", result=result)
    def set_error(self, jid, error): self._set(jid, status="error", error=error)


class JobRunner:
    def __init__(self, service, store: JobStore, max_workers: int = 1):
        self._service = service
        self._store = store
        self._pool = ThreadPoolExecutor(max_workers=max_workers)

    def submit(self, jid, input_path, options, output_dir):
        self._pool.submit(self._run, jid, input_path, options, output_dir)

    def _run(self, jid, input_path, options, output_dir):
        self._store.set_running(jid)
        try:
            result = self._service.run(input_path, options, output_dir)
            self._store.set_done(jid, result)
        except Exception as exc:  # noqa: BLE001 - surface any failure as job error
            self._store.set_error(jid, f"{exc}\n{traceback.format_exc()}")

    def shutdown(self, wait: bool = True):
        self._pool.shutdown(wait=wait)
```

Implement `engine_service.py`:
```python
"""Holds the detector + a lazy per-(model, upscale) restorer cache; runs restore_smart."""
from __future__ import annotations

from pathlib import Path

from restore_engine.analysis import build_face_detector
from restore_engine.models.codeformer_restorer import build_codeformer_restorer
from restore_engine.models.gfpgan_restorer import build_gfpgan_restorer
from restore_engine.pipeline import restore_smart
from restore_engine.types import RestoreOptions


class EngineService:
    def __init__(self, device: str | None = None):
        self._device = device
        self._detector = build_face_detector(device)
        self._cache: dict[tuple[str, int], object] = {}
        # probe CodeFormer availability once (build at default scale; may be None)
        probe = build_codeformer_restorer(device=device, upscale=2)
        self.codeformer_available = probe is not None
        if probe is not None:
            self._cache[("codeformer", 2)] = probe

    def get_restorer(self, model: str, upscale: int):
        key = (model, upscale)
        if key not in self._cache:
            if model == "codeformer":
                r = build_codeformer_restorer(device=self._device, upscale=upscale)
                if r is None:
                    r = build_gfpgan_restorer(device=self._device, upscale=upscale)  # safety net
                self._cache[key] = r
            else:
                self._cache[key] = build_gfpgan_restorer(device=self._device, upscale=upscale)
        return self._cache[key]

    def run(self, input_path, options: RestoreOptions, output_dir):
        return restore_smart(
            Path(input_path), options, self.get_restorer, self._detector,
            output_dir=output_dir, codeformer_available=self.codeformer_available,
        )
```

- [ ] **Step 5: Run to verify pass** — `cd api && python -m pytest tests/test_jobs.py -v` → PASS. (Only `jobs.py` is exercised by tests; `engine_service.py` is covered indirectly at the API layer / real runs.)

- [ ] **Step 6: Commit.**
```bash
git add api/pyproject.toml api/restore_api/__init__.py api/restore_api/engine_service.py api/restore_api/jobs.py api/tests/test_jobs.py
git commit -m "feat(api): engine_service (lazy restorer cache) + in-process job store/runner"
```

---

### Task 7: FastAPI app — routes, guardrails, static results, TestClient tests

**Files:**
- Create: `api/restore_api/app.py`
- Test: `api/tests/test_api.py`

**Interfaces:**
- Consumes: `jobs.JobStore, JobRunner`; `engine_service.EngineService`; `restore_engine.types.RestoreOptions`; `config` guardrail limits.
- Produces: `app.create_app(service=None, results_root=None) -> FastAPI` — `service` injectable (fake in tests; real `EngineService` built in `lifespan` when `None`). Routes: `POST /jobs`, `GET /jobs/{id}`, `GET /results/{id}/{file}` (StaticFiles), `GET /healthz`.

- [ ] **Step 1: Write the failing test**
```python
# api/tests/test_api.py
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
        from restore_engine.io import write_image
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
```

- [ ] **Step 2: Run to verify it fails** — `cd api && python -m pytest tests/test_api.py -v` → FAIL.

- [ ] **Step 3: Implement `app.py`**
```python
"""Local FastAPI over the restoration engine. Async jobs, static result files."""
from __future__ import annotations

import json
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from restore_engine import config
from restore_engine.types import RestoreOptions

from restore_api.engine_service import EngineService
from restore_api.jobs import JobRunner, JobStore


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
    async def create_job(file: UploadFile = File(...), options: str = Form("{}")):
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
```
*Note for the implementer:* the guardrail downscale (`config.MAX_INPUT_DIM`) and per-job timeout (`config.JOB_TIMEOUT_S`) belong in `EngineService.run` / `JobRunner` — add the downscale in `restore_smart`'s read or `engine_service.run` (resize longest side to `MAX_INPUT_DIM` before restore) and enforce the timeout in `JobRunner._run` (e.g. run the call via a future with `.result(timeout=...)`). Add focused tests only if straightforward; otherwise note as covered by the size cap + serialized execution and flag for review.

- [ ] **Step 4: Run to verify pass** — `cd api && python -m pytest tests/test_api.py -v`, then the whole repo suite: `cd ../engine && python -m pytest -m "not slow" -q && cd ../api && python -m pytest -q`. Both green.

- [ ] **Step 5: Lint both packages.** `cd engine && ../.venv/bin/ruff check . && cd ../api && ../.venv/bin/ruff check .` → both clean.

- [ ] **Step 6: Commit.**
```bash
git add api/restore_api/app.py api/tests/test_api.py
git commit -m "feat(api): FastAPI job endpoints + static results + guardrails"
```

---

## Notes for the implementer
- Keep the `engine/` boundary clean — `api/` imports engine, never the reverse.
- The API contract (`/jobs`, `/jobs/{id}`, result payload) is what the M2 web app will consume — match the field names in `_result_payload` exactly to the spec.
- Real end-to-end (weights) is a controller smoke: start `uvicorn restore_api.app:create_app --factory` and POST a real photo. Not part of the offline suite.
- Downscale + timeout guardrails: implement in the service/runner layer; don't let a pathological input hang the single worker.

## Self-review (done)
- **Spec coverage:** analysis ✅(T3); router + rationale ✅(T4); CodeFormer + fallback ✅(T1, router T4, service T6); fidelity ✅(T2 type, T4 route, T5 forward); restore_smart ✅(T5); async job contract ✅(T6 store/runner, T7 routes); load-once ✅(T6 cache, T7 lifespan); serialize ✅(T6 max_workers=1); guardrails size-cap ✅(T7), downscale+timeout ✅(T7 note); static results ✅(T7); offline tests with fakes ✅(all).
- **Placeholder scan:** Task 1 is an intentional spike (implementation discovered, not pre-written) — flagged as the one exception; all other tasks carry complete code.
- **Type consistency:** `RestoreOptions`, `Analysis`, `RoutePlan`, `RestoreResult(+analysis,+routing)`, `FaceRestorer.restore(image_bgr, fidelity=None)`, `get_restorer(model, upscale)`, `restore_smart(path, options, get_restorer, detector, output_dir, codeformer_available)`, `_result_payload` field names — consistent across T2–T7.
