"""Device selection and model constants."""
import torch

GFPGAN_V14_URL = "https://github.com/TencentARC/GFPGAN/releases/download/v1.3.4/GFPGANv1.4.pth"
REALESRGAN_X2_URL = "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.1/RealESRGAN_x2plus.pth"
CODEFORMER_URL = "https://github.com/sczhou/CodeFormer/releases/download/v0.1.0/codeformer.pth"
DEFAULT_UPSCALE = 2

# Thresholds for analysis/routing
BLUR_SHARP_THRESHOLD = 100.0
SMALL_FACE_PX = 256
LOW_DET_SCORE = 0.85
GRAYSCALE_SAT_THRESHOLD = 10.0
MAX_UPLOAD_BYTES = 26214400
MAX_INPUT_DIM = 2000
JOB_TIMEOUT_S = 300


def select_device(prefer: str | None = None) -> str:
    """Pick a torch device. Auto = cuda -> cpu. MPS is opt-in via prefer='mps'."""
    if prefer:
        return prefer
    if torch.cuda.is_available():
        return "cuda"
    return "cpu"
