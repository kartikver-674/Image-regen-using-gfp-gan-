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
