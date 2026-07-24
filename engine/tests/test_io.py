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
