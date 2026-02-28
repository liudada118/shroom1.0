import React, { useEffect, useState } from "react";
import { findMax } from "../../assets/util/util";
import {
  calPress,
  calculatePressure,
  calculateY,
  carBackLine,
  pressNew,
} from "../../assets/util/line";
import { Slider } from "antd";
import fas from "../../assets/util/obj";
let data = [];

let ws,
  pressFlag = false,
  pressNumFlag = false,
  value = localStorage.getItem("carValuePress")
    ? JSON.parse(localStorage.getItem("carValuePress"))
    : 1000;

function press(arr, value) {
  let left = [],
    right = [];
  for (let i = 0; i < 32; i++) {
    for (let j = 0; j < 32; j++) {
      left.push(arr[i * 64 + j]);
      right.push(arr[i * 64 + 32 + j]);
    }
  }
  left = pressNew({ arr: left, height: 32, width: 32, value: value });
  right = pressNew({ arr: right, height: 32, width: 32, value: value });
  const newArr = [];
  for (let i = 0; i < 32; i++) {
    for (let j = 0; j < 64; j++) {
      if (j < 32) {
        newArr.push(
            
            left[i * 32 + j]*1.2
            
            );
      } else {
        newArr.push(
            
            right[i * 32 + j - 32]
            // 50
            );
      }
    }
  }
  return newArr;
}
let sfaArr = [];
let BFA = [];
let allArr = [];
let startPressure = 0;
let time = 0
let computeBeel = new fas();

function objChange(newValue, oldValue, valueFlag) {
  if (newValue > oldValue - valueFlag && newValue < oldValue + valueFlag) {
    return false;
  } else {
    return true;
  }
}

export default function Demo() {
  const [data, setData] = useState([]);
  const [max, setMax] = useState(0);
  const [maxCol, setMaxCol] = useState(0);
  const [pressValue, setPressValue] = useState(false);
  const [pressNum, setPressNum] = useState(false);
  const [pressuse, setPressuse] = useState(false);
  const [total, setTotal] = useState(false);
  const [length, setLength] = useState(false);
  const [change, setChange] = useState(false)
  const [realPress , setRealPress] = useState(0)
  const [valuePress, setValuePress] = useState(
    localStorage.getItem("carValuePress")
      ? JSON.parse(localStorage.getItem("carValuePress"))
      : 1000
  );
  useEffect(() => {
    ws = new WebSocket(" ws://localhost:19999");
    ws.onopen = () => {
      // connection opened
      console.info("connect success");
    };
    ws.onmessage = (e) => {
      let jsonObject = JSON.parse(e.data);
      //处理空数组
      sfaArr = [];
      BFA = [];
      allArr = [];
      let beelArr = [];
      let beelEndArr = [];
      if (jsonObject.sitData != null) {
        let wsPointData = jsonObject.sitData;

        wsPointData = wsPointData.map((a) => (a < 10 ? 0 : a));

        if (pressFlag) {
          wsPointData = press(wsPointData, 1500);
        }

        // let computeBeel = new fas();

        const total = wsPointData.reduce((a, b) => a + b, 0);
        const length = wsPointData.filter((a, index) => a > 0).length;
        setTotal(total);
        setLength(length);
        const newPressure = total / length;
        let pressure = (total / length).toFixed(2);
        setRealPress(newPressure)
        const change = objChange(newPressure , startPressure , 4)
        if(change){
            startPressure = newPressure
            time = 0
        }else{
            time ++
            pressure = calPress(startPressure , newPressure , time);
            if(time > 240*13){
                time = 240*13
            }
        }

        setChange(change)

        setPressuse( calculatePressure(pressure) );

        let arr = [];
        for (let i = 0; i < 32; i++) {
          arr[i] = [];
          for (let j = 0; j < 64; j++) {
            arr[i][j] = wsPointData[i * 64 + j];
          }
        }
        // console.log(arr)
        setData(arr)
      }
    };
    ws.onerror = (e) => {
      // an error occurred
    };
    ws.onclose = (e) => {
      // connection closed
    };
  }, []);
  return (
    <>
      <div>
        {data.map((a, indexs) => {
          return (
            <div key={indexs} style={{ display: "flex" }}>
              {a.map((b, index) => {
                return (
                  <div key={index} style={{ width: "30px" }}>
                    {b}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: "30px" }}>{max}</div>
      <div style={{ fontSize: "30px" }}>{maxCol}</div>
      <div style={{ fontSize: "30px" }}>压力总和:{total}</div>
      <div style={{ fontSize: "30px" }}>压力面积:{length}</div>
      <div style={{ fontSize: "30px" }}>真实压强:{realPress}</div>
      <div style={{ fontSize: "30px" }}>压强:{pressuse}</div>
      <div>改变: {change ? 'true' : 'false'}</div>
      <div style={{ position: "fixed", bottom: "20px", color: "#000" }}>
        <div
          style={{ border: "1px solid #01F1E3" }}
          onClick={() => {
            const press1 = pressValue;
            setPressValue(!press1);
            pressFlag = !pressFlag;
          }}
        >
          {pressValue ? "分压" : "不分压"}
        </div>
        <div
          style={{ border: "1px solid #01F1E3" }}
          onClick={() => {
            const pressNum1 = pressNum;
            setPressNum(pressNum1);
            pressNumFlag = !pressNumFlag;
          }}
        >
          {pressNum ? "压力算法" : "不压力算法"}
        </div>

        <Slider
          min={1}
          max={10000}
          onChange={(value) => {
            localStorage.setItem("carValuePress", value);
            setValuePress(value);
            value = value;
          }}
          value={valuePress}
          step={5}
          // value={this.props.}
          style={{ width: "200px" }}
        />
      </div>
    </>
  );
}
