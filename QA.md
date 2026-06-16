# QA

## Excel 打开中文 CSV 乱码

**现象**

在其它 Windows 电脑上用 Excel 直接双击打开中文 CSV，表头或中文内容可能显示乱码。

**原因**

Excel 直接双击打开 CSV 时，部分版本会按系统默认 ANSI/GBK 编码猜测文件，而不是按 UTF-8 读取。中文表头虽然是 UTF-8 写出的，但 Excel 没有识别编码时就会乱码。

**项目内解决方案**

`server.js` 导出的 CSV 文件统一在文件开头写入 UTF-8 BOM (`\ufeff`)：

- 流式大数据 CSV 导出：写表头前先写 BOM。
- 旧的 `writeRecords` CSV 导出：统一改走带 BOM 的写入包装函数。

这样 Excel/WPS 在 Windows 上直接双击打开时通常会自动识别为 UTF-8。

**排查步骤**

1. 确认测试文件是修改后的软件重新下载的新 CSV，不是旧文件。
2. 优先用 Excel 直接双击打开验证。
3. 如果个别老版本 Excel 仍乱码，使用 Excel 的“数据” -> “从文本/CSV”导入，并选择 `65001: Unicode (UTF-8)`。
4. 如果仍异常，记录 Excel 版本、Windows 系统语言区域、打开方式，并保留一个乱码 CSV 样例。
