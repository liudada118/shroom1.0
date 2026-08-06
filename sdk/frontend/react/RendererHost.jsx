/**
 * RendererHost.jsx - 渲染器插件挂载点
 *
 * 负责三件事：按 id 解析并懒加载渲染器、按契约喂 props、把渲染器的崩溃
 * 圈在自己这一块里。
 *
 * 错误边界是平台化的底线要求：用户创建的模块引用了不存在的渲染器、
 * 参数填错导致渲染器抛异常、或者渲染器自身有 bug，都不能让整个主界面白屏。
 * React 的错误边界只能用 class 组件实现，这也是本文件里有 class 的原因。
 */

import React from 'react';

import { subscribeFrames } from '../core/frameBus.js';
import { registerBuiltinRenderers } from './builtins.js';
import { getRendererDescriptor, loadRenderer } from '../core/registry.js';

// 内置渲染器在模块加载时注册一次。放在这里而不是应用入口，是为了让
// 任何用到 RendererHost 的地方都自动具备内置渲染器，不必各自记得初始化。
registerBuiltinRenderers();

/**
 * 渲染器错误边界。
 *
 * 捕获渲染器子树在渲染、生命周期与构造函数中抛出的异常。注意它捕获不到
 * 事件处理器和 requestAnimationFrame 回调里的异常——3D 渲染循环恰好在
 * rAF 里，那部分只能靠渲染器自身的防御性判断。
 */
class RendererErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error(`[renderers] 渲染器 ${this.props.rendererId} 运行时崩溃:`, error, info);
  }

  componentDidUpdate(prevProps) {
    // 切换渲染器时清掉上一个的错误状态，否则换一个正常的模块也显示不出来
    if (prevProps.rendererId !== this.props.rendererId && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <section className="manifest-widget manifest-renderer-error">
          <h3>{this.props.label}</h3>
          <span>渲染器运行出错：{this.state.error.message}</span>
        </section>
      );
    }
    return this.props.children;
  }
}

/** 已经报过契约漂移的渲染器，避免每次挂载都刷一遍控制台。 */
const CONTRACT_WARNED = new Set();

/**
 * 按 descriptor.methods 校验渲染器实例的暴露面。
 *
 * `descriptor.methods` 这个字段一直存在，但从来没人校验过 —— 它是注释，
 * 不是契约。这里给它加上牙齿：
 *
 * - **声明了却没实现** → `console.error`。这是真正的 bug 源：Home 侧的调用
 *   全都写成 `this.com.current?.xxx()`，方法名打错时会静默 no-op，
 *   现象是"这个展示形式没数据"，查起来要翻半天。
 * - **实现了却没声明** → `console.warn`。说明契约在漂移，该补声明。
 *
 * **刻意不做的事：不把未声明的方法挡掉。** 挡掉会引入一个新的静默失败
 * 模式（descriptor 漏写一行，功能就没了），比现在更难查。只报不挡。
 *
 * ## `optionalMethods`：暴露面依赖参数的那一类
 *
 * `methods` 是按**渲染器 id** 声明的，但有的渲染器的暴露面依赖参数。
 * `numMatrix` 是第一个：走 `sprite3d` 后端时是 4 个方法，走 `canvas2d`
 * 时是 14 个。两种情况都得干净 —— 只声明 4 个则 canvas2d 报"未声明"，
 * 声明 14 个则 sprite3d 报"未实现"，而两条都是误报。
 *
 * 所以 `methods` 写**并集**（`validateRendererDescriptor` 照常校验全部
 * 14 个名字都在契约里），再用 `optionalMethods` 标出「这几个可以缺席」。
 * 缺席不报错，出现也不算漂移。**别拿它当"懒得实现"的免死金牌** —— 只有
 * 「同一个渲染器的不同参数走不同实现」才该进这个数组。
 *
 * @param {string} rendererId 渲染器 id。
 * @param {object} instance 渲染器实例句柄。
 * @returns {{missing: string[], undeclared: string[]} | null} 审计结果，已报过的返回 null。
 */
export function auditRendererContract(rendererId, instance) {
  if (!instance || CONTRACT_WARNED.has(rendererId)) return null;
  const descriptor = getRendererDescriptor(rendererId);
  const declared = descriptor?.methods || [];
  if (!declared.length) return null;
  CONTRACT_WARNED.add(rendererId);

  const optional = new Set(descriptor?.optionalMethods || []);
  const missing = declared.filter(
    (name) => !optional.has(name) && typeof instance[name] !== 'function',
  );
  if (missing.length) {
    console.error(
      `[renderers] 渲染器 ${rendererId} 声明了这些方法但没有实现：${missing.join('、')}。`
      + '宿主侧的调用是可选链，缺失只会静默 no-op，请核对 useImperativeHandle。',
    );
  }

  const declaredSet = new Set(declared);
  const undeclared = Object.keys(instance)
    .filter((name) => typeof instance[name] === 'function' && !declaredSet.has(name));
  if (undeclared.length) {
    console.warn(
      `[renderers] 渲染器 ${rendererId} 实现了未声明的方法：${undeclared.join('、')}。`
      + '请补进 builtins.js 的 methods，否则能力过滤和 UI 按钮显示都看不到它们。',
    );
  }

  return { missing, undeclared };
}

