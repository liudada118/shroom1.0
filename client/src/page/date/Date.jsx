/**
 * Date.jsx
 * 设备激活页面（密钥输入）
 *
 * 功能：
 * 1. 获取并显示本机机器码（方便客户复制发给管理员）
 * 2. 离线模式：输入管理员提供的专属激活码
 * 3. 在线模式：一键联网验证授权
 * 4. 兼容旧版密钥输入
 */
import { Button, Input, message, Tooltip, Segmented, Spin } from 'antd'
import {
  CopyOutlined, LaptopOutlined, CloudOutlined,
  KeyOutlined, SafetyCertificateOutlined, WifiOutlined
} from '@ant-design/icons'
import React, { useEffect, useState, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import './index.scss'

const { TextArea } = Input

let ws

export default function Date1() {
  const nav = useNavigate()
  const param = useLocation()

  const [mode, setMode] = useState('offline') // 'offline' | 'online'
  const [machineId, setMachineId] = useState('')
  const [activationCode, setActivationCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [onlineLoading, setOnlineLoading] = useState(false)
  const [machineIdLoading, setMachineIdLoading] = useState(false)

  // 旧版密钥兼容
  const [legacyKey, setLegacyKey] = useState('')

  useEffect(() => {
    ws = new WebSocket("ws://127.0.0.1:19999")
    ws.onopen = () => {}
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)

        // 接收机器码
        if (data.machineId) {
          setMachineId(data.machineId)
          setMachineIdLoading(false)
        }

        // 接收离线验证结果
        if (data.licenseV2Result) {
          setLoading(false)
          const result = data.licenseV2Result
          if (result.valid) {
            message.success('激活成功！')
            setTimeout(() => nav('/system'), 800)
          } else {
            message.error(result.error || '激活失败')
          }
        }

        // 接收在线验证结果
        if (data.onlineVerifyResult) {
          setOnlineLoading(false)
          const result = data.onlineVerifyResult
          if (result.valid) {
            message.success('在线验证成功！')
            setTimeout(() => nav('/system'), 800)
          } else {
            message.error(result.error || '在线验证失败')
          }
        }

        // 旧版兼容：selectFlag 处理
        if (data.selectFlag != null) {
          if (data.selectFlag === 'all') {
            localStorage.setItem('matrixTitle', true)
          } else {
            localStorage.removeItem('matrixTitle')
          }
        }

        // 旧版兼容：date 跳转
        if (data.date && param.search === '') {
          nav('/system')
        }
      } catch (err) {
        console.error('WebSocket message parse error:', err)
      }
    }
    ws.onerror = () => {}
    ws.onclose = () => {}

    return () => {
      if (ws) ws.close()
    }
  }, [])

  const wsSendObj = (obj) => {
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify(obj))
    }
  }

  // 获取机器码
  const handleGetMachineId = () => {
    setMachineIdLoading(true)
    wsSendObj({ getMachineId: true })
    // 超时处理
    setTimeout(() => setMachineIdLoading(false), 5000)
  }

  // 复制机器码
  const handleCopyMachineId = () => {
    if (!machineId) {
      message.warning('请先获取机器码')
      return
    }
    navigator.clipboard.writeText(machineId).then(() => {
      message.success('机器码已复制到剪贴板')
    }).catch(() => {
      // fallback
      const input = document.createElement('input')
      input.value = machineId
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      message.success('机器码已复制到剪贴板')
    })
  }

  // 离线激活
  const handleOfflineActivate = () => {
    if (!activationCode.trim()) {
      message.warning('请输入激活码')
      return
    }
    setLoading(true)
    wsSendObj({ licenseV2Activate: activationCode.trim() })
    // 超时处理
    setTimeout(() => setLoading(false), 10000)
  }

  // 在线验证
  const handleOnlineVerify = () => {
    setOnlineLoading(true)
    wsSendObj({ licenseV2Online: true })
    // 超时处理
    setTimeout(() => setOnlineLoading(false), 15000)
  }

  // 旧版密钥提交（兼容）
  const handleLegacySubmit = () => {
    if (!legacyKey.trim()) {
      message.warning('请输入密钥')
      return
    }
    const dateStamp = new Date().getTime()
    wsSendObj({
      date: {
        date: legacyKey.trim(),
        startTime: dateStamp
      }
    })
    nav('/system')
  }

  return (
    <div className="activate-page">
      <div className="activate-container">
        {/* 标题区域 */}
        <div className="activate-header">
          <SafetyCertificateOutlined className="activate-header-icon" />
          <div className="activate-header-text">
            <h2>设备激活</h2>
            <p>请选择激活方式完成设备授权</p>
          </div>
        </div>

        {/* 机器码区域 */}
        <div className="machine-id-section">
          <div className="section-label">
            <LaptopOutlined /> 本机机器码
          </div>
          <div className="machine-id-row">
            <div className="machine-id-display">
              {machineIdLoading ? (
                <Spin size="small" />
              ) : machineId ? (
                <span className="machine-id-text">{machineId}</span>
              ) : (
                <span className="machine-id-placeholder">点击右侧按钮获取</span>
              )}
            </div>
            <Tooltip title="获取机器码">
              <Button
                className="machine-id-btn get-btn"
                icon={<LaptopOutlined />}
                onClick={handleGetMachineId}
                loading={machineIdLoading}
              >
                获取
              </Button>
            </Tooltip>
            <Tooltip title="复制机器码">
              <Button
                className="machine-id-btn copy-btn"
                icon={<CopyOutlined />}
                onClick={handleCopyMachineId}
                disabled={!machineId}
              >
                复制
              </Button>
            </Tooltip>
          </div>
        </div>

        {/* 模式切换 */}
        <div className="mode-switch">
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { label: <span><KeyOutlined /> 离线激活</span>, value: 'offline' },
              { label: <span><CloudOutlined /> 在线验证</span>, value: 'online' },
              { label: <span><KeyOutlined /> 旧版密钥</span>, value: 'legacy' },
            ]}
            block
          />
        </div>

        {/* 离线激活 */}
        {mode === 'offline' && (
          <div className="activate-section">
            <div className="section-label">
              <KeyOutlined /> 输入激活码
            </div>
            <TextArea
              className="activate-input"
              placeholder="请粘贴管理员提供的专属激活码"
              rows={4}
              value={activationCode}
              onChange={(e) => setActivationCode(e.target.value)}
            />
            <div className="activate-actions">
              {param.search !== '' && (
                <Button
                  className="action-btn back-btn"
                  onClick={() => nav('/system')}
                >
                  返回主页
                </Button>
              )}
              <Button
                className="action-btn activate-btn"
                icon={<SafetyCertificateOutlined />}
                onClick={handleOfflineActivate}
                loading={loading}
              >
                激活
              </Button>
            </div>
            <div className="activate-hint">
              <p>1. 点击上方"获取"按钮获取本机机器码</p>
              <p>2. 将机器码发送给管理员获取专属激活码</p>
              <p>3. 粘贴激活码后点击"激活"完成授权</p>
            </div>
          </div>
        )}

        {/* 在线验证 */}
        {mode === 'online' && (
          <div className="activate-section">
            <div className="section-label">
              <WifiOutlined /> 在线验证
            </div>
            <div className="online-desc">
              <p>自动将本机机器码发送至授权服务器进行验证。</p>
              <p>请确保设备已联网。</p>
            </div>
            <div className="activate-actions">
              {param.search !== '' && (
                <Button
                  className="action-btn back-btn"
                  onClick={() => nav('/system')}
                >
                  返回主页
                </Button>
              )}
              <Button
                className="action-btn online-btn"
                icon={<CloudOutlined />}
                onClick={handleOnlineVerify}
                loading={onlineLoading}
              >
                一键在线验证
              </Button>
            </div>
          </div>
        )}

        {/* 旧版密钥（兼容） */}
        {mode === 'legacy' && (
          <div className="activate-section">
            <div className="section-label">
              <KeyOutlined /> 旧版密钥
            </div>
            <Input
              className="legacy-input"
              placeholder="请输入密钥"
              value={legacyKey}
              onChange={(e) => setLegacyKey(e.target.value.trim())}
            />
            <div className="activate-actions">
              {param.search !== '' && (
                <Button
                  className="action-btn back-btn"
                  onClick={() => nav('/system')}
                >
                  返回主页
                </Button>
              )}
              <Button
                className="action-btn activate-btn"
                onClick={handleLegacySubmit}
              >
                提交
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
