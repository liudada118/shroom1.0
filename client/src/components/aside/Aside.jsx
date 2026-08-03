import React from 'react'
import './aside.scss'
import { Button, Popconfirm, Tooltip } from 'antd'
import { DeleteOutlined, EditOutlined } from '@ant-design/icons'
import { CanvasDemo } from '../chart/Chart'
import FormulaChartPanel from './FormulaChartPanel'
import {
    drawChartDecorations,
    drawChartGrid,
    resolveChartStroke,
} from './chartAppearance'
import {
    formulaChartStorageKey,
    loadFormulaCharts,
    removeFormulaChart,
    subscribeFormulaCharts,
} from './formulaChartStore'
import { PART_DRAG_TYPE } from '../displaySystem/canvasConfigurator/canvasParts'
import { withTranslation } from 'react-i18next'
import dropBed from '../../assets/images/dropBed.png'
import offBed from '../../assets/images/offBed.png'
import onBed from '../../assets/images/onBed.png'
import sitBed from '../../assets/images/sitBed.png'



const dataArr1 = [
    {
        color: '#2A99FF',
        data: '平均压力',
        eng: 'Mean Pres'
    }, {
        color: '#FF2A2A',
        data: '最大压力',
        eng: 'Max Pres'
    },
    {
        color: '#FFA63F',
        data: '点数',
        eng: 'Points'
    },
    {
        color: '#2A99FF',
        data: '面积',
        eng: 'Area'
    }
]


class Com extends React.Component {
    constructor(props) {
        super(props)
    }
    shouldComponentUpdate(nextProps, nextState) {
        return false
    }
    render() {
        return (
            <>{this.props.children}</>
        )
    }
}

const arr = ['meanPres', 'maxPres', 'totalPres', 'presStan']
const arrArea = ['point', 'area',]
const footArr = ['meanPres', 'maxPres', 'point', 'area',]
const CONFIGURABLE_METRICS = {
    totalPressure: { key: 'totalPres', label: '总压力', eng: 'Total Pressure', color: '#F05D5E', decimals: 2 },
    averagePressure: { key: 'meanPres', label: '平均压力', eng: 'Average Pressure', color: '#2A99FF', decimals: 2 },
    maxPressure: { key: 'maxPres', label: '最大压力', eng: 'Maximum Pressure', color: '#FF2A2A', decimals: 2 },
    activePoints: { key: 'point', label: '有效点数', eng: 'Active Points', color: '#FFA63F', decimals: 0, unit: '个' },
    area: { key: 'area', label: '受压面积', eng: 'Pressure Area', color: '#20B486', decimals: 2 },
}
const BUILTIN_FORMULA_CHARTS = [
    {
        id: 'pressure',
        name: 'Pressure Data',
        formula: 'total',
        unit: '',
        decimals: 2,
        color: '#991BFA',
    },
    {
        id: 'area',
        name: 'Pressure Area',
        formula: 'points',
        unit: '',
        decimals: 0,
        color: '#20B486',
    },
]
let ctx1, ctx2, ctx3

/**
 * 把公式结果压成卡片上显示的那个数字。
 *
 * @param {unknown} value 公式算出的值。
 * @param {number} [decimals] 小数位。
 * @returns {string} 显示文本。
 */
function formatFormulaChartValue(value, decimals = 2) {
    const numeric = Number(value)
    return Number.isFinite(numeric) ? numeric.toFixed(decimals) : '--'
}
const PET_CARE_IN_BED_POSTURE_STATES = new Set([1, 2, 3])
const PET_CARE_MONITOR_TYPES = new Set(['petCare', 'petCareMini'])
const PET_CARE_REALTIME_FIELDS = [
    'heart_rate',
    'breath_rate',
    'posture_state',
    'petInBed',
    'quality',
    'pressure_coefficient',
    'is_motion',
    'snr_db',
    'onBedTime',
    'bed_exit_flag',
]

function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v))
}

function rand(min, max) {
    return min + Math.random() * (max - min)
}

function randProb(p) {
    return Math.random() < p
}

function gaussian(mean, std) {
    let u1
    do {
        u1 = Math.random()
    } while (u1 === 0)
    const u2 = Math.random()
    const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2)
    return mean + z * std
}

function createPetHeartRateSimulatorState() {
    return {
        breathPhase: 0,
        rsaAmp: 3.5,
        trendHR: 70,
        trendRR: 14,
        event: 0,
        lastHeartRate: 0,
        lastHeartRateAt: 0,
    }
}

function resetPetHeartRateSimulatorState(simulator) {
    simulator.breathPhase = 0
    simulator.rsaAmp = 3.5
    simulator.trendHR = 70
    simulator.trendRR = 14
    simulator.event = 0
    simulator.lastHeartRate = 0
    simulator.lastHeartRateAt = 0
}

function nextPetHeartRate(rr, simulator) {
    if (rr === 0) {
        return 0
    }

    const dt = 1.0
    simulator.breathPhase += 2 * Math.PI * rr / 60.0 * dt
    simulator.rsaAmp += rand(-0.05, 0.05)
    simulator.rsaAmp = clamp(simulator.rsaAmp, 2, 6)

    const rsa = Math.sin(simulator.breathPhase - 1.0) * simulator.rsaAmp
    const base = 65 + (rr - 12) * 1.5

    simulator.trendHR += rand(-0.1, 0.1)
    simulator.trendHR = clamp(simulator.trendHR, 60, 80)

    if (randProb(0.003)) {
        simulator.event = rand(5, 12)
    }
    simulator.event *= 0.95

    const noise = gaussian(0, 1)
    const hr = base * 0.4 + simulator.trendHR * 0.6 + rsa + simulator.event + noise

    return clamp(Math.round(hr), 55, 100)
}

function resolvePetInBed(data) {
    if (data?.petInBed != null) {
        return Number(data.petInBed)
    }

    const postureState = Number(data?.posture_state)
    if (Number.isFinite(postureState) && postureState >= 0 && postureState <= 3) {
        return PET_CARE_IN_BED_POSTURE_STATES.has(postureState) ? 1 : 0
    }

    return null
}

function normalizeMiniPetCareAsideData(matrixName, data) {
    if (matrixName !== 'petCareMini' || !data) {
        return data
    }

    const petInBed = resolvePetInBed(data)
    if (petInBed !== 0) {
        return data
    }

    return {
        ...data,
        pressure_coefficient: 0,
    }
}

