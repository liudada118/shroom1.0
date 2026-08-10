/**
 * CollectionGate.jsx - 拨三个开关，看 `store()` 真实返回什么
 *
 * 跑的是 `@shroom/backend/collection` 里的真 `createCollectionFrameStorageService()`
 * 和真 `createCollectionStorageClock()`，传感器类型判定用的是
 * `@shroom/backend/sensors` 的真谓词。这一层**全靠注入**，没有 SQLite、没有 fs，
 * 所以整个能原样搬进浏览器 —— 注入进去的是一个假 db 和一个记账用的入队函数。
 *
 * ## 「哪个条件把它拦下来了」是怎么知道的
 *
 * 不是在这里重新算一遍 `canStore()`。三个条件本来就是**外面注入进去的函数**，
 * 所以这里让每个注入函数在被调用时把自己的返回值记进 `trace`。
 * 于是 trace 里没出现的条件 = 包里根本没调到它。
 *
 * 这恰好是这个 demo 最想说明的事：三个条件是 `&&` 串起来的，**短路**。
 * 把「采集开关」关掉，你会看到频率和磁盘两栏是「未被调用」——
 * 那不是本页偷懒没显示，是包里真的没问。条件顺序有意义，见
 * `collection/collectionFrameStorageService.js` 里 `canStore()` 的注释。
 */

import {
  createCollectionFrameStorageService,
  createCollectionStorageClock,
} from '@shroom/backend/collection';
import {
  SMALL_BED_12B_TYPE,
  TEMP_FULL_BED_TYPE,
  getFrameMatrixData,
  isSmallBedMatrixType,
  isZeroFrameStorageType,
} from '@shroom/backend/sensors';
import React from 'react';

/** 演示用的几种传感器类型，各自会走到 `buildSitCollectionData()` 的不同分支。 */
const TYPES = [
  { type: 'car10', label: '普通矩阵（走 JSON.stringify([...sitData])）' },
  { type: 'hand0205', label: '零点帧类型（走 buildZeroAwareStorageData）' },
  { type: SMALL_BED_12B_TYPE, label: '小床 12B（走专用构造器）' },
  { type: TEMP_FULL_BED_TYPE, label: '温感全床（带温度字段的大对象）' },
];

const FREQUENCIES = [
  { value: 1, label: '1 Hz（最慢，连发必被限流）' },
  { value: 12, label: '12 Hz（默认）' },
  { value: 200, label: '200 Hz（最快）' },
];

/** 造一帧假的实时帧。数值有点形状，纯粹为了让存储串看着像真的。 */
function makeFrame(seq) {
  const sitData = Array.from({ length: 64 }, (_, i) => (
    Math.round(80 + 70 * Math.sin((i + seq) / 5))
  ));
  return {
    sitData,
    rawSitData: sitData,
    matrixWidth: 8,
    matrixHeight: 8,
    matrixOrientation: 'row',
    realArr: sitData,
    pressureThreshold: 30,
    temperatureRawData: sitData,
    temperatureData: sitData,
    temperatureAvg: 26.5,
    temperatureK: 1,
    zeroData: sitData.map(() => 0),
  };
}

