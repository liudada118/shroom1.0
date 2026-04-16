import React from 'react'
import './aside.scss'
import { CanvasDemo } from '../chart/Chart'
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



let myChart1, myChart2



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
let ctx1, ctx2, ctx3
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
        }
        this.canvas = React.createRef()

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

        // jqbed 在床/离床计时 - 由后端 server.js 计算并通过 WebSocket 发送
    }

    componentDidUpdate() {
        var c = document.getElementById("myChart1");
        if (c) ctx1 = c.getContext("2d");

        var c1 = document.getElementById("myChart2");
        if (c1) ctx2 = c1.getContext("2d");

        var c2 = document.getElementById("myChart3");
        if (c2) ctx3 = c2.getContext("2d");
    }

    componentWillUnmount() {
        if (this._dataTimer) clearTimeout(this._dataTimer);
        if (this._chartTimer) clearTimeout(this._chartTimer);
        if (this._areaTimer) clearTimeout(this._areaTimer);
        if (this._bodyTimer) clearTimeout(this._bodyTimer);
    }

    drawChart({ ctx, arr, max, canvas, index }) {
        // 清空画布
        let min = Math.min(...arr)
        let realMax = Math.max(...arr)
        let data
        if (this.props.matrixName == 'yanfeng10') {
            let res = arr.map((a) => a - min + 10)
            data = res.map((a) => a * 150 * this.state.fontSize / (realMax - min + 20))
        } else {
            data = arr.map((a) => a * 150 / max)
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 计算数据点之间的间距
        var gap = canvas.width / (data.length + 1);

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
        ctx.strokeStyle = "#991BFA";
        ctx.lineWidth = 2;
        ctx.stroke();

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
            const canvas = document.getElementById('myChart1');
            if (canvas) this.drawChart({ ctx: ctx1, arr, max, canvas, index });
            if (this._chartTimer) { clearTimeout(this._chartTimer); this._chartTimer = null; }
        } else if (!this._chartTimer) {
            this._chartTimer = setTimeout(() => {
                this._lastChartTime = performance.now();
                if (this._pendingChart) {
                    const { arr: a, max: m, index: i } = this._pendingChart;
                    const canvas = document.getElementById('myChart1');
                    if (canvas) this.drawChart({ ctx: ctx1, arr: a, max: m, canvas, index: i });
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
            const canvas = document.getElementById('myChart2');
            if (canvas) this.drawChart({ ctx: ctx2, arr, max, canvas, index });
            if (this._areaTimer) { clearTimeout(this._areaTimer); this._areaTimer = null; }
        } else if (!this._areaTimer) {
            this._areaTimer = setTimeout(() => {
                this._lastAreaTime = performance.now();
                if (this._pendingArea) {
                    const { arr: a, max: m, index: i } = this._pendingArea;
                    const canvas = document.getElementById('myChart2');
                    if (canvas) this.drawChart({ ctx: ctx2, arr: a, max: m, canvas, index: i });
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
        // 处理 jqbed 健康监测数据
        if (obj.stateInBbed !== undefined) {
            const prevState = this.state.stateInBbed
            const newState = obj.stateInBbed
            // 状态变化时重置计时（由后端处理，前端只展示）
        }
        const now = performance.now();
        this._pendingData = {
            ...(this._pendingData || {}),
            ...obj,
        };

        const hasRealtimeDetectionData =
            obj.rate !== undefined ||
            obj.heart_rate !== undefined ||
            obj.stateInBbed !== undefined ||
            obj.sosflag !== undefined ||
            obj.onBedTime !== undefined;

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

    render() {
        const { t, i18n } = this.props;
        const isGlove = this.props.matrixName === 'hand0205' || this.props.matrixName === 'handGlove115200';
        const dataArrCar = [
            {
                color: '#2A99FF',
                data: this.props.i18n.t('meanPress'),
            }, {
                color: '#FF2A2A',
                data: this.props.i18n.t('maxPress'),
            },
            {
                color: '#FF2A2A',
                data: this.props.i18n.t('pressTotal'),
            },
        ]

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

        return (
            <div className='aside'>
               {this.props.matrixName != 'bed40' ? <div className="asideContent firstAside">
                    {this.props.matrixName != 'foot' ? <><h2 className="asideTitle">Pressure Area</h2>
                        <canvas id="myChart2" style={{ height: `${150 * this.state.fontSize}px`, width: '100%' }}></canvas>
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
                {this.props.matrixName == 'jqbed' ?
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
                    <h2 className="asideTitle">{isGlove ? 'Index Finger Angle' : 'Pressure Data'}</h2>
                    <span className='pressData'>{isGlove ? `${this.state.indexAngle || 0}°` : Number(this.state.totalPres).toFixed(0)}</span> <span style={{ color: '#999' }}></span>

                    {this.props.matrixName != 'foot' ? <>
                        <div className='pressTitle standardColor'>{isGlove ? 'Bending Angle' : this.props.i18n.t('allPress')}</div>
                        <canvas id="myChart1" style={{ height: `${150 * this.state.fontSize}px`, width: '100%' }}></canvas>
                        {
                            dataArrCar.map((a, index) => {
                                return (
                                    <div className='dataItem' key={`${a.data}-${index}`}>
                                        <div className='dataItemCircle'>
                                            <div className='circleItem' style={{ backgroundColor: a.color }}></div>
                                            <div>{a.data}</div>
                                        </div>
                                        <div className='dataIteminfo'>
                                            <div className='standardColor'>{a.eng}</div>
                                            <div>{index == 0 ? Number(this.state[arr[index]]).toFixed(2) : Number(this.state[arr[index]]).toFixed(0)} <span style={{ color: '#999' }}></span></div>
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
                            <canvas id="myChart2" style={{ height: '150px', width: '100%' }}></canvas>
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


            </div>
        )
    }
}

export default withTranslation('translation', { withRef: true })(Aside);
