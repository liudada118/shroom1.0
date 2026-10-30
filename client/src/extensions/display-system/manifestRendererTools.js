const MATRIX_RENDERERS = new Set(['pointGrid', 'numMatrix', 'webglHeatmap', 'blobHeatmap']);
const EMPTY_CONTROLS = {
  showGuass: false, showSize: false, showSpeed: false, showColor: false,
  showFilter: false, showHeight: false, showConsis: false, showInit: false,
  showEdgeBuffer: false,
};

const TUNING_CONTROLS = { valueg: 'showGuass', valuej: 'showColor', valuef: 'showFilter',
  value: 'showHeight', valuel: 'showConsis', valuelInit: 'showInit', edgeBuffer: 'showEdgeBuffer' };

/** 汇总当前可见矩阵画布的句柄，延迟挂载和切换视图后重放展示调参。 */
export function createManifestRendererTools() {
  const instances = new Map();
  const callbacks = new Map();
  let widgets = [];
  let tuning = {};
  let colors = {};
  let layoutKey = '';
  let revision = 0;

  /** 只返回仍属于当前可见 widget 和渲染类型的实例。 */
  const mounted = () => widgets.flatMap((widget) => {
    const entry = instances.get(widget.id);
    return entry?.type === widget.type && entry.instance ? [entry.instance] : [];
  });

  /** 主画布优先使用 main；多画布没有 main 时按可见布局顺序取第一路。 */
  const primary = () => {
    const widget = widgets.find((entry) => entry.id === 'main') || widgets[0];
    const entry = widget && instances.get(widget.id);
    return widget && entry?.type === widget.type ? entry.instance : null;
  };

  /** 按主画布真实输入模式声明调参，原始数字模式不展示无效过滤。 */
  const controls = () => {
    const widget = widgets.find((entry) => entry.id === 'main') || widgets[0];
    if (!widget) return { ...EMPTY_CONTROLS };
    const extended = widget.type !== 'numMatrix';
    const edgeControls = widget.type === 'pointGrid' ? primary()?.getTuningControls?.() : null;
    // 异步挂载前保留规则矩阵的已保存边宽；公开能力仍由 getTuningControls 等待真实实例。
    const pendingRegularGrid = widget.type === 'pointGrid' && !primary() && !widget.rendererParams?.points?.length;
    return { ...EMPTY_CONTROLS, showColor: true,
      showFilter: widget.type !== 'numMatrix' || widget.rendererParams?.frameInput !== 'raw',
      showGuass: extended, showHeight: widget.type === 'pointGrid',
      showConsis: extended, showInit: extended,
      showEdgeBuffer: edgeControls?.showEdgeBuffer === true || pendingRegularGrid,
      edgeBufferDefault: edgeControls?.edgeBufferDefault };
  };

  /** 视图切换的间隙拒绝旧滑块发送当前模式不支持的参数。 */
  const supported = (patch) => {
    const current = controls();
    return Object.fromEntries(Object.entries(patch).filter(([key]) => current[TUNING_CONTROLS[key]]));
  };

  /** 对每个当前可见实例转发一次，防止同一实例被多个 widget 重复登记。 */
  const forward = (method, args) => {
    let result;
    for (const instance of new Set(mounted())) {
      if (typeof instance[method] === 'function') result = instance[method](...args);
    }
    return result;
  };

  return {
    /** 更新可见布局，立即撤销隐藏或切换渲染类型的旧能力。 */
    setWidgets(next) {
      widgets = (Array.isArray(next) ? next : []).filter((widget) => MATRIX_RENDERERS.has(widget.type));
      const nextKey = JSON.stringify(widgets.map(({ id, type }) => [id, type]));
      if (nextKey !== layoutKey) {
        layoutKey = nextKey;
        revision += 1;
        instances.clear();
        callbacks.clear();
      }
    },
    /** 回调按 widget 与渲染类型固定，旧组件迟到的卸载不会清掉新类型实例。 */
    rendererRef(id, type) {
      const key = JSON.stringify([id, type]);
      if (!callbacks.has(key)) {
        const mountedRevision = revision;
        callbacks.set(key, (instance) => {
          if (mountedRevision !== revision) return;
          if (!instance) {
            if (instances.get(id)?.type === type) instances.delete(id);
            return;
          }
          if (!widgets.some((widget) => widget.id === id && widget.type === type)) return;
          instances.set(id, { type, instance });
          const activeTuning = supported(tuning);
          if (Object.keys(activeTuning).length) instance.sitValue?.(activeTuning);
          const activeColors = { ...(controls().showColor && colors.max !== undefined ? { max: colors.max } : {}),
            ...(controls().showFilter && colors.filter !== undefined ? { filter: colors.filter } : {}) };
          if (Object.keys(activeColors).length) instance.changeColor?.(activeColors);
        });
      }
      return callbacks.get(key);
    },
    /** 展示调参仅转发可见画布；缓存不包含帧、线序或采集配置。 */
    sitValue(patch = {}) {
      const next = supported(patch);
      if (!Object.keys(next).length) return undefined;
      tuning = { ...tuning, ...next };
      return forward('sitValue', [next]);
    },
    /** 保留旧工具的另一通道调参入口，不更改矩阵路由。 */
    backValue: (...args) => forward('backValue', args),
    /** 兼容热力图色标和尺寸调参，切换渲染器后仍可重放。 */
    changeColor(patch = {}) {
      const next = { ...(controls().showColor && patch.max !== undefined ? { max: patch.max } : {}),
        ...(controls().showFilter && patch.filter !== undefined ? { filter: patch.filter } : {}) };
      if (!Object.keys(next).length) return undefined;
      colors = { ...colors, ...next };
      return forward('changeColor', [next]);
    },
    /** 视角和框选只使用主活动画布实际提供的接口。 */
    getViewTools: () => primary()?.getViewTools?.() || null,
    getSelectionTools: () => primary()?.getSelectionTools?.() || null,
    changeSelectFlag: (...args) => primary()?.changeSelectFlag?.(...args),
    changeGroupRotate: (...args) => primary()?.changeGroupRotate?.(...args),
    reset: (...args) => primary()?.reset?.(...args),
    /** 按当前已挂载的矩阵渲染器列出真实调节项，加载期间不冒充支持。 */
    getTuningControls() {
      return typeof primary()?.sitValue === 'function' ? controls() : { ...EMPTY_CONTROLS };
    },
  };
}
