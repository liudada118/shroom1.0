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
 */
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  Card, Checkbox, Button, InputNumber, DatePicker, Input, message,
  Tag, Divider, Row, Col, Typography, Space, Tooltip, Badge, Tabs, Switch
} from 'antd';
import {
  KeyOutlined, CopyOutlined, SendOutlined, UnlockOutlined,
  CheckCircleOutlined, ClockCircleOutlined, AppstoreOutlined,
  SafetyCertificateOutlined, ReloadOutlined
} from '@ant-design/icons';
import { encStr, decryptStr } from './aesUtil';
import './License.css';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

/**
 * 传感器类型分组定义
 * 每组包含组名和该组下的传感器列表
 */
const SENSOR_GROUPS = [
  {
    group: '触觉手套',
    icon: '🧤',
    items: [
      { label: '触觉手套', value: 'hand0205' },
      { label: '手套模型', value: 'hand0507' },
      { label: '手套96', value: 'gloves' },
      { label: '左手手套', value: 'gloves1' },
      { label: '右手手套', value: 'gloves2' },
      { label: '手套触觉', value: 'hand0205Point' },
      { label: '手套触觉147', value: 'hand0205Point147' },
      { label: '手部检测', value: 'newHand' },
    ],
  },
  {
    group: '机器人触觉',
    icon: '🤖',
    items: [
      { label: '宇树G1触觉上衣', value: 'robot1' },
      { label: '松延N2触觉上衣', value: 'robotSY' },
      { label: '零次方H1触觉上衣', value: 'robotLCF' },
      { label: '机器人', value: 'robot0428' },
      { label: '机器人出手', value: 'robot' },
    ],
  },
  {
    group: '足底检测',
    icon: '🦶',
    items: [
      { label: '触觉足底', value: 'footVideo' },
      { label: '脚型检测', value: 'foot' },
      { label: '256鞋垫', value: 'footVideo256' },
    ],
  },
  {
    group: '高速矩阵',
    icon: '⚡',
    items: [
      { label: '16×16高速', value: 'fast256' },
      { label: '32×32高速', value: 'fast1024' },
      { label: '1024高速座椅', value: 'fast1024sit' },
      { label: '14×20高速', value: 'daliegu' },
    ],
  },
  {
    group: '汽车座椅',
    icon: '🚗',
    items: [
      { label: '汽车座椅', value: 'car' },
      { label: '汽车靠背(量产)', value: 'car10' },
      { label: '沃尔沃', value: 'volvo' },
      { label: '清闲椅子', value: 'carQX' },
      { label: '轮椅', value: 'yanfeng10' },
      { label: '沙发', value: 'sofa' },
      { label: 'car100', value: 'car100' },
      { label: '车载传感器', value: 'carCol' },
      { label: '汽车座椅Y', value: 'carY' },
    ],
  },
  {
    group: '床垫监测',
    icon: '🛏️',
    items: [
      { label: '床垫监测', value: 'bigBed' },
      { label: '小床监测', value: 'jqbed' },
      { label: '席悦1.0', value: 'smallBed' },
      { label: '席悦2.0', value: 'xiyueReal1' },
      { label: '小床128', value: 'smallBed1' },
      { label: '4096', value: 'bed4096' },
      { label: '4096数字', value: 'bed4096num' },
      { label: '256', value: 'bed1616' },
    ],
  },
  {
    group: '其他',
    icon: '📦',
    items: [
      { label: '眼罩', value: 'eye' },
      { label: '席悦座椅', value: 'sit10' },
      { label: '小矩阵1', value: 'smallM' },
      { label: '矩阵2', value: 'rect' },
      { label: 'T-short', value: 'short' },
      { label: '唐群座椅', value: 'CarTq' },
      { label: '正常测试', value: 'normal' },
      { label: '清闲', value: 'ware' },
      { label: '清闲', value: 'chairQX' },
      { label: '3D数字', value: 'Num3D' },
      { label: '本地自适应', value: 'localCar' },
      { label: '手部视频', value: 'handVideo' },
      { label: '手部视频1', value: 'handVideo1' },
      { label: '手部检测(蓝)', value: 'handBlue' },
      { label: '座椅采集', value: 'sitCol' },
      { label: '小床褥采集', value: 'matCol' },
      { label: '小床睡姿采集', value: 'matColPos' },
    ],
  },
];

// 所有传感器的平铺列表
const ALL_SENSORS = SENSOR_GROUPS.flatMap((g) => g.items);

