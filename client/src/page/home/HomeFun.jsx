import React, { useEffect, useRef, useState } from 'react'
import Title from '../../components/title/Title'
import './index.scss'
// import Canvas from '../../components/three/Three'
// import CanvasHand from '../../components/three/hand'
import CanvasCar from '../../components/three/carnewTest'
import Aside from '../../components/aside/Aside'
import plus from '../../assets/images/Plus.png'
import minus from '../../assets/images/Minus.png'
import icon from '../../assets/images/Icon.png'
import icon1 from '../../assets/images/Icon_1.png'
import icon2 from '../../assets/images/Icon_2.png'
import icon3 from '../../assets/images/Icon_3.png'
import load from '../../assets/images/load.png'
import stop from '../../assets/images/stop.png'
import play from '../../assets/images/play.png'
import pause from '../../assets/images/pause.png'
import { findMax, findMin, returnChartMax, } from '../../assets/util/util'
import { rainbowColors, rainbowTextColors } from "../../assets/util/color";
import { handLine, footLine, carSitLine, carBackLine } from '../../assets/util/line';
import { Select, Slider, Popover } from 'antd'
import * as echarts from 'echarts'
import { SelectOutlined } from '@ant-design/icons'

let ws, xvalue = 0, yvalue = 0, myChart2, sitIndexArr = new Array(4).fill(0), backIndexArr = new Array(4).fill(0), sitPress = 0, backPress = 0;
let backTotal = 0, backMean = 0, backMax = 0, backMin = 0, backPoint = 0, backArea = 0, sitTotal = 0, sitMean = 0, sitMax = 0, sitMin = 0, sitPoint = 0, sitArea = 0

const dataArr1 = [
  {
    color: '#2A99FF',
    data: '平均压力',
    eng: 'Mean Pres'
  }, {
    color: '#FF2A2A',
    data: '最大压力',
    eng: 'Max Pres'
  }, {
    color: '#FFA63F',
    data: '最小压力',
    eng: 'Min Pres'
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
  }, {
    color: '#FF2A2A',
    data: '压强',
    eng: 'Pressure'
  }, {
    color: '#FFA63F',
    data: '压力标准差',
    eng: 'Pres Standard'
  }
]


class Com extends React.Component {
  constructor(props) {
    super(props)
  }
  shouldComponentUpdate() {
    return false
  }
  render() {
    console.log(this.props)
    return (
      <>{this.props.children}</>
    )
  }
}

let totalArr = [], totalPointArr = [], wsMatrixName = 'foot'

// data.current?.setMeanPres(totalMean)
// data.current?.setMaxPres(totalMax)
// data.current?.setPoint(totalPoint)
// data.current?.setArea(totalArea)
// data.current?.setTotalPres(totalPress)
// if(sitPoint < 100){
//   data.current?.setPressure(0)
// }else{
//   data.current?.setPressure((sitMax*1000/sitArea).toFixed(2))
// }


