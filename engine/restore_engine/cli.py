# engine/restore_engine/cli.py
"""Local CLI — replaces the old subprocess restore.py."""
from __future__ import annotations

import argparse

from restore_engine import config
from restore_engine.models.gfpgan_restorer import build_gfpgan_restorer
from restore_engine.pipeline import restore_path


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Restore old photos with GFPGAN 1.4.")
    p.add_argument("-i", "--input", required=True, help="input image or directory")
    p.add_argument("-o", "--output", required=True, help="output directory")
    p.add_argument("-s", "--scale", type=int, default=config.DEFAULT_UPSCALE, help="upscale factor")
    p.add_argument("--device", default=None, choices=["cuda", "cpu", "mps"],
                   help="cuda | cpu | mps (default: auto)")
    p.add_argument("--no-bg", action="store_true", help="disable Real-ESRGAN background upsampling")
    return p


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    restorer = build_gfpgan_restorer(
        device=args.device, upscale=args.scale, use_bg_upsampler=not args.no_bg,
    )
    results = restore_path(args.input, restorer, args.output)
    for r in results:
        print(f"{r.input_path}: {len(r.faces)} face(s), {r.elapsed_s:.1f}s -> {args.output}")
    print(f"Done. {len(results)} image(s) -> {args.output}/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
