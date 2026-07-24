# engine/tests/test_codeformer_restorer.py
from unittest.mock import MagicMock, patch

import numpy as np

from restore_engine.models import codeformer_restorer as cr


def test_build_and_restore_maps_output_and_passes_fidelity():
    # Fake the underlying restore machinery the CodeformerRestorer wraps.
    # Whatever object the spike settled on, the restorer must expose it as a
    # patchable module-level name so this test can substitute a fake that
    # returns (cropped_faces, restored_faces, restored_img).
    face = np.zeros((4, 4, 3), dtype=np.uint8)
    fake_engine = MagicMock()
    fake_engine.enhance.return_value = ([face], [face + 1], np.zeros((16, 16, 3), np.uint8))

    with patch.object(cr, "_build_engine", return_value=fake_engine):
        r = cr.build_codeformer_restorer(device="cpu", use_bg_upsampler=False)
        assert r is not None
        out = r.restore(np.zeros((8, 8, 3), dtype=np.uint8), fidelity=0.7)

    assert r.name == "codeformer"
    assert out.model == "codeformer"
    assert out.restored_image.shape == (16, 16, 3)
    assert len(out.faces) == 1
    assert np.array_equal(out.faces[0].cropped, face)
    assert np.array_equal(out.faces[0].restored, face + 1)
    # fidelity was forwarded to the enhance call (w / weight kwarg)
    _, kwargs = fake_engine.enhance.call_args
    assert 0.7 in kwargs.values()