let num = 0, colValueFlag = false, meanSmooth = 0, maxSmooth = 0, pointSmooth = 0, areaSmooth = 0, pressSmooth = 0, pressureSmooth = 0
export default function Home() {
  const com = useRef()
  const data = useRef()
  const [valueg1, setValueg1] = useState(localStorage.getItem('carValueg') ? JSON.parse(localStorage.getItem('carValueg')) : 2)
  const [valuej1, setValuej1] = useState(localStorage.getItem('carValuej') ? JSON.parse(localStorage.getItem('carValuej')) : 200)
  const [valuel1, setValuel1] = useState(localStorage.getItem('carValuel') ? JSON.parse(localStorage.getItem('carValuel')) : 2)
  const [valuef1, setValuef1] = useState(localStorage.getItem('carValuef') ? JSON.parse(localStorage.getItem('carValuef')) : 2)
  const [value1, setValue1] = useState(localStorage.getItem('carValue') ? JSON.parse(localStorage.getItem('carValue')) : 2)
  const [valuelInit1, setValuelInit1] = useState(localStorage.getItem('carValueInit') ? JSON.parse(localStorage.getItem('carValueInit')) : 2)
  const [port, setPort] = useState([{ value: ' ', label: ' ' }])
  const [portname, setPortname] = useState('')
  const [portnameBack, setPortnameBack] = useState('')
  const [matrixName, setMatrixName] = useState('car')
  const [length, setLength] = useState(0)
  const [local, setLocal] = useState(false)
  const [dataArr, setDataArr] = useState([])
  const [index, setIndex] = useState(0)
  const [playflag, setPlayflag] = useState(false)
  const [time, setTime] = useState([])
  const [xdata, setXdata] = useState(0)
  const [sitArr, setSitArr] = useState([])
  const [backArr, setBackArr] = useState([])
  const [selectFlag, setSelectFlag] = useState(false)
  const [colFlag, setColFlag] = useState(true)
  const [colNum, setColNum] = useState(0)
  const setColValueFlag = (value) => {
    colValueFlag = value
  }

  useEffect(() => {

    ws = new WebSocket(" ws://127.0.0.1:19999");
    ws.onopen = () => {
      // connection opened
      console.info("connect success");
    };
    ws.onmessage = (e) => {
      sitPress = 0
      let jsonObject = JSON.parse(e.data);
      //处理空数组

      if (jsonObject.sitData != null) {

        if (colValueFlag) {
          num++
          setColNum(num)
        } else {
          num = 0
        }
        // console.log(num)

        let selectArr
        let wsPointData = jsonObject.sitData;
        // console.log(wsPointData)
        if (!Array.isArray(wsPointData)) {
          wsPointData = JSON.parse(wsPointData);
        }

        if (matrixName == 'foot') {
          const { sitData, backData } = footLine(wsPointData)
          com.current?.changeDataFlag();
          com.current?.sitData({
            wsPointData: sitData,
          });

          com.current?.backData({
            wsPointData: backData,
          });
        } else if (matrixName == 'hand') {
          wsPointData = handLine(wsPointData)
          com.current?.sitData({
            wsPointData: wsPointData,
          });

        } else if (matrixName == 'car') {
          wsPointData = carSitLine(wsPointData)
          com.current?.sitData({
            wsPointData: wsPointData,
          });
          selectArr = []

          for (let i = sitIndexArr[0]; i < sitIndexArr[1]; i++) {
            for (let j = sitIndexArr[2]; j < sitIndexArr[3]; j++) {
              // sitPress += wsPointData[i*32 + j]
              selectArr.push(wsPointData[i * 32 + j])
            }
          }

          // com.current?.sitRenew(wsPointData);
        }

        let DataArr
        if (sitIndexArr.every((a) => a == 0) && backIndexArr.every((a) => a == 0)) {
          DataArr = [...wsPointData]
        } else {
          DataArr = [...selectArr]
        }
        sitPoint = DataArr.filter((a) => a > 10).length
        sitTotal = DataArr.reduce((a, b) => a + b, 0)
        sitMean = parseInt(sitTotal / (sitPoint ? sitPoint : 1))
        sitMax = findMax(DataArr)
        sitMin = findMin(DataArr.filter((a) => a > 10))
        sitArea = sitPoint * 4
        if (sitPoint < 80) {
          sitMean = 0
          sitMax = 0
          sitTotal = 0
          sitPoint = 0
          sitArea = 0
        }






        // console.log(totalArr)

        // data.current?.initCharts2(totalArr)
      }

      if (jsonObject.backData != null) {
        backPress = 0
        let wsPointData = jsonObject.backData;
        // console.log(wsPointData)
        if (!Array.isArray(wsPointData)) {
          wsPointData = JSON.parse(wsPointData);
        }
        // const date = Date.now()
        wsPointData = carBackLine(wsPointData)
        // console.log(wsPointData)
        // wsPointData = new Array(1024).fill(0)
        // wsPointData[1023] = 100
        // const nowDate = Date.now() - date
        // console.log(nowDate)
        com.current?.backData({
          wsPointData: wsPointData,
        });


        const selectArr = []
        for (let i = 31 - backIndexArr[0]; i > 31 - backIndexArr[1]; i--) {
          for (let j = backIndexArr[2]; j < backIndexArr[3]; j++) {
            selectArr.push(wsPointData[i * 32 + j])
          }
        }

        // const SelectTotalPress = backPress + sitPress

        let DataArr
        if (sitIndexArr.every((a) => a == 0) && backIndexArr.every((a) => a == 0)) {
          DataArr = [...wsPointData]
        } else {
          DataArr = [...selectArr]
        }

        // console.log(DataArr)
        backTotal = DataArr.reduce((a, b) => a + b, 0)
        backPoint = DataArr.filter((a) => a > 10).length
        backMean = parseInt(backTotal / (backPoint ? backPoint : 1))
        backMax = findMax(DataArr)
        backMin = findMin(DataArr.filter((a) => a > 10))
        backArea = backPoint * 4
        if (backPoint < 80) {
          backMean = 0
          backMax = 0
          backTotal = 0
          backPoint = 0
          backArea = 0
        }



        const totalPress = backTotal + sitTotal
        let totalMean = ((backMean + sitMean) / 2).toFixed(0)
        if (backMean == 0) {
          totalMean = sitMean
        }
        if (sitMean == 0) {
          totalMean = backMean
        }
        const totalMax = Math.max(backMax, sitMax)
        const totalPoint = backPoint + sitPoint
        const totalArea = backArea + sitArea
        const totalMin = Math.min(backMin, sitMin)
        const sitPressure = sitMax * 1000 / (sitArea ? sitArea : 1)
        // meanSmooth=0 , maxSmooth=0 , pointSmooth=0 , areaSmooth=0 , pressSmooth =0, pressureSmooth=0
        meanSmooth = parseInt(meanSmooth + (totalMean - meanSmooth) / 10)
        maxSmooth = parseInt(maxSmooth + (totalMax - maxSmooth) / 10)
        pointSmooth = parseInt(pointSmooth + (totalPoint - pointSmooth) / 10)
        areaSmooth = parseInt(areaSmooth + (totalArea - areaSmooth) / 10)
        pressSmooth = parseInt(pressSmooth + (totalPress - pressSmooth) / 10)
        pressureSmooth = parseInt(pressureSmooth + (sitPressure - pressureSmooth) / 10)
        if (sitPoint < 100) {
          pressureSmooth = 0
        }
        // console.log(sitPressure , pressureSmooth)

        // data.current?.setMeanPres(totalMean)
        // data.current?.setMaxPres(totalMax)
        // data.current?.setPoint(totalPoint)
        // data.current?.setArea(totalArea)
        // data.current?.setTotalPres(totalPress)
        // if(sitPoint < 100){
        //   data.current?.setPressure(0)
        // }else{
        //   data.current?.setPressure((sitMax*1000/sitArea).toFixed(2))
        // }
        data.current?.changeData({ meanPres: meanSmooth, maxPres: maxSmooth, point: pointSmooth, area: areaSmooth, press: pressSmooth, pressure: pressureSmooth })
        // data.current?.setMeanPres(meanSmooth)
        // data.current?.setMaxPres(maxSmooth)
        // data.current?.setPoint(pointSmooth)
        // data.current?.setArea(areaSmooth)
        // data.current?.setTotalPres(pressSmooth)
        // if(sitPoint < 100){
        //   data.current?.setPressure(0)
        // }else{
        //   data.current?.setPressure(pressureSmooth.toFixed(2))
        // }


        if (totalArr.length < 20) {
          totalArr.push(totalPress)
        } else {
          totalArr.shift()
          totalArr.push(totalPress)
        }
        // console.log(totalArr.length)
        const max = findMax(totalArr)
        data.current?.handleCharts(totalArr, returnChartMax(max))

        if (totalPointArr.length < 20) {
          totalPointArr.push(totalPoint)
        } else {
          totalPointArr.shift()
          totalPointArr.push(totalPoint)
        }

        const max1 = findMax(totalPointArr)
        data.current?.handleChartsArea(totalPointArr, returnChartMax(max1))

      }

      if (jsonObject.port != null) {
        console.log(jsonObject.port)
        const port = []
        jsonObject.port.forEach((a, index) => {
          port.push({
            value: a.path,
            label: a.path
          })
        })
        // console.log(port)
        setPort(port);
      }
      if (jsonObject.length != null) {
        setLength(jsonObject.length)
      }
      if (jsonObject.time != null) {
        setTime(jsonObject.time)
      }
      if (jsonObject.timeArr != null) {
        // const arr = []
        const arr = jsonObject.timeArr.map((a, index) => a.date)
        // console.log(arr)
        let obj = []
        arr.forEach((a, index) => {
          obj.push({
            value: a,
            label: a
          })
        })
        setDataArr(obj)
      }
      // console.log(jsonObject)
      if (jsonObject.index != null) {
        // console.log(index , length)
        if(jsonObject.index <= length){
          setIndex(jsonObject.index)
        }
        
      }

    };
    ws.onerror = (e) => {
      // an error occurred
    };
    ws.onclose = (e) => {
      // connection closed
    };

  }, [])

  const getPath = (e) => {
    console.log(e, e.fullPath)
  }

  const wsSendObj = (obj) => {
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify(obj));
    }
    // if (obj.file) {
    //   if (ws && ws.readyState === 1) {
    //     ws.send(JSON.stringify({ file: obj.file }));
    //   }
    // }

    // if (obj.sitPort) {
    //   if (ws && ws.readyState === 1) {
    //     ws.send(JSON.stringify({ sitPort: obj.sitPort }));
    //   }
    // }

    // if (obj.backPort) {
    //   if (ws && ws.readyState === 1) {
    //     ws.send(JSON.stringify({ backPort: obj.backPort }));
    //   }
    // }

    // if (obj.flag != null) {
    //   if (ws && ws.readyState === 1) {
    //     ws.send(JSON.stringify({ flag: obj.flag }));
    //   }
    // }

    // if (obj.getTime) {
    //   if (ws && ws.readyState === 1) {
    //     ws.send(JSON.stringify({ getTime: obj.getTime }));
    //   }
    // }

    // if (obj.local) {
    //   if (ws && ws.readyState === 1) {
    //     ws.send(JSON.stringify({ local: obj.local }));
    //   }
    // }

    // if (obj.time) {
    //   if (ws && ws.readyState === 1) {
    //     ws.send(JSON.stringify({ time: obj.time }));
    //   }
    // }

    // if (obj.speed) {
    //   if (ws && ws.readyState === 1) {
    //     ws.send(JSON.stringify({ speed: obj.speed }));
    //   }
    // }

    // if (obj.index != null) {
    //   if (ws && ws.readyState === 1) {
    //     ws.send(JSON.stringify({ index: obj.index }));
    //   }
    // }

    // if (obj.exchange != null) {
    //   if (ws && ws.readyState === 1) {
    //     ws.send(JSON.stringify({ exchange: obj.exchange }));
    //   }
    // }


  }

  const playData = (value) => {
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify({ play: value }));
      setPlayflag(value)
    }
  }

  const changeMatrix = (e) => {
    console.log(e)
    setMatrixName(e)
    wsMatrixName = e
  }

  const changeDateArr = (matrixName) => {
    if (matrixName == 'foot') {
      const dataArr = localStorage.getItem('dataArr')
      const arr = dataArr ? JSON.parse(dataArr) : []
      setDataArr(arr)
    } else if (matrixName == 'hand') {
      const dataArr = localStorage.getItem('handArr')
      const arr = dataArr ? JSON.parse(dataArr) : []
      setDataArr(arr)
    } else if (matrixName == 'car') {
      const dataArr = localStorage.getItem('carArr')
      const arr = dataArr ? JSON.parse(dataArr) : []
      setDataArr(arr)
    }
  }

  const changeLocal = (value) => {
    setLocal(value)
    // changeDateArr(matrixName)

    if (ws && ws.readyState === 1) {
      if (value) {
        ws.send(JSON.stringify({ local: true }));
      } else {
        ws.send(JSON.stringify({ local: false }));
      }

    }
  }

  const formatter = (value) => {

    return `${value}%`
  };

  const changeValue = (value) => {
    return value < 8 ? 0 : value > 68 ? 31 : Math.round((value - 8) / 2)
  }

  const changeSelect = (obj) => {

    let sit = obj.sit
    let back = obj.back
    // console.log(sit , back , 'length')
    const sitIndex = sit.length ? sit.map((a) => { return changeValue(a) }) : []
    const backIndex = back.length ? back.map((a) => { return changeValue(a) }) : []
    // setSitArr(obj.sit)
    // setBackArr(obj.back)

    sitIndexArr = sitIndex
    backIndexArr = backIndex


  }


  const text = '旋转'
  const text2 = '框选'

  const content = (
    <div>
      <p>绕x轴旋转30°</p>
    </div>
  );

  const content1 = (
    <div>
      <p>绕y轴旋转30°</p>
    </div>
  );

  const content2 = (
    <div>
      <p>款选一个矩形区域</p>
    </div>
  );
  console.log('home')
  return (
    <div className='home'>
      <div className="setIcons">
        <div className="setIconItem setIconItem1">
          <Popover placement="top" title={text} content={content}
          // arrow={mergedArrow}
          >
            <div className='setIcon marginB10' onClick={() => {

              xvalue++
              if (xvalue < 3) {
                // com.current?.changeGroupRotate({ x: xvalue })
                console.log(xvalue)
              } else {
                xvalue = 0
                // com.current?.changeGroupRotate({ x: xvalue })
              }
            }}>
              <img src={plus} alt="" />
            </div>
          </Popover>

          <Popover placement="top" title={text} content={content1}
          // arrow={mergedArrow}
          >
            <div className='setIcon' onClick={() => {
              yvalue++
              if (yvalue < 3) {
                // com.current?.changeGroupRotate({ y: yvalue })
                console.log(yvalue)
              } else {
                yvalue = 0
                // com.current?.changeGroupRotate({ y: yvalue })
                console.log(yvalue)
              }
            }}>
              <img src={minus} alt="" />
            </div>
          </Popover>
        </div>

        <div className="setIconItem setIconItem2">
          <div className='setIcon'>
            <img src={icon} alt="" onClick={() => {
              com.current?.reset()
            }} />
          </div>
        </div>

        <div className="setIconItem setIconItem2">
          <div className='setIcon marginB10' onClick={() => {
            console.log('load')
            const date = new Date(Date.now());
            const formattedDate = date.toLocaleString();
            // if (matrixName == 'foot') {
            //   const dataArr = localStorage.getItem('dataArr')
            //   const arr = dataArr ? JSON.parse(dataArr) : []
            //   arr.push(formattedDate)
            //   localStorage.setItem('dataArr', JSON.stringify(arr))
            // } else if (matrixName == 'hand') {
            //   const dataArr = localStorage.getItem('handArr')
            //   const arr = dataArr ? JSON.parse(dataArr) : []
            //   arr.push(formattedDate)
            //   localStorage.setItem('handArr', JSON.stringify(arr))
            // } else if (matrixName == 'car') {
            //   const dataArr = localStorage.getItem('handArr')
            //   const arr = dataArr ? JSON.parse(dataArr) : []
            //   arr.push(formattedDate)
            //   localStorage.setItem('handArr', JSON.stringify(arr))
            // }


            wsSendObj({ flag: true, time: formattedDate })
          }}>
            <img src={load} alt="" />
          </div>
          <div className='setIcon marginB10' onClick={() => {
            console.log('load')
            wsSendObj({ flag: false })
          }}>
            <img src={stop} alt="" />
          </div>
          <Popover placement="top" title={text2} content={content2}
          // arrow={mergedArrow}
          >
            <div className='setIcon'
              onClick={() => {
                const flag = selectFlag
                setSelectFlag(!flag)
                // com.current?.changeSelectFlag(flag)
              }}
            >

              {/* <img src={icon2} alt="" /> */}
              <SelectOutlined style={{ color: selectFlag ? '#fff' : '#4c4671', fontSize: '20px' }} color={selectFlag ? '#fff' : '#4c4671'} />
              {/* <input type="file" id='fileInput' onChange={(e) => getPath(e)}
            /> */}
            </div>
          </Popover>
        </div>
      </div>


      <div style={{ position: 'fixed', display: 'flex', flexDirection: 'column', right: '3%', height: '55%', bottom: '6%', boxSizing: 'border-box', }}>
        {rainbowTextColors.slice(0, rainbowTextColors.length - 7).map((items, indexs) => {
          return (
            <div key={`${rainbowTextColors[items]}${indexs}`} style={{ display: "flex", height: `${100 / rainbowTextColors.slice(0, rainbowTextColors.length - 7).length}%`, alignItems: 'center', padding: '3px', boxSizing: 'border-box' }}>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  flex: 1,
                  padding: "0px 10px",
                }}
              >
                <div
                  className="switch"
                  style={{
                    color: "#ccc",
                    // minWidth: "80px",
                    textAlign: "left",
                  }}
                >
                  {(0.92 * ((rainbowTextColors.length - 1 - indexs)) / rainbowTextColors.length).toFixed(2)}N/cm^2
                </div>
                <div className="switchLevels"></div>
              </div>
              <div
                style={{
                  width: 50,
                  height: '100%',
                  backgroundColor: `rgb(${items})`,

                }}
              ></div>

            </div>
          );
        })}
      </div>
      {/* <Com valueg1={valueg1}
        value1={value1}
        valuef1={valuef1}
        valuel1={valuel1}
        valuej1={valuej1}
        valuelInit1={valuelInit1}
        port={port}
        portname={portname}
        portnameBack={portnameBack}
        local={local}
        dataArr={dataArr}
      > */}
        <Title
          valueg1={valueg1}
          value1={value1}
          valuef1={valuef1}
          valuel1={valuel1}
          valuej1={valuej1}
          valuelInit1={valuelInit1}
          setValueg1={setValueg1}
          setValuej1={setValuej1}
          setValuef1={setValuef1}
          setValuel1={setValuel1}
          setValue1={setValue1}
          setValuelInit1={setValuelInit1}
          com={com}
          port={port}
          portname={portname}
          portnameBack={portnameBack}
          local={local}
          dataArr={dataArr}
          matrixName={matrixName}
          setPortname={setPortname}
          setPortnameBack={setPortnameBack}
          wsSendObj={wsSendObj}
          changeMatrix={changeMatrix}
          changeLocal={changeLocal}
          colFlag={colFlag}
          setColValueFlag={setColValueFlag}
          setColFlag={setColFlag}
          colNum={colNum}
        // changeDateArr={changeDateArr}
        />
      {/* </Com> */}
      <Com>
        <Aside ref={data} />

      </Com>


      {/* {matrixName == 'foot' ? <Canvas ref={com} /> : matrixName == 'hand' ? <CanvasHand ref={com} /> : 
      
      
      
      } */}
      <Com>
        <CanvasCar ref={com} changeSelect={changeSelect} /></Com>

      {local ?
        <div style={{ position: "fixed", bottom: 0, width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ width: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', position: 'relative' }}>
            <Slider
              tooltip={{
                formatter,
              }}

              min={0}
              max={length - 2}
              onChange={(value) => {
                localStorage.setItem("localValuej", value);
                console.log(value)
                setIndex(value)
                if (ws && ws.readyState === 1) {
                  ws.send(JSON.stringify({ value }))
                }
              }}
              value={index}
              step={1}
              style={{ width: '100%' }}
            />
            <div>
              <img src={play} style={{ width: '50px', display: playflag ? 'none' : 'unset' }}
                onClick={() => { playData(true) }}
                alt="" />
              <img src={pause} style={{ width: '50px', display: playflag ? 'unset' : 'none' }}
                onClick={() => { playData(false) }}
                alt="" />
              <div style={{ position: 'absolute', bottom: 0, right: '20%' }}>
                <Select
                  defaultValue="1.0X"
                  style={{
                    width: 80,
                  }}
                  onChange={(e) => {
                    console.log(e)
                    wsSendObj({ speed: e })
                  }}

                  dropdownMatchSelectWidth={false}
                  placement={'topLeft'}
                  options={[
                    {
                      value: 0.25,
                      label: '0.25X',
                    },
                    {
                      value: 0.5,
                      label: '0.5X',
                    },
                    {
                      value: 1,
                      label: '1.0X',
                    },
                    {
                      value: 1.5,
                      label: '1.5X',
                    },
                    {
                      value: 2,
                      label: '2.0X',
                    },
                  ]}
                />
              </div>
            </div>
          </div>
        </div> : null}
    </div>
  )
}


