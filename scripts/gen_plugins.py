"""
批量生成传感器插件文件
"""
import os

# 插件定义: (id, name, baudRate, multiPort, frameSizes, width, height, group, threeComponent, mapFunc, backMapFunc)
plugins = [
    # === 汽车类 (multiPort=true) ===
    ('yanfeng10', '轮椅', 1000000, True, [1024], 32, 32, 'car', 'Car10', 'yanfeng10sit', 'yanfeng10back'),
    ('carQX', '清闲椅子', 1000000, True, [1024], 32, 32, 'car', 'CarQX', None, None),
    ('sofa', '沙发', 1000000, True, [1024], 32, 32, 'car', 'CarSofa', 'arrToRealLine_sofa', None),
    ('eye', '眼罩', 921600, True, [146, 130], 16, 16, 'hand', 'Eye', 'eye_left', 'eye_right'),
    
    # === 床垫类 (multiPort=false) ===
    ('smallBed1', '小床128', 1000000, False, [1024], 32, 32, 'bed', 'SmallBed', 'smallBed1', None),
    ('xiyueReal1', '席悦2.0', 1000000, False, [1024], 32, 32, 'bed', 'SmallBed', 'xiyueReal1', None),
    ('jqbed', '小床监测', 1000000, False, [1024], 32, 32, 'bed', 'Bed', 'jqbed', None),
    ('bigBed', '床垫监测', 1000000, False, [1024], 32, 32, 'bed', 'Bed', 'jqbed', None),
    
    # === 手套类 ===
    ('hand0507', '手套模型', 921600, True, [146, 130, 142, 158], 16, 16, 'hand', 'Hand0507', 'handL', 'handR'),
    ('Num3D', '3D数字', 921600, True, [146, 130], 16, 16, 'hand', 'Hand0205', 'handL', None),
    ('gloves', '手套96', 1000000, False, [1024], 32, 32, 'hand', 'Gloves', 'gloves', None),
    ('gloves1', '左手手套', 1000000, False, [1024], 32, 32, 'hand', 'Gloves1', 'gloves1', None),
    ('gloves2', '右手手套', 1000000, False, [1024], 32, 32, 'hand', 'Gloves1', 'gloves2', None),
    ('newHand', '手套监测', 1000000, False, [1024], 32, 32, 'hand', 'CanvasnewHand', 'newHand_custom', None),
    ('hand', '手部视频', 1000000, False, [1024], 32, 32, 'hand', 'CanvasHand', 'hand_custom', None),
    ('handBlue', '手部检测(蓝)', 1000000, False, [1024], 32, 32, 'hand', 'CanvasHand', 'handBlue', None),
    
    # === 足部类 ===
    ('footVideo', '触觉足底', 921600, True, [146, 130], 16, 16, 'foot', 'FootVideo', 'footVideo_left', 'footVideo_right'),
    ('foot', '脚型检测', 1000000, True, [1024], 32, 32, 'foot', 'Car', 'carSitLine', None),
    
    # === 座椅类 ===
    ('sit10', '席悦座椅', 1000000, False, [1024], 10, 10, 'car', 'Sit10', 'sit10Line', None),
    ('sitCol', '座椅采集', 1000000, False, [1024], 32, 32, 'car', 'Car', 'handBlue', None),
    ('CarTq', '唐群座椅', 1000000, False, [1024], 32, 32, 'car', 'CarTq', 'jqbed', None),
    ('chairQX', '清闲', 1000000, False, [1024], 32, 32, 'car', 'Ware', 'jqbed', None),
    
    # === 矩阵类 ===
    ('smallM', '小矩陣1', 1000000, False, [1024], 32, 32, 'other', 'SmallM', 'smallM1', None),
    ('rect', '矩陣2', 1000000, False, [1024], 32, 32, 'other', 'SmallRect', 'rect', None),
    ('short', 'T-short', 1000000, False, [1024], 32, 32, 'other', 'SmallShort', 'short', None),
    ('matCol', '小床褥采集', 1000000, False, [1024], 32, 32, 'other', 'MatCol', 'matColLine', None),
    ('carCol', '车载传感器', 1000000, False, [1024], 32, 32, 'other', 'Carcol', 'carCol', None),
    
    # === 高速类 ===
    ('fast1024', '32*32高速', 1000000, False, [1024], 32, 32, 'other', 'Fast1024', 'fast1024_custom', None),
    ('fast1024sit', '1024高速座椅', 1000000, False, [1024], 32, 32, 'other', 'Fast1024sit', 'endiSit1024', None),
    ('fast256', '16*16高速', 1000000, False, [256], 16, 16, 'other', 'Fast256', None, None),
    ('sit100', 'car100', 1000000, False, [1024], 32, 32, 'other', 'Car100', 'sit100_custom', None),
    
    # === 4096 类 ===
    ('bed4096', '4096', 3000000, False, [4096], 64, 64, 'bed', 'Bed4096', 'bed4096_custom', None),
    ('bed4096num', '4096数字', 3000000, False, [4096], 64, 64, 'bed', 'Bed4096', 'bed4096_custom', None),
    ('bed1616', '256', 1000000, False, [256], 16, 16, 'other', 'Bed1616', None, None),
    ('footVideo256', '256鞋垫', 1000000, False, [256], 16, 16, 'foot', 'Bed1616', None, None),
    
    # === 机器人类 ===
    ('robot', '机器人出手', 921600, True, [146, 130], 16, 16, 'robot', 'Robot', 'robot_pass', None),
    ('robot0428', '机器人', 921600, True, [146, 130], 16, 16, 'robot', 'Robot', 'robot_pass', None),
    ('robot1', '宇树G1触觉上衣', 921600, True, [146, 130], 16, 16, 'robot', 'Robot', 'robot_pass', None),
    ('robotSY', '松延N2触觉上衣', 921600, True, [146, 130], 16, 16, 'robot', 'Robot', 'robot_pass', None),
    ('robotLCF', '零次方H1触觉上衣', 921600, True, [146, 130], 16, 16, 'robot', 'Robot', 'robot_pass', None),
    
    # === 其他 ===
    ('handVideo1', '手部视频1', 921600, True, [146, 130], 16, 16, 'hand', 'CanvasHand', 'handVideo1_left', None),
    ('smallSample', '小型样品', 921600, True, [146, 130], 10, 10, 'other', 'Box100', 'smallSample_custom', None),
    ('daliegu', '14*20高速', 921600, False, [72, 144], 14, 20, 'other', 'Daliegu', None, None),
    ('normal', '正常测试', 1000000, False, [1024], 32, 32, 'other', 'Canvas', None, None),
    ('localCar', '本地自适应', 1000000, False, [1024], 32, 32, 'other', 'Canvas', None, None),
    ('ware', '清闲', 1000000, False, [1024], 32, 32, 'other', 'Ware', 'jqbed', None),
    ('car100', 'car100', 1000000, False, [1024], 32, 32, 'car', 'Car100', None, None),
    ('sit', '坐垫', 1000000, False, [1024], 32, 32, 'other', 'Canvas', 'sit_custom', None),
    ('matColPos', '小床睡姿采集', 1000000, False, [1024], 32, 32, 'bed', 'MatCol', 'matColLine', None),
    ('hand0205Point', '手套触觉', 921600, True, [146, 130], 16, 16, 'hand', 'Hand0205Point', 'handL', 'handR'),
    ('hand0205Point147', '手套触觉147', 921600, True, [146, 130], 16, 16, 'hand', 'Hand0205Point147', 'handL', 'handR'),
]

