/**
 * NumMatrix.jsx - 数字矩阵渲染器
 *
 * 页面上的三张表（预设 / 参数范围 / 归一化结果）全部从 `core/numMatrix/params.js`
 * 直接读。改一行源码刷新页面就变 —— 这是本站相对 README 的核心增量。
 */

import {
  COLORMAPS,
  createDirectionCheckFrame,
  NUM_MATRIX_PRESETS,
  normalizeNumMatrixParams,
  numMatrix,
} from '@shroom/frontend/core';
import React from 'react';

import BasicNumMatrix from '../demos/BasicNumMatrix.jsx';
import DemoCard from '../components/DemoCard.jsx';
import demoSource from '../demos/BasicNumMatrix.jsx?raw';
import {
  createCoordinateMatrix,
  createDefaultMatrixSample,
  orientFrame,
  parseCoordinateMap,
  parseFrameValues,
} from '../lib/matrixConfigurator.js';
import { C, Note, Prose, Section, Table } from '../components/Prose.jsx';

const PRESET_IDS = Object.keys(NUM_MATRIX_PRESETS);

const QUICK_SHAPES = [
  { id: '8x8', label: '8 × 8', rows: 8, cols: 8 },
  { id: '8x12', label: '8 × 12', rows: 8, cols: 12 },
  { id: '16x16', label: '16 × 16', rows: 16, cols: 16 },
  { id: '32x32', label: '32 × 32', rows: 32, cols: 32 },
];

const DIRECTIONS = [
  { id: 'identity', label: '原始方向' },
  { id: 'rotate-cw', label: '顺时针 90°' },
  { id: 'rotate-180', label: '旋转 180°' },
  { id: 'rotate-ccw', label: '逆时针 90°' },
  { id: 'flip-x', label: '左右镜像' },
  { id: 'flip-y', label: '上下镜像' },
];

/** 小型坐标图只负责确认形状，不参与压力统计或数据变换。 */
function ShapePreview({ layout }) {
  return (
    <svg
      className="matrix-shape-preview"
      viewBox={layout.viewBox}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`${layout.rows} 行 ${layout.cols} 列坐标形状预览`}
    >
      {layout.points.map((point) => (
        <circle
          key={point.index}
          cx={point.displayX}
          cy={point.displayY}
          r={layout.radius}
          className={point.index === 0
            ? 'is-first'
            : point.index === layout.pointCount - 1 ? 'is-last' : undefined}
        />
      ))}
    </svg>
  );
}

/** 每条预设对应主应用里的哪个老场景 —— 这一列是手写的，源码里只有注释。 */
const PRESET_ORIGIN = {
  fast256: 'three/NumThreeColor copy.jsx（Fast256，16×16）',
  fast1024: 'three/NumThreeColor1024.jsx（Fast1024，尺寸由 manifest 决定）',
  fast1024sit: 'three/NumThreeColor1024sit.jsx（23×23，带分压，无相机操作）',
  smallBed12B: '原先靠 matrixName === "smallBed12B" 的字符串分支（12 位，除 10 显示）',
  num3dDefault: 'num/NumWs.jsx（canvas2d 后端，32×32；2D canvas + CSS 透视，不是 WebGL）',
  num3dCarCol: 'num/NumWs.jsx 里 matrixName === "carCol" 那一支（10×9）',

  // 以下 18 条走 webgl 后端。前缀区分的是主应用里的两个展示形式：
  // `webglNum*` = 「数字」（原 num/Num2D.jsx），`webglRaw*` = 「原始数据」（原
  // num/Num2Doriginal.jsx）。两份原实现的片元着色器只差 18 行，合成了一个后端 +
  // 四个开关（useMask / texScale / whiteOnZero / potTexture），所以这里的差别全在数据。
  webglNumDefault: 'num/Num2D.jsx 的默认支（32×32；robot1 也落在这里，热场是空的——原实现如此）',
  webglNumCarCol: 'num/Num2D.jsx 里 matrixName === "carCol" 那一支（10×9）',
  webglNumGlove: 'num/Num2D.jsx 的手套支（147 点散进 32×32 再补边到 36×36）',
  webglNumGloveFullPacket: 'num/Num2D.jsx 的整包手套支（同上，挂载时先铺一张空网格）',
  webglNumFoot: 'num/Num2D.jsx 的 footVideo 支（60 点插值铺满 16×32，左右脚两块画布）',

  webglRawDefault: 'num/Num2Doriginal.jsx 的默认支（32×32）',
  webglRawTransposed: 'num/Num2Doriginal.jsx 的 RAW_TRANSPOSE_MATRIX_TYPES（四个键里只有 jqbed 走得到；只在方阵时转置）',
  webglRawCarCol: 'num/Num2Doriginal.jsx 的 carCol 支（10×9）',
  webglRawDaliegu: 'num/Num2Doriginal.jsx 的 daliegu 支（14×20）',
  webglRawSmallSample: 'num/Num2Doriginal.jsx 的 smallSample 支（10×10）',
  webglRawTempFullBed: 'num/Num2Doriginal.jsx 的 tempFullBed 支（15×12）',
  webglRawBed4096num: 'num/Num2Doriginal.jsx 的 bed4096num 支（64×64，4096 个 fillText/帧；Home 现在走不到它）',
  webglRawGlove: 'num/Num2Doriginal.jsx 的手套支（第 75 位插三个 0 凑成 15×10）',
  webglRawGloveFullPacket: 'num/Num2Doriginal.jsx 的整包手套支（195 点 = 15×13）',
  webglRawFoot: 'num/Num2Doriginal.jsx 的 footVideo 支（6×10 原样上屏，不插值，格子边长写死 30）',
  webglRawRobotSY: 'num/Num2Doriginal.jsx 的 robotSY 分区布局（掩码 + POT 纹理 + u_texScale）',
  webglRawRobotLCF: 'num/Num2Doriginal.jsx 的 robotLCF 分区布局',
  webglRawRobot1: 'num/Num2Doriginal.jsx 的 robot1 分区布局',
};