/**
 * 清空契约审计的"已报过"记录。仅供测试使用。
 */
export function resetContractAudit() {
  CONTRACT_WARNED.clear();
}

/**
 * 挂载一个渲染器插件。
 *
 * 三条通道各走各的（详见 runtime/frameBus.js 的文件头）：
 * - **每帧数据** —— 传 `frameChannel` 时订阅帧总线，不经过 props、不触发重渲染
 * - **视图状态** —— 走 props，原样透传给渲染器
 * - **真命令** —— 走 `rendererRef`，暴露面由 `descriptor.methods` 声明并校验
 *
 * @param {object} props 组件属性。
 * @param {string} props.rendererId 渲染器 id。
 * @param {object} props.params 渲染器参数。
 * @param {string} [props.label] 展示名称，用于加载中与错误提示。
 * @param {React.Ref} [props.rendererRef] 转发给渲染器的命令式句柄。
 * @param {number[]} [props.values] 声明式数据源。给了就走这条，不订阅总线。
 * @param {string} [props.channel] `values` 推给哪条通道（sit / back）。
 * @param {string} [props.frameChannel] 订阅帧总线并取这条通道。不给就不订阅。
 * @returns {JSX.Element} 渲染结果。
 */
export default function RendererHost({
  rendererId,
  params,
  label,
  rendererRef,
  values,
  channel = 'sit',
  frameChannel,
  ...contractProps
}) {
  const [state, setState] = React.useState({ status: 'loading', Component: null, error: null });
  const internalRef = React.useRef(null);

  // 宿主是声明式的（values 数组），场景渲染器是命令式的（ref.sitData()）。
  // 这个 effect 是两者之间的适配：values 变化时推给渲染器。
  React.useEffect(() => {
    if (state.status !== 'ready' || !Array.isArray(values)) return;
    const api = internalRef.current;
    if (!api) return;

    const push = channel === 'back' ? api.backData : api.sitData;
    if (typeof push !== 'function') return;

    try {
      push({ wsPointData: values });
    } catch (error) {
      console.error(`[renderers] 渲染器 ${rendererId} 接收数据出错:`, error);
    }
  }, [values, channel, rendererId, state.status]);

  // 帧总线通道。**不进 React state** —— 30-100Hz 的数据一旦触发 setState，
  // 就会撞上 CanvasCom 那堵故意砌的 shouldComponentUpdate 墙背后的整棵树。
  // 这里订到帧之后直接调渲染器的命令式方法，和旧的 ref 推送性能等价，
  // 区别只是依赖方向反了：Home 不再需要知道渲染器叫什么方法。
  React.useEffect(() => {
    if (state.status !== 'ready' || !frameChannel) return undefined;

    return subscribeFrames((frame) => {
      const api = internalRef.current;
      if (!api) return;

      const channelValues = frame?.channels?.[frameChannel];
      if (!Array.isArray(channelValues)) return;

      const push = frameChannel === 'back' ? api.backData : api.sitData;
      if (typeof push !== 'function') return;

      try {
        push({ wsPointData: channelValues, statsData: frame.raw || undefined });
      } catch (error) {
        console.error(`[renderers] 渲染器 ${rendererId} 处理帧数据出错:`, error);
      }
    });
  }, [frameChannel, rendererId, state.status]);

  const attachRef = React.useCallback((instance) => {
    internalRef.current = instance;
    if (instance) auditRendererContract(rendererId, instance);
    if (typeof rendererRef === 'function') rendererRef(instance);
    else if (rendererRef) rendererRef.current = instance;
  }, [rendererRef, rendererId]);

  React.useEffect(() => {
    let cancelled = false;

    if (!rendererId || !getRendererDescriptor(rendererId)) {
      setState({ status: 'missing', Component: null, error: null });
      return undefined;
    }

    setState({ status: 'loading', Component: null, error: null });

    loadRenderer(rendererId)
      .then((Component) => {
        if (cancelled) return;
        setState({ status: 'ready', Component, error: null });
      })
      .catch((error) => {
        if (cancelled) return;
        console.error(`[renderers] 渲染器 ${rendererId} 加载失败:`, error);
        setState({ status: 'error', Component: null, error });
      });

    return () => {
      cancelled = true;
    };
  }, [rendererId]);

  const displayLabel = label || rendererId;

  if (state.status === 'missing') {
    return (
      <section className="manifest-widget manifest-unsupported-widget">
        <h3>{displayLabel}</h3>
        <span>当前客户端未注册渲染器：{rendererId}</span>
      </section>
    );
  }

  if (state.status === 'error') {
    return (
      <section className="manifest-widget manifest-renderer-error">
        <h3>{displayLabel}</h3>
        <span>渲染器加载失败：{state.error?.message}</span>
      </section>
    );
  }

  if (state.status === 'loading' || !state.Component) {
    return (
      <section className="manifest-widget manifest-renderer-loading">
        <h3>{displayLabel}</h3>
        <span>渲染器加载中…</span>
      </section>
    );
  }

  const { Component } = state;

  return (
    <RendererErrorBoundary rendererId={rendererId} label={displayLabel}>
      <Component ref={attachRef} params={params} {...contractProps} />
    </RendererErrorBoundary>
  );
}
