import importlib.util
import os
import sys
import types
import unittest

sys.dont_write_bytecode = True


REPOSITORY_ROOT = os.path.realpath(os.path.join(os.path.dirname(__file__), "..", ".."))
PACKAGE_ROOT = os.path.join(REPOSITORY_ROOT, "agent-resources", "algorithm-packages")


def load_package(package_id):
    entry = os.path.join(PACKAGE_ROOT, package_id, "algorithm.py")
    module_name = f"shroom_test_{package_id.replace('-', '_')}"
    spec = importlib.util.spec_from_file_location(module_name, entry)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class BuiltinAlgorithmPackagesTest(unittest.TestCase):
    def setUp(self):
        self.calls = []
        worker = types.ModuleType("onbed_filter_example")
        worker.ncz = types.SimpleNamespace(initialize=lambda: self.calls.append(("onbed-reset",)))
        worker.getData = lambda values, config=None: {
            "rate": 16.5,
            "rateMin": 17.0,
            "heart_rate": 72.0,
            "stateInBbed": 1.0,
            "sosflag": 0.0,
            "merged_alarm": 0.0,
            "inBedtime": 2.5,
            "strokerisk": 0.0,
            "strokeriskMin": 1.0,
            "body_movement_data": 3.0,
        }
        worker.reset_pet_care = lambda: self.calls.append(("pet-reset",))
        worker.pet_care_step = lambda values, species, threshold_factor: {
            "breath_rate": 24.0,
            "posture_state": 2.0,
            "is_motion": 0.0,
            "snr_db": 8.0,
            "quality": 9.0,
            "bed_exit_flag": 0.0,
            "pressure_coefficient": 11.0,
        }
        worker.reset_pet_care_mini = lambda: self.calls.append(("mini-reset",))
        worker.pet_care_mini_step = worker.pet_care_step

        def realtime(values, previous, fps=20.0):
            self.calls.append(("foot", previous, fps))
            return {
                "left": {"pressure": 10, "area": 2, "cop_x": 3, "cop_y": 4, "cop_speed": 5},
                "right": {"pressure": 20, "area": 6, "cop_x": 7, "cop_y": 8, "cop_speed": 9},
            }

        worker.realtime_server = realtime
        self.previous_worker = sys.modules.get("onbed_filter_example")
        sys.modules["onbed_filter_example"] = worker

    def tearDown(self):
        if self.previous_worker is None:
            sys.modules.pop("onbed_filter_example", None)
        else:
            sys.modules["onbed_filter_example"] = self.previous_worker

    def test_mattress_vitals_preserves_matrix_and_exposes_metrics(self):
        algorithm = load_package("mattress-vitals")
        values = [1] * 1024
        algorithm.initialize({}, {})
        result = algorithm.process({"normalized_data": values})
        self.assertEqual(result["data"], values)
        self.assertEqual(result["metrics"]["respirationRate"], 16.5)
        self.assertEqual(result["metrics"]["heartRate"], 72.0)
        self.assertAlmostEqual(result["metrics"]["copX"], 15.5)
        self.assertAlmostEqual(result["metrics"]["copY"], 15.5)
        self.assertAlmostEqual(result["metrics"]["copDistance"], 0.0)
        self.assertNotIn("respirationSignal", result["metrics"])
        self.assertEqual(result["metrics"]["onbedFilterHealthy"], 1.0)
        next_result = algorithm.process({"normalized_data": [2] * 1024})
        self.assertNotIn("respirationSignal", next_result["metrics"])
        algorithm.reset("test")
        self.assertIn(("onbed-reset",), self.calls)

    def test_mattress_vitals_keeps_cop_when_onbed_filter_fails(self):
        algorithm = load_package("mattress-vitals")
        worker = sys.modules["onbed_filter_example"]

        def fail_onbed(_values, config=None):
            raise RuntimeError("native algorithm failure")

        worker.getData = fail_onbed
        algorithm.initialize({}, {})
        result = algorithm.process({"normalized_data": [1] * 1024})

        self.assertEqual(result["data"], [1] * 1024)
        self.assertAlmostEqual(result["metrics"]["copX"], 15.5)
        self.assertAlmostEqual(result["metrics"]["copY"], 15.5)
        self.assertEqual(result["metrics"]["onbedFilterHealthy"], 0.0)
        self.assertNotIn("respirationSignal", result["metrics"])

    def test_pressure_changes_never_substitute_for_a_respiration_waveform(self):
        """压力起伏、滤波矩阵和旧包装层代理字段都不能冒充原生呼吸波形。"""
        algorithm = load_package("mattress-vitals")
        worker = sys.modules["onbed_filter_example"]
        native_get_data = worker.getData
        worker.getData = lambda values, config=None: {
            **native_get_data(values, config),
            "matrix_filter": values,
            "respiration_waveform": sum(values) / len(values),
        }
        algorithm.initialize({}, {})
        for pressure in [10, 5, 0, 50, 10]:
            result = algorithm.process({"normalized_data": [pressure] * 1024})
            self.assertNotIn("respirationSignal", result["metrics"])
            self.assertEqual(result["metrics"]["respirationRate"], 16.5)
            self.assertEqual(result["data"], [pressure] * 1024)
            self.assertAlmostEqual(result["metrics"]["copX"], 15.5 if pressure else 0.0)
        algorithm.reset("seek")
        self.assertNotIn("respirationSignal", algorithm.process({"normalized_data": [5] * 1024})["metrics"])

    def test_native_respiration_scalars_are_preserved_for_a_chart_queue(self):
        """原样提供原生呼吸单值及无效标记，由图表按契约入队，不从压力计算替代值。"""
        algorithm = load_package("mattress-vitals")
        worker = sys.modules["onbed_filter_example"]
        samples = [16.0, 18.0, -1.0, 88.0, 17.0, 17.0]
        output = iter(samples)
        worker.getData = lambda values, config=None: {"rate": next(output)}
        algorithm.initialize({}, {})
        actual = []
        for index in range(len(samples)):
            result = algorithm.process({"normalized_data": [index + 1] * 1024})
            actual.append(result["metrics"]["respirationRate"])
            self.assertNotIn("respirationSignal", result["metrics"])
            self.assertAlmostEqual(result["metrics"]["copX"], 15.5)
        self.assertEqual(actual, samples)

    def test_pet_packages_preserve_matrix_and_expose_breath_rate(self):
        for package_id in ("pet-care", "pet-care-mini"):
            algorithm = load_package(package_id)
            values = [2] * 1024
            algorithm.initialize({}, {})
            result = algorithm.process({"normalized_data": values})
            self.assertEqual(result["data"], values)
            self.assertEqual(result["metrics"]["breathRate"], 24.0)

    def test_foot_package_keeps_previous_frame_and_exposes_cop(self):
        algorithm = load_package("foot-pressure-realtime")
        first = [1] * 4096
        second = [2] * 4096
        algorithm.initialize({"fps": 42}, {})
        result = algorithm.process({"normalized_data": first})
        self.assertEqual(result["metrics"]["leftCopX"], 3)
        self.assertEqual(self.calls[-1], ("foot", None, 42.0))
        algorithm.process({"normalized_data": second})
        self.assertEqual(self.calls[-1], ("foot", first, 42.0))
        algorithm.reset("seek")
        algorithm.process({"normalized_data": second})
        self.assertEqual(self.calls[-1], ("foot", None, 42.0))


if __name__ == "__main__":
    unittest.main()
