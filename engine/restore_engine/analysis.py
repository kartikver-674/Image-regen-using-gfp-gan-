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
