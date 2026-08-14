import importlib.util
import pathlib
import unittest

import numpy as np


MODULE_PATH = pathlib.Path(__file__).parents[1] / "app" / "onbed_filter_example.py"
SPEC = importlib.util.spec_from_file_location("onbed_filter_example_test", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)
PAIR_KEYS = {
    "sos_disable_area",
    "sitting_area",
    "leave_bed_disable_area",
    "small_object_size",
    "head_foot_area",
}


class JqbedAlgorithmConfigTests(unittest.TestCase):
    def test_build_step_inputs_keeps_defaults_without_config(self):
        inputs = MODULE.build_step_inputs([1, 2, 3], None)

        self.assertEqual(inputs["threshold_factor"], 0.0)
        self.assertEqual(inputs["filter_switch"], 1.0)
        np.testing.assert_array_equal(inputs["sos_disable_area"], [6.0, 10.0])
        self.assertEqual(inputs["frame_data"].dtype, np.float32)

    def test_build_step_inputs_overrides_all_supported_values(self):
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
            "sos_disable_area": [0, 0],
            "sitting_area": [255, 255],
            "leave_bed_disable_area": [32, 0],
            "small_object_size": [0, 32],
            "head_foot_area": [12, 24],
        }

        inputs = MODULE.build_step_inputs([1, 2], config)

        for key, expected in config.items():
            if key in PAIR_KEYS:
                self.assertEqual(inputs[key].dtype, np.float32)
                np.testing.assert_array_equal(inputs[key], np.asarray(expected, dtype=np.float32))
            else:
                self.assertEqual(inputs[key], float(expected))

    def test_build_step_inputs_rejects_non_finite_and_invalid_config_values(self):
        invalid_configs = (
            {"threshold_factor": float("inf")},
            {"sos_disable_area": [0, float("nan")]},
            {"sos_disable_area": [1]},
            {"sos_disable_area": [33, 0]},
            {"sitting_area": [255, 0]},
            {"min_sos_sequence": 1.5},
            {"breath_detect_mode": 1.5},
            {"filter_switch": 2},
            {"strel_switch": -1},
        )

        for config in invalid_configs:
            with self.subTest(config=config):
                with self.assertRaises(ValueError):
                    MODULE.build_step_inputs([1], config)

    def test_get_data_rejects_unrounded_boundaries_and_booleans_before_step(self):
        class FakeNcz:
            calls = 0

            @classmethod
            def step(cls, inputs):
                cls.calls += 1
                return {
                    "rate": 0,
                    "heart_rate": 0,
                    "stateInBbed": 0,
                    "sosflag": 0,
                    "merged_alarm": 0,
                    "matrix_origin": [],
                    "matrix_filter": [],
                }

        invalid_configs = (
            {"sos_disable_area": [32.0000001, 0]},
            {"sitting_area": [254.999999, 254.999999]},
            {"sos_disable_area": [True, False]},
            {"filter_switch": True},
        )
        original = MODULE.ncz
        try:
            MODULE.ncz = FakeNcz
            for config in invalid_configs:
                with self.subTest(config=config):
                    with self.assertRaises(ValueError):
                        MODULE.getData([0] * 1024, config)
                    self.assertEqual(FakeNcz.calls, 0)
        finally:
            MODULE.ncz = original

    def test_build_step_inputs_rejects_non_object_config_and_ignores_unknown_keys(self):
        with self.assertRaises(ValueError):
            MODULE.build_step_inputs([1], ["not", "an", "object"])

        inputs = MODULE.build_step_inputs([1], {"unknown_key": 99})
        self.assertNotIn("unknown_key", inputs)

    def test_get_data_passes_config_to_step_and_preserves_sosflag(self):
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
        self.assertIn("rate", result)
        self.assertIn("heart_rate", result)
        self.assertIn("stateInBbed", result)
        self.assertIn("matrix_origin", result)
        self.assertIn("matrix_filter", result)


if __name__ == "__main__":
    unittest.main()
