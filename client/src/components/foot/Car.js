import React, { useEffect, useRef } from "react";
import Three from "./Three1";
// import Three from "./Three1 copy";
import { useNavigate } from "react-router-dom";
import { Slider, Button, Input } from "antd";
import * as echarts from "echarts";
// import { rotate90 } from "../../assets/util/util";
import plane from "../../assets/images/plane.png";
import { Select } from "element-react";
import "element-theme-default";
let myChart1;
let ws, ws1;

const switchs = [
  "座椅向前",
  "座椅向后",
  "靠背向前",
  "靠背向后",
  "坐垫前上升",
  "坐垫前下降",
  "坐垫后上升",
  "坐垫后下降",
  "腰托气囊1",
  "腰托气囊2",
  "腰托气囊3",
];

const initCharts = (props) => {
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
      splitLine: {
        show: true,
        lineStyle: {
          //   type: "dotted",
          color: "rgba(70,132,147,0.5)",
        },
      },
      data: props.xData,
      axisLabel: {
        show: true,
        textStyle: {
          color: "transparent",
        },
      },
    },

    yAxis: {
      type: "value",
      splitNumber: 4,
      splitLine: {
        show: true,
        lineStyle: {
          //   type: "dotted",
          color: "rgba(70,132,147,0.5)",
        },
      },
      max: 15000,
      axisLabel: {
        show: true,
        textStyle: {
          color: "transparent",
        },
      },
    },
    series: [
      {
        symbol: "none",
        data: props.yData,
        type: "line",
        smooth: true,
        color: "#3591c3",

        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 1,
            x2: 0,
            y2: 0,
            colorStops: [
              {
                offset: 1,
                color: "#266689", // 0% 处的颜色
              },
              {
                offset: 0,
                color: "#10152b", // 100% 处的颜色
              },
            ],
            global: false, // 缺省为 false
          },
        },
      },
      {},
    ],
  };

  option && props.myChart.setOption(option);

  // window.addEventListener("resize", function () {
  //   props.myChart.resize();
  // });
};
let car = [];
// const switchArr = [[0,1,2,3,4,5,6,7,8],[0,1,2,3,4,5,6,7,8],[0,1,2,3,4,5,6,7,8],[0,1,2,3,4,5,6,7,8],[0,1,2,3,4,5,6,7,8],[0,1,2,3,4,5,6,7,8],[0,1,2,3,4,5,6,7,8],[0,1,2,3,4,5,6,7,8],]
const switchArr = new Array(11).fill(new Array(8).fill(0));
const switchStatusArr = [0, 1, 4, 2, 3, 2, 4, 3, 5, 8, 1];

class Com extends React.Component {
  constructor(props) {
    super(props);
  }
  shouldComponentUpdate(nextProps) {
    return false;
  }
  render() {
    return <>{this.props.children}</>;
  }
}

function withRouter(Com) {
  return () => {
    const navigate = useNavigate();
    return <Com navigate={navigate} />;
  };
}

