"""固定 CPU 分类训练入口；仅交换有限 JSON，不加载用户代码或 pickle。"""

import json
import math
import os
import re
import struct
import sys
import time


MAX_INPUT_BYTES = 8 * 1024 * 1024
MAX_OUTPUT_BYTES = 3 * 1024 * 1024
MAX_MODEL_BYTES = 2 * 1024 * 1024
MAX_WINDOWS = 16000
MAX_FEATURES = 64
SEED = 1729
MIN_CONFIDENCE = 0.55
CANDIDATES = (
    ('logistic-regression', '标准化逻辑回归', 'linear'),
    ('decision-tree', '决策树', 'tree'),
    ('random-forest', '随机森林', 'forest'),
)


class TrainingError(Exception):
    """携带可公开的训练错误，不回显 Python 堆栈或本机路径。"""

    def __init__(self, code, message):
        """保存供调用方处理的稳定错误码。"""
        super().__init__(message)
        self.code = code


def fail(message, code='CPU_TRAINING_DATA_INVALID'):
    """拒绝不满足固定训练契约的输入。"""
    raise TrainingError(code, message)


def numeric(value):
    """只接受有限数字，禁止把布尔值或 NaN 作为训练特征。"""
    return type(value) in (int, float) and math.isfinite(value) and abs(value) <= 1e15


def validate_payload(payload):
    """验证窗口、类别和采集组，独立验证组不能出现在开发数据中。"""
    if not isinstance(payload, dict) or type(payload.get('schemaVersion')) is not int or payload['schemaVersion'] != 1 or payload.get('mode') != 'quick':
        fail('训练请求格式或模式不受支持。')
    names, labels, rows = payload.get('featureNames'), payload.get('labels'), payload.get('windows')
    if not isinstance(names, list) or not 1 <= len(names) <= MAX_FEATURES or any(not isinstance(name, str) or not re.fullmatch(r'[A-Za-z][A-Za-z0-9_]{0,63}', name) for name in names) or len(set(names)) != len(names):
        fail('特征名称须唯一，每次最多 64 项。')
    if not isinstance(labels, list) or not 2 <= len(labels) <= 8 or any(not isinstance(label, str) or not label.strip() or len(label) > 40 or label == '未知' for label in labels) or len(set(labels)) != len(labels):
        fail('请选择 2～8 个不同的有效类别。')
    if payload.get('minConfidence', MIN_CONFIDENCE) != MIN_CONFIDENCE:
        fail('当前训练使用固定的最低置信分数 0.55。')
    if not isinstance(rows, list) or not 2 <= len(rows) <= MAX_WINDOWS:
        fail('每次训练须包含 2～16000 个窗口。')
    groups, records, development_classes = {}, {}, set()
    for row in rows:
        if not isinstance(row, dict) or not isinstance(row.get('features'), list) or len(row['features']) != len(names) or not all(numeric(value) for value in row['features']):
            fail('训练窗口包含无效数字或特征长度不一致。')
        if type(row.get('label')) is not int or not 0 <= row['label'] < len(labels):
            fail('窗口类别须对应已有类别。')
        if row.get('split') not in ('development', 'validation'):
            fail('窗口用途只能是开发集或独立验证集。')
        if not isinstance(row.get('group'), str) or not row['group'] or len(row['group']) > 200:
            fail('每个窗口都须携带真实采集组标识。')
        if not isinstance(row.get('recordId'), str) or not row['recordId'] or len(row['recordId']) > 200:
            fail('每个窗口都须携带采集记录标识。')
        if type(row.get('startFrame')) is not int or not 0 <= row['startFrame'] <= 1e9 or not numeric(row.get('timestamp')):
            fail('窗口帧位置或时间戳无效。')
        if row['group'] in groups and groups[row['group']] != row['split']:
            fail('同次采集不能同时用于开发集和独立验证集。')
        groups[row['group']] = row['split']
        identity = (row['group'], row['split'])
        if row['recordId'] in records and records[row['recordId']] != identity:
            fail('同条记录的采集组或用途不一致。')
        records[row['recordId']] = identity
        if row['split'] == 'development':
            development_classes.add(row['label'])
    if development_classes != set(range(len(labels))):
        fail('开发集须包含全部类别，不能只用验证集提供某一类别。')
    return names, labels, rows


