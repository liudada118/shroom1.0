import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Tooltip,
  message,
} from 'antd';
import {
  AppstoreOutlined,
  BulbOutlined,
  CodeOutlined,
  CopyOutlined,
  DatabaseOutlined,
  FunctionOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import {
  compileFormulaChartExpression,
  createFormulaChartFunctionSource,
  describeFormulaChartExpression,
  extractFormulaChartExpression,
} from './formulaChartRuntime';
import { FORMULA_CHART_TEMPLATES } from './formulaChartTemplates';
import { buildSparklinePath } from './chartAppearance';
import {
  FORMULA_CHART_LIMIT,
  clampFormulaChartDecimals,
  createFormulaChartId,
  formulaChartStorageKey,
  formulasMatch,
  loadFormulaCharts,
  saveFormulaCharts,
  subscribeFormulaCharts,
} from './formulaChartStore';

const MAX_CHARTS = FORMULA_CHART_LIMIT;
const MAX_HISTORY = 60;
const UPDATE_INTERVAL = 100;
const DEFAULT_COLOR = '#20B486';
const EMPTY_DEFINITIONS = [];
const RAW_PREVIEW_LIMIT = 128;
const EMPTY_FRAME = {
  values: [],
  rawData: [],
  metrics: {},
  algorithmMetrics: {},
  matrix: {},
  frame: 0,
};

/**
 * 两条内置曲线的改写存在另一个键里。它们不是"用户加的图表"，
 * 而是对固有卡片的覆盖，所以不和自定义清单混住。
 *
 * @param {string} matrixName 展示系统标识。
 * @returns {string} localStorage 键名。
 */
function getBuiltinStorageKey(matrixName) {
  return `shroom.formulaCharts.builtin.v1.${encodeURIComponent(matrixName || 'default')}`;
}

function normalizeBuiltinDefinitions(definitions) {
  if (!Array.isArray(definitions)) return [];
  return definitions
    .filter((definition) => definition?.id && definition?.formula)
    .map((definition) => ({
      id: String(definition.id),
      name: String(definition.name || definition.id),
      formula: String(definition.formula),
      unit: String(definition.unit || ''),
      decimals: clampFormulaChartDecimals(definition.decimals ?? 2),
      color: definition.color || DEFAULT_COLOR,
    }));
}

function loadBuiltinDefinitions(matrixName, defaults) {
  const normalizedDefaults = normalizeBuiltinDefinitions(defaults);
  try {
    const parsed = JSON.parse(
      localStorage.getItem(getBuiltinStorageKey(matrixName)) || '[]'
    );
    const overrides = new Map(
      (Array.isArray(parsed) ? parsed : [])
        .filter((definition) => definition?.id)
        .map((definition) => [String(definition.id), definition])
    );
    return normalizedDefaults.map((definition) => {
      const override = overrides.get(definition.id);
      if (!override) return definition;
      return {
        ...definition,
        formula: String(override.formula || definition.formula),
        unit: String(override.unit ?? definition.unit),
        decimals: clampFormulaChartDecimals(override.decimals ?? definition.decimals),
        color: override.color || definition.color,
      };
    });
  } catch {
    return normalizedDefaults;
  }
}

function saveBuiltinDefinitions(matrixName, definitions) {
  const overrides = definitions.map((definition) => ({
    id: definition.id,
    formula: definition.formula,
    unit: definition.unit,
    decimals: definition.decimals,
    color: definition.color,
  }));
  localStorage.setItem(getBuiltinStorageKey(matrixName), JSON.stringify(overrides));
}

function compileDefinitions(definitions) {
  const compiled = new Map();
  definitions.forEach((definition) => {
    try {
      compiled.set(definition.id, compileFormulaChartExpression(definition.formula));
    } catch {
      // 跳过失效的历史公式，避免一张图影响其它实时图表。
    }
  });
  return compiled;
}

function formatValue(value, decimals = 2) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(decimals) : '--';
}

function normalizeFormulaForEditor(source) {
  try {
    return createFormulaChartFunctionSource(source);
  } catch {
    return String(source || '');
  }
}

function findMatchingTemplate(definition = {}) {
  return FORMULA_CHART_TEMPLATES.find((template) => (
    formulasMatch(template.formula, definition.formula)
  )) || null;
}

