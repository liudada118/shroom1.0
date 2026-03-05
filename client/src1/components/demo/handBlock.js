import React, { useState } from 'react'
import img from '../../assets/images/hand.jpg'
let arrxy =[]
export default function HandBlock() {
    const arr = new Array(32).fill(new Array(32).fill(0))
    const [blueArr, setBlueArr] = useState([])
 
    return (
        <div style={{ position: 'relative' }}>
            <img src={img} style={{ position: 'absolute', top: 0, height: '820px', opacity: 0.5, zIndex : -1, left: '90px', top: '20px' }} alt="" />
            <div style={{ display: 'flex', position: 'relative' ,zIndex : 1}}>
                <div style={{ width: 22 }}>{0}</div>
                {
                    arr.map((a, indexs) => {
                        return <div style={{ width: 22 }}>{indexs}</div>
                    })
                }</div>
            {
                arr.map((a, indexs) => {
                    return (
                        <>
                            <div style={{ display: 'flex' }}>
                                <div style={{ width: "20px" }}>{indexs}</div>
                                {
                                    a.map((b, index) => {
                                        return <div onClick={() => {
                                            const arr = [...blueArr]
                                            // if(arr.indexOf(indexs * 32 + index)){
                                            //     arr.splice(arr.indexOf(indexs * 32 + index) ,1)
                                            // }else{
                                                arr.push(indexs * 32 + index)
                                            // }
                                            arrxy.push([indexs , index])
                                            
                                           
                                            setBlueArr(arr)
                                            console.log(JSON.stringify(blueArr))
                                            console.log(JSON.stringify(arrxy))
                                        }} style={{ width: '20px', height: '20px', border: "1px solid #000", backgroundColor: blueArr.includes(indexs * 32 + index) ? '#000' : '' }}></div>
                                    })
                                }
                            </div></>

                    )
                })
            }

        </div>
    )
}