class Home extends React.Component{
  constructor(){
    super()
  }

  render(){
    return(
      <div className='home'>
      <div className="setIcons">
        <div className="setIconItem setIconItem1">
          <Popover placement="top" title={text} content={content}
          // arrow={mergedArrow}
          >
            <div className='setIcon marginB10' onClick={() => {

              xvalue++
              if (xvalue < 3) {
                // com.current?.changeGroupRotate({ x: xvalue })
                console.log(xvalue)
              } else {
                xvalue = 0
                // com.current?.changeGroupRotate({ x: xvalue })
              }
            }}>
              <img src={plus} alt="" />
            </div>
          </Popover>

          <Popover placement="top" title={text} content={content1}
          // arrow={mergedArrow}
          >
            <div className='setIcon' onClick={() => {
              yvalue++
              if (yvalue < 3) {
                // com.current?.changeGroupRotate({ y: yvalue })
                console.log(yvalue)
              } else {
                yvalue = 0
                // com.current?.changeGroupRotate({ y: yvalue })
                console.log(yvalue)
              }
            }}>
              <img src={minus} alt="" />
            </div>
          </Popover>
        </div>

        <div className="setIconItem setIconItem2">
          <div className='setIcon'>
            <img src={icon} alt="" onClick={() => {
              com.current?.reset()
            }} />
          </div>
        </div>

        <div className="setIconItem setIconItem2">
          <div className='setIcon marginB10' onClick={() => {
            console.log('load')
            const date = new Date(Date.now());
            const formattedDate = date.toLocaleString();
            // if (matrixName == 'foot') {
            //   const dataArr = localStorage.getItem('dataArr')
            //   const arr = dataArr ? JSON.parse(dataArr) : []
            //   arr.push(formattedDate)
            //   localStorage.setItem('dataArr', JSON.stringify(arr))
            // } else if (matrixName == 'hand') {
            //   const dataArr = localStorage.getItem('handArr')
            //   const arr = dataArr ? JSON.parse(dataArr) : []
            //   arr.push(formattedDate)
            //   localStorage.setItem('handArr', JSON.stringify(arr))
            // } else if (matrixName == 'car') {
            //   const dataArr = localStorage.getItem('handArr')
            //   const arr = dataArr ? JSON.parse(dataArr) : []
            //   arr.push(formattedDate)
            //   localStorage.setItem('handArr', JSON.stringify(arr))
            // }


            wsSendObj({ flag: true, time: formattedDate })
          }}>
            <img src={load} alt="" />
          </div>
          <div className='setIcon marginB10' onClick={() => {
            console.log('load')
            wsSendObj({ flag: false })
          }}>
            <img src={stop} alt="" />
          </div>
          <Popover placement="top" title={text2} content={content2}
          // arrow={mergedArrow}
          >
            <div className='setIcon'
              onClick={() => {
                const flag = selectFlag
                setSelectFlag(!flag)
                // com.current?.changeSelectFlag(flag)
              }}
            >

              {/* <img src={icon2} alt="" /> */}
              <SelectOutlined style={{ color: selectFlag ? '#fff' : '#4c4671', fontSize: '20px' }} color={selectFlag ? '#fff' : '#4c4671'} />
              {/* <input type="file" id='fileInput' onChange={(e) => getPath(e)}
            /> */}
            </div>
          </Popover>
        </div>
      </div>


      <div style={{ position: 'fixed', display: 'flex', flexDirection: 'column', right: '3%', height: '55%', bottom: '6%', boxSizing: 'border-box', }}>
        {rainbowTextColors.slice(0, rainbowTextColors.length - 7).map((items, indexs) => {
          return (
            <div key={`${rainbowTextColors[items]}${indexs}`} style={{ display: "flex", height: `${100 / rainbowTextColors.slice(0, rainbowTextColors.length - 7).length}%`, alignItems: 'center', padding: '3px', boxSizing: 'border-box' }}>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  flex: 1,
                  padding: "0px 10px",
                }}
              >
                <div
                  className="switch"
                  style={{
                    color: "#ccc",
                    // minWidth: "80px",
                    textAlign: "left",
                  }}
                >
                  {(0.92 * ((rainbowTextColors.length - 1 - indexs)) / rainbowTextColors.length).toFixed(2)}N/cm^2
                </div>
                <div className="switchLevels"></div>
              </div>
              <div
                style={{
                  width: 50,
                  height: '100%',
                  backgroundColor: `rgb(${items})`,

                }}
              ></div>

            </div>
          );
        })}
      </div>
      {/* <Com valueg1={valueg1}
        value1={value1}
        valuef1={valuef1}
        valuel1={valuel1}
        valuej1={valuej1}
        valuelInit1={valuelInit1}
        port={port}
        portname={portname}
        portnameBack={portnameBack}
        local={local}
        dataArr={dataArr}
      > */}
        <Title
          valueg1={valueg1}
          value1={value1}
          valuef1={valuef1}
          valuel1={valuel1}
          valuej1={valuej1}
          valuelInit1={valuelInit1}
          setValueg1={setValueg1}
          setValuej1={setValuej1}
          setValuef1={setValuef1}
          setValuel1={setValuel1}
          setValue1={setValue1}
          setValuelInit1={setValuelInit1}
          com={com}
          port={port}
          portname={portname}
          portnameBack={portnameBack}
          local={local}
          dataArr={dataArr}
          matrixName={matrixName}
          setPortname={setPortname}
          setPortnameBack={setPortnameBack}
          wsSendObj={wsSendObj}
          changeMatrix={changeMatrix}
          changeLocal={changeLocal}
          colFlag={colFlag}
          setColValueFlag={setColValueFlag}
          setColFlag={setColFlag}
          colNum={colNum}
        // changeDateArr={changeDateArr}
        />
      {/* </Com> */}
      <Com>
        <Aside ref={data} />

