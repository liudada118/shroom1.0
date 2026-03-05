import { Button, Input } from 'antd'
import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import './index.scss'
let ws
export default function Date1() {
  const nav = useNavigate()
  const param = useLocation()
  useEffect(() => {
    ws = new WebSocket(" ws://127.0.0.1:19999");
    ws.onopen = () => {


    };
    ws.onmessage = (e) => {
      // this.wsData(e);
      console.log(param)
      console.log(JSON.parse(e.data))
      if(JSON.parse(e.data).selectFlag != null){
        if(JSON.parse(e.data).selectFlag == 'all'){
          localStorage.setItem('matrixTitle', true)
        }else{
          localStorage.removeItem('matrixTitle')
        }
      }

      if (JSON.parse(e.data).date && param.search == '') {
        nav('/system')
      }
    };
    ws.onerror = (e) => {
      // an error occurred
    };
    ws.onclose = (e) => {
      // connection closed
    };
    return () => {
      if (ws) {
        ws.close();
      }
    }
  }, [])

  const wsSendObj = (obj) => {
    console.log(obj, ws)
    if (ws && ws.readyState === 1) {
      console.log(obj)
      ws.send(JSON.stringify(obj));
    }
  };
  const [date, setDate] = useState('')
  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#10152b' }}>
      <div style={{ width: '300px' }}>
        <Input
          style={{
            backgroundColor: '#000',

          }}
          className='dateInput'
          placeholder='请输入密钥'
          onChange={(e) => {
            console.log(e.target.value)
            setDate((e.target.value).trim())
          }} />
        <div style={{ display: 'flex', width: '100%' }}>
          {param.search != '' ? <Button
            className='dateButton'
            style={{ width: '100%',marginRight :'10px' }}

            onClick={() => {
              nav('/system')
            }}>返回主页</Button> : ''}
          <Button
            className='dateButton'
            style={{ width: '100%' }}

            onClick={() => {
              // console.log({
              //   date : date ,
              //   startTime : new Date().getTime()
              // })
              const dateStamp = new Date().getTime()
              wsSendObj(
                {
                  date: {
                    date: date,
                    startTime: dateStamp
                  }
                }

              )

              nav('/system')
            }}>提交</Button>
        </div>

      </div>

    </div>
  )
}
