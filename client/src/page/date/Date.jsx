import { Button, Input, Modal, message } from 'antd'
import React, { useCallback, useState, useRef, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { translateBackendMessage } from '../../i18n/translateBackendMessage'
import useMainWebSocket from '../../services/ws/useMainWebSocket'
import {
  applyLicenseScopeToStorage,
  getLicenseKeyFromMessage,
  hasValidLicenseDate,
  isExpiredLicenseMessage,
  isObjectMessage,
} from '../../services/ws/messages'
import './index.scss'

export default function Date1() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const param = useLocation()
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

  const handleSocketMessage = useCallback((data) => {
    if (!isObjectMessage(data)) return

    const key = getLicenseKeyFromMessage(data)
    if (key) {
      setDate(key)
    }

    if (data.licenseError != null) {
      const wasSubmitting = isSubmitting.current
      setLoading(false)
      isSubmitting.current = false
      if (wasSubmitting) {
        Modal.error({
          title: t('license.errorTitle'),
          content: translateBackendMessage(data.licenseError, t),
        })
      }
      return
    }

    applyLicenseScopeToStorage(data)

    if (!hasValidLicenseDate(data)) return

    setLoading(false)
    const wasSubmitting = isSubmitting.current
    isSubmitting.current = false

    if (isExpiredLicenseMessage(data)) {
      if (wasSubmitting) {
        Modal.error({
          title: t('license.expiredTitle'),
          content: t('license.expiredContent'),
        })
      }
      return
    }

    if (isFromSystem && !wasSubmitting) {
      return
    }

    messageApi.success(t('license.success'))
    setTimeout(() => {
      nav('/system')
    }, 500)
  }, [isFromSystem, messageApi, nav, t])

  const handleCommandError = useCallback((error) => {
    setLoading(false)
    isSubmitting.current = false
    Modal.error({
      title: t('license.connectionErrorTitle'),
      content: error?.message
        ? translateBackendMessage(error.message, t)
        : t('license.serverDisconnected'),
    })
  }, [t])

  const { connected: wsConnected, submitLicenseKey } = useMainWebSocket({
    onMessage: handleSocketMessage,
    onClose: () => {
      setLoading(false)
      isSubmitting.current = false
    },
    onCommandError: handleCommandError,
  })

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
    if (wsConnected) {
      submitLicenseKey(trimmed)
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
