/**
 * HandPoints.jsx - 手部点云（handPoints）
 *
 * 这一页只有一块 `mode="scaled"` 的预览。与 `PointGrid.jsx` 不同 —— 那边额外给了
 * 一块 `mode="actual"` 用来真交互，这里不给：手部点云的框选在原实现里**是哑的**
 * （`selectHelper` 从来没被赋值过），搬进包时才补活，而补活之后**没有任何调用方
 * 会传 `changeSelectFlag`**，所以 `controlsFlag` 恒为真、框选在真机上仍然不会触发。
 * 给一块"可交互"的预览会让读者以为拖一下就能框选，那是假承诺。
 *
 * 表格全部从 `core` 读（预设、参数范围、点表、骨骼名），改一个常量这一页跟着变。
 */

import {
  HAND_POINTS_PRESETS,
  handPoints,
  normalizeHandPointsParams,
} from '@shroom/frontend/core';
import React from 'react';

import DemoCard from '../components/DemoCard.jsx';
import HandPointsDemo from '../demos/HandPointsDemo.jsx';
import demoSource from '../demos/HandPointsDemo.jsx?raw';
import { C, Note, Prose, Section, Table } from '../components/Prose.jsx';

const PRESET_IDS = Object.keys(HAND_POINTS_PRESETS);

