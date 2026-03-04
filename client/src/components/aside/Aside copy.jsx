import React, { useEffect, useImperativeHandle, useState } from 'react'
import './aside.scss'
// import Chart, { CanvasDemo, Chart2 } from '../chart/Chart'
import * as echarts from "echarts";
// const dataArr = [{
//     color: '#3CFF2B',
//     data: '左脚内外翻'
// }, {
//     color: '#2A99FF',
//     data: '右脚内外翻'
// }, {
//     color: '#FF2A2A',
//     data: '足弓分类'
// },]

const dataArr = [ {
    color: '#FFA63F',
    data: '点数',
    eng: 'Points'
},
{
    color: '#2A99FF',
    data: '面积',
    eng: 'Area'
},]

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
        color: '#FF2A2A',
        data: '压力总和',
        eng: 'Pressure'
    }, {
        color: '#FFA63F',
        data: '压力标准差',
        eng: 'Pres Standard'
    }
]



let myChart1, myChart2

const Aside = React.forwardRef((props, refs) => {

    const initCharts = (props) => {
        let option = {
            tooltip: {
                formatter: '{a} <br/>{b} : {c}%'
            },
            series: [
                {
                    name: 'Pressure',
                    type: 'gauge',
                    progress: {
                        show: true
                    },
                    detail: {
                        valueAnimation: true,
                        formatter: '{value}'
                    },
                    pointer: {
                        show: false
                    },
                    axisTick: {
                        show: false,
                    },
                    axisLabel: {
                        show: false,
                    },
                    splitLine: {
                        show: false,
                    },
                    data: [
                        {
                            value: 50,
                            color : '#fff'
                        }
                    ],
                    itemStyle: {
                        color: '#8a00ef'
                    },
                    detail: {
                        formatter: '{value}%',
                    },

                    axisLine: {
                        show: true,
                        lineStyle: {
                            color: [
                                [1, new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                                    {
                                        offset: 0.1,
                                        color: "#FFC600"
                                    },
                                    {
                                        offset: 0.6,
                                        color: "#30D27C"
                                    },
                                    {
                                        offset: 1,
                                        color: "#0B95FF"
                                    }
                                ])
                                ]
                            ]

                        }
                    }
                }
            ]
        };

        option && props.myChart.setOption(option);

        // window.addEventListener("resize", function () {
        //   props.myChart.resize();
        // });
    };

    const initCharts1 = (props) => {
        let option = {
            animation: false,
            // tooltip: {
            //   trigger: "axis",
            //   show: "true",
            // },
            grid: {
                x: 10,
                x2: 10,
                y: 10,
                y2: 10,
            },
            xAxis: {
                type: "category",
                show: false,
                splitLine: {
                    show: false,

                },
                data: props.xData,
                axisLabel: {
                    show: false,
                   
                },
            },

            yAxis: {
                type: "value",
                show: false,
                splitLine: {
                    show: false,
                },
                max: props.yMax,
                axisLabel: {
                    show: false,

                },
            },
            series: [
                {
                    symbol: "none",
                    data: props.yData,
                    type: "line",
                    smooth: true,
                    color: "#E93CA7",
                
                },
               
            ],
        };
        option && props.myChart.setOption(option);
        
    };

    const handleCharts = (arr , value) => {
       
        if (myChart2) {
            initCharts1({
                yData: arr,
                xData: [
                    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
                    20,
                ],
                index: 0 + 1,
                name: "中风",
                myChart: myChart2,
                yMax : value
            });
        }
    }

    const handleChartsArea = (arr ,value) => {
       
        if (myChart1) {
            initCharts1({
                yData: arr,
                xData: [
                    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
                    20,
                ],
                index: 0 + 1,
                name: "中风",
                myChart: myChart1,
                yMax : value
            });
        }
    }

    const [totalPres, setTotalPres] = useState(0)
    const [meanPres, setMeanPres] = useState(0)
    const [minPres, setMinPres] = useState(0)
    const [maxPres, setMaxPres] = useState(0)
    const [point, setPoint] = useState(0)
    const [area, setArea] = useState(0)
    const [pressure, setPressure] = useState(0)
    const [presStan, setPresStan] = useState(0)
    const [obj , setObj] = useState({})


    useImperativeHandle(refs, () => ({
        setMeanPres,
        setMinPres,
        setMaxPres,
        setPoint,
        setArea,
        setPressure,
        setPresStan,
        setTotalPres,
        handleCharts,
        handleChartsArea,
        setObj
    }));

    useEffect(() => {
        
        myChart1 = echarts.init(document.getElementById(`myChart1`));
        myChart2 = echarts.init(document.getElementById(`myChart2`));
       
    }, [])

    const arr = ['meanPres', 'maxPres', 'totalPres' , 'presStan']
    const arrArea = [ 'point', 'area',]
    console.log('aside' , obj)
    return (

        <div className='aside'>
            <div className="asideContent firstAside">
                <h2 className="asideTitle">Pressure Area</h2>
                <div id="myChart1" style={{ height: '150px' }}></div>
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
                                    <div>{obj[arrArea[index]]}</div>
                                </div>
                            </div>

                        )
                    })
                }
            </div>
            <div className="asideContent">
                <h2 className="asideTitle">Pressure Data</h2>
                <h1 className='pressData'>{pressure}</h1>
                <div className='pressTitle standardColor'>总体压力 Total Pres</div>
                <div id="myChart2" style={{ height: '150px' }}></div>
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
                                    <div>{obj[arr[index]]}</div>
                                </div>
                            </div>
                        )
                    })
                }
            </div>
        </div>
    )
})

