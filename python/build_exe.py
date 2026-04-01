"""
PyInstaller 打包脚本
将 onbed_filter_example.py 打包为独立可执行文件

使用方法:
    Windows:  python build_exe.py
    macOS:    python3 build_exe.py

前提条件:
    pip install pyinstaller numpy

打包后的可执行文件位于:
    dist/onbed_server/onbed_server.exe  (Windows)
    dist/onbed_server/onbed_server      (macOS/Linux)

部署到 Electron 项目:
    将 dist/onbed_server/ 目录复制到 Electron 项目的 resources/python/ 目录下
"""

import subprocess
import sys
import os
import platform
import shutil

def build():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    app_dir = os.path.join(script_dir, 'app')
    entry = os.path.join(app_dir, 'onbed_filter_example.py')

    if not os.path.exists(entry):
        print(f"错误: 找不到入口文件 {entry}")
        sys.exit(1)

    # 确定 onbed_filter 动态库文件
    if platform.system() == 'Windows':
        pyd_file = os.path.join(app_dir, 'onbed_filter.cp311-win_amd64.pyd')
        if not os.path.exists(pyd_file):
            print(f"警告: 找不到 Windows 动态库 {pyd_file}")
            pyd_file = None
    elif platform.system() == 'Darwin':
        so_file = os.path.join(app_dir, 'onbed_filter.cpython-311-darwin.so')
        if not os.path.exists(so_file):
            print(f"警告: 找不到 macOS 动态库 {so_file}")
            pyd_file = None
        else:
            pyd_file = so_file
    else:
        print(f"警告: 不支持的平台 {platform.system()}")
        pyd_file = None

    # PyInstaller 参数
    args = [
        sys.executable, '-m', 'PyInstaller',
        '--name', 'onbed_server',
        '--noconfirm',
        '--clean',
        # 不使用 --onefile，保持目录结构以减少启动时间
        '--distpath', os.path.join(script_dir, 'dist'),
        '--workpath', os.path.join(script_dir, 'build'),
        '--specpath', script_dir,
        # 隐藏控制台窗口
        '--console',
        # 收集 numpy
        '--collect-all', 'numpy',
        # 排除不需要的大模块以减小体积
        '--exclude-module', 'tkinter',
        '--exclude-module', 'matplotlib',
        '--exclude-module', 'scipy',
        '--exclude-module', 'pandas',
        '--exclude-module', 'PIL',
        '--exclude-module', 'cv2',
        '--exclude-module', 'torch',
        '--exclude-module', 'tensorflow',
    ]

    # 添加 onbed_filter 动态库为二进制文件
    if pyd_file:
        # --add-binary "source;destination" (Windows用;, Unix用:)
        sep = ';' if platform.system() == 'Windows' else ':'
        args.extend(['--add-binary', f'{pyd_file}{sep}.'])

    args.append(entry)

    print("=" * 60)
    print("开始 PyInstaller 打包")
    print(f"平台: {platform.system()} {platform.machine()}")
    print(f"Python: {sys.version}")
    print(f"入口: {entry}")
    if pyd_file:
        print(f"动态库: {pyd_file}")
    print("=" * 60)

    result = subprocess.run(args, cwd=script_dir)

    if result.returncode == 0:
        dist_dir = os.path.join(script_dir, 'dist', 'onbed_server')
        print("\n" + "=" * 60)
        print("打包成功！")
        print(f"输出目录: {dist_dir}")
        
        # 计算目录大小
        total_size = 0
        for dirpath, dirnames, filenames in os.walk(dist_dir):
            for f in filenames:
                fp = os.path.join(dirpath, f)
                total_size += os.path.getsize(fp)
        print(f"总大小: {total_size / 1024 / 1024:.1f} MB")
        print("=" * 60)
        print("\n部署说明:")
        print(f"  将 {dist_dir} 目录复制到 Electron 项目的")
        print("  resources/python/ 目录下即可。")
        print("  pyWorker.js 会自动检测并使用打包后的可执行文件。")
    else:
        print("\n打包失败！请检查错误信息。")
        sys.exit(1)


if __name__ == '__main__':
    build()
