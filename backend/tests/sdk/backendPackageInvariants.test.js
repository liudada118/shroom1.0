/**
 * 后端 SDK 包的仓库级不变量。
 *
 * 这些断言守的不是某个函数的行为，而是**拆包时留下的两处妥协**。它们放在
 * `backend/tests/` 而不是包内，因为要检查的东西一半在包外 —— 包自己是自洽的，
 * 是仓库里同时存在两份而已。
 *
 * 包内部的自洽性由 `sdk/backend/scripts/smoke-backend.js` 守（`npm run sdk:backend-smoke`）。
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const sharedSchemaPath = path.resolve(__dirname, '../../../shared/commandSchema.json');
const packageSchemaPath = require.resolve('@shroom/backend/contract/commandSchema.json');

const { commandSchema } = require('@shroom/backend/contract');
const { DEFAULT_SENSOR_PROFILES, getDefaultBaudRate } = require('@shroom/backend/session');
const { SENSOR_DEFINITIONS, getSensorBaudRate } = require('@shroom/backend/sensors');

/**
 * 妥协 1：`shared/commandSchema.json` 现在有两份。
 *
 * 包不能 `require('../../../shared/commandSchema.json')` —— 四级向上跑出包根，
 * 在仓库里解析得开，`npm pack` 装出来就崩（前端包 `@shroom/frontend` 踩过这个坑，
 * 见它 README 的「已知缺口」）。所以包内自带了一份。
 *
 * 归属问题留到统一 `shared/` 那轮解决：这个 JSON 现在有 5 个消费者，
 * 除了包里这两处，还有 `client/src/services/command/commandSchema.js` 和
 * `sdk/frontend/src/client/commands.js`，动它要同时改前端包和 client。
 *
 * 在那之前，这条断言保证两份不会偷偷长歪。
 */
function testCommandSchemaNoDrift() {
  const shared = JSON.parse(fs.readFileSync(sharedSchemaPath, 'utf8'));
  const packaged = JSON.parse(fs.readFileSync(packageSchemaPath, 'utf8'));

  assert.deepStrictEqual(
    packaged,
    shared,
    '@shroom/backend/contract/commandSchema.json 和 shared/commandSchema.json 不一致了。'
    + '改了一份就要同步另一份，或者干脆把归属统一掉。',
  );

  // 契约层实际用的是包内那份，顺带确认它没被别的东西覆盖。
  assert.deepStrictEqual(commandSchema, shared);
}

/**
 * 妥协 2：传感器元数据现在有两份。
 *
 * - `@shroom/backend/sensors` 的 `SENSOR_DEFINITIONS`：矩阵尺寸、通道、能力标签。
 * - `@shroom/backend/session` 的 `DEFAULT_SENSOR_PROFILES`：分帧、解码偏移、波特率。
 *
 * 这轮没合并，因为 `getDefaultBaudRate()` 有 registry 里没有的规则
 * （`robot` 前缀包含匹配、`footVideo` / `eye` / `daliegu` 这些不在注册表里的类型）。
 * 强行合并会悄悄改掉某些类型的波特率。
 *
 * 但两边都声明了波特率，这是最容易长歪的一处：一边改了另一边没改，
 * 表现是「串口能开但一帧都解不出来」，而且不会报错。所以对**两边都认识**的类型
 * 断言一致。
 */
function testBaudRateAgreement() {
  const sharedTypes = Object.keys(SENSOR_DEFINITIONS).filter(
    (type) => DEFAULT_SENSOR_PROFILES[type] != null,
  );

  assert.ok(sharedTypes.length > 0, '两份表一个共同类型都没有，说明其中一份的键变了');

  const mismatches = sharedTypes
    .map((type) => ({
      type,
      registry: getSensorBaudRate(type),
      profile: DEFAULT_SENSOR_PROFILES[type].baudRate ?? getDefaultBaudRate(type),
    }))
    .filter(({ registry, profile }) => registry !== profile);

  assert.deepStrictEqual(
    mismatches,
    [],
    '这些传感器类型在 sensors 注册表和 session 档案里的波特率对不上：\n'
    + mismatches.map((m) => `  ${m.type}: registry=${m.registry} profile=${m.profile}`).join('\n'),
  );
}

/**
 * 包边界：`backend/**` 里不该再出现指向 `sdk/` 的相对路径。
 *
 * 搬家之后 backend 引用包一律走包名 `@shroom/backend/...`。留一条相对路径进来，
 * `file:` 依赖这层就白做了 —— 那等于只是换了个目录。
 */
function testBackendDoesNotReachIntoSdkDirectory() {
  const backendRoot = path.resolve(__dirname, '../..');
  const offenders = [];

  /**
   * 递归扫 backend 下所有 `.js`，把「用相对路径伸进 sdk 目录」的 require 记进
   * `offenders`。跳过 `node_modules`。
   *
   * @param {string} dir 当前目录。
   */
  function walk(dir) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules') walk(full);
        return;
      }
      if (!entry.name.endsWith('.js')) return;
      const source = fs.readFileSync(full, 'utf8');
      for (const match of source.matchAll(/require\(\s*['"](\.[^'"]*)['"]\s*\)/g)) {
        const resolved = path.resolve(path.dirname(full), match[1]);
        if (resolved.includes(`${path.sep}sdk${path.sep}`)) {
          offenders.push(`${path.relative(backendRoot, full)} → ${match[1]}`);
        }
      }
    });
  }

  walk(backendRoot);

  assert.deepStrictEqual(
    offenders,
    [],
    `backend 里还有相对路径伸进 sdk/，应该改成包名：\n  ${offenders.join('\n  ')}`,
  );
}

testCommandSchemaNoDrift();
testBaudRateAgreement();
testBackendDoesNotReachIntoSdkDirectory();

console.log('backendPackageInvariants.test.js passed');
