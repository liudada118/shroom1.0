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
import { useTranslation } from "react-i18next";
import {
  HistoryOutlined,
  RocketOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import { buildVersionHistory } from "./releaseNoteHistory";

const RELEASE_NOTE_MODULES = import.meta.glob(
  "../../../../release-notes/windows/*.md",
  {
    query: "?raw",
    import: "default",
    eager: true,
  }
);

// Vite 在构建阶段把 Markdown 原文编译进前端，无需运行时读取磁盘。
const VERSION_HISTORY = buildVersionHistory(RELEASE_NOTE_MODULES);

export default function VersionHistory() {
  const { t } = useTranslation();
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
        title={t("update.history")}
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
            {t("update.history")}
          </span>
        }
        open={showModal}
        onCancel={() => setShowModal(false)}
        footer={
          <Button onClick={() => setShowModal(false)}>{t("common.close")}</Button>
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
                <div style={{ fontSize: 14, opacity: 0.85 }}>{t("update.currentVersion")}</div>
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
                          {t("common.current")}
                        </Tag>
                      )}
                      {item.date && (
                        <span style={{ color: "#999", fontSize: 12 }}>
                          {item.date}
                        </span>
                      )}
                    </div>
                    <ul
                      style={{
                        margin: 0,
                        paddingLeft: 18,
                        color: "#555",
                        lineHeight: 1.8,
                      }}
                    >
                      {item.changes.map((change, changeIndex) => (
                        <li key={`${item.version}-${changeIndex}`}>{change}</li>
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
