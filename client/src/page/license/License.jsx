/**
 * License.jsx
 * 密钥管理页面（验证方）
 *
 * 功能：
 * 1. 解析/预览密钥（自动识别：在线 hex / 离线 base64 激活码）
 * 2. 将密钥写入应用（WebSocket）
 * 3. 展示当前授权状态（在线/离线 + 剩余天数 + 校验中）
 *
 * 密钥统一在密钥管理系统（发证方）生成，桌面端不再生成。
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  Card, Button, Input, message, Modal,
  Tag, Divider, Row, Col, Typography, Space, Tooltip, Badge, Tabs, Alert
} from 'antd';
import {
  SendOutlined, UnlockOutlined, CheckCircleOutlined,
  SafetyCertificateOutlined, EyeOutlined, SettingOutlined, LockOutlined
} from '@ant-design/icons';
import { decryptStr } from './aesUtil';
import useMainWebSocket from '../../services/ws/useMainWebSocket';
import {
  getSensorTypeListMap,
  mergeLicenseErrorStatus,
  toLicenseStatus,
} from '../../services/ws/messages';
import {
  describeLicenseFile,
  getLicenseGroup,
  licenseSensorGroups,
} from './licenseScopeDisplay';
import './License.css';

const { Title, Text } = Typography;
const { TextArea } = Input;

/**
 * 传感器类型分组定义
 */
const SENSOR_GROUPS = licenseSensorGroups.map((group) => ({
  ...group,
  group: group.label,
}));

const ALL_SENSORS = SENSOR_GROUPS.flatMap((g) => g.items);

/**
 * 每种传感器类型对应的可用功能模块（numMatrixFlag）
 * 与 Title.jsx 中 Select options 保持一致
 */
const SENSOR_MODULES = {
  hand0205: [
    { value: 'num', label: '2D数字' },
    { value: 'normal', label: '3D遥操' },
    { value: 'num3D', label: '3D数字' },
    { value: 'numoriginal', label: '原始数据' },
    { value: 'skin', label: '3D皮肤' },
  ],
  hand0205Double: [
    { value: 'num', label: '2D数字' },
    { value: 'normal', label: '3D遥操' },
    { value: 'num3D', label: '3D数字' },
    { value: 'numoriginal', label: '原始数据' },
    { value: 'skin', label: '3D皮肤' },
  ],
  handGlove115200: [
    { value: 'num', label: '2D数字' },
    { value: 'normal', label: '3D遥操' },
    { value: 'num3D', label: '3D数字' },
    { value: 'numoriginal', label: '原始数据' },
    { value: 'skin', label: '3D皮肤' },
  ],
  handGloveFullPacket: [
    { value: 'num', label: '2D数字' },
    { value: 'normal', label: '3D遥操' },
    { value: 'num3D', label: '3D数字' },
    { value: 'numoriginal', label: '原始数据' },
    { value: 'skin', label: '3D皮肤' },
  ],
  footVideo: [
    { value: 'num', label: '2D数字' },
    { value: 'normal', label: '3D模型' },
    { value: 'numoriginal', label: '原始数据' },
  ],
  wholeChair: [
    { value: 'normal', label: '3D模型' },
  ],
  minzhen: [
    { value: 'normal', label: '3D模型' },
    { value: 'numoriginal', label: '原始数据' },
  ],
  robot1: [
    { value: 'normal', label: '3D模型' },
    { value: 'numoriginal', label: '原始数据' },
  ],
  robotSY: [
    { value: 'normal', label: '3D模型' },
    { value: 'numoriginal', label: '原始数据' },
  ],
  robotLCF: [
    { value: 'normal', label: '3D模型' },
    { value: 'numoriginal', label: '原始数据' },
  ],
  hand: [
    { value: 'normal', label: '3D模型' },
    { value: 'numoriginal', label: '原始数据' },
  ],
  handSinglePoint: [
    { value: 'normal', label: '3D模型' },
    { value: 'numoriginal', label: '原始数据' },
  ],
  jqbed: [
    { value: 'normal', label: '3D模型' },
    { value: 'numoriginal', label: '原始数据' },
  ],
  petCare: [
    { value: 'normal', label: '3D模型' },
    { value: 'numoriginal', label: '原始数据' },
  ],
  smallBed: [
    { value: 'normal', label: '3D模型' },
    { value: 'numoriginal', label: '原始数据' },
  ],
  smallBedNoAlg: [
    { value: 'normal', label: '3D模型' },
    { value: 'numoriginal', label: '原始数据' },
  ],
  smallBed12B: [
    { value: 'normal', label: '3D模型' },
    { value: 'numoriginal', label: '原始数据' },
  ],
  tempFullBed: [
    { value: 'normal', label: '3D模型' },
    { value: 'numoriginal', label: '原始数据' },
  ],
  daliegu: [
    { value: 'normal', label: '3D模型' },
    { value: 'numoriginal', label: '原始数据' },
  ],
  smallSample: [
    { value: 'normal', label: '3D模型' },
    { value: 'numoriginal', label: '原始数据' },
  ],
  bed4096: [
    { value: 'normal', label: '3D模型' },
    { value: 'numoriginal', label: '原始数据' },
  ],
  bed4096num: [
    { value: 'normal', label: '3D模型' },
    { value: 'numoriginal', label: '原始数据' },
  ],
  fast256: [
    { value: 'normal', label: '3D模型' },
    { value: 'numoriginal', label: '原始数据' },
  ],
  fast1024: [
    { value: 'normal', label: '3D模型' },
    { value: 'numoriginal', label: '原始数据' },
  ],
  humanBody: [
    { value: 'skin', label: '3D皮肤' },
  ],
};

