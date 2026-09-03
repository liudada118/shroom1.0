import sys


_config = {}
_previous = None


def _runtime_worker():
    for module_name in ("onbed_filter_example", "__main__"):
        module = sys.modules.get(module_name)
        if module is not None and callable(getattr(module, "realtime_server", None)):
            return module
    raise RuntimeError("Shroom Python worker does not expose realtime_server")


def initialize(config, resources):
    global _config, _previous
    _config = dict(config or {})
    _previous = None


def process(request):
    global _previous
    values = list(request.get("normalized_data") or [])
    if len(values) != 4096:
        raise ValueError(f"foot-pressure-realtime expects 4096 values, got {len(values)}")
    result = _runtime_worker().realtime_server(
        values,
        _previous,
        fps=float(_config.get("fps", 20.0)),
    )
    _previous = values
    left = (result or {}).get("left") or {}
    right = (result or {}).get("right") or {}
    return {
        "data": values,
        "metrics": {
            "leftPressure": left.get("pressure", 0.0),
            "leftArea": left.get("area", 0.0),
            "leftCopX": left.get("cop_x", 0.0),
            "leftCopY": left.get("cop_y", 0.0),
            "leftCopSpeed": left.get("cop_speed", 0.0),
            "rightPressure": right.get("pressure", 0.0),
            "rightArea": right.get("area", 0.0),
            "rightCopX": right.get("cop_x", 0.0),
            "rightCopY": right.get("cop_y", 0.0),
            "rightCopSpeed": right.get("cop_speed", 0.0),
        },
    }


def reset(reason):
    global _previous
    _previous = None


def shutdown():
    reset("shutdown")
