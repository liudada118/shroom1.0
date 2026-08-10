/**
 * Collection.jsx - 「采集与导出」页
 *
 * 频率上下限那几个数字从 `@shroom/backend/collection` 的真常量读，
 * 默认参数那张表是真调 `normalizeCollectOptions({})` 得到的 ——
 * 改一个默认值，这页跟着变。
 */

import {
  DEFAULT_COLLECTION_FREQUENCY_HZ,
  DEFAULT_DISK_CHECK_INTERVAL_MS,
  MAX_COLLECTION_FREQUENCY_HZ,
  MIN_COLLECTION_FREQUENCY_HZ,
  normalizeCollectOptions,
} from '@shroom/backend/collection';
import React from 'react';

import CodeBlock from '../components/CodeBlock.jsx';
import DemoCard from '../components/DemoCard.jsx';
import { C, Note, Prose, Section, Table } from '../components/Prose.jsx';
import CollectionGate from '../demos/CollectionGate.jsx';
import gateSource from '../demos/CollectionGate.jsx?raw';

const WIRE = `const {
  createCollectionFrameStorageService,
  createCollectionStorageClock,
  createCollectionDiskSpaceGuard,
  createCollectionInsertQueueService,
} = require('@shroom/backend/collection');

const clock = createCollectionStorageClock({
  getOptions: () => collectOptions,          // { frequencyMode, frequencyHz }
  getFallbackFrequencyHz: () => 12,
});

const diskGuard = createCollectionDiskSpaceGuard({
  getDirectory: () => dbDir,
  minFreeBytes: 200 * 1024 * 1024,
  onInsufficientSpace: () => setCollectionState('flag', false),   // 急停
});

const queue = createCollectionInsertQueueService({ /* … */ });

const storage = createCollectionFrameStorageService({
  isCollecting: () => collectionState.flag,
  shouldStoreCollectionFrame: (channel) => clock.shouldStore(channel),
  hasEnoughCollectionDiskSpace: () => diskGuard.hasEnoughSpace(),
  getSensorType: () => currentSensorType,
  getDbRef: (channel) => dbOf(channel),
  enqueueCollectionFrame: queue.enqueue,
  // 类型分支用 @shroom/backend/sensors 的谓词，别自己写 if
  isZeroFrameStorageType, isSmallBedMatrixType, getFrameMatrixData,
  tempFullBedType: 'tempFullBed', smallBed12BType: 'smallBed12B',
  buildZeroAwareStorageData, buildSmallBed12BCollectionStorageData,
});

// 实时管线里每帧都调，存不存它自己判断
serialSession.on('frame', (frame) => storage.storeSit(frame));`;

const EXPORT = `const { createCsvExporter } = require('@shroom/backend/export');   // 要装 csv-writer

const exporter = createCsvExporter({ outDir: './out' });
await exporter.exportCapture({ captureId, sensorType: 'hand0205' });`;

