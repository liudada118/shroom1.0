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
const width = 32, height = 32
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

                let leftArr = []

                for (let i = 13; i <= 15; i++) {
                    leftArr.push(wsPointData[i * 32 + 9])
                    leftArr.push(wsPointData[i * 32 + 8])
                }

                let contentArr = []
                for (let i = 3; i < 8; i++) {
                    for (let j = 7; j >= 2; j--) {
                        contentArr.push(wsPointData[i * 32 + j])
                    }
                }

                for (let i = 12; i >= 8; i--) {
                    for (let j = 7; j >= 2; j--) {
                        contentArr.push(wsPointData[i * 32 + j])
                    }
                }

                let rightArr = []
                for (let i = 2; i >= 0; i--) {
                    rightArr.push(wsPointData[i * 32 + 1])
                    rightArr.push(wsPointData[i * 32 + 0])
                }

                const width = 10
                const height = 10

                const arr = []

                for (let i = 0; i < height; i++) {
                    arr[i] = []
                    for (let j = 0; j < width; j++) {
                        if (j < 2) {
                            if (typeof leftArr[i * 2 + j] == 'number') {
                                arr[i][j] = (leftArr[i * 2 + j])
                            }
                            else {
                                arr[i][j] = (NaN)
                            }
                        } else if (j < 8) {
                            arr[i][j] = (contentArr[i * 6 + j - 2])
                        } else {
                            if (typeof rightArr[i * 2 + j - 8] == 'number') {
                                arr[i][j] = (rightArr[i * 2 + j - 8])
                            } else {
                                arr[i][j] = (NaN)
                            }
                        }
                    }
                    arr[i][width] = i
                }

                // let arr = []
                // for (let i = 0; i < height; i++) {
                //     arr[i] = []
                //     for (let j = 0; j < width; j++) {
                //         arr[i][j] = resMatrix[i * width + j]
                //     }
                //     arr[i][width] = i
                // }

                arr[width] = []
                for (let i = 0; i < width; i++) {
                    arr[width][i] = i
                }
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

    function jet1(min, max, x) {
        let red, g, blue;
        let dv;
        red = 1.0;
        g = 1.0;
        blue = 1.0;
        if (x < min) {
            x = min;
        }
        if (x > max) {
            x = max;
        }
        dv = max - min;
        if (x < min + 0.2 * dv) {
            red = 1;
            g = 1;
            blue = 1;

            // red = 0;
            // g = (4 * (x - min)) / dv;
        } else if (x < min + 0.4 * dv) {
            // red = 0;
            // g = 0;
            // blue = 0;

            red = 0;
            g = (5 * (x - min - 0.2 * dv)) / dv;
        } else if (x < min + 0.6 * dv) {
            red = 0;
            blue = 1 + (4 * (min + 0.4 * dv - x)) / dv;
        } else if (x < min + 0.8 * dv) {
            red = (4 * (x - min - 0.6 * dv)) / dv;
            blue = 0;
        } else {
            g = 1 + (4 * (min + 0.8 * dv - x)) / dv;
            blue = 0;
        }
        var rgb = new Array();
        rgb[0] = parseInt(255 * red + '');
        rgb[1] = parseInt(255 * g + '');
        rgb[2] = parseInt(255 * blue + '');
        return rgb;
    }

    return (
        <>
            <div>{data.map((a, indexs) => {
                return (
                    <div style={{ display: "flex" }}>
                        {a.map((b, index) => {
                            return <>
                                {isNaN(b) ? <div style={{ width: "30px" ,border: '1px solid', }}></div> : <div style={{ width: "30px", backgroundColor: `rgb(${jet1(0, 40, b)})`, border: '1px solid', textAlign: 'center' }}>{b}</div>}
                            </>
                        })}
                    </div>
                );
            })}</div>
            <div style={{ fontSize: '30px' }}>{max}</div>
            <div style={{ fontSize: '30px' }}>{maxCol}</div>
        </>
    )
}
