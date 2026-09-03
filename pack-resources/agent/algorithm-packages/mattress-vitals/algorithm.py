import sys


_config = {}


def _runtime_worker():
    for module_name in ("onbed_filter_example", "__main__"):
        module = sys.modules.get(module_name)
        if module is not None and callable(getattr(module, "getData", None)):
            return module
    raise RuntimeError("Shroom Python worker does not expose getData")


def initialize(config, resources):
    global _config
    _config = dict(config or {})


def process(request):
    values = list(request.get("normalized_data") or [])
    if len(values) != 1024:
        raise ValueError(f"mattress-vitals expects 1024 values, got {len(values)}")

    worker = _runtime_worker()
    result = worker.getData(values, _config or None)
    matrix = request.get("matrix") or {}
    rows = int(matrix.get("rows") or 32)
    cols = int(matrix.get("cols") or 32)
    positive = [max(0.0, float(value)) for value in values]
    total = sum(positive)
    if total > 0 and rows * cols == len(positive):
        cop_x = sum((index % cols) * value for index, value in enumerate(positive)) / total
        cop_y = sum((index // cols) * value for index, value in enumerate(positive)) / total
        center_x = (cols - 1) / 2.0
        center_y = (rows - 1) / 2.0
        cop_distance = ((cop_x - center_x) ** 2 + (cop_y - center_y) ** 2) ** 0.5
    else:
        cop_x = 0.0
        cop_y = 0.0
        cop_distance = 0.0
    return {
        "data": values,
        "metrics": {
            "respirationSignal": result.get("inBedtime", 0.0),
            "respirationRate": result.get("rate", -1.0),
            "minuteRespirationRate": result.get("rateMin", -1.0),
            "heartRate": result.get("heart_rate", 0.0),
            "stateInBed": result.get("stateInBbed", 0.0),
            "sosFlag": result.get("sosflag", 0.0),
            "alarmState": result.get("merged_alarm", 0.0),
            "pressureCoefficient": result.get("inBedtime", 0.0),
            "copX": cop_x,
            "copY": cop_y,
            "copDistance": cop_distance,
            "strokeRisk": result.get("strokerisk", 0.0),
            "sleepState": result.get("strokeriskMin", 0.0),
            "bodyMovement": result.get("body_movement_data", 0.0),
        },
    }


def reset(reason):
    worker = _runtime_worker()
    native = getattr(worker, "ncz", None)
    if native is not None and callable(getattr(native, "initialize", None)):
        native.initialize()


def shutdown():
    pass
