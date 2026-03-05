import React, { useEffect, useState } from 'react'
import { findMax } from '../../assets/util/util'
import { carBackLine } from '../../assets/util/line'
let data = []

// for (let i = 0; i < 32; i++) {
//     for (let j = 0; j < 32; j++) {
//         data[i * 32 + j] = j
//     }
// }
// const newData = [...data]
// let b = data.splice(0, 16 * 32)
// data = data.concat(b)
// console.log(newData, data)
// for (let i = 0; i < 32; i++) {
//     for (let j = 0; j < 8; j++) {
//         // let a = data[i * 32 + j]
//         // data[i * 32 + j] = data[i * 32 + 15 - j]
//         // data[i * 32 + 15 - j] = a
//         [data[i * 32 + j], data[i * 32 + 15 - j]] = [data[i * 32 + 15 - j], data[i * 32 + j]];
//         // data[i * 32 + j]  = 0
//     }
// }

// let res = []
// for (let i = 0; i < 32; i++) {
//     res[i] = []
//     for (let j = 0; j < 32; j++) {
//         res[i].push(data[i * 32 + j])
//     }
// }
let ws

export default function Demo() {
    const [data, setData] = useState([])
    const [max, setMax] = useState(0)
    const [maxCol, setMaxCol] = useState(0)
    useEffect(() => {
        ws = new WebSocket(" ws://localhost:19999");
        ws.onopen = () => {
            // connection opened
            console.info("connect success");
        };
        ws.onmessage = (e) => {
            let jsonObject = JSON.parse(e.data);
            //处理空数组

            if (jsonObject.sitData != null) {
                let wsPointData = jsonObject.sitData;
                
                wsPointData = wsPointData.map((a) => a < 10 ? 0 : a)
               
              

                



                let arr = []
                for (let i = 0; i < 10; i++) {
                    arr[i] = []
                    for (let j = 0; j < 10; j++) {
                        arr[i][j] = wsPointData[i * 10 + j]
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
    }, [])
    return (
        <>
            <div>{
                data.map((a, indexs) => {
                    return (
                        <div style={{ display: 'flex' }}>{a.map((b, index) => {
                            return <div style={{ width: '30px' }}>{b}</div>
                        })}</div>
                    )
                })
            }</div>
            <div style={{ fontSize: '30px' }}>{max}</div>
            <div style={{ fontSize: '30px' }}>{maxCol}</div>
        </>
    )
}
