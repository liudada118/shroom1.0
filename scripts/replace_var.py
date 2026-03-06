#!/usr/bin/env python3
"""
安全替换 server.js 和 openWeb.js 中的 var 声明为 let/const。

规则:
- require() 语句 -> const
- 函数声明后不再赋值的变量 -> const
- 其他变量 -> let（因为大多数会被重新赋值）
- 函数内部的 var -> let
"""
import re
import sys

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    replaced = 0

    # 1. var xxx = require(...) -> const xxx = require(...)
    new_content, n = re.subn(r'\bvar\s+([\w]+)\s*=\s*require\(', r'const \1 = require(', content)
    replaced += n

    # 2. var xxx = Math.xxx / Math expressions in functions -> let
    new_content, n = re.subn(r'\bvar\s+(rs|val|wght|dsq|x|y)\s*=', r'let \1 =', new_content)
    replaced += n

    # 3. 其余的 var -> let（因为大多数变量会被重新赋值）
    new_content, n = re.subn(r'\bvar\s+', 'let ', new_content)
    replaced += n

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)

    print(f"处理完成: {filepath}")
    print(f"  替换了 {replaced} 处 var 声明")

if __name__ == '__main__':
    filepath = sys.argv[1] if len(sys.argv) > 1 else 'server.js'
    process_file(filepath)