function resolvePetRespirationForHeartRate(data) {
    const petInBed = resolvePetInBed(data)
    const postureState = Number(data?.posture_state)
    const breathRate = Number(data?.breath_rate)

    if (petInBed !== 1 || postureState !== 2 || !Number.isFinite(breathRate) || breathRate <= 0) {
        return 0
    }

    return breathRate
}

function normalizePetCareHeartRateAsideData(matrixName, data, baseState, simulator) {
    if (!PET_CARE_MONITOR_TYPES.has(matrixName) || !data) {
        return data
    }

    const hasPetCareRealtimeField = PET_CARE_REALTIME_FIELDS.some((field) => data[field] !== undefined)
    if (!hasPetCareRealtimeField) {
        return data
    }

    if (data.heart_rate !== undefined) {
        return data
    }

    const mergedState = {
        ...baseState,
        ...data,
    }
    const respiration = resolvePetRespirationForHeartRate(mergedState)

    if (respiration === 0) {
        resetPetHeartRateSimulatorState(simulator)
        return {
            ...data,
            heart_rate: 0,
        }
    }

    const now = Date.now()
    if (simulator.lastHeartRateAt && now - simulator.lastHeartRateAt < 1000) {
        return {
            ...data,
            heart_rate: simulator.lastHeartRate,
        }
    }

    const nextHeartRate = nextPetHeartRate(respiration, simulator)
    simulator.lastHeartRate = nextHeartRate
    simulator.lastHeartRateAt = now

    return {
        ...data,
        heart_rate: nextHeartRate,
    }
}

class Aside extends React.Component {

    constructor() {
        super()
        this.state = {
            totalPres: 0,
            meanPres: 0,
            minPres: 0,
            point: 0,
            maxPres: 0,
            area: 0,
            pressure: 0,
            presStan: 0,
            pressMult: localStorage.getItem("valueMult")
                ? JSON.parse(localStorage.getItem("valueMult"))
                : 1,
            fontSize: 1,
            // jqbed 健康监测状态
            rate: '--',
            heart_rate: '--',
            stateInBbed: null,
            sosflag: 0,
            onBedTime: 0,
            breath_rate: '--',
            posture_state: null,
            is_motion: 0,
            snr_db: '--',
            quality: '--',
            bed_exit_flag: 0,
            pressure_coefficient: '--',
            petInBed: null,
            temperatureData: [],
            temperatureAvg: '--',
            algorithmMetrics: {},
            // 从零件栏拖出来的图表卡片。真相在 formulaChartStore 里，这里只是它的镜像；
            // 构造函数拿不到 props（super() 没传），所以在 componentDidMount 里首次装载。
            customCharts: [],
            customChartValues: {},
        }
        this.canvas = React.createRef()
        this.formulaCharts = React.createRef()
        this._builtinFormulaSeries = {}
        this._customFormulaSeries = {}
        // 自定义卡片的画布按 id 存在 Map 里，而不是再往 ctx1/ctx2/ctx3 那套
        // 模块级变量上添人：卡片数量是变的，getElementById 那条路撑不住。
        this._customChartTargets = new Map()
        this._unsubscribeFormulaCharts = null
        this.handleBuiltinFormulaSeries = this.handleBuiltinFormulaSeries.bind(this)
        this.handleCustomFormulaSeries = this.handleCustomFormulaSeries.bind(this)
        this.handleFormulaChartsChanged = this.handleFormulaChartsChanged.bind(this)
        this._petHeartRateSimulator = createPetHeartRateSimulatorState()

        // ========== 10Hz 节流控制 ==========
        this._ASIDE_INTERVAL = 100; // 100ms = 10Hz
        this._lastDataTime = 0;
        this._pendingData = null;
        this._dataTimer = null;
        this._lastChartTime = 0;
        this._pendingChart = null;
        this._chartTimer = null;
        this._lastAreaTime = 0;
        this._pendingArea = null;
        this._areaTimer = null;
        this._lastBodyTime = 0;
        this._pendingBody = null;
        this._bodyTimer = null;
    }

    changePressMult(value) {
        this.setState({
            pressMult: value
        })
    }

    /**
     * 将串口原始数据、标准矩阵和统计指标推送给用户公式图表。
     */
    updateFormulaCharts(values = [], metrics = {}, algorithmMetrics = {}, rawData = values) {
        this.formulaCharts.current?.pushFrame({
            values,
            rawData,
            metrics,
            algorithmMetrics,
            matrix: this.props.matrixShape,
        })
    }

    /**
     * 接收两张内置图表的公式历史，并立即刷新当前可见画布。
     */
    handleBuiltinFormulaSeries(series = {}) {
        this._builtinFormulaSeries = series
        this.drawFormulaAwareChart('pressure')
        this.drawFormulaAwareChart('area')
    }

    /**
     * 接收自定义图表的公式历史。和内置那条通路一模一样：存下来、立刻重画。
     *
     * 卡片上的当前数值进 state（Aside 本来就以 10Hz 刷新读数，同一批里多一个字段
     * 不额外增加渲染次数），曲线走 canvas，不进 React。
     */
    handleCustomFormulaSeries(series = {}) {
        this._customFormulaSeries = series
        this.drawCustomCharts()
        const customChartValues = {}
        Object.keys(series).forEach((id) => {
            customChartValues[id] = series[id]?.latest
        })
        this.setState({ customChartValues })
    }

    /**
     * store 里的图表清单变了（零件栏加了一张、卡片上删了一张、弹窗改了公式）。
     * 只认自己这个展示系统的那把键。
     */
    handleFormulaChartsChanged(matrixName, definitions) {
        if (formulaChartStorageKey(matrixName) !== formulaChartStorageKey(this.props.matrixName)) return
        this.setState({ customCharts: definitions })
    }

    /**
     * 记住某张自定义卡片的画布。ref 回调传 null 表示卡片被卸载了。
     */
    setCustomChartTarget(id, node) {
        if (!node) {
            this._customChartTargets.delete(id)
            return
        }
        this._customChartTargets.set(id, { canvas: node, ctx: node.getContext('2d') })
        // 卡片刚挂上来时可能已经攒了一段历史（拖零件的这一瞬间数据没停），
        // 立刻补一笔，不然要等到下一帧才出现曲线。
        this.drawCustomChart(id)
    }

