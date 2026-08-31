/**
 * 把一段身份（sensorType 或通道名）洗成可以安全拼进 channelId 的形式。
 *
 * **这个白名单里没有 `:`，这是本函数存在的主要理由。** 洗出来的两段会被拼成
 * `${a}:${b}` 交给零点仓库，而仓库只认严格两段式（`parseChannelId` 见
 * `zeroStateStore.js`）—— 任何一段里混进冒号，那条 channelId 就会被判为不合法，零点
 * 静默失效。同时也去掉空白，因为仓库连首尾空白都拒。
 *
 * 不合法字符替换成 `-` 而不是删除：删除会让 `"a b"` 和 `"ab"` 撞成同一个 id，两路
 * 传感器共享零点。
 *
 * 兜底两层（`value || fallback`，洗完再判空一次）是为了处理「洗完变成空串」——
 * 例如全是中文的通道名会被整段替换成 `-`… 实际上 `-` 是合法字符所以不会为空，但
 * 输入是纯空白时会，兜底保证返回值恒为非空。
 *
 * @param {*} value 待处理的身份片段。
 * @param {string} [fallback] 兜底值。
 * @returns {string} 可安全拼接的非空片段。
 */
function normalizeIdentityPart(value, fallback = 'unknown') {
  const normalized = String(value || fallback)
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '-');
  return normalized || fallback;
}

/**
 * 从 channelId 里切出 sensorId 段。
 *
 * ⚠️ 用**第一个**冒号切（`indexOf`），与零点仓库那边严格两段式的解析**不同**：这里是
 * 兼容层的宽容处理，只在 manifest 没直接给出 `sensorId` 时兜底用。代价是万一 channelId
 * 里有两个冒号，切出来的结果会带冒号，进而被仓库判为不合法 —— 这属于「manifest 本身
 * 有问题」的情形，由 manifest 校验器负责在保存时拦住，不在这里重复拦。
 *
 * 注意两条路径的处理不对称：切出来的段**原样返回**（它已经是 canonical channelId 的
 * 一部分，洗一遍反而可能改掉真实 id）；走 fallback 时才洗（fallback 是旧的通道别名，
 * 不保证 channelId-safe）。
 *
 * @param {*} channelId canonical channelId。
 * @param {*} fallback 无冒号时的兜底来源。
 * @returns {string} sensorId 段。
 */
function sensorIdFromChannelId(channelId, fallback) {
  const value = String(channelId || '');
  const separator = value.indexOf(':');
  return separator >= 0
    ? value.slice(separator + 1)
    : normalizeIdentityPart(fallback, 'sensor');
}

/**
 * 解析 legacy 输出别名对应的 canonical channel identity。
 *
 * 有 manifest 时直接采用 runtime plan 的 channelId；没有 manifest 的旧传感器则使用
 * `${sensorType}:${outputChannel}` 作为稳定兼容身份。兼容身份仍包含展示系统维度，
 * 不会再把所有系统的 sit/back/head 零点混到同一组全局数组里。
 */
