#!/usr/bin/env python3
"""
为所有 Three.js 组件添加 cleanupThree 导入和正确的资源清理。

策略：
1. 在文件顶部添加 import { cleanupThree } from './disposeThree';
2. 在 useEffect cleanup 的 return () => { ... } 中添加 cleanupThree 调用
"""

import os
import re
import glob

THREE_DIR = "client/src/components/three"

# 需要修复的文件（排除 copy 文件、工具文件、样式文件）
EXCLUDE_PATTERNS = [
    "disposeThree.js",
    "SelectionBox.js",
    "SelectionHelper.js",
    "threeUtil",
    ".scss",
]

def should_process(filename):
    basename = os.path.basename(filename)
    for pat in EXCLUDE_PATTERNS:
        if pat in basename:
            return False
    return basename.endswith('.js')

def has_renderer(content):
    """检查文件是否使用 WebGLRenderer"""
    return 'WebGLRenderer' in content or 'renderer' in content

def fix_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if not has_renderer(content):
        print(f"  跳过（无 renderer）: {filepath}")
        return False
    
    if 'cleanupThree' in content:
        print(f"  跳过（已修复）: {filepath}")
        return False
    
    original = content
    
    # 1. 添加 import 语句
    # 找到最后一个 import 语句的位置
    import_line = 'import { cleanupThree } from "./disposeThree";\n'
    
    # 在文件开头的 import 区域后添加
    lines = content.split('\n')
    last_import_idx = -1
    for i, line in enumerate(lines):
        if line.strip().startswith('import ') or line.strip().startswith('import{'):
            last_import_idx = i
    
    if last_import_idx >= 0:
        lines.insert(last_import_idx + 1, import_line.rstrip())
    else:
        lines.insert(0, import_line.rstrip())
    
    content = '\n'.join(lines)
    
    # 2. 在 return () => { 清理块中添加 cleanupThree
    # 匹配模式: return () => {\n ... selectHelper?.dispose() ... \n    };
    # 在 selectHelper?.dispose() 或 cancelAnimationFrame 之后添加 cleanupThree
    
    # 查找 return () => { 块
    pattern = r'(return \(\) => \{[^}]*?)((?:selectHelper\??\.dispose\(\))?)\s*\n(\s*\};)'
    
    def add_cleanup(match):
        before = match.group(1)
        dispose_line = match.group(2)
        closing = match.group(3)
        
        # 获取缩进
        indent = '      '
        
        cleanup_call = f'{indent}cleanupThree({{ renderer, scene, controls }});\n'
        
        if dispose_line:
            return f'{before}{dispose_line}\n{cleanup_call}{closing}'
        else:
            return f'{before}\n{cleanup_call}{closing}'
    
    content = re.sub(pattern, add_cleanup, content)
    
    # 如果上面的正则没有匹配到，尝试更宽松的匹配
    if 'cleanupThree({' not in content:
        # 找到 selectHelper?.dispose() 或 selectHelper.dispose() 行，在其后添加
        lines = content.split('\n')
        for i, line in enumerate(lines):
            if ('selectHelper' in line and 'dispose' in line) or \
               (i > 0 and 'cancelAnimationFrame' in lines[i-1] if i > 0 else False):
                indent = len(line) - len(line.lstrip())
                cleanup_line = ' ' * indent + 'cleanupThree({ renderer, scene, controls });'
                lines.insert(i + 1, cleanup_line)
                break
        content = '\n'.join(lines)
    
    # 如果还是没有添加成功，在 return () => { 后面直接添加
    if 'cleanupThree({' not in content:
        lines = content.split('\n')
        for i, line in enumerate(lines):
            stripped = line.strip()
            if stripped == 'return () => {':
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

def main():
    os.chdir('/home/ubuntu/shroom1.0')
    
    files = glob.glob(os.path.join(THREE_DIR, '*.js'))
    fixed = 0
    skipped = 0
    
    print("=== Three.js 内存泄漏修复 ===\n")
    
    for filepath in sorted(files):
        if should_process(filepath):
            if fix_file(filepath):
                fixed += 1
            else:
                skipped += 1
        else:
            print(f"  排除: {filepath}")
            skipped += 1
    
    # 也处理 copy 文件（因为 Home.js 引用了它们）
    print("\n--- 处理被引用的 copy 文件 ---")
    copy_files = [
        "client/src/components/three/carnewTest copy.js",
        "client/src/components/three/NumThreeColor copy.js",
        "client/src/components/three/hand0205 copy.js",
        "client/src/components/three/NumThreeColor copy 4.js",
        "client/src/components/three/hand0205 copy 2.js",
    ]
    for filepath in copy_files:
        if os.path.exists(filepath):
            if fix_file(filepath):
                fixed += 1
    
    print(f"\n总计: 修复 {fixed} 个文件, 跳过 {skipped} 个文件")

if __name__ == '__main__':
    main()