    /**
     * 把一张自定义图表的曲线画到它自己的画布上。
     */
    drawCustomChart(id) {
        const target = this._customChartTargets.get(id)
        if (!target) return
        const drawInput = this.buildFormulaDrawInput(this._customFormulaSeries?.[id])
        if (!drawInput) return
        this.drawChart({ ctx: target.ctx, canvas: target.canvas, ...drawInput })
    }

    /**
     * 重画全部自定义图表。
     */
    drawCustomCharts() {
        this._customChartTargets.forEach((target, id) => this.drawCustomChart(id))
    }

    /**
     * 打开指定内置图表的公式编辑器。
     */
    openBuiltinFormulaEditor(kind) {
        this.formulaCharts.current?.openBuiltinEditor(kind)
    }

    /**
     * 打开某张自定义图表的公式编辑器。
     */
    openCustomFormulaEditor(id) {
        this.formulaCharts.current?.openEdit(id)
    }

    /**
     * 把卡片拖回底部零件栏就删除它，和画布组件"拖出画布"的语义一致。
     */
    handleCustomChartDragStart(event, definition) {
        const payload = JSON.stringify({ kind: 'placedChartWidget', id: definition.id })
        event.dataTransfer.setData(PART_DRAG_TYPE, payload)
        event.dataTransfer.setData('text/plain', payload)
        event.dataTransfer.effectAllowed = 'move'
    }

    /**
     * 渲染从零件栏拖出来的图表卡片。
     *
     * 结构和 Pressure Data / Pressure Area 完全一样（标题 + 当前值 + 150px 画布），
     * 曲线也走同一个 `drawChart`，所以图表配色和四个叠加层零件对它一并生效。
     */
    renderCustomChartCards() {
        const charts = this.state.customCharts
        if (!Array.isArray(charts) || !charts.length) return null
        return charts.map((definition) => {
            const openEditor = () => this.openCustomFormulaEditor(definition.id)
            return (
                <div
                    className="asideContent firstAside customChartCard"
                    draggable
                    key={definition.id}
                    onDragStart={(event) => this.handleCustomChartDragStart(event, definition)}
                >
                    <div className="builtinChartHeading">
                        <h2 className="asideTitle">{definition.name}</h2>
                        <div className="customChartActions">
                            <Tooltip title={`编辑 ${definition.name} 公式`}>
                                <Button
                                    aria-label={`编辑 ${definition.name} 公式`}
                                    icon={<EditOutlined />}
                                    onClick={openEditor}
                                    shape="circle"
                                    size="small"
                                    type="text"
                                />
                            </Tooltip>
                            <Popconfirm
                                cancelText="取消"
                                okText="删除"
                                onConfirm={() => removeFormulaChart(this.props.matrixName, definition.id)}
                                title={`删除“${definition.name}”？`}
                            >
                                <Tooltip title="删除图表">
                                    <Button
                                        aria-label={`删除 ${definition.name}`}
                                        danger
                                        icon={<DeleteOutlined />}
                                        shape="circle"
                                        size="small"
                                        type="text"
                                    />
                                </Tooltip>
                            </Popconfirm>
                        </div>
                    </div>
                    <span className='pressData'>
                        {formatFormulaChartValue(
                            this.state.customChartValues?.[definition.id],
                            definition.decimals
                        )}
                    </span>
                    {definition.unit ? <span style={{ color: '#999' }}> {definition.unit}</span> : null}
                    <canvas
                        aria-label={`编辑 ${definition.name} 公式`}
                        className="editableBuiltinChart"
                        onClick={openEditor}
                        onKeyDown={(event) => {
                            if (event.key !== 'Enter' && event.key !== ' ') return
                            event.preventDefault()
                            openEditor()
                        }}
                        ref={(node) => this.setCustomChartTarget(definition.id, node)}
                        role="button"
                        style={{ height: `${150 * this.state.fontSize}px`, width: '100%' }}
                        tabIndex={0}
                    />
                </div>
            )
        })
    }

    /**
     * 为内置图表标题提供统一的编辑入口。
     */
    renderBuiltinChartHeading(title, kind) {
        return (
            <div className="builtinChartHeading">
                <h2 className="asideTitle">{title}</h2>
                <Tooltip title={`编辑 ${title} 公式`}>
                    <Button
                        aria-label={`编辑 ${title} 图表公式`}
                        icon={<EditOutlined />}
                        onClick={() => this.openBuiltinFormulaEditor(kind)}
                        shape="circle"
                        size="small"
                        type="text"
                    />
                </Tooltip>
            </div>
        )
    }

