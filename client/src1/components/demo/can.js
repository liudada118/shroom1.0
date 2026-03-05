import React, { useEffect, useState } from 'react'
import { findMax } from '../../assets/util/util'
import { carBackLine } from '../../assets/util/line'
let data = []

let ws
const width = 32, height = 32
export default function Can() {
    const [data, setData] = useState([])
    const [max, setMax] = useState(0)
    const [maxCol, setMaxCol] = useState(0)
    const [progressMax , setProgressMax] = useState(100)
    useEffect(() => {
        ws = new WebSocket(" ws://localhost:19999");
        ws.onopen = () => {
            // connection opened
            console.info("connect success");
        };
        ws.onmessage = (e) => {
            // console.log(e.data)
            let jsonObject = JSON.parse(e.data);
            //处理空数组
            // console.log(typeof jsonObject , JSON.parse(JSON.stringify(jsonObject)))
            if (jsonObject.data != null) {
                let wsPointData = jsonObject.data;
                if(jsonObject.length) setProgressMax(jsonObject.length)
                wsPointData = wsPointData.map((a) => a < 10 ? 0 : a)

                const width = 10
                const height = 10

                let arr = []
                for (let i = 0; i < height; i++) {
                    arr[i] = []
                    for (let j = 0; j < width; j++) {
                        arr[i][j] = wsPointData[i * width + j]
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

    const send = (e) =>{
        const value = e.target.value
        console.log(value)
        ws.send(JSON.stringify({
            value : value
        }))
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
            {/* <progress value={0} max={progressMax} onChange={send}></progress> */}
            <input type="range" max={progressMax} onChange={send} style={{width : '80vw'}}/>
            <div style={{ fontSize: '30px' }}>{max}</div>
            <div style={{ fontSize: '30px' }}>{maxCol}</div>
        </>
    )
}
