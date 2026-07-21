import { Button, Input, Modal, message } from 'antd'
import React, { useEffect, useState, useRef, useMemo } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { translateBackendMessage } from '../../i18n/translateBackendMessage'
import './index.scss'

export default function Date1() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const param = useLocation()
  const wsRef = useRef(null)
  const [date, setDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [messageApi, contextHolder] = message.useMessage()

  // 是否是从系统页手动跳转过来更新密钥
  // 兼容多种跳转方式：
  // 1. NavLink to="/?from=system"（Title.jsx 输入密钥按钮）
  // 2. window.location.hash = '#/?from=system'（Home.jsx 密钥过期跳转）
  // 3. 旧版 /?a=b 参数（兼容）
  const isFromSystem = useMemo(() => {
    const search = param.search || ''
    const hash = window.location.hash || ''
    const href = window.location.href || ''
    return search.includes('from=system') || search.includes('a=b') ||
           hash.includes('from=system') || hash.includes('a=b') ||
           href.includes('from=system') || href.includes('a=b')
  }, [param.search])

  // 标记用户是否正在提交密钥（区分后端主动推送 vs 用户提交后的响应）
  const isSubmitting = useRef(false)

  useEffect(() => {
    const ws = new WebSocket("ws://127.0.0.1:19999");
    wsRef.current = ws

    ws.onopen = () => {};

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)

        if (typeof data.licenseKey === 'string' && data.licenseKey.trim()) {
          setDate(data.licenseKey.trim())
        }

        // 处理密钥验证错误
        if (data.licenseError != null) {
          const wasSubmitting = isSubmitting.current
          setLoading(false)
          isSubmitting.current = false
          // 仅在用户主动提交密钥后才弹错误框；
          // 后端在连接/复检时主动推送的 licenseError（如未授权、已过期）不弹，避免一打开页面就弹窗
          if (wasSubmitting) {
            Modal.error({
              title: t('license.errorTitle'),
              content: translateBackendMessage(data.licenseError, t),
            })
          }
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

        // 密钥验证成功：收到有效的 date 且后端判定有效（valid !== false）
        // 防止「能本地解密但被服务器判无效/吊销」的密钥仅凭 date>0 就被放进系统页
        if (data.date != null && data.date > 0 && data.valid !== false) {
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
                title: t('license.expiredTitle'),
                content: t('license.expiredContent'),
              })
            }
            // 停留在密钥输入页
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
          messageApi.success(t('license.success'))
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
        title: t('license.errorTitle'),
        content: t('license.emptyContent'),
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
        title: t('license.connectionErrorTitle'),
        content: t('license.serverDisconnected'),
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
          placeholder={t('license.inputPlaceholder')}
          value={date}
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
            }}>{t('common.backHome')}</Button> : ''}
          <Button
            className='dateButton'
            style={{ width: '100%' }}
            loading={loading}
            onClick={handleSubmit}>{t('common.submit')}</Button>
        </div>
      </div>
    </div>
  )
}
