"""Real-model self-check: restore one sample image end-to-end.

Skipped automatically if no sample image is available. This is the runnable
proof that the real GFPGAN path works on this machine.
"""
from __future__ import annotations

import sys
import tempfile
from pathlib import Path

from restore_engine import pipeline
from restore_engine.models.gfpgan_restorer import build_gfpgan_restorer

_DEFAULT_SAMPLE = Path(__file__).parent.parent / "tests" / "fixtures" / "sample_face.jpg"


def main(sample_path: str | None = None, output_dir: str | None = None) -> None:
    sample = Path(sample_path) if sample_path else _DEFAULT_SAMPLE
    if not sample.exists():
        print(f"[demo] no sample at {sample}; drop a face photo there to run. Skipping.")
        return
    out = output_dir or tempfile.mkdtemp(prefix="restory_demo_")
    restorer = build_gfpgan_restorer(use_bg_upsampler=True)
    result = pipeline.restore_image(sample, restorer, output_dir=out)
    assert result.restored_image is not None
    print(f"[demo] device={result.device} faces={len(result.faces)} "
          f"time={result.elapsed_s:.1f}s -> {out}/restored_imgs/")


if __name__ == "__main__":
    main(*sys.argv[1:])
