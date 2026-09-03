import sys


_config = {}


def _runtime_worker():
    for module_name in ("onbed_filter_example", "__main__"):
        module = sys.modules.get(module_name)
        if module is not None and callable(getattr(module, "pet_care_step", None)):
            return module
    raise RuntimeError("Shroom Python worker does not expose pet_care_step")


def initialize(config, resources):
    global _config
    _config = dict(config or {})
    _runtime_worker().reset_pet_care()


def process(request):
    values = list(request.get("normalized_data") or [])
    if len(values) != 1024:
        raise ValueError(f"pet-care expects 1024 values, got {len(values)}")
    result = _runtime_worker().pet_care_step(
        values,
        species=float(_config.get("species", 1.0)),
        threshold_factor=float(_config.get("thresholdFactor", 1.0)),
    )
    return {
        "data": values,
        "metrics": {
            "breathRate": result.get("breath_rate", 0.0),
            "postureState": result.get("posture_state", 0.0),
            "isMotion": result.get("is_motion", 0.0),
            "snrDb": result.get("snr_db", -99.0),
            "quality": result.get("quality", 0.0),
            "bedExitFlag": result.get("bed_exit_flag", 0.0),
            "pressureCoefficient": result.get("pressure_coefficient", 0.0),
        },
    }


def reset(reason):
    _runtime_worker().reset_pet_care()


def shutdown():
    pass