    /**
     * 渲染可点击编辑公式的旧版 Canvas 图表。
     */
    renderBuiltinChartCanvas(kind, style) {
        const title = kind === 'pressure' ? 'Pressure Data' : 'Pressure Area'
        const canvasId = kind === 'pressure' ? 'myChart1' : 'myChart2'
        const openEditor = () => this.openBuiltinFormulaEditor(kind)
        return (
            <canvas
                aria-label={`编辑 ${title} 图表公式`}
                className="editableBuiltinChart"
                id={canvasId}
                onClick={openEditor}
                onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return
                    event.preventDefault()
                    openEditor()
                }}
                role="button"
                style={style}
                tabIndex={0}
            />
        )
    }

    componentDidMount() {

        this.setState({
            fontSize: window.innerWidth / 1920
        })

        var c = document.getElementById("myChart1");
        if (c) ctx1 = c.getContext("2d");

        var c1 = document.getElementById("myChart2");
        if (c1) ctx2 = c1.getContext("2d");

        var c2 = document.getElementById("myChart3");
        if (c2) ctx3 = c2.getContext("2d");

        // 图表卡片清单的主人是 store：零件栏在 Home 里加、卡片上删、弹窗里改，
        // 三条路都从这条订阅回到侧栏。Aside 绝不能重挂（它持有全部实时读数），
        // 所以自己订阅，而不是让 Home 用 props 把清单灌进来。
        this.setState({ customCharts: loadFormulaCharts(this.props.matrixName) })
        this._unsubscribeFormulaCharts = subscribeFormulaCharts(this.handleFormulaChartsChanged)

        // jqbed 在床/离床计时 - 由后端 server.js 计算并通过 WebSocket 发送
    }

    componentDidUpdate(prevProps) {
        var c = document.getElementById("myChart1");
        if (c) ctx1 = c.getContext("2d");

        var c1 = document.getElementById("myChart2");
        if (c1) ctx2 = c1.getContext("2d");

        var c2 = document.getElementById("myChart3");
        if (c2) ctx3 = c2.getContext("2d");

        // 曲线是在收到数据时才重画的，换了图表零件却没有新数据进来（暂停、
        // 回放停在某一帧）时画面会一直停在旧外观上。用上一帧缓存立刻重画一次。
        if (prevProps?.chartAppearance !== this.props.chartAppearance) {
            this.drawFormulaAwareChart('pressure', this._pendingChart || null)
            this.drawFormulaAwareChart('area', this._pendingArea || null)
            this.drawCustomCharts()
        }

        // 换了传感器/展示系统就换一份清单：卡片按 matrixName 各自独立，
        // 上一个系统的图表不该跟过来。
        if (prevProps?.matrixName !== this.props.matrixName) {
            this._customFormulaSeries = {}
            this.setState({
                customCharts: loadFormulaCharts(this.props.matrixName),
                customChartValues: {},
            })
        }
    }

    componentWillUnmount() {
        if (this._dataTimer) clearTimeout(this._dataTimer);
        if (this._chartTimer) clearTimeout(this._chartTimer);
        if (this._areaTimer) clearTimeout(this._areaTimer);
        if (this._bodyTimer) clearTimeout(this._bodyTimer);
        if (this._unsubscribeFormulaCharts) {
            this._unsubscribeFormulaCharts()
            this._unsubscribeFormulaCharts = null
        }
    }

    /**
     * 把一条公式序列翻成 `drawChart` 的入参。
     *
     * 内置和自定义图表共用这一段：公式的量纲是任意的（可能是总压力，也可能是
     * 有效点占比），所以一律 normalize 到画布高度，`max` 只作为兜底。
     *
     * @param {{values?: number[], definition?: object} | null} series 公式序列。
     * @returns {object | null} drawChart 的入参；序列为空时返回 null。
     */
    buildFormulaDrawInput(series) {
        if (!Array.isArray(series?.values) || !series.values.length) return null
        const values = series.values.map((value) => {
            const numeric = Number(value)
            return Number.isFinite(numeric) ? numeric : 0
        })
        const max = values.reduce(
            (currentMax, value) => Math.max(currentMax, Math.abs(value)),
            1
        )
        return {
            arr: values,
            color: series.definition?.color || '#991BFA',
            index: null,
            max,
            normalize: true,
        }
    }

    /**
     * 优先返回用户配置后的内置公式序列。
     */
    getBuiltinFormulaDrawInput(kind) {
        return this.buildFormulaDrawInput(this._builtinFormulaSeries?.[kind])
    }

    /**
     * 将内置公式曲线画到原有 Pressure Canvas 上。
     */
    drawFormulaAwareChart(kind, fallback = null) {
        const drawInput = this.getBuiltinFormulaDrawInput(kind) || fallback
        if (!drawInput) return
        const canvasId = kind === 'pressure' ? 'myChart1' : 'myChart2'
        const canvas = document.getElementById(canvasId)
        if (!canvas) return
        const context = kind === 'pressure' ? ctx1 : ctx2
        this.drawChart({
            ctx: context || canvas.getContext('2d'),
            canvas,
            ...drawInput,
        })
    }

    drawChart({
        ctx,
        arr,
        max,
        canvas,
        index,
        color = '#991BFA',
        normalize = false,
    }) {
        if (!ctx || !canvas || !Array.isArray(arr) || arr.length === 0) return
        // 清空画布
        const numericValues = arr.map((value) => {
            const numeric = Number(value)
            return Number.isFinite(numeric) ? numeric : 0
        })
        let min = Math.min(...numericValues)
        let realMax = Math.max(...numericValues)
        let data
        if (normalize) {
            const padding = Math.max(6, canvas.height * 0.08)
            const range = realMax - min
            data = range === 0
                ? numericValues.map(() => canvas.height / 2)
                : numericValues.map(
                    (value) => padding + ((value - min) / range) * (canvas.height - padding * 2)
                )
        } else if (this.props.matrixName == 'yanfeng10') {
            let res = numericValues.map((a) => a - min + 10)
            data = res.map((a) => a * 150 * this.state.fontSize / (realMax - min + 20))
        } else {
            const safeMax = Number(max) > 0 ? Number(max) : Math.max(Math.abs(realMax), 1)
            data = numericValues.map((a) => a * 150 / safeMax)
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 计算数据点之间的间距
        var gap = canvas.width / (data.length + 1);

        // 用户拖进零件栏的图表外观。没选过任何零件时 appearance 是
        // { classic, [] }，下面每一步都退回原来那条通路，观感零变化。
        const appearance = this.props.chartAppearance
        const overlays = appearance?.overlays
        // 网格必须在曲线之前画，否则会盖在曲线上面。
        drawChartGrid(ctx, { width: canvas.width, height: canvas.height, overlays })

        // 绘制曲线
        ctx.beginPath();
        ctx.setLineDash([]);
        ctx.moveTo(gap, canvas.height - data[0]);

        for (var i = 1; i < data.length - 2; i++) {
            var xMid = (gap * (i + 1) + gap * (i + 2)) / 2;
            var yMid = (canvas.height - data[i + 1] + canvas.height - data[i + 2]) / 2;
            ctx.quadraticCurveTo(gap * (i + 1), canvas.height - data[i + 1], xMid, yMid);
        }

        // 连接最后两个数据点
        ctx.quadraticCurveTo(
            gap * (data.length - 1),
            canvas.height - data[data.length - 1],
            gap * data.length,
            canvas.height - data[data.length - 1]
        );

        // 设置曲线样式
        ctx.strokeStyle = resolveChartStroke(ctx, {
            height: canvas.height,
            colormap: appearance?.colormap,
            fallbackColor: color,
        });
        ctx.lineWidth = 2;
        ctx.stroke();

        drawChartDecorations(ctx, {
            width: canvas.width,
            height: canvas.height,
            overlays,
            data,
            gap,
            values: numericValues,
            color,
        });

        // 测试文字
        if (index != null) {
            ctx.beginPath();
            ctx.moveTo(gap * (index), canvas.height);
            ctx.lineTo(gap * (index), 0);
            ctx.strokeStyle = "#01F1E3";
            ctx.lineWidth = 2;
            ctx.setLineDash([3, 3]);
            ctx.stroke();

            ctx.font = "48px serif";
            ctx.fillStyle = '#01F1E3'
        }

    }

    handleCharts(arr, max, index) {
        const now = performance.now();
        this._pendingChart = { arr, max, index };
        if (now - this._lastChartTime >= this._ASIDE_INTERVAL) {
            this._lastChartTime = now;
            this.drawFormulaAwareChart('pressure', { arr, max, index });
            if (this._chartTimer) { clearTimeout(this._chartTimer); this._chartTimer = null; }
        } else if (!this._chartTimer) {
            this._chartTimer = setTimeout(() => {
                this._lastChartTime = performance.now();
                if (this._pendingChart) {
                    const { arr: a, max: m, index: i } = this._pendingChart;
                    this.drawFormulaAwareChart('pressure', { arr: a, max: m, index: i });
                }
                this._chartTimer = null;
            }, this._ASIDE_INTERVAL - (now - this._lastChartTime));
        }
    }

    handleChartsArea(arr, max, index) {
        const now = performance.now();
        this._pendingArea = { arr, max, index };
        if (now - this._lastAreaTime >= this._ASIDE_INTERVAL) {
            this._lastAreaTime = now;
            this.drawFormulaAwareChart('area', { arr, max, index });
            if (this._areaTimer) { clearTimeout(this._areaTimer); this._areaTimer = null; }
        } else if (!this._areaTimer) {
            this._areaTimer = setTimeout(() => {
                this._lastAreaTime = performance.now();
                if (this._pendingArea) {
                    const { arr: a, max: m, index: i } = this._pendingArea;
                    this.drawFormulaAwareChart('area', { arr: a, max: m, index: i });
                }
                this._areaTimer = null;
            }, this._ASIDE_INTERVAL - (now - this._lastAreaTime));
        }
    }

    handleChartsBody(arr, max, index) {
        const now = performance.now();
        this._pendingBody = { arr, max, index };
        if (now - this._lastBodyTime >= this._ASIDE_INTERVAL) {
            this._lastBodyTime = now;
            const canvas = document.getElementById('myChart3');
            if (canvas) this.drawChart({ ctx: ctx3, arr, max, canvas, index });
            if (this._bodyTimer) { clearTimeout(this._bodyTimer); this._bodyTimer = null; }
        } else if (!this._bodyTimer) {
            this._bodyTimer = setTimeout(() => {
                this._lastBodyTime = performance.now();
                if (this._pendingBody) {
                    const { arr: a, max: m, index: i } = this._pendingBody;
                    const canvas = document.getElementById('myChart3');
                    if (canvas) this.drawChart({ ctx: ctx3, arr: a, max: m, canvas, index: i });
                }
                this._bodyTimer = null;
            }, this._ASIDE_INTERVAL - (now - this._lastBodyTime));
        }
    }

    initCharts() {
        const canvas = document.getElementById('myChart1')
        if (ctx1 && canvas) {
            ctx1.clearRect(0, 0, canvas.width, canvas.height);
        }
        const canvas1 = document.getElementById('myChart2')
        if (ctx2) {
            ctx2.clearRect(0, 0, canvas1.width, canvas1.height);
        }

        const canvas2 = document.getElementById('myChart3')
        if (ctx3) {
            ctx3.clearRect(0, 0, canvas2.width, canvas2.height);
        }
    }

    changeData(obj) {
        const baseRealtimeState = {
            ...this.state,
            ...(this._pendingData || {}),
        }
        const miniNormalizedObj = normalizeMiniPetCareAsideData(this.props.matrixName, obj)
        const normalizedObj = normalizePetCareHeartRateAsideData(
            this.props.matrixName,
            miniNormalizedObj,
            baseRealtimeState,
            this._petHeartRateSimulator
        )
        // 处理 jqbed 健康监测数据
        if (normalizedObj.stateInBbed !== undefined) {
            const prevState = this.state.stateInBbed
            const newState = normalizedObj.stateInBbed
            // 状态变化时重置计时（由后端处理，前端只展示）
        }
        const now = performance.now();
        this._pendingData = {
            ...(this._pendingData || {}),
            ...normalizedObj,
        };

        if (!this.props.sidebarConfig) {
            const formulaState = {
                ...baseRealtimeState,
                ...normalizedObj,
            }
            this.updateFormulaCharts([], {
                totalPressure: formulaState.totalPres,
                averagePressure: formulaState.meanPres,
                maxPressure: formulaState.maxPres,
                activePoints: formulaState.point,
                area: formulaState.area,
            }, formulaState.algorithmMetrics)
        }

        const hasRealtimeDetectionData =
            normalizedObj.rate !== undefined ||
            normalizedObj.heart_rate !== undefined ||
            normalizedObj.stateInBbed !== undefined ||
            normalizedObj.sosflag !== undefined ||
            normalizedObj.onBedTime !== undefined ||
            normalizedObj.breath_rate !== undefined ||
            normalizedObj.posture_state !== undefined ||
            normalizedObj.is_motion !== undefined ||
            normalizedObj.snr_db !== undefined ||
            normalizedObj.quality !== undefined ||
            normalizedObj.bed_exit_flag !== undefined ||
            normalizedObj.pressure_coefficient !== undefined ||
            normalizedObj.petInBed !== undefined ||
            normalizedObj.temperatureData !== undefined ||
            normalizedObj.temperatureAvg !== undefined;

        if (hasRealtimeDetectionData) {
            this._lastDataTime = now;
            const nextData = this._pendingData;
            this.setState(nextData);
            this._pendingData = null;
            if (this._dataTimer) { clearTimeout(this._dataTimer); this._dataTimer = null; }
            return;
        }

        if (now - this._lastDataTime >= this._ASIDE_INTERVAL) {
            this._lastDataTime = now;
            const nextData = this._pendingData;
            this.setState(nextData);
            this._pendingData = null;
            if (this._dataTimer) { clearTimeout(this._dataTimer); this._dataTimer = null; }
        } else if (!this._dataTimer) {
            this._dataTimer = setTimeout(() => {
                this._lastDataTime = performance.now();
                if (this._pendingData) {
                    this.setState(this._pendingData);
                    this._pendingData = null;
                }
                this._dataTimer = null;
            }, this._ASIDE_INTERVAL - (now - this._lastDataTime));
        }
    }

    getConfiguredMetric(metricId = '', sidebar, areaUnit) {
        if (metricId.startsWith('algorithm.')) {
            const id = metricId.slice(10)
            const definition = (sidebar.algorithmMetrics || []).find((metric) => metric.id === id)
            if (!definition) return null
            return {
                label: definition.label || id,
                eng: `Algorithm · ${id}`,
                color: '#B88AF2',
                decimals: definition.decimals ?? 2,
                unit: definition.unit || '',
                value: this.state.algorithmMetrics?.[id],
            }
        }
        const metric = CONFIGURABLE_METRICS[metricId]
        if (!metric) return null
        return {
            ...metric,
            unit: metricId === 'area' ? areaUnit : metric.unit,
            value: this.state[metric.key],
        }
    }

    formatConfiguredMetricValue(value, decimals) {
        const numeric = Number(value)
        if (value !== '' && value !== null && value !== undefined && Number.isFinite(numeric)) {
            return numeric.toFixed(decimals)
        }
        return value === null || value === undefined || value === '' ? '--' : String(value)
    }

    renderConfiguredMetric(metricId, sidebar, areaUnit) {
        const metric = this.getConfiguredMetric(metricId, sidebar, areaUnit)
        if (!metric) return null
        const value = this.formatConfiguredMetricValue(metric.value, metric.decimals)
        return (
            <div className='dataItem' key={metricId}>
                <div className='dataItemCircle'>
                    <div className='circleItem' style={{ backgroundColor: metric.color }}></div>
                    <div>{metric.label}</div>
                </div>
                <div className='dataIteminfo'>
                    <div className='standardColor'>{metric.eng}</div>
                    <div>{value}{metric.unit ? <span style={{ color: '#999' }}> {metric.unit}</span> : null}</div>
                </div>
            </div>
        )
    }

    renderConfigurableSidebar(sidebar) {
        const pressure = sidebar.pressure || {}
        const area = sidebar.area || {}
        const primary = this.getConfiguredMetric(pressure.primaryMetric, sidebar, area.unit)
            || this.getConfiguredMetric('totalPressure', sidebar, area.unit)
        const primaryValue = this.formatConfiguredMetricValue(primary.value, primary.decimals)
        const primaryUnit = primary.unit
        return (
            <div className='aside'>
                {pressure.visible !== false ? (
                    <div className="asideContent firstAside">
                        {this.renderBuiltinChartHeading(
                            pressure.title || 'Pressure Data',
                            'pressure'
                        )}
                        <span className='pressData'>{primaryValue}</span>
                        {primaryUnit ? <span style={{ color: '#999' }}> {primaryUnit}</span> : null}
                        <div className='pressTitle standardColor'>{primary.eng}</div>
                        {this.renderBuiltinChartCanvas('pressure', {
                            height: `${150 * this.state.fontSize}px`,
                            width: '100%',
                        })}
                        {(pressure.metrics || []).map((metricId) => this.renderConfiguredMetric(metricId, sidebar, area.unit))}
                    </div>
                ) : null}
                {this.renderCustomChartCards()}
                <FormulaChartPanel
                    algorithmMetricDefinitions={sidebar.algorithmMetrics || []}
                    builtinDefinitions={BUILTIN_FORMULA_CHARTS}
                    matrixName={this.props.matrixName}
                    matrixShape={this.props.matrixShape}
                    onBuiltinSeries={this.handleBuiltinFormulaSeries}
                    onCustomSeries={this.handleCustomFormulaSeries}
                    ref={this.formulaCharts}
                />
                {area.visible !== false ? (
                    <div className="asideContent firstAside">
                        {this.renderBuiltinChartHeading(
                            area.title || 'Pressure Area',
                            'area'
                        )}
                        {this.renderBuiltinChartCanvas('area', {
                            height: `${150 * this.state.fontSize}px`,
                            width: '100%',
                        })}
                        {(area.metrics || []).map((metricId) => this.renderConfiguredMetric(metricId, sidebar, area.unit))}
                    </div>
                ) : null}
            </div>
        )
    }

    render() {
        const { t, i18n } = this.props;
        const isGlove = ['hand0205', 'hand0205Double', 'handGlove115200', 'handGloveFullPacket'].includes(this.props.matrixName);
        const isGloveRemoteControl = isGlove && this.props.numMatrixFlag === 'normal';
        const isSmallBed12B = this.props.matrixName === 'smallBed12B'
        const pressureDataFields = isSmallBed12B
            ? [
                {
                    color: '#2A99FF',
                    data: this.props.i18n.t('meanPressureIntensity'),
                    key: 'meanPres',
                    decimals: 1,
                },
                {
                    color: '#FF2A2A',
                    data: this.props.i18n.t('maxPressureIntensity'),
                    key: 'maxPres',
                    decimals: 1,
                },
            ]
            : [
            {
                color: '#2A99FF',
                data: this.props.i18n.t('meanPress'),
                key: 'meanPres',
                decimals: 2,
            }, {
                color: '#FF2A2A',
                data: this.props.i18n.t('maxPress'),
                key: 'maxPres',
                decimals: 0,
            },
            {
                color: '#FF2A2A',
                data: this.props.i18n.t('pressTotal'),
                key: 'totalPres',
                decimals: 0,
            },
        ]

        if (this.props.sidebarConfig) {
            return this.renderConfigurableSidebar(this.props.sidebarConfig)
        }

        const onBedStatus = {
            0: {
                text: this.props.i18n.t('leaveBed'),
                img: offBed
            },
            1: {
                text: this.props.i18n.t('inBed'),
                img: onBed
            },
            3: {
                text: this.props.i18n.t('fallBed'),
                img: dropBed
            },
            4: {
                text: this.props.i18n.t('sitUp'),
                img: sitBed
            },
        }

        const petPostureStatus = {
            0: this.props.i18n.t('petEmpty'),
            1: this.props.i18n.t('petPaws'),
            2: this.props.i18n.t('petTorso'),
            3: this.props.i18n.t('petMotion'),
        }

        const petBedStatus = {
            0: {
                text: this.props.i18n.t('petOffBed'),
            },
            1: {
                text: this.props.i18n.t('petInBed'),
            },
        }

        const dataArr = [{
            color: '#FFA63F',
            data: this.props.i18n.t('points'),
        },
        ]

        function secondsToHMS(seconds) {
            const h = Math.floor(seconds / 3600);
            const m = Math.floor((seconds % 3600) / 60);
            const s = seconds % 60;
            return [h, m, s].map(v => String(v).padStart(2, "0")).join(":");
        }

        const petPostureState = Number(this.state.posture_state)
        const resolvedPetInBed = resolvePetInBed(this.state)
        const petInBed = resolvedPetInBed != null ? resolvedPetInBed : 0
        const petBreathRate = petPostureState === 2 && this.state.breath_rate != null && this.state.breath_rate !== '--'
            ? Number(this.state.breath_rate).toFixed(1)
            : '--'
        const petHeartRate = this.state.heart_rate != null && this.state.heart_rate !== '--'
            ? Number(this.state.heart_rate).toFixed(0)
            : '--'
        const petQuality = this.state.quality != null && this.state.quality !== '--'
            ? Number(this.state.quality).toFixed(1)
            : '--'
        const shouldZeroMiniPressureCoefficient = this.props.matrixName === 'petCareMini' && resolvedPetInBed === 0
        const petPressureCoefficient = shouldZeroMiniPressureCoefficient
            ? '0.00'
            : this.state.pressure_coefficient != null && this.state.pressure_coefficient !== '--'
                ? Number(this.state.pressure_coefficient).toFixed(2)
                : '--'
        const temperatureValues = Array.isArray(this.state.temperatureData) ? this.state.temperatureData : []
        const temperatureAvg = Number(this.state.temperatureAvg)
        const temperatureAvgText = Number.isFinite(temperatureAvg) ? temperatureAvg.toFixed(1) : '--'

        return (
            <div className='aside'>
               {this.props.matrixName != 'bed40' ? <div className="asideContent firstAside">
                    {this.props.matrixName != 'foot' ? <>{this.renderBuiltinChartHeading('Pressure Area', 'area')}
                        {this.renderBuiltinChartCanvas('area', {
                            height: `${150 * this.state.fontSize}px`,
                            width: '100%',
                        })}
                        <>
                            {
                                dataArr.map((a, index) => {
                                    return (
                                        <div className='dataItem' key={`${a.data}-${index}`}>
                                            <div className='dataItemCircle'>
                                                <div className='circleItem' style={{ backgroundColor: a.color }}></div>
                                                <div>{a.data}</div>
                                            </div>
                                            <div className='dataIteminfo'>
                                                <div className='standardColor'>{a.eng}</div>
                                                <div>
                                                    {arrArea[index] === 'area' ?
                                                        <div>{parseInt(this.state[arrArea[index]] * 2.1)} <span style={{ color: '#999' }}>cm²</span></div>
                                                        : <div>{this.state[arrArea[index]]} <span style={{ color: '#999' }}>个</span></div>}
                                                </div>
                                            </div>
                                        </div>

                                    )
                                })
                            }
                            {this.props.matrixName === 'hand' && (
                                <div className='dataItem'>
                                    <div className='dataItemCircle'>
                                        <div className='circleItem' style={{ backgroundColor: '#FFA63F' }}></div>
                                        <div>{this.props.i18n.t('area')}</div>
                                    </div>
                                    <div className='dataIteminfo'>
                                        <div className='standardColor'>Area</div>
                                        <div>
                                            <div>{this.state.point * 4} <span style={{ color: '#999' }}>mm²</span></div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </> </> : <Com> <CanvasDemo ref={this.canvas} /></Com>}
                </div> : ''}

                {/* jqbed 健康监测面板 */}
                {this.props.matrixName === 'tempFullBed' ? (
                    <div className="asideContent firstAside">
                        <h2 className="asideTitle">温度</h2>
                        <span className='pressData'>{temperatureAvgText}</span> <span style={{ color: '#999' }}>℃</span>
                        <div className='pressTitle standardColor'>Average Temperature</div>
                        {temperatureValues.map((value, index) => {
                            const numberValue = Number(value)
                            return (
                                <div className='dataItem' key={`temperature-${index}`}>
                                    <div className='dataItemCircle'>
                                        <div className='circleItem' style={{ backgroundColor: '#FFA63F' }}></div>
                                        <div>{`温度${index + 1}`}</div>
                                    </div>
                                    <div className='dataIteminfo'>
                                        <div className='standardColor'>{`Row ${14 + index}, Col 20`}</div>
                                        <div>{Number.isFinite(numberValue) ? numberValue.toFixed(1) : '--'} <span style={{ color: '#999' }}>℃</span></div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                ) : null}

                {['petCare', 'petCareMini'].includes(this.props.matrixName) ?
                    <>
                        <div className="asideContent firstAside">
                            <h2 className="asideTitle">{this.props.i18n.t(this.props.matrixName === 'petCareMini' ? 'petCareMiniTitle' : 'petCareTitle')}</h2>
                            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-around' }}>
                                <div>
                                    <div>
                                        {this.props.i18n.t('respiration')}
                                    </div>
                                    <div>
                                        {petBreathRate}
                                    </div>
                                </div>
                                <div>
                                    <div>
                                        {this.props.i18n.t('petSignalQuality')}
                                    </div>
                                    <div>
                                        {petQuality}
                                    </div>
                                </div>
                                <div>
                                    <div>
                                        {this.props.i18n.t('heartRate')}
                                    </div>
                                    <div>
                                        {petHeartRate}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="asideContent firstAside" style={{ display: 'flex', flexDirection: 'column', justifyContent: "space-around", backgroundColor: petInBed === 0 ? "#ED4F4F" : "#191932" }}>
                            {petBedStatus[petInBed] && <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '30px', fontWeight: 'bold' }}>{petBedStatus[petInBed].text}</div>}
                            <div style={{ display: 'grid', gap: '10px', marginTop: '16px' }}>
                                <div>{this.props.i18n.t('petPosture')} : {petPostureStatus[petPostureState] || '--'}</div>
                                <div>{this.props.i18n.t('petMotionFlag')} : {this.state.is_motion ? this.props.i18n.t('petMotion') : this.props.i18n.t('petStill')}</div>
                                <div>{this.props.i18n.t('petPressureCoeff')} : {petPressureCoefficient}</div>
                            </div>
                            <div style={{ marginTop: '20px', textAlign: 'center', background: '#25254F', borderRadius: '12px', padding: "10px 0" }}>{petInBed === 1 ? this.props.i18n.t('inBedDuration') : this.props.i18n.t('leaveBedDuration')} : {secondsToHMS(this.state.onBedTime)}</div>
                        </div>
                    </>
                    : ['jqbed', 'smallBed'].includes(this.props.matrixName) ?
                    <>
                        <div className="asideContent firstAside">
                            <h2 className="asideTitle">{this.props.i18n.t('vitalSigns')}</h2>
                            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-around' }}>
                                <div>
                                    <div>
                                        {this.props.i18n.t('respiration')}
                                    </div>
                                    <div>
                                        {
                                            this.state.rate
                                        }
                                    </div>
                                </div>
                                <div>
                                    <div>
                                        {this.props.i18n.t('heartRate')}
                                    </div>
                                    <div>
                                        {
                                            this.state.heart_rate != null && this.state.heart_rate !== '--' ? Math.round(this.state.heart_rate) : '--'
                                        }
                                    </div>
                                </div>
                            </div>

                        </div>
                        <div className="asideContent firstAside" style={{ display: 'flex', flexDirection: 'column', justifyContent: "space-around", backgroundColor: [3, 4].includes(this.state.stateInBbed) ? "#ED4F4F" : "#191932" }}>
                            {this.state.stateInBbed != null && onBedStatus[this.state.stateInBbed] && <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '30px', fontWeight: 'bold' }}>{onBedStatus[this.state.stateInBbed].text} <img src={onBedStatus[this.state.stateInBbed].img} alt="" /></div>}
                            {(this.state.stateInBbed == 1 || this.state.stateInBbed == 0) ? <div style={{ marginTop: '20px', textAlign: 'center', background: '#25254F', borderRadius: '12px', padding: "10px 0" }}>{this.state.stateInBbed == 1 ? this.props.i18n.t('inBedDuration') : this.props.i18n.t('leaveBedDuration')} : {secondsToHMS(this.state.onBedTime)}</div> : ''}
                        </div>
                        {
                            this.state.sosflag ? <div className="asideContent firstAside" style={{ fontSize: '30px', color: '#ED4F4F', fontWeight: 'bold' }}>{this.props.i18n.t('sos')}</div> : ''
                        }
                    </>
                    : this.props.matrixName != 'bed40' ?
                <div className="asideContent firstAside">
                    {this.renderBuiltinChartHeading(
                        this.props.matrixName === 'foot'
                            ? 'Pressure Area'
                            : isSmallBed12B
                                ? this.props.i18n.t('pressureIntensityData')
                                : 'Pressure Data',
                        this.props.matrixName === 'foot' ? 'area' : 'pressure'
                    )}
                    <span className='pressData'>{isGloveRemoteControl ? `${this.state.indexAngle || 0}°` : isSmallBed12B ? Number(this.state.totalPres).toFixed(1) : Number(this.state.totalPres).toFixed(0)}</span> <span style={{ color: '#999' }}>{isSmallBed12B ? 'kPa' : ''}</span>

                    {this.props.matrixName != 'foot' ? <>
                        <div className='pressTitle standardColor'>{isGloveRemoteControl ? this.props.i18n.t('bendAngle') : isSmallBed12B ? this.props.i18n.t('maxPressureIntensity') : this.props.i18n.t('allPress')}</div>
                        {this.renderBuiltinChartCanvas('pressure', {
                            height: `${150 * this.state.fontSize}px`,
                            width: '100%',
                        })}
                        {
                            pressureDataFields.map((a, index) => {
                                return (
                                    <div className='dataItem' key={`${a.data}-${index}`}>
                                        <div className='dataItemCircle'>
                                            <div className='circleItem' style={{ backgroundColor: a.color }}></div>
                                            <div>{a.data}</div>
                                        </div>
                                        <div className='dataIteminfo'>
                                            <div className='standardColor'>{a.eng}</div>
                                            <div>{Number(this.state[a.key]).toFixed(a.decimals)}{isSmallBed12B ? <span style={{ color: '#999' }}> kPa</span> : null}</div>
                                        </div>
                                    </div>
                                )
                            })

                        }
                        {this.props.matrixName == 'sitCol' ? <> <div className='dataItem'>
                            <div className='dataItemCircle'>
                                <div className='circleItem' style={{ backgroundColor: 'red' }}></div>
                                <div>{this.props.matrixName == 'sitCol' ? '坐姿' : '睡姿'}</div>
                            </div>
                            <div className='dataIteminfo'>
                                <div className='standardColor'></div>
                                <div>{this.state.model}</div>
                            </div>
                        </div>
                            <div className='dataItem'>
                                <div className='dataItemCircle'>
                                    <div className='circleItem' style={{ backgroundColor: 'red' }}></div>
                                    <div>最大索引</div>
                                </div>
                                <div className='dataIteminfo'>
                                    <div className='standardColor'></div>
                                    <div>{this.state.maxIndex}</div>
                                </div>

                            </div>
                        </> : null}

                    </>
                        : <>
                            <div className='pressTitle standardColor'>总体面积 Total Area</div>
                            {this.renderBuiltinChartCanvas('area', {
                                height: '150px',
                                width: '100%',
                            })}
                            {
                                dataArr1.map((a, index) => {
                                    return (
                                        <div className='dataItem' key={`${a.data}-${index}`}>
                                            <div className='dataItemCircle'>
                                                <div className='circleItem' style={{ backgroundColor: a.color }}></div>
                                                <div>{a.data}</div>
                                            </div>
                                            <div className='dataIteminfo'>
                                                <div className='standardColor'>{a.eng}</div>
                                                <div>{this.state[footArr[index]]}</div>
                                            </div>
                                        </div>
                                    )
                                })
                            }

                        </>}
                </div> : ''}

                {this.renderCustomChartCards()}
                <FormulaChartPanel
                    algorithmMetricDefinitions={this.props.sidebarConfig?.algorithmMetrics || []}
                    builtinDefinitions={BUILTIN_FORMULA_CHARTS}
                    matrixName={this.props.matrixName}
                    matrixShape={this.props.matrixShape}
                    onBuiltinSeries={this.handleBuiltinFormulaSeries}
                    onCustomSeries={this.handleCustomFormulaSeries}
                    ref={this.formulaCharts}
                />

            </div>
        )
    }
}

export default withTranslation('translation', { withRef: true })(Aside);
