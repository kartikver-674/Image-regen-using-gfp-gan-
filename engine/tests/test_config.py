# engine/tests/test_config.py
from unittest.mock import patch

from restore_engine import config


def test_select_device_prefers_cuda_when_available():
    with patch("torch.cuda.is_available", return_value=True):
        assert config.select_device() == "cuda"


def test_select_device_falls_back_to_cpu():
    with patch("torch.cuda.is_available", return_value=False):
        assert config.select_device() == "cpu"


def test_mps_is_opt_in_only_not_auto():
    # even if MPS is available, auto must not pick it
    with patch("torch.cuda.is_available", return_value=False), \
         patch("torch.backends.mps.is_available", return_value=True):
        assert config.select_device() == "cpu"


def test_explicit_prefer_is_honored():
    assert config.select_device(prefer="cpu") == "cpu"
    with patch("torch.backends.mps.is_available", return_value=True):
        assert config.select_device(prefer="mps") == "mps"
