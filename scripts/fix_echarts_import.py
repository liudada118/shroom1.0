#!/usr/bin/env python3
"""
将 import * as echarts from 'echarts' 替换为从 barrel file 导入。
"""

import os

os.chdir('/home/ubuntu/shroom1.0')

files_to_fix = {
    "client/src/components/aside/Aside copy.js": '../../assets/util/echarts',
    "client/src/components/foot/Car.js": '../../assets/util/echarts',
    "client/src/components/foot/Three1.js": '../../assets/util/echarts',
    "client/src/page/home/HomeFun.js": '../../assets/util/echarts',
}

for filepath, barrel_path in files_to_fix.items():
    if not os.path.exists(filepath):
        print(f"  不存在: {filepath}")
        continue
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    old_import = 'import * as echarts from "echarts"'
    old_import2 = "import * as echarts from 'echarts'"
    new_import = f'import * as echarts from "{barrel_path}"'
    
    if old_import in content:
        content = content.replace(old_import, new_import)
    elif old_import2 in content:
        content = content.replace(old_import2, new_import)
    else:
        print(f"  未找到 echarts 导入: {filepath}")
        continue
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"  已修复: {filepath}")

# 也修复 color 导入
color_file = "client/src/components/foot/Num32DetectLocal.js"
if os.path.exists(color_file):
    with open(color_file, 'r', encoding='utf-8') as f:
        content = f.read()
    if "from 'echarts'" in content:
        content = content.replace("from 'echarts'", "from '../../assets/util/echarts'")
        with open(color_file, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"  已修复: {color_file}")

print("完成")