export default function CollectionGate() {
  const [collecting, setCollecting] = React.useState(true);
  const [hasDisk, setHasDisk] = React.useState(true);
  const [frequencyHz, setFrequencyHz] = React.useState(12);
  const [sensorType, setSensorType] = React.useState(TYPES[0].type);
  const [attempts, setAttempts] = React.useState([]);

  // 这些都要跨渲染活着：clock 有内部状态（上次入库时刻），
  // 开关值要让注入进去的闭包读到最新的，不能被 useMemo 冻在初次渲染。
  const stateRef = React.useRef({ collecting, hasDisk, frequencyHz, sensorType });
  stateRef.current = { collecting, hasDisk, frequencyHz, sensorType };
  const traceRef = React.useRef(null);
  const seqRef = React.useRef(0);

  const service = React.useMemo(() => {
    /** 记一笔条件的真实返回值。没被记的就是没被调用。 */
    const note = (key, value) => {
      if (traceRef.current) traceRef.current[key] = value;
      return value;
    };

    // 真的限流时钟，不是 setTimeout 假装的。
    const clock = createCollectionStorageClock({
      getOptions: () => ({ frequencyMode: 'custom', frequencyHz: stateRef.current.frequencyHz }),
      getFallbackFrequencyHz: () => 12,
    });

    return createCollectionFrameStorageService({
      // ── 三个条件，按 canStore() 里的顺序 ──
      isCollecting: () => note('collecting', stateRef.current.collecting),
      shouldStoreCollectionFrame: (channel) => note('throttle', clock.shouldStore(channel)),
      hasEnoughCollectionDiskSpace: () => note('disk', stateRef.current.hasDisk),

      // ── 环境 ──
      getSensorType: () => stateRef.current.sensorType,
      getDbRef: (channel) => ({ fakeDb: channel }),
      enqueueCollectionFrame: (db, data, channel) => {
        if (traceRef.current) traceRef.current.stored = { channel, data };
      },

      // ── 类型分支：用包里的真谓词 ──
      isZeroFrameStorageType,
      isSmallBedMatrixType,
      getFrameMatrixData,
      tempFullBedType: TEMP_FULL_BED_TYPE,
      smallBed12BType: SMALL_BED_12B_TYPE,

      // 这两个在主应用里也是注入的（它们要读清零基准和小床布局），
      // 这里给最小实现，只为让分支能走通。
      buildZeroAwareStorageData: (frame, dataKey) => JSON.stringify({
        [dataKey]: frame[dataKey], zeroData: frame.zeroData, note: 'docs 最小实现',
      }),
      buildSmallBed12BCollectionStorageData: (frame) => JSON.stringify({
        sitData: frame.sitData, layout: '12B', note: 'docs 最小实现',
      }),
    });
  }, []);

  /** 发 n 帧，每帧记一行。 */
  const send = React.useCallback((count) => {
    const rows = [];
    for (let i = 0; i < count; i += 1) {
      seqRef.current += 1;
      traceRef.current = { seq: seqRef.current };
      const ok = service.storeSit(makeFrame(seqRef.current));
      rows.push({ ...traceRef.current, ok });
      traceRef.current = null;
    }
    setAttempts((prev) => [...rows.reverse(), ...prev].slice(0, 12));
  }, [service]);

  const latest = attempts.find((row) => row.stored);

  return (
    <div>
      <div className="docs-card-controls" style={{ border: 0, padding: '0 0 12px' }}>
        <label className="docs-field">
          <input type="checkbox" checked={collecting} onChange={(e) => setCollecting(e.target.checked)} />
          <span>① 采集开关</span>
        </label>
        <label className="docs-field">
          <span>② 频率</span>
          <select value={frequencyHz} onChange={(e) => setFrequencyHz(Number(e.target.value))}>
            {FREQUENCIES.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
        </label>
        <label className="docs-field">
          <input type="checkbox" checked={hasDisk} onChange={(e) => setHasDisk(e.target.checked)} />
          <span>③ 磁盘空间够</span>
        </label>
        <label className="docs-field">
          <span>类型</span>
          <select value={sensorType} onChange={(e) => setSensorType(e.target.value)}>
            {TYPES.map((item) => (
              <option key={item.type} value={item.type}>{item.type} —— {item.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="docs-card-controls" style={{ border: 0, padding: '0 0 12px' }}>
        <button type="button" onClick={() => send(1)}>发一帧</button>
        <button type="button" onClick={() => send(5)}>连发 5 帧（看限流）</button>
        <button type="button" onClick={() => setAttempts([])}>清空</button>
      </div>

      <div className="docs-matrix-pair">
        <div className="docs-matrix-panel" style={{ flex: '2 1 380px' }}>
          <p className="docs-matrix-cap">
            storeSit() 的真实返回。「未调用」= 前一个条件短路了，包里根本没问。
          </p>
          <div className="docs-scroll">
            <table className="docs-datatable">
              <thead>
                <tr>
                  <th>#</th><th>① 开关</th><th>② 限流</th><th>③ 磁盘</th><th>store()</th>
                </tr>
              </thead>
              <tbody>
                {attempts.map((row) => (
                  <tr key={row.seq}>
                    <td>{row.seq}</td>
                    <td><Cond value={row.collecting} /></td>
                    <td><Cond value={row.throttle} /></td>
                    <td><Cond value={row.disk} /></td>
                    <td>
                      <span className={row.ok ? 'docs-verdict docs-verdict-true' : 'docs-verdict docs-verdict-false'}>
                        {String(row.ok)}
                      </span>
                    </td>
                  </tr>
                ))}
                {attempts.length === 0 && (
                  <tr><td colSpan={5}>点上面的按钮发一帧</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="docs-matrix-panel">
          <p className="docs-matrix-cap">
            最近一次真入队的东西（<code>enqueueCollectionFrame</code> 收到的第二个参数）
          </p>
          {latest ? (
            <>
              <dl className="docs-kv">
                <dt>通道</dt><dd><code>{latest.stored.channel}</code></dd>
                <dt>长度</dt><dd>{latest.stored.data.length} 字符</dd>
              </dl>
              <div className="docs-mono-out" style={{ maxHeight: 180, overflow: 'auto' }}>
                {latest.stored.data.slice(0, 600)}
                {latest.stored.data.length > 600 && ' …'}
              </div>
              <p className="docs-matrix-cap" style={{ marginTop: 8 }}>
                换上面的「类型」，这段串的形状会跟着变 —— 走的是
                <code>buildSitCollectionData()</code> 的不同分支。
              </p>
            </>
          ) : (
            <p className="docs-status">还没有任何一帧通过三道关。</p>
          )}
        </div>
      </div>
    </div>
  );
}

/** 一个条件的显示：true / false / 未被调用。 */
function Cond({ value }) {
  if (value === undefined) {
    return <span style={{ color: 'var(--text-dim)' }}>未调用</span>;
  }
  return (
    <span className={value ? 'docs-verdict docs-verdict-true' : 'docs-verdict docs-verdict-false'}>
      {String(value)}
    </span>
  );
}
