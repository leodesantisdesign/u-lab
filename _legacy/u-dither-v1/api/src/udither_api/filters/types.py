from __future__ import annotations

from typing import Any, Protocol, Tuple, TypeAlias

import numpy as np

ParamsType: TypeAlias = Any
MetaDict: TypeAlias = dict[str, Any]
ApplyResult: TypeAlias = Tuple[np.ndarray, MetaDict]


class Filter(Protocol):
    def apply(self, rgb: np.ndarray, params: ParamsType) -> ApplyResult:
        ...