/** 获取某传感器类型的可用功能模块，若无定义则返回通用选项 */
SENSOR_MODULES.petCareMini = [...(SENSOR_MODULES.petCare || [])];
SENSOR_MODULES.humanBodyOptimized = [...(SENSOR_MODULES.humanBody || [])];

const getModulesForSensor = (sensorValue) => {
  return SENSOR_MODULES[sensorValue] || [
    { value: 'normal', label: '3D模型' },
    { value: 'numoriginal', label: '原始数据' },
  ];
};

/**
 * 离线激活码解码预览：base64(JSON{payload,signature}) → 内层 payload。
 * 仅做解码展示，不做 RSA 验签（浏览器无 Node crypto）；真正验签在"写入应用"时由后端做。
 * @returns 解析结果对象或 null（非离线格式）
 */
const tryDecodeOffline = (input) => {
  try {
    const envelope = JSON.parse(atob(input));
    if (!envelope || !envelope.payload || !envelope.signature) return null;
    const payload = JSON.parse(atob(envelope.payload));
    const expireTs = parseFloat(payload.expireDate);
    const remainDays = Math.ceil((expireTs - Date.now()) / 86400000);
    const f = payload.sensorTypes;
    const fileDisplay = describeLicenseFile(f);
    return {
      version: 'offline',
      raw: payload,
      expireDate: Number.isNaN(expireTs) ? '—' : new Date(expireTs).toLocaleString(),
      remainDays,
      expired: remainDays < 0,
      fileDisplay,
      moduleConfig: null,
    };
  } catch (e) {
    return null;
  }
};

