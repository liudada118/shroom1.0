import { Button, Input, Modal, message } from 'antd'
import React, { useEffect, useState, useRef } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import './index.scss'

export default function Date1() {
  const nav = useNavigate()
  const param = useLocation()
  const wsRef = useRef(null)
  const [date, setDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [messageApi, contextHolder] = message.useMessage()

  // 是否是从系统页手动跳转过来更新密钥
  const isFromSystem = param.search.includes('from=system')
  // 标记用户是否正在提交密钥（区分后端主动推送 vs 用户提交后的响应）
  const isSubmitting = useRef(false)

  useEffect(() => {
    const ws = new WebSocket("ws://127.0.0.1:19999");
    wsRef.current = ws

    ws.onopen = () => {};

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)

        // 处理密钥验证错误
        if (data.licenseError != null) {
          setLoading(false)
          const wasSubmitting = isSubmitting.current
          isSubmitting.current = false
          Modal.error({
            title: '密钥错误',
            content: data.licenseError,
          })
          return
        }

        // 处理 selectFlag（授权类型）
        if (data.selectFlag != null) {
          if (data.selectFlag === 'all') {
            localStorage.setItem('matrixTitle', true)
            localStorage.removeItem('allowedTypes')
          } else if (Array.isArray(data.selectFlag)) {
            localStorage.setItem('matrixTitle', true)
            localStorage.setItem('allowedTypes', JSON.stringify(data.selectFlag))
          } else {
            localStorage.removeItem('matrixTitle')
            localStorage.removeItem('allowedTypes')
          }
        }

        // 密钥验证成功：收到有效的 date
        if (data.date != null && data.date > 0) {
          setLoading(false)
          const wasSubmitting = isSubmitting.current
          isSubmitting.current = false

          // 检查密钥是否已过期
          const serverNow = data.nowDate ? parseFloat(data.nowDate) : window.Date.now()
          const endDate = parseFloat(data.date)
          if (endDate <= serverNow) {
            // 密钥已过期
            if (wasSubmitting) {
              // 用户提交的密钥过期，提示错误
              Modal.error({
                title: '密钥已过期',
                content: '该密钥已过期，请输入有效的密钥',
              })
            }
            // 首次启动且密钥过期，或手动跳转时后端推送过期密钥 → 停留在密钥输入页
            return
          }

          // 密钥有效
          if (isFromSystem && !wasSubmitting) {
            // 从系统页手动跳转过来更新密钥：后端主动推送的密钥信息，不自动跳转
            // 用户可以在此页面输入新密钥
            return
          }

          // 首次启动且密钥有效 → 自动跳转到系统页
          // 或者用户提交新密钥验证成功 → 跳转到系统页
          messageApi.success('密钥验证成功')
          setTimeout(() => {
            nav('/system')
          }, 500)
        }
      } catch (err) {
        console.error('解析消息失败:', err)
      }
    }

    ws.onerror = (e) => {};
    ws.onclose = (e) => {};

    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [])

  const handleSubmit = () => {
    const trimmed = date.trim()
    if (!trimmed) {
      Modal.error({
        title: '密钥错误',
        content: '密钥不能为空，请输入有效密钥',
      })
      return
    }

    setLoading(true)
    isSubmitting.current = true
    const ws = wsRef.current
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify({
        date: {
          date: trimmed,
          startTime: window.Date.now()
        }
      }))
    } else {
      setLoading(false)
      isSubmitting.current = false
      Modal.error({
        title: '连接错误',
        content: '与服务器的连接已断开，请刷新页面重试',
      })
    }
  }

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#10152b' }}>
      {contextHolder}
      <div style={{ width: '300px' }}>
        <Input
          style={{
            backgroundColor: '#000',
          }}
          className='dateInput'
          placeholder='请输入密钥'
          onChange={(e) => {
            setDate((e.target.value).trim())
          }}
          onPressEnter={handleSubmit}
        />
        <div style={{ display: 'flex', width: '100%' }}>
          {isFromSystem ? <Button
            className='dateButton'
            style={{ width: '100%', marginRight: '10px' }}
            onClick={() => {
              nav('/system')
            }}>返回主页</Button> : ''}
          <Button
            className='dateButton'
            style={{ width: '100%' }}
            loading={loading}
            onClick={handleSubmit}>提交</Button>
        </div>
      </div>
    </div>
  )
}
