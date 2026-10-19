"""用合成窗口验证固定 CPU 训练、独立采集验证和跨端数值模型。"""

import contextlib
import copy
import io
import json
import pathlib
import runpy
import sys
import types
import unittest
from unittest import mock


APP = pathlib.Path(__file__).resolve().parents[1] / 'app'
sys.path.insert(0, str(APP))
import cpu_classifier_training as TRAINING


def payload(groups=3, classes=2, validation=False):
    """生成可分的多次采集，验证组与开发组完全独立。"""
    rows = []
    for code in range(classes):
        for group in range(groups + int(validation)):
            split = 'validation' if group == groups else 'development'
            for index in range(6):
                rows.append({'features': [code * 10 + index * .05, code * 5 - index * .02], 'label': code,
                             'group': f'{code}-{group}', 'split': split, 'recordId': f'record-{code}-{group}',
                             'startFrame': index * 32, 'timestamp': 1000 + index * 640})
    return {'schemaVersion': 1, 'featureNames': ['pressureLeft', 'maxRiseRate'], 'labels': [f'类别{code}' for code in range(classes)],
            'windows': rows, 'mode': 'quick', 'minConfidence': .55}


class CpuClassifierTrainingTests(unittest.TestCase):
    """覆盖真实估计器、数据隔离、资源上限和不初始化设备的 CLI。"""

    def test_group_cross_validation_selects_one_fixed_cpu_candidate(self):
        """三种候选均真实拟合，最终结果含准确评分与可移植模型。"""
        result = TRAINING.train(payload())
        report = result['report']
        self.assertEqual(report['evaluation'], 'group-cross-validation')
        self.assertEqual(report['split'], 'development')
        self.assertEqual(report['windows'], 36)
        self.assertEqual(report['correct'], 36)
        self.assertEqual(report['macroF1'], 1)
        self.assertEqual(sum(candidate['selected'] for candidate in result['candidates']), 1)
        self.assertEqual(len(result['candidates']), 3)
        self.assertTrue(all(candidate['folds'] == 3 and candidate['status'] == 'succeeded' for candidate in result['candidates']))
        self.assertEqual(result['model']['featureNames'], payload()['featureNames'])
        self.assertEqual(result['model']['runtime'], 'cpu-classifier-v1')
        self.assertLess(len(json.dumps(result['model']).encode()), TRAINING.MAX_MODEL_BYTES)

    def test_group_folds_never_split_the_same_collection(self):
        """窗口再多也不会把同次采集拆进训练与评估两边。"""
        rows = payload()['windows']
        folds, warnings = TRAINING.development_folds(rows, 2)
        self.assertFalse(warnings)
        evaluated = []
        for train, test in folds:
            train_groups = {rows[int(index)]['group'] for index in train}
            test_groups = {rows[int(index)]['group'] for index in test}
            self.assertFalse(train_groups & test_groups)
            evaluated.extend(int(index) for index in test)
        self.assertEqual(sorted(evaluated), list(range(len(rows))))

    def test_insufficient_groups_are_reported_as_development_only(self):
        """只有每类一次采集时给出明确限制，不能冒充交叉验证。"""
        result = TRAINING.train(payload(groups=1))
        report = result['report']
        self.assertEqual(report['evaluation'], 'development-only')
        self.assertTrue(any('独立采集组不足' in warning for warning in report['warnings']))
        self.assertTrue(all(candidate['folds'] == 0 for candidate in result['candidates']))

    def test_validation_is_never_used_to_select_or_fit_a_candidate(self):
        """反转全部验证标签只改变最终成绩，不能改变模型及候选评分。"""
        original = payload(validation=True)
        reversed_validation = copy.deepcopy(original)
        for row in reversed_validation['windows']:
            if row['split'] == 'validation':
                row['label'] = 1 - row['label']
        first, second = TRAINING.train(original), TRAINING.train(reversed_validation)
        self.assertEqual(first['model'], second['model'])
        self.assertEqual([{key: value for key, value in item.items() if key != 'seconds'} for item in first['candidates']],
                         [{key: value for key, value in item.items() if key != 'seconds'} for item in second['candidates']])
        self.assertEqual(first['report']['evaluation'], 'independent-validation')
        self.assertEqual(first['report']['split'], 'validation')
        self.assertEqual(first['report']['windows'], 12)
        self.assertEqual(first['report']['accuracy'], 1)
        self.assertEqual(second['report']['accuracy'], 0)
        self.assertEqual(first['report']['validationGroups'], 2)

    def test_json_predictions_match_real_binary_and_multiclass_estimators(self):
        """线性概率、树叶概率及森林平均值与 sklearn 保持一致。"""
        import numpy as np
        from threadpoolctl import threadpool_limits
        with threadpool_limits(limits=1):
            for count in (2, 3):
                value = payload(classes=count)
                x = np.asarray([row['features'] for row in value['windows']], dtype=np.float64)
                y = [row['label'] for row in value['windows']]
                for kind in ('linear', 'tree', 'forest'):
                    with self.subTest(classes=count, kind=kind):
                        estimator = TRAINING.create_estimator(kind)
                        estimator.fit(x, y)
                        model = TRAINING.export_model(estimator, kind, value['featureNames'], value['labels'])
                        queries = np.asarray([[0, 0], [5, 2.5], [10, 5], [20, 10]], dtype=np.float64)
                        probabilities = estimator.predict_proba(queries)
                        for features, expected in zip(queries, probabilities):
                            code, score = TRAINING.predict_model(model, features.tolist())
                            best = int(np.argmax(expected))
                            self.assertAlmostEqual(score, float(expected[best]), places=10)
                            self.assertEqual(code, best if expected[best] >= .55 else -1)

    def test_float32_tree_comparisons_and_unknown_threshold_match_contract(self):
        """float32 舍入方向与低置信未知都明确固定。"""
        tree = {'schemaVersion': 1, 'runtime': 'cpu-classifier-v1', 'kind': 'tree', 'featureNames': ['pressure'],
                'classLabels': ['左', '右'], 'minConfidence': .55,
                'trees': [{'nodes': [{'feature': 0, 'threshold': 1, 'left': 1, 'right': 2},
                                     {'probabilities': [1, 0]}, {'probabilities': [0, 1]}]}]}
        self.assertEqual(TRAINING.predict_model(tree, [1.00000001]), (0, 1))
        linear = {'kind': 'linear', 'classLabels': ['左', '右'], 'minConfidence': .55,
                  'scaler': {'mean': [0], 'scale': [1]}, 'weights': [[0], [1]], 'intercepts': [0, 0]}
        self.assertEqual(TRAINING.predict_model(linear, [0]), (-1, .5))
        rows = payload(groups=1)['windows'][:1]
        report = TRAINING.evaluate_predictions(rows, [(-1, .5)], ['左', '右'], 'development-only', 'development')
        self.assertEqual(report['unknown'], 1)
        self.assertEqual(report['accuracy'], 0)
        self.assertEqual(report['confusion'][0], [0, 0, 1])
        self.assertEqual(report['predictions'][0]['predicted'], '未知')

    def test_invalid_numeric_shapes_groups_and_split_leakage_are_rejected(self):
        """无效输入在训练前拦截，不自动猜类别或拆分采集组。"""
        mutations = [
            lambda value: value['windows'][0]['features'].__setitem__(0, float('nan')),
            lambda value: value['windows'][0]['features'].__setitem__(0, True),
            lambda value: value['windows'][0].__setitem__('features', [1]),
            lambda value: value['windows'][0].__setitem__('group', ''),
            lambda value: value['windows'][0].__setitem__('split', 'random-test'),
            lambda value: value['windows'][0].__setitem__('label', 8),
            lambda value: value.__setitem__('featureNames', ['duplicate', 'duplicate']),
            lambda value: value.__setitem__('mode', 'arbitrary-python'),
        ]
        for mutate in mutations:
            value = payload()
            mutate(value)
            with self.subTest(mutate=mutate), self.assertRaises(TRAINING.TrainingError):
                TRAINING.validate_payload(value)
        value = payload(validation=True)
        validation = next(row for row in value['windows'] if row['split'] == 'validation')
        validation['group'] = value['windows'][0]['group']
        with self.assertRaises(TRAINING.TrainingError) as error:
            TRAINING.validate_payload(value)
        self.assertEqual(error.exception.code, 'CPU_TRAINING_DATA_INVALID')

    def test_window_feature_and_model_limits_fail_explicitly(self):
        """资源上限拒绝过量请求和过大模型，不输出半个模型。"""
        value = payload()
        value['windows'] = [value['windows'][0]] * (TRAINING.MAX_WINDOWS + 1)
        with self.assertRaises(TRAINING.TrainingError):
            TRAINING.validate_payload(value)
        value = payload()
        value['featureNames'] = [f'feature{index}' for index in range(65)]
        with self.assertRaises(TRAINING.TrainingError):
            TRAINING.validate_payload(value)
        with mock.patch.object(TRAINING, 'MAX_MODEL_BYTES', 10), self.assertRaises(TRAINING.TrainingError) as error:
            TRAINING.fit_candidate('tree', payload()['windows'], payload()['featureNames'], payload()['labels'])
        self.assertEqual(error.exception.code, 'CPU_TRAINING_MODEL_LIMIT')

    def test_cli_reads_one_bounded_json_and_returns_public_errors(self):
        """坏 JSON、过大输入和过大报告都只产生一个有限 JSON 回执。"""
        for content in (b'not json', b'{"x":NaN}', b'\xff'):
            output = io.StringIO()
            TRAINING.main(io.BytesIO(content), output)
            response = json.loads(output.getvalue())
            self.assertFalse(response['ok'])
            self.assertEqual(response['error']['code'], 'CPU_TRAINING_DATA_INVALID')
            self.assertEqual(len(output.getvalue().splitlines()), 1)
        output = io.StringIO()
        with mock.patch.object(TRAINING, 'MAX_INPUT_BYTES', 8):
            TRAINING.main(io.BytesIO(b' ' * 9), output)
        self.assertEqual(json.loads(output.getvalue())['error']['code'], 'CPU_TRAINING_DATA_INVALID')
        output = io.StringIO()
        with mock.patch.object(TRAINING, 'MAX_OUTPUT_BYTES', 64), mock.patch.object(TRAINING, 'train', return_value={'oversized': 'x' * 100}):
            TRAINING.main(io.BytesIO(b'{}'), output)
        self.assertEqual(json.loads(output.getvalue())['error']['code'], 'CPU_TRAINING_MODEL_LIMIT')

    def test_training_cli_skips_device_initialization_and_normal_rpc_stays_unchanged(self):
        """专用参数进入训练，正常启动仍初始化原算法并响应 ping。"""
        native = types.SimpleNamespace(initialize=mock.Mock())
        for arguments, request in ((['--train-classifier'], payload(groups=1)), ([], {'id': 'ping-test', 'fn': 'ping'})):
            native.initialize.reset_mock()
            output = io.StringIO()
            with self.subTest(arguments=arguments), mock.patch.dict(sys.modules, {'onbed_filter': native}), \
                    mock.patch.object(sys, 'argv', [str(APP / 'onbed_filter_example.py'), *arguments]), \
                    mock.patch.object(sys, 'stdin', io.StringIO(json.dumps(request) + '\n')), \
                    contextlib.redirect_stdout(output), contextlib.redirect_stderr(io.StringIO()):
                runpy.run_path(str(APP / 'onbed_filter_example.py'), run_name='__main__')
            response = json.loads(output.getvalue())
            self.assertTrue(response['ok'])
            self.assertEqual(len(output.getvalue().splitlines()), 1)
            if arguments:
                native.initialize.assert_not_called()
                self.assertIn('model', response['result'])
            else:
                native.initialize.assert_called_once_with()
                self.assertEqual(response, {'id': 'ping-test', 'ok': True, 'data': {'pong': True}})


if __name__ == '__main__':
    unittest.main()