export default function Collection() {
  const defaults = normalizeCollectOptions({});

  return (
    <Prose
      title="采集与导出"
      lede="一帧到底存不存，由三个条件说了算，缺一不可、顺序有意义。这页可以拨开关直接看真实现的返回值。"
    >
      <p>
        <C>@shroom/backend/collection</C> 是<strong>零外部依赖</strong>的：
        数据库句柄、传感器类型、当前帧、甚至「现在采不采集」这个判断本身，
        全部靠注入。所以它既不绑 SQLite，也能整个搬进浏览器跑
        —— 下面那块活演示就是证据。
      </p>

      <Section title="三道关，短路的">
        <p>
          实时下发路径<strong>每一帧</strong>都会调到 <C>store()</C>。
          所以这三个条件不是「锦上添花的优化」，是唯一挡住「串口一有数据就落库」的东西。
        </p>
        <Table
          head={['#', '条件', '注入的是什么', '不满足会怎样']}
          rows={[
            ['①', <C>isCollecting()</C>, '采集开关（主应用的 collectionState.flag）', '没点「开始采集」也在写盘'],
            ['②', <C>shouldStoreCollectionFrame()</C>, <span><C>createCollectionStorageClock()</C> 的限流</span>, '按串口速率写盘，磁盘和数据库都撑不住'],
            ['③', <C>hasEnoughCollectionDiskSpace()</C>, <span><C>createCollectionDiskSpaceGuard()</C></span>, '磁盘写满，采集中断且数据可能损坏'],
          ]}
        />
        <Note tone="warn" title="第 ① 条是后来补的，补之前有一条急停链路是空转的">
          「磁盘满 → <C>setCollectionState('flag', false)</C>」这条链路以前
          <strong>停不住任何东西</strong>，因为全仓没有一处读 <C>flag</C>。
          补上 <C>isCollecting()</C> 之后它才真的能停。
          原委写在 <C>collection/collectionFrameStorageService.js</C> 的 <C>canStore()</C> 注释里。
        </Note>
      </Section>

      <Section title="拨开关看真实现">
        <p>
          下面跑的是包里真的 <C>createCollectionFrameStorageService()</C> 和
          <C>createCollectionStorageClock()</C>，注入进去的是假 db 和一个记账函数。
          注意「未调用」那一栏 —— 那是 <C>&amp;&amp;</C> 短路的直接证据，
          不是页面偷懒没显示。
        </p>
        <p>
          几个值得试的组合：把①关掉发一帧（②③ 全「未调用」）；
          频率选 1 Hz 然后「连发 5 帧」（第一帧 true，后面全被②拦）；
          换类型看右边存储串换形状。
        </p>
        <DemoCard
          title="store() 的三道关"
          sub="真 createCollectionFrameStorageService + 假 db"
          path="src/demos/CollectionGate.jsx"
          source={gateSource}
          minHeight={430}
        >
          <CollectionGate />
        </DemoCard>
      </Section>

      <Section title="接到自己的项目里">
        <CodeBlock code={WIRE} language="javascript" />
        <p>
          <C>store()</C> 返回 <C>true</C> 只表示<strong>入队了</strong>，不表示写盘完成 ——
          真正落库走 <C>createCollectionInsertQueueService()</C>，它攒批再写，
          避免高频采集时一帧一个事务。
        </p>
      </Section>

      <Section title="参数与默认值">
        <Table
          head={['常量', '值', '含义']}
          rows={[
            [<C>DEFAULT_COLLECTION_FREQUENCY_HZ</C>, `${DEFAULT_COLLECTION_FREQUENCY_HZ}`, '没配频率时用这个'],
            [<C>MIN_COLLECTION_FREQUENCY_HZ</C>, `${MIN_COLLECTION_FREQUENCY_HZ}`, '低于会被夹到这里'],
            [<C>MAX_COLLECTION_FREQUENCY_HZ</C>, `${MAX_COLLECTION_FREQUENCY_HZ}`, '高于会被夹到这里'],
            [<C>DEFAULT_DISK_CHECK_INTERVAL_MS</C>, `${DEFAULT_DISK_CHECK_INTERVAL_MS}`, '磁盘检查的节流窗口'],
          ]}
        />
        <p>
          <C>normalizeCollectOptions()</C> 把用户配置补成完整形状。
          下面是真调 <C>normalizeCollectOptions({'{}'})</C> 的结果：
        </p>
        <CodeBlock
          code={JSON.stringify(defaults, null, 2)}
          language="json"
          path="normalizeCollectOptions({}) 的真实返回"
          note="渲染时算出来的，不是抄的"
        />
        <Note title="磁盘检查节流窗口内不放行，是沿用上次结果">
          原来窗口内直接 <C>return true</C>，于是空间真不够时每秒也只有第一帧被拦住，
          剩下 999 毫秒的帧照写。改成沿用上次判断之后，代价是空间腾出来最多要等
          {' '}{DEFAULT_DISK_CHECK_INTERVAL_MS} 毫秒才恢复入库 —— 比漏写划算。
        </Note>
      </Section>

      <Section title="导出 CSV">
        <p>
          导出在另一个入口 <C>@shroom/backend/export</C>，要装 <C>csv-writer</C>。
          它读的是已经落库的 capture，和上面这条实时路径没有耦合：
        </p>
        <CodeBlock code={EXPORT} language="javascript" />
        <p>
          <C>examples/quickstart.js --mock</C> 会把「解码 → 线序 → 清零 → 入库 → 导出 CSV」
          整条链跑完，见<a href="#/quickstart">快速开始</a>。
        </p>
      </Section>
    </Prose>
  );
}
