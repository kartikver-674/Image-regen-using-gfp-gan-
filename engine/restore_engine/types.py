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


@dataclass
class RestoreResult:
    """What the pipeline returns (adds provenance + timing)."""
    input_path: str
    restored_image: np.ndarray
    faces: list[FaceResult]
    model: str
    device: str
    elapsed_s: float
    analysis: Analysis | None = None
    routing: RoutePlan | None = None
