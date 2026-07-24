#!/usr/bin/env bash
# One-time setup: install the restore engine (pulls GFPGAN 1.4 + Real-ESRGAN from pip).
# Model weights download automatically on first run.
# Pins numpy<2/torch<2.2/torchvision<0.17 — run this inside a Python 3.10/3.11
# virtualenv, not a shared/system environment, or it may downgrade existing packages.
set -euo pipefail
cd "$(dirname "$0")"

if [ -z "${VIRTUAL_ENV:-}" ]; then
  echo "Warning: no virtualenv active. Recommended: python3.11 -m venv .venv && source .venv/bin/activate"
fi

python -m pip install -e "engine[dev]"

echo "Setup done. Run:  restory -i path/to/photo.jpg -o results"
echo "Or the dev self-check:  cd engine && python -m restore_engine.demo"
