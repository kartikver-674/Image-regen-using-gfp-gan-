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
    # RealESRGANer picks its own device (CUDA if available, else CPU) — it never
    # sees `device` here, so on --device mps this upsampler still runs on CPU.
    # The `device` arg below only controls whether fp16 (`half`) is used.
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

    def restore(self, image_bgr: np.ndarray, fidelity: float | None = None) -> Restoration:
        # GFPGAN has no fidelity knob (that's a CodeFormer concept) — accepted for
        # interface parity with FaceRestorer, ignored here.
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
