import numpy as np

from restore_engine import pipeline
from restore_engine.io import write_image
from restore_engine.models.base import FaceRestorer
from restore_engine.types import FaceResult, Restoration, RestoreOptions


class RecordingRestorer(FaceRestorer):
    def __init__(self, name):
        self.name = name
        self.device = "cpu"
        self.last_fidelity = "unset"

    def restore(self, image_bgr, fidelity=None):
        self.last_fidelity = fidelity
        f = FaceResult(index=0, cropped=image_bgr.copy(), restored=image_bgr.copy())
        return Restoration(restored_image=image_bgr.copy(), faces=[f], model=self.name)


def _img(tmp_path):
    p = tmp_path / "in.png"
    write_image(np.full((16, 16, 3), 90, dtype=np.uint8), p)
    return p


def test_restore_smart_routes_and_attaches_metadata(tmp_path):
    gfpgan = RecordingRestorer("gfpgan")
    codeformer = RecordingRestorer("codeformer")
    restorers = {"gfpgan": gfpgan, "codeformer": codeformer}

    # detector reports one tiny (degraded) face -> router picks codeformer
    def detector(_img):
        return [((0, 0, 30, 30), 0.99)]

    def get_restorer(model, upscale):
        return restorers[model]

    result = pipeline.restore_smart(
        _img(tmp_path), RestoreOptions(mode="auto"), get_restorer, detector,
        codeformer_available=True,
    )
    assert result.model == "codeformer"
    assert result.routing.face_model == "codeformer"
    assert codeformer.last_fidelity == 0.7        # router-chosen fidelity forwarded
    assert result.analysis.n_faces == 1
    assert result.device == "cpu" and result.elapsed_s >= 0


def test_restore_smart_writes_outputs(tmp_path):
    def detector(_img):
        return [((0, 0, 500, 500), 0.99)]  # clear face -> gfpgan

    r = RecordingRestorer("gfpgan")
    out = tmp_path / "out"
    pipeline.restore_smart(_img(tmp_path), RestoreOptions(), lambda m, u: r, detector,
                           output_dir=out, codeformer_available=False)
    assert (out / "restored_imgs").is_dir() and list((out / "restored_imgs").glob("*"))
