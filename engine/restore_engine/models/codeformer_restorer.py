"""CodeFormer wrapper behind the FaceRestorer interface (in-process, no subprocess).

Spike outcome (see .superpowers/sdd/task-1-report.md for full detail): CodeFormer has
no maintained pip package that installs cleanly on the pinned stack (torch 2.1.2 /
torchvision 0.16.2 / numpy<2) without side effects, so the generator arch is vendored
instead. `restore_engine.vendor.codeformer_arch` / `.vqgan_arch` are copied verbatim
from sczhou/CodeFormer (S-Lab License 1.0, non-commercial) and only depend on
basicsr.utils.get_root_logger / basicsr.utils.registry.ARCH_REGISTRY, both already
provided by the pinned basicsr 1.4.2 that GFPGAN uses. Detection/alignment/paste-back
reuses the same facexlib.utils.face_restoration_helper.FaceRestoreHelper that GFPGAN's
GFPGANer wraps; there is no ready-made "CodeFormerer" class analogous to GFPGANer, so
`_CodeformerEngine` below mirrors GFPGANer.enhance()'s shape (same helper calls, same
img2tensor/tensor2img normalization) with the generator swapped and its fidelity
weight `w` forwarded instead of GFPGAN's style-blend `weight`.
"""
from __future__ import annotations

import logging

import cv2
import numpy as np
import torch

from restore_engine import config
from restore_engine.models.base import FaceRestorer
from restore_engine.types import FaceResult, Restoration

logger = logging.getLogger(__name__)


class _CodeformerEngine:
    """The CodeFormer inference object: net + FaceRestoreHelper, exposing .enhance()
    with the same (cropped_faces, restored_faces, restored_img) contract as GFPGANer."""

    def __init__(self, net, face_helper, device: str, upscale: int, bg_upsampler=None):
        self.net = net
        self.face_helper = face_helper
        self.device = device
        self.upscale = upscale
        self.bg_upsampler = bg_upsampler

    @torch.no_grad()
    def enhance(self, img: np.ndarray, has_aligned: bool = False, only_center_face: bool = False,
                paste_back: bool = True, w: float = 0.5):
        from basicsr.utils import img2tensor, tensor2img
        from torchvision.transforms.functional import normalize

        self.face_helper.clean_all()

        if has_aligned:
            img = cv2.resize(img, (512, 512))
            self.face_helper.cropped_faces = [img]
        else:
            self.face_helper.read_image(img)
            self.face_helper.get_face_landmarks_5(only_center_face=only_center_face, eye_dist_threshold=5)
            self.face_helper.align_warp_face()

        for cropped_face in self.face_helper.cropped_faces:
            cropped_face_t = img2tensor(cropped_face / 255.0, bgr2rgb=True, float32=True)
            normalize(cropped_face_t, (0.5, 0.5, 0.5), (0.5, 0.5, 0.5), inplace=True)
            cropped_face_t = cropped_face_t.unsqueeze(0).to(self.device)

            try:
                output = self.net(cropped_face_t, w=w, adain=True)[0]
                restored_face = tensor2img(output.squeeze(0), rgb2bgr=True, min_max=(-1, 1))
            except RuntimeError as error:
                logger.warning("Failed inference for CodeFormer: %s", error)
                restored_face = cropped_face

            restored_face = restored_face.astype("uint8")
            self.face_helper.add_restored_face(restored_face)

        if not has_aligned and paste_back:
            bg_img = self.bg_upsampler.enhance(img, outscale=self.upscale)[0] if self.bg_upsampler else None
            self.face_helper.get_inverse_affine(None)
            restored_img = self.face_helper.paste_faces_to_input_image(upsample_img=bg_img)
            return self.face_helper.cropped_faces, self.face_helper.restored_faces, restored_img
        return self.face_helper.cropped_faces, self.face_helper.restored_faces, None


def _build_engine(device: str, upscale: int, use_bg_upsampler: bool) -> _CodeformerEngine:
    """Constructs the real CodeFormer net + FaceRestoreHelper. All imports are local so
    build_codeformer_restorer can catch any import/download/load failure and fall back
    to None; this is also the seam tests patch to stay offline."""
    from basicsr.utils.download_util import load_file_from_url
    from facexlib.utils.face_restoration_helper import FaceRestoreHelper

    from restore_engine.vendor.codeformer_arch import CodeFormer

    net = CodeFormer(
        dim_embd=512, codebook_size=1024, n_head=8, n_layers=9,
        connect_list=["32", "64", "128", "256"],
    ).to(device)
    ckpt_path = load_file_from_url(
        url=config.CODEFORMER_URL, model_dir="weights/CodeFormer", progress=True, file_name=None,
    )
    checkpoint = torch.load(ckpt_path, map_location=device)
    net.load_state_dict(checkpoint["params_ema"])
    net.eval()

    face_helper = FaceRestoreHelper(
        upscale, face_size=512, crop_ratio=(1, 1),
        det_model="retinaface_resnet50", save_ext="png",
        use_parse=True, device=device,
    )

    bg_upsampler = None
    if use_bg_upsampler:
        from restore_engine.models.gfpgan_restorer import _build_bg_upsampler
        bg_upsampler = _build_bg_upsampler(device)

    return _CodeformerEngine(net, face_helper, device, upscale, bg_upsampler)


class CodeformerRestorer(FaceRestorer):
    name = "codeformer"

    def __init__(self, engine: _CodeformerEngine, device: str):
        self._engine = engine
        self.device = device

    def restore(self, image_bgr: np.ndarray, fidelity: float | None = 0.5) -> Restoration:
        w = 0.5 if fidelity is None else fidelity
        cropped, restored, restored_img = self._engine.enhance(
            image_bgr, has_aligned=False, only_center_face=False, paste_back=True, w=w,
        )
        faces = [
            FaceResult(index=i, cropped=c, restored=r)
            for i, (c, r) in enumerate(zip(cropped, restored))
        ]
        return Restoration(restored_image=restored_img, faces=faces, model=self.name)


def build_codeformer_restorer(device: str | None = None, upscale: int = config.DEFAULT_UPSCALE,
                              use_bg_upsampler: bool = True) -> CodeformerRestorer | None:
    """Returns a CodeformerRestorer, or None if CodeFormer can't be loaded on this
    machine (missing/incompatible deps, failed weight download, etc). Callers treat
    None as "unavailable" and fall back to another restorer (e.g. GFPGAN)."""
    device = config.select_device(device)
    try:
        engine = _build_engine(device, upscale, use_bg_upsampler)
    except Exception:
        logger.exception("CodeFormer unavailable on this machine; falling back")
        return None
    return CodeformerRestorer(engine, device)