function createZeroChannelIdentityResolver({
  getActiveSensorType,
  listSerialChannels,
} = {}) {
  /**
   * 取当前活动传感器类型声明的全部串口通道。
   *
   * 两个依赖都用可选调用（`?.`）并把结果兜成数组：这个解析器在装配早期就被建出来，
   * 那时展示系统可能还没发现完；返回空数组会让下面三个函数走各自的兼容分支，而不是抛错。
   * 「零点暂时按兼容身份记」比「启动期抛错」好。
   *
   * @returns {object[]} 通道声明列表；不可用时为 []。
   */
  function getDeclaredChannels() {
    const sensorType = String(getActiveSensorType?.() || '').trim();
    const channels = listSerialChannels?.(sensorType);
    return Array.isArray(channels) ? channels : [];
  }

  /**
   * 求当前活动展示系统 id。
   *
   * 取**第一个**声明通道的 displaySystemId 即可，因为通道列表是按 sensorType 查出来的，
   * 而 `getBySensorType` 是 first-match-wins（同一 sensorType 只会命中一个展示系统），
   * 所以这一批通道必然同属一个展示系统。
   *
   * 没有 manifest 时退回洗过的 sensorType 当展示系统 id。这一步是「零点不再全局混用」
   * 的关键：即使是旧传感器，它的兼容身份里**也带展示系统维度**，于是两个都输出 `sit`
   * 的旧系统不会共享同一份零点基准（那是这套改造之前的实际行为）。
   *
   * @returns {string} 展示系统 id；完全没有活动传感器时为空串。
   */
  function getActiveDisplaySystemId() {
    const declared = getDeclaredChannels();
    if (declared[0]?.displaySystemId) return String(declared[0].displaySystemId);
    const sensorType = String(getActiveSensorType?.() || '').trim();
    return sensorType ? normalizeIdentityPart(sensorType, 'legacy') : '';
  }

  /**
   * 把一个 legacy 输出别名解析成完整身份（channelId / 展示系统 / sensorId / 类型 / 别名）。
   *
   * 这是兼容边界上唯一的身份来源，`zeroFrameAdapter` 全靠它给旧帧配 channelId。
   *
   * 匹配时**三个字段都试**（`outputChannel` / `serialRole` / `channelId`），因为调用方
   * 传进来的「通道名」历史上三种都有：旧前端传展示别名，旧串口层传角色名，新代码可能
   * 直接传完整 channelId。三者在同一个命名空间里不会冲突（manifest 校验保证 id 唯一）。
   *
   * 匹配不到时**合成**兼容身份 `${sensorType}:${通道}`，两段都洗过所以一定能被零点仓库
   * 接受。这条路走的是没有 manifest 的旧传感器。
   *
   * 合成结果里有一处刻意的不对称：`sensorId` 用洗过的值（要拼进 channelId，必须
   * channelId-safe），而 `outputChannel` 保留**未洗**的原值（它是给 legacy 前端认字段名
   * 用的展示别名，洗过之后可能就对不上 `sitData` 那套字段了）。
   *
   * 默认 `'sit'`：旧链路里不传通道名就意味着主通道，这个默认值遍布 legacy 代码。
   *
   * @param {string} outputChannel 旧的输出别名 / 角色名 / channelId。
   * @returns {{channelId: string, displaySystemId: string, sensorId: string,
   *   sensorType: string, outputChannel: string}} 完整身份。
   */
  function resolveChannelIdentity(outputChannel) {
    const channel = String(outputChannel || 'sit').trim() || 'sit';
    const declared = getDeclaredChannels();
    const match = declared.find((item) => (
      item.outputChannel === channel
      || item.serialRole === channel
      || item.channelId === channel
    ));

    if (match?.channelId) {
      return {
        channelId: String(match.channelId),
        displaySystemId: String(match.displaySystemId || getActiveDisplaySystemId()),
        sensorId: String(match.sensorId || sensorIdFromChannelId(match.channelId, channel)),
        sensorType: String(match.sensorType || getActiveSensorType?.() || 'legacy'),
        outputChannel: String(match.outputChannel || channel),
      };
    }

    const sensorType = normalizeIdentityPart(getActiveSensorType?.(), 'legacy');
    const normalizedChannel = normalizeIdentityPart(channel, 'sensor');
    return {
      channelId: `${sensorType}:${normalizedChannel}`,
      displaySystemId: sensorType,
      sensorId: normalizedChannel,
      sensorType,
      outputChannel: channel,
    };
  }

  /**
   * 列出当前活动展示系统的全部 canonical channelId。
   *
   * 「给整个展示系统归零」就是拿这份列表当目标（零点命令服务的目标解析器最终落到这里）。
   *
   * **只列 manifest 声明的通道**，不含 resolveChannelIdentity 合成的兼容身份 ——
   * 合成身份是遇到帧才产生的，事先枚举不出来。所以没有 manifest 的旧传感器只能按具体
   * 通道归零，不能整系统归零；那条路的目标由帧到达时记进零点仓库的 channelId 决定。
   *
   * 过滤空值：声明里缺 channelId 的条目宁可漏掉，也不要放一个空串进去 —— 那会被零点
   * 命令服务判成不合法 id 而让整条命令报错。
   *
   * @returns {string[]} channelId 列表。
   */
  function listActiveChannelIds() {
    return getDeclaredChannels()
      .map((channel) => String(channel.channelId || '').trim())
      .filter(Boolean);
  }

  return {
    getActiveDisplaySystemId,
    listActiveChannelIds,
    resolveChannelIdentity,
  };
}

module.exports = {
  createZeroChannelIdentityResolver,
  normalizeIdentityPart,
  sensorIdFromChannelId,
};
