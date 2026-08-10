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
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Card, Button, Input, message, Modal,
  Tag, Divider, Row, Col, Typography, Space, Tooltip, Badge, Tabs, Alert
} from 'antd';
import {
  SendOutlined, UnlockOutlined, CheckCircleOutlined,
  SafetyCertificateOutlined, EyeOutlined, SettingOutlined, LockOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { getLanguageLocale } from '../../i18n';
import { translateBackendMessage } from '../../i18n/translateBackendMessage';
import { decryptStr } from './aesUtil';
import './License.css';

const { Title, Text } = Typography;
const { TextArea } = Input;

/**
 * 传感器类型分组定义
 */
const SENSOR_GROUPS = [
  {
    groupKey: 'licenseAdmin.groups.common',
    icon: '⭐',
    items: [
      { labelKey: 'sensorHand', value: 'hand' },
    ],
  },
  {
    groupKey: 'licenseAdmin.groups.care',
    icon: '❤️',
    items: [
      { labelKey: 'sensorJqbed', value: 'jqbed' },
      { labelKey: 'sensorPetCare', value: 'petCare' },
    ],
  },
  {
    groupKey: 'licenseAdmin.groups.lab',
    icon: '🧪',
    items: [
      { labelKey: 'sensorBed4096', value: 'bed4096' },
    ],
  },
  {
    groupKey: 'licenseAdmin.groups.custom',
    icon: '⚙️',
    items: [
      { labelKey: 'sensorSmallBedNoAlg', value: 'smallBedNoAlg' },
      { labelKey: 'sensorSmallBed12B', value: 'smallBed12B' },
      { labelKey: 'sensorTempFullBed', value: 'tempFullBed' },
      { labelKey: 'sensorWholeChair', value: 'wholeChair' },
      { labelKey: 'sensorMinzhen', value: 'minzhen' },
    ],
  },
  {
    groupKey: 'licenseAdmin.groups.precision',
    icon: '🔬',
    items: [
      { labelKey: 'sensorHandSinglePoint', value: 'handSinglePoint' },
      { labelKey: 'sensorHand0205', value: 'hand0205' },
      { labelKey: 'sensorHand0205Double', value: 'hand0205Double' },
      { labelKey: 'sensorHandGlove115200', value: 'handGlove115200' },
      { labelKey: 'sensorHandGloveFullPacket', value: 'handGloveFullPacket' },
      { labelKey: 'sensorSmallSample', value: 'smallSample' },
      { labelKey: 'sensorRobot1', value: 'robot1' },
      { labelKey: 'sensorRobotSY', value: 'robotSY' },
      { labelKey: 'sensorRobotLCF', value: 'robotLCF' },
      { labelKey: 'sensorFootVideo', value: 'footVideo' },
      { labelKey: 'sensorDaliegu', value: 'daliegu' },
      { labelKey: 'sensorFast256', value: 'fast256' },
      { labelKey: 'sensorFast1024', value: 'fast1024' },
      { labelKey: 'sensorHumanBody', value: 'humanBody' },
      { labelKey: 'sensorHumanBodyOptimized', value: 'humanBodyOptimized' },
    ],
  },
];

/*
SENSOR_GROUPS
  .find((group) => group.items.some((item) => item.value === 'petCare'))
  ?.items.push({ label: 'mini鐪嬫姢', value: 'petCareMini' });

*/

SENSOR_GROUPS
  .find((group) => group.items.some((item) => item.value === 'petCare'))
  ?.items.push({ labelKey: 'sensorPetCareMini', value: 'petCareMini' });

const ALL_SENSORS = SENSOR_GROUPS.flatMap((g) => g.items);

/**
 * 每种传感器类型对应的可用功能模块（numMatrixFlag）
 * 与 Title.jsx 中 Select options 保持一致
 */
const SENSOR_MODULES = {
  hand0205: [
    { value: 'num', labelKey: 'data2D' },
    { value: 'normal', labelKey: 'tel3D' },
    { value: 'num3D', labelKey: 'data3D' },
    { value: 'numoriginal', labelKey: 'rawData' },
    { value: 'skin', labelKey: 'skin3D' },
  ],
  hand0205Double: [
    { value: 'num', labelKey: 'data2D' },
    { value: 'normal', labelKey: 'tel3D' },
    { value: 'num3D', labelKey: 'data3D' },
    { value: 'numoriginal', labelKey: 'rawData' },
    { value: 'skin', labelKey: 'skin3D' },
  ],
  handGlove115200: [
    { value: 'num', labelKey: 'data2D' },
    { value: 'normal', labelKey: 'tel3D' },
    { value: 'num3D', labelKey: 'data3D' },
    { value: 'numoriginal', labelKey: 'rawData' },
    { value: 'skin', labelKey: 'skin3D' },
  ],
  handGloveFullPacket: [
    { value: 'num', labelKey: 'data2D' },
    { value: 'normal', labelKey: 'tel3D' },
    { value: 'num3D', labelKey: 'data3D' },
    { value: 'numoriginal', labelKey: 'rawData' },
    { value: 'skin', labelKey: 'skin3D' },
  ],
  footVideo: [
    { value: 'num', labelKey: 'data2D' },
    { value: 'normal', labelKey: 'modal3D' },
    { value: 'numoriginal', labelKey: 'rawData' },
  ],
  wholeChair: [
    { value: 'normal', labelKey: 'modal3D' },
  ],
  minzhen: [
    { value: 'normal', labelKey: 'modal3D' },
    { value: 'numoriginal', labelKey: 'rawData' },
  ],
  robot1: [
    { value: 'normal', labelKey: 'modal3D' },
    { value: 'numoriginal', labelKey: 'rawData' },
  ],
  robotSY: [
    { value: 'normal', labelKey: 'modal3D' },
    { value: 'numoriginal', labelKey: 'rawData' },
  ],
  robotLCF: [
    { value: 'normal', labelKey: 'modal3D' },
    { value: 'numoriginal', labelKey: 'rawData' },
  ],
  hand: [
    { value: 'normal', labelKey: 'modal3D' },
    { value: 'numoriginal', labelKey: 'rawData' },
  ],
  handSinglePoint: [
    { value: 'normal', labelKey: 'modal3D' },
    { value: 'numoriginal', labelKey: 'rawData' },
  ],
  jqbed: [
    { value: 'normal', labelKey: 'modal3D' },
    { value: 'numoriginal', labelKey: 'rawData' },
  ],
  petCare: [
    { value: 'normal', labelKey: 'modal3D' },
    { value: 'numoriginal', labelKey: 'rawData' },
  ],
  smallBed: [
    { value: 'normal', labelKey: 'modal3D' },
    { value: 'numoriginal', labelKey: 'rawData' },
  ],
  smallBedNoAlg: [
    { value: 'normal', labelKey: 'modal3D' },
    { value: 'numoriginal', labelKey: 'rawData' },
  ],
  smallBed12B: [
    { value: 'normal', labelKey: 'modal3D' },
    { value: 'numoriginal', labelKey: 'rawData' },
  ],
  tempFullBed: [
    { value: 'normal', labelKey: 'modal3D' },
    { value: 'numoriginal', labelKey: 'rawData' },
  ],
  daliegu: [
    { value: 'normal', labelKey: 'modal3D' },
    { value: 'numoriginal', labelKey: 'rawData' },
  ],
  smallSample: [
    { value: 'normal', labelKey: 'modal3D' },
    { value: 'numoriginal', labelKey: 'rawData' },
  ],
  bed4096: [
    { value: 'normal', labelKey: 'modal3D' },
    { value: 'numoriginal', labelKey: 'rawData' },
  ],
  bed4096num: [
    { value: 'normal', labelKey: 'modal3D' },
    { value: 'numoriginal', labelKey: 'rawData' },
  ],
  fast256: [
    { value: 'normal', labelKey: 'modal3D' },
    { value: 'numoriginal', labelKey: 'rawData' },
  ],
  fast1024: [
    { value: 'normal', labelKey: 'modal3D' },
    { value: 'numoriginal', labelKey: 'rawData' },
  ],
  humanBody: [
    { value: 'skin', labelKey: 'skin3D' },
  ],
  humanBodyOptimized: [
    { value: 'skin', labelKey: 'skin3D' },
    { value: 'numoriginal', labelKey: 'rawData' },
  ],
};

/** 获取某传感器类型的可用功能模块，若无定义则返回通用选项 */
SENSOR_MODULES.petCareMini = [...(SENSOR_MODULES.petCare || [])];

const getModulesForSensor = (sensorValue) => {
  return SENSOR_MODULES[sensorValue] || [
    { value: 'normal', labelKey: 'modal3D' },
    { value: 'numoriginal', labelKey: 'rawData' },
  ];
};

/**
 * 离线激活码解码预览：base64(JSON{payload,signature}) → 内层 payload。
 * 仅做解码展示，不做 RSA 验签（浏览器无 Node crypto）；真正验签在"写入应用"时由后端做。
 * @returns 解析结果对象或 null（非离线格式）
 */
const tryDecodeOffline = (input, locale) => {
  try {
    const envelope = JSON.parse(atob(input));
    if (!envelope || !envelope.payload || !envelope.signature) return null;
    const payload = JSON.parse(atob(envelope.payload));
    const expireTs = parseFloat(payload.expireDate);
    const remainDays = Math.ceil((expireTs - Date.now()) / 86400000);
    const f = payload.sensorTypes;
    let fileDisplay;
    if (f === 'all') fileDisplay = { type: 'all', list: [] };
    else if (Array.isArray(f)) fileDisplay = { type: 'multi', list: f };
    else fileDisplay = { type: 'single', list: [f] };
    return {
      version: 'offline',
      raw: payload,
      expireDate: Number.isNaN(expireTs) ? '—' : new Date(expireTs).toLocaleString(locale),
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
  const { t, i18n } = useTranslation();
  const locale = getLanguageLocale(i18n.language);
  // ---- 解析密钥 ----
  const [parseInput, setParseInput] = useState('');
  const [parseResult, setParseResult] = useState(null);

  // ---- WebSocket ----
  const wsRef = useRef(null);
  const [wsConnected, setWsConnected] = useState(false);
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

  // Known sensor labels use the active language; dynamic backend types fall back to their supplied names.
  const sensorLabelOf = useCallback((value) => {
    const sensor = ALL_SENSORS.find((s) => s.value === value);
    if (sensor) return t(sensor.labelKey);
    if (sensorTypeMap && sensorTypeMap[value]) return sensorTypeMap[value];
    return value;
  }, [sensorTypeMap, t]);

  useEffect(() => {
    try {
      const ws = new WebSocket('ws://localhost:19999');
      ws.onopen = () => {
        setWsConnected(true);
        // 主动请求传感器类型清单（请求-应答；主进程连接时也会主动 push 一次）
        try { ws.send(JSON.stringify({ getSensorTypes: true })); } catch (e) { /* ignore */ }
      };
      ws.onclose = () => setWsConnected(false);
      ws.onerror = () => setWsConnected(false);
      ws.onmessage = (evt) => {
        let msg;
        try { msg = JSON.parse(evt.data); } catch (e) { return; }
        if (msg.sensorTypeList && msg.sensorTypeList.map && typeof msg.sensorTypeList.map === 'object') {
          // 传感器类型清单：存映射并落地 localStorage 兜底
          setSensorTypeMap(msg.sensorTypeList.map);
          try { localStorage.setItem('sensorTypeList', JSON.stringify(msg.sensorTypeList)); } catch (e) { /* ignore */ }
          return;
        }
        if (msg.licenseLocked) {
          // 锁定（时间回拨/篡改）→ 弹"请联系厂商重新获取密钥"
          setLicenseStatus({ locked: true, valid: false, error: msg.reason || null });
        } else if (msg.licenseChecking) {
          // 校验中：只显示"校验中…"，不闪红
          setLicenseStatus({ checking: true });
        } else if (msg.licenseType !== undefined && msg.date != null) {
          // 授权状态广播
          setLicenseStatus({
            checking: !!msg.checking,
            valid: !!msg.valid,
            locked: false,
            type: msg.licenseType,
            date: msg.date,
            remainingDays: msg.remainingDays,
            offline: !!msg.offline,
          });
        } else if (msg.licenseError != null) {
          // 未授权 / 校验失败原因（覆盖在状态之上）
          setLicenseStatus((prev) => ({
            ...(prev || {}),
            checking: false,
            valid: false,
            locked: false,
            error: msg.licenseError,
            noLicense: !!msg.noLicense,
          }));
        }
      };
      wsRef.current = ws;
    } catch (e) {
      console.warn('WebSocket connect failed', e);
    }
    return () => { if (wsRef.current) wsRef.current.close(); };
  }, []);

  // 解析密钥（自动识别：base64=离线、hex=在线）
  const handleParse = useCallback(() => {
    const input = parseInput.trim();
    if (!input) { message.warning(t('licenseAdmin.enterKeyWarning')); return; }

    // 离线格式优先：能解码出 {payload, signature} → 离线版预览（不验签）
    const offline = tryDecodeOffline(input, locale);
    if (offline) { setParseResult(offline); return; }

    // 在线格式：hex → ECB 解密
    try {
      const decrypted = decryptStr(input);
      if (!decrypted) throw new Error('decrypt empty');
      const obj = JSON.parse(decrypted);
      const expireDate = new Date(obj.date);
      const now = new Date();
      const remainDays = Math.ceil((expireDate - now) / 86400000);

      let fileDisplay;
      if (obj.file === 'all') {
        fileDisplay = { type: 'all', list: [] };
      } else if (Array.isArray(obj.file)) {
        fileDisplay = { type: 'multi', list: obj.file };
      } else {
        fileDisplay = { type: 'single', list: [obj.file] };
      }

      setParseResult({
        version: 'online',
        raw: obj,
        expireDate: expireDate.toLocaleString(locale),
        remainDays,
        expired: remainDays < 0,
        fileDisplay,
        moduleConfig: obj.moduleConfig || null,
      });
    } catch (e) {
      message.error(t('licenseAdmin.parseFailed'));
      setParseResult(null);
    }
  }, [locale, parseInput, t]);

  // 将当前输入的密钥写入应用（在线 hex / 离线 base64 均可；后端按格式校验）
  const handleWriteToApp = useCallback(() => {
    const input = parseInput.trim();
    if (!input) { message.warning(t('licenseAdmin.enterKeyFirst')); return; }
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      message.error(t('licenseAdmin.appRequired'));
      return;
    }
    wsRef.current.send(JSON.stringify({ date: { date: input } }));
    message.success(t('licenseAdmin.writeSuccess'));
  }, [parseInput, t]);

  return (
    <div className="license-page">
      {/* Header */}
      <div className="license-header">
        <SafetyCertificateOutlined className="license-header-icon" />
        <div>
          <Title level={3} style={{ margin: 0, color: '#fff' }}>{t('licenseAdmin.title')}</Title>
          <Text style={{ color: 'rgba(255,255,255,0.7)' }}>{t('licenseAdmin.subtitle')}</Text>
        </div>
        <div className="license-header-status">
          <Badge status={wsConnected ? 'success' : 'error'} />
          <Text style={{ color: 'rgba(255,255,255,0.8)' }}>
            {wsConnected ? t('licenseAdmin.appConnected') : t('licenseAdmin.appDisconnected')}
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
              ? t('licenseAdmin.validating')
              : licenseStatus.locked
                ? t('licenseAdmin.lockedSummary', {
                  reason: translateBackendMessage(licenseStatus.error, t) || t('license.anomalyDetected'),
                })
                : licenseStatus.valid
                  ? t('licenseAdmin.statusSummary', {
                    type: licenseStatus.type === 'offline' ? t('licenseAdmin.offlineLicense') : t('licenseAdmin.onlineLicense'),
                    fallback: licenseStatus.offline ? t('licenseAdmin.offlineFallback') : '',
                    days: licenseStatus.remainingDays ?? '—',
                    date: licenseStatus.date ? new Date(licenseStatus.date).toLocaleString(locale) : '—',
                  })
                  : (translateBackendMessage(licenseStatus.error, t) || t('licenseAdmin.noValidLicense'))
          }
          action={
            (!licenseStatus.checking && !licenseStatus.valid && !licenseStatus.locked && !licenseStatus.noLicense) ? (
              <Button
                size="small"
                type="primary"
                onClick={() => {
                  // 清缓存 + 立刻联网复查：后台续期/恢复后无需重启即时生效
                  try { wsRef.current && wsRef.current.send(JSON.stringify({ refreshLicense: true })); } catch (e) { /* ignore */ }
                  setLicenseStatus({ checking: true });
                }}
              >{t('license.refreshAuthorization')}</Button>
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
            label: <span><UnlockOutlined /> {t('licenseAdmin.parseKey')}</span>,
            children: (
              <div className="license-content">
                <Row gutter={[24, 24]}>
                  <Col xs={24} lg={12}>
                    <Card title={<Space><UnlockOutlined /> {t('licenseAdmin.inputKey')}</Space>}>
                      <TextArea
                        placeholder={t('licenseAdmin.inputPlaceholder')}
                        value={parseInput}
                        onChange={(e) => setParseInput(e.target.value)}
                        autoSize={{ minRows: 4, maxRows: 8 }}
                        style={{ marginBottom: 16 }}
                      />
                      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                        <Button icon={<UnlockOutlined />} onClick={handleParse}>
                          {t('licenseAdmin.parsePreview')}
                        </Button>
                        <Tooltip title={wsConnected ? t('licenseAdmin.writeHint') : t('licenseAdmin.appNotConnected')}>
                          <Button type="primary" icon={<SendOutlined />} onClick={handleWriteToApp} disabled={!wsConnected}>
                            {t('licenseAdmin.writeToApp')}
                          </Button>
                        </Tooltip>
                      </Space>
                    </Card>
                  </Col>
                  <Col xs={24} lg={12}>
                    <Card title={<Space><CheckCircleOutlined /> {t('licenseAdmin.parseResult')}</Space>}>
                      {parseResult ? (
                        <div className="parse-result">
                          <div className="parse-item">
                            <Text type="secondary">{t('licenseAdmin.keyType')}</Text>
                            <Tag color={parseResult.version === 'offline' ? 'purple' : 'blue'}>
                              {parseResult.version === 'offline' ? t('licenseAdmin.offlineCode') : t('licenseAdmin.onlineKey')}
                            </Tag>
                          </div>
                          <div className="parse-item">
                            <Text type="secondary">{t('licenseAdmin.authorizationStatus')}</Text>
                            <Tag color={parseResult.expired ? 'red' : 'green'}>
                              {parseResult.expired ? t('licenseAdmin.expired') : t('licenseAdmin.valid')}
                            </Tag>
                          </div>
                          {parseResult.version === 'offline' && (
                            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                              {t('licenseAdmin.previewNote')}
                            </Text>
                          )}
                          <div className="parse-item">
                            <Text type="secondary">{t('licenseAdmin.expiryTime')}</Text>
                            <Text strong>{parseResult.expireDate}</Text>
                          </div>
                          <div className="parse-item">
                            <Text type="secondary">{t('licenseAdmin.remainingDays')}</Text>
                            <Text strong type={parseResult.remainDays < 30 ? 'danger' : undefined}>
                              {parseResult.remainDays} {t('common.day')}
                            </Text>
                          </div>
                          <Divider />
                          <div className="parse-item">
                            <Text type="secondary">{t('licenseAdmin.authorizationMode')}</Text>
                            <Text strong>
                              {parseResult.fileDisplay.type === 'all'
                                ? t('licenseAdmin.allSensors')
                                : parseResult.fileDisplay.type === 'multi'
                                  ? t('licenseAdmin.multiType', { count: parseResult.fileDisplay.list.length })
                                  : t('licenseAdmin.singleType')}
                            </Text>
                          </div>
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
                                <SettingOutlined style={{ marginRight: 4 }} />{t('licenseAdmin.moduleConfig')}
                              </Text>
                              {Object.entries(parseResult.moduleConfig).map(([sensorVal, moduleVal]) => {
                                const modules = getModulesForSensor(sensorVal);
                                const mod = modules.find(m => m.value === moduleVal);
                                return (
                                  <div key={sensorVal} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                    <Text style={{ fontSize: 12 }}>{sensorLabelOf(sensorVal)}</Text>
                                    <Tag color="purple" icon={<EyeOutlined />} style={{ margin: 0, fontSize: 11 }}>
                                      {mod?.labelKey ? t(mod.labelKey) : moduleVal}
                                    </Tag>
                                  </div>
                                );
                              })}
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="parse-empty">
                          <Text type="secondary">{t('licenseAdmin.emptyPreview')}</Text>
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
        title={<span><LockOutlined style={{ color: '#cf1322', marginRight: 8 }} />{t('license.anomaly')}</span>}
        closable={false}
        maskClosable={false}
        keyboard={false}
        okText={t('common.confirm')}
        cancelButtonProps={{ style: { display: 'none' } }}
        onOk={() => {
          setLicenseStatus((prev) => ({ ...(prev || {}), locked: false }));
          window.location.hash = '#/?from=system';
        }}
      >
        <p style={{ marginBottom: 8 }}>
          {translateBackendMessage(licenseStatus && licenseStatus.error, t) || t('license.anomalyDetected')}
        </p>
        <p style={{ color: '#888' }}>
          {t('license.anomalyAction')}
        </p>
      </Modal>
    </div>
  );
};

export default License;

