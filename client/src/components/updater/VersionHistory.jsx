/**
 * VersionHistory.jsx - 版本历史组件
 *
 * 功能:
 * 1. 在更新 icon 旁边显示一个版本历史 icon
 * 2. 点击后弹出 Modal 展示所有历史版本和更新信息
 * 3. 顶部显示当前版本号
 *
 * 使用方式:
 *   在 UpdateNotifier.jsx 中引入并放在更新按钮旁边
 */

import React, { useEffect, useState } from "react";
import { Modal, Button, Timeline, Tag } from "antd";
import {
  HistoryOutlined,
  RocketOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";

// 版本历史数据（从 release-notes 中提取，按版本倒序排列）
const VERSION_HISTORY = [
  {
    version: "1.1.6",
    date: "2026-03-23",
    changes: ["图表渲染改为使用原始数据"],
  },
  {
    version: "1.1.5",
    date: "2026-03-23",
    changes: ["图表渲染使用原始数据"],
  },
  {
    version: "1.1.3",
    date: "2026-03-22",
    changes: ["稳定版"],
  },
  {
    version: "1.1.2",
    date: "2026-03-22",
    changes: ["修改 title 类型"],
  },
  {
    version: "1.1.1",
    date: "2026-03-18",
    changes: [
      "Windows 安装包现在内置 Python runtime，目标机器不再要求预装 Python",
      "应用内更新弹窗会显示本版本更新说明，用户能直接看到更新内容",
      "修复 Windows 打包链路里的资源同步问题，降低因环境差异导致的更新失败风险",
    ],
  },
];

export default function VersionHistory() {
  const [showModal, setShowModal] = useState(false);
  const [currentVersion, setCurrentVersion] = useState("");

  const isElectron = typeof window !== "undefined" && window.electronAPI;

  useEffect(() => {
    if (isElectron && window.electronAPI.getVersion) {
      window.electronAPI
        .getVersion()
        .then((v) => setCurrentVersion(v))
        .catch(() => setCurrentVersion(""));
    }
  }, [isElectron]);

  if (!isElectron) return null;

  return (
    <>
      <Button
        shape="circle"
        size="small"
        icon={<HistoryOutlined />}
        onClick={() => setShowModal(true)}
        title="版本历史"
        style={{
          backgroundColor: "#722ed1",
          borderColor: "transparent",
          color: "#fff",
        }}
      />

      <Modal
        title={
          <span>
            <HistoryOutlined style={{ marginRight: 8 }} />
            版本历史
          </span>
        }
        open={showModal}
        onCancel={() => setShowModal(false)}
        footer={
          <Button onClick={() => setShowModal(false)}>关闭</Button>
        }
        width={520}
      >
        <div style={{ padding: "16px 0" }}>
          {/* 当前版本 */}
          {currentVersion && (
            <div
              style={{
                marginBottom: 20,
                padding: "12px 16px",
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                borderRadius: 8,
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div style={{ fontSize: 14, opacity: 0.85 }}>当前版本</div>
                <div style={{ fontSize: 22, fontWeight: "bold" }}>
                  v{currentVersion}
                </div>
              </div>
              <CheckCircleOutlined style={{ fontSize: 32, opacity: 0.6 }} />
            </div>
          )}

          {/* 版本时间线 */}
          <div style={{ maxHeight: 400, overflow: "auto", paddingRight: 8 }}>
            <Timeline
              items={VERSION_HISTORY.map((item, index) => ({
                color: index === 0 ? "green" : "blue",
                dot:
                  index === 0 ? (
                    <RocketOutlined style={{ fontSize: 16 }} />
                  ) : undefined,
                children: (
                  <div key={item.version}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 6,
                      }}
                    >
                      <span
                        style={{ fontSize: 15, fontWeight: "bold" }}
                      >
                        v{item.version}
                      </span>
                      {currentVersion === item.version && (
                        <Tag color="green" style={{ margin: 0 }}>
                          当前
                        </Tag>
                      )}
                      <span style={{ color: "#999", fontSize: 12 }}>
                        {item.date}
                      </span>
                    </div>
                    <ul
                      style={{
                        margin: 0,
                        paddingLeft: 18,
                        color: "#555",
                        lineHeight: 1.8,
                      }}
                    >
                      {item.changes.map((change, i) => (
                        <li key={i}>{change}</li>
                      ))}
                    </ul>
                  </div>
                ),
              }))}
            />
          </div>
        </div>
      </Modal>
    </>
  );
}
