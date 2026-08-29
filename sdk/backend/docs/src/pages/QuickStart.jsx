/**
 * QuickStart.jsx - 「快速开始」页
 *
 * 页面底部那段 `quickstart.js` 全文是 `?raw` 引进来的**包里那个真文件**，
 * 不是抄的。所以「文档里的例子和仓库里的例子不一样」这件事在这页发生不了。
 *
 * 注意它跨了目录：`examples/` 在 `docs/` 外面，靠 `vite.config.js` 里
 * `server.fs.allow` 放到包根才读得到。
 */

import quickstartSource from '@shroom/backend/examples/quickstart.js?raw';
import pkg from '@shroom/backend/package.json';
import React from 'react';

import CodeBlock from '../components/CodeBlock.jsx';
import { C, Note, Prose, Section, Table } from '../components/Prose.jsx';

const INSTALL = `{
  "dependencies": {
    "@shroom/backend": "file:../shroom1/sdk/backend"
  }
}`;

const RUN = `# 没硬件也能跑完整条链（造假帧）
node node_modules/@shroom/backend/examples/quickstart.js --mock

# 有硬件：先看有哪些口
node node_modules/@shroom/backend/examples/quickstart.js --list-ports
node node_modules/@shroom/backend/examples/quickstart.js --port COM3 --sensor hand0205 --frames 50`;

const REPO_RUN = `npm run sdk:quickstart -- --mock       # 走完解码→线序→清零→入库→CSV
npm run sdk:serial-demo -- --mock      # 只看串口那一段
npm run sdk:demo                       # 连一个已跑起来的后端（只读）
npm run sdk:backend-smoke              # 包边界守卫，10 项`;

const ALGO_ONLY = `const { jqbed, press } = require('@shroom/backend/processing');
const { decodeProtocolValues, getSerialProtocolPreset } = require('@shroom/backend/protocol');

const preset = getSerialProtocolPreset('matrix-256');
const values = decodeProtocolValues(rawFrame, preset.protocol);
const matrix = jqbed(values);`;

const SESSION = `const { ShroomSensorSDK } = require('@shroom/backend/session');

const sdk = new ShroomSensorSDK({ dbDir: './db', exportDir: './out' });
const session = await sdk.open({ sensorType: 'hand0205', channels: { sit: 'COM3' } });

const capture = sdk.getStore().createCapture({ name: 'run-1', sensorType: 'hand0205' });
session.on('frame', (frame) => {
  sdk.getStore().insertFrame({
    captureId: capture.id, sensorType: 'hand0205', channel: 'sit', frame,
  });
});

await sdk.exportCsv({ captureId: capture.id });`;

const CLIENT = `const { BackendSdkClient } = require('@shroom/backend/client');

const client = new BackendSdkClient({
  httpBaseUrl: 'http://127.0.0.1:19245',
  wsUrl: 'ws://127.0.0.1:19999',
});

// 路由和命令格式从这儿拿，别硬编码 —— 见「契约与命令」那页
const contract = await client.getContract();
client.on('frame', (frame) => console.log(frame.channelId, frame.payload?.value?.length));
client.connectRealtime({ channels: ['car:sit'] });`;

export default function QuickStart() {
  return (
    <Prose
      title="快速开始"
      lede="从零起一个 Node 项目，到跑出第一个 CSV，大概三步。没有硬件也能走完全程。"
    >
      <Section title="1. 装">
        <p>
          包是 <C>private: true</C>，不发公共 registry。分发走 <C>file:</C> 依赖或
          <C>npm pack</C> 出来的 tarball：
        </p>
        <CodeBlock code={INSTALL} language="json" path="你的项目 package.json" />
        <p>
          原生依赖<strong>一个都不用先装</strong> —— {Object.keys(pkg.peerDependencies).length} 个 peer
          全是 optional，用到哪个装哪个（见<a href="#/intro">这个包是什么</a>那张表）。
        </p>
      </Section>

      <Section title="2. 跑一遍看看它到底干什么">
        <CodeBlock code={RUN} language="bash" />
        <p>
          <C>--mock</C> 会造 20 帧假数据，走完 <strong>解码 → 线序 → 清零 → 入库 → 导出 CSV</strong>
          整条链，最后吐一个 CSV 出来。这一趟不碰串口、不碰 SQLite（默认落内存库），
          所以在任何机器上都跑得起来。
        </p>
        <Note title="在本仓库里的话，脚本已经接好了">
          <CodeBlock code={REPO_RUN} language="bash" />
        </Note>
      </Section>

      <Section title="3. 挑一条属于你的路径">
        <Table
          head={['你的处境', '走哪条']}
          rows={[
            ['只想用算法，不碰硬件', '下面「零依赖路径」'],
            ['有硬件，想自己读', '下面「整机路径」'],
            ['主应用已经在跑，只想连上去', '下面「客户端路径」'],
          ]}
        />

        <h3>零依赖路径</h3>
        <p>装个包就能跑，不需要任何 peer：</p>
        <CodeBlock code={ALGO_ONLY} language="javascript" />
        <p>
          线序有哪些、各自吃什么吐什么，在<a href="#/line-orders">线序与矩阵</a>那页能直接拨着看。
        </p>

        <h3>整机路径</h3>
        <p>
          链路是 <C>SerialPort → DelimiterParser → ProtocolRegistry.parse → ZeroCalibrator
          → frame 事件 → CaptureStore → CsvExporter</C>。
        </p>
        <CodeBlock code={SESSION} language="javascript" />
        <p>要装 <C>serialport</C> 和 <C>@serialport/parser-delimiter</C>；落 SQLite 再加 <C>better-sqlite3</C>。</p>

        <h3>客户端路径</h3>
        <p>控制走 HTTP，实时走 WebSocket 订阅。要装 <C>ws</C>：</p>
        <CodeBlock code={CLIENT} language="javascript" />
      </Section>

      <Section title="quickstart.js 全文">
        <p>
          下面是包里 <C>examples/quickstart.js</C> 的<strong>真文件</strong>（<C>?raw</C> 引进来的）。
          它把上面三条路径里最长的那条完整走了一遍，可以直接抄。
        </p>
        <CodeBlock
          code={quickstartSource}
          language="javascript"
          path="sdk/backend/examples/quickstart.js"
          note="包里那个文件本身，不是抄的"
        />
      </Section>
    </Prose>
  );
}
