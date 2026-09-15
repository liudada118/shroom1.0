import React from 'react';
import { ConfigProvider, Modal, theme } from 'antd';
import './PortalControlDialog.css';

export const PORTAL_CONTROL_THEME = { algorithm: theme.darkAlgorithm, token: {
  colorPrimary: '#63d5ff', colorBgElevated: '#0b1b29', colorText: '#edf5ff',
  colorTextSecondary: '#adc4d9', fontSize: 14, borderRadius: 8,
} };

/** 设备、显示和专用功能共用紧凑模态外壳，不再呈现旧标题栏。 */
export default function PortalControlDialog({ open, title, description, onClose, children, id }) {
  return <ConfigProvider theme={PORTAL_CONTROL_THEME}>
    <Modal open={open} title={title} centered width={660} footer={null}
      rootClassName="portal-control-dialog" onCancel={onClose} forceRender
      closable={{ 'aria-label': `关闭${title}` }}>
      <div id={id} className="portal-control-body">
        {description && <p className="portal-control-description">{description}</p>}
        {children}
      </div>
    </Modal>
  </ConfigProvider>;
}