def softmax(scores):
    """稳定计算线性分类概率，与客户端使用同一公式。"""
    peak = max(scores)
    values = [math.exp(value - peak) for value in scores]
    total = sum(values)
    return [value / total for value in values]


def tree_probabilities(tree, features):
    """树分支先转换 float32，与 sklearn 的输入比较保持一致。"""
    index = 0
    while True:
        node = tree['nodes'][index]
        if 'probabilities' in node:
            return node['probabilities']
        value = struct.unpack('f', struct.pack('f', features[node['feature']]))[0]
        index = node['left'] if value <= node['threshold'] else node['right']


def predict_model(model, features):
    """仅解释便携数值模型；低于阈值的结果返回未知类别。"""
    if model['kind'] == 'linear':
        scaled = [(value - mean) / scale for value, mean, scale in zip(features, model['scaler']['mean'], model['scaler']['scale'])]
        scores = [sum(weight * value for weight, value in zip(weights, scaled)) + intercept for weights, intercept in zip(model['weights'], model['intercepts'])]
        probabilities = softmax(scores)
    else:
        votes = [tree_probabilities(tree, features) for tree in model['trees']]
        probabilities = [sum(vote[index] for vote in votes) / len(votes) for index in range(len(model['classLabels']))]
    index = max(range(len(probabilities)), key=probabilities.__getitem__)
    score = probabilities[index]
    return (-1 if score < model['minConfidence'] else index), score


def export_tree(estimator, class_count):
    """导出固定深度的分支和叶概率，不序列化 sklearn 对象。"""
    tree = estimator.tree_
    nodes = []
    for index in range(tree.node_count):
        if tree.children_left[index] < 0:
            raw = tree.value[index][0]
            total = float(sum(raw))
            probabilities = [0.0] * class_count
            for position, code in enumerate(estimator.classes_):
                probabilities[int(code)] = float(raw[position] / total) if total else 0.0
            nodes.append({'probabilities': probabilities})
        else:
            nodes.append({'feature': int(tree.feature[index]), 'threshold': float(tree.threshold[index]),
                          'left': int(tree.children_left[index]), 'right': int(tree.children_right[index])})
    return {'nodes': nodes}


def export_model(estimator, kind, names, labels):
    """把受控候选转换为跨端 JSON，单个模型最多 2 MiB。"""
    model = {'schemaVersion': 1, 'runtime': 'cpu-classifier-v1', 'kind': kind,
             'featureNames': list(names), 'classLabels': list(labels), 'minConfidence': MIN_CONFIDENCE}
    if kind == 'linear':
        scaler, classifier = estimator.named_steps['scaler'], estimator.named_steps['classifier']
        weights, intercepts = classifier.coef_.tolist(), classifier.intercept_.tolist()
        if len(labels) == 2:
            weights = [[0.0] * len(names), weights[0]]
            intercepts = [0.0, intercepts[0]]
        model.update({'scaler': {'mean': scaler.mean_.tolist(), 'scale': scaler.scale_.tolist()}, 'weights': weights, 'intercepts': intercepts})
    else:
        estimators = estimator.estimators_ if kind == 'forest' else [estimator]
        model['trees'] = [export_tree(item, len(labels)) for item in estimators]
    encoded = json.dumps(model, ensure_ascii=False, allow_nan=False, separators=(',', ':')).encode('utf-8')
    if len(encoded) > MAX_MODEL_BYTES:
        fail('训练模型超过 2 MiB，请减少输入规模。', 'CPU_TRAINING_MODEL_LIMIT')
    return model


def create_estimator(kind):
    """只实例化固定 CPU 候选，禁止外部估计器和任意参数。"""
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.linear_model import LogisticRegression
    from sklearn.pipeline import Pipeline
    from sklearn.preprocessing import StandardScaler
    from sklearn.tree import DecisionTreeClassifier
    if kind == 'linear':
        return Pipeline([('scaler', StandardScaler()), ('classifier', LogisticRegression(max_iter=200, random_state=SEED, class_weight='balanced'))])
    if kind == 'tree':
        return DecisionTreeClassifier(max_depth=8, min_samples_leaf=2, random_state=SEED, class_weight='balanced')
    return RandomForestClassifier(n_estimators=32, max_depth=8, min_samples_leaf=2, n_jobs=1, random_state=SEED, class_weight='balanced')


