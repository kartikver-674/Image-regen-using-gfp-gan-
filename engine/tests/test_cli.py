# engine/tests/test_cli.py
from unittest.mock import patch

import numpy as np

from restore_engine import cli
from restore_engine.io import write_image
from restore_engine.models.base import FaceRestorer
from restore_engine.types import FaceResult, Restoration


class FakeRestorer(FaceRestorer):
    name = "fake"
    device = "cpu"

    def restore(self, image_bgr):
        f = FaceResult(index=0, cropped=image_bgr.copy(), restored=image_bgr.copy())
        return Restoration(restored_image=image_bgr.copy(), faces=[f], model="fake")


def test_parser_defaults():
    args = cli.build_parser().parse_args(["-i", "in", "-o", "out"])
    assert args.input == "in" and args.output == "out"
    assert args.scale == 2 and args.device is None and args.no_bg is False


def test_main_runs_pipeline_and_writes_output(tmp_path):
    src = tmp_path / "p.png"
    write_image(np.full((8, 8, 3), 50, dtype=np.uint8), src)
    out = tmp_path / "out"
    with patch.object(cli, "build_gfpgan_restorer", return_value=FakeRestorer()) as build:
        rc = cli.main(["-i", str(src), "-o", str(out)])
    assert rc == 0
    assert build.called
    assert list((out / "restored_imgs").glob("*.png"))


def test_main_forwards_device_and_no_bg(tmp_path):
    src = tmp_path / "p.png"
    write_image(np.full((8, 8, 3), 50, dtype=np.uint8), src)
    with patch.object(cli, "build_gfpgan_restorer", return_value=FakeRestorer()) as build:
        cli.main(["-i", str(src), "-o", str(tmp_path / "o"), "--device", "cpu", "--no-bg", "-s", "4"])
    _, kwargs = build.call_args
    assert kwargs == {"device": "cpu", "upscale": 4, "use_bg_upsampler": False}
