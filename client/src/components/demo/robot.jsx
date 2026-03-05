import React, { useEffect, useState } from 'react'
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
export default function Robot() {
    const [data, setData] = useState([]);
  

    useEffect(() => {
        const progress = document.getElementById('progress')
        progress.addEventListener('input', (e) => {

            // progress.max = length
            const value = e.target.value
            console.log(value, progress.max)
            ws.send(JSON.stringify({ value: value }))
        })
        const file = document.getElementById('file')
        const data = document.getElementById('data')
        const ws = new WebSocket(" ws://127.0.0.1:19999");
        let length = 0
        ws.onopen = () => {
            // connection opened
            console.info("connect success");

        };
        ws.onmessage = (e) => {
            // this.wsData(e);
            // console.log(e)
            let jsonObject = JSON.parse(e.data);

            if (jsonObject.dataLength != null) {
                console.log(String(jsonObject.dataLength))

                let length = String(jsonObject.dataLength)
                progress.max = length
                if (length) {

                }

            }

            if (jsonObject.file != null) {
                file.innerText = jsonObject.file
                console.log(jsonObject.file)
            }

            if (jsonObject.sitData != null) {
                // console.log(first)
                let wsPointData = jsonObject.sitData;
                if (!Array.isArray(wsPointData)) {
                    wsPointData = JSON.parse(wsPointData)
                }
                console.log(wsPointData)
                let width = 32, height = 32
                if (wsPointData.length == 256) {
                    width = 16
                    height = 16
                    // return
                }
                let arr = [];
                for (let i = 0; i < height; i++) {
                    arr[i] = [];
                    for (let j = 0; j < width; j++) {
                        arr[i][j] = Math.floor(wsPointData[i * width + j]);
                    }
                    arr[i][width] = i

                }



                arr[height] = []
                for (let i = 0; i < width; i++) {
                    arr[height][i] = i
                }

                setData(arr);
            }
        }
    }, [])
    return (
        <>
            <div style={{ marginRight: '10px' }}>
                {data.map((a, indexs) => {
                    return (
                        <div style={{ display: "flex" }}>
                            {a ? a.map((b, index) => {
                                return <div style={{ width: "30px", backgroundColor: `rgb(${jet1(0, 40, b)})`, border: '1px solid', textAlign: 'center' }}>{b}</div>;
                            }) : ''}
                        </div>
                    );
                })}
            </div>
            <input id="progress" type="range" max={100} style={{ width: "80vw" }} />
            <div id='file'></div>
        </>

    )
}
