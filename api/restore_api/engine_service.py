"""Holds the detector + a lazy per-(model, upscale) restorer cache; runs restore_smart."""
from __future__ import annotations

import threading
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
        self._cache: dict[tuple[str, int, bool], object] = {}
        self._lock = threading.Lock()
        # probe CodeFormer availability once (build at default scale; may be None)
        probe = build_codeformer_restorer(device=device, upscale=2)
        self.codeformer_available = probe is not None
        if probe is not None:
            self._cache[("codeformer", 2, True)] = probe

    def get_restorer(self, model: str, upscale: int, use_bg_upsampler: bool = True):
        key = (model, upscale, use_bg_upsampler)
        if key not in self._cache:
            if model == "codeformer":
                r = build_codeformer_restorer(device=self._device, upscale=upscale,
                                              use_bg_upsampler=use_bg_upsampler)
                if r is None:  # safety net (also used as the hybrid refiner)
                    r = build_gfpgan_restorer(device=self._device, upscale=upscale,
                                              use_bg_upsampler=use_bg_upsampler)
                self._cache[key] = r
            else:
                self._cache[key] = build_gfpgan_restorer(device=self._device, upscale=upscale,
                                                         use_bg_upsampler=use_bg_upsampler)
        return self._cache[key]

    def run(self, input_path, options: RestoreOptions, output_dir):
        with self._lock:
            return restore_smart(
                Path(input_path), options, self.get_restorer, self._detector,
                output_dir=output_dir, codeformer_available=self.codeformer_available,
            )