class Car extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      valuej1: Number(localStorage.getItem("chairValuejGl"))
        ? Number(localStorage.getItem("chairValuejGl"))
        : 200, //
      valueg1: Number(localStorage.getItem("chairValuegGl"))
        ? Number(localStorage.getItem("chairValuegGl"))
        : 2,
      value1: Number(localStorage.getItem("chairValueGl"))
        ? Number(localStorage.getItem("chairValueGl"))
        : 1.78,
      valuef1: Number(localStorage.getItem("chairValuefGl"))
        ? Number(localStorage.getItem("chairValuefGl"))
        : 3,
      valuel1: Number(localStorage.getItem("chairValuelGl"))
        ? Number(localStorage.getItem("chairValuelGl"))
        : 8,
      valuelInit1: Number(localStorage.getItem("chairValueInitGl1"))
        ? Number(localStorage.getItem("chairValueInitGl1"))
        : 500,
      valuelInit2: Number(localStorage.getItem("chairValueInitGl2"))
        ? Number(localStorage.getItem("chairValueInitGl2"))
        : 500,
      // back
      valuej2: Number(localStorage.getItem("chairValuejGl"))
        ? Number(localStorage.getItem("chairValuejGl"))
        : 200, //
      valueg2: Number(localStorage.getItem("chairValuegGl"))
        ? Number(localStorage.getItem("chairValuegGl"))
        : 2,
      value2: Number(localStorage.getItem("chairValueGl"))
        ? Number(localStorage.getItem("chairValueGl"))
        : 1.78,
      valuef2: Number(localStorage.getItem("chairValuefGl"))
        ? Number(localStorage.getItem("chairValuefGl"))
        : 3,
      valuel2: Number(localStorage.getItem("chairValuelGl"))
        ? Number(localStorage.getItem("chairValuelGl"))
        : 8,
      open: true,
      pain: { waist: 0 },
      switchStatusArr: new Array(11).fill(0),
      renderFlag: true,
      sitData: [],
      backData: [],
      port: [],
      local: false,
      sitPath: "",
      backPath: "",
      length: 10,
      time: 0,
    };
    this.com = React.createRef();
    this.com1 = React.createRef();
    this.footForm = React.createRef();
    this.pronation = React.createRef();
    this.lfc = React.createRef();
    this.balanceText = React.createRef();
    this.balance = React.createRef();
    // this.state = React.createRef();
    this.stroke = React.createRef();
    this.breathPause = React.createRef();
  }

  shouldComponentUpdate(nextProps, nextState) {
    // console.log(nextProps.port , nextState.port , nextProps.renderFlag, nextState.renderFlag)
    return (
      this.state.port != nextState.port ||
      this.state.renderFlag != nextState.renderFlag ||
      this.state.value1 != nextState.value1 ||
      this.state.value2 != nextState.value2 ||
      this.state.valuej1 != nextState.valuej1 ||
      this.state.valuej2 != nextState.valuej2 ||
      this.state.valueg1 != nextState.valueg1 ||
      this.state.valueg2 != nextState.valueg2 ||
      this.state.valuef1 != nextState.valuef1 ||
      this.state.valuef2 != nextState.valuef2 ||
      this.state.valuel1 != nextState.valuel1 ||
      this.state.valuel2 != nextState.valuel2 ||
      this.state.valuelInit1 != nextState.valuelInit1 ||
      this.state.valuelInit2 != nextState.valuelInit2 ||
      this.state.local != nextState.local ||
      this.state.index != nextState.index ||
      this.state.sitPath != nextState.sitPath ||
      this.state.backPath != nextState.backPath ||
      this.state.length != nextState.length ||
      this.state.time != nextState.time
    );
  }

  componentDidMount() {
    // myChart1 = echarts.init(document.getElementById(`myChart1`));

    // ws = new WebSocket("ws://127.0.0.1:19999");
    // ws = new WebSocket(" ws://sensor.bodyta.com:8888/bed/ec4d3e7ec6e9");
    function setRem() {
      document.documentElement.style.fontSize = `${
        document.documentElement.clientWidth / 100
      }px`;
    }
    setRem();
    console.log(document.documentElement.style.fontSize);
    window.addEventListener("resize", () => {
      setRem();
      console.log(document.documentElement.style.fontSize);
    });

    ws = new WebSocket(" ws://localhost:19999");
    ws.onopen = () => {
      // connection opened
      console.info("connect success");
    };
    ws.onmessage = (e) => {
      let jsonObject = JSON.parse(e.data);
      //处理空数组

      if (jsonObject.backData != null) {
        this.setState({
          renderFlag: true,
        });

        let wsPointData = jsonObject.backData;

        if (!Array.isArray(wsPointData)) {
          console.log(wsPointData);
          wsPointData = JSON.parse(JSON.parse(wsPointData));
        }
        if (car.length < 20) {
          car.push(wsPointData.reduce((a, b) => a + b, 0));
        } else {
          car.shift();
          car.push(wsPointData.reduce((a, b) => a + b, 0));
        }
        if (myChart1) {
          initCharts({
            yData: car,
            xData: [
              1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
              20,
            ],
            index: 0 + 1,
            name: "中风",
            myChart: myChart1,
            //   yMax: 10000,
          });
        }
        let ndata = wsPointData;
        // console.log(ndata)
        //   wsPointData = wsPointData.map((a, index) => {
        //     if (a < this.state.valuef) {
        //       return 0;
        //     } else {
        //       return a;
        //     }
        //   });
        //   wsPointData = addSide(wsPointData, 32, 32, 2, 2, 0);
        // this.props.changeWsData(wsPointData)
        //   .log(wsPointData,this.com.current);
        // console.log(wsPointData.reduce((a,b) => a+ b , 0) , 'back')
        this.com.current?.backData({
          wsPointData: wsPointData,
          valuej: this.state.valuej2,
          valueg: this.state.valueg2,
          value: this.state.value2,
          valuel: this.state.valuel2,
          valuef: this.state.valuef2,
          valuelInit: this.state.valuelInit2,
        });
        this.com1.current?.backData({
          wsPointData: wsPointData,
          valuej: this.state.valuej2,
          valueg: this.state.valueg2,
          value: this.state.value2,
          valuel: this.state.valuel2,
          valuef: this.state.valuef2,
          valuelInit: this.state.valuelInit2,
        });
      }

      if (jsonObject.sitData != null) {
        // this.setState({
        //   renderFlag : true
        // })
        // console.log(jsonObject.sitData , this.state.local);
        let wsPointData = jsonObject.sitData;
        if (!Array.isArray(wsPointData)) {
          wsPointData = JSON.parse(JSON.parse(wsPointData));
        }
        let sitData = [],
          backData = [];
        for (let i = 0; i < 32; i++) {
          for (let j = 0; j < 32; j++) {
            if (j < 16) {
              sitData.push(wsPointData[i * 32 + j]);
            } else {
              backData.push(wsPointData[i * 32 + j]);
            }
          }
        }
        // wsPointData = sitData
        // console.log(wsPointData)
        //   wsPointData = wsPointData.map((a, index) => {
        //     if (a < this.state.valuef) {
        //       return 0;
        //     } else {
        //       return a;
        //     }
        //   });
        //   wsPointData = addSide(wsPointData, 32, 32, 2, 2, 0);
        // this.props.changeWsData(wsPointData)
        //   .log(wsPointData);
        // let res = rotate90(wsPointData,10,10)

        // console.log(wsPointData.reduce((a,b) => a+ b , 0) , 'sit')

        this.com.current?.changeDataFlag();
        this.com1.current?.changeDataFlag();

        this.com.current?.sitData({
          wsPointData: sitData,
          valuej: this.state.valuej1,
          valueg: this.state.valueg1,
          value: this.state.value1,
          valuelInit: this.state.valuelInit1,
          valuel: this.state.valuel1,
          valuef: this.state.valuef1,
        });

        this.com.current?.backData({
          wsPointData: backData,
          valuej: this.state.valuej1,
          valueg: this.state.valueg1,
          value: this.state.value1,
          valuel: this.state.valuel1,
          valuef: this.state.valuef1,
          valuelInit: this.state.valuelInit1,
        });
        //   this.com.current.drawContent();
      }
      if (jsonObject.port != null) {
        console.log(jsonObject.port);
        this.setState({
          port: jsonObject.port,
        });
      }
      if (jsonObject.length != null) {
        this.setState({ length: jsonObject.length });
      }
      if (jsonObject.time != null) {
        this.setState({
          time: jsonObject.time,
        });
      }
    };
    ws.onerror = (e) => {
      // an error occurred
    };
    ws.onclose = (e) => {
      // connection closed
    };

   
  }

  changePain(obj) {
    const pain = { ...this.state.pain, ...obj };
    this.setState({
      pain: pain,
    });
  }

  changeAdjust(data) {
    this.setState({
      switchStatusArr: data,
    });
  }

  changeRenderFlag() {
    this.setState({
      renderFlag: false,
    });
    // console.log('false')
  }

  changeSitData(data) {
    this.setState({
      sitData: data,
    });
  }

  changeBackData(data) {
    this.setState({
      backData: data,
    });
  }

  render() {
    console.log("render");
    return (
      <>
        <div
          style={{
            position: "fixed",
            top: 0,
            display: "flex",
            flexDirection: "column",
            color: "rgb(70, 132, 147)",
          }}
        >
          <div>
          
            {this.state.port ? (
              <Select
                value={this.state.com}
                placeholder="请选择"
                onChange={(e) => {
                  // this.handleChangeCom(e);
                  console.log(e);
                  if (ws && ws.readyState === 1)
                    ws.send(JSON.stringify({ sitPort: e }));
                }}
              >
                {this.state.port.map((el) => {
                  return (
                    <Select.Option
                      key={el.path}
                      label={el.path}
                      value={el.path}
                    />
                  );
                })}
              </Select>
            ) : null}
            <Button
              onClick={() => {
                if (ws && ws.readyState === 1)
                  ws.send(JSON.stringify({ sitClose: true }));
              }}
            >
              关闭串口
            </Button>
          </div>
        </div>

        <Com>
          <Three
            renderFlag={this.state.renderFlag}
            changeRenderFlag={this.changeRenderFlag.bind(this)}
            index={1}
            ref={this.com}
            changeSitData={this.changeSitData.bind(this)}
            changeBackData={this.changeBackData.bind(this)}
          />
        </Com>

        <div className="content1 localCar foot">
          <div className="footCard1">
            <div className="infoCard1">
              <div
                className="box-card showCard footbgc "
                style={{ display: "flex", flexDirection: "row" }}
              >
                <div
                  className="flexcenter"
                  style={{
                    flex: 1,
                    borderRight: "2px solid black",
                    flexDirection: "column",
                  }}
                >
                 
                  <div
                    className="progerssSlide"
                    style={{
                      display: "flex",

                      alignItems: "center",
                    }}
                  >
                    <div
                      style={{
                        color: "#468493",
                        minWidth: "80px",
                        textAlign: "left",
                      }}
                    >
                      润滑
                    </div>
                    <Slider
                      min={0.1}
                      max={8}
                      onChange={(value) => {
                        localStorage.setItem("chairValuegGl", value);
                        this.setState({ valueg1: value });
                        this.com.current?.sitValue({
                          valueg: value,
                        });
                      }}
                      value={this.state.valueg1}
                      step={0.1}
                      // value={}
                      style={{ width : '200px' }}
                    />
                  </div>
                  <div
                    className="progerssSlide"
                    style={{
                      display: "flex",

                      alignItems: "center",
                      //   padding : '5px',
                      //   borderRadius : 10,
                      //   backgroundColor : '#72aec9'
                    }}
                  >
                    <div
                      style={{
                        color: "#468493",
                        minWidth: "80px",
                        textAlign: "left",
                        // backgroundColor : '#6397ae' ,
                        //  padding : 5,borderRadius : '5px 10px',
                      }}
                    >
                      颜色
                    </div>
                    <Slider
                      min={5}
                      max={2000}
                      onChange={(value) => {
                        localStorage.setItem("chairValuejGl", value);
                        this.setState({ valuej1: value });
                        this.com.current?.sitValue({
                          valuej: value,
                        });
                      }}
                      value={this.state.valuej1}
                      step={10}
                      // value={}
                      style={{ width : '200px' }}
                    />
                  </div>
                  <div
                    className="progerssSlide"
                    style={{
                      display: "flex",

                      alignItems: "center",
                    }}
                  >
                    <div
                      style={{
                        color: "#468493",
                        minWidth: "80px",
                        textAlign: "left",
                      }}
                    >
                      过滤值{" "}
                    </div>
                    <Slider
                      min={1}
                      max={500}
                      onChange={(value) => {
                        localStorage.setItem("chairValuefGl", value);
                        this.setState({ valuef1: value });
                        this.com.current?.sitValue({
                          valuef: value,
                        });
                      }}
                      value={this.state.valuef1}
                      step={2}
                      // value={}
                      style={{ width : '200px' }}
                    />
                  </div>

                  <div
                    className="progerssSlide"
                    style={{
                      display: "flex",

                      alignItems: "center",
                    }}
                  >
                    <div
                      style={{
                        color: "#468493",
                        minWidth: "80px",
                        textAlign: "left",
                      }}
                    >
                      高度
                    </div>
                    <Slider
                      min={0.1}
                      max={15}
                      onChange={(value) => {
                        localStorage.setItem("chairValueGl", value);
                        this.setState({ value1: value });
                        this.com.current?.sitValue({
                          value: value,
                        });
                      }}
                      value={this.state.value1}
                      step={0.02}
                      // value={}
                      style={{ width : '200px' }}
                    />
                  </div>
                  <div
                    className="progerssSlide"
                    style={{
                      display: "flex",

                      alignItems: "center",
                    }}
                  >
                    <div
                      style={{
                        color: "#468493",
                        minWidth: "80px",
                        textAlign: "left",
                      }}
                    >
                      数据连贯性{" "}
                    </div>
                    <Slider
                      min={1}
                      max={20}
                      onChange={(value) => {
                        localStorage.setItem("chairValuelGl", value);
                        this.setState({ valuel1: value });
                        this.com.current?.sitValue({
                          valuel: value,
                        });
                      }}
                      value={this.state.valuel1}
                      step={1}
                      // value={}
                      style={{ width : '200px' }}
                    />
                  </div>

                  <div
                    className="progerssSlide"
                    style={{
                      display: "flex",

                      alignItems: "center",
                    }}
                  >
                    <div
                      style={{
                        color: "#468493",
                        minWidth: "80px",
                        textAlign: "left",
                      }}
                    >
                      初始值{" "}
                    </div>
                    <Slider
                      min={1}
                      max={10000}
                      onChange={(value) => {
                        localStorage.setItem("chairValueInitGl1", value);
                        this.setState({ valuelInit1: value });
                        this.com.current?.sitValue({
                          valuelInit: value,
                        });
                      }}
                      value={this.state.valuelInit1}
                      step={500}
                      // value={}
                      style={{ width : '200px' }}
                    />
                  </div>
                </div>
              </div>
            </div>
           
          </div>
        </div>
      </>
    );
  }
}

export default withRouter(Car);
