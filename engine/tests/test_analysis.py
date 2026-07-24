import cv2
import numpy as np

from restore_engine import analysis


def test_is_grayscale_true_for_gray_image():
    gray = np.full((32, 32, 3), 128, dtype=np.uint8)  # equal channels => no saturation
    assert analysis.is_grayscale(gray) is True


def test_is_grayscale_false_for_colorful_image():
    img = np.zeros((32, 32, 3), dtype=np.uint8)
    img[..., 2] = 255  # saturated red (BGR)
    assert analysis.is_grayscale(img) is False


def test_blur_score_higher_for_sharp_than_blurred():
    sharp = np.zeros((64, 64, 3), dtype=np.uint8)
    sharp[::4, :] = 255  # high-frequency stripes
    blurred = cv2.GaussianBlur(sharp, (9, 9), 5)
    assert analysis.blur_score(sharp) > analysis.blur_score(blurred)


def test_analyze_uses_injected_detector():
    img = np.zeros((50, 100, 3), dtype=np.uint8)

    def fake_detector(_image):
        return [((0, 0, 20, 20), 0.9), ((0, 0, 60, 60), 0.99)]

    a = analysis.analyze(img, fake_detector)
    assert a.width == 100 and a.height == 50
    assert a.n_faces == 2 and a.min_face_size == 20
    assert a.faces[0].det_score == 0.9
