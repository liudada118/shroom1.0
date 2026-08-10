/**
 * Contract.jsx - 「契约与命令」页
 *
 * 这页几乎全是从包里读出来的：26 条路由、18 条命令、5 个错误码、
 * 4 个串口角色、WS 消息类型 —— 没有一处是手抄的。
 * 契约层存在的全部意义就是「只有一份」，文档要是再抄一份就把它毁了。
 */

import {
  API_VERSION,
  COMMAND_ERROR_CODES,
  HTTP_ROUTES,
  SDK_CONTRACT_VERSION,
  SERIAL_ROLE_ALIASES,
  TELEMETRY_METRICS,
  TELEMETRY_QUALITY,
  WS_MESSAGE_TYPES,
  buildSdkContractSnapshot,
  commandSchema,
  listSerialRoles,
  normalizeSerialRole,
} from '@shroom/backend/contract';
import React from 'react';

import CodeBlock from '../components/CodeBlock.jsx';
import DemoCard from '../components/DemoCard.jsx';
import { C, Note, Prose, Section, Table } from '../components/Prose.jsx';
import CommandBuilder from '../demos/CommandBuilder.jsx';
import builderSource from '../demos/CommandBuilder.jsx?raw';

const USE = `const {
  HTTP_ROUTES, createCommand, validateCommandEnvelope, CommandProtocolError,
} = require('@shroom/backend/contract');

// 路由别硬编码字符串
const res = await fetch(baseUrl + HTTP_ROUTES.commands, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(createCommand('serial.open', { role: 'sit', path: 'COM3' })),
});`;

const SERVER = `app.post(HTTP_ROUTES.commands, (req, res) => {
  try {
    const envelope = validateCommandEnvelope(req.body);   // 通过就返回信封本身
    return res.json(handle(envelope));
  } catch (error) {
    if (error instanceof CommandProtocolError) {
      // 错误对象自带 httpStatus / code / requestId，不用再翻译一遍
      return res.status(error.httpStatus).json(createCommandAck({
        requestId: error.requestId,
        commandType: error.commandType,
        ok: false,
        code: error.code,
        message: error.message,
      }));
    }
    throw error;
  }
});`;