def development_folds(rows, class_count):
    """只按开发集采集组分折；组不足时诚实回退开发集评估。"""
    from sklearn.model_selection import StratifiedGroupKFold
    class_groups = [{row['group'] for row in rows if row['label'] == code} for code in range(class_count)]
    count = min(3, *(len(groups) for groups in class_groups))
    warning = '每类独立采集组不足，当前仅为开发集评估，不能证明对新采集或新人员有效。'
    if count < 2:
        return [], [warning]
    folds = list(StratifiedGroupKFold(n_splits=count, shuffle=True, random_state=SEED).split(
        [[0]] * len(rows), [row['label'] for row in rows], [row['group'] for row in rows]))
    if any({rows[int(index)]['label'] for index in train} != set(range(class_count)) for train, _test in folds):
        return [], ['当前采集组分布无法形成完整的分组交叉验证，已回退开发集评估；请补充各类独立采集。']
    return folds, []


def evaluate_predictions(rows, predicted, labels, evaluation, split):
    """用便携预测结果生成混淆矩阵、逐类指标与真实错例。"""
    class_count = len(labels)
    confusion = [[0] * (class_count + 1) for _label in labels]
    predictions = []
    correct, unknown = 0, 0
    for row, (code, score) in zip(rows, predicted):
        expected = row['label']
        confusion[expected][class_count if code < 0 else code] += 1
        correct += code == expected
        unknown += code < 0
        predictions.append({'recordId': row['recordId'], 'startFrame': row['startFrame'], 'timestamp': row['timestamp'],
                            'expected': labels[expected], 'predicted': '未知' if code < 0 else labels[code], 'correct': code == expected,
                            'classIndex': code, 'score': score})
    per_class = []
    for code, label in enumerate(labels):
        support = sum(confusion[code])
        predicted_count = sum(row[code] for row in confusion)
        true_positive = confusion[code][code]
        precision = true_positive / predicted_count if predicted_count else 0.0
        recall = true_positive / support if support else 0.0
        f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
        per_class.append({'label': label, 'precision': precision, 'recall': recall, 'f1': f1, 'support': support})
    return {'split': split, 'labels': list(labels), 'windows': len(rows), 'correct': correct, 'unknown': unknown,
            'accuracy': correct / len(rows), 'confusion': confusion, 'columns': list(labels) + ['未知'], 'predictions': predictions,
            'evaluation': evaluation, 'macroF1': sum(item['f1'] for item in per_class) / class_count, 'perClass': per_class}


def fit_candidate(kind, rows, names, labels):
    """在给定开发窗口拟合候选并立即导出便携模型。"""
    import numpy as np
    estimator = create_estimator(kind)
    estimator.fit(np.asarray([row['features'] for row in rows], dtype=np.float64), [row['label'] for row in rows])
    return export_model(estimator, kind, names, labels)


def score_candidate(kind, rows, folds, names, labels):
    """候选评分仅使用开发数据，标准化也只在当前训练折拟合。"""
    if not folds:
        model = fit_candidate(kind, rows, names, labels)
        predictions = [predict_model(model, row['features']) for row in rows]
        return evaluate_predictions(rows, predictions, labels, 'development-only', 'development')
    predicted = [None] * len(rows)
    for train, test in folds:
        model = fit_candidate(kind, [rows[int(index)] for index in train], names, labels)
        for index in test:
            predicted[int(index)] = predict_model(model, rows[int(index)]['features'])
    return evaluate_predictions(rows, predicted, labels, 'group-cross-validation', 'development')