function buildRawFramePreview(frame = EMPTY_FRAME) {
  const values = Array.isArray(frame.rawData) ? frame.rawData : frame.values;
  return JSON.stringify({
    matrix: frame.matrix || {},
    frame: frame.frame || 0,
    rawData: values.slice(0, RAW_PREVIEW_LIMIT),
  }, null, 2);
}

/**
 * 公式图表的计算与编辑面板。
 *
 * 它**不再画图表**：卡片由 `Aside` 用 `drawChart` 画在 canvas 上，和 Pressure Area
 * 同款、同一条绘制通路，所以自动吃上「图表配色 / 图表叠加层」零件。这里只剩两件事 ——
 * 逐帧算出序列往上抛（`onBuiltinSeries` / `onCustomSeries`），以及那个公式编辑弹窗。
 *
 * @param {object} props 组件参数。
 * @param {string} props.matrixName 展示系统标识，图表清单按它分开存。
 * @param {object} props.matrixShape 矩阵形状，公式里的 rows/cols 用它兜底。
 * @param {object[]} [props.algorithmMetricDefinitions] 算法输出指标，供公式插入下拉用。
 * @param {object[]} [props.builtinDefinitions] 两条内置曲线（Pressure Data / Pressure Area）的定义。
 * @param {(series: object) => void} [props.onBuiltinSeries] 内置曲线的逐帧序列。
 * @param {(series: object) => void} [props.onCustomSeries] 自定义图表的逐帧序列。
 */
