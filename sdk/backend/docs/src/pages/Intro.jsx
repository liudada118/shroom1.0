/**
 * Intro.jsx - 「这个包是什么」页
 *
 * 入口表的**行**来自 `package.json` 的 `exports`（真读），**列**里的说明来自下面的
 * `ENTRY_NOTES`。两者用 join 拼起来，对不上的会显式标出来：
 *
 * - 加了新入口没写说明 → 那一行显示「（未登记）」，一眼能看见。
 * - 写了说明但入口删了 → 表格里不出现，下面「说明表里多出来的」会列出来。
 *
 * 这样这张表就不会悄悄变成假的。做不到全自动是因为「这个入口是干什么的」
 * 本来就不在 package.json 里 —— 但至少可以让漏写这件事**看得见**。
 */

import pkg from '@shroom/backend/package.json';
import React from 'react';

import { C, Note, Prose, Section, Table } from '../components/Prose.jsx';

/**
 * 每个入口干什么、要装什么。
 *
 * `deps` 写 `null` 表示零依赖 —— 这条线不是审美，它决定谁能消费你的代码。
 */
const ENTRY_NOTES = {
  '.': { what: '门面。零依赖那几层直接展开，要 peer 的几层是 getter，碰到才加载', deps: '视你取什么' },
  './contract': { what: 'HTTP 路由表、命令信封、telemetry 帧形状、manifest 形状', deps: null },
  './processing': { what: '线序、矩阵修补、压力换算、插值、平滑、视频映射、通用数学', deps: null },
  './protocol': { what: 'protocol schema（归一化 / 校验 / 解码）+ 内置串口协议预设', deps: 'fs（node 内置）' },
  './sensors': { what: '传感器注册表 + 5 个协议插件', deps: null },
  './telemetry': { what: '通道总线、旧帧归一化', deps: 'events（node 内置）' },
  './collection': { what: '采集限流、磁盘保护、入库判定、批量队列', deps: null },
  './serial': { what: '串口生命周期、断线重连、命名 parser 通道', deps: 'serialport + @serialport/parser-delimiter' },
  './storage': { what: 'SQLite 采集库 + 内存库 + 主应用历史库结构', deps: 'better-sqlite3' },
  './export': { what: 'CSV 导出', deps: 'csv-writer' },
  './client': { what: '连一个已经跑起来的后端（HTTP 控制 + WS 订阅）', deps: 'ws' },
  './session': { what: '上面这些串成的一条链（ShroomSensorSDK）', deps: 'serialport' },
  './logger': { what: '统一日志（LOG_LEVEL / LOG_FILE）', deps: 'fs（node 内置）' },
};

/** `exports` 里不是「入口」的那两条，表格里不列。 */
const NOT_AN_ENTRY = new Set(['./package.json', './*']);

