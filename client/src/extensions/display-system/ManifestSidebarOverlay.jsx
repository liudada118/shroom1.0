import React, { useId, useState } from 'react';
import useWorkspaceTop from './useWorkspaceTop.js';
import './ManifestSidebarOverlay.css';

/** 在铺满模式下提供可收起的宿主图表浮层，收起不卸载图表或清空数据。 */
export default function ManifestSidebarOverlay({ enabled = false, children }) {
  const [collapsed, setCollapsed] = useState(false);
  const panelId = useId();
  const workspaceTop = useWorkspaceTop();
  return (
    <div style={enabled ? { top: workspaceTop } : undefined} className={`manifest-sidebar-overlay${enabled ? ' is-enabled' : ''}${collapsed ? ' is-collapsed' : ''}`}>
      {enabled ? (
        <button
          type="button"
          className="manifest-sidebar-toggle"
          aria-expanded={!collapsed}
          aria-controls={panelId}
          onClick={() => setCollapsed((current) => !current)}
        >
          {collapsed ? '展开图表' : '收起图表'}
        </button>
      ) : null}
      <div id={panelId} className="manifest-sidebar-content" hidden={enabled && collapsed}>
        {children}
      </div>
    </div>
  );
}
