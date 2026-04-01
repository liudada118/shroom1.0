import React, { useEffect, useImperativeHandle, useState } from 'react'
import './progress.scss'
import { Select, message } from 'antd'
import { moveValue, changePxToValue } from './util'
import play from "../../assets/images/play.png";
import pause from "../../assets/images/pause.png";
import { timeStampToDate } from '../../assets/util/util';

const playOptions = [
    {
        value: 0.25,
        label: "0.25X",
    },
    {
        value: 0.5,
        label: "0.5X",
    },
    {
        value: 1,
        label: "1.0X",
    },
    {
        value: 1.5,
        label: "1.5X",
    },
    {
        value: 2,
        label: "2.0X",
    },
]
let timer
const ProgressCom = React.forwardRef((props, refs) => {

    const [playFlag, setPlayFlag] = useState(false)
    const [leftFlag, setLeftFlag] = useState(false)
    const [rightFlag, setRightFlag] = useState(false)
    const [lineFlag, setLineFlag] = useState(false)
    const [dataTime, setDataTime] = useState()

    const thrott = (fun) => {
        if (!timer) {
            timer = setTimeout(() => {
                fun();
                timer = null;
            }, 100);
        }
    }

    const changeLeftProgress = (e) => {
        // 当进度条左边被按住调节起始的时间时
        if (leftFlag) {

            // 计算整个进度条组件条的最左边坐标  开始滑块的最左移动位置
            const leftX = document.querySelector(".progress").getBoundingClientRect().x;
            // 计算结束进度条的最左边坐标  开始滑块的左右移动位置
            const right = parseInt(document.querySelector(".rightProgress").style.left);

            // leftProgress 的相对位移
            const leftpx = moveValue(e.clientX - leftX - 10);

            // 将开始滑块的位置设置为 相对位移
            document.querySelector(".leftProgress").style.left = `${leftpx > right - 20 ? right - 20 : leftpx}px`;

            // 计算移动后开始滑块的最左边位置
            const left = parseInt(document.querySelector(".leftProgress").style.left);
            // 计算数据帧滑块的最左边位置
            const lineleft = parseInt(document.querySelector(".progressLine").style.left);

            // console.log(lineleft, e.clientX - leftX + 10, document.querySelector(".progressLine").style.left)

            // 当数据帧滑块的最左边位置小于 开始滑块的最左边位置  进度条贴在开始滑块的最右边  20是开始滑块的宽度
            if (lineleft < e.clientX - leftX + 10) {

                document.querySelector(".progressLine").style.left = `${moveValue(left + 20)}px`;
                let value = changePxToValue({ value: left, type: "line", length: props.length });

                // 节流去给后端发送 实时数据滑块的位置
                thrott(() => {
                    props.wsSendObj({
                        value,
                    });
                });
            }

            // 节流去给后端发送 开始结束滑块的位置
            let arr = [changePxToValue({ value: left, length: props.length }), changePxToValue({ value: right, length: props.length })];

            thrott(() => {
                props.wsSendObj({
                    indexArr: arr,
                });
            });
        }


        // 当进度条右边被按住调节结束的时间时
        if (rightFlag) {
            const leftX = document.querySelector(".progress").getBoundingClientRect().x;
            const left = parseInt(document.querySelector(".leftProgress").style.left);

            var moveX = e.clientX;

            const rightpx = moveValue(e.clientX - leftX - 10);
            document.querySelector(".rightProgress").style.left = `${rightpx < left + 20 ? left + 20 : rightpx}px`;

            const right = parseInt(document.querySelector(".rightProgress").style.left);
            const lineleft = parseInt(document.querySelector(".progressLine").style.left);

            if (lineleft > e.clientX - leftX - 10) {
                document.querySelector(".progressLine").style.left = `${moveValue(right)}px`;
                let value = changePxToValue({ value: right, type: "line", length: props.length });
                thrott(() => {
                    props.wsSendObj({
                        value,
                    });
                });
            }

            let arr = [changePxToValue({ value: left, length: props.length }), changePxToValue({ value: right, length: props.length })];

            thrott(() => {
                props.wsSendObj({
                    indexArr: arr,
                });
            });
        }

        // 当帧条被按住调节帧时
        if (lineFlag) {
            // 计算进度条最左边位置
            const leftX = document.querySelector(".progress").getBoundingClientRect().x;
            var moveX = e.clientX;
            // 计算开始滑块的最左边位置
            const left = parseInt(document.querySelector(".leftProgress").style.left);
            // 计算结束滑块的最左边位置
            const right = parseInt(document.querySelector(".rightProgress").style.left);

            // 当超过开始滑块的位置  数据滑块就为开始滑块的位置，当超过结束滑块 数据滑块就为结束滑块的位置 ， 其他就为鼠标滑动的位置
            document.querySelector(".progressLine").style.left = `${moveValue(e.clientX - leftX < left + 20 ? left + 20 : e.clientX - leftX > right ? right : e.clientX - leftX)}px`;

            // 找到移动后数据滑块的位置
            const lineleft = parseInt(document.querySelector(".progressLine").style.left);

            // 节流的像后端发送数据滑块的位置数据
            let value = changePxToValue({ value: lineleft, type: "line", length: props.length });
            thrott(() => {
                props.wsSendObj({
                    value,
                });
            });

            if (props.areaArr) {
                props.data.current?.handleChartsArea(
                    props.areaArr,
                    props.max + 100,
                    value + 1
                );
            }


            if (props.pressArr && (props.matrixName == "car" || props.matrixName == "bigBed")) {
                props.data.current?.handleCharts(
                    props.pressArr,
                    props.pressMax + 100,
                    value + 1
                );
            }
        }
    }

    const changeLeftProgressFalse = () => {
        setLeftFlag(false)
        setRightFlag(false)
        setLineFlag(false)
    }

    // useEffect的 依赖得加 不然不渲染
    useEffect(() => {
        console.log('useEffect')
        window.addEventListener("mousemove", changeLeftProgress);
        window.addEventListener("mouseup", changeLeftProgressFalse);

        return () => {
            console.log('remove')
            window.removeEventListener("mousemove", changeLeftProgress)
            window.removeEventListener("mouseup", changeLeftProgressFalse)
        }
    }, [playFlag, leftFlag, rightFlag, lineFlag])

    const playData = (value) => {
        props.wsSendObj({ play: value })
        setPlayFlag(value)
    };

    const changeIndex = (value) => {
        if (value <= props.length) {
            const line = document.querySelector(".progressLine");

            const lineLeft = 20 + (value * 560) / (props.length ? props.length : 1);
            const leftX = document.querySelector(".progress").getBoundingClientRect().x;
            const left = parseInt(document.querySelector(".leftProgress").style.left);
            const right = parseInt(document.querySelector(".rightProgress").style.left);
            line.style.left = `${20 + (value * 560) / (props.length ? props.length : 1)}px`;

            const lineLocaltion = moveValue(lineLeft < left + 20 ? left + 20 : lineLeft > right ? right : lineLeft)
            document.querySelector(".progressLine").style.left = `${lineLocaltion}px`;

            // this.setState({
            //   index: value,
            // });


            if (props.areaArr) {
                props.data.current?.handleChartsArea(
                    props.areaArr,
                    props.max + 100,
                    value + 1
                );
                if (value == props.areaArr.length) {
                    props.wsSendObj({ play: false });

                    setPlayFlag(false)
                }
            }

            if (props.pressArr && (props.matrixName != "foot")) {

                props.data.current?.handleCharts(
                    props.pressArr,
                    props.pressMax + 100,
                    value + 1
                );
            }

            // if (this.bodyArr && this.state.matrixName == "bigBed") {
            //   this.data.current?.handleChartsBody(this.bodyArr, 200);
            // }


        }
    }


    /**
     * 当进度条被点击的时候，定位到点击的帧上
     */
    const progressClick = (e) => {
        // 
        const leftX = document.querySelector(".progress").getBoundingClientRect().x;
        const left = parseInt(document.querySelector(".leftProgress").style.left);
        const right = parseInt(document.querySelector(".rightProgress").style.left);

        // 让表示进度帧的竖线定位到点击的位置

        const lineLocaltion = moveValue(e.clientX - leftX < left + 20 ? left + 20 : e.clientX - leftX > right ? right : e.clientX - leftX)

        document.querySelector(".progressLine").style.left = `${lineLocaltion}px`;

        const lineleft = parseInt(document.querySelector(".progressLine").style.left);

        let value = changePxToValue({ value: lineleft, type: "line", length: props.length });

        // 向后端索要当前帧的数据
        props.wsSendObj({ value });

        // 渲染当前帧的图表
        if (props.areaArr) props.data.current?.handleChartsArea(props.areaArr, props.max + 100, value + 1);
        if (props.pressArr && (props.matrixName != "foot")) {
            props.data.current?.handleCharts(props.pressArr, props.pressMax + 100, value + 1);
        }
    }

    const resetPlay = () => {
        setPlayFlag(false);
        // 重置滑块和进度线的 DOM 位置
        const left = document.querySelector('.leftProgress');
        const right = document.querySelector('.rightProgress');
        const line = document.querySelector('.progressLine');
        if (left) left.style.left = '0px';
        if (right) right.style.left = '580px';
        if (line) line.style.left = '20px';
    };

    useImperativeHandle(refs, () => ({
        changeIndex,
        resetPlay
    }));

    // console.log(props)

    return (
        <div
            className='progressContent'
        >
            {/* 新进度条 */}

            <div
                className="progress"
                onClick={progressClick}
            >
                {/* 控制开始时间的滑块 */}
                <div
                    style={{
                        border: leftFlag ? "1px solid #991BFA" : "0px",
                        left: 0
                    }}
                    className="leftProgress"
                    onMouseDown={(e) => {
                        // 当鼠标点击在控制开始时间的滑块时，将leftFlag置为true，防止事件冒泡
                        e.stopPropagation();
                        setLeftFlag(true)
                    }}
                    onClick={(e) => {
                        e.stopPropagation();
                    }}
                >
                </div>
                {/* 控制结束时间的滑块 */}
                <div
                    style={{
                        border: rightFlag ? "1px solid #991BFA" : "0px",
                        left: '580px'
                    }}
                    className="rightProgress"
                    onMouseDown={(e) => {
                        // 当鼠标点击在控制结束时间的滑块时，将rightFlag置为true，防止事件冒泡
                        e.stopPropagation();
                        setRightFlag(true)
                    }}
                    onClick={(e) => {
                        e.stopPropagation();
                    }}
                ></div>
                {/* 控制实时数据帧位置的滑块 */}
                <div
                    // ref={this.line}
                    className="progressLine"
                    style={{ left: 20 }}
                    onMouseDown={(e) => {
                        // 当鼠标点击在数据帧的滑块时，将lineFlag置为true，防止事件冒泡
                        setLineFlag(true)
                    }}
                ></div>

            </div>

            {/* 控制播放暂停  播放速度的控件 */}
            <div className='playContent'>
                <img
                    src={play}
                    style={{
                        width: "50px",
                        display: playFlag ? "none" : "unset",
                    }}


                    onClick={() => {
                        if (props.dataTime) {
                            playData(true);
                        } else {
                            message.config({
                                top: 80,
                                duration: 2,
                                maxCount: 3,
                                rtl: true,
                                prefixCls: 'my-message',
                            });
                            message.info("请先选择回放数据时间段");
                        }
                    }}
                    alt=""
                />
                <img
                    src={pause}
                    style={{
                        width: "50px",
                        display: playFlag ? "unset" : "none",
                    }}
                    onClick={() => {
                        playData(false);
                    }}
                    alt=""
                />
                <div style={{ position: "absolute", right: "30%" }}>
                    <Select
                        defaultValue="1.0X"
                        style={{
                            width: 80,
                        }}
                        onChange={(e) => {
                            props.wsSendObj({ speed: e });
                        }}
                        placement={"topLeft"}
                        options={playOptions}
                    />
                </div>
                <div style={{ position: "absolute", left: "calc(50% - 300px)" }}>
                    <span style={{ color: '#fff' }}>{timeStampToDate(props.time)}</span>
                    {props.matrixName === 'bigBed' || props.matrixName === 'car' ? <input type="text" onChange={(e) => {
                        const value = Number(e.target.value)
                        const line = document.querySelector(".progressLine");
                        props.wsSendObj({ value });
                        line.style.left = `${20 + (value * 560) / (props.length ? props.length : 1)}px`;
                    }} /> : null}
                </div>
            </div>
        </div>
    )
})
export default ProgressCom