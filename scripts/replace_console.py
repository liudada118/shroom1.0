#!/usr/bin/env python3
"""
批量替换 server.js 中的 console.log/error/warn/info 为 logger 调用。
- console.log -> logger.info 或 logger.debug（根据内容判断）
- console.error -> logger.error
- console.warn -> logger.warn
- console.info -> logger.info
- 注释掉的 console 调用直接删除整行
- 保留 return console.log 的模式，改为 return logger.info
"""
import re
import sys

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    new_lines = []
    removed_comments = 0
    replaced = 0
    logger_required = False

    for i, line in enumerate(lines):
        stripped = line.strip()

        # 删除注释掉的 console 调用（整行是注释且包含 console）
        if re.match(r'^\s*//', stripped) and re.search(r'console\.(log|error|warn|info)', stripped):
            removed_comments += 1
            continue

        # 替换活跃的 console 调用
        if re.search(r'console\.(log|error|warn|info)', line) and not stripped.startswith('//'):
            original = line

            # console.error -> logger.error
            line = re.sub(r'console\.error\(', 'logger.error(', line)

            # console.warn -> logger.warn
            line = re.sub(r'console\.warn\(', 'logger.warn(', line)

            # console.info -> logger.info
            line = re.sub(r'console\.info\(', 'logger.info(', line)

            # console.log for debug-like messages (err, e, specific debug info)
            # 判断是否是调试信息
            if re.search(r'console\.log\(.*err.*\)', original, re.IGNORECASE):
                line = re.sub(r'console\.log\(', 'logger.warn(', line)
            elif re.search(r'console\.log\(.*"e"\)', original):
                line = re.sub(r'console\.log\(', 'logger.warn(', line)
            elif re.search(r'console\.log\(.*Event inserted.*\)', original):
                line = re.sub(r'console\.log\(', 'logger.debug(', line)
            elif re.search(r'console\.log\(.*export csv success.*\)', original):
                line = re.sub(r'console\.log\(', 'logger.info(', line)
            elif re.search(r'console\.log\(.*clear.*\)', original):
                line = re.sub(r'console\.log\(', 'logger.debug(', line)
            elif re.search(r'console\.log\(.*connected.*\)', original):
                line = re.sub(r'console\.log\(', 'logger.info(', line)
            elif re.search(r'console\.log\(.*disconnected.*\)', original):
                line = re.sub(r'console\.log\(', 'logger.info(', line)
            elif re.search(r'console\.log\(.*\[Path\].*\)', original):
                line = re.sub(r'console\.log\(', 'logger.info(', line)
            elif re.search(r'console\.log\(.*\[Config\].*\)', original):
                line = re.sub(r'console\.log\(', 'logger.info(', line)
            else:
                # 默认替换为 logger.debug
                line = re.sub(r'console\.log\(', 'logger.debug(', line)

            if line != original:
                replaced += 1
                logger_required = True

        new_lines.append(line)

    # 确保 logger 已被 require
    if logger_required:
        # 检查是否已经有 require('./logger')
        content = ''.join(new_lines)
        if "require('./logger')" not in content and 'require("./logger")' not in content:
            # 在文件开头添加 logger require
            new_lines.insert(0, "const logger = require('./logger');\n")

    with open(filepath, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)

    print(f"处理完成: {filepath}")
    print(f"  替换了 {replaced} 处 console 调用为 logger")
    print(f"  删除了 {removed_comments} 处注释掉的 console 调用")

if __name__ == '__main__':
    filepath = sys.argv[1] if len(sys.argv) > 1 else 'server.js'
    process_file(filepath)