export default Aside

// export default function Aside() {

//     useEffect(() => {
//         myChart1 = echarts.init(document.getElementById(`myChart1`));
//         // console.log(myChart1)
//         if (myChart1) {
//             initCharts({
//                 yData: new Array(20).fill(Math.random() * 30),
//                 xData: [
//                     1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
//                     20,
//                 ],
//                 index: 0 + 1,
//                 name: "中风",
//                 myChart: myChart1,
//                 //   yMax: 10000,
//             });
//         }

//         myChart2 = echarts.init(document.getElementById(`myChart2`));
//         // console.log(myChart2)
//         if (myChart2) {
//             initCharts1({
//                 yData: new Array(20).fill(Math.random() * 30),
//                 xData: [
//                     1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
//                     20,
//                 ],
//                 index: 0 + 1,
//                 name: "中风",
//                 myChart: myChart2,
//                 //   yMax: 10000,
//             });
//         }
//     }, [])

//     return (
//         <div className='aside'>
//             <div className="asideContent firstAside">
//                 <h2 className="asideTitle">Data Analysis</h2>
//                 <div id="myChart1" style={{ height: '200px' }}></div>
//                 {
//                     dataArr.map((a, index) => {
//                         return (
//                             <div className='dataItem'>
//                                 <div className='dataItemCircle'>
//                                     <div className='circleItem' style={{ backgroundColor: a.color }}></div>
//                                     <div>{a.data}</div>
//                                 </div>
//                                 <div>143</div>
//                             </div>

//                         )
//                     })
//                 }
//             </div>
//             <div className="asideContent">
//                 <h2 className="asideTitle">Pressure Data</h2>

//                 <h1 className='pressData'>64</h1>
//                 <div className='pressTitle standardColor'>总体压力 Total Pres</div>
//                 <div id="myChart2" style={{ height: '150px' }}></div>
//                 {
//                     dataArr1.map((a, index) => {
//                         return (
//                             <div className='dataItem'>
//                                 <div className='dataItemCircle'>
//                                     <div className='circleItem' style={{ backgroundColor: a.color }}></div>
//                                     <div>{a.data}</div>
//                                 </div>
//                                 <div className='dataIteminfo'>
//                                     <div className='standardColor'>{a.eng}</div>
//                                     <div>20</div>
//                                 </div>

//                             </div>
//                         )
//                     })
//                 }
//             </div>
//         </div>
//     )
// }
