import math
import sys


_config = {}


def _runtime_worker():
    for module_name in ("onbed_filter_example", "__main__"):
        module = sys.modules.get(module_name)
        if module is not None and callable(getattr(module, "getData", None)):
            return module
    raise RuntimeError("Shroom Python worker does not expose getData")


def initialize(config, resources):
    """保存所选原生算法参数，不维护替代呼吸波形的压力窗口。"""
    global _config
    _config = dict(config or {})
    reset("initialize")


def _finite_number(value, fallback=0.0):
    """把算法输出收敛为有限浮点数，异常值回落到指定默认值。"""
    try:
        number = float(value)
        return number if math.isfinite(number) else float(fallback)
    except (TypeError, ValueError, OverflowError):
        return float(fallback)


def _positive_values(values):
    """将压力帧转换为非负有限值，坏点按零处理。"""
    return [max(0.0, _finite_number(value)) for value in values]


def _calculate_cop(values, matrix):
    """只依赖规范化压力帧计算 CoP，使生命体征算法故障时重心仍可输出。"""
    rows = int(matrix.get("rows") or 32)
    cols = int(matrix.get("cols") or 32)
    positive = _positive_values(values)
    total = sum(positive)
    if total <= 0 or rows * cols != len(positive):
        return 0.0, 0.0, 0.0
    cop_x = sum((index % cols) * value for index, value in enumerate(positive)) / total
    cop_y = sum((index // cols) * value for index, value in enumerate(positive)) / total
    center_x = (cols - 1) / 2.0
    center_y = (rows - 1) / 2.0
    distance = ((cop_x - center_x) ** 2 + (cop_y - center_y) ** 2) ** 0.5
    return cop_x, cop_y, distance


def process(request):
    """返回原生生命体征与独立 CoP；当前原生接口未提供呼吸波形，故不输出该指标。"""
    values = list(request.get("normalized_data") or [])
    if len(values) != 1024:
        raise ValueError(f"mattress-vitals expects 1024 values, got {len(values)}")

    matrix = request.get("matrix") or {}
    cop_x, cop_y, cop_distance = _calculate_cop(values, matrix)
    native_healthy = 1.0
    try:
        worker = _runtime_worker()
        # 空对象也必须传入：新版 onbed_filter 以此选择 sensitivity_threshold ABI。
        result = worker.getData(values, _config)
        if not isinstance(result, dict):
            raise TypeError("onbed_filter result must be an object")
    except Exception:
        # ⚠️ 生命体征库失败只能降级对应指标，不能吞掉本帧或阻断上面的 CoP。
        native_healthy = 0.0
        result = {}
    # ⚠️ 旧 worker 的 respiration_waveform 也是平均压力代理，不能接入呼吸指标。
    return {
        "data": values,
        "metrics": {
            "respirationRate": _finite_number(result.get("rate"), -1.0),
            "minuteRespirationRate": _finite_number(result.get("rateMin"), -1.0),
            "heartRate": _finite_number(result.get("heart_rate")),
            "stateInBed": _finite_number(result.get("stateInBbed")),
            "sosFlag": _finite_number(result.get("sosflag")),
            "alarmState": _finite_number(result.get("merged_alarm")),
            "pressureCoefficient": _finite_number(result.get("inBedtime")),
            "copX": cop_x,
            "copY": cop_y,
            "copDistance": cop_distance,
            "strokeRisk": _finite_number(result.get("strokerisk")),
            "sleepState": _finite_number(result.get("strokeriskMin")),
            "bodyMovement": _finite_number(result.get("body_movement_data")),
            "onbedFilterHealthy": native_healthy,
        },
    }


def reset(reason):
    """重置原生算法状态，异常由下一帧健康指标反映。"""
    try:
        worker = _runtime_worker()
        native = getattr(worker, "ncz", None)
        if native is not None and callable(getattr(native, "initialize", None)):
            native.initialize()
    except Exception:
        # reset 失败留给下一帧的健康指标体现，不能让运行时重置链整体报错。
        return


def shutdown():
    pass
