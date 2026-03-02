#!/usr/bin/env python3
"""
为 video/foot/car 目录中的 Three.js 组件添加 cleanupThree 导入和正确的资源清理。
"""

import os
import re

os.chdir('/home/ubuntu/shroom1.0')

# 需要处理的文件列表（包含 WebGLRenderer 的文件）
files = [
    "client/src/components/video/chairQX.js",
    "client/src/components/video/foot.js",
    "client/src/components/video/foot256.js",
    "client/src/components/video/hand copy.js",
    "client/src/components/video/hand.js",
    "client/src/components/video/robot copy 2.js",
    "client/src/components/video/robot copy 3.js",
    "client/src/components/video/robot copyblue.js",
    "client/src/components/video/robot0428.js",
    "client/src/components/video/robotLCF.js",
    "client/src/components/video/robotSY.js",
    "client/src/components/foot/Three1.js",
    "client/src/components/car/box100_3.js",
]

def fix_file(filepath):
    if not os.path.exists(filepath):
        print(f"  不存在: {filepath}")
        return False
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if 'cleanupThree' in content:
        print(f"  跳过（已修复）: {filepath}")
        return False
    
    if 'WebGLRenderer' not in content and 'renderer' not in content:
        print(f"  跳过（无 renderer）: {filepath}")
        return False
    
    original = content
    
    # 计算相对路径到 disposeThree.js
    file_dir = os.path.dirname(filepath)
    dispose_path = "client/src/components/three/disposeThree"
    rel_path = os.path.relpath(dispose_path, file_dir).replace('\\', '/')
    if not rel_path.startswith('.'):
        rel_path = './' + rel_path
    
    import_line = f'import {{ cleanupThree }} from "{rel_path}";'
    
    # 1. 添加 import
    lines = content.split('\n')
    last_import_idx = -1
    for i, line in enumerate(lines):
        if line.strip().startswith('import ') or line.strip().startswith('import{'):
            last_import_idx = i
    
    if last_import_idx >= 0:
        lines.insert(last_import_idx + 1, import_line)
    else:
        lines.insert(0, import_line)
    
    content = '\n'.join(lines)
    
    # 2. 在 cleanup 中添加 cleanupThree
    lines = content.split('\n')
    for i, line in enumerate(lines):
        if ('selectHelper' in line and 'dispose' in line):
            indent = len(line) - len(line.lstrip())
            cleanup_line = ' ' * indent + 'cleanupThree({ renderer, scene, controls });'
            lines.insert(i + 1, cleanup_line)
            break
    else:
        # 没找到 selectHelper.dispose，找 return () => {
        for i, line in enumerate(lines):
            if line.strip() == 'return () => {':
                indent = len(line) - len(line.lstrip()) + 2
                cleanup_line = ' ' * indent + 'cleanupThree({ renderer, scene, controls });'
                lines.insert(i + 1, cleanup_line)
                break
    
    content = '\n'.join(lines)
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"  已修复: {filepath}")
        return True
    else:
        print(f"  未变更: {filepath}")
        return False

fixed = 0
for f in files:
    if fix_file(f):
        fixed += 1

print(f"\n总计修复: {fixed} 个文件")
