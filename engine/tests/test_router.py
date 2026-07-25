from restore_engine import router
from restore_engine.types import Analysis, FaceInfo, RestoreOptions


def _analysis(faces, blur=500.0, gray=False, w=800, h=600):
    return Analysis(width=w, height=h, megapixels=round(w * h / 1e6, 3),
                    is_grayscale=gray, blur_score=blur, faces=faces)


def _face(size, score=0.99):
    return FaceInfo(bbox=(0, 0, size, size), det_score=score, crop_size=size)


def test_no_faces_routes_background_only():
    p = router.route(_analysis([]), RestoreOptions())
    assert p.face_model == "gfpgan"
    assert "no faces" in p.rationale.lower()


def test_clear_faces_route_gfpgan():
    p = router.route(_analysis([_face(500)]), RestoreOptions())
    assert p.face_model == "gfpgan" and p.fidelity is None
    assert "gfpgan" in p.rationale.lower()


def test_small_faces_route_codeformer_when_available():
    p = router.route(_analysis([_face(100)]), RestoreOptions(), codeformer_available=True)
    assert p.face_model == "codeformer" and p.fidelity is not None
    assert "codeformer" in p.rationale.lower()


def test_severe_faces_route_hybrid_chain():
    p = router.route(_analysis([_face(60)]), RestoreOptions(), codeformer_available=True)
    assert p.face_model == "gfpgan" and p.refine_model == "codeformer" and p.is_chain
    assert p.refine_fidelity is not None
    assert "hybrid" in p.rationale.lower()


def test_manual_hybrid_routes_chain():
    p = router.route(_analysis([_face(500)]),
                     RestoreOptions(mode="manual", model="hybrid", fidelity=0.8),
                     codeformer_available=True)
    assert p.face_model == "gfpgan" and p.refine_model == "codeformer"
    assert p.refine_fidelity == 0.8


def test_manual_hybrid_falls_back_when_codeformer_unavailable():
    p = router.route(_analysis([_face(500)]),
                     RestoreOptions(mode="manual", model="hybrid"),
                     codeformer_available=False)
    assert p.face_model == "gfpgan" and p.refine_model is None and not p.is_chain


def test_degraded_faces_fall_back_to_gfpgan_when_codeformer_unavailable():
    p = router.route(_analysis([_face(100)]), RestoreOptions(), codeformer_available=False)
    assert p.face_model == "gfpgan"
    assert "unavailable" in p.rationale.lower()


def test_manual_mode_honors_user_model():
    p = router.route(_analysis([_face(500)]),
                     RestoreOptions(mode="manual", model="codeformer", fidelity=0.3, upscale=4),
                     codeformer_available=True)
    assert p.face_model == "codeformer" and p.fidelity == 0.3 and p.upscale == 4


def test_grayscale_sets_colorize_recommended():
    p = router.route(_analysis([_face(500)], gray=True), RestoreOptions())
    assert p.colorize_recommended is True
