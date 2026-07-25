from restore_engine.types import Analysis, FaceInfo, RestoreOptions, RoutePlan


def test_restore_options_defaults():
    o = RestoreOptions()
    assert o.mode == "auto" and o.model is None and o.upscale == 2
    assert o.fidelity == 0.7 and o.background_upscale is True


def test_analysis_face_properties():
    a = Analysis(width=100, height=50, megapixels=0.005, is_grayscale=False, blur_score=42.0,
                 faces=[FaceInfo(bbox=(0, 0, 20, 20), det_score=0.9, crop_size=20),
                        FaceInfo(bbox=(0, 0, 60, 60), det_score=0.99, crop_size=60)])
    assert a.n_faces == 2 and a.min_face_size == 20


def test_analysis_no_faces_min_size_zero():
    a = Analysis(width=10, height=10, megapixels=0.0001, is_grayscale=True, blur_score=1.0, faces=[])
    assert a.n_faces == 0 and a.min_face_size == 0


def test_routeplan_construct():
    p = RoutePlan(face_model="gfpgan", fidelity=None, upscale=2, background_upscale=True,
                  colorize_recommended=False, rationale="clear faces → GFPGAN (natural)")
    assert p.face_model == "gfpgan" and "GFPGAN" in p.rationale