const License = () => {
  // ---- 生成密钥 ----
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [isAll, setIsAll] = useState(false);
  const [days, setDays] = useState(365);
  const [generatedKey, setGeneratedKey] = useState('');

  // ---- 解析密钥 ----
  const [parseInput, setParseInput] = useState('');
  const [parseResult, setParseResult] = useState(null);

  // ---- WebSocket ----
  const wsRef = useRef(null);
  const [wsConnected, setWsConnected] = useState(false);

  // 连接 WebSocket
  useEffect(() => {
    try {
      const ws = new WebSocket('ws://localhost:19999');
      ws.onopen = () => setWsConnected(true);
      ws.onclose = () => setWsConnected(false);
      ws.onerror = () => setWsConnected(false);
      wsRef.current = ws;
    } catch (e) {
      console.warn('WebSocket 连接失败', e);
    }
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  // 全选/取消全选
  const handleToggleAll = useCallback((checked) => {
    setIsAll(checked);
    if (checked) {
      setSelectedTypes([]);
    }
  }, []);

  // 按组全选
  const handleGroupCheckAll = useCallback((groupItems, checked) => {
    const groupValues = groupItems.map((i) => i.value);
    setSelectedTypes((prev) => {
      if (checked) {
        return [...new Set([...prev, ...groupValues])];
      } else {
        return prev.filter((v) => !groupValues.includes(v));
      }
    });
    if (checked) setIsAll(false);
  }, []);

  // 单个选择
  const handleTypeChange = useCallback((value, checked) => {
    setSelectedTypes((prev) => {
      if (checked) {
        return [...prev, value];
      } else {
        return prev.filter((v) => v !== value);
      }
    });
    setIsAll(false);
  }, []);

  // 生成密钥
  const handleGenerate = useCallback(() => {
    if (!isAll && selectedTypes.length === 0) {
      message.warning('请至少选择一个传感器类型，或勾选"全部授权"');
      return;
    }
    if (!days || days <= 0) {
      message.warning('请设置有效天数');
      return;
    }

    const date = new Date().getTime() + days * 24 * 60 * 60 * 1000;
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
    message.success('密钥生成成功');
  }, [isAll, selectedTypes, days]);

  // 复制密钥
  const handleCopy = useCallback(() => {
    if (!generatedKey) return;
    navigator.clipboard.writeText(generatedKey).then(() => {
      message.success('已复制到剪贴板');
    }).catch(() => {
      // fallback
      const textarea = document.createElement('textarea');
      textarea.value = generatedKey;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      message.success('已复制到剪贴板');
    });
  }, [generatedKey]);

  // 发送到应用
  const handleSendToApp = useCallback(() => {
    if (!generatedKey) {
      message.warning('请先生成密钥');
      return;
    }
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      message.error('WebSocket 未连接，请确保应用正在运行');
      return;
    }
    wsRef.current.send(JSON.stringify({ date: { date: generatedKey } }));
    message.success('密钥已发送到应用，将立即生效');
  }, [generatedKey]);

  // 解析密钥
  const handleParse = useCallback(() => {
    if (!parseInput.trim()) {
      message.warning('请输入密钥');
      return;
    }
    try {
      const decrypted = decryptStr(parseInput.trim());
      const obj = JSON.parse(decrypted);
      const expireDate = new Date(obj.date);
      const now = new Date();
      const remainDays = Math.ceil((expireDate - now) / (1000 * 60 * 60 * 24));

      let fileDisplay;
      if (obj.file === 'all') {
        fileDisplay = { type: 'all', label: '全部传感器', list: [] };
      } else if (Array.isArray(obj.file)) {
        fileDisplay = {
          type: 'multi',
          label: `${obj.file.length} 个传感器`,
          list: obj.file,
        };
      } else {
        fileDisplay = { type: 'single', label: obj.file, list: [obj.file] };
      }

      setParseResult({
        raw: obj,
        expireDate: expireDate.toLocaleString(),
        remainDays,
        expired: remainDays < 0,
        fileDisplay,
      });
    } catch (e) {
      message.error('密钥解析失败，请检查密钥是否正确');
      setParseResult(null);
    }
  }, [parseInput]);

  // 选中数量统计
  const selectedCount = isAll ? ALL_SENSORS.length : selectedTypes.length;

  // 快捷预设
  const presets = [
    { label: '触觉全套', types: ['hand0205', 'robot1', 'robotSY', 'robotLCF', 'footVideo'] },
    { label: '汽车全套', types: ['car', 'car10', 'volvo', 'carQX', 'yanfeng10', 'sofa', 'carY'] },
    { label: '高速矩阵', types: ['fast256', 'fast1024', 'fast1024sit', 'daliegu'] },
    { label: '床垫全套', types: ['bigBed', 'jqbed', 'smallBed', 'xiyueReal1'] },
  ];

  return (
    <div className="license-page">
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
            label: (
              <span><KeyOutlined /> 生成密钥</span>
            ),
            children: (
              <div className="license-content">
                <Row gutter={[24, 24]}>
                  {/* 左侧：传感器类型选择 */}
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
                          <Switch
                            checkedChildren="全部授权"
                            unCheckedChildren="自定义"
                            checked={isAll}
                            onChange={handleToggleAll}
                          />
                          <Button
                            size="small"
                            icon={<ReloadOutlined />}
                            onClick={() => { setSelectedTypes([]); setIsAll(false); }}
                          >
                            清空
                          </Button>
                        </Space>
                      }
                      className="sensor-card"
                    >
                      {/* 快捷预设 */}
                      <div className="preset-bar">
                        <Text type="secondary" style={{ marginRight: 8 }}>快捷预设：</Text>
                        {presets.map((p) => (
                          <Tag
                            key={p.label}
                            className="preset-tag"
                            onClick={() => {
                              setSelectedTypes(p.types);
                              setIsAll(false);
                            }}
                          >
                            {p.label}
                          </Tag>
                        ))}
                      </div>

                      <Divider style={{ margin: '12px 0' }} />

                      {/* 分组展示 */}
                      {SENSOR_GROUPS.map((group) => {
                        const groupValues = group.items.map((i) => i.value);
                        const checkedCount = isAll
                          ? group.items.length
                          : groupValues.filter((v) => selectedTypes.includes(v)).length;
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
                                  <Tooltip title={item.value}>
                                    {item.label}
                                  </Tooltip>
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
                    <Card
                      title={<Space><ClockCircleOutlined /> 授权有效期</Space>}
                      className="time-card"
                    >
                      <div className="time-section">
                        <Text>有效天数</Text>
                        <InputNumber
                          min={1}
                          max={36500}
                          value={days}
                          onChange={setDays}
                          style={{ width: '100%' }}
                          addonAfter="天"
                          size="large"
                        />
                        <div className="time-presets">
                          {[30, 90, 180, 365, 730, 1095].map((d) => (
                            <Tag
                              key={d}
                              className={`time-preset-tag ${days === d ? 'active' : ''}`}
                              onClick={() => setDays(d)}
                            >
                              {d >= 365 ? `${d / 365}年` : `${d}天`}
                            </Tag>
                          ))}
                        </div>
                        <div className="expire-preview">
                          <Text type="secondary">到期时间：</Text>
                          <Text strong>
                            {new Date(Date.now() + (days || 0) * 86400000).toLocaleDateString()}
                          </Text>
                        </div>
                      </div>

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
                          <Text type="secondary">有效天数：</Text>
                          <Text strong>{days} 天</Text>
                        </div>
                      </div>

                      <Divider />

                      <Button
                        type="primary"
                        size="large"
                        block
                        icon={<KeyOutlined />}
                        onClick={handleGenerate}
                        className="generate-btn"
                      >
                        生成密钥
                      </Button>

                      {generatedKey && (
                        <div className="key-output">
                          <Text type="secondary" style={{ fontSize: 12 }}>生成的密钥：</Text>
                          <TextArea
                            value={generatedKey}
                            readOnly
                            autoSize={{ minRows: 3, maxRows: 6 }}
                            className="key-textarea"
                          />
                          <Space style={{ marginTop: 8, width: '100%', justifyContent: 'space-between' }}>
                            <Button icon={<CopyOutlined />} onClick={handleCopy}>
                              复制
                            </Button>
                            <Tooltip title={wsConnected ? '发送密钥到正在运行的应用' : '应用未连接'}>
                              <Button
                                type="primary"
                                icon={<SendOutlined />}
                                onClick={handleSendToApp}
                                disabled={!wsConnected}
                              >
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
            label: (
              <span><UnlockOutlined /> 解析密钥</span>
            ),
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
                      <Button
                        type="primary"
                        block
                        icon={<UnlockOutlined />}
                        onClick={handleParse}
                      >
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
                                return (
                                  <Tag key={t} color="blue">
                                    {sensor ? sensor.label : t}
                                  </Tag>
                                );
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
