import React, { useState } from 'react'
// import img from '../../assets/images/111.png'
import imgPng from '../../assets/images/new.PNG'
import img1 from '../../assets/images/heatmap.png'
import body from '../../assets/images/body.png'
import nullImg from '../../assets/images/add.png'
import { Button, message, Select, Spin } from 'antd'
import { compressionFile } from '../../assets/util/uploadImg'
import axios from 'axios'
let arrxy = []

function ImgUpload(props) {
    const netUrl = "http://sensor.bodyta.com:8080/rcv";
    // const token = useSelector(tokenSelect)
    // const token = 'f891d611f4ff4005994ab29556800cd7'
    const { token } = props
    const { img, finish } = props
    console.log(img, 'img......')
    const [spinning, setSpinning] = useState(false);
    const fileUpload = (e) => {
        axios({
            method: "post",
            url: netUrl + "/file/fileUpload",
            headers: {
                "content-type": "multipart/form-data",
                "token": token
            },
            data: {
                file: e,
            }
        }).then((res) => {

            setSpinning(false);
            message.success('上传成功')
            const imgUrl = res.data.data.src
            finish(imgUrl)
        });
    }

    const imgChange = async (e) => {

        console.log(e)
        setSpinning(true);
        if (e.target.files) {
            let res = await compressionFile(e.target.files[0])
            fileUpload(res)
        } else {
            message.error('获取文件失败')
        }
    }

    return (
        <>
            <Spin className="spin" spinning={spinning} fullscreen />
            <div className="imgContent" style={{ height: '100%' }}> <div className="img" style={{
                height: '100%',
                background: `url(${img ? img : nullImg
                    })  center center / cover no-repeat`,
            }}></div>
                <input type="file" name="img" style={{ opacity: 0, position: 'absolute', width: '100%', height: '100%', left: 0, top: 0 }} id="img" onChange={imgChange} />
            </div>
        </>
    )
}