export default function HandPoints() {
  const [presetId, setPresetId] = React.useState('hand0205');

  const params = React.useMemo(
    () => normalizeHandPointsParams(HAND_POINTS_PRESETS[presetId]),
    [presetId],
  );
  const gridSize = handPoints.deriveGridSize(params.sit);

  const controls = (
    <>
      <label className="docs-field">
        <span>预设</span>
        <select value={presetId} onChange={(event) => setPresetId(event.target.value)}>
          {PRESET_IDS.map((id) => <option key={id} value={id}>{id}</option>)}
        </select>
      </label>
      <span className="docs-field">
        <span>输入矩阵</span>
        <span>{params.sit.num2}×{params.sit.num1} = {params.sit.num1 * params.sit.num2} 个数</span>
      </span>
      <span className="docs-field">
        <span>渲染网格</span>
        <span>{gridSize.amountX}×{gridSize.amountY} = {gridSize.total} 个顶点</span>
      </span>
    </>
  );

  return (
    <Prose
      title="手部点云（handPoints）"
      lede="手套 / 手部压力矩阵的三维点云，外加一个 GLTF 手模，手指关节跟着 IMU 四元数转。
            2026-08-07 从主应用两份共 2030 行的组件合并搬进包 —— 它们的净差异只有九个参数
            和两张点表。"
    >
      <Note tone="warn" title="喂进去的是 32×32 的原始矩阵，不是顶点数">
        <C>hand0205</C> 要 32×32 = <strong>1024</strong> 个数。
        <C>deriveGridSize()</C> 算出来的 <strong>5184</strong>（147 预设是
        <strong> 19600</strong>）是**顶点数** —— 插值、补边、高斯模糊由渲染器内部跑。
        按顶点数喂不会报错，只是画面全错位。与 <a href="#/point-grid">点阵热力</a> 同一个坑。
      </Note>

      <Note tone="bad" title="手模是运行期相对 URL，装进别人的项目就是 404">
        <C>params.modelUrl</C> 默认 <C>&apos;./model/hand1.glb&apos;</C>，指的是主应用
        <C> client/public/model/</C> 下那个文件。**没有随包发** —— 那是一个二进制手模，
        进包等于让每个消费者都下载它。所以要么自己 serve 一份并把路径传进来，要么传空串
        只要点云（本页的预览就是传空串）。传空串时三个关节命令
        （<C>changeHandAngle</C> / <C>calibration</C> / <C>handZero</C>）变成空操作，不报错。
      </Note>

      <Section title="活预览">
        <DemoCard
          title="换预设看点表与网格差异"
          sub="没有手模、只有点云 —— 手模不随包发，见上面那条"
          path="docs/src/demos/HandPointsDemo.jsx"
          source={demoSource}
          controls={controls}
          height={420}
        >
          <HandPointsDemo key={presetId} presetId={presetId} />
        </DemoCard>
        <Note tone="info" title="为什么这一页没有「可交互」的那一块">
          <a href="#/point-grid">点阵热力</a> 那页额外给了一块不缩放的预览用来真框选。
          手部点云不给：原实现的框选是**哑的**（<C>selectHelper</C> 声明了但全文没有一处
          赋值，<C>changeBox()</C> 一调就是 <C>TypeError</C>），搬进包时才补活。而补活之后
          仍然没有任何调用方传 <C>changeSelectFlag</C>，<C>controlsFlag</C> 恒为真 ——
          真机上框选照样不触发。摆一块"可交互"的预览是假承诺。
        </Note>
      </Section>

      <Section title={`${PRESET_IDS.length} 条预设：差异全在参数里`}>
        <p>
          <C>hand0205Point.jsx</C>（993 行）与 <C>hand0205Point147.jsx</C>（1037 行）
          归一化空白与注释后净差 <strong>151 行</strong>，差的就是下面这几列 ——
          所以它们是同一个渲染器的两条预设，不是两个渲染器。
          <C>hand0205Alt</C> 是第三条：参数与 <C>hand0205</C> 完全相同、只换点表，
          对应原实现里那行被注释掉的 <C>glovesPoints = glovesPoints1</C>。
          <strong>没有任何 <C>matrixName</C> 会解析到它</strong>，是留给二开手动选的。
        </p>
        <Table
          head={['id', 'sit 通道', '渲染网格', '点表', '掩码来源', 'pointSize']}
          rows={PRESET_IDS.map((id) => {
            const normalized = normalizeHandPointsParams(HAND_POINTS_PRESETS[id]);
            const derived = handPoints.deriveGridSize(normalized.sit);
            return [
              <C>{id}</C>,
              <C>{JSON.stringify(normalized.sit)}</C>,
              `${derived.amountX}×${derived.amountY} = ${derived.total}`,
              <C>{normalized.pointTable}</C>,
              <C>{normalized.maskSource}</C>,
              normalized.pointSize.toFixed(4),
            ];
          })}
        />
        <Note tone="bad" title="maskSource 是真行为差异，不是笔误">
          <C>hand0205</C> 判「这个点是不是手」用的是**掩码**模糊后的值，147 用的是
          **压力**模糊后的值。也就是说 147 那条通路上，掩码算了一整套（插值 + 补边 +
          高斯）却从没参与判定，只有压力低于 <C>maskThreshold</C> 的点被藏起来。
          两种都保留成了开关，**没有统一** —— 统一就是一次看得见的画面变化。已记积压。
        </Note>
      </Section>

      <Section title="点表：手的形状是查表来的，不是算出来的">
        <p>
          三张点表逐字搬自原实现的常量区。每一行是一段
          <C>[起始列, 结束列]</C> 区间，<C>buildGlovesMask</C> /
          <C>buildHandPointMask147</C> 把它们盖成一张 32×32 的 0/1 掩码，
          掩码外的顶点被推到 <C>hiddenY</C>（−100000 / −1000）藏起来。
        </p>
        <Table
          head={['点表', '行数', '归一化后用它的预设']}
          rows={Object.entries(handPoints.POINT_TABLES).map(([name, table]) => [
            <C>{name}</C>,
            table.length,
            PRESET_IDS
              .filter((id) => normalizeHandPointsParams(HAND_POINTS_PRESETS[id]).pointTable === name)
              .join(' / ') || '（无）',
          ])}
        />
        <Note tone="bad" title="rotate90CCW 只对方阵是对的">
          <C>buildGlovesMask</C> 里那个转置在 <C>size</C> 非方阵时会越界写。
          现在三条预设都是 32×32，所以踩不到。已记积压，没修 —— 修它要改签名。
        </Note>
      </Section>

      <Section title="关节旋转：本包唯一的 ARTICULATED 能力">
        <p>
          <C>changeHandAngle([x, y, z, w])</C> 收 IMU 的四元数。第一帧被记成零位基准，
          之后每帧算的是 <strong>相对</strong> 基准的旋转（
          <C>base⁻¹ × current</C>）。<C>resetHand()</C> 清掉基准让下一帧重新取零位。
          这套代数在 <C>core/handPoints/quaternion.js</C> —— 原实现用的是
          <C>THREE.Quaternion</C>，但只用到四个方法，手写十几行换来了「可以在裸 Node 里逐点测」。
        </p>
        <Table
          head={['手指', '骨节', '几节']}
          rows={handPoints.DEFAULT_FINGER_BONES.map((bones, index) => [
            index === 0 ? '拇指' : `第 ${index + 1} 指`,
            <C>{bones.join(' → ')}</C>,
            bones.length,
          ])}
        />
        <Note tone="warn" title="拇指只有两节，其余四指三节">
          原实现如此 —— 拇指那组是 <C>Finger_01</C> / <C>Finger_02</C>，没有
          <C> Finger_00</C>。取不到的骨骼在旋转时被静默跳过，所以拇指的第一节不动。
          这是 <C>hand1.glb</C> 的骨骼命名决定的，换手模就要改
          <C>params.fingerBones</C>。
        </Note>
      </Section>

      <Section title="参数范围">
        <Table
          head={['参数', 'min', 'max', `当前 ${presetId}`]}
          rows={Object.entries(handPoints.PARAM_RANGES).map(([name, range]) => [
            <C>{name}</C>,
            range.min,
            range.max,
            <C>{JSON.stringify(params.sit?.[name] ?? params[name])}</C>,
          ])}
        />
        <p>
          <C>num1</C> / <C>num2</C> / <C>interp</C> / <C>order</C> 在
          <C>params.sit</C> 里，其余是全局的。上界不是物理限制 ——
          顶点数是 <C>(num1 × interp + order × 2) × (num2 × interp + order × 2)</C>，
          147 预设已经是 19600。
        </p>
      </Section>

      <Section title="搬进包时做的五处结构性改动">
        <Table
          head={['改了什么', '原来是什么样', '为什么必须改']}
          rows={[
            [
              '状态实例化',
              <>8 个跨帧变量在**模块作用域**（<C>timer</C> / <C>angleFlag</C> /
                <C>baseQuaternion</C> / <C>ndata1</C> …）</>,
              <>同页挂两块手套会互相覆盖零位。四元数基准尤其要命 ——
                这是把它做成可注册渲染器的前提，不是可选优化。</>,
            ],
            [
              '卸载清理',
              <>cleanup 只有 <C>cancelAnimationFrame</C> 外加一句
                <C>selectHelper?.dispose()</C>（而那个变量从来没被赋值）</>,
              <>泄漏 WebGL 上下文、几何体、材质、贴图和整个 GLTF 手模。浏览器对同时
                存活的上下文有硬上限，本站「一览」页会当场暴露。</>,
            ],
            [
              '点精灵贴图',
              <><C>TextureLoader().load(&apos;./circle.png&apos;)</C> —— 运行期相对 URL</>,
              <>装进别人的项目就是 404 → 点云全白，three 只在控制台留一条。改成打包资源
                <C>react/three/circle.png</C>（与 <C>pointGrid</C> 共用），
                并开 <C>params.pointSprite</C> 允许换图。</>,
            ],
            [
              <>删掉 <C>const hand = TextureLoader().load(&apos;./hand.jpg&apos;)</C></>,
              <>赋给一个再没人读的局部 <C>const</C></>,
              <>每次挂载白发一个 521KB 的网络请求。同样的死行在另外 10 个 three 场景
                组件里也有，本轮只删搬进来的这两份。</>,
            ],
            [
              <>删掉 <C>TWEEN.update()</C></>,
              <>import 了 <C>@tweenjs/tween.js</C> 并每帧调 <C>update()</C>，
                但全文没有创建过任何 tween</>,
              <>从别的组件抄过来时带上的。留着等于让本包平白多一个 peer 依赖。</>,
            ],
          ]}
        />
        <Note tone="warn" title="还有一处「修了半个功能」">
          <C>new SelectionHelper(...)</C> 补上了、<C>sitMatrix</C> 改成现算、
          <C>changeSelectFlag</C> 补进对外方法，于是 <C>BOX_SELECT</C> 这条能力是真的。
          但**主应用画面零变化**：没有任何调用方传过 <C>changeSelectFlag</C>，
          <C>sitIndexArr</C> 仍恒为空，选中判定走的还是 <C>else</C> 分支
          （<C>jetWhite3</C>），与现在逐点相同。改的只是「调了会崩」变成「调了能用」。
        </Note>
      </Section>
    </Prose>
  );
}