const FormulaChartPanel = forwardRef(function FormulaChartPanel({
  matrixName,
  matrixShape,
  algorithmMetricDefinitions = EMPTY_DEFINITIONS,
  builtinDefinitions = EMPTY_DEFINITIONS,
  onBuiltinSeries,
  onCustomSeries,
}, ref) {
  const [form] = Form.useForm();
  const [messageApi, messageContext] = message.useMessage();
  const [definitions, setDefinitions] = useState(() => loadFormulaCharts(matrixName));
  const [activeBuiltinDefinitions, setActiveBuiltinDefinitions] = useState(
    () => loadBuiltinDefinitions(matrixName, builtinDefinitions)
  );
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingBuiltinId, setEditingBuiltinId] = useState(null);
  const [formulaError, setFormulaError] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    FORMULA_CHART_TEMPLATES[0].id
  );
  const [editorFrame, setEditorFrame] = useState(EMPTY_FRAME);
  const definitionsRef = useRef(definitions);
  const builtinDefinitionsRef = useRef(activeBuiltinDefinitions);
  const builtinHistoriesRef = useRef({});
  // 自定义图表的历史值和内置的一样放 ref：卡片已经不在这个组件里渲染，
  // 再用 state 装等于每 100ms 白重渲染一次面板。
  const customHistoriesRef = useRef({});
  const compiledRef = useRef(compileDefinitions(definitions));
  const builtinCompiledRef = useRef(compileDefinitions(activeBuiltinDefinitions));
  const onBuiltinSeriesRef = useRef(onBuiltinSeries);
  const onCustomSeriesRef = useRef(onCustomSeries);
  const frameRef = useRef(0);
  const lastUpdateRef = useRef(0);
  const editorOpenRef = useRef(false);
  const latestFrameRef = useRef(EMPTY_FRAME);
  const watchedFormula = Form.useWatch('formula', form);

  useEffect(() => {
    onBuiltinSeriesRef.current = onBuiltinSeries;
  }, [onBuiltinSeries]);

  useEffect(() => {
    onCustomSeriesRef.current = onCustomSeries;
  }, [onCustomSeries]);

  // 清单的主人是 store：零件栏在 Home 里添加、卡片在 Aside 上删除，
  // 都通过这条订阅回到这里，公式才会跟着重新编译。
  useEffect(() => {
    const key = formulaChartStorageKey(matrixName);
    return subscribeFormulaCharts((changedMatrixName, nextDefinitions) => {
      if (formulaChartStorageKey(changedMatrixName) !== key) return;
      const alive = new Set(nextDefinitions.map((definition) => definition.id));
      customHistoriesRef.current = Object.fromEntries(
        Object.entries(customHistoriesRef.current).filter(([id]) => alive.has(id))
      );
      definitionsRef.current = nextDefinitions;
      compiledRef.current = compileDefinitions(nextDefinitions);
      setDefinitions(nextDefinitions);
    });
  }, [matrixName]);

  useEffect(() => {
    editorOpenRef.current = editorOpen;
    if (editorOpen) setEditorFrame(latestFrameRef.current);
  }, [editorOpen]);

  useEffect(() => {
    const nextDefinitions = loadFormulaCharts(matrixName);
    const nextBuiltinDefinitions = loadBuiltinDefinitions(matrixName, builtinDefinitions);
    definitionsRef.current = nextDefinitions;
    builtinDefinitionsRef.current = nextBuiltinDefinitions;
    builtinHistoriesRef.current = {};
    customHistoriesRef.current = {};
    compiledRef.current = compileDefinitions(nextDefinitions);
    builtinCompiledRef.current = compileDefinitions(nextBuiltinDefinitions);
    setDefinitions(nextDefinitions);
    setActiveBuiltinDefinitions(nextBuiltinDefinitions);
    frameRef.current = 0;
    lastUpdateRef.current = 0;
    latestFrameRef.current = EMPTY_FRAME;
    setEditorFrame(EMPTY_FRAME);
    onBuiltinSeriesRef.current?.({});
    onCustomSeriesRef.current?.({});
  }, [builtinDefinitions, matrixName]);

  useEffect(() => {
    definitionsRef.current = definitions;
    compiledRef.current = compileDefinitions(definitions);
  }, [definitions]);

  useEffect(() => {
    builtinDefinitionsRef.current = activeBuiltinDefinitions;
    builtinCompiledRef.current = compileDefinitions(activeBuiltinDefinitions);
  }, [activeBuiltinDefinitions]);

  const openCreate = useCallback(() => {
    if (definitionsRef.current.length >= MAX_CHARTS) {
      messageApi.warning(`最多创建 ${MAX_CHARTS} 张公式图表`);
      return;
    }
    const template = FORMULA_CHART_TEMPLATES[0];
    setEditingId(null);
    setEditingBuiltinId(null);
    setFormulaError('');
    setSelectedTemplateId(template.id);
    form.setFieldsValue({
      name: template.name,
      formula: template.formula,
      unit: template.unit,
      decimals: template.decimals,
      color: template.color,
    });
    setEditorFrame(latestFrameRef.current);
    setEditorOpen(true);
  }, [form, messageApi]);

  /**
   * 打开某张自定义图表的编辑弹窗。入参是 id 而不是定义对象 ——
   * 卡片画在 `Aside` 里，它手上只有 id，定义的真相在这个组件的 ref 上。
   *
   * @param {string} id 图表 id。
   * @returns {boolean} 是否找到了这张图表。
   */
  const openEdit = useCallback((id) => {
    const definition = definitionsRef.current.find((item) => item.id === id);
    if (!definition) return false;
    const template = findMatchingTemplate(definition);
    setEditingId(definition.id);
    setEditingBuiltinId(null);
    setFormulaError('');
    setSelectedTemplateId(template?.id || null);
    form.setFieldsValue({
      ...definition,
      formula: normalizeFormulaForEditor(definition.formula),
    });
    setEditorFrame(latestFrameRef.current);
    setEditorOpen(true);
    return true;
  }, [form]);

  const openBuiltinEditor = useCallback((id) => {
    const definition = builtinDefinitionsRef.current.find((item) => item.id === id);
    if (!definition) return false;
    const template = findMatchingTemplate(definition);
    setEditingId(null);
    setEditingBuiltinId(definition.id);
    setFormulaError('');
    setSelectedTemplateId(template?.id || null);
    form.setFieldsValue({
      ...definition,
      formula: normalizeFormulaForEditor(definition.formula),
    });
    setEditorFrame(latestFrameRef.current);
    setEditorOpen(true);
    return true;
  }, [form]);

  useImperativeHandle(ref, () => ({
    openBuiltinEditor,
    openEdit,
    openCreate,
    pushFrame(input = {}) {
      const customDefinitions = definitionsRef.current;
      const currentBuiltinDefinitions = builtinDefinitionsRef.current;

      const now = Date.now();
      if (now - lastUpdateRef.current < UPDATE_INTERVAL) return;
      lastUpdateRef.current = now;
      frameRef.current += 1;
      const evaluationInput = {
        ...input,
        rawData: Array.isArray(input.rawData) ? input.rawData : input.values,
        matrix: input.matrix || matrixShape || {},
        frame: frameRef.current,
      };
      latestFrameRef.current = evaluationInput;
      if (editorOpenRef.current) setEditorFrame(evaluationInput);
      if (!customDefinitions.length && !currentBuiltinDefinitions.length) return;

      if (currentBuiltinDefinitions.length) {
        const nextBuiltinHistories = { ...builtinHistoriesRef.current };
        const series = {};
        currentBuiltinDefinitions.forEach((definition) => {
          const evaluate = builtinCompiledRef.current.get(definition.id);
          if (!evaluate) return;
          const value = evaluate(evaluationInput);
          const values = [
            ...(nextBuiltinHistories[definition.id] || []),
            value,
          ].slice(-MAX_HISTORY);
          nextBuiltinHistories[definition.id] = values;
          series[definition.id] = {
            definition,
            values,
            latest: value,
          };
        });
        builtinHistoriesRef.current = nextBuiltinHistories;
        onBuiltinSeriesRef.current?.(series);
      }

      // 自定义图表走和内置完全一样的路：算出序列、往上抛，由 Aside 画到 canvas 上。
      if (customDefinitions.length) {
        const nextCustomHistories = { ...customHistoriesRef.current };
        const series = {};
        customDefinitions.forEach((definition) => {
          const evaluate = compiledRef.current.get(definition.id);
          if (!evaluate) return;
          const value = evaluate(evaluationInput);
          const values = [
            ...(nextCustomHistories[definition.id] || []),
            value,
          ].slice(-MAX_HISTORY);
          nextCustomHistories[definition.id] = values;
          series[definition.id] = { definition, values, latest: value };
        });
        customHistoriesRef.current = nextCustomHistories;
        onCustomSeriesRef.current?.(series);
      }
    },
  }), [matrixShape, openBuiltinEditor, openCreate, openEdit]);

  const insertOptions = useMemo(() => {
    const options = [
      {
        label: '基础统计',
        options: [
          { label: '总压力（total）', value: 'total' },
          { label: '平均压力（avg）', value: 'avg' },
          { label: '最大压力（max）', value: 'max' },
          { label: '有效受压点数量（points）', value: 'points' },
          { label: '受压面积（area）', value: 'area' },
          { label: '当前帧序号（frame）', value: 'frame' },
        ],
      },
      {
        label: '串口解码原始数据',
        options: [
          { label: '原始点总数（rawLength）', value: 'rawLength' },
          { label: '矩阵行数（rows）', value: 'rows' },
          { label: '矩阵列数（cols）', value: 'cols' },
          { label: '指定原始点（raw）', value: 'raw(0)' },
          { label: '全部原始点求和（sum）', value: 'sum()' },
          { label: '指定范围求和（sum）', value: 'sum(0, 15)' },
          { label: '全部原始点平均值（average）', value: 'average()' },
          { label: '大于阈值的点数（countAbove）', value: 'countAbove(10)' },
          { label: '原始点最大值（rawMax）', value: 'rawMax()' },
          { label: '原始点最小值（rawMin）', value: 'rawMin()' },
          { label: '原始点标准差（stddev）', value: 'stddev()' },
          { label: '原始点百分位（percentile）', value: 'percentile(95)' },
          { label: '指定行求和（rowSum）', value: 'rowSum(0)' },
          { label: '指定列求和（columnSum）', value: 'columnSum(0)' },
          { label: '矩形区域求和（regionSum）', value: 'regionSum(0, 0, 3, 3)' },
          {
            label: '矩形区域平均值（regionAverage）',
            value: 'regionAverage(0, 0, 3, 3)',
          },
        ],
      },
      {
        label: '数学与条件',
        options: [
          { label: '绝对值（abs）', value: 'abs(total)' },
          { label: '四舍五入（round）', value: 'round(avg)' },
          { label: '平方根（sqrt）', value: 'sqrt(total)' },
          { label: '取较小值（min）', value: 'min(total, 100)' },
          { label: '取较大值（max）', value: 'max(rawLength, 1)' },
          { label: '限制数值范围（clamp）', value: 'clamp(total, 0, 100)' },
          {
            label: '条件判断（if）',
            value: 'if(total > 0, total, 0)',
          },
        ],
      },
    ];
    const algorithmOptions = (algorithmMetricDefinitions || []).map((metric) => ({
      label: `${metric.label || metric.id}（算法输出）`,
      value: `algorithm_${String(metric.id).replace(/[^A-Za-z0-9_]/g, '_')}`,
    }));
    if (algorithmOptions.length) {
      options.push({ label: '算法输出', options: algorithmOptions });
    }
    return options;
  }, [algorithmMetricDefinitions]);

  // 只写 store，不自己 setState：写入是同步通知的，上面那条订阅会把
  // ref、编译结果和 state 一起更新。一个键一条写入路径。
  const persist = useCallback((nextDefinitions) => {
    saveFormulaCharts(matrixName, nextDefinitions);
  }, [matrixName]);

  const applyTemplate = useCallback((template) => {
    setSelectedTemplateId(template.id);
    setFormulaError('');
    form.setFieldsValue({
      ...(editingBuiltinId ? {} : { name: template.name }),
      formula: template.formula,
      unit: template.unit,
      decimals: template.decimals,
      color: template.color,
    });
  }, [editingBuiltinId, form]);

  const copyRawFrame = useCallback(async () => {
    const frame = latestFrameRef.current;
    const payload = {
      matrix: frame.matrix || {},
      frame: frame.frame || 0,
      rawData: Array.isArray(frame.rawData) ? frame.rawData : frame.values || [],
      normalizedData: Array.isArray(frame.values) ? frame.values : [],
      metrics: frame.metrics || {},
      algorithmMetrics: frame.algorithmMetrics || {},
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      messageApi.success('原始数据已复制');
    } catch {
      messageApi.error('无法复制原始数据');
    }
  }, [messageApi]);

  const formulaPreview = useMemo(() => {
    if (!watchedFormula?.trim()) return { value: null, error: '' };
    try {
      const evaluate = compileFormulaChartExpression(watchedFormula);
      return { value: evaluate(editorFrame), error: '' };
    } catch (error) {
      return { value: null, error: error.message || '公式无法解析' };
    }
  }, [editorFrame, watchedFormula]);

  const formulaMeaning = useMemo(() => {
    if (!watchedFormula?.trim()) {
      return '选择图表模板或输入公式后，这里会显示对应的中文计算含义。';
    }
    const template = FORMULA_CHART_TEMPLATES.find(
      (item) => formulasMatch(item.formula, watchedFormula)
    );
    if (template?.meaning) return template.meaning;
    try {
      return describeFormulaChartExpression(watchedFormula, {
        algorithmMetricDefinitions,
      });
    } catch {
      return '当前公式尚未完整，修正公式后会自动显示中文含义。';
    }
  }, [algorithmMetricDefinitions, watchedFormula]);

  const rawValues = Array.isArray(editorFrame.rawData)
    ? editorFrame.rawData
    : editorFrame.values || [];
  const rawFramePreview = useMemo(
    () => buildRawFramePreview(editorFrame),
    [editorFrame]
  );

  const saveEditor = useCallback(async () => {
    try {
      const values = await form.validateFields();
      const normalizedFormula = createFormulaChartFunctionSource(values.formula);
      compileFormulaChartExpression(normalizedFormula);

      if (editingBuiltinId) {
        const nextBuiltinDefinitions = builtinDefinitionsRef.current.map((item) => (
          item.id === editingBuiltinId
            ? {
              ...item,
              formula: normalizedFormula,
              unit: values.unit?.trim() || '',
              decimals: clampFormulaChartDecimals(values.decimals),
              color: values.color || DEFAULT_COLOR,
            }
            : item
        ));
        saveBuiltinDefinitions(matrixName, nextBuiltinDefinitions);
        builtinDefinitionsRef.current = nextBuiltinDefinitions;
        builtinHistoriesRef.current = {
          ...builtinHistoriesRef.current,
          [editingBuiltinId]: [],
        };
        setActiveBuiltinDefinitions(nextBuiltinDefinitions);
        onBuiltinSeriesRef.current?.({});
        setEditorOpen(false);
        setFormulaError('');
        return;
      }

      const previous = editingId
        ? definitionsRef.current.find((item) => item.id === editingId)
        : null;
      const definition = {
        id: editingId || createFormulaChartId(),
        // 改了公式也保留 templateId：零件方块靠它认人，改过公式的卡片
        // 仍然算"这个零件已经在页面上了"，不会被重复拖出第二张。
        ...(previous?.templateId ? { templateId: previous.templateId } : {}),
        name: values.name.trim(),
        formula: normalizedFormula,
        unit: values.unit?.trim() || '',
        decimals: clampFormulaChartDecimals(values.decimals),
        color: values.color || DEFAULT_COLOR,
      };
      const nextDefinitions = editingId
        ? definitionsRef.current.map((item) => (item.id === editingId ? definition : item))
        : [...definitionsRef.current, definition];
      // 公式换了，旧历史值不再是同一个量纲，清空重攒。
      customHistoriesRef.current = {
        ...customHistoriesRef.current,
        [definition.id]: [],
      };
      persist(nextDefinitions);
      setEditorOpen(false);
      setFormulaError('');
    } catch (error) {
      if (error?.errorFields) return;
      setFormulaError(error.message || '公式无法解析');
    }
  }, [editingBuiltinId, editingId, form, matrixName, persist]);

  const insertFormulaToken = useCallback((token) => {
    if (!token) return;
    const currentFormula = form.getFieldValue('formula') || '';
    try {
      const currentExpression = currentFormula.trim()
        ? extractFormulaChartExpression(currentFormula)
        : '';
      const nextExpression = `${currentExpression}${currentExpression ? ' ' : ''}${token}`;
      form.setFieldValue('formula', createFormulaChartFunctionSource(nextExpression));
    } catch (error) {
      setFormulaError(error.message || '计算函数格式不正确');
      return;
    }
    setFormulaError('');
    setSelectedTemplateId(null);
  }, [form]);

  const editingBuiltin = editingBuiltinId
    ? activeBuiltinDefinitions.find((definition) => definition.id === editingBuiltinId)
    : null;
  const isEditing = Boolean(editingId || editingBuiltinId);
  const rawRows = Number(editorFrame.matrix?.rows ?? editorFrame.matrix?.height) || 0;
  const rawCols = Number(editorFrame.matrix?.cols ?? editorFrame.matrix?.width) || 0;

  return (
    <>
      {messageContext}
      {/* 常显入口。图表卡片本身已经搬到 Aside 上和 Pressure Area 并列，
          这里只留"再建一张"的按钮 —— 满 6 张时按钮仍在，点了给上限提示。 */}
      <div className="formulaChartLauncher">
        <Tooltip title="创建基于实时传感器数据的公式图表">
          <Button
            icon={<PlusOutlined />}
            onClick={openCreate}
            size="small"
            type="text"
          >
            添加公式图表
          </Button>
        </Tooltip>
      </div>

      <Modal
        cancelText="取消"
        className="formulaChartEditorModal"
        forceRender
        okText={isEditing ? '保存' : '创建'}
        onCancel={() => setEditorOpen(false)}
        onOk={saveEditor}
        open={editorOpen}
        title={editingBuiltin
          ? `编辑 ${editingBuiltin.name} 图表`
          : editingId
            ? '编辑公式图表'
            : '新建公式图表'}
        width={900}
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <section className="formulaTemplateSection">
            <div className="formulaEditorSectionHeading">
              <AppstoreOutlined />
              <strong>图表模板</strong>
            </div>
            <div
              aria-label="公式图表模板"
              className="formulaTemplateGrid"
              role="radiogroup"
            >
              {FORMULA_CHART_TEMPLATES.map((template) => (
                <button
                  aria-checked={selectedTemplateId === template.id}
                  className={selectedTemplateId === template.id
                    ? 'formulaTemplateCard is-selected'
                    : 'formulaTemplateCard'}
                  key={template.id}
                  onClick={() => applyTemplate(template)}
                  role="radio"
                  type="button"
                >
                  <svg aria-hidden="true" preserveAspectRatio="none" viewBox="0 0 100 32">
                    <line x1="0" x2="100" y1="29" y2="29" />
                    <path
                      d={buildSparklinePath(template.preview, 100, 32)}
                      fill="none"
                      stroke={template.color}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                    />
                  </svg>
                  <span>
                    <strong>{template.name}</strong>
                    <small>{template.description}</small>
                  </span>
                </button>
              ))}
            </div>
          </section>

          <div className="formulaEditorWorkbench">
            <div className="formulaEditorFields">
              <div className="formulaEditorSectionHeading">
                <CodeOutlined />
                <strong>计算函数</strong>
              </div>
              <Form.Item
                label="图表名称"
                name="name"
                rules={[{ required: true, message: '请输入图表名称' }]}
              >
                <Input
                  disabled={Boolean(editingBuiltin)}
                  maxLength={30}
                  placeholder="例如：压力系数"
                />
              </Form.Item>
              <div className={formulaPreview.error
                ? 'formulaMeaningPanel is-error'
                : 'formulaMeaningPanel'}
              >
                <div className="formulaMeaningLabel">
                  <BulbOutlined />
                  <span>中文计算方式</span>
                </div>
                <p>{formulaMeaning}</p>
              </div>
              <Form.Item
                help={formulaError || undefined}
                label="计算函数"
                name="formula"
                rules={[{ required: true, message: '请输入计算函数' }]}
                validateStatus={formulaError ? 'error' : undefined}
              >
                <Input.TextArea
                  autoSize={{ minRows: 4, maxRows: 9 }}
                  className="formulaCodeEditor"
                  onChange={() => {
                    setFormulaError('');
                    setSelectedTemplateId(null);
                  }}
                  placeholder={'function calculate() {\n  return sum();\n}'}
                  spellCheck={false}
                />
              </Form.Item>
              <Form.Item label="插入数据项或函数">
                <Select
                  onChange={insertFormulaToken}
                  options={insertOptions}
                  placeholder="按中文名称选择"
                  popupClassName="formulaTokenSelectDropdown"
                  suffixIcon={<FunctionOutlined />}
                  value={null}
                />
              </Form.Item>
              <div className={formulaPreview.error
                ? 'formulaCodeResult is-error'
                : 'formulaCodeResult'}
              >
                <span>当前帧结果</span>
                <strong>
                  {formulaPreview.error
                    ? formulaPreview.error
                    : formulaPreview.value == null
                      ? '--'
                      : formatValue(formulaPreview.value, form.getFieldValue('decimals'))}
                </strong>
              </div>
              <div className="formulaChartEditorRow">
                <Form.Item label="单位" name="unit">
                  <Input maxLength={12} placeholder="可选" />
                </Form.Item>
                <Form.Item label="小数位" name="decimals">
                  <InputNumber max={6} min={0} precision={0} />
                </Form.Item>
                <Form.Item label="曲线颜色" name="color">
                  <Input className="formulaChartColorInput" type="color" />
                </Form.Item>
              </div>
            </div>

            <aside className="formulaRawDataPanel">
              <div className="formulaRawDataHeading">
                <div className="formulaEditorSectionHeading">
                  <DatabaseOutlined />
                  <strong>串口解码原始数据</strong>
                </div>
                <Tooltip title="复制完整原始数据与统计数据">
                  <Button
                    aria-label="复制完整原始数据"
                    disabled={!rawValues.length}
                    icon={<CopyOutlined />}
                    onClick={copyRawFrame}
                    size="small"
                    type="text"
                  />
                </Tooltip>
              </div>
              <dl className="formulaRawDataStats">
                <div><dt>矩阵</dt><dd>{rawRows && rawCols ? `${rawRows} × ${rawCols}` : '--'}</dd></div>
                <div><dt>点数</dt><dd>{rawValues.length}</dd></div>
                <div><dt>帧序号</dt><dd>{editorFrame.frame || 0}</dd></div>
              </dl>
              <pre>{rawFramePreview}</pre>
              <span className="formulaRawDataFootnote">
                {rawValues.length > RAW_PREVIEW_LIMIT
                  ? `预览前 ${RAW_PREVIEW_LIMIT} 点，复制可获得全部 ${rawValues.length} 点`
                  : `${rawValues.length} 个原始数据点`}
              </span>
              <span className="formulaRawDataFootnote">
                旧传感器未提供 rawData 时回退到标准矩阵。
              </span>
            </aside>
          </div>
        </Form>
      </Modal>
    </>
  );
});

export default FormulaChartPanel;