const License = () => {
  // ---- 解析密钥 ----
  const [parseInput, setParseInput] = useState('');
  const [parseResult, setParseResult] = useState(null);

  // ---- WebSocket ----
  // 当前授权状态（来自后端广播：在线/离线、剩余天数、校验中、未授权原因、锁定）
  const [licenseStatus, setLicenseStatus] = useState(null);
  // 后台传感器类型 value→中文名映射（首屏从 localStorage 兜底，WS 连上后刷新）
  const [sensorTypeMap, setSensorTypeMap] = useState(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem('sensorTypeList') || 'null');
      if (parsed && parsed.map && typeof parsed.map === 'object') return parsed.map;
    } catch (e) { /* ignore */ }
    return null;
  });

  // value→中文名：优先后台动态映射，回退到本地写死 ALL_SENSORS，再回退原样
  const sensorLabelOf = useCallback((value) => {
    if (sensorTypeMap && sensorTypeMap[value]) return sensorTypeMap[value];
    const sensor = ALL_SENSORS.find((s) => s.value === value);
    return sensor ? sensor.label : value;
  }, [sensorTypeMap]);

  const handleSocketMessage = useCallback((msg) => {
    const sensorTypeMapPayload = getSensorTypeListMap(msg);
    if (sensorTypeMapPayload) {
      setSensorTypeMap(sensorTypeMapPayload);
      try { localStorage.setItem('sensorTypeList', JSON.stringify(msg.sensorTypeList)); } catch (e) { /* ignore */ }
      return;
    }

    const nextLicenseStatus = toLicenseStatus(msg);
    if (nextLicenseStatus) {
      setLicenseStatus(nextLicenseStatus);
      return;
    }

    if (msg?.licenseError != null) {
      setLicenseStatus((prev) => mergeLicenseErrorStatus(prev, msg));
    }
  }, []);

  const {
    connected: wsConnected,
    submitLicenseKey,
    requestSensorTypes,
    refreshLicense,
  } = useMainWebSocket({
    onMessage: handleSocketMessage,
  });

  useEffect(() => {
    if (wsConnected) {
      requestSensorTypes();
    }
  }, [requestSensorTypes, wsConnected]);

  // 解析密钥（自动识别：base64=离线、hex=在线）
  const handleParse = useCallback(() => {
    const input = parseInput.trim();
    if (!input) { message.warning('请输入密钥'); return; }

    // 离线格式优先：能解码出 {payload, signature} → 离线版预览（不验签）
    const offline = tryDecodeOffline(input);
    if (offline) { setParseResult(offline); return; }

    // 在线格式：hex → ECB 解密
    try {
      const decrypted = decryptStr(input);
      if (!decrypted) throw new Error('decrypt empty');
      const obj = JSON.parse(decrypted);
      const expireDate = new Date(obj.date);
      const now = new Date();
      const remainDays = Math.ceil((expireDate - now) / 86400000);

      const fileDisplay = describeLicenseFile(obj.file);

      setParseResult({
        version: 'online',
        raw: obj,
        expireDate: expireDate.toLocaleString(),
        remainDays,
        expired: remainDays < 0,
        fileDisplay,
        moduleConfig: obj.moduleConfig || null,
      });
    } catch (e) {
      message.error('密钥解析失败，请检查密钥是否正确');
      setParseResult(null);
    }
  }, [parseInput]);

  // 将当前输入的密钥写入应用（在线 hex / 离线 base64 均可；后端按格式校验）
  const handleWriteToApp = useCallback(() => {
    const input = parseInput.trim();
    if (!input) { message.warning('请先输入密钥'); return; }
    if (!wsConnected) {
      message.error('应用未连接，请确保应用正在运行');
      return;
    }
    submitLicenseKey(input, { includeStartTime: false });
    message.success('密钥已写入应用，正在校验…');
  }, [parseInput, submitLicenseKey, wsConnected]);

  return (
    <div className="license-page">
      {/* Header */}
      <div className="license-header">
        <SafetyCertificateOutlined className="license-header-icon" />
        <div>
          <Title level={3} style={{ margin: 0, color: '#fff' }}>密钥配置中心</Title>
          <Text style={{ color: 'rgba(255,255,255,0.7)' }}>管理传感器授权类型与有效期</Text>
        </div>
        <div className="license-header-status">
          <Badge status={wsConnected ? 'success' : 'error'} />
          <Text style={{ color: 'rgba(255,255,255,0.8)' }}>
            {wsConnected ? '应用已连接' : '应用未连接'}
          </Text>
        </div>
      </div>

      {/* 当前授权状态：校验中 / 锁定 / 在线·离线(+断网缓存) + 剩余天数 / 未授权原因 */}
      {licenseStatus && (
        <Alert
          style={{ marginBottom: 16 }}
          showIcon
          type={licenseStatus.checking ? 'info' : licenseStatus.valid ? 'success' : 'error'}
          icon={licenseStatus.locked ? <LockOutlined /> : undefined}
          message={
            licenseStatus.checking
              ? '正在校验授权…'
              : licenseStatus.locked
                ? `${licenseStatus.error || '检测到异常行为'}，请联系厂商重新获取密钥`
                : licenseStatus.valid
                  ? `${licenseStatus.type === 'offline' ? '离线授权' : '在线授权'}${licenseStatus.offline ? '（断网缓存兜底）' : ''} · 剩余 ${licenseStatus.remainingDays ?? '—'} 天 · 到期 ${licenseStatus.date ? new Date(licenseStatus.date).toLocaleString() : '—'}`
                  : (licenseStatus.error || '未检测到有效授权')
          }
          action={
            (!licenseStatus.checking && !licenseStatus.valid && !licenseStatus.locked && !licenseStatus.noLicense) ? (
              <Button
                size="small"
                type="primary"
                onClick={() => {
                  // 清缓存 + 立刻联网复查：后台续期/恢复后无需重启即时生效
                  refreshLicense();
                  setLicenseStatus({ checking: true });
                }}
              >重新获取授权</Button>
            ) : undefined
          }
        />
      )}

      <Tabs
        defaultActiveKey="parse"
        className="license-tabs"
        items={[
          {
            key: 'parse',
            label: <span><UnlockOutlined /> 解析密钥</span>,
            children: (
              <div className="license-content">
                <Row gutter={[24, 24]}>
                  <Col xs={24} lg={12}>
                    <Card title={<Space><UnlockOutlined /> 输入密钥</Space>}>
                      <TextArea
                        placeholder="粘贴在线密钥(hex) 或 离线激活码(base64)..."
                        value={parseInput}
                        onChange={(e) => setParseInput(e.target.value)}
                        autoSize={{ minRows: 4, maxRows: 8 }}
                        style={{ marginBottom: 16 }}
                      />
                      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                        <Button icon={<UnlockOutlined />} onClick={handleParse}>
                          解析预览
                        </Button>
                        <Tooltip title={wsConnected ? '将密钥写入正在运行的应用' : '应用未连接'}>
                          <Button type="primary" icon={<SendOutlined />} onClick={handleWriteToApp} disabled={!wsConnected}>
                            写入应用
                          </Button>
                        </Tooltip>
                      </Space>
                    </Card>
                  </Col>
                  <Col xs={24} lg={12}>
                    <Card title={<Space><CheckCircleOutlined /> 解析结果</Space>}>
                      {parseResult ? (
                        <div className="parse-result">
                          <div className="parse-item">
                            <Text type="secondary">密钥类型：</Text>
                            <Tag color={parseResult.version === 'offline' ? 'purple' : 'blue'}>
                              {parseResult.version === 'offline' ? '离线激活码' : '在线密钥'}
                            </Tag>
                          </div>
                          <div className="parse-item">
                            <Text type="secondary">授权状态：</Text>
                            <Tag color={parseResult.expired ? 'red' : 'green'}>
                              {parseResult.expired ? '已过期' : '有效'}
                            </Tag>
                          </div>
                          {parseResult.version === 'offline' && (
                            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                              注：此处仅解码预览，签名将在「写入应用」时由后端校验。
                            </Text>
                          )}
                          <div className="parse-item">
                            <Text type="secondary">到期时间：</Text>
                            <Text strong>{parseResult.expireDate}</Text>
                          </div>
                          <div className="parse-item">
                            <Text type="secondary">剩余天数：</Text>
                            <Text strong type={parseResult.remainDays < 30 ? 'danger' : undefined}>
                              {parseResult.remainDays} 天
                            </Text>
                          </div>
                          <Divider />
                          <div className="parse-item">
                            <Text type="secondary">授权模式：</Text>
                            <Text strong>
                              {parseResult.fileDisplay.type === 'all'
                                ? '全部授权'
                                : parseResult.fileDisplay.type === 'group'
                                  ? `分类全选 (${parseResult.fileDisplay.groupKeys.length} 类)`
                                : parseResult.fileDisplay.type === 'multi'
                                  ? `多类型 (${parseResult.fileDisplay.list.length})`
                                  : '单类型'}
                            </Text>
                          </div>
                          {parseResult.fileDisplay.groupKeys.length > 0 && (
                            <div className="parse-types">
                              {parseResult.fileDisplay.groupKeys.map((groupKey) => {
                                const group = getLicenseGroup(groupKey);
                                return (
                                  <Tag key={groupKey} color="gold">
                                    {group ? `${group.label}全部` : groupKey}
                                  </Tag>
                                );
                              })}
                            </div>
                          )}
                          {parseResult.fileDisplay.type !== 'all' && (
                            <div className="parse-types">
                              {parseResult.fileDisplay.list.map((val) => (
                                <Tag key={val} color="blue">{sensorLabelOf(val)}</Tag>
                              ))}
                            </div>
                          )}
                          {parseResult.moduleConfig && Object.keys(parseResult.moduleConfig).length > 0 && (
                            <>
                              <Divider style={{ margin: '8px 0' }} />
                              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
                                <SettingOutlined style={{ marginRight: 4 }} />功能模块配置：
                              </Text>
                              {Object.entries(parseResult.moduleConfig).map(([sensorVal, moduleVal]) => {
                                const modules = getModulesForSensor(sensorVal);
                                const mod = modules.find(m => m.value === moduleVal);
                                return (
                                  <div key={sensorVal} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                    <Text style={{ fontSize: 12 }}>{sensorLabelOf(sensorVal)}</Text>
                                    <Tag color="purple" icon={<EyeOutlined />} style={{ margin: 0, fontSize: 11 }}>
                                      {mod?.label || moduleVal}
                                    </Tag>
                                  </div>
                                );
                              })}
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="parse-empty">
                          <Text type="secondary">请在左侧输入密钥并点击解析</Text>
                        </div>
                      )}
                    </Card>
                  </Col>
                </Row>
              </div>
            ),
          },
        ]}
      />

      {/* 锁定模态框：检测到时间回拨/篡改时弹出，提示联系厂商重新获取密钥 */}
      <Modal
        open={!!(licenseStatus && licenseStatus.locked)}
        title={<span><LockOutlined style={{ color: '#cf1322', marginRight: 8 }} />授权异常</span>}
        closable={false}
        maskClosable={false}
        keyboard={false}
        okText="确定"
        cancelButtonProps={{ style: { display: 'none' } }}
        onOk={() => {
          setLicenseStatus((prev) => ({ ...(prev || {}), locked: false }));
          window.location.hash = '#/?from=system';
        }}
      >
        <p style={{ marginBottom: 8 }}>
          {(licenseStatus && licenseStatus.error) || '检测到异常行为'}。
        </p>
        <p style={{ color: '#888' }}>
          串口连接、数据采集等功能已被禁用。请联系厂商重新获取密钥，点击「确定」前往密钥输入页写入新密钥。
        </p>
      </Modal>
    </div>
  );
};

export default License;
