#!/usr/bin/env python3
"""
修复 server.js 中重复的 JSON.parse(message) 调用。

策略：
- 在每个 ws.on("message", ...) 回调中，找到已有的 const getMessage = JSON.parse(message)
- 将后续所有 JSON.parse(message).xxx 替换为 getMessage.xxx
- 如果没有 getMessage 变量，在回调开头添加
"""

import re
import os

os.chdir('/home/ubuntu/shroom1.0')

with open('server.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 统计替换前的 JSON.parse(message) 数量
before_count = content.count('JSON.parse(message)')
print(f"替换前 JSON.parse(message) 出现次数: {before_count}")

# 替换所有 JSON.parse(message).xxx 为 getMessage.xxx
# 但保留第一次定义 const getMessage = JSON.parse(message) 的行
lines = content.split('\n')
new_lines = []
in_message_handler = False
has_getMessage = False

for i, line in enumerate(lines):
    # 检测是否进入了 message handler
    if 'ws.on("message"' in line or "ws.on('message'" in line:
        in_message_handler = True
        has_getMessage = False
    
    # 保留 const getMessage = JSON.parse(message) 定义
    if 'const getMessage = JSON.parse(message)' in line:
        has_getMessage = True
        new_lines.append(line)
        continue
    
    # 替换 JSON.parse(message) 为 getMessage
    if 'JSON.parse(message)' in line:
        new_line = line.replace('JSON.parse(message)', 'getMessage')
        new_lines.append(new_line)
    else:
        new_lines.append(line)

content = '\n'.join(new_lines)

after_count = content.count('JSON.parse(message)')
print(f"替换后 JSON.parse(message) 出现次数: {after_count}")
print(f"替换了 {before_count - after_count} 处")

with open('server.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("server.js 已更新")
