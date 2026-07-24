# engine/tests/test_gfpgan_restorer.py
from unittest.mock import MagicMock, patch

import numpy as np

from restore_engine.models import gfpgan_restorer as gr


def test_build_and_restore_maps_gfpganer_output():
    # Fake GFPGANer whose .enhance returns (cropped_faces, restored_faces, restored_img)
    fake = MagicMock()
    face_a = np.zeros((4, 4, 3), dtype=np.uint8)
    fake.enhance.return_value = ([face_a], [face_a + 1], np.zeros((16, 16, 3), np.uint8))

    with patch.object(gr, "GFPGANer", return_value=fake) as ctor, \
         patch.object(gr, "_build_bg_upsampler", return_value=None):
        r = gr.build_gfpgan_restorer(device="cpu", upscale=2, use_bg_upsampler=False)
        out = r.restore(np.zeros((8, 8, 3), dtype=np.uint8))

    assert ctor.called
    assert r.name == "gfpgan-1.4"
    assert r.device == "cpu"
    assert out.model == "gfpgan-1.4"
    assert out.restored_image.shape == (16, 16, 3)
    assert len(out.faces) == 1
    assert out.faces[0].index == 0
    # mapping must preserve source->field: cropped from cropped-faces list, restored from restored-faces list
    assert np.array_equal(out.faces[0].cropped, face_a)
    assert np.array_equal(out.faces[0].restored, face_a + 1)
    # enhance called with paste_back=True
    _, kwargs = fake.enhance.call_args
    assert kwargs.get("paste_back") is True


def test_restore_handles_zero_faces():
    fake = MagicMock()
    fake.enhance.return_value = ([], [], np.zeros((8, 8, 3), np.uint8))
    with patch.object(gr, "GFPGANer", return_value=fake), \
         patch.object(gr, "_build_bg_upsampler", return_value=None):
        r = gr.build_gfpgan_restorer(device="cpu", use_bg_upsampler=False)
        out = r.restore(np.zeros((8, 8, 3), dtype=np.uint8))
    assert out.faces == []


def test_build_wires_bg_upsampler_when_enabled():
    sentinel = object()
    fake = MagicMock()
    with patch.object(gr, "GFPGANer", return_value=fake) as ctor, \
         patch.object(gr, "_build_bg_upsampler", return_value=sentinel) as bg_ctor:
        r = gr.build_gfpgan_restorer(device="cpu", use_bg_upsampler=True)

    bg_ctor.assert_called_once_with("cpu")
    assert ctor.call_args.kwargs["bg_upsampler"] is sentinel
    assert r.device == "cpu"
