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


def first_existing_path(candidates):
    for candidate in candidates:
        if os.path.exists(candidate):
            return candidate
    return None


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
            raise FileNotFoundError(
                f"正式 Windows runtime 缺少必需动态库: {pyd_file}"
            )
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
    pet_care_dir = os.path.join(app_dir, 'petCare')
    pet_care_binary = None
    pet_care_mini_binary = None
    if platform.system() == 'Windows':
        pet_care_binary = first_existing_path([
            os.path.join(pet_care_dir, 'pet_care_wrapper.cp311-win_amd64.pyd'),
        ])
        if pet_care_binary is None:
            candidate = os.path.join(pet_care_dir, 'pet_care_wrapper.cp311-win_amd64.pyd')
            print(f"璀﹀憡: 鎵句笉鍒?petCare 鍔ㄦ€佸簱 {candidate}")
        pet_care_mini_binary = first_existing_path([
            os.path.join(pet_care_dir, 'pet_care_wrappermini.cp311-win_amd64.pyd'),
        ])
        if pet_care_mini_binary is None:
            mini_candidate = os.path.join(pet_care_dir, 'pet_care_wrappermini.cp311-win_amd64.pyd')
            print(f"璀﹀憡: 鎵句笉鍒?petCare mini 鍔ㄦ€佸簱 {mini_candidate}")
    elif platform.system() == 'Darwin':
        pet_care_binary = first_existing_path([
            os.path.join(pet_care_dir, 'pet_care_wrapper.cpython-311-darwin.so'),
        ])
        if pet_care_binary is None:
            candidate = os.path.join(pet_care_dir, 'pet_care_wrapper.cpython-311-darwin.so')
            print(f"警告: 找不到 macOS petCare 动态库 {candidate}")
        pet_care_mini_binary = first_existing_path([
            os.path.join(pet_care_dir, 'people20_care_wrapper.cpython-311-darwin.so'),
            os.path.join(pet_care_dir, 'pet_care_wrappermini.cpython-311-darwin.so'),
        ])
        if pet_care_mini_binary is None:
            searched = [
                os.path.join(pet_care_dir, 'people20_care_wrapper.cpython-311-darwin.so'),
                os.path.join(pet_care_dir, 'pet_care_wrappermini.cpython-311-darwin.so'),
            ]
            print(f"警告: 找不到 macOS petCare mini 动态库 {searched}")

    args = [
        sys.executable, '-m', 'PyInstaller',
        '--name', 'onbed_server',
        '--noconfirm',
        '--clean',
        # 不使用 --onefile，保持目录结构以减少启动时间
        '--distpath', os.path.join(script_dir, 'dist'),
        '--workpath', os.path.join(script_dir, 'build'),
        '--specpath', script_dir,
        '--paths', app_dir,
        '--paths', pet_care_dir,
        # 隐藏控制台窗口
        '--console',
        # 收集 numpy
        '--collect-all', 'numpy',
        # 足压分析运行时依赖
        '--hidden-import', 'real_time_and_replay_cop_speed_2',
        '--hidden-import', 'oneStep',
        '--hidden-import', 'oneStep.OneStep_template',
        '--hidden-import', 'oneStep.Comprehensive_Indicators_4096_modify_input3',
        '--add-data',
        f"{os.path.join(app_dir, 'oneStep', 'icon')}{';' if platform.system() == 'Windows' else ':'}oneStep/icon",
        # 排除不需要的大模块以减小体积
        '--exclude-module', 'tkinter',
        '--exclude-module', 'torch',
        '--exclude-module', 'tensorflow',
    ]

    # 添加动态库为二进制文件 (--add-binary "source;destination", Windows用;, Unix用:)
    # 注意: petCare 库需独立于 onbed_filter 打包, 否则缺 onbed_filter 时宠物看护也会被漏掉
    sep = ';' if platform.system() == 'Windows' else ':'
    if pyd_file:
        args.extend(['--add-binary', f'{pyd_file}{sep}.'])
    if pet_care_binary:
        args.extend(['--add-binary', f'{pet_care_binary}{sep}petCare'])
    if pet_care_mini_binary:
        args.extend(['--add-binary', f'{pet_care_mini_binary}{sep}petCare'])

    args.append(entry)

    if pet_care_binary:
        print(f"petCare 鍔ㄦ€佸簱: {pet_care_binary}")
    if pet_care_mini_binary:
        print(f"petCare mini 鍔ㄦ€佸簱: {pet_care_mini_binary}")
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
