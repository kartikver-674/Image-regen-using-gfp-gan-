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
