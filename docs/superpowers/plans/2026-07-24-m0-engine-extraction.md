# M0 — Engine Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `subprocess`-based `restore.py` with a clean, importable, unit-tested `restore_engine` Python package that runs GFPGAN **1.4 in-process** on macOS (CPU, MPS opt-in), behind a model-agnostic `FaceRestorer` interface, with a CLI and a real-model self-check.

**Architecture:** A pure-Python library (`engine/restore_engine/`) with **zero web/cloud dependencies**. A `FaceRestorer` abstract base defines one restore contract; `GfpganRestorer` is the first implementation (CodeFormer slots in at M1 with no interface change). A `pipeline` orchestrates read → restore → write and is tested with an injected fake restorer, so the full orchestration is covered without downloading model weights. A thin `cli` wires a restorer factory into the pipeline.

**Tech Stack:** Python ≥3.10, PyTorch, `gfpgan`, `realesrgan`, `basicsr`, `facexlib`, OpenCV, Pillow, NumPy; `pytest` + `ruff`; packaged with `pyproject.toml`.

## Global Constraints

Every task's requirements implicitly include these:

- **Python ≥ 3.10.**
- **`engine/` has NO web or cloud imports** — no FastAPI, no Modal, no requests-to-services. Pure library.
- **Dependency pins for the GFPGAN/basicsr stack (known-good, non-negotiable):** `numpy<2`, `torchvision<0.17`, `torch<2.2`. Reason: `basicsr` imports `torchvision.transforms.functional_tensor`, removed in torchvision ≥0.17; and the older CV stack breaks under NumPy 2.x. *(Fallback if pins are undesirable: one-line patch of `basicsr/data/degradations.py` to import from `torchvision.transforms.functional` — but prefer the pin.)*
- **Device policy:** auto-select `cuda` if available, else `cpu`. **MPS is opt-in only** (`--device mps` / `prefer="mps"`) because several GFPGAN/basicsr ops fall back or error on MPS; **CPU is the reliable Mac path.**
- **Models come from pip + auto-downloaded weights** — do NOT `git clone` the GFPGAN repo (that was limitation #2). GFPGAN 1.4 weights: `https://github.com/TencentARC/GFPGAN/releases/download/v1.3.4/GFPGANv1.4.pth`.
- **No matplotlib** — comparison images are built with OpenCV (`cv2.hconcat`), not a plotting library.
- **TDD, frequent commits**, one behavior per test.
- All work on branch `redesign/photo-restoration-product`.

---

### Task 1: Package scaffold + dependencies + device selection

**Files:**
- Create: `engine/pyproject.toml`
- Create: `engine/restore_engine/__init__.py`
- Create: `engine/restore_engine/config.py`
- Test: `engine/tests/test_config.py`

**Interfaces:**
- Consumes: nothing (first task).
- Produces:
  - `restore_engine.config.select_device(prefer: str | None = None) -> str` — returns `"cuda" | "mps" | "cpu"`.
  - Constants: `config.GFPGAN_V14_URL: str`, `config.REALESRGAN_X2_URL: str`, `config.DEFAULT_UPSCALE: int = 2`.

- [ ] **Step 1: Write `engine/pyproject.toml`**

```toml
[project]
name = "restore-engine"
version = "0.1.0"
description = "Old photo restoration engine (M0: GFPGAN 1.4)"
requires-python = ">=3.10"
dependencies = [
    "numpy<2",
    "torch<2.2",
    "torchvision<0.17",
    "gfpgan>=1.3.8",
    "realesrgan>=0.3.0",
    "basicsr>=1.4.2",
    "facexlib>=0.3.0",
    "opencv-python>=4.8",
    "pillow>=10.0",
]

[project.optional-dependencies]
dev = ["pytest>=8.0", "ruff>=0.5"]

[project.scripts]
restory = "restore_engine.cli:main"

[build-system]
requires = ["setuptools>=68"]
build-backend = "setuptools.build_meta"

[tool.setuptools.packages.find]
where = ["."]
include = ["restore_engine*"]

[tool.pytest.ini_options]
markers = ["slow: real-model tests requiring downloaded weights (deselect with -m 'not slow')"]

[tool.ruff]
line-length = 100
```

- [ ] **Step 2: Write the failing test**

```python
# engine/tests/test_config.py
from unittest.mock import patch

from restore_engine import config


def test_select_device_prefers_cuda_when_available():
    with patch("torch.cuda.is_available", return_value=True):
        assert config.select_device() == "cuda"


def test_select_device_falls_back_to_cpu():
    with patch("torch.cuda.is_available", return_value=False):
        assert config.select_device() == "cpu"


def test_mps_is_opt_in_only_not_auto():
    # even if MPS is available, auto must not pick it
    with patch("torch.cuda.is_available", return_value=False), \
         patch("torch.backends.mps.is_available", return_value=True):
        assert config.select_device() == "cpu"


def test_explicit_prefer_is_honored():
    assert config.select_device(prefer="cpu") == "cpu"
    with patch("torch.backends.mps.is_available", return_value=True):
        assert config.select_device(prefer="mps") == "mps"
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd engine && pip install -e ".[dev]" && python -m pytest tests/test_config.py -v`
Expected: FAIL — `ModuleNotFoundError` / `AttributeError: module 'restore_engine.config' has no attribute 'select_device'`.

- [ ] **Step 4: Write minimal implementation**

```python
# engine/restore_engine/__init__.py
"""Old photo restoration engine."""
```

```python
# engine/restore_engine/config.py
"""Device selection and model constants."""
import torch

GFPGAN_V14_URL = "https://github.com/TencentARC/GFPGAN/releases/download/v1.3.4/GFPGANv1.4.pth"
REALESRGAN_X2_URL = "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.1/RealESRGAN_x2plus.pth"
DEFAULT_UPSCALE = 2


def select_device(prefer: str | None = None) -> str:
    """Pick a torch device. Auto = cuda -> cpu. MPS is opt-in via prefer='mps'."""
    if prefer:
        return prefer
    if torch.cuda.is_available():
        return "cuda"
    return "cpu"
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd engine && python -m pytest tests/test_config.py -v`
Expected: PASS (4 passed).

- [ ] **Step 6: Commit**

```bash
git add engine/pyproject.toml engine/restore_engine/__init__.py engine/restore_engine/config.py engine/tests/test_config.py
git commit -m "feat(engine): package scaffold + device selection"
```

---

### Task 2: Data types + image I/O utilities

**Files:**
- Create: `engine/restore_engine/types.py`
- Create: `engine/restore_engine/io.py`
- Test: `engine/tests/test_io.py`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces:
  - `types.FaceResult(index: int, cropped: np.ndarray, restored: np.ndarray)` — dataclass.
  - `types.Restoration(restored_image: np.ndarray, faces: list[FaceResult], model: str)` — dataclass (what a restorer returns).
  - `types.RestoreResult(input_path: str, restored_image: np.ndarray, faces: list[FaceResult], model: str, device: str, elapsed_s: float)` — dataclass (what the pipeline returns).
  - `io.read_image(path: str | Path) -> np.ndarray` — returns BGR uint8, EXIF-oriented, grayscale-safe (always 3-channel).
  - `io.write_image(image_bgr: np.ndarray, dest: str | Path) -> None`.
  - `io.save_comparison(before_bgr: np.ndarray, after_bgr: np.ndarray, dest: str | Path) -> None` — side-by-side, cv2.
  - `io.list_images(directory: str | Path) -> list[Path]` — sorted image files.

- [ ] **Step 1: Write the failing test**

```python
# engine/tests/test_io.py
from pathlib import Path

import numpy as np

from restore_engine import io
from restore_engine.types import FaceResult, RestoreResult


def _solid(h, w, color=(10, 20, 30)):
    img = np.zeros((h, w, 3), dtype=np.uint8)
    img[:] = color
    return img


def test_types_construct():
    fr = FaceResult(index=0, cropped=_solid(4, 4), restored=_solid(4, 4))
    rr = RestoreResult(input_path="a.jpg", restored_image=_solid(8, 8),
                       faces=[fr], model="gfpgan-1.4", device="cpu", elapsed_s=1.2)
    assert rr.faces[0].index == 0 and rr.model == "gfpgan-1.4"


def test_read_write_roundtrip(tmp_path):
    src = tmp_path / "in.png"
    io.write_image(_solid(6, 8, (0, 0, 255)), src)  # red in BGR
    img = io.read_image(src)
    assert img.shape == (6, 8, 3) and img.dtype == np.uint8


def test_read_image_forces_three_channels_for_grayscale(tmp_path):
    import cv2
    gray = np.full((5, 5), 128, dtype=np.uint8)
    p = tmp_path / "g.png"
    cv2.imwrite(str(p), gray)
    img = io.read_image(p)
    assert img.ndim == 3 and img.shape[2] == 3


def test_save_comparison_writes_file(tmp_path):
    dest = tmp_path / "cmp.png"
    io.save_comparison(_solid(10, 10), _solid(20, 20), dest)
    assert dest.exists() and dest.stat().st_size > 0


def test_list_images_sorted_and_filtered(tmp_path):
    for name in ["b.jpg", "a.png", "notes.txt", "c.jpeg"]:
        (tmp_path / name).write_bytes(b"x")
    got = [p.name for p in io.list_images(tmp_path)]
    assert got == ["a.png", "b.jpg", "c.jpeg"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd engine && python -m pytest tests/test_io.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'restore_engine.io'`.

- [ ] **Step 3: Write minimal implementation**

```python
# engine/restore_engine/types.py
"""Dataclasses passed between engine stages."""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np


@dataclass
class FaceResult:
    index: int
    cropped: np.ndarray   # BGR uint8, aligned input face crop
    restored: np.ndarray  # BGR uint8, restored face crop


@dataclass
class Restoration:
    """What a FaceRestorer returns."""
    restored_image: np.ndarray  # BGR uint8, full restored image
    faces: list[FaceResult]
    model: str


@dataclass
class RestoreResult:
    """What the pipeline returns (adds provenance + timing)."""
    input_path: str
    restored_image: np.ndarray
    faces: list[FaceResult]
    model: str
    device: str
    elapsed_s: float
```

```python
# engine/restore_engine/io.py
"""Image read/write + comparison helpers (OpenCV, EXIF-aware)."""
from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageOps

_EXTS = {".png", ".jpg", ".jpeg", ".bmp", ".webp", ".tif", ".tiff"}


def read_image(path: str | Path) -> np.ndarray:
    """Load as BGR uint8, honoring EXIF orientation; grayscale -> 3-channel."""
    with Image.open(path) as im:
        im = ImageOps.exif_transpose(im).convert("RGB")
        rgb = np.array(im)
    return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)


def write_image(image_bgr: np.ndarray, dest: str | Path) -> None:
    dest = Path(dest)
    dest.parent.mkdir(parents=True, exist_ok=True)
    if not cv2.imwrite(str(dest), image_bgr):
        raise OSError(f"failed to write {dest}")


def save_comparison(before_bgr: np.ndarray, after_bgr: np.ndarray, dest: str | Path) -> None:
    """Side-by-side before|after, matched height, labelled."""
    h = max(before_bgr.shape[0], after_bgr.shape[0])

    def _fit(img):
        scale = h / img.shape[0]
        out = cv2.resize(img, (int(round(img.shape[1] * scale)), h))
        return out

    left, right = _fit(before_bgr), _fit(after_bgr)
    for img, label in ((left, "Before"), (right, "After")):
        cv2.putText(img, label, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 1.0,
                    (255, 255, 255), 2, cv2.LINE_AA)
    write_image(cv2.hconcat([left, right]), dest)


def list_images(directory: str | Path) -> list[Path]:
    return sorted(p for p in Path(directory).iterdir()
                  if p.is_file() and p.suffix.lower() in _EXTS)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd engine && python -m pytest tests/test_io.py -v`
Expected: PASS (5 passed).

- [ ] **Step 5: Commit**

```bash
git add engine/restore_engine/types.py engine/restore_engine/io.py engine/tests/test_io.py
git commit -m "feat(engine): data types + OpenCV image I/O helpers"
```

---

### Task 3: FaceRestorer interface + pipeline (tested with a fake restorer)

**Files:**
- Create: `engine/restore_engine/models/__init__.py`
- Create: `engine/restore_engine/models/base.py`
- Create: `engine/restore_engine/pipeline.py`
- Test: `engine/tests/test_pipeline.py`

**Interfaces:**
- Consumes: `types.FaceResult`, `types.Restoration`, `types.RestoreResult`; `io.read_image`, `io.write_image`, `io.save_comparison`, `io.list_images`.
- Produces:
  - `models.base.FaceRestorer` — ABC with attributes `name: str`, `device: str` and abstract method `restore(self, image_bgr: np.ndarray) -> Restoration`.
  - `pipeline.restore_image(path: str | Path, restorer: FaceRestorer, output_dir: str | Path | None = None) -> RestoreResult`.
  - `pipeline.restore_path(path: str | Path, restorer: FaceRestorer, output_dir: str | Path) -> list[RestoreResult]` — file or directory.
  - `pipeline.write_outputs(result: RestoreResult, output_dir: str | Path) -> None` — writes `restored_imgs/`, `cropped_faces/`, `restored_faces/`, `comparisons/`.

- [ ] **Step 1: Write the failing test**

```python
# engine/tests/test_pipeline.py
from pathlib import Path

import numpy as np

from restore_engine import pipeline
from restore_engine.io import write_image
from restore_engine.models.base import FaceRestorer
from restore_engine.types import FaceResult, Restoration


class FakeRestorer(FaceRestorer):
    name = "fake"
    device = "cpu"

    def restore(self, image_bgr: np.ndarray) -> Restoration:
        big = np.repeat(np.repeat(image_bgr, 2, axis=0), 2, axis=1)  # 2x upscale
        face = FaceResult(index=0, cropped=image_bgr.copy(), restored=image_bgr.copy())
        return Restoration(restored_image=big, faces=[face], model="fake-1.0")


def _img(tmp_path, name="in.png"):
    p = tmp_path / name
    write_image(np.full((8, 8, 3), 100, dtype=np.uint8), p)
    return p


def test_restore_image_returns_result_with_timing_and_provenance(tmp_path):
    result = pipeline.restore_image(_img(tmp_path), FakeRestorer())
    assert result.model == "fake-1.0"
    assert result.device == "cpu"
    assert result.elapsed_s >= 0
    assert result.restored_image.shape == (16, 16, 3)
    assert len(result.faces) == 1


def test_restore_image_writes_all_output_dirs(tmp_path):
    out = tmp_path / "out"
    pipeline.restore_image(_img(tmp_path), FakeRestorer(), output_dir=out)
    assert (out / "restored_imgs").is_dir()
    assert list((out / "restored_imgs").glob("*"))
    assert list((out / "restored_faces").glob("*"))
    assert list((out / "cropped_faces").glob("*"))
    assert list((out / "comparisons").glob("*"))


def test_restore_path_handles_a_directory(tmp_path):
    src = tmp_path / "src"
    src.mkdir()
    _img(src, "a.png")
    _img(src, "b.png")
    results = pipeline.restore_path(src, FakeRestorer(), tmp_path / "out")
    assert len(results) == 2
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd engine && python -m pytest tests/test_pipeline.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'restore_engine.models'`.

- [ ] **Step 3: Write minimal implementation**

```python
# engine/restore_engine/models/__init__.py
```

```python
# engine/restore_engine/models/base.py
"""Model-agnostic face restoration contract."""
from __future__ import annotations

from abc import ABC, abstractmethod

import numpy as np

from restore_engine.types import Restoration


class FaceRestorer(ABC):
    name: str
    device: str

    @abstractmethod
    def restore(self, image_bgr: np.ndarray) -> Restoration:
        """Restore faces in a BGR uint8 image; return the full result + face crops."""
        raise NotImplementedError
```

```python
# engine/restore_engine/pipeline.py
"""Read -> restore -> (optionally) write. Restorer is injected."""
from __future__ import annotations

import time
from pathlib import Path

from restore_engine import io
from restore_engine.models.base import FaceRestorer
from restore_engine.types import RestoreResult


def restore_image(path, restorer: FaceRestorer, output_dir=None) -> RestoreResult:
    image = io.read_image(path)
    t0 = time.perf_counter()
    r = restorer.restore(image)
    elapsed = time.perf_counter() - t0
    result = RestoreResult(
        input_path=str(path),
        restored_image=r.restored_image,
        faces=r.faces,
        model=r.model,
        device=restorer.device,
        elapsed_s=elapsed,
    )
    if output_dir is not None:
        write_outputs(result, output_dir)
    return result


def write_outputs(result: RestoreResult, output_dir) -> None:
    out = Path(output_dir)
    stem = Path(result.input_path).stem
    io.write_image(result.restored_image, out / "restored_imgs" / f"{stem}.png")
    for face in result.faces:
        tag = f"{stem}_{face.index:02d}.png"
        io.write_image(face.cropped, out / "cropped_faces" / tag)
        io.write_image(face.restored, out / "restored_faces" / tag)
        io.save_comparison(face.cropped, face.restored, out / "comparisons" / tag)


def restore_path(path, restorer: FaceRestorer, output_dir) -> list[RestoreResult]:
    path = Path(path)
    targets = io.list_images(path) if path.is_dir() else [path]
    return [restore_image(t, restorer, output_dir) for t in targets]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd engine && python -m pytest tests/test_pipeline.py -v`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add engine/restore_engine/models/__init__.py engine/restore_engine/models/base.py engine/restore_engine/pipeline.py engine/tests/test_pipeline.py
git commit -m "feat(engine): FaceRestorer interface + injectable pipeline"
```

---

### Task 4: GFPGAN 1.4 restorer + real-model self-check

**Files:**
- Create: `engine/restore_engine/models/gfpgan_restorer.py`
- Create: `engine/restore_engine/demo.py`
- Test: `engine/tests/test_gfpgan_restorer.py`

**Interfaces:**
- Consumes: `config.select_device`, `config.GFPGAN_V14_URL`, `config.REALESRGAN_X2_URL`, `config.DEFAULT_UPSCALE`; `models.base.FaceRestorer`; `types.FaceResult`, `types.Restoration`; `pipeline.restore_image`.
- Produces:
  - `models.gfpgan_restorer.build_gfpgan_restorer(device: str | None = None, upscale: int = 2, use_bg_upsampler: bool = True) -> GfpganRestorer`.
  - `models.gfpgan_restorer.GfpganRestorer` — implements `FaceRestorer` (`name = "gfpgan-1.4"`).
  - `demo.main(sample_path: str | None = None, output_dir: str | None = None) -> None`.

- [ ] **Step 1: Write the failing test (GFPGANer mocked — no weight download)**

```python
# engine/tests/test_gfpgan_restorer.py
from unittest.mock import MagicMock, patch

import numpy as np

from restore_engine.models import gfpgan_restorer as gr


def test_build_and_restore_maps_gfpganer_output(monkeypatch):
    # Fake GFPGANer whose .enhance returns (cropped_faces, restored_faces, restored_img)
    fake = MagicMock()
    face_a = np.zeros((4, 4, 3), dtype=np.uint8)
    fake.enhance.return_value = ([face_a], [face_a + 1], np.zeros((16, 16, 3), np.uint8))

    with patch.object(gr, "GFPGANer", return_value=fake) as ctor, \
         patch.object(gr, "_build_bg_upsampler", return_value=None):
        r = gr.build_gfpgan_restorer(device="cpu", upscale=2, use_bg_upsampler=False)
        out = r.restore(np.zeros((8, 8, 3), dtype=np.uint8))

    assert ctor.called
    assert r.name == "gfpgan-1.4"
    assert r.device == "cpu"
    assert out.model == "gfpgan-1.4"
    assert out.restored_image.shape == (16, 16, 3)
    assert len(out.faces) == 1
    assert out.faces[0].index == 0
    # enhance called with paste_back=True
    _, kwargs = fake.enhance.call_args
    assert kwargs.get("paste_back") is True


def test_restore_handles_zero_faces(monkeypatch):
    fake = MagicMock()
    fake.enhance.return_value = ([], [], np.zeros((8, 8, 3), np.uint8))
    with patch.object(gr, "GFPGANer", return_value=fake), \
         patch.object(gr, "_build_bg_upsampler", return_value=None):
        r = gr.build_gfpgan_restorer(device="cpu", use_bg_upsampler=False)
        out = r.restore(np.zeros((8, 8, 3), dtype=np.uint8))
    assert out.faces == []
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd engine && python -m pytest tests/test_gfpgan_restorer.py -v`
Expected: FAIL — `ModuleNotFoundError` / `AttributeError` for `gfpgan_restorer`.

- [ ] **Step 3: Write minimal implementation**

```python
# engine/restore_engine/models/gfpgan_restorer.py
"""GFPGAN 1.4 wrapper behind the FaceRestorer interface (in-process, no subprocess)."""
from __future__ import annotations

import numpy as np
from gfpgan import GFPGANer

from restore_engine import config
from restore_engine.models.base import FaceRestorer
from restore_engine.types import FaceResult, Restoration


def _build_bg_upsampler(device: str):
    """Real-ESRGAN x2 background upsampler; None on non-CUDA is a valid choice."""
    from basicsr.archs.rrdbnet_arch import RRDBNet
    from realesrgan import RealESRGANer

    model = RRDBNet(num_in_ch=3, num_out_ch=3, num_feat=64,
                    num_block=23, num_grow_ch=32, scale=2)
    return RealESRGANer(
        scale=2, model_path=config.REALESRGAN_X2_URL, model=model,
        tile=400, tile_pad=10, pre_pad=0,
        half=(device == "cuda"),  # fp16 only on CUDA
    )


class GfpganRestorer(FaceRestorer):
    name = "gfpgan-1.4"

    def __init__(self, restorer: GFPGANer, device: str):
        self._restorer = restorer
        self.device = device

    def restore(self, image_bgr: np.ndarray) -> Restoration:
        cropped, restored, restored_img = self._restorer.enhance(
            image_bgr, has_aligned=False, only_center_face=False, paste_back=True,
        )
        faces = [
            FaceResult(index=i, cropped=c, restored=r)
            for i, (c, r) in enumerate(zip(cropped, restored))
        ]
        return Restoration(restored_image=restored_img, faces=faces, model=self.name)


def build_gfpgan_restorer(device: str | None = None, upscale: int = config.DEFAULT_UPSCALE,
                          use_bg_upsampler: bool = True) -> GfpganRestorer:
    device = config.select_device(device)
    bg = _build_bg_upsampler(device) if use_bg_upsampler else None
    restorer = GFPGANer(
        model_path=config.GFPGAN_V14_URL,
        upscale=upscale, arch="clean", channel_multiplier=2,
        bg_upsampler=bg, device=device,
    )
    return GfpganRestorer(restorer, device)
```

```python
# engine/restore_engine/demo.py
"""Real-model self-check: restore one sample image end-to-end.

Skipped automatically if no sample image is available. This is the runnable
proof that the real GFPGAN path works on this machine.
"""
from __future__ import annotations

import sys
import tempfile
from pathlib import Path

from restore_engine import pipeline
from restore_engine.models.gfpgan_restorer import build_gfpgan_restorer

_DEFAULT_SAMPLE = Path(__file__).parent.parent / "tests" / "fixtures" / "sample_face.jpg"


def main(sample_path: str | None = None, output_dir: str | None = None) -> None:
    sample = Path(sample_path) if sample_path else _DEFAULT_SAMPLE
    if not sample.exists():
        print(f"[demo] no sample at {sample}; drop a face photo there to run. Skipping.")
        return
    out = output_dir or tempfile.mkdtemp(prefix="restory_demo_")
    restorer = build_gfpgan_restorer(use_bg_upsampler=True)
    result = pipeline.restore_image(sample, restorer, output_dir=out)
    assert result.restored_image is not None
    print(f"[demo] device={result.device} faces={len(result.faces)} "
          f"time={result.elapsed_s:.1f}s -> {out}/restored_imgs/")


if __name__ == "__main__":
    main(*sys.argv[1:])
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd engine && python -m pytest tests/test_gfpgan_restorer.py -v`
Expected: PASS (2 passed) — no weights downloaded (GFPGANer mocked).

- [ ] **Step 5: Run the real self-check once on your Mac (manual)**

Put any face photo at `engine/tests/fixtures/sample_face.jpg`, then run:
Run: `cd engine && python -m restore_engine.demo`
Expected: first run downloads GFPGAN 1.4 + Real-ESRGAN weights, then prints e.g. `[demo] device=cpu faces=1 time=NN.Ns -> /tmp/.../restored_imgs/`. If no sample, prints the skip message (still exit 0).
*(If you hit `ModuleNotFoundError: torchvision.transforms.functional_tensor`, the pin didn't take — reinstall with `torchvision<0.17`, per Global Constraints.)*

- [ ] **Step 6: Commit**

```bash
git add engine/restore_engine/models/gfpgan_restorer.py engine/restore_engine/demo.py engine/tests/test_gfpgan_restorer.py
git commit -m "feat(engine): in-process GFPGAN 1.4 restorer + real-model self-check"
```

---

### Task 5: CLI + setup + docs (supersede the old subprocess script)

**Files:**
- Create: `engine/restore_engine/cli.py`
- Test: `engine/tests/test_cli.py`
- Modify: `setup.sh` (drop the GFPGAN git-clone; pip-install the engine)
- Modify: `README.md` (new install + run instructions)
- Delete: `restore.py` (superseded by the CLI)

**Interfaces:**
- Consumes: `config.DEFAULT_UPSCALE`; `models.gfpgan_restorer.build_gfpgan_restorer`; `pipeline.restore_path`.
- Produces:
  - `cli.build_parser() -> argparse.ArgumentParser`.
  - `cli.main(argv: list[str] | None = None) -> int`.

- [ ] **Step 1: Write the failing test (build_gfpgan_restorer patched — no model load)**

```python
# engine/tests/test_cli.py
from pathlib import Path
from unittest.mock import patch

import numpy as np

from restore_engine import cli
from restore_engine.io import write_image
from restore_engine.models.base import FaceRestorer
from restore_engine.types import FaceResult, Restoration


class FakeRestorer(FaceRestorer):
    name = "fake"
    device = "cpu"

    def restore(self, image_bgr):
        f = FaceResult(index=0, cropped=image_bgr.copy(), restored=image_bgr.copy())
        return Restoration(restored_image=image_bgr.copy(), faces=[f], model="fake")


def test_parser_defaults():
    args = cli.build_parser().parse_args(["-i", "in", "-o", "out"])
    assert args.input == "in" and args.output == "out"
    assert args.scale == 2 and args.device is None and args.no_bg is False


def test_main_runs_pipeline_and_writes_output(tmp_path):
    src = tmp_path / "p.png"
    write_image(np.full((8, 8, 3), 50, dtype=np.uint8), src)
    out = tmp_path / "out"
    with patch.object(cli, "build_gfpgan_restorer", return_value=FakeRestorer()) as build:
        rc = cli.main(["-i", str(src), "-o", str(out)])
    assert rc == 0
    assert build.called
    assert list((out / "restored_imgs").glob("*.png"))


def test_main_forwards_device_and_no_bg(tmp_path):
    src = tmp_path / "p.png"
    write_image(np.full((8, 8, 3), 50, dtype=np.uint8), src)
    with patch.object(cli, "build_gfpgan_restorer", return_value=FakeRestorer()) as build:
        cli.main(["-i", str(src), "-o", str(tmp_path / "o"), "--device", "cpu", "--no-bg", "-s", "4"])
    _, kwargs = build.call_args
    assert kwargs == {"device": "cpu", "upscale": 4, "use_bg_upsampler": False}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd engine && python -m pytest tests/test_cli.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'restore_engine.cli'`.

- [ ] **Step 3: Write minimal implementation**

```python
# engine/restore_engine/cli.py
"""Local CLI — replaces the old subprocess restore.py."""
from __future__ import annotations

import argparse

from restore_engine import config
from restore_engine.models.gfpgan_restorer import build_gfpgan_restorer
from restore_engine.pipeline import restore_path


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Restore old photos with GFPGAN 1.4.")
    p.add_argument("-i", "--input", required=True, help="input image or directory")
    p.add_argument("-o", "--output", required=True, help="output directory")
    p.add_argument("-s", "--scale", type=int, default=config.DEFAULT_UPSCALE, help="upscale factor")
    p.add_argument("--device", default=None, help="cuda | cpu | mps (default: auto)")
    p.add_argument("--no-bg", action="store_true", help="disable Real-ESRGAN background upsampling")
    return p


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    restorer = build_gfpgan_restorer(
        device=args.device, upscale=args.scale, use_bg_upsampler=not args.no_bg,
    )
    results = restore_path(args.input, restorer, args.output)
    for r in results:
        print(f"{r.input_path}: {len(r.faces)} face(s), {r.elapsed_s:.1f}s -> {args.output}")
    print(f"Done. {len(results)} image(s) -> {args.output}/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd engine && python -m pytest tests/test_cli.py -v`
Expected: PASS (3 passed).

- [ ] **Step 5: Rewrite `setup.sh` (no more GFPGAN git clone)**

```bash
#!/usr/bin/env bash
# One-time setup: install the restore engine (pulls GFPGAN 1.4 + Real-ESRGAN from pip).
# Model weights download automatically on first run.
set -euo pipefail
cd "$(dirname "$0")"

python -m pip install -e "engine[dev]"

echo "Setup done. Run:  restory -i path/to/photo.jpg -o results"
echo "Or the dev self-check:  cd engine && python -m restore_engine.demo"
```

- [ ] **Step 6: Rewrite `README.md`**

```markdown
# Old Photo Restoration Engine

In-process GFPGAN 1.4 face restoration with Real-ESRGAN background upsampling,
behind a clean, model-agnostic `FaceRestorer` interface. Milestone M0 of the
[product design spec](docs/superpowers/specs/2026-07-24-old-photo-restoration-product-design.md).

## Requirements
- Python ≥ 3.10 (deps pin `numpy<2`, `torchvision<0.17`, `torch<2.2` for the GFPGAN/basicsr stack)
- macOS/Linux; GPU optional. **CPU is the reliable Mac path; MPS is opt-in (`--device mps`).**

## Setup (once)
```bash
bash setup.sh          # pip-installs engine/ ; weights auto-download on first run
```

## Run
```bash
restory -i photo.jpg -o results             # single image
restory -i my_photos/ -o results -s 4       # a folder, 4x upscale
restory -i photo.jpg -o results --no-bg     # skip background upsampling (faster on CPU)
```
Outputs land in `results/`: `restored_imgs/`, `restored_faces/`, `cropped_faces/`, `comparisons/`.

## Develop
```bash
cd engine && python -m pytest -m "not slow" -v   # fast tests (no weights)
python -m restore_engine.demo                    # real-model self-check
```
```

- [ ] **Step 7: Delete the superseded script**

```bash
git rm restore.py
```

- [ ] **Step 8: Run the full fast test suite**

Run: `cd engine && python -m pytest -m "not slow" -v`
Expected: PASS — all tests from Tasks 1–5 green.

- [ ] **Step 9: Commit**

```bash
git add engine/restore_engine/cli.py engine/tests/test_cli.py setup.sh README.md
git commit -m "feat(engine): CLI + pip-based setup; remove subprocess restore.py"
```

---

## Notes for the implementer

- **Keep the `engine/` boundary clean:** nothing here imports web/cloud packages. M1 adds `models/codeformer_restorer.py` implementing the *same* `FaceRestorer` ABC, plus `analysis.py` + `router.py` — none of which change Tasks 1–5.
- **The fake-restorer pattern (Tasks 3 & 5) is the reason the pipeline is testable without weights.** Preserve dependency injection: the pipeline never constructs a restorer itself.
- **`.gitignore`:** the repo already ignores `GFPGAN/`, `results/`, `*.pth`. Add `engine/tests/fixtures/*.jpg` is NOT needed — a sample face is optional and gitignored via `*.jpg`? It isn't; leave fixtures untracked or add a tiny CC0 sample deliberately. Don't commit large images.

## Self-review (done)

- **Spec coverage (M0 row):** `restore.py`→`engine/` library ✅ (Tasks 1–5); GFPGAN **1.4** ✅ (Task 4, `GFPGAN_V14_URL`); common face interface ✅ (Task 3, `FaceRestorer`); CLI ✅ (Task 5); unit tests ✅ (every task); `demo()` self-check ✅ (Task 4, `demo.main`); runs on Mac ✅ (device policy, CPU default, MPS opt-in). Limitation #2 (subprocess) removed ✅ (in-process `GFPGANer`).
- **Placeholder scan:** none — every code step is complete.
- **Type consistency:** `FaceResult(index, cropped, restored)`, `Restoration(restored_image, faces, model)`, `RestoreResult(+input_path, device, elapsed_s)`, `FaceRestorer.restore(image_bgr)->Restoration`, `build_gfpgan_restorer(device, upscale, use_bg_upsampler)` — used identically across Tasks 2–5.