export default function NumMatrix() {
  const initialSample = React.useMemo(() => createDefaultMatrixSample(), []);
  const [shape, setShape] = React.useState({
    name: '内置 8 × 8 示例',
    coordinateMap: initialSample.coordinateMap,
    layout: initialSample.layout,
  });
  const [frameValues, setFrameValues] = React.useState(() => initialSample.values);
  const [frameDraft, setFrameDraft] = React.useState(
    () => JSON.stringify(initialSample.values),
  );
  const [dataError, setDataError] = React.useState('');
  const [shapeError, setShapeError] = React.useState('');
  const [direction, setDirection] = React.useState('identity');
  const [colormapId, setColormapId] = React.useState('classic');

  const orientedFrame = React.useMemo(
    () => orientFrame(
      frameValues,
      shape.layout.rows,
      shape.layout.cols,
      direction,
    ),
    [direction, frameValues, shape.layout.cols, shape.layout.rows],
  );
  const frameMax = React.useMemo(
    () => orientedFrame.values.reduce((max, value) => Math.max(max, value), 1),
    [orientedFrame.values],
  );

  const params = React.useMemo(
    () => normalizeNumMatrixParams({
      ...NUM_MATRIX_PRESETS.fast1024,
      gridWidth: orientedFrame.cols,
      gridHeight: orientedFrame.rows,
      textureValueMax: frameMax,
    }),
    [frameMax, orientedFrame.cols, orientedFrame.rows],
  );
  const grid = numMatrix.deriveGrid(params);

  const applyShape = React.useCallback((coordinateMap, name) => {
    let layout;
    try {
      layout = parseCoordinateMap(JSON.stringify(coordinateMap)).layout;
    } catch {
      setShapeError('坐标文件应为 rows × cols × [x, y]，并且每行列数一致');
      return;
    }
    const values = createDirectionCheckFrame(layout.pointCount);
    setShape({ name, coordinateMap, layout });
    setFrameValues(values);
    setFrameDraft(JSON.stringify(values));
    setShapeError('');
    setDataError('');
    setDirection('identity');
  }, []);

  const handleShapeFile = React.useCallback(async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const result = parseCoordinateMap(await file.text());
      applyShape(result.coordinateMap, file.name);
    } catch (error) {
      setShapeError(error.message || '坐标文件读取失败');
    }
  }, [applyShape]);

  const applyFrameDraft = React.useCallback((text) => {
    setFrameDraft(text);
    try {
      setFrameValues(parseFrameValues(text, shape.layout.pointCount));
      setDataError('');
    } catch (error) {
      setDataError(error.message || '数据格式不正确');
    }
  }, [shape.layout.pointCount]);

  const handleDataFile = React.useCallback(async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      applyFrameDraft(await file.text());
    } catch (error) {
      setDataError(error.message || '数据文件读取失败');
    }
  }, [applyFrameDraft]);

  const resetDirectionFrame = React.useCallback(() => {
    const values = createDirectionCheckFrame(shape.layout.pointCount);
    setFrameValues(values);
    setFrameDraft(JSON.stringify(values));
    setDataError('');
  }, [shape.layout.pointCount]);

  const controls = (
    <div className="matrix-setup">
      <section className="matrix-setup-step">
        <div className="matrix-setup-heading">
          <span className="matrix-step-number">1</span>
          <div>
            <strong>设置形状</strong>
            <span>选择示例，或加载 rows × cols × [x, y] 坐标文件</span>
          </div>
        </div>
        <div className="matrix-shape-layout">
          <div>
            <div className="matrix-action-row">
              {QUICK_SHAPES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={shape.name === `内置 ${item.label} 示例` ? 'is-active' : undefined}
                  onClick={() => applyShape(
                    createCoordinateMatrix(item.rows, item.cols),
                    `内置 ${item.label} 示例`,
                  )}
                >
                  {item.label}
                </button>
              ))}
              <label className="matrix-file-button">
                加载坐标 JSON
                <input type="file" accept=".json,application/json" onChange={handleShapeFile} />
              </label>
            </div>
            <div className="matrix-config-status">
              <strong>{shape.name}</strong>
              <span>{shape.layout.rows} 行 × {shape.layout.cols} 列 · {shape.layout.pointCount} 个点</span>
            </div>
            {shapeError && <div className="matrix-input-error">{shapeError}</div>}
          </div>
          <div className="matrix-shape-box">
            <ShapePreview layout={shape.layout} />
            <span><i className="is-first" /> 第 1 点 <i className="is-last" /> 第 {shape.layout.pointCount} 点</span>
          </div>
        </div>
      </section>

      <section className="matrix-setup-step">
        <div className="matrix-setup-heading">
          <span className="matrix-step-number">2</span>
          <div>
            <strong>设置一帧数据</strong>
            <span>数组下标按行优先对应点位；输入有效后立即刷新画面</span>
          </div>
        </div>
        <div className="matrix-data-actions">
          <button type="button" onClick={resetDirectionFrame}>生成 1 到 {shape.layout.pointCount}</button>
          <label className="matrix-file-button">
            加载数据 JSON
            <input type="file" accept=".json,application/json" onChange={handleDataFile} />
          </label>
          <label className="docs-field">
            <span>数据方向</span>
            <select value={direction} onChange={(event) => setDirection(event.target.value)}>
              {DIRECTIONS.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </label>
          <label className="docs-field">
            <span>配色</span>
            <select value={colormapId} onChange={(event) => setColormapId(event.target.value)}>
              {COLORMAPS.map((entry) => (
                <option key={entry.id} value={entry.id}>{entry.label}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="matrix-data-editor">
          <span>原始数据数组</span>
          <textarea
            value={frameDraft}
            onChange={(event) => applyFrameDraft(event.target.value)}
            spellCheck="false"
            aria-invalid={Boolean(dataError)}
          />
        </label>
        {dataError
          ? <div className="matrix-input-error">{dataError}，画面继续显示最后一帧有效数据。</div>
          : (
            <div className="matrix-config-status is-valid">
              <strong>数据有效</strong>
              <span>{frameValues.length} 个数 · 渲染为 {grid.gridHeight} 行 × {grid.gridWidth} 列</span>
            </div>
          )}
      </section>
    </div>
  );

  return (
    <Prose
      title="数字矩阵（numMatrix）"
      lede="只做两件事：先用坐标文件确定形状，再把一帧数组送进矩阵。页面上的每次修改都会直接驱动 @shroom/frontend 的 numMatrix 渲染器。"
    >
      <Section title="设置并预览">
        <DemoCard
          title="形状、数据、方向"
          sub="默认帧为 1 到数组长度，方便直接核对首点、末点和旋转方向"
          path="docs/src/demos/BasicNumMatrix.jsx"
          source={demoSource}
          controls={controls}
          height={380}
        >
          <BasicNumMatrix
            key={`${grid.gridWidth}-${grid.gridHeight}`}
            params={params}
            values={orientedFrame.values}
            colormapId={colormapId}
            floor={0}
          />
        </DemoCard>
        <Note title="形状和数据怎样对应">
          坐标文件只负责推导 <C>rows × cols</C> 和点位顺序；数据按
          <C>row * cols + col</C> 一一对应。方向选项只重排送入渲染器的一帧数据，
          不会修改原始数组，所以串口原始帧、回放和下载仍可共用同一份数据。
        </Note>
      </Section>

      <Section title={`${PRESET_IDS.length} 条预设`}>
        <p>
          它们不是 {PRESET_IDS.length} 个渲染器，是同一个渲染器的
          {PRESET_IDS.length} 组参数。三份 <C>NumThreeColor</C> 的布局公式代数等价
          （逐点验算见 <C>core/numMatrix/pipeline.test.js</C>），所以能收敛成一个。
        </p>
        <p>
          <C>backend</C> 那一列是**画法**，不是参数的一部分：<C>sprite3d</C> 用
          three 的实例化精灵一次 draw call 画完整片矩阵；<C>canvas2d</C> 是 2D
          canvas 逐格 <C>fillText</C> 加一层 CSS <C>perspective</C> 造出来的伪三维
          （原 <C>num/NumWs.jsx</C>）。两者的命令式暴露面不同 —— 见
          <C>optionalMethods</C>（契约页）。
        </p>
        <Table
          head={['id', '后端', '网格', '来自哪个老场景', '预设里显式给了什么']}
          rows={PRESET_IDS.map((id) => {
            const normalized = normalizeNumMatrixParams(NUM_MATRIX_PRESETS[id]);
            const derived = numMatrix.deriveGrid(normalized);
            return [
              <C>{id}</C>,
              <C>{normalized.backend}</C>,
              `${derived.gridWidth}×${derived.gridHeight}`,
              PRESET_ORIGIN[id] || '—',
              <C>{JSON.stringify(NUM_MATRIX_PRESETS[id])}</C>,
            ];
          })}
        />
      </Section>

      <Section title={`${COLORMAPS.length} 条配色`}>
        <p>
          色带不是本站画的 —— 每条配色自带 <C>previewCss</C>
          （<C>core/colormaps.js</C>），直接当 <C>background</C> 用。
          数值通路（<C>sampleColormapRgb</C>）和 CSS 通路取的是同一条色带，
          包里有断言逐字比对，两处不会漂。
        </p>
        <Table
          head={['id', '名称', '色带']}
          rows={COLORMAPS.map((entry) => [
            <C>{entry.id}</C>,
            entry.label,
            <div className="docs-ramp" style={{ background: entry.previewCss }} />,
          ])}
        />
        <Note title="jet 为什么单列">
          另外 6 条是插值色标（<C>createStopColormap</C>），<C>jet</C> 是一条四段折线公式
          —— 全仓 18 处老配色用的那条阶梯。把它登记进 <C>COLORMAPS</C> 之后，
          画布配置器和 manifest 第一次能**显式**选到它；在此之前 jet 只能靠
          「不选配色」隐式命中。
        </Note>
      </Section>

      <Section title="参数范围">
        <p>
          下面这张表是 <C>numMatrix.PARAM_RANGES</C> 本身。归一化会把越界值夹回范围，
          非法值（<C>null</C> / 空串 / <C>NaN</C>）退回默认值而不是夹到 <C>min</C> ——
          这个区别很重要：缺省字段被夹到 min 会让「没填」变成「填了最小值」。
        </p>
        <Table
          head={['参数', 'min', 'max', '当前页面归一化后的值']}
          rows={Object.entries(numMatrix.PARAM_RANGES).map(([name, range]) => [
            <C>{name}</C>,
            range.min,
            range.max,
            <C>{JSON.stringify(params[name])}</C>,
          ])}
        />
      </Section>

      <Section title="它暴露哪些命令式方法">
        <p>
          <C>sitData</C> / <C>sitValue</C> / <C>changeWsData</C> / <C>changeWsDataRaw</C>。
          用 <C>values</C> 声明式喂数据时不需要碰它们（宿主内部调 <C>sitData</C>）；
          需要在阈值变更后强制重着色之类的场合才用 <C>rendererRef</C>，
          见 <a href="#/api">RendererHost 入参与方法</a>。
        </p>
      </Section>
    </Prose>
  );
}
