import importlib.util
import json
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
}


class JqbedAlgorithmConfigTests(unittest.TestCase):
    def test_health_proves_whether_the_native_onbed_module_imported(self):
        original = MODULE.ncz
        try:
            if original is not None:
                self.assertTrue(MODULE.health()["onbedFilterSensitivitySchema"])
            MODULE.ncz = object()
            self.assertEqual(MODULE.health(), {
                "pong": True,
                "onbedFilterAvailable": True,
                "onbedFilterSensitivitySchema": False,
                "onbedFilterBedTypeSchema": False,
            })
            MODULE.ncz = None
            self.assertEqual(MODULE.health(), {
                "pong": True,
                "onbedFilterAvailable": False,
                "onbedFilterSensitivitySchema": False,
                "onbedFilterBedTypeSchema": False,
            })
        finally:
            MODULE.ncz = original

    def test_build_step_inputs_keeps_defaults_without_config(self):
        inputs = MODULE.build_step_inputs([1, 2, 3], None)

        self.assertEqual(inputs["threshold_factor"], 0.0)
        self.assertEqual(inputs["filter_switch"], 1.0)
        self.assertEqual(inputs["sensitivity_threshold"], 0.0)
        self.assertEqual(inputs["isLowBed"], 0.0)
        np.testing.assert_array_equal(inputs["head_foot_area"], [0.0, 0.0])
        self.assertEqual(inputs["head_foot_area"].dtype, np.float32)
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
            "sensitivity_threshold": 3,
            "isLowBed": 1,
            "sos_disable_area": [0, 0],
            "sitting_area": [255, 255],
            "leave_bed_disable_area": [32, 0],
            "small_object_size": [0, 32],
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
            {"sensitivity_threshold": 4},
            {"sensitivity_threshold": 1.5},
            {"isLowBed": 2},
            {"isLowBed": 0.5},
            {"isLowBed": True},
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

    def test_inactive_head_foot_area_stays_fixed_even_with_legacy_config(self):
        inputs = MODULE.build_step_inputs([0] * 1024, {"head_foot_area": [254, 254], "isLowBed": 1})
        np.testing.assert_array_equal(inputs["head_foot_area"], [0.0, 0.0])
        self.assertEqual(inputs["isLowBed"], 1.0)
        inputs["head_foot_area"][0] = 99
        np.testing.assert_array_equal(MODULE.build_step_inputs([0], None)["head_foot_area"], [0.0, 0.0])

    def test_health_distinguishes_old_sensitivity_only_and_new_bed_type_interfaces(self):
        class FakeNcz:
            @staticmethod
            def step(inputs):
                "sensitivity_threshold"

        original = MODULE.ncz
        try:
            MODULE.ncz = FakeNcz
            self.assertTrue(MODULE.health()["onbedFilterSensitivitySchema"])
            self.assertFalse(MODULE.health()["onbedFilterBedTypeSchema"])
            FakeNcz.step.__doc__ = "sensitivity_threshold head_foot_area isLowBed"
            self.assertTrue(MODULE.health()["onbedFilterBedTypeSchema"])
        finally:
            MODULE.ncz = original

    @unittest.skipIf(MODULE.ncz is None, "native library is unavailable on this platform")
    def test_native_algorithm_accepts_both_bed_types_through_the_real_bridge(self):
        self.assertTrue(MODULE.health()["onbedFilterBedTypeSchema"])
        for bed_type in [0, 1]:
            with self.subTest(bed_type=bed_type):
                MODULE.ncz.initialize()
                try:
                    result = MODULE.getData([0] * 1024, {"isLowBed": bed_type})
                    for key in ["matrix_origin", "matrix_filter"]:
                        self.assertEqual(len(result[key]), 1024)
                        self.assertTrue(np.all(np.isfinite(result[key])))
                    self.assertIn("stateInBbed", result)
                    self.assertIn("sosflag", result)
                    self.assertEqual(len(result["reserved_bytes"]), 10)
                    json.dumps(result, allow_nan=False)
                finally:
                    MODULE.ncz.terminate()

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

    def test_reserved_bytes_preserves_native_order_scaling_echoes_and_trailing_slots(self):
        raw = np.array([126, 43, 1, 6, 0, 1, 71, 82, 93, 104], dtype=np.float64)

        class FakeNcz:
            @staticmethod
            def step(inputs):
                return {"reserved_bytes": raw, "sosflag": 1, "stateInBbed": 1}

        original = MODULE.ncz
        try:
            MODULE.ncz = FakeNcz
            result = MODULE.getData([0] * 1024, {"sensitivity_threshold": 3, "isLowBed": 0})
        finally:
            MODULE.ncz = original

        payload = json.loads(json.dumps(result, allow_nan=False))
        self.assertEqual(payload["reserved_bytes"], raw.tolist())
        self.assertEqual(payload["reserved_bytes"][:4], [126, 43, 1, 6])
        self.assertEqual(payload["reserved_bytes"][4:6], [0, 1], "echoes must come from the algorithm, not its input config")
        self.assertEqual(payload["reserved_bytes"][6:], [71, 82, 93, 104])
        self.assertEqual(payload["sosflag"], 1.0)
        self.assertEqual(payload["stateInBbed"], 1.0)
        result["reserved_bytes"][0] = 999
        self.assertEqual(raw[0], 126, "JSON conversion must not mutate native memory")

    def test_reserved_bytes_missing_legacy_outputs_and_negative_sentinels_remain_compatible(self):
        class FakeNcz:
            outputs = {}

            @classmethod
            def step(cls, inputs):
                return cls.outputs

        original = MODULE.ncz
        try:
            MODULE.ncz = FakeNcz
            for native_output in [{}, {"reserved_bytes": None}, {"reserved_bytes": []}]:
                FakeNcz.outputs = native_output
                self.assertEqual(MODULE.getData([0] * 1024)["reserved_bytes"], [])
            FakeNcz.outputs = {"reserved_bytes": np.full(10, -1, dtype=np.float32)}
            self.assertEqual(MODULE.getData([0] * 1024)["reserved_bytes"], [-1] * 10)
            FakeNcz.outputs = {"reserved_bytes": [10, 20, 0, 0, 3, 0]}
            self.assertEqual(MODULE.getData([0] * 1024)["reserved_bytes"], [10, 20, 0, 0, 3, 0])
        finally:
            MODULE.ncz = original

    def test_complete_native_outputs_are_optional_and_keep_unknown_fields_and_large_arrays(self):
        raw_matrix = np.arange(1024, dtype=np.float32)
        native_outputs = {
            "rate": -1.0,
            "state_in_bed": 1.0,
            "sos_flag": 0.0,
            "stroke_risk": 7.0,
            "matrix_origin": raw_matrix,
            "matrix_filter": raw_matrix.copy(),
            "reserved_bytes": np.full(10, -1, dtype=np.float32),
            "future_diagnostic": {
                "nested_array": np.array([[1.25, np.nan], [np.inf, -np.inf]], dtype=np.float32),
                "scalar": np.int64(123),
                "switch": np.bool_(True),
                "tuple": (np.float32(2.5), None, "native"),
            },
        }

        class FakeNcz:
            @staticmethod
            def step(inputs):
                return native_outputs

        original = MODULE.ncz
        try:
            MODULE.ncz = FakeNcz
            legacy = MODULE.getData([0] * 1024)
            self.assertNotIn("raw_outputs", legacy)
            self.assertNotIn("raw_outputs", MODULE.getData([0] * 1024, includeRawOutputs=False))
            self.assertNotIn("raw_outputs", MODULE.getData([0] * 1024, includeRawOutputs="true"))
            complete = MODULE.getData([0] * 1024, includeRawOutputs=True)
        finally:
            MODULE.ncz = original

        raw = complete.pop("raw_outputs")
        self.assertEqual(complete, legacy, "requesting native logs must not change legacy results")
        self.assertEqual(set(raw), set(native_outputs))
        self.assertEqual(len(raw["matrix_origin"]), 1024)
        self.assertEqual(raw["matrix_filter"], raw["matrix_origin"])
        self.assertEqual(raw["stroke_risk"], 7.0)
        self.assertEqual(raw["future_diagnostic"], {
            "nested_array": [[1.25, None], [None, None]],
            "scalar": 123, "switch": True, "tuple": [2.5, None, "native"],
        })
        json.dumps(raw, allow_nan=False)
        raw["matrix_origin"][0] = 999
        self.assertEqual(raw_matrix[0], 0, "raw output conversion must detach native array memory")
        self.assertTrue(np.isnan(native_outputs["future_diagnostic"]["nested_array"][0, 1]))

    def test_raw_diagnostic_serializer_handles_nested_nonfinite_python_values(self):
        native = {"list": [float("nan"), float("inf"), float("-inf"), 0, 1.5], "none": None}
        safe = MODULE.json_safe_algorithm_output(native)
        self.assertEqual(safe, {"list": [None, None, None, 0, 1.5], "none": None})
        json.dumps(safe, allow_nan=False)

    @unittest.skipIf(MODULE.ncz is None, "native library is unavailable on this platform")
    def test_complete_real_native_outputs_include_all_28_fields_without_renaming_or_truncating(self):
        native = MODULE.ncz

        class CaptureNative:
            raw = None

            @classmethod
            def step(cls, inputs):
                cls.raw = native.step(inputs)
                return cls.raw

        expected = {
            "body_movement_data", "rate", "stroke_risk", "state_in_bed", "onbed_ratio", "runtime",
            "sos_flag", "merged_alarm", "current_threshold", "sitting_alarm_duration_minutes",
            "on_bed_duration_minutes", "onbed_ratio_minute", "rate_minute", "awake_state", "onbed_state",
            "body_movement_flag", "version_info", "alarm_counter", "matrix_origin", "matrix_filter",
            "merged_switch", "filter_param", "sos_param", "sitting_area_out", "reserved_bytes",
            "reserved_bytes20", "sos_signal_out", "sos_coord",
        }
        native.initialize()
        try:
            MODULE.ncz = CaptureNative
            for _ in range(24):
                result = MODULE.getData([0] * 1024, includeRawOutputs=True)
            self.assertTrue(expected.issubset(result["raw_outputs"]))
            self.assertEqual(set(result["raw_outputs"]), set(CaptureNative.raw))
            self.assertEqual(result["raw_outputs"], MODULE.json_safe_algorithm_output(CaptureNative.raw))
            self.assertEqual(len(result["raw_outputs"]["matrix_origin"]), 1024)
            self.assertEqual(len(result["raw_outputs"]["matrix_filter"]), 1024)
            self.assertEqual(len(result["raw_outputs"]["sos_signal_out"]), 159)
            self.assertEqual(len(result["raw_outputs"]["reserved_bytes20"]), 20)
            self.assertIn("state_in_bed", result["raw_outputs"])
            self.assertNotIn("stateInBbed", result["raw_outputs"])
            json.dumps(result["raw_outputs"], allow_nan=False)
        finally:
            MODULE.ncz = native
            native.terminate()


if __name__ == "__main__":
    unittest.main()
