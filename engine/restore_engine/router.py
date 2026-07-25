"""Transparent, rule-based model selection. Pure function; returns a plan + rationale."""
from __future__ import annotations

from restore_engine import config
from restore_engine.types import Analysis, RestoreOptions, RoutePlan


def route(analysis: Analysis, options: RestoreOptions, codeformer_available: bool = True) -> RoutePlan:
    upscale = options.upscale
    bg = options.background_upscale
    colorize = analysis.is_grayscale

    def plan(model, fidelity, rationale):
        return RoutePlan(face_model=model, fidelity=fidelity, upscale=upscale,
                         background_upscale=bg, colorize_recommended=colorize, rationale=rationale)

    if options.mode == "manual":
        model = options.model or "gfpgan"
        if model == "codeformer" and not codeformer_available:
            return plan("gfpgan", None, "manual: CodeFormer unavailable → GFPGAN")
        fidelity = options.fidelity if model == "codeformer" else None
        return plan(model, fidelity, f"manual: {model}")

    if analysis.n_faces == 0:
        return plan("gfpgan", None, "no faces detected → background upscale only (Real-ESRGAN)")

    degraded = (
        analysis.min_face_size < config.SMALL_FACE_PX
        or min(f.det_score for f in analysis.faces) < config.LOW_DET_SCORE
        or analysis.blur_score < config.BLUR_SHARP_THRESHOLD
    )
    if degraded:
        if codeformer_available:
            return plan("codeformer", 0.7, "small/low-quality faces → CodeFormer (robust)")
        return plan("gfpgan", None, "degraded faces but CodeFormer unavailable → GFPGAN")
    return plan("gfpgan", None, "clear faces → GFPGAN (natural)")
