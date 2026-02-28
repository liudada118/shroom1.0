import React, { useEffect, useState } from 'react'
import { gaussBlur_1 } from '../../assets/util/util'
import { press } from '../../assets/util/line';

function gaussBlur_2(scl, w, h, r) {
    const tcl = new Array(scl.length).fill(1)
    var rs = Math.ceil(r * 2.57); // significant radius
    for (var i = 0; i < h; i++)
        for (var j = 0; j < w; j++) {
            var val = 0,
                wsum = 0;
            for (var iy = i - rs; iy < i + rs + 1; iy++)
                for (var ix = j - rs; ix < j + rs + 1; ix++) {
                    var x = Math.min(w - 1, Math.max(0, ix));
                    var y = Math.min(h - 1, Math.max(0, iy));
                    var dsq = (ix - j) * (ix - j) + (iy - i) * (iy - i);
                    var wght = Math.exp(-dsq / (2 * r * r)) / (Math.PI * 2 * r * r);
                    val += scl[y * w + x] * wght;
                    wsum += wght;
                }
            tcl[i * w + j] = Math.round(val / wsum);
        }
    return tcl
}

export default function MatrixDiff() {
    const [data1, setData1] = useState([[]])
    const [data2, setData2] = useState([[]])
    const [data3, setData3] = useState([[]])
    const [arr1, setArr1] = useState([0, 8, 0, 0, 0, 1, 3, 1, 0, 0, 0, 0, 6, 5, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 33, 2, 0, 0, 4, 2, 0, 0, 0, 0, 0, 1, 2, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 4, 8, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 2, 2, 0, 0, 22, 9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0, 26, 22, 0, 0, 26, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 11, 0, 0, 0, 0, 0, 33, 43, 0, 0, 17, 13, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 0, 0, 0, 0, 0, 28, 52, 0, 0, 27, 4, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 23, 0, 0, 0, 0, 0, 24, 30, 0, 0, 22, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 26, 0, 0, 0, 0, 0, 35, 34, 0, 0, 18, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 34, 0, 0, 0, 0, 0, 23, 40, 0, 0, 30, 13, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 15, 0, 0, 0, 0, 0, 18, 21, 0, 0, 31, 14, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 15, 0, 0, 0, 0, 0, 17, 18, 0, 0, 33, 13, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 11, 0, 0, 0, 0, 0, 10, 9, 0, 0, 25, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 1, 3, 0, 0, 0, 0, 0, 2, 1, 0, 1, 9, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 4, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 2, 1, 0, 0, 15, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 18, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 25, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 7, 13, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 3, 0, 0, 2, 26, 7, 9, 7, 4, 24, 37, 5, 6, 1, 4, 3, 0, 0, 4, 0, 0, 0, 9, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 7, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 1, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 8, 2, 0, 6, 0, 1, 0, 0, 0, 0, 1, 1, 0, 2, 3, 1, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 2, 6, 4, 0, 6, 1, 0, 0, 0, 0, 0, 1, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 10, 10, 0, 5, 4, 0, 0, 0, 0, 0, 1, 1, 0, 2, 3, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 0, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 8, 1, 3, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 7, 0, 1, 0, 0, 0, 0, 0, 1, 3, 1, 0, 0, 1, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
    const [arr2, setArr2] = useState([0, 9, 0, 0, 0, 1, 3, 4, 0, 0, 0, 0, 6, 5, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 35, 3, 0, 0, 7, 2, 0, 0, 0, 0, 0, 1, 2, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 1, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 2, 2, 0, 0, 0, 0, 0, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 2, 1, 0, 0, 0, 2, 10, 9, 0, 0, 4, 2, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 10, 16, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 20, 3, 0, 0, 0, 0, 5, 4, 0, 0, 51, 22, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 19, 9, 0, 0, 0, 0, 29, 21, 0, 0, 46, 20, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 22, 12, 0, 0, 0, 3, 33, 37, 0, 0, 31, 29, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 26, 13, 0, 0, 0, 3, 31, 39, 0, 0, 45, 19, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 32, 24, 0, 0, 0, 3, 22, 25, 0, 0, 43, 22, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 47, 19, 0, 0, 0, 5, 38, 29, 0, 0, 32, 22, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 56, 6, 0, 0, 0, 6, 22, 36, 0, 0, 42, 26, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 43, 4, 0, 0, 0, 8, 22, 18, 0, 0, 47, 27, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 35, 1, 0, 0, 0, 15, 28, 21, 0, 0, 47, 19, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 34, 1, 0, 0, 0, 3, 25, 13, 0, 0, 44, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 31, 0, 0, 0, 0, 0, 15, 8, 0, 0, 44, 16, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 1, 27, 0, 0, 0, 0, 1, 18, 6, 0, 0, 42, 22, 1, 0, 0, 0, 0, 2, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 9, 0, 0, 0, 0, 1, 7, 3, 0, 1, 36, 14, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 2, 1, 0, 0, 46, 25, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 1, 0, 0, 0, 33, 22, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6, 26, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 8, 0, 3, 2, 25, 4, 4, 3, 1, 12, 13, 4, 7, 1, 6, 10, 0, 0, 5, 0, 0, 0, 7, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 5, 2, 0, 1, 0, 2, 0, 0, 0, 0, 0, 1, 0, 1, 1, 1, 2, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 7, 3, 0, 4, 1, 2, 1, 0, 0, 0, 0, 1, 0, 4, 4, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 6, 5, 0, 7, 1, 1, 0, 0, 0, 0, 0, 0, 1, 2, 3, 1, 1, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 10, 13, 0, 5, 4, 2, 0, 0, 0, 0, 1, 1, 0, 3, 3, 1, 2, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 5, 1, 2, 1, 0, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 7, 0, 1, 0, 0, 0, 0, 0, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
    const [arr3, setArr3] = useState([])
    const setMatrix = (e) => {
        let matrix = []
        let arr = e
        if (!Array.isArray(arr)) {
            arr = JSON.parse(arr)
        }

        setArr1(arr)

        let length = Math.sqrt(arr.length)

        for (let i = 0; i < length; i++) {
            matrix[i] = []
            for (let j = 0; j < length; j++) {
                matrix[i].push(arr[i * length + j])
            }
        }
        setData1(matrix)
    }

    const setMatrix1 = (e) => {
        let matrix = []
        let arr = e
        if (!Array.isArray(arr)) {
            arr = JSON.parse(arr)
        }
        setArr2(arr)
        let length = Math.sqrt(arr.length)

        for (let i = 0; i < length; i++) {
            matrix[i] = []
            for (let j = 0; j < length; j++) {
                matrix[i].push(arr[i * length + j])
            }
        }
        setData2(matrix)
    }

    const diff = () => {
        let matrix = []
        const arr = arr2.map((a, index) => a - arr1[index]
        )

        let length = Math.sqrt(arr.length)

        for (let i = 0; i < length; i++) {
            matrix[i] = []
            for (let j = 0; j < length; j++) {
                matrix[i].push(arr[i * length + j])
            }
        }
        setData3(matrix)
    }

    useEffect(() => {
        let length = Math.sqrt(arr1.length)
        // let res1 = gaussBlur_2(arr1,length,length,1)
        // let res2 = gaussBlur_2(arr2,length,length,1)
        let res1 = arr1
        let res2 = arr2
        let matrix = []
        let arr = res2.map((a, index) => a - res1[index]
        )

        // arr = gaussBlur_2(arr,length,length,1)
        setArr3(arr)
        for (let i = 0; i < length; i++) {
            matrix[i] = []
            for (let j = 0; j < length; j++) {
                matrix[i].push(arr[i * length + j])
            }
        }
        setData3(matrix)

        setMatrix(res1)
        setMatrix1(res2)
    }, [])

    return (
        <div style={{ display: 'flex', fontSize: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', borderRight: '3px solid #000' }}>
                {data1.map((a, index) => {
                    return (
                        <div style={{ display: 'flex', flexDirection: 'row' }}>
                            {a.map((b, indexs) => {
                                return (
                                    <div
                                        style={{
                                            // width: [b, data2[index], data3[index]].every((a) => a < 10) ? '1.8rem' : '3.6rem',
                                            display: 'flex', flexDirection: 'row'
                                        }}>
                                        <span style={{
                                            color: '',
                                            width: '1.3rem'
                                        }}>{b}</span>
                                        {/* <span style={{ color: 'red' }}>{data2[index]?.length ? data2[index][indexs] : ''}</span>
                                        <span style={{ color: 'blue' }}>{data3[index]?.length ? data3[index][indexs] : ''}</span> */}
                                    </div>
                                )
                            })}
                        </div>
                    )
                })}

                <div>
                    <input type="text" onChange={(e) => setMatrix(e.target.value)} />
                    {arr1.filter((a) => a > 5).reduce((a, b) => a + b, 0)}  {Math.round(arr1.filter((a) => a > 5).reduce((a, b) => a + b, 0) / arr1.filter((a) => a > 5).length)}
                </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', borderRight: '3px solid #000' }}>
                {data2.map((a, index) => {
                    return (
                        <div style={{ display: 'flex', flexDirection: 'row' }}>
                            {a.map((b, index) => {
                                return (
                                    <div style={{ width: '1.3rem' }}>{b}</div>
                                )
                            })}
                        </div>
                    )
                })}

                <div>
                    <input type="text" onChange={(e) => setMatrix1(e.target.value)} />
                    {arr2.filter((a) => a > 5).reduce((a, b) => a + b, 0)}  {Math.round(arr2.filter((a) => a > 5).reduce((a, b) => a + b, 0) / arr2.filter((a) => a > 5).length)}
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
                {data3.map((a, index) => {
                    return (
                        <div style={{ display: 'flex', flexDirection: 'row' }}>
                            {a.map((b, indexs) => {
                                return (
                                    <div style={{ width: '1.3rem', color: data1[index][indexs] > 5 || data2[index][indexs] > 5 ? 'blue' : 'unset' }}>{Math.round(b * 1)}</div>
                                )
                            })}
                        </div>
                    )
                })}
                <button onClick={diff}>diff</button>
                {arr3.filter((a) => a > 0).reduce((a, b) => a + b, 0)}  {Math.round(arr3.filter((a) => a > 5).reduce((a, b) => a + b, 0) / arr3.filter((a) => a > 5).length)}
            </div>
        </div>
    )
}
