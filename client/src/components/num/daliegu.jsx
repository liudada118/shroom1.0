import React, { useEffect, useState, useImperativeHandle } from 'react'
import './num.css'
import { addSide, findMax } from '../../assets/util/util';
import { pressData } from '../../assets/util/matrixToPress';
import hand from '../../assets/images/hand0509.png'
var valuej1 = localStorage.getItem('carValuej') ? JSON.parse(localStorage.getItem('carValuej')) : 200,
    valueg1 = localStorage.getItem('carValueg') ? JSON.parse(localStorage.getItem('carValueg')) : 2,
    value1 = localStorage.getItem('carValue') ? JSON.parse(localStorage.getItem('carValue')) : 2,
    valuel1 = localStorage.getItem('carValuel') ? JSON.parse(localStorage.getItem('carValuel')) : 2,
    valuef1 = localStorage.getItem('carValuef') ? JSON.parse(localStorage.getItem('carValuef')) : 2,
    valuelInit1 = localStorage.getItem('carValueInit') ? JSON.parse(localStorage.getItem('carValueInit')) : 2



let totalArr = [],
    totalPointArr = [];

function footInterp(arr, footPointArr) {
    // const newArr = new Array(32 * 64).fill(0)

    // footPointArr.forEach((a, index) => {
    //   newArr[a[0] * 32 + a[1]] = footArr[index]
    // })
    const newArr = [...arr]

    for (let i = 0; i < 10; i++) {
        for (let j = 1; j < 6; j++) {
            const col = footPointArr[i * 6 + j][0]
            const length = footPointArr[i * 6 + j][1] - footPointArr[i * 6 + j - 1][1]
            const firstIndex = footPointArr[i * 6 + j - 1][1]
            const lastIndex = footPointArr[i * 6 + j][1]
            const firstValue = newArr[col * 16 + firstIndex]
            const lastValue = newArr[col * 16 + lastIndex]
            const cha = lastValue - firstValue
            for (let k = 1; k < length; k++) {
                // newArr[a[0] * 16 + a[1]]
                newArr[col * 16 + firstIndex + k] = firstValue + Math.floor(cha * 10 / length) / 10
            }
        }
    }

    for (let i = 0; i < 9; i++) {
        const col = footPointArr[i * 6 + 0][0]
        const nextCol = footPointArr[(i + 1) * 6 + 0][0]
        const firstIndex = footPointArr[i * 6 + 0][1]
        const lastIndex = footPointArr[i * 6 + 5][1]
        // console.log(newArr[(nextCol) * 16 + 1] , newArr[(col) * 16 + 1])
        for (let j = firstIndex; j <= lastIndex; j++) {
            newArr[(col + 1) * 16 + j] = newArr[(col) * 16 + j] + Math.floor((newArr[(nextCol) * 16 + j] - newArr[(col) * 16 + j]) * 10 * 1 / 3) / 10
            newArr[(col + 2) * 16 + j] = newArr[(col) * 16 + j] + Math.floor((newArr[(nextCol) * 16 + j] - newArr[(col) * 16 + j]) * 10 * 2 / 3) / 10
            // newArr[(col + 3) * 16 + j] = newArr[(col) * 16 + j] + Math.floor((newArr[(nextCol) * 16 + j] - newArr[(col) * 16 + j]) * 10 * 3 / 5) / 10
            // newArr[(col + 4) * 16 + j] = newArr[(col) * 16 + j] + Math.floor((newArr[(nextCol) * 16 + j] - newArr[(col) * 16 + j]) * 10 * 4 / 5) / 10
        }
    }
    return newArr
}
let leftArr = [], rightArr = []
const Num2D = React.forwardRef((props, refs) => {

    let width = 20, height = 14
    if (props.matrixName == 'carCol') {
        width = 10
        height = 9
    }
    const [data, setData] = useState(new Array(height).fill(new Array(width).fill(0)));
    const [data1, setData1] = useState(new Array(height).fill(new Array(width).fill(0)));
    const [scale, setScale] = useState(1)






    const drawContent = () => { }

    function sitData(prop) {
        const {
            wsPointData: wsPointData,
        } = prop;

        layoutData(wsPointData)
        let arr = []
        for (let i = 0; i < 14; i++) {
            arr[i] = [];
            for (let j = 0; j < 20; j++) {
                arr[i][j] = Math.floor(wsPointData[i * 20 + j]);
            }
            arr[i][20] = i
        }
        arr[14] = []
        for (let i = 0; i < 20; i++) {
            arr[14][i] = i
        }

        setData(arr);

    }

     const layoutData = (dataArr) => {
    
    
            // dataArr = dataArr.filter((a) => a > valuej1 * 0.025)
            const max = findMax(dataArr)
            const point = dataArr.filter((a) => a > 0).length
            let press = dataArr.reduce((a, b) => a + b, 0)
            // press = Math.floor(press) * 3
            // press = press > 724 ? parseInt((pressData[724] * (press / 724)).toFixed(2)) : pressData[press]
            const mean = press / (point == 0 ? 1 : point)
            props.data.current?.changeData({
                meanPres: mean.toFixed(2),
                maxPres: max,
                point: point,
                // area: areaSmooth.toFixed(0),
                totalPres: `${press}`,
                // pressure: pressureSmooth.toFixed(2),
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
            // timeS = 0;
    
    
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


   


    useEffect(() => {
        var WW = document.documentElement.clientWidth
        var scaleNum = WW / 1920
        setScale(scaleNum)

        const arr = []

        for(let i = 0 ; i < 280 ; i++){
            arr[i] = i
        }
        // sitData({wsPointData : arr})
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
                // alignItems: 'center'
                fontSize: '12px'
            }}
        >

            <div
                className="threeBoxF"
                style={{
                    // color: 'blue', transformStyle: 'preserve-3d',
                    // perspective: '500px',
                    position: 'relative',
                    marginTop: '40px',
                    display: 'flex'
                }}
            >
                {/* <img style={{ position: 'absolute', width: '100%', height: '100%', zIndex: 1 }} src={hand} alt="" /> */}
                <div className="threeBox"
                //  style={{   transform: 'rotateX(35deg)'}}
                >
                    {data.map((items, indexs) => {
                        return (
                            <div key={indexs} style={{ display: 'flex' }}>
                                {items && items.length
                                    ? items.map((item, index) => {
                                        return <div style={{ width: "20px", height: '20px', lineHeight: '20px', backgroundColor: `rgb(${jet1(0, 40, item)})`, border: '1px solid', textAlign: 'center' }}>{item}</div>;
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

export default Num2D
