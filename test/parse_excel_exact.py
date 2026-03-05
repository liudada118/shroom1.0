import openpyxl

wb = openpyxl.load_workbook('/home/ubuntu/upload/pasted_file_P2ivXm_小型样品点位标注图.xlsx')
ws = wb.active

print("=== Excel 原始内容 (16行 x 16列) ===")
print("行号 | 列: 0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15")
print("-" * 80)

grid = []
for row_idx in range(1, 17):
    row_data = []
    for col_idx in range(1, 17):
        cell = ws.cell(row=row_idx, column=col_idx)
        val = cell.value
        if val is None:
            val = 0
        row_data.append(val)
    grid.append(row_data)
    print(f"R{row_idx:2d}  | " + " ".join(f"{v:3}" if isinstance(v, int) and v > 0 else "  ." for v in row_data))

print("\n=== 传感器编号 -> 16x16网格位置 (行,列) ===")
# 找出每个传感器编号(1-100)在网格中的位置
sensor_positions = {}
for r in range(len(grid)):
    for c in range(len(grid[r])):
        val = grid[r][c]
        if isinstance(val, (int, float)) and val >= 1 and val <= 100:
            sensor_id = int(val)
            sensor_positions[sensor_id] = (r, c)

for sid in sorted(sensor_positions.keys()):
    r, c = sensor_positions[sid]
    # 在256字节数据中的索引 = row * 16 + col
    byte_index = r * 16 + c
    print(f"  传感器{sid:3d} -> 网格({r:2d},{c:2d}) -> 256字节索引: {byte_index:3d}")

print(f"\n总共找到 {len(sensor_positions)} 个传感器点")

# 生成 JS 映射数组: 按传感器编号1-100顺序，给出每个传感器在256字节中的索引
print("\n=== JS 映射数组 (传感器1-100 -> 256字节索引) ===")
mapping = []
for sid in range(1, 101):
    if sid in sensor_positions:
        r, c = sensor_positions[sid]
        mapping.append(r * 16 + c)
    else:
        mapping.append(-1)
        print(f"  WARNING: 传感器{sid} 未找到!")

print("const sensorToByteIndex = [")
for i in range(0, 100, 10):
    chunk = mapping[i:i+10]
    print(f"  {', '.join(str(x) for x in chunk)},  // 传感器{i+1}-{i+10}")
print("];")

# 现在生成10x10矩阵的映射
# Excel中的布局就是最终显示的布局
# 需要把有传感器的区域提取为10x10矩阵
print("\n=== 分析传感器在网格中的分布 ===")
# 找出有传感器的行和列
rows_with_sensors = sorted(set(r for r, c in sensor_positions.values()))
cols_with_sensors = sorted(set(c for r, c in sensor_positions.values()))
print(f"有传感器的行: {rows_with_sensors}")
print(f"有传感器的列: {cols_with_sensors}")

# 按行分组显示
print("\n=== 按网格行显示传感器编号 ===")
for r in rows_with_sensors:
    sensors_in_row = [(c, sid) for sid, (row, c) in sensor_positions.items() if row == r]
    sensors_in_row.sort()
    print(f"  行{r:2d}: " + " ".join(f"{sid:3d}" for c, sid in sensors_in_row))