export default function HandBlock() {
    const [img, setImg] = useState(imgPng)


    const width = 24, height = 24
    const arr = new Array(height).fill(new Array(width).fill(0))

    // const handPointArr = [[2, 14], [2, 17], [4, 14], [4, 17], [6, 14], [6, 17], [8, 14], [8, 17], [2, 24], [2, 27], [4, 24], [4, 27], [6, 24], [6, 27], [8, 24], [8, 27], [5, 2], [7, 2], [9, 2], [11, 2], [5, 9], [7, 9], [9, 9], [11, 9], [17, 4], [17, 5], [17, 6], [17, 7], [17, 8], [17, 9], [17, 10], [17, 11], [19, 4], [19, 5], [19, 6], [19, 7], [19, 8], [19, 9], [19, 10], [19, 11], [21, 4], [21, 5], [21, 6], [21, 7], [21, 8], [21, 9], [21, 10], [21, 11], [23, 4], [23, 5], [23, 6], [23, 7], [23, 8], [23, 9], [23, 10], [23, 11], [25, 4], [25, 5], [25, 6], [25, 7], [25, 8], [25, 9], [25, 10], [25, 11], [27, 4], [27, 5], [27, 6], [27, 7], [27, 8], [27, 9], [27, 10], [27, 11], [17, 21], [17, 22], [17, 23], [17, 24], [17, 25], [17, 26], [17, 27], [17, 28], [19, 21], [19, 22], [19, 23], [19, 24], [19, 25], [19, 26], [19, 27], [19, 28], [21, 21], [21, 22], [21, 23], [21, 24], [21, 25], [21, 26], [21, 27], [21, 28], [23, 21], [23, 22], [23, 23], [23, 24], [23, 25], [23, 26], [23, 27], [23, 28], [25, 21], [25, 22], [25, 23], [25, 24], [25, 25], [25, 26], [25, 27], [25, 28], [27, 21], [27, 22], [27, 23], [27, 24], [27, 25], [27, 26], [27, 27], [27, 28]]



    // const data = [
    //     [120, 78], [111, 86], [103, 63], [96, 71], [88, 48], [79, 57], [72, 32], [63, 42],
    //     [111, 187], [120, 195], [95, 202], [104, 210], [80, 217], [87, 226], [63, 231], [71, 241],
    //     [132, 115], [134, 113], [132, 111], [134, 109],
    //     [134, 159], [131, 161], [134, 163], [131, 165],
    //     [160, 116], [160, 122], [160, 129], [160, 134], [160, 139], [160, 145], [160, 151], [160, 157], [168, 117], [168, 123], [168, 128], [168, 134], [168, 139], [168, 145], [168, 150], [168, 157], [176, 118], [176, 123], [176, 128], [176, 134], [176, 139], [176, 144], [176, 150], [176, 156], [184, 118], [184, 124], [184, 129], [184, 134], [184, 139], [184, 144], [184, 150], [184, 155], [192, 120], [192, 125], [192, 129], [192, 134], [192, 139], [192, 143], [192, 148], [192, 154], [200, 121], [200, 126], [200, 130], [200, 135], [200, 139], [200, 143], [200, 148], [200, 152], [105, 111], [105, 119], [105, 126], [105, 133], [105, 141], [105, 148], [105, 155], [105, 163], [93, 113], [93, 119], [93, 127], [93, 134], [93, 141], [93, 148], [93, 155], [93, 162], [81, 114], [81, 121], [81, 127], [81, 133], [81, 141], [81, 147], [81, 153], [81, 161], [69, 115], [69, 121], [69, 127], [69, 134], [69, 140], [69, 146], [69, 152], [69, 159], [56, 116], [56, 122], [56, 128], [56, 133], [56, 140], [56, 146], [56, 152], [56, 157]]

    // const data = [[32, 28], [32, 31], [33, 35], [16, 42], [16, 46], [17, 50], [12, 59], [12, 62], [12, 66], [19, 76], [19, 79], [19, 82], [61, 111], [63, 114], [65, 118], [40, 29], [40, 31], [41, 34], [24, 43], [24, 46], [24, 49], [20, 60], [20, 62], [20, 65], [28, 77], [27, 80], [27, 83], [68, 107], [70, 110], [72, 113], [61, 32], [57, 48], [55, 64], [57, 82], [76, 106], [88, 35], [79, 73], [100, 37], [98, 95], [108, 39], [107, 92], [117, 43], [115, 89], [123, 44], [123, 86]]
    // const data = [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [0, 7], [0, 17], [0, 18], [0, 19], [0, 20], [0, 21], [0, 22], [0, 23], [1, 0], [1, 1], [1, 2], [1, 3], [1, 4], [1, 5], [1, 6], [1, 17], [1, 18], [1, 19], [1, 20], [1, 21], [1, 22], [1, 23], [2, 0], [2, 1], [2, 2], [2, 3], [2, 4], [2, 5], [2, 6], [2, 7], [2, 16], [2, 17], [2, 18], [2, 19], [2, 20], [2, 21], [2, 22], [2, 23], [3, 0], [3, 1], [3, 2], [3, 3], [3, 4], [3, 5], [3, 18], [3, 19], [3, 20], [3, 21], [3, 22], [3, 23], [4, 0], [4, 1], [4, 22], [4, 23], [9, 0], [9, 1], [9, 22], [9, 23], [10, 0], [10, 1], [10, 2], [10, 21], [10, 22], [10, 23], [11, 0], [11, 1], [11, 2], [11, 3], [11, 20], [11, 21], [11, 22], [11, 23], [12, 0], [12, 1], [12, 21], [12, 22], [12, 23], [13, 0], [13, 1], [13, 21], [13, 22], [13, 23], [14, 0], [14, 22], [14, 23], [15, 22], [15, 23], [16, 23], [17, 23], [18, 11], [18, 12], [18, 23], [19, 11], [19, 12], [19, 23], [20, 11], [20, 12], [20, 23], [21, 10], [21, 11], [21, 12], [21, 13], [21, 23], [22, 0], [22, 10], [22, 11], [22, 12], [22, 13], [22, 23], [23, 0], [23, 9], [23, 10], [23, 11], [23, 12], [23, 13], [23, 14], [23, 22], [23, 23], [18, 10], [19, 10], [20, 10], [18, 13], [19, 13], [20, 13], [0, 16], [23, 8], [22, 9], [21, 9], [20, 9], [19, 9], [18, 9], [20, 8], [21, 8], [22, 8], [20, 14], [21, 14], [22, 14]]

    const data = [
        [0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [0, 7], [0, 8],
        [0, 15], [0, 16], [0, 17], [0, 18], [0, 19], [0, 20], [0, 21], [0, 22], [0, 23],
        [1, 0], [1, 1], [1, 2], [1, 3], [1, 4], [1, 5], [1, 6], [1, 7],[1, 8],
        [1, 15], [1, 16], [1, 17], [1, 18], [1, 19], [1, 20], [1, 21], [1, 22], [1, 23],
        [2, 0], [2, 1], [2, 2], [2, 3], [2, 4], [2, 5], [2, 6], [2, 7], [2, 8], [2, 9],
        [2, 14],[2, 15], [2, 16], [2, 17], [2, 18], [2, 19], [2, 20], [2, 21], [2, 22], [2, 23],
        [3, 0], [3, 1], [3, 2], [3, 3], [3, 4], [3, 5], [3, 6],[3, 7],[3, 8],[3, 9],
        [3, 14],[3, 15],[3, 16],[3, 17],[3, 18], [3, 19], [3, 20], [3, 21], [3, 22], [3, 23],
        [4, 0], [4, 1],
        [4, 22], [4, 23],
        [9, 0], [9, 1], [9, 22], [9, 23], [10, 0], [10, 1], [10, 2], [10, 21], [10, 22], [10, 23], [11, 0], [11, 1], [11, 2], [11, 3], [11, 20], [11, 21], [11, 22], [11, 23], [12, 0], [12, 1], [12, 21], [12, 22], [12, 23], [13, 0], [13, 1], [13, 21], [13, 22], [13, 23], [14, 0], [14, 22], [14, 23], [15, 22], [15, 23], [16, 23], [17, 23], [18, 11], [18, 12], [18, 23], [19, 11], [19, 12], [19, 23], [20, 11], [20, 12], [20, 23], [21, 10], [21, 11], [21, 12], [21, 13], [21, 23], [22, 0], [22, 10], [22, 11], [22, 12], [22, 13], [22, 23], [23, 0], [23, 9], [23, 10], [23, 11], [23, 12], [23, 13], [23, 14], [23, 22], [23, 23], [18, 10], [19, 10], [20, 10], [18, 13], [19, 13], [20, 13], [0, 16], [23, 8], [22, 9], [21, 9], [20, 9], [19, 9], [18, 9], [20, 8], [21, 8], [22, 8], [20, 14], [21, 14], [22, 14]]


    const res = data.map((a) => a[0] * width + a[1])
    const [blueArr, setBlueArr] = useState(res)
    const boxSize = 20

    let locationToken = localStorage.getItem('token') ? localStorage.getItem('token') : '19efc493978e4c5ca9f78c6f71ebdb78'

    const [token, setToken] = useState(locationToken)

    const [up, setUp] = useState(8)
    const [left, setLeft] = useState(8)
    const [widthPx, setWidthPx] = useState(128 * 4)
    const [heightPx, setHeightPx] = useState(0)
    const [fontSize, setFontSize] = useState(12)
    const [display, setDisplay] = useState('width')
    const [col, setCol] = useState(1)
    const [row, setRow] = useState(1)
    const [nowPoint, setNowPoint] = useState([])
    const [matrix, setMatrix] = useState([1, 1])
    const [deleteValue, setDelete] = useState(0)

    const genColOrRow = () => {
        setNowPoint([])
        if (col > 1 && nowPoint.length >= 2) {
            // const arr = blueArr.map((a) => [Math.floor(a / width), a % width])
            const length = nowPoint.length
            const firsty = nowPoint[length - 2][0]
            const lasty = nowPoint[length - 1][0]
            const firstx = nowPoint[length - 2][1]
            const lastx = nowPoint[length - 1][1]
            const addArr = []
            for (let i = 1; i <= col - 1; i++) {
                const newY = firsty + Math.floor((lasty - firsty) * i / (col - 1))
                const newX = firstx + Math.floor((lastx - firstx) * i / (col - 1))
                addArr.push(newY * width + newX)
            }
            let blueArr1 = [...blueArr]
            blueArr1.pop()
            // blueArr1.concat(addArr)
            setBlueArr([...blueArr1, ...addArr])
        }
    }

    // const genMatrix = () => {
    //     if (matrix && nowPoint.length == 4) {
    //         const length = nowPoint.length
    //         const up1Y = nowPoint[0][0]
    //         const up1X = nowPoint[0][1]
    //         const up2Y = nowPoint[1][0]
    //         const up2X = nowPoint[1][1]
    //         const bottom1Y = nowPoint[2][0]
    //         const bottom1X = nowPoint[2][1]
    //         const bottom2Y = nowPoint[3][0]
    //         const bottom2X = nowPoint[3][1]


    //         for(let i = 0 ; i < matrix[0]; i++){
    //             // const newY = firsty + Math.floor((lasty - firsty) * i / (matrix[0] - 1))
    //             const startY = up1Y + ()
    //             const lastY = bottom1Y
    //             for(let j = 0 ; j < matrix[1]; j++){
    //                 // const newX = firstx + Math.floor((lastx - firstx) * i / (matrix[1] - 1))
    //             }
    //         }
    //     }
    // }



    return (
        <div style={{ position: 'relative', display: 'flex', fontSize: 12, border: '1px solid black' }}>
            <div style={{ position: 'relative' }}>
                <img src={img} style={{ position: 'absolute', top: 0,
                    //  width: `${display == 'width' ? `${32*(boxSize + 2)}px` : "unset"}`, height: `${display == 'height' ? `${32*(boxSize + 2)}px` : "unset"}`,
                    width : '1307px', height : '900px',
                    left : '-371px',top : '-40px',
                      opacity: 1, zIndex: -1, 
                    //   left: `${left}px`, top: `${up}px` 
                      }} alt="" />
                <div style={{ display: 'flex', position: 'relative', zIndex: 1 }}>
                    <div style={{ width: boxSize }}>{0}</div>
                    {
                        arr[0].map((a, indexs) => {
                            return <div style={{ width: boxSize + 2, textAlign: 'center' }}>{indexs}</div>
                        })
                    }</div>
                <div style={{ border: "1px solid #000", }}>
                    {
                        arr.map((a, indexs) => {
                            return (
                                <>
                                    <div style={{ display: 'flex' }}>
                                        <div style={{
                                            width: boxSize,
                                            height: boxSize
                                            // flex: 1
                                        }}>{indexs}</div>
                                        {
                                            a.map((b, index) => {
                                                return <div onClick={() => {
                                                    let arr = [...blueArr]
                                                    if (arr.includes(indexs * width + index)) {
                                                        arr.splice(arr.indexOf(indexs * width + index), 1)

                                                        let newArr = [...nowPoint]
                                                        newArr = newArr.filter((a) => a[0] != indexs && a[1] != index)
                                                        setNowPoint(newArr)
                                                        console.log(newArr, 'newArr', indexs, index)
                                                        console.log(arrxy.filter((a) => a[0] != indexs && a[1] != index))
                                                    } else {
                                                        arr.push(indexs * width + index)

                                                        if (nowPoint.length < 4) {
                                                            const arr = [...nowPoint]
                                                            arr.push([indexs, index])
                                                            setNowPoint(arr)
                                                        } else {
                                                            const arr = [...nowPoint]
                                                            arr.slice(1)
                                                            arr.push([indexs, index])
                                                            setNowPoint(arr)
                                                        }
                                                    }
                                                    arrxy.push([indexs, index])
                                                    setBlueArr(arr)
                                                    console.log(JSON.stringify(blueArr))

                                                    console.log(JSON.stringify(arrxy))
                                                }} style={{
                                                    width: boxSize, height: boxSize,
                                                    color: 'blue',
                                                    fontWeight: 'bold',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    border: "1px solid #000",
                                                    backgroundColor : blueArr.includes(indexs * width + index) ? '#000': ''
                                                }}>
                                                    {/* {indexs} */}
                                                    <div style={{
                                                        fontSize: `${fontSize}px`

                                                    }} >{blueArr.includes(indexs * width + index) ? blueArr.indexOf(indexs * width + index) + 1 : ''}</div>

                                                </div>
                                            })
                                        }
                                    </div></>

                            )
                        })
                    }</div>
            </div>
            <div style={{ fontSize: 14 }}>
                <div style={{ marginLeft: '20px' }}>{JSON.stringify(blueArr.map((a) => [Math.floor(a / width), a % width]))}</div>
                <div style={{ position: 'relative', height: 40, width: 40 }}>
                    <ImgUpload img={nullImg} finish={setImg} token={token} />
                </div>
                <div style={{ display: 'flex' }}> <div style={{ width: '4rem' }}>token</div><input style={{ flex: 1 }} placeholder='token' value={token} onChange={(e) => {
                    setToken(e.target.value)
                    localStorage.setItem('token', e.target.value)
                }} /></div>
                <div style={{ display: 'flex' }}> <div style={{ width: '4rem' }}>上</div><input style={{ flex: 1 }} placeholder='上' type="number" value={up} onChange={(e) => { setUp(e.target.value) }} /></div>
                <div style={{ display: 'flex' }}> <div style={{ width: '4rem' }}>左</div><input style={{ flex: 1 }} placeholder='左' type="number" value={left} onChange={(e) => { setLeft(e.target.value) }} /></div>
                <div style={{ display: 'flex' }}><div style={{ width: '4rem' }}>对齐方式</div>
                    <Select
                        defaultValue="width"
                        onChange={(e) => {
                            setDisplay(e)
                        }}
                        options={[
                            { value: 'width', label: '宽' },
                            { value: 'height', label: '高' },
                        ]}
                    /></div>
                <div style={{ display: 'flex' }}> <div style={{ width: '4rem' }}>字体大小</div><input style={{ flex: 1 }} placeholder='字体大小' type="number" value={fontSize} onChange={(e) => { setFontSize(e.target.value) }} /></div>
                <div style={{ display: 'flex' }}> <div style={{ width: '4rem' }}>行列长</div><input style={{ flex: 1 }} placeholder='行列长' type="number" value={col} onChange={(e) => { setCol(e.target.value) }} /></div>
                <div style={{ display: 'flex' }}> <div style={{ width: '4rem' }}>删除</div><input style={{ flex: 1 }} placeholder='删除' type="number" value={deleteValue} onChange={(e) => { setDelete(e.target.value) }} /></div>

                {/* <div style={{ display: 'flex' }}> <div style={{ width: '4rem' }}>矩阵</div>
                    高<input style={{ flex: 1 }} placeholder='长' type="number" value={col} onChange={(e) => {
                        const arr = [...matrix]
                        arr[0] = e.target.value
                        setMatrix(arr)
                    }} />
                    宽<input style={{ flex: 1 }} placeholder='宽' type="number" value={col} onChange={(e) => {
                        const arr = [...matrix]
                        arr[1] = e.target.value
                        setMatrix(arr)
                    }} /></div> */}

                {/* <div style={{ display: 'flex' }}> <div style={{ width: '4rem' }}>行长</div><input style={{ flex: 1 }} placeholder='左' type="number" value={row} onChange={(e) => { setRow(e.target.value) }} /></div> */}
                <Button onClick={genColOrRow} >生成行/列</Button>
                <Button onClick={() => {
                    const arr = [...blueArr]
                    // arr.slice()
                    // arr.splice(arr.length-Number(deleteValue) - 1)
                    arr.splice(arr.length - Number(deleteValue), Number(deleteValue))
                    console.log(arr, Number(deleteValue) - 1)
                    setBlueArr(arr)
                }} >删除</Button>
                {/* <Button onClick={genColOrRow} >生成矩阵</Button> */}
                {/* <div style={{ display: 'flex' }}> <div style={{ width: '4rem' }}>矩阵</div><input style={{ flex: 1 }} placeholder='左' type="number" value={left} onChange={(e) => { setLeft(e.target.value) }} /></div> */}

                {/* <div>列</div>
                <div>行</div>
                <div>矩阵</div> */}
            </div>

        </div>
    )
}