def train(payload):
    """固定种子和单线程训练；独立验证只在最终候选冻结后执行一次。"""
    names, labels, rows = validate_payload(payload)
    started = time.monotonic()
    for variable in ('OMP_NUM_THREADS', 'OPENBLAS_NUM_THREADS', 'MKL_NUM_THREADS', 'BLIS_NUM_THREADS', 'VECLIB_MAXIMUM_THREADS', 'NUMEXPR_NUM_THREADS'):
        os.environ[variable] = '1'
    import warnings
    from threadpoolctl import threadpool_limits
    from sklearn.exceptions import ConvergenceWarning
    development = [row for row in rows if row['split'] == 'development']
    validation = [row for row in rows if row['split'] == 'validation']
    candidates, reports = [], {}
    with threadpool_limits(limits=1), warnings.catch_warnings(record=True) as recorded:
        warnings.simplefilter('always', ConvergenceWarning)
        folds, notices = development_folds(development, len(labels))
        for identifier, name, kind in CANDIDATES:
            candidate_started = time.monotonic()
            candidate = {'id': identifier, 'name': name, 'kind': kind, 'status': 'failed', 'selected': False, 'seconds': 0.0}
            try:
                report = score_candidate(kind, development, folds, names, labels)
                candidate.update({'status': 'succeeded', 'macroF1': report['macroF1'], 'accuracy': report['accuracy'],
                                  'unknown': report['unknown'], 'evaluation': report['evaluation'], 'folds': len(folds)})
                reports[identifier] = report
            except Exception:
                candidate['message'] = '该候选未能完成受控训练，未参与模型选择。'
            candidate['seconds'] = time.monotonic() - candidate_started
            candidates.append(candidate)
        eligible = sorted((candidate for candidate in candidates if candidate['status'] == 'succeeded'), key=lambda candidate: -candidate['macroF1'])
        model, selected = None, None
        for candidate in eligible:
            try:
                model = fit_candidate(candidate['kind'], development, names, labels)
                selected = candidate
                break
            except Exception:
                candidate['status'] = 'failed'
                candidate['message'] = '最终模型未能通过导出限制，未使用此候选。'
        if model is None:
            fail('没有候选完成训练，请检查采集数据与输入规模。', 'CPU_TRAINING_UNAVAILABLE')
        selected['selected'] = True
        if any(isinstance(item.message, ConvergenceWarning) for item in recorded):
            notices.append('部分线性拟合达到迭代上限；请结合独立验证与错例判断效果。')
        if validation:
            report = evaluate_predictions(validation, [predict_model(model, row['features']) for row in validation], labels, 'independent-validation', 'validation')
            if {row['label'] for row in validation} != set(range(len(labels))):
                notices.append('独立验证未覆盖全部类别，不能据此确认所有类别的实际效果。')
        else:
            report = reports[selected['id']]
            notices.append('未提供独立验证记录；交叉验证或开发集成绩不能替代真实新采集验证。')
    report.update({'selectedModel': selected['id'], 'candidates': candidates, 'warnings': notices,
                   'trainingSeconds': time.monotonic() - started,
                   'developmentGroups': len({row['group'] for row in development}),
                   'validationGroups': len({row['group'] for row in validation})})
    return {'model': model, 'report': report, 'candidates': candidates}


def reject_json_constant(_value):
    """拒绝 JSON 扩展 NaN/Infinity，避免跨端解析结果不同。"""
    fail('训练请求含非有限数字。')


def main(stdin=None, stdout=None):
    """一次读取有限 JSON 并输出一次结果，供专用子进程调用。"""
    stdin = stdin if stdin is not None else getattr(sys.stdin, 'buffer', sys.stdin)
    stdout = stdout if stdout is not None else sys.stdout
    try:
        data = stdin.read(MAX_INPUT_BYTES + 1)
        if isinstance(data, str):
            data = data.encode('utf-8')
        if len(data) > MAX_INPUT_BYTES:
            fail('训练请求超过 8 MiB，请减少所选数据。')
        payload = json.loads(data.decode('utf-8'), parse_constant=reject_json_constant)
        response = {'ok': True, 'result': train(payload)}
        output = json.dumps(response, ensure_ascii=False, allow_nan=False, separators=(',', ':'))
        if len(output.encode('utf-8')) > MAX_OUTPUT_BYTES:
            fail('训练报告超过输出上限，请减少所选数据。', 'CPU_TRAINING_MODEL_LIMIT')
    except TrainingError as error:
        output = json.dumps({'ok': False, 'error': {'code': error.code, 'message': str(error)}}, ensure_ascii=False)
    except (ValueError, UnicodeError):
        output = json.dumps({'ok': False, 'error': {'code': 'CPU_TRAINING_DATA_INVALID', 'message': '训练请求不是有效的 UTF-8 JSON。'}}, ensure_ascii=False)
    except ImportError:
        output = json.dumps({'ok': False, 'error': {'code': 'CPU_TRAINING_UNAVAILABLE', 'message': '本机缺少 CPU 训练依赖，请更新软件运行时。'}}, ensure_ascii=False)
    except Exception:
        output = json.dumps({'ok': False, 'error': {'code': 'CPU_TRAINING_UNAVAILABLE', 'message': '本机训练未完成，请检查采集数据或更新软件运行时。'}}, ensure_ascii=False)
    stdout.write(output + '\n')
    stdout.flush()


if __name__ == '__main__':
    main()
