"""Read -> restore -> (optionally) write. Restorer is injected."""
from __future__ import annotations

import time
from pathlib import Path

from restore_engine import analysis as _analysis
from restore_engine import io
from restore_engine import router as _router
from restore_engine.models.base import FaceRestorer
from restore_engine.types import RestoreOptions, RestoreResult


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
