import React, { useEffect, useState, useImperativeHandle } from 'react'
import './num.css'
import { findMax } from '../../assets/util/util';

let totalArr = [],
    totalPointArr = [];

const SmallSample = React.forwardRef((props, refs) => {
    let width = 10, height = 10

    const [data, setData] = useState(new Array(height).fill(new Array(width).fill(0)));
    const [scale, setScale] = useState(1)

    function sitData(prop) {
        const {
            wsPointData: wsPointData,
        } = prop;
        layoutData(wsPointData)

        let arr = []
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

    const layoutData = (dataArr) => {
        const max = findMax(dataArr)
        const point = dataArr.filter((a) => a > 0).length
        let press = dataArr.reduce((a, b) => a + b, 0)
        const mean = press / (point == 0 ? 1 : point)
        props.data.current?.changeData({
            meanPres: mean.toFixed(2),
            maxPres: max,
            point: point,
            totalPres: `${press}`,
        });

        if (totalArr.length < 60) {
            totalArr.push(press);
        } else {
            totalArr.shift();
            totalArr.push(press);
        }

        const maxTotal = findMax(totalArr);

        if (!props.local) {
            props.data.current?.handleCharts(totalArr, maxTotal + 20);
        }
        if (totalPointArr.length < 60) {
            totalPointArr.push(point);
        } else {
            totalPointArr.shift();
            totalPointArr.push(point);
        }

        const max1 = findMax(totalPointArr);
        if (!props.local)
            props.data.current?.handleChartsArea(totalPointArr, max1 + 20);
    }

    useImperativeHandle(refs, () => ({
        sitData
    }));

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
        } else if (x < min + 0.4 * dv) {
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

    useEffect(() => {
        var WW = document.documentElement.clientWidth
        var scaleNum = WW / 1920
        setScale(scaleNum)
    }, []);

    return (
        <div
            style={{
                width: '100vw',
                height: '100vh',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: '#fff',
                fontSize: '12px'
            }}
        >
            <div
                className="threeBoxF"
                style={{
                    position: 'relative',
                    marginTop: '40px',
                    display: 'flex'
                }}
            >
                <div className="threeBox">
                    {data.map((items, indexs) => {
                        return (
                            <div key={indexs} style={{ display: 'flex' }}>
                                {items && items.length
                                    ? items.map((item, index) => {
                                        return <div key={index} style={{ width: "40px", height: '40px', lineHeight: '40px', backgroundColor: `rgb(${jet1(0, 40, item)})`, border: '1px solid', textAlign: 'center', fontSize: '14px' }}>{item}</div>;
                                    })
                                    : null}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
})

export default SmallSample