/** 路由按 `/api/` 后面第一段分组，纯显示用。 */
function groupOf(path) {
  const rest = path.replace(/^\/api\//, '');
  return rest.split('/')[0];
}

export default function Contract() {
  const routes = Object.entries(HTTP_ROUTES);
  const commands = Object.entries(commandSchema.commands);
  const snapshot = buildSdkContractSnapshot();
  const roles = listSerialRoles();

  const grouped = routes.reduce((acc, [name, path]) => {
    const key = groupOf(path);
    (acc[key] = acc[key] || []).push([name, path]);
    return acc;
  }, {});

  return (
    <Prose
      title="契约与命令"
      lede={`前后端之间的每一个字符串都在这一层：${routes.length} 条 HTTP 路由、${commands.length} 条命令、${Object.keys(COMMAND_ERROR_CODES).length} 个错误码。别在业务代码里手写它们。`}
    >
      <p>
        <C>@shroom/backend/contract</C> 不干活，它只是<strong>唯一那份定义</strong>。
        服务端拿它注册路由、校验命令，客户端拿它拼请求 ——
        两边引同一个常量，改一处两边一起变，改错了会在构建期而不是现场发现。
      </p>
      <Table
        head={['', '值', '什么时候会变']}
        rows={[
          [<C>API_VERSION</C>, <C>{API_VERSION}</C>, '路由前缀整体换代（破坏性）'],
          [<C>SDK_CONTRACT_VERSION</C>, <C>{SDK_CONTRACT_VERSION}</C>, '契约内容有增删，客户端可据此判断兼容性'],
        ]}
      />
      <p>
        这一层<strong>零外部依赖</strong>，只 <C>require('./commandSchema.json')</C>，
        所以拿去给任何前端 / 第三方客户端用都没负担。
      </p>

      <Section title={`拼一条命令（${commands.length} 条可选）`}>
        <p>
          下面跑的是真 <C>createCommand()</C> → <C>validateCommandEnvelope()</C>。
          注意后者<strong>成功返回信封、失败抛 <C>CommandProtocolError</C></strong>，
          不是返回 <C>{'{ ok, reason }'}</C> —— 这是这一层最容易写错的地方。
        </p>
        <p>试着把 payload 里的必填字段删掉一个，看错误对象上带了什么。</p>
        <DemoCard
          title="命令信封生成器"
          sub={`真 commandSchema.json · ${commands.length} 条命令`}
          path="src/demos/CommandBuilder.jsx"
          source={builderSource}
          minHeight={440}
        >
          <CommandBuilder />
        </DemoCard>
        <CodeBlock code={USE} language="javascript" path="客户端这边" />
        <CodeBlock code={SERVER} language="javascript" path="服务端这边" />
      </Section>

      <Section title={`${commands.length} 条命令`}>
        <Table
          head={['type', '必填 payload 字段']}
          rows={commands.map(([type, spec]) => [
            <C>{type}</C>,
            (spec.required || []).length
              ? (spec.required || []).map((field) => <C key={field}>{field} </C>)
              : <span style={{ color: 'var(--text-dim)' }}>无</span>,
          ])}
        />
        <Note title="信封本身也有 schema">
          <C>commandSchema.envelope.required</C> = {commandSchema.envelope.required.map((f) => <C key={f}>{f} </C>)}
          ，且 <C>additionalProperties: {String(commandSchema.envelope.additionalProperties)}</C> ——
          多塞字段会被拒，不会被忽略。
        </Note>
      </Section>

      <Section title={`${routes.length} 条 HTTP 路由`}>
        <p>
          按 <C>/api/</C> 后面第一段分的组，值全部来自 <C>HTTP_ROUTES</C>。
        </p>
        {Object.entries(grouped).map(([group, items]) => (
          <React.Fragment key={group}>
            <h3>{group}（{items.length}）</h3>
            <Table
              head={['HTTP_ROUTES.*', 'path']}
              rows={items.map(([name, path]) => [<C>{name}</C>, <C>{path}</C>])}
            />
          </React.Fragment>
        ))}
      </Section>

      <Section title="实时通道">
        <Table
          head={['WS_MESSAGE_TYPES', '值']}
          rows={Object.entries(WS_MESSAGE_TYPES).map(([name, value]) => [<C>{name}</C>, <C>{value}</C>])}
        />
        <h3>遥测</h3>
        <Table
          head={['', '取值']}
          rows={[
            [<C>TELEMETRY_METRICS</C>, Object.values(TELEMETRY_METRICS).map((v) => <C key={v}>{v} </C>)],
            [<C>TELEMETRY_QUALITY</C>, Object.values(TELEMETRY_QUALITY).map((v) => <C key={v}>{v} </C>)],
          ]}
        />
        <p>
          <C>quality</C> 是给消费者用的：<C>{TELEMETRY_QUALITY.STALE}</C> 表示数据还在但已经过期，
          画面该变灰而不是继续假装实时。
        </p>
      </Section>

      <Section title={`串口角色（${roles.length} 个）`}>
        <Table
          head={['role', '别名', '说明']}
          rows={roles.map((role) => [
            <C>{role}</C>,
            Object.entries(SERIAL_ROLE_ALIASES)
              .filter(([, target]) => target === role)
              .map(([alias]) => <C key={alias}>{alias} </C>),
            role === 'sensor' ? '单口设备（手套、鞋垫等）' : `三口设备的 ${role} 通道`,
          ])}
        />
        <p>
          <C>normalizeSerialRole()</C> 把别名折叠到正名：
          <C>normalizeSerialRole('seat')</C> → <C>{normalizeSerialRole('seat')}</C>。
          它<strong>不改大小写</strong>（<C>normalizeSerialRole('SIT')</C> → <C>{normalizeSerialRole('SIT')}</C>），
          所以角色字符串从外部进来时该先 <C>toLowerCase()</C>。
        </p>
      </Section>

      <Section title="整份契约快照">
        <p>
          <C>buildSdkContractSnapshot()</C> 把上面所有东西打成一个对象 ——
          就是 <C>{HTTP_ROUTES.sdkContract}</C> 这个接口返回的东西。
          客户端启动时拉一次，之后所有路由和命令都从它读，不硬编码。
        </p>
        <CodeBlock
          code={JSON.stringify(snapshot, null, 2)}
          language="json"
          path="buildSdkContractSnapshot() 的真实返回"
          note="渲染时调出来的，不是抄的"
        />
      </Section>

      <Section title="已知重复">
        <Note tone="bad" title="commandSchema.json 在仓库里有两份">
          包里这份和 <C>shared/commandSchema.json</C> 内容必须一致，
          <C>backend/tests/sdk/backendPackageInvariants.test.js</C> 会 <C>deepStrictEqual</C> 比对，
          长歪了测试就红。为什么没合并（这个 JSON 有 5 个消费者），见
          <a href="#/pitfalls">坑与已知妥协</a>。
        </Note>
      </Section>
    </Prose>
  );
}
