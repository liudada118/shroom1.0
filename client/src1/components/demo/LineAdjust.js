import React, { useEffect, useState } from 'react'
import { findMax } from '../../assets/util/util'
import { carBackLine } from '../../assets/util/line'

let ws
export default function Demo() {
    const [data, setData] = useState([])
    const [max, setMax] = useState(0)
    const [maxCol, setMaxCol] = useState(0)
    alert(1111)
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


                // const col = [5, 4, 3, 2, 1, 0]
                // const row = [9, 10, 11, 8, 7, 6]

                // let resMatrix = []
                // for (let i = 0; i < 3; i++) {
                //     for (let j = 0; j < 3; j++) {
                //         resMatrix.push(wsPointData[row[i] * 32 + col[j]])
                //     }
                //     for (let j = 0; j < 3; j++) {
                //         resMatrix.push(wsPointData[row[i + 3] * 32 + col[j + 3]])
                //     }
                // }

                let resMatrix = []
                for (let i = 0; i < 5; i++) {
                    for (let j = 0; j < 10; j++) {
                        resMatrix.push(wsPointData[i * 32 + j])
                    }
                }

                const width = 10
                const height = 5

                let arr = []
                for (let i = 0; i < height; i++) {
                    arr[i] = []
                    for (let j = 0; j < width; j++) {
                        arr[i][j] = resMatrix[i * width + j]
                    }
                    arr[i][width] = i
                }

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
                            return <div style={{ width: "30px", backgroundColor: `rgb(${jet1(0, 40, b)})`, border: '1px solid', textAlign: 'center' }}>{b}</div>;
                        })}
                    </div>
                );
            })}</div>
            <div style={{ fontSize: '30px' }}>{max}</div>
            <div style={{ fontSize: '30px' }}>{maxCol}</div>
        </>
    )
}
