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
        out = cv2.resize(img, (round(img.shape[1] * scale), h))
        return out

    left, right = _fit(before_bgr), _fit(after_bgr)
    # Scale label size/position off the matched height so it stays on-canvas
    # for small crops instead of using a fixed origin/scale tuned for large ones.
    if h >= 20:
        font_scale = max(h / 480, 0.3)
        thickness = max(round(h / 240), 1)
        origin = (max(round(h * 0.02), 2), max(round(h * 0.08), 10))
        for img, label in ((left, "Before"), (right, "After")):
            cv2.putText(img, label, origin, cv2.FONT_HERSHEY_SIMPLEX, font_scale,
                        (255, 255, 255), thickness, cv2.LINE_AA)
    write_image(cv2.hconcat([left, right]), dest)


def list_images(directory: str | Path) -> list[Path]:
    return sorted(p for p in Path(directory).iterdir()
                  if p.is_file() and p.suffix.lower() in _EXTS)