export default function Intro() {
  const entryKeys = Object.keys(pkg.exports).filter((key) => !NOT_AN_ENTRY.has(key));
  const documented = new Set(Object.keys(ENTRY_NOTES));
  const stale = [...documented].filter((key) => !entryKeys.includes(key));
  const peers = Object.keys(pkg.peerDependencies || {});
  const zeroDep = entryKeys.filter((key) => ENTRY_NOTES[key]?.deps === null);

  return (
    <Prose
      title="这个包是什么"
      lede={pkg.description}
    >
      <p>
        <C>{pkg.name}</C> 是主应用后端跑的<strong>同一份代码</strong>打成的可安装包 ——
        不是抽出来的副本，主仓 <C>backend/**</C> 里对应位置留的是一行转出壳。
        所以「包里修了主程序没修」这件事在结构上就发生不了。
      </p>
      <p>
        想拿这套东西起一个新的 Node 项目、把串口数据读进来存下来导出去，
        从<a href="#/quickstart">快速开始</a>那页的一条命令开始最省事。
      </p>

      <Section title={`${entryKeys.length} 个入口，按「要不要原生依赖」分层`}>
        <p>
          这条线是整个包最重要的一条设计决定：<strong>{zeroDep.length} 个入口一个依赖都不用装</strong>。
          只想用线序、压力换算、协议校验的话，<C>npm i</C> 完就能跑 —— 不用碰
          serialport 和 better-sqlite3 这两个最容易在别人机器上编译失败的原生模块。
        </p>

        <Table
          head={['入口', '内容', '要装什么']}
          rows={entryKeys.map((key) => {
            const note = ENTRY_NOTES[key];
            const specifier = key === '.' ? pkg.name : `${pkg.name}${key.slice(1)}`;
            return [
              <C>{specifier}</C>,
              note ? note.what : <em>（未登记：有人加了入口没写说明）</em>,
              note ? (note.deps || <strong>无</strong>) : '？',
            ];
          })}
        />

        {stale.length > 0 && (
          <Note tone="bad" title="说明表里多出来的入口">
            {stale.join('、')} —— 这几条在 <C>package.json</C> 的 <C>exports</C> 里已经没有了。
          </Note>
        )}

        <p>
          子路径也开着（<C>exports</C> 里那条 <C>&quot;./*&quot;</C>），但要写全 <C>.js</C>：
        </p>
        <ul>
          <li><C>require(&apos;@shroom/backend/processing/lineOrders.js&apos;)</C></li>
          <li><C>require(&apos;@shroom/backend/protocol/presets/matrix-256.json&apos;)</C></li>
        </ul>
        <p>
          扩展名不能省 —— Node 的 <C>exports</C> 映射不做扩展名补全，这一点和普通的
          <C>require(&apos;./foo&apos;)</C> 不一样。
        </p>
      </Section>

      <Section title="原生依赖全是可选的">
        <p>
          {peers.length} 个 peer 依赖全部标了 <C>optional: true</C>，按需装：
        </p>
        <Table
          head={['你要用', '得装', 'package.json 里声明的版本']}
          rows={[
            ['开串口、切帧', <C>serialport</C>, pkg.peerDependencies.serialport],
            ['开串口、切帧', <C>@serialport/parser-delimiter</C>, pkg.peerDependencies['@serialport/parser-delimiter']],
            ['采集落 SQLite', <C>better-sqlite3</C>, pkg.peerDependencies['better-sqlite3']],
            ['导出 CSV', <C>csv-writer</C>, pkg.peerDependencies['csv-writer']],
            ['连一个已跑起来的后端', <C>ws</C>, pkg.peerDependencies.ws],
          ]}
        />

        <Note tone="warn" title="根出口有个陷阱">
          根出口的后五层是 getter，碰到才加载。所以
          <C>{'{ ...require(\'@shroom/backend\') }'}</C> 会<strong>触发全部 getter</strong>，
          等于把四个 peer 全加载一遍 —— 没装就直接崩。要转出请写
          <C>module.exports = require(&apos;@shroom/backend&apos;)</C>。
        </Note>
      </Section>

      <Section title="和 @shroom/frontend 的分工">
        <p>
          仓库里有两个包，边界是<strong>数据在哪停下</strong>：
        </p>
        <Table
          head={['', '@shroom/backend（这个）', '@shroom/frontend']}
          rows={[
            ['模块格式', 'CommonJS', 'ESM'],
            ['跑在哪', 'Node', '浏览器'],
            ['管什么', '从串口字节到一维数值数组，再到落库 / 导出', '从一维数值数组到画面'],
            ['交接物', <span>一维数组 + <C>matrixWidth</C> / <C>matrixHeight</C></span>, '同左，作为入参'],
          ]}
        />
        <p>
          <a href="#/line-orders">线序与矩阵</a>那页画的热力图是文档站<strong>自己用 CSS grid 画的</strong>，
          不是引了前端包 —— 后端站依赖前端包的话，两个包的边界在文档层就糊了。
        </p>
      </Section>

      <Section title="什么时候用哪个入口">
        <Table
          head={['我想…', '进哪个门']}
          rows={[
            ['只跑算法，不碰硬件', <span><C>/processing</C> + <C>/protocol</C>，零依赖</span>],
            ['自己接硬件读数据', <span><C>/session</C> 的 <C>ShroomSensorSDK</C>，装好的整机</span>],
            ['接一个已经在跑的主应用', <span><C>/client</C> 的 <C>BackendSdkClient</C></span>],
            ['自己控串口，不要那条链', <span><C>/serial</C> + <C>/protocol</C></span>],
            ['查后端有哪些 HTTP 路由 / 命令', <span><C>/contract</C>，见<a href="#/contract">契约与命令</a></span>],
          ]}
        />
      </Section>
    </Prose>
  );
}
