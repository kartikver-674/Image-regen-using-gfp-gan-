import numpy as np

from restore_engine import config, pipeline
from restore_engine.io import write_image
from restore_engine.models.base import FaceRestorer
from restore_engine.types import FaceResult, Restoration, RestoreOptions


class RecordingRestorer(FaceRestorer):
    def __init__(self, name, bump=0):
        self.name = name
        self.device = "cpu"
        self.last_fidelity = "unset"
        self.last_input = None
        self._bump = bump  # brightens output so chained stages are distinguishable

    def restore(self, image_bgr, fidelity=None):
        self.last_fidelity = fidelity
        self.last_input = image_bgr
        out = np.clip(image_bgr.astype(np.int16) + self._bump, 0, 255).astype(np.uint8)
        f = FaceResult(index=0, cropped=image_bgr.copy(), restored=out.copy())
        return Restoration(restored_image=out, faces=[f], model=self.name)


def _img(tmp_path):
    p = tmp_path / "in.png"
    write_image(np.full((16, 16, 3), 90, dtype=np.uint8), p)  # flat -> blur_score 0 (severe)
    return p


def _sharp_img(tmp_path):
    # High-frequency noise -> high Laplacian variance, so routing keys off face size, not blur.
    rng = np.random.default_rng(0)
    p = tmp_path / "sharp.png"
    write_image(rng.integers(0, 255, (64, 64, 3), dtype=np.uint8), p)
    return p


def test_restore_smart_routes_and_attaches_metadata(tmp_path):
    gfpgan = RecordingRestorer("gfpgan")
    codeformer = RecordingRestorer("codeformer")
    restorers = {"gfpgan": gfpgan, "codeformer": codeformer}

    # detector reports one small (degraded, not severe) face -> router picks codeformer
    def detector(_img):
        return [((0, 0, 120, 120), 0.99)]

    def get_restorer(model, upscale):
        return restorers[model]

    result = pipeline.restore_smart(
        _sharp_img(tmp_path), RestoreOptions(mode="auto"), get_restorer, detector,
        codeformer_available=True,
    )
    assert result.model == "codeformer"
    assert result.routing.face_model == "codeformer"
    assert codeformer.last_fidelity == 0.7        # router-chosen fidelity forwarded
    assert result.analysis.n_faces == 1
    assert result.device == "cpu" and result.elapsed_s >= 0


def test_restore_smart_chains_when_severe(tmp_path):
    gfpgan = RecordingRestorer("gfpgan", bump=10)
    codeformer = RecordingRestorer("codeformer", bump=20)
    restorers = {"gfpgan": gfpgan, "codeformer": codeformer}

    def detector(_img):
        return [((0, 0, 20, 20), 0.99)]  # 20px face < TINY_FACE_PX -> severe -> chain

    def get_restorer(model, upscale, use_bg_upsampler=True):
        return restorers[model]

    result = pipeline.restore_smart(
        _img(tmp_path), RestoreOptions(mode="auto"), get_restorer, detector,
        codeformer_available=True,
    )
    assert result.routing.refine_model == "codeformer"
    assert result.model == "gfpgan+codeformer"          # both stages ran, in order
    assert gfpgan.last_fidelity is None
    assert codeformer.last_fidelity == config.HYBRID_REFINE_FIDELITY
    # stage 2 ran on stage 1's OUTPUT (input brightened by gfpgan's +10 bump)
    assert int(codeformer.last_input.mean()) == int(gfpgan.last_input.mean()) + 10
    # before/after pairs the ORIGINAL crop with the FINAL restored crop
    assert result.faces[0].restored.mean() > result.faces[0].cropped.mean()


def test_restore_smart_downscales_oversize_input(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "MAX_INPUT_DIM", 32)  # cheap to exercise without a huge fixture
    p = tmp_path / "in.png"
    write_image(np.full((64, 16, 3), 90, dtype=np.uint8), p)  # longest side 64 > cap
    r = RecordingRestorer("gfpgan")

    result = pipeline.restore_smart(
        p, RestoreOptions(), lambda m, u: r, lambda _img: [], codeformer_available=False,
    )
    assert result.analysis.height == 32 and result.analysis.width == 8


def test_restore_smart_writes_outputs(tmp_path):
    def detector(_img):
        return [((0, 0, 500, 500), 0.99)]  # clear face -> gfpgan

    r = RecordingRestorer("gfpgan")
    out = tmp_path / "out"
    pipeline.restore_smart(_img(tmp_path), RestoreOptions(), lambda m, u: r, detector,
                           output_dir=out, codeformer_available=False)
    assert (out / "restored_imgs").is_dir() and list((out / "restored_imgs").glob("*"))
