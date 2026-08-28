import importlib.util
import pathlib
import sys
import unittest

import numpy as np

sys.dont_write_bytecode = True


MODULE_PATH = pathlib.Path(__file__).parents[1] / "app" / "onbed_filter_example.py"
SPEC = importlib.util.spec_from_file_location("onbed_filter_example_config_test", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)
PAIR_KEYS = {
    "sos_disable_area",
    "sitting_area",
    "leave_bed_disable_area",
    "small_object_size",
}


class JqbedAlgorithmConfigTests(unittest.TestCase):
    def test_health_reports_the_native_dynamic_config_schema(self):
        class CompatibleNcz:
            @staticmethod
            def step(_inputs):
                """sensitivity_threshold"""

        original = MODULE.ncz
        try:
            MODULE.ncz = CompatibleNcz
            self.assertTrue(MODULE.health()["onbedFilterSensitivitySchema"])
            MODULE.ncz = object()
            self.assertFalse(MODULE.health()["onbedFilterSensitivitySchema"])
            MODULE.ncz = None
            self.assertFalse(MODULE.health()["onbedFilterAvailable"])
        finally:
            MODULE.ncz = original

    def test_build_step_inputs_preserves_the_codeopi_abi_without_config(self):
        inputs = MODULE.build_step_inputs([1, 2, 3], None)

        self.assertEqual(inputs["threshold_factor"], 0.0)
        self.assertEqual(inputs["filter_switch"], 1.0)
        self.assertIn("head_foot_area", inputs)
        self.assertNotIn("sensitivity_threshold", inputs)
        np.testing.assert_array_equal(inputs["sos_disable_area"], [6.0, 10.0])
        self.assertEqual(inputs["frame_data"].dtype, np.float32)

    def test_build_step_inputs_uses_the_new_schema_only_with_config(self):
        config = {
            "threshold_factor": 7,
            "breath_th": 8,
            "continuous_on_bed_duration_minutes": 9,
            "unlock_sitting_alarm_duration_minutes": 10,
            "sos_peak_threshold": 22,
            "points_threshold_in": 3,
            "min_sos_sequence": 4,
            "breath_detect_mode": 5,
            "strel_switch": 0,
            "filter_switch": 0,
            "body_movement_threshold": 30,
            "step_leavebed_trigger": 50,
            "edge_align_ratio": 6,
            "sensitivity_threshold": 3,
            "sos_disable_area": [0, 0],
            "sitting_area": [255, 255],
            "leave_bed_disable_area": [32, 0],
            "small_object_size": [0, 32],
        }

        inputs = MODULE.build_step_inputs([1, 2], config)

        self.assertNotIn("head_foot_area", inputs)
        for key, expected in config.items():
            if key in PAIR_KEYS:
                self.assertEqual(inputs[key].dtype, np.float32)
                np.testing.assert_array_equal(inputs[key], np.asarray(expected, dtype=np.float32))
            else:
                self.assertEqual(inputs[key], float(expected))

    def test_build_step_inputs_rejects_invalid_dynamic_values(self):
        invalid_configs = (
            {"threshold_factor": float("inf")},
            {"sos_disable_area": [0, float("nan")]},
            {"sos_disable_area": [1]},
            {"sos_disable_area": [33, 0]},
            {"sitting_area": [255, 0]},
            {"min_sos_sequence": 1.5},
            {"filter_switch": 2},
            {"strel_switch": -1},
            {"sensitivity_threshold": 4},
            {"sensitivity_threshold": 1.5},
            {"filter_switch": True},
        )

        for config in invalid_configs:
            with self.subTest(config=config):
                with self.assertRaises(ValueError):
                    MODULE.build_step_inputs([1], config)

    def test_get_data_applies_config_and_preserves_the_result_contract(self):
        class FakeNcz:
            captured = None

            @classmethod
            def step(cls, inputs):
                cls.captured = inputs
                return {
                    "rate": 12,
                    "heart_rate": 70,
                    "stateInBbed": 1,
                    "sosflag": 1,
                    "merged_alarm": 0,
                    "matrix_origin": [],
                    "matrix_filter": [],
                }

        original = MODULE.ncz
        try:
            MODULE.ncz = FakeNcz
            result = MODULE.getData([0] * 1024, {"sos_peak_threshold": 22})
        finally:
            MODULE.ncz = original

        self.assertEqual(FakeNcz.captured["sos_peak_threshold"], 22.0)
        self.assertEqual(result["sosflag"], 1.0)
        self.assertIn("merged_alarm", result)
        self.assertIn("matrix_origin", result)


if __name__ == "__main__":
    unittest.main()
