#!/usr/bin/env bash
# One-time setup: clone GFPGAN, install deps, download the pretrained model.
set -euo pipefail
cd "$(dirname "$0")"

MODEL=GFPGANv1.3.pth
MODEL_URL=https://github.com/TencentARC/GFPGAN/releases/download/v1.3.0/$MODEL

[ -d GFPGAN ] || git clone https://github.com/TencentARC/GFPGAN.git

pip install -r requirements.txt
pip install -r GFPGAN/requirements.txt
(cd GFPGAN && python setup.py develop)

mkdir -p GFPGAN/experiments/pretrained_models
if [ ! -f "GFPGAN/experiments/pretrained_models/$MODEL" ]; then
  wget -O "GFPGAN/experiments/pretrained_models/$MODEL" "$MODEL_URL"
fi

echo "Setup done. Put images in GFPGAN/inputs/tests/ and run: python restore.py"
