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
