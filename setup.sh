#!/usr/bin/env bash
# One-time setup: install the restore engine (pulls GFPGAN 1.4 + Real-ESRGAN from pip).
# Model weights download automatically on first run.
set -euo pipefail
cd "$(dirname "$0")"

python -m pip install -e "engine[dev]"

echo "Setup done. Run:  restory -i path/to/photo.jpg -o results"
echo "Or the dev self-check:  cd engine && python -m restore_engine.demo"
