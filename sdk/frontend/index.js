/**
 * index.js - `@shroom/frontend` 根出口
 *
 * 根出口 = **原有的传输/存储/展示系统层 ∪ `core/`**，刻意**不含 `react/`**。
 *
 * 理由：根出口一旦拉进 JSX 与 three，`SensorClient` / `FrameStore` 的裸 Node
 * 消费者（后端测试就有一个）连 import 都做不到，`scripts/smoke-core.mjs` 也会红。
 * React 那层走子路径 `@shroom/frontend/react` —— 需要它的人都在浏览器里。
 *
 * | 入口 | 内容 | 依赖 |
 * | :--- | :--- | :--- |
 * | `@shroom/frontend` | 下面这些 | 无 |
 * | `@shroom/frontend/core` | 契约、注册表、帧管线、配色、阈值 | 无 |
 * | `@shroom/frontend/react` | `RendererHost`、`useSceneFrame` | peer: react + three |
 * | `@shroom/frontend/styles/canvas.css` | 6 行 canvas 样式 | 无 |
 */

/* ── 传输 ───────────────────────────────────────────────────────── */
export {
  DEFAULT_HTTP_ROUTES,
  SensorClient,
  normalizeSubscriptionChannels,
  resolveChannelId,
} from './src/client/SensorClient.js';
export {
  createMessage,
  createCommand,
  sensorCommands,
} from './src/client/commands.js';
export { toLegacyCommand } from './src/client/legacyCommands.js';

/* ── 帧存储 ─────────────────────────────────────────────────────── */
export {
  FrameStore,
  createFrameKey,
} from './src/store/FrameStore.js';
export {
  SENSOR_FRAME_SCHEMA_VERSION,
  SENSOR_FRAME_TYPE,
  isSensorFrameEnvelope,
  normalizeIncomingMessage,
  normalizeFramePayload,
  normalizeLegacyPayload,
  normalizeSensorFrameEnvelope,
  normalizeTelemetryPayload,
} from './src/store/normalizeFrame.js';

/* ── 展示系统（设备定义层，与渲染器注册表是两回事，见 README） ──── */
export {
  DisplayRegistry,
  createDisplaySystem,
  createDisplaySystemFromManifest,
} from './src/display/DisplayRegistry.js';
export {
  DEFAULT_DISPLAY_SYSTEMS,
  createDefaultDisplayRegistry,
} from './src/display/defaultDisplaySystems.js';

/* ── 渲染器零依赖层（全量转出，等同 `@shroom/frontend/core`） ──── */
export * from './core/index.js';
