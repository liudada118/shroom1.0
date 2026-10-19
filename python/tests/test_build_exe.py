"""校验 CPU 训练依赖打包边界，不执行 PyInstaller 或导入真实训练库。"""

import contextlib
import importlib.util
import io
import pathlib
import tempfile
import types
import unittest
from unittest import mock


SCRIPT = pathlib.Path(__file__).resolve().parents[1] / 'build_exe.py'
SPEC = importlib.util.spec_from_file_location('shroom_build_exe_tests', SCRIPT)
BUILD = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BUILD)


def fake_training_module(name):
    """提供可调用的受支持符号，避免测试加载真实模型或其 DLL。"""
    module = types.SimpleNamespace(__file__=str(SCRIPT.parent / 'fake-site-packages' / name / '__init__.py'))
    for symbol in BUILD.CPU_TRAINING_IMPORTS[name]:
        setattr(module, symbol, lambda: None)
    return module


class CpuTrainingBuildTests(unittest.TestCase):
    """确保必要 CPU 入口齐全，缺依赖不会产出看似成功的构建。"""

    def test_preflight_requires_models_group_validation_and_runtime_helpers(self):
        """预检实际解析训练能力，不只检查发行包名称。"""
        importer = mock.Mock(side_effect=fake_training_module)
        modules = BUILD.validate_cpu_training_dependencies(importer)
        for name in ('sklearn.linear_model', 'sklearn.tree', 'sklearn.ensemble', 'sklearn.neighbors',
                     'sklearn.preprocessing', 'sklearn.model_selection', 'sklearn.metrics',
                     'sklearn.pipeline', 'joblib', 'threadpoolctl', 'narwhals'):
            self.assertIn(name, modules)
        self.assertIn('RandomForestClassifier', BUILD.CPU_TRAINING_IMPORTS['sklearn.ensemble'])
        self.assertIn('StratifiedGroupKFold', BUILD.CPU_TRAINING_IMPORTS['sklearn.model_selection'])
        self.assertEqual(importer.call_count, len(BUILD.CPU_TRAINING_IMPORTS))

    def test_missing_or_broken_dependency_reports_repair_command(self):
        """缺模块和 ABI 导入故障都应在 PyInstaller 分析之前暴露。"""
        for failure in (ModuleNotFoundError('No module named sklearn'), OSError('DLL load failed'), ValueError('numpy ABI mismatch')):
            with self.subTest(error=type(failure).__name__):
                with self.assertRaisesRegex(RuntimeError, 'CPU 训练依赖 sklearn 无法加载.*requirements.txt'):
                    BUILD.validate_cpu_training_dependencies(mock.Mock(side_effect=failure))

    def test_missing_group_validation_api_fails_preflight(self):
        """安装了过旧库但缺少分组验证接口时不能误报依赖已齐全。"""
        def importer(name):
            """仅让分组验证入口缺失，模拟不兼容的 sklearn 版本。"""
            module = fake_training_module(name)
            if name == 'sklearn.model_selection':
                del module.StratifiedGroupKFold
            return module
        with self.assertRaisesRegex(RuntimeError, 'sklearn.model_selection.StratifiedGroupKFold'):
            BUILD.validate_cpu_training_dependencies(importer)

    def test_missing_training_dependency_never_invokes_pyinstaller(self):
        """预检失败不启动构建，也不输出一个不可用的新运行时。"""
        with mock.patch.object(BUILD, 'resolve_onbed_filter_binary', return_value='native.pyd'), \
                mock.patch.object(BUILD, 'validate_cpu_training_dependencies', side_effect=RuntimeError('CPU 训练依赖 sklearn 无法加载')), \
                mock.patch.object(BUILD.subprocess, 'run') as run, contextlib.redirect_stdout(io.StringIO()) as output:
            with self.assertRaises(SystemExit) as error:
                BUILD.build()
            self.assertEqual(error.exception.code, 1)
            run.assert_not_called()
            self.assertIn('CPU 训练依赖 sklearn 无法加载', output.getvalue())

    def test_cpu_hidden_imports_metadata_and_gpu_exclusions_reach_build_command(self):
        """构建命令包含客户机所需 CPU 模块，同时保留框架排除项。"""
        modules = BUILD.validate_cpu_training_dependencies(fake_training_module)
        with mock.patch.object(BUILD, 'resolve_onbed_filter_binary', return_value='native.pyd'), \
                mock.patch.object(BUILD, 'validate_cpu_training_dependencies', return_value=modules), \
                mock.patch.object(BUILD, 'runtime_contains_onbed_filter', return_value=True), \
                mock.patch.object(BUILD.platform, 'system', return_value='Windows'), \
                mock.patch.object(BUILD.platform, 'machine', return_value='AMD64'), \
                mock.patch.object(BUILD.subprocess, 'run', return_value=types.SimpleNamespace(returncode=0)) as run, \
                mock.patch.object(BUILD.os, 'walk', return_value=[]), contextlib.redirect_stdout(io.StringIO()):
            BUILD.build()
        args = run.call_args.args[0]
        pairs = list(zip(args, args[1:]))
        for module in BUILD.CPU_TRAINING_IMPORTS:
            self.assertIn(('--hidden-import', module), pairs)
        for distribution in ('scikit-learn', 'joblib', 'threadpoolctl', 'narwhals'):
            self.assertIn(('--copy-metadata', distribution), pairs)
        self.assertIn(('--collect-binaries', 'sklearn'), pairs)
        self.assertIn(('--hidden-import', 'cpu_classifier_training'), pairs)
        self.assertIn(('--exclude-module', 'torch'), pairs)
        self.assertIn(('--exclude-module', 'tensorflow'), pairs)
        self.assertNotIn(('--collect-all', 'sklearn'), pairs)

    def test_wheel_shared_libraries_keep_their_package_relative_locations(self):
        """旁置及包内 DLL 保持目录，兼容 Windows 和 Unix 路径分隔符。"""
        with tempfile.TemporaryDirectory(prefix='shroom-cpu-build-test-') as temporary:
            site = pathlib.Path(temporary)
            package = site / 'sklearn'
            package.mkdir()
            paths = [(site / 'scikit_learn.libs', 'scikit_learn.libs'),
                     (site / 'sklearn.libs', 'sklearn.libs'),
                     (package / '.libs', 'sklearn/.libs'),
                     (package / '.dylibs', 'sklearn/.dylibs')]
            for directory, _destination in paths:
                directory.mkdir()
                (directory / 'cpu-math.dll').write_bytes(b'synthetic-library')
            module = types.SimpleNamespace(__file__=str(package / '__init__.py'))
            for platform, separator in (('Windows', ';'), ('Darwin', ':')):
                with self.subTest(platform=platform), mock.patch.object(BUILD.platform, 'system', return_value=platform):
                    args = BUILD.cpu_training_pyinstaller_args(module)
                    pairs = list(zip(args, args[1:]))
                    for directory, destination in paths:
                        self.assertIn(('--add-binary', f'{directory}{separator}{destination}'), pairs)


if __name__ == '__main__':
    unittest.main()
