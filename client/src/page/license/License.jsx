/**
 * License.js
 * 密钥配置可视化页面
 *
 * 功能：
 * 1. 可视化选择传感器类型（多选/全选）
 * 2. 设置授权有效期（天数或日期选择）
 * 3. 一键生成密钥
 * 4. 密钥解析（粘贴密钥查看内容）
 * 5. 通过 WebSocket 直接写入到应用
 * 6. 直接选择到期时间（用于测试过期弹窗）
 */
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  Card, Checkbox, Button, InputNumber, DatePicker, Input, message,
  Tag, Divider, Row, Col, Typography, Space, Tooltip, Badge, Tabs, Switch, Radio, Alert
} from 'antd';
import {
  KeyOutlined, CopyOutlined, SendOutlined, UnlockOutlined,
  CheckCircleOutlined, ClockCircleOutlined, AppstoreOutlined,
  SafetyCertificateOutlined, ReloadOutlined, ExperimentOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { encStr, decryptStr } from './aesUtil';
import './License.css';

const { Title, Text } = Typography;
const { TextArea } = Input;

/**
 * 传感器类型分组定义
 */
const SENSOR_GROUPS = [
  {
    group: '常用',
    icon: '⭐',
    items: [
      { label: '手部检测', value: 'hand' },
    ],
  },
  {
    group: '关怀',
    icon: '❤️',
    items: [
      { label: '小床监测', value: 'jqbed' },
    ],
  },
  {
    group: '精密',
    icon: '🔬',
    items: [
      { label: '触觉手套', value: 'hand0205' },
      { label: '触觉手套(115200)', value: 'handGlove115200' },
      { label: '小型样品', value: 'smallSample' },
      { label: '宇树G1触觉上衣', value: 'robot1' },
      { label: '松延N2触觉上衣', value: 'robotSY' },
      { label: '零次方H1触觉上衣', value: 'robotLCF' },
      { label: '触觉足底', value: 'footVideo' },
      { label: '14x20高速', value: 'daliegu' },
      { label: '16x16高速', value: 'fast256' },
      { label: '32x32高速', value: 'fast1024' },
      { label: '32x32高速测试', value: 'normalFast' },
    ],
  },
];

const ALL_SENSORS = SENSOR_GROUPS.flatMap((g) => g.items);

/** 过期测试快捷按钮 */
const EXPIRED_PRESETS = [
  { label: '已过期1天', offset: -1 },
  { label: '已过期7天', offset: -7 },
  { label: '已过期30天', offset: -30 },
  { label: '1分钟后过期', offsetMs: 60 * 1000 },
  { label: '5分钟后过期', offsetMs: 5 * 60 * 1000 },
  { label: '1小时后过期', offsetMs: 60 * 60 * 1000 },
];

/** 天数快捷预设 */
const DAY_PRESETS = [30, 90, 180, 365, 730, 1095];

/** 传感器快捷预设 */
const SENSOR_PRESETS = [
  { label: '触觉全套', types: ['hand0205', 'handGlove115200', 'robot1', 'robotSY', 'robotLCF', 'footVideo'] },
  { label: '高速矩阵', types: ['fast256', 'fast1024', 'normalFast', 'daliegu'] },
];

const License = () => {
  // ---- 生成密钥 ----
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [isAll, setIsAll] = useState(false);
  const [days, setDays] = useState(365);
  const [generatedKey, setGeneratedKey] = useState('');

  // ---- 时间模式 ----
  const [timeMode, setTimeMode] = useState('days'); // 'days' | 'picker'
  const [pickerDate, setPickerDate] = useState(null);

  // ---- 解析密钥 ----
  const [parseInput, setParseInput] = useState('');
  const [parseResult, setParseResult] = useState(null);

  // ---- WebSocket ----
  const wsRef = useRef(null);
  const [wsConnected, setWsConnected] = useState(false);

  useEffect(() => {
    try {
      const ws = new WebSocket('ws://localhost:19999');
      ws.onopen = () => setWsConnected(true);
      ws.onclose = () => setWsConnected(false);
      ws.onerror = () => setWsConnected(false);
      wsRef.current = ws;
    } catch (e) {
      console.warn('WebSocket connect failed', e);
    }
    return () => { if (wsRef.current) wsRef.current.close(); };
  }, []);

  // 全选切换
  const handleToggleAll = useCallback((checked) => {
    setIsAll(checked);
    if (checked) setSelectedTypes([]);
  }, []);

  // 按组全选
  const handleGroupCheckAll = useCallback((groupItems, checked) => {
    const vals = groupItems.map((i) => i.value);
    setSelectedTypes((prev) =>
      checked ? [...new Set([...prev, ...vals])] : prev.filter((v) => !vals.includes(v))
    );
    if (checked) setIsAll(false);
  }, []);

  // 单个选择
  const handleTypeChange = useCallback((value, checked) => {
    setSelectedTypes((prev) => checked ? [...prev, value] : prev.filter((v) => v !== value));
    setIsAll(false);
  }, []);

  // 计算到期时间戳
  const computeExpireTimestamp = useCallback(() => {
    if (timeMode === 'picker' && pickerDate) return pickerDate.valueOf();
    return Date.now() + (days || 0) * 86400000;
  }, [timeMode, pickerDate, days]);

  // 是否过期预览
  const isExpiredPreview = useMemo(() => {
    if (timeMode === 'picker' && pickerDate) return pickerDate.valueOf() < Date.now();
    return false;
  }, [timeMode, pickerDate]);

  // 到期时间预览
  const expireDatePreview = useMemo(() => {
    if (timeMode === 'picker' && pickerDate) return pickerDate.format('YYYY-MM-DD HH:mm:ss');
    return new Date(Date.now() + (days || 0) * 86400000).toLocaleDateString();
  }, [timeMode, pickerDate, days]);

  // 生成密钥
  const handleGenerate = useCallback(() => {
    if (!isAll && selectedTypes.length === 0) {
      message.warning('请至少选择一个传感器类型，或勾选"全部授权"');
      return;
    }
    if (timeMode === 'days' && (!days || days <= 0)) {
      message.warning('请设置有效天数');
      return;
    }
    if (timeMode === 'picker' && !pickerDate) {
      message.warning('请选择到期时间');
      return;
    }

    const date = computeExpireTimestamp();
    let file;
    if (isAll) {
      file = 'all';
    } else if (selectedTypes.length === 1) {
      file = selectedTypes[0];
    } else {
      file = selectedTypes;
    }

    const obj = { date, file };
    const key = encStr(JSON.stringify(obj));
    setGeneratedKey(key);
    message[isExpiredPreview ? 'warning' : 'success'](
      isExpiredPreview ? '已生成过期密钥（用于测试）' : '密钥生成成功'
    );
  }, [isAll, selectedTypes, days, timeMode, pickerDate, computeExpireTimestamp, isExpiredPreview]);

  // 复制密钥
  const handleCopy = useCallback(() => {
    if (!generatedKey) return;
    navigator.clipboard.writeText(generatedKey).then(
      () => message.success('已复制到剪贴板'),
      () => message.error('复制失败')
    );
  }, [generatedKey]);

  // 发送到应用
  const handleSendToApp = useCallback(() => {
    if (!generatedKey) { message.warning('请先生成密钥'); return; }
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      message.error('WebSocket 未连接，请确保应用正在运行');
      return;
    }
    wsRef.current.send(JSON.stringify({ date: { date: generatedKey } }));
    message.success('密钥已发送到应用，将立即生效');
  }, [generatedKey]);

  // 解析密钥
  const handleParse = useCallback(() => {
    if (!parseInput.trim()) { message.warning('请输入密钥'); return; }
    try {
      const decrypted = decryptStr(parseInput.trim());
      const obj = JSON.parse(decrypted);
      const expireDate = new Date(obj.date);
      const now = new Date();
      const remainDays = Math.ceil((expireDate - now) / 86400000);

      let fileDisplay;
      if (obj.file === 'all') {
        fileDisplay = { type: 'all', label: '全部传感器', list: [] };
      } else if (Array.isArray(obj.file)) {
        fileDisplay = { type: 'multi', label: `${obj.file.length} 个传感器`, list: obj.file };
      } else {
        fileDisplay = { type: 'single', label: obj.file, list: [obj.file] };
      }

      setParseResult({ raw: obj, expireDate: expireDate.toLocaleString(), remainDays, expired: remainDays < 0, fileDisplay });
    } catch (e) {
      message.error('密钥解析失败，请检查密钥是否正确');
      setParseResult(null);
    }
  }, [parseInput]);

  const selectedCount = isAll ? ALL_SENSORS.length : selectedTypes.length;

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

      <Tabs
        defaultActiveKey="generate"
        className="license-tabs"
        items={[
          {
            key: 'generate',
            label: <span><KeyOutlined /> 生成密钥</span>,
            children: (
              <div className="license-content">
                <Row gutter={[24, 24]}>
                  {/* 左侧：传感器选择 */}
                  <Col xs={24} lg={16}>
                    <Card
                      title={
                        <Space>
                          <AppstoreOutlined />
                          <span>选择授权传感器类型</span>
                          <Tag color="blue">{selectedCount} / {ALL_SENSORS.length}</Tag>
                        </Space>
                      }
                      extra={
                        <Space>
                          <Switch checkedChildren="全部授权" unCheckedChildren="自定义" checked={isAll} onChange={handleToggleAll} />
                          <Button size="small" icon={<ReloadOutlined />} onClick={() => { setSelectedTypes([]); setIsAll(false); }}>清空</Button>
                        </Space>
                      }
                      className="sensor-card"
                    >
                      <div className="preset-bar">
                        <Text type="secondary" style={{ marginRight: 8 }}>快捷预设：</Text>
                        {SENSOR_PRESETS.map((p) => (
                          <Tag key={p.label} className="preset-tag" onClick={() => { setSelectedTypes(p.types); setIsAll(false); }}>
                            {p.label}
                          </Tag>
                        ))}
                      </div>
                      <Divider style={{ margin: '12px 0' }} />
                      {SENSOR_GROUPS.map((group) => {
                        const groupValues = group.items.map((i) => i.value);
                        const checkedCount = isAll ? group.items.length : groupValues.filter((v) => selectedTypes.includes(v)).length;
                        const allChecked = checkedCount === group.items.length;
                        const indeterminate = checkedCount > 0 && !allChecked;
                        return (
                          <div key={group.group} className="sensor-group">
                            <div className="sensor-group-header">
                              <Checkbox
                                indeterminate={!isAll && indeterminate}
                                checked={isAll || allChecked}
                                disabled={isAll}
                                onChange={(e) => handleGroupCheckAll(group.items, e.target.checked)}
                              >
                                <span className="group-icon">{group.icon}</span>
                                <span className="group-name">{group.group}</span>
                                <Tag size="small" color={allChecked || isAll ? 'green' : 'default'}>
                                  {checkedCount}/{group.items.length}
                                </Tag>
                              </Checkbox>
                            </div>
                            <div className="sensor-group-items">
                              {group.items.map((item) => (
                                <Checkbox
                                  key={item.value}
                                  checked={isAll || selectedTypes.includes(item.value)}
                                  disabled={isAll}
                                  onChange={(e) => handleTypeChange(item.value, e.target.checked)}
                                  className="sensor-checkbox"
                                >
                                  <Tooltip title={item.value}>{item.label}</Tooltip>
                                </Checkbox>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </Card>
                  </Col>

                  {/* 右侧：时间设置 + 生成 */}
                  <Col xs={24} lg={8}>
                    <Card title={<Space><ClockCircleOutlined /> 授权有效期</Space>} className="time-card">
                      {/* 时间模式切换 */}
                      <Radio.Group
                        value={timeMode}
                        onChange={(e) => setTimeMode(e.target.value)}
                        buttonStyle="solid"
                        size="middle"
                        style={{ width: '100%', display: 'flex' }}
                      >
                        <Radio.Button value="days" style={{ flex: 1, textAlign: 'center' }}>
                          <ClockCircleOutlined /> 按天数
                        </Radio.Button>
                        <Radio.Button value="picker" style={{ flex: 1, textAlign: 'center' }}>
                          <ExperimentOutlined /> 指定时间
                        </Radio.Button>
                      </Radio.Group>

                      <div style={{ marginTop: 16 }} />

                      {timeMode === 'days' ? (
                        <div className="time-section">
                          <Text>有效天数</Text>
                          <InputNumber min={1} max={36500} value={days} onChange={setDays} style={{ width: '100%' }} addonAfter="天" size="large" />
                          <div className="time-presets">
                            {DAY_PRESETS.map((d) => (
                              <Tag key={d} className={`time-preset-tag ${days === d ? 'active' : ''}`} onClick={() => setDays(d)}>
                                {d >= 365 ? `${d / 365}年` : `${d}天`}
                              </Tag>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="time-section">
                          <Text>选择到期时间</Text>
                          <DatePicker
                            showTime
                            format="YYYY-MM-DD HH:mm:ss"
                            value={pickerDate}
                            onChange={(val) => setPickerDate(val)}
                            style={{ width: '100%' }}
                            size="large"
                            placeholder="选择到期日期和时间"
                          />
                          <div className="time-presets">
                            <Text type="secondary" style={{ width: '100%', marginBottom: 4, fontSize: 12 }}>
                              过期测试快捷设置：
                            </Text>
                            {EXPIRED_PRESETS.map((p) => {
                              const isExpired = p.offset != null && p.offset < 0;
                              return (
                                <Tag
                                  key={p.label}
                                  className={`time-preset-tag ${isExpired ? 'expired-preset' : ''}`}
                                  onClick={() => {
                                    const ts = p.offsetMs != null
                                      ? Date.now() + p.offsetMs
                                      : Date.now() + p.offset * 86400000;
                                    setPickerDate(dayjs(ts));
                                  }}
                                >
                                  {isExpired ? '⚠ ' : ''}{p.label}
                                </Tag>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* 到期时间预览 */}
                      <div className={`expire-preview ${isExpiredPreview ? 'expire-preview-danger' : ''}`}>
                        <Text type="secondary">到期时间：</Text>
                        <Text strong type={isExpiredPreview ? 'danger' : undefined}>
                          {expireDatePreview}
                        </Text>
                      </div>

                      {isExpiredPreview && (
                        <Alert
                          message="测试模式：生成的密钥已过期"
                          description="写入应用后将触发过期弹窗"
                          type="warning"
                          showIcon
                          icon={<ExperimentOutlined />}
                          style={{ marginTop: 12 }}
                          className="expired-alert"
                        />
                      )}

                      <Divider />

                      {/* 授权摘要 */}
                      <div className="summary-section">
                        <Title level={5}>授权摘要</Title>
                        <div className="summary-item">
                          <Text type="secondary">授权模式：</Text>
                          <Text strong>
                            {isAll ? '全部授权' : selectedTypes.length === 1 ? '单类型' : `多类型 (${selectedTypes.length})`}
                          </Text>
                        </div>
                        {!isAll && selectedTypes.length > 0 && (
                          <div className="summary-types">
                            {selectedTypes.map((t) => {
                              const sensor = ALL_SENSORS.find((s) => s.value === t);
                              return (
                                <Tag key={t} closable onClose={() => handleTypeChange(t, false)} color="blue">
                                  {sensor ? sensor.label : t}
                                </Tag>
                              );
                            })}
                          </div>
                        )}
                        <div className="summary-item">
                          <Text type="secondary">{timeMode === 'days' ? '有效天数：' : '到期时间：'}</Text>
                          <Text strong type={isExpiredPreview ? 'danger' : undefined}>
                            {timeMode === 'days'
                              ? `${days} 天`
                              : pickerDate ? pickerDate.format('YYYY-MM-DD HH:mm:ss') : '未选择'}
                          </Text>
                        </div>
                      </div>

                      <Divider />

                      <Button
                        type="primary"
                        size="large"
                        block
                        icon={isExpiredPreview ? <ExperimentOutlined /> : <KeyOutlined />}
                        onClick={handleGenerate}
                        className={`generate-btn ${isExpiredPreview ? 'generate-btn-expired' : ''}`}
                      >
                        {isExpiredPreview ? '生成过期密钥（测试）' : '生成密钥'}
                      </Button>

                      {generatedKey && (
                        <div className="key-output">
                          <Text type="secondary" style={{ fontSize: 12 }}>生成的密钥：</Text>
                          <TextArea value={generatedKey} readOnly autoSize={{ minRows: 3, maxRows: 6 }} className="key-textarea" />
                          <Space style={{ marginTop: 8, width: '100%', justifyContent: 'space-between' }}>
                            <Button icon={<CopyOutlined />} onClick={handleCopy}>复制</Button>
                            <Tooltip title={wsConnected ? '发送密钥到正在运行的应用' : '应用未连接'}>
                              <Button type="primary" icon={<SendOutlined />} onClick={handleSendToApp} disabled={!wsConnected}>
                                写入应用
                              </Button>
                            </Tooltip>
                          </Space>
                        </div>
                      )}
                    </Card>
                  </Col>
                </Row>
              </div>
            ),
          },
          {
            key: 'parse',
            label: <span><UnlockOutlined /> 解析密钥</span>,
            children: (
              <div className="license-content">
                <Row gutter={[24, 24]}>
                  <Col xs={24} lg={12}>
                    <Card title={<Space><UnlockOutlined /> 输入密钥</Space>}>
                      <TextArea
                        placeholder="请粘贴密钥字符串..."
                        value={parseInput}
                        onChange={(e) => setParseInput(e.target.value)}
                        autoSize={{ minRows: 4, maxRows: 8 }}
                        style={{ marginBottom: 16 }}
                      />
                      <Button type="primary" block icon={<UnlockOutlined />} onClick={handleParse}>
                        解析密钥
                      </Button>
                    </Card>
                  </Col>
                  <Col xs={24} lg={12}>
                    <Card title={<Space><CheckCircleOutlined /> 解析结果</Space>}>
                      {parseResult ? (
                        <div className="parse-result">
                          <div className="parse-item">
                            <Text type="secondary">授权状态：</Text>
                            <Tag color={parseResult.expired ? 'red' : 'green'}>
                              {parseResult.expired ? '已过期' : '有效'}
                            </Tag>
                          </div>
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
                                : parseResult.fileDisplay.type === 'multi'
                                  ? `多类型 (${parseResult.fileDisplay.list.length})`
                                  : '单类型'}
                            </Text>
                          </div>
                          {parseResult.fileDisplay.type !== 'all' && (
                            <div className="parse-types">
                              {parseResult.fileDisplay.list.map((t) => {
                                const sensor = ALL_SENSORS.find((s) => s.value === t);
                                return <Tag key={t} color="blue">{sensor ? sensor.label : t}</Tag>;
                              })}
                            </div>
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
    </div>
  );
};

export default License;