# 特殊映射函数需要自定义实现
custom_map_funcs = {
    'arrToRealLine_sofa': """
  mapLineOrder(rawData) {
    const { arrToRealLine } = require('../../../server/mathUtils');
    return arrToRealLine([...rawData], [[7, 0], [8, 15]], [[0, 15]], 32);
  }

  mapBackLineOrder(rawData) {
    const { arrToRealLine } = require('../../../server/mathUtils');
    return arrToRealLine([...rawData], [[7, 0], [8, 15]], [[0, 15]], 32);
  }""",
    'newHand_custom': """
  mapLineOrder(rawData) {
    const { jqbed, newHand } = require('../../../openWeb');
    let data = jqbed([...rawData]);
    for (let i = 0; i < 32; i++) {
      for (let j = 0; j < 16; j++) {
        [data[i * 32 + j], data[i * 32 + 31 - j]] = [data[i * 32 + 31 - j], data[i * 32 + j]];
      }
    }
    return newHand(data);
  }""",
    'hand_custom': """
  mapLineOrder(rawData) {
    const { jqbed } = require('../../../openWeb');
    let data = jqbed([...rawData]);
    for (let i = 0; i < 32; i++) {
      for (let j = 0; j < 16; j++) {
        [data[i * 32 + j], data[i * 32 + 31 - j]] = [data[i * 32 + 31 - j], data[i * 32 + j]];
      }
    }
    return data;
  }""",
    'sit_custom': """
  mapLineOrder(rawData) {
    const { jqbed } = require('../../../openWeb');
    const { press6sit } = require('../../../server/mathUtils');
    let data = jqbed([...rawData]);
    for (let i = 0; i < 32; i++) {
      for (let j = 0; j < 16; j++) {
        [data[i * 32 + j], data[i * 32 + 31 - j]] = [data[i * 32 + 31 - j], data[i * 32 + j]];
      }
    }
    return press6sit(data, 32, 32, 'col');
  }""",
    'fast1024_custom': """
  mapLineOrder(rawData) {
    const { jqbed } = require('../../../openWeb');
    const { pressNew1220 } = require('../../../server/mathUtils');
    let data = jqbed([...rawData]);
    return pressNew1220({ arr: data, height: 32, width: 32, type: 'col', value: 1024 });
  }""",
    'sit100_custom': """
  mapLineOrder(rawData) {
    const { pressNew1220 } = require('../../../server/mathUtils');
    const { sit100Line } = require('../../../openWeb');
    let data = pressNew1220({ arr: [...rawData], width: 32, height: 32, type: 'col', value: 4096 / 6 });
    return sit100Line(data);
  }""",
    'bed4096_custom': """
  mapLineOrder(rawData) {
    const { zeroLineMatrix } = require('../../../openWeb');
    return zeroLineMatrix([...rawData], 64);
  }""",
    'robot_pass': """
  mapLineOrder(rawData) {
    return [...rawData];
  }""",
    'footVideo_left': """
  mapLineOrder(rawData) {
    const { footVideo, footL } = require('../../../openWeb');
    return footVideo([...rawData]);
  }

  mapLeftDetail(rawData) {
    const { footL } = require('../../../openWeb');
    return footL([...rawData]);
  }

  mapBackLineOrder(rawData) {
    const { footVideo1, footR } = require('../../../openWeb');
    return footVideo1([...rawData]);
  }

  mapRightDetail(rawData) {
    const { footR } = require('../../../openWeb');
    return footR([...rawData]);
  }""",
    'footVideo_right': None,  # handled by footVideo_left
    'eye_left': """
  mapLineOrder(rawData) {
    let wsPointData = [...rawData];
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 16; j++) {
        [wsPointData[(7 - i) * 16 + j], wsPointData[(i) * 16 + j]] = [wsPointData[(i) * 16 + j], wsPointData[(7 - i) * 16 + j]];
      }
    }
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 16; j++) {
        [wsPointData[(8 + 7 - i) * 16 + j], wsPointData[(8 + i) * 16 + j]] = [wsPointData[(8 + i) * 16 + j], wsPointData[(8 + 7 - i) * 16 + j]];
      }
    }
    const arr = [8, 7, 6, 5, 4, 3, 2, 1, 9, 10, 11, 12, 13, 14, 15, 0];
    const newArr = [];
    for (let j = 0; j < 16; j++) {
      for (let i = 0; i < arr.length; i++) {
        newArr.push(wsPointData[j * 16 + arr[i]]);
      }
    }
    return newArr;
  }""",
    'eye_right': """
  mapBackLineOrder(rawData) {
    let wsPointData = [...rawData];
    let lastArr = wsPointData.splice(128, 128);
    wsPointData = lastArr.concat(wsPointData);
    const arr = [7, 8, 9, 10, 11, 12, 13, 14, 6, 5, 4, 3, 2, 1, 0, 15].reverse();
    const newArr = [];
    for (let j = 0; j < 16; j++) {
      for (let i = 0; i < arr.length; i++) {
        newArr.push(wsPointData[j * 16 + arr[i]]);
      }
    }
    return newArr;
  }""",
    'handVideo1_left': """
  mapLineOrder(rawData) {
    const { handVideoRealPoint_0506_3, handVideo1_0416_0506 } = require('../../../openWeb');
    return handVideo1_0416_0506([...rawData]);
  }

  mapLeftDetail(rawData) {
    const { handVideoRealPoint_0506_3 } = require('../../../openWeb');
    return handVideoRealPoint_0506_3([...rawData]);
  }""",
    'smallSample_custom': """
  mapLineOrder(rawData) {
    const sensorToByteIndex = [
      223, 222, 221, 220, 219, 218, 217, 216, 215, 214,
      239, 238, 237, 236, 235, 234, 233, 232, 231, 230,
      255, 254, 253, 252, 251, 250, 249, 248, 247, 246,
      15, 14, 13, 12, 11, 10, 9, 8, 7, 6,
      31, 30, 29, 28, 27, 26, 25, 24, 23, 22,
      207, 206, 205, 204, 203, 202, 201, 200, 199, 198,
      191, 190, 189, 188, 187, 186, 185, 184, 183, 182,
      175, 174, 173, 172, 171, 170, 169, 168, 167, 166,
      159, 158, 157, 156, 155, 154, 153, 152, 151, 150,
      143, 142, 141, 140, 139, 138, 137, 136, 135, 134,
    ];
    const mappedArr = [];
    for (let i = 0; i < 100; i++) {
      mappedArr.push(rawData[sensorToByteIndex[i]] || 0);
    }
    return mappedArr;
  }""",
}

