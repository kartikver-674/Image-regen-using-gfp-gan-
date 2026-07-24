#!/usr/bin/env python3
"""Restore old photos with GFPGAN, then save side-by-side comparisons.

Runnable port of GFP_GAN_Old_photo_restoration.ipynb: instead of displaying
images (Colab-only cv2_imshow/plt), inference results and comparison figures
are written to disk.

Usage:
    python setup.py-once ->  bash setup.sh
    python restore.py                       # inputs/tests -> results
    python restore.py -i my_imgs -o out -s 4
"""
import argparse
import glob
import os
import subprocess
import sys

import cv2
import matplotlib

matplotlib.use("Agg")  # headless: save figures, never open a window
import matplotlib.pyplot as plt

GFPGAN_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "GFPGAN")


def run_inference(inp, out, version, scale):
    cmd = [
        sys.executable, "inference_gfpgan.py",
        "-i", inp, "-o", out,
        "-v", version, "-s", str(scale),
        "--bg_upsampler", "realesrgan",
    ]
    subprocess.run(cmd, cwd=GFPGAN_DIR, check=True)


def save_comparisons(out):
    """Write per-face input|output comparison PNGs into <out>/comparisons/."""
    face_dir = os.path.join(GFPGAN_DIR, out, "cropped_faces")
    restored_dir = os.path.join(GFPGAN_DIR, out, "restored_faces")
    comp_dir = os.path.join(GFPGAN_DIR, out, "comparisons")
    os.makedirs(comp_dir, exist_ok=True)

    inputs = sorted(glob.glob(os.path.join(face_dir, "*")))
    outputs = sorted(glob.glob(os.path.join(restored_dir, "*")))
    for inp, outp in zip(inputs, outputs):
        img1 = cv2.cvtColor(cv2.imread(inp), cv2.COLOR_BGR2RGB)
        img2 = cv2.cvtColor(cv2.imread(outp), cv2.COLOR_BGR2RGB)
        plt.figure(figsize=(20, 10))
        for i, (img, title) in enumerate([(img1, "Input"), (img2, "Output")], 1):
            plt.subplot(1, 2, i)
            plt.title(title, fontsize=12)
            plt.imshow(img)
            plt.axis("off")
        dest = os.path.join(comp_dir, os.path.basename(inp) + ".png")
        plt.savefig(dest, bbox_inches="tight")
        plt.close()
        print("Saved comparison:", dest)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("-i", "--input", default="inputs/tests", help="input dir (relative to GFPGAN/)")
    p.add_argument("-o", "--output", default="results", help="output dir (relative to GFPGAN/)")
    p.add_argument("-v", "--version", default="1.3", help="model version")
    p.add_argument("-s", "--scale", type=int, default=2, help="upscale factor")
    args = p.parse_args()

    if not os.path.isdir(GFPGAN_DIR):
        sys.exit("GFPGAN not found. Run: bash setup.sh")

    os.makedirs(os.path.join(GFPGAN_DIR, args.input), exist_ok=True)
    run_inference(args.input, args.output, args.version, args.scale)
    save_comparisons(args.output)
    print(f"\nDone. Results in GFPGAN/{args.output}/")


if __name__ == "__main__":
    main()
