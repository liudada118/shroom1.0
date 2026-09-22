import React, { useState } from 'react';
import { Alert, Button, Form, Input, Modal, Select } from 'antd';
import { requestJson } from './api';
import NativeSystemEditor from './NativeSystemEditor';

/** 从内置系统创建独立入口；保存与进入分开反馈，连接失败不会重复创建副本。 */
export default function BuiltinTemplateDialog({ templates = [], packages = [], existing, onCreated, onDeleted, onActivate, onClose }) {
  const [form] = Form.useForm();
  const [created, setCreated] = useState(existing || null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(Boolean(existing));
  /** 从原生协议、线序与展示创建独立系统，算法图表使用默认配置。 */
  async function submit() {
    setError('');
    if (busy) return;
    try {
      if (created) {
        setBusy(true);
        await onActivate(created);
        onClose();
        return;
      }
      const values = await form.validateFields();
      setBusy(true);
      const payload = await requestJson('/api/display-systems', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ builtinTemplate: values }) });
      const system = payload?.result?.displaySystem;
      if (!system?.runtimeDefinition?.builtinTemplate) throw new Error('保存结果缺少模板定义，请刷新目录确认。');
      setCreated(system);
      await onCreated(system);
    } catch (cause) { if (!cause.errorFields) setError(cause.message || '操作失败，请重试。'); }
    finally { setBusy(false); }
  }
  const source = templates.find((item) => item.id === created?.builtinTemplate?.sourceType);
  if (created && editing) return <NativeSystemEditor system={created} packages={packages} onSaved={async (system) => { setCreated(system); await onCreated(system); }} onDeleted={onDeleted} onActivate={onActivate} onClose={onClose} />;
  return <Modal className="display-builder-modal" open title={created ? created.name : '以内置系统为模板创建'} okText={created ? '进入系统' : '创建系统'}
    cancelText={created ? '关闭' : '取消'} confirmLoading={busy} onOk={submit} onCancel={() => !busy && onClose()} maskClosable={!busy}>
    <p className="display-builder-modal-intro">继承原系统的串口协议、线序、展示和设备控件。新系统使用独立的图表配置、归零数据和采集目录，仍需原系统的授权。</p>
    {created ? <Alert type="success" showIcon message={`已保存：${created.name}`}
      description={<>{`模板：${source?.name || created.builtinTemplate.sourceType} · 系统 ID：${created.id}。可继续编辑算法和图表，也可进入系统连接串口。`}<p><Button onClick={() => setEditing(true)}>编辑系统</Button></p></>} />
      : <Form name="builtin-template" form={form} layout="vertical" requiredMark={false}>
        <Form.Item name="sourceType" label="内置系统模板" rules={[{ required: true, message: '请选择内置系统' }]}>
          <Select showSearch optionFilterProp="label" placeholder="选择原系统" options={templates.map((item) => ({ value: item.id, label: `${item.name}（${item.id}）` }))} />
        </Form.Item>
        <Form.Item name="name" label="新系统名称" rules={[{ required: true, whitespace: true, message: '请输入名称' }, { max: 100 }]}><Input placeholder="例如：手部检测副本" /></Form.Item>
        <Form.Item name="id" label="新系统 ID" rules={[{ required: true, message: '请输入独立系统 ID' },
          { pattern: /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/, message: '使用字母、数字、下划线或短横线，最多 64 位' }]}><Input placeholder="例如：hand-copy" /></Form.Item>
      </Form>}
    {error && <Alert type="error" showIcon message={error} style={{ marginTop: 16 }} />}
  </Modal>;
}