TEMPLATE = '''const {{ BaseSensorPlugin }} = require('../../BaseSensorPlugin');
{imports}

class {class_name} extends BaseSensorPlugin {{
  constructor() {{
    super({{
      id: '{id}',
      name: '{name}',
      baudRate: {baud_rate},
      multiPort: {multi_port},
      frameSizes: {frame_sizes},
      matrixWidth: {width},
      matrixHeight: {height},
      group: '{group}',
      threeComponent: '{three_component}',
    }});
  }}

{methods}
}}

module.exports = new {class_name}();
'''

def to_class_name(plugin_id):
    # Convert plugin id to PascalCase class name
    parts = plugin_id.replace('-', '_').split('_')
    return ''.join(p.capitalize() for p in parts) + 'Plugin'

def gen_plugin(p):
    pid, name, baud, multi, frames, w, h, group, three, map_func, back_func = p
    
    plugin_dir = f'/home/ubuntu/shroom1.0/plugins/sensors/{pid}'
    index_path = os.path.join(plugin_dir, 'index.js')
    
    # Skip if already manually created
    if os.path.exists(index_path) and os.path.getsize(index_path) > 0:
        print(f"  跳过 {pid} (已存在)")
        return
    
    os.makedirs(plugin_dir, exist_ok=True)
    
    class_name = to_class_name(pid)
    imports = []
    methods = []
    
    # Check if map_func is custom
    if map_func and map_func in custom_map_funcs:
        custom = custom_map_funcs[map_func]
        if custom:
            methods.append(custom)
        if back_func and back_func in custom_map_funcs:
            back_custom = custom_map_funcs[back_func]
            if back_custom:
                methods.append(back_custom)
    elif map_func:
        imports.append(f"const {{ {map_func} }} = require('../../../openWeb');")
        methods.append(f"""
  mapLineOrder(rawData) {{
    return {map_func}([...rawData]);
  }}""")
    
    if back_func and back_func not in custom_map_funcs:
        if back_func not in [m.split('{')[0] for m in imports]:
            # Check if already imported
            if back_func not in str(imports):
                imports.append(f"const {{ {back_func} }} = require('../../../openWeb');")
        methods.append(f"""
  mapBackLineOrder(rawData) {{
    return {back_func}([...rawData]);
  }}""")
    
    # Merge imports
    all_openWeb_funcs = set()
    final_imports = []
    for imp in imports:
        # Extract function names from require('../../../openWeb')
        if 'openWeb' in imp:
            import_match = imp.split('{')[1].split('}')[0]
            for fn in import_match.split(','):
                fn = fn.strip()
                if fn:
                    all_openWeb_funcs.add(fn)
        else:
            final_imports.append(imp)
    
    if all_openWeb_funcs:
        final_imports.insert(0, f"const {{ {', '.join(sorted(all_openWeb_funcs))} }} = require('../../../openWeb');")
    
    imports_str = '\n'.join(final_imports)
    methods_str = '\n'.join(methods) if methods else """
  mapLineOrder(rawData) {
    return [...rawData];
  }"""
    
    content = TEMPLATE.format(
        imports=imports_str,
        class_name=class_name,
        id=pid,
        name=name,
        baud_rate=baud,
        multi_port='true' if multi else 'false',
        frame_sizes=str(frames),
        width=w,
        height=h,
        group=group,
        three_component=three,
        methods=methods_str,
    )
    
    with open(index_path, 'w') as f:
        f.write(content)
    print(f"  生成 {pid}")

print("开始生成插件...")
for p in plugins:
    gen_plugin(p)
print("完成!")
