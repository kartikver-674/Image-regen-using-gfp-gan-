# Old Photo Restoration (GFPGAN)

Runnable port of `GFP_GAN_Old_photo_restoration.ipynb` (originally Google Colab).
Wraps [TencentARC/GFPGAN](https://github.com/TencentARC/GFPGAN) to restore faces
in old/degraded photos and upscale the background with Real-ESRGAN.

## Requirements
- Python 3.8–3.10, `git`, `wget`
- A GPU is recommended (works on CPU, just slow)

## Setup (once)
```bash
bash setup.sh
```
Clones GFPGAN, installs dependencies, and downloads the `GFPGANv1.3.pth` model.

## Run
```bash
# Put your images in GFPGAN/inputs/tests/ then:
python restore.py

# Or point at your own dirs / change scale:
python restore.py -i my_photos -o my_results -s 4
```

Outputs land in `GFPGAN/<output>/`:
- `restored_imgs/` — full restored images
- `restored_faces/`, `cropped_faces/` — per-face crops
- `comparisons/` — side-by-side input vs. output PNGs
