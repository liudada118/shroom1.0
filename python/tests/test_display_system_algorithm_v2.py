import os
import sys
import tempfile
import unittest


APP_ROOT = os.path.realpath(os.path.join(os.path.dirname(__file__), "..", "app"))
if APP_ROOT not in sys.path:
    sys.path.insert(0, APP_ROOT)

import onbed_filter_example as worker


class DisplaySystemAlgorithmV2Test(unittest.TestCase):
    def test_lifecycle_and_multi_sensor_request(self):
        with tempfile.TemporaryDirectory(prefix="shroom-algorithm-v2-") as directory:
            entry = os.path.join(directory, "algorithm.py")
            with open(entry, "w", encoding="utf-8") as stream:
                stream.write(
                    "events = []\n"
                    "def initialize(config, resources): events.append(('initialize', config['threshold']))\n"
                    "def process(request):\n"
                    "    events.append(('process', sorted(request['frames'].keys())))\n"
                    "    return {'data': request['normalized_data'], 'metrics': {'count': len(request['frames'])}}\n"
                    "def reset(reason): events.append(('reset', reason))\n"
                    "def shutdown(): events.append(('shutdown', None))\n"
                )

            package = {
                "apiVersion": 2,
                "parameters": {"threshold": 10},
                "resolvedResources": {},
            }
            result = worker.run_display_system_algorithm(
                entry,
                [1, 2],
                {
                    "normalized_data": [2, 1],
                    "frames": {"seat": {}, "back": {}},
                    "timestamp": 100,
                    "identity": {"sensorId": "seat"},
                },
                api_version=2,
                algorithm_package=package,
            )
            self.assertEqual(result, {"data": [2, 1], "metrics": {"count": 2}})

            resolved = os.path.realpath(entry)
            module = worker._display_system_algorithm_cache[resolved]["module"]
            self.assertEqual(module.events[0], ("initialize", 10))
            self.assertEqual(module.events[1], ("process", ["back", "seat"]))

            worker.reset_display_system_algorithm(entry, "playback-seek")
            self.assertEqual(module.events[-1], ("reset", "playback-seek"))
            worker.shutdown_display_system_algorithm(entry)
            self.assertEqual(module.events[-1], ("shutdown", None))
            self.assertNotIn(resolved, worker._display_system_algorithm_cache)


if __name__ == "__main__":
    unittest.main()
