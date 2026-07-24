"""Model-agnostic face restoration contract."""
from __future__ import annotations

from abc import ABC, abstractmethod

import numpy as np

from restore_engine.types import Restoration


class FaceRestorer(ABC):
    name: str
    device: str

    @abstractmethod
    def restore(self, image_bgr: np.ndarray) -> Restoration:
        """Restore faces in a BGR uint8 image; return the full result + face crops."""
        raise NotImplementedError
