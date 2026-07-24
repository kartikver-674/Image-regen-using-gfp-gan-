"""Device selection and model constants."""
import torch

GFPGAN_V14_URL = "https://github.com/TencentARC/GFPGAN/releases/download/v1.3.4/GFPGANv1.4.pth"
REALESRGAN_X2_URL = "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.1/RealESRGAN_x2plus.pth"
CODEFORMER_URL = "https://github.com/sczhou/CodeFormer/releases/download/v0.1.0/codeformer.pth"
DEFAULT_UPSCALE = 2


def select_device(prefer: str | None = None) -> str:
    """Pick a torch device. Auto = cuda -> cpu. MPS is opt-in via prefer='mps'."""
    if prefer:
        return prefer
    if torch.cuda.is_available():
        return "cuda"
    return "cpu"
