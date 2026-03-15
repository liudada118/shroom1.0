import React from 'react'
import './aside.scss'
import { CanvasDemo } from '../chart/Chart'
import { withTranslation } from 'react-i18next'




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
        console.log(this.props)
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
            fontSize: 1
        }
        this.canvas = React.createRef()
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
    }

    componentDidUpdate() {
        var c = document.getElementById("myChart1");
        if (c) ctx1 = c.getContext("2d");

        var c1 = document.getElementById("myChart2");
        if (c1) ctx2 = c1.getContext("2d");

        var c2 = document.getElementById("myChart3");
        if (c2) ctx3 = c2.getContext("2d");
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
            // ctx.fillText(arr[index - 1], gap * (index), canvas.height - 30)
        }

    }

    componentWillUnmount() {

    }

    handleCharts(arr, max, index) {
        const canvas = document.getElementById('myChart1')

        if(canvas) this.drawChart({ ctx: ctx1, arr, max, canvas, index })
    }

    handleChartsArea(arr, max, index) {

        const canvas = document.getElementById('myChart2')
        if(canvas) this.drawChart({ ctx: ctx2, arr, max, canvas, index })

    }

    handleChartsBody(arr, max, index) {

        const canvas = document.getElementById('myChart3')
        if (canvas) {
            this.drawChart({ ctx: ctx3, arr, max, canvas, index })
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
        this.setState(obj)
    }
    // meanPress : '平均压力',
    // maxPress : '最大压力',
    // pressTotal : '压力总和',
    // points : "点数",
    // area : "面积"
    render() {
        const { t, i18n } = this.props;
        // console.log('aside')
        // const { t, i18n } = this.props;
        const dataArrCar = [
            {
                color: '#2A99FF',
                data: this.props.i18n.t('meanPress'),
                // eng: 'Mean Pres'
            }, {
                color: '#FF2A2A',
                data: this.props.i18n.t('maxPress'),
                // eng: 'Max Pres'
            },
            {
                color: '#FF2A2A',
                data: this.props.i18n.t('pressTotal'),
                // eng: 'Pressure'
            },
        ]

        const dataArr = [{
            color: '#FFA63F',
            data: this.props.i18n.t('points'),
            // eng: 'Points'
        },
        // {
        //     color: '#2A99FF',
        //     data: this.props.i18n.t('area'),
        //     // eng: 'Area'
        // },
    ]
        return (
            <div className='aside'>
               {this.props.matrixName != 'bed40' ? <div className="asideContent firstAside">
                    {this.props.matrixName != 'foot' ? <><h2 className="asideTitle">Pressure Area</h2>
                        <canvas id="myChart2" style={{ height: `${150 * this.state.fontSize}px`, width: '100%' }}></canvas>
                        <>
                            {
                                dataArr.map((a, index) => {
                                    return (
                                        <div className='dataItem' key={a.eng}>
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
                        </> </> : <Com> <CanvasDemo ref={this.canvas} /></Com>}
                </div> : ''}

                {this.props.matrixName != 'bed40' ?<div className="asideContent firstAside">
                    <h2 className="asideTitle">Pressure Data</h2>
                    {/* <div style={{}}> */}
                    <span className='pressData'>{(this.props.matrixName != 'hand0205' && this.props.matrixName != 'handGlove115200') ? (Number(this.state.totalPres).toFixed(0)) : this.state.totalPres}</span> <span style={{ color: '#999' }}></span>
                    {/* </div> */}

                    {this.props.matrixName != 'foot' ? <>
                        <div className='pressTitle standardColor'>{this.props.i18n.t('allPress')}</div>
                        <canvas id="myChart1" style={{ height: `${150 * this.state.fontSize}px`, width: '100%' }}></canvas>
                        {
                            dataArrCar.map((a, index) => {
                                return (
                                    <div className='dataItem' key={a.eng}>
                                        <div className='dataItemCircle'>
                                            <div className='circleItem' style={{ backgroundColor: a.color }}></div>
                                            <div>{a.data}</div>
                                        </div>
                                        <div className='dataIteminfo'>
                                            <div className='standardColor'>{a.eng}</div>
                                            <div>{(this.props.matrixName != 'hand0205' && this.props.matrixName != 'handGlove115200') ? (index == 0 ? Number(this.state[arr[index]]).toFixed(2) : Number(this.state[arr[index]]).toFixed(0)) : this.state[arr[index]]} <span style={{ color: '#999' }}></span></div>
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

                            {/* <div className='dataItem'>
                                <div className='dataItemCircle'>
                                    <div className='circleItem' style={{ backgroundColor: 'red' }}></div>
                                    <div>采集标签</div>
                                </div>
                                <div className='dataIteminfo'>
                                    <div className='standardColor'></div>
                                    <div>{this.state.sitCol}</div>
                                </div>
                            </div> */}
                        </> : null}

                        {/* <>{this.props.matrixName == 'xiyueReal1' ?
                            <div style={{ fontSize: '3rem' }}>
                                <div>睡姿: {this.state.model}</div>
                            </div>
                            : ''} </> */}
                    </>
                        : <>
                            <div className='pressTitle standardColor'>总体面积 Total Area</div>
                            <canvas id="myChart2" style={{ height: '150px', width: '100%' }}></canvas>
                            {
                                dataArr1.map((a, index) => {
                                    return (
                                        <div className='dataItem' key={a.eng}>
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
                        {/* <div style={{color : '#fff', fontSize : '2rem'}}>{this.state.resetZero ? t('resetZero') :t('cancelZero') }</div>  */}
                </div> : ''}
                {/* {this.props.matrixName === 'bigBed' ? <div className="asideContent" style={{padding : 0}}>
                    <canvas id="myChart3" style={{ height: '150px', width: '100%' }}></canvas>
                </div> : null} */}
                

            </div>
        )
    }
}

// export default Aside

export default withTranslation('translation', { withRef: true })(Aside);