# Old Photo Restoration Engine

In-process GFPGAN 1.4 face restoration with Real-ESRGAN background upsampling,
behind a clean, model-agnostic `FaceRestorer` interface. Milestone M0 of the
[product design spec](docs/superpowers/specs/2026-07-24-old-photo-restoration-product-design.md).

## Requirements
- Python ≥ 3.10 (deps pin `numpy<2`, `torchvision<0.17`, `torch<2.2` for the GFPGAN/basicsr stack)
- macOS/Linux; GPU optional. **CPU is the reliable Mac path; MPS is opt-in (`--device mps`).**

## Setup (once)
Use a **Python 3.10 or 3.11 virtualenv** before installing — the pins above
(`numpy<2`, `torch<2.2`, `torchvision<0.17`) can force-downgrade packages in a
shared/system environment.
```bash
bash setup.sh          # pip-installs engine/ ; weights auto-download on first run
```

## Run
```bash
restory -i photo.jpg -o results             # single image
restory -i my_photos/ -o results -s 4       # a folder, 4x upscale
restory -i photo.jpg -o results --no-bg     # skip background upsampling (faster on CPU)
```
Outputs land in `results/`: `restored_imgs/`, `restored_faces/`, `cropped_faces/`, `comparisons/`.

## Develop
```bash
cd engine && python -m pytest -m "not slow" -v   # fast tests (no weights)
python -m restore_engine.demo                    # real-model self-check
```