      </Com>


      {/* {matrixName == 'foot' ? <Canvas ref={com} /> : matrixName == 'hand' ? <CanvasHand ref={com} /> : 
      
      
      
      } */}
      <Com>
        <CanvasCar ref={com} changeSelect={changeSelect} /></Com>

      {local ?
        <div style={{ position: "fixed", bottom: 0, width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ width: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', position: 'relative' }}>
            <Slider
              tooltip={{
                formatter,
              }}

              min={0}
              max={length - 2}
              onChange={(value) => {
                localStorage.setItem("localValuej", value);
                console.log(value)
                setIndex(value)
                if (ws && ws.readyState === 1) {
                  ws.send(JSON.stringify({ value }))
                }
              }}
              value={index}
              step={1}
              style={{ width: '100%' }}
            />
            <div>
              <img src={play} style={{ width: '50px', display: playflag ? 'none' : 'unset' }}
                onClick={() => { playData(true) }}
                alt="" />
              <img src={pause} style={{ width: '50px', display: playflag ? 'unset' : 'none' }}
                onClick={() => { playData(false) }}
                alt="" />
              <div style={{ position: 'absolute', bottom: 0, right: '20%' }}>
                <Select
                  defaultValue="1.0X"
                  style={{
                    width: 80,
                  }}
                  onChange={(e) => {
                    console.log(e)
                    wsSendObj({ speed: e })
                  }}

                  dropdownMatchSelectWidth={false}
                  placement={'topLeft'}
                  options={[
                    {
                      value: 0.25,
                      label: '0.25X',
                    },
                    {
                      value: 0.5,
                      label: '0.5X',
                    },
                    {
                      value: 1,
                      label: '1.0X',
                    },
                    {
                      value: 1.5,
                      label: '1.5X',
                    },
                    {
                      value: 2,
                      label: '2.0X',
                    },
                  ]}
                />
              </div>
            </div>
          </div>
        </div> : null}
    </div>
    )
  }
}
