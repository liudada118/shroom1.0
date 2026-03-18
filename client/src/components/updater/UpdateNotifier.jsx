/**
 * UpdateNotifier.jsx - 应用更新通知组件
 *
 * 功能:
 * 1. 监听主进程推送的更新状态
 * 2. 在右下角显示更新通知（有新版本、下载进度、下载完成）
 * 3. 提供手动检查更新按钮
 * 4. 下载完成后提供安装按钮
 *
 * 使用方式:
 *   在 App.jsx 或 Home 页面中引入:
 *   import UpdateNotifier from '../components/updater/UpdateNotifier'
 *   <UpdateNotifier />
 */

import React, { useEffect, useState, useCallback } from "react";
import { Modal, Progress, Button, notification, Tag, Spin } from "antd";
import {
  CloudDownloadOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  ExclamationCircleOutlined,
  RocketOutlined,
} from "@ant-design/icons";

// 更新状态枚举
const UPDATE_STATE = {
  IDLE: "idle",
  CHECKING: "checking",
  AVAILABLE: "available",
  NOT_AVAILABLE: "not-available",
  DOWNLOADING: "downloading",
  DOWNLOADED: "downloaded",
  ERROR: "error",
};

function normalizeReleaseNotes(releaseNotes) {
  if (!releaseNotes) return "";

  if (typeof releaseNotes === "string") {
    return releaseNotes.trim();
  }

  if (Array.isArray(releaseNotes)) {
    return releaseNotes
      .map((item) => normalizeReleaseNotes(item))
      .filter(Boolean)
      .join("\n\n");
  }

  if (typeof releaseNotes === "object") {
    if (typeof releaseNotes.note === "string") return releaseNotes.note.trim();
    if (typeof releaseNotes.body === "string") return releaseNotes.body.trim();
    if (typeof releaseNotes.releaseNotes === "string") {
      return releaseNotes.releaseNotes.trim();
    }

    return JSON.stringify(releaseNotes, null, 2);
  }

  return String(releaseNotes).trim();
}

export default function UpdateNotifier() {
  const [updateState, setUpdateState] = useState(UPDATE_STATE.IDLE);
  const [updateInfo, setUpdateInfo] = useState({});
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadDetail, setDownloadDetail] = useState({});
  const [showModal, setShowModal] = useState(false);
  const releaseNotesText = normalizeReleaseNotes(updateInfo.releaseNotes);

  // 检查 electronAPI 是否可用
  const isElectron = typeof window !== "undefined" && window.electronAPI;

  // 监听主进程推送的更新状态
  useEffect(() => {
    if (!isElectron) return;

    const unsubscribe = window.electronAPI.on("update-status", (data) => {
      console.log("[UpdateNotifier] 收到更新状态:", data);

      switch (data.type) {
        case "checking-for-update":
          setUpdateState(UPDATE_STATE.CHECKING);
          break;

        case "update-available":
          setUpdateState(UPDATE_STATE.AVAILABLE);
          setUpdateInfo({
            version: data.version,
            releaseDate: data.releaseDate,
            releaseNotes: data.releaseNotes,
          });
          // 弹出通知
          notification.info({
            message: "发现新版本",
            description: `新版本 ${data.version} 可用，点击查看详情。`,
            icon: <RocketOutlined style={{ color: "#1890ff" }} />,
            duration: 10,
            onClick: () => setShowModal(true),
          });
          break;

        case "update-not-available":
          setUpdateState(UPDATE_STATE.NOT_AVAILABLE);
          setUpdateInfo({ version: data.version });
          notification.success({
            message: "已是最新版本",
            description: `当前版本 ${data.version} 已是最新。`,
            icon: <CheckCircleOutlined style={{ color: "#52c41a" }} />,
            duration: 5,
          });
          break;

        case "download-progress":
          setUpdateState(UPDATE_STATE.DOWNLOADING);
          setDownloadProgress(data.percent || 0);
          setDownloadDetail({
            transferred: data.transferred,
            total: data.total,
            bytesPerSecond: data.bytesPerSecond,
          });
          break;

        case "update-downloaded":
          setUpdateState(UPDATE_STATE.DOWNLOADED);
          setUpdateInfo((prev) => ({ ...prev, version: data.version }));
          setDownloadProgress(100);
          break;

        case "update-error":
          setUpdateState(UPDATE_STATE.ERROR);
          setUpdateInfo((prev) => ({ ...prev, error: data.message }));
          notification.error({
            message: "更新检查失败",
            description: data.message || "请检查网络连接后重试。",
            icon: <ExclamationCircleOutlined style={{ color: "#ff4d4f" }} />,
            duration: 8,
          });
          break;

        default:
          break;
      }
    });

    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, [isElectron]);

  // 手动检查更新
  const handleCheckUpdate = useCallback(async () => {
    if (!isElectron) return;
    setUpdateState(UPDATE_STATE.CHECKING);
    try {
      await window.electronAPI.invoke("update-command", {
        action: "checkForUpdate",
      });
    } catch (err) {
      console.error("[UpdateNotifier] 检查更新失败:", err);
      setUpdateState(UPDATE_STATE.ERROR);
    }
  }, [isElectron]);

  // 下载更新
  const handleDownload = useCallback(async () => {
    if (!isElectron) return;
    setUpdateState(UPDATE_STATE.DOWNLOADING);
    setDownloadProgress(0);
    try {
      await window.electronAPI.invoke("update-command", {
        action: "downloadUpdate",
      });
    } catch (err) {
      console.error("[UpdateNotifier] 下载更新失败:", err);
      setUpdateState(UPDATE_STATE.ERROR);
    }
  }, [isElectron]);

  // 安装更新
  const handleInstall = useCallback(async () => {
    if (!isElectron) return;
    try {
      await window.electronAPI.invoke("update-command", {
        action: "installUpdate",
      });
    } catch (err) {
      console.error("[UpdateNotifier] 安装更新失败:", err);
    }
  }, [isElectron]);

  // 格式化文件大小
  const formatSize = (bytes) => {
    if (!bytes) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    let i = 0;
    let size = bytes;
    while (size >= 1024 && i < units.length - 1) {
      size /= 1024;
      i++;
    }
    return `${size.toFixed(1)} ${units[i]}`;
  };

  // 格式化速度
  const formatSpeed = (bytesPerSecond) => {
    if (!bytesPerSecond) return "";
    return `${formatSize(bytesPerSecond)}/s`;
  };

  // 渲染状态标签
  const renderStatusTag = () => {
    switch (updateState) {
      case UPDATE_STATE.CHECKING:
        return (
          <Tag icon={<SyncOutlined spin />} color="processing">
            检查中...
          </Tag>
        );
      case UPDATE_STATE.AVAILABLE:
        return (
          <Tag icon={<RocketOutlined />} color="warning">
            有新版本 {updateInfo.version}
          </Tag>
        );
      case UPDATE_STATE.DOWNLOADING:
        return (
          <Tag icon={<CloudDownloadOutlined />} color="processing">
            下载中 {downloadProgress}%
          </Tag>
        );
      case UPDATE_STATE.DOWNLOADED:
        return (
          <Tag icon={<CheckCircleOutlined />} color="success">
            下载完成
          </Tag>
        );
      case UPDATE_STATE.NOT_AVAILABLE:
        return (
          <Tag icon={<CheckCircleOutlined />} color="success">
            已是最新
          </Tag>
        );
      case UPDATE_STATE.ERROR:
        return (
          <Tag icon={<ExclamationCircleOutlined />} color="error">
            更新失败
          </Tag>
        );
      default:
        return null;
    }
  };

  // 渲染更新详情弹窗
  const renderModal = () => (
    <Modal
      title={
        <span>
          <RocketOutlined style={{ marginRight: 8 }} />
          软件更新
        </span>
      }
      open={showModal}
      onCancel={() => setShowModal(false)}
      footer={null}
      width={480}
    >
      <div style={{ padding: "16px 0" }}>
        {/* 版本信息 */}
        {updateInfo.version && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 16, fontWeight: "bold", margin: "0 0 8px" }}>
              新版本: v{updateInfo.version}
            </p>
            {updateInfo.releaseDate && (
              <p style={{ color: "#999", margin: 0 }}>
                发布日期: {new Date(updateInfo.releaseDate).toLocaleDateString()}
              </p>
            )}
          </div>
        )}

        {/* 更新说明 */}
        {releaseNotesText && (
          <div
            style={{
              background: "#f5f5f5",
              padding: 12,
              borderRadius: 6,
              marginBottom: 16,
              maxHeight: 200,
              overflow: "auto",
            }}
          >
            <p style={{ fontWeight: "bold", margin: "0 0 8px" }}>更新说明:</p>
            <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
              {releaseNotesText}
            </div>
          </div>
        )}

        {/* 下载进度 */}
        {updateState === UPDATE_STATE.DOWNLOADING && (
          <div style={{ marginBottom: 16 }}>
            <Progress
              percent={downloadProgress}
              status="active"
              strokeColor={{
                "0%": "#108ee9",
                "100%": "#87d068",
              }}
            />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                color: "#999",
                fontSize: 12,
                marginTop: 4,
              }}
            >
              <span>
                {formatSize(downloadDetail.transferred)} /{" "}
                {formatSize(downloadDetail.total)}
              </span>
              <span>{formatSpeed(downloadDetail.bytesPerSecond)}</span>
            </div>
          </div>
        )}

        {/* 操作按钮 */}
        <div
          style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}
        >
          {updateState === UPDATE_STATE.AVAILABLE && (
            <Button
              type="primary"
              icon={<CloudDownloadOutlined />}
              onClick={handleDownload}
            >
              下载更新
            </Button>
          )}
          {updateState === UPDATE_STATE.DOWNLOADED && (
            <Button
              type="primary"
              icon={<RocketOutlined />}
              onClick={handleInstall}
              danger
            >
              立即安装并重启
            </Button>
          )}
          {(updateState === UPDATE_STATE.ERROR ||
            updateState === UPDATE_STATE.IDLE ||
            updateState === UPDATE_STATE.NOT_AVAILABLE) && (
            <Button icon={<SyncOutlined />} onClick={handleCheckUpdate}>
              检查更新
            </Button>
          )}
          <Button onClick={() => setShowModal(false)}>关闭</Button>
        </div>
      </div>
    </Modal>
  );

  // 如果不在 Electron 环境中，不渲染
  if (!isElectron) return null;

  return (
    <>
      {/* 右下角悬浮更新按钮 */}
      <div
        style={{
          position: "fixed",
          bottom: 20,
          right: 20,
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        {renderStatusTag()}
        <Button
          type="primary"
          shape="circle"
          size="small"
          icon={
            updateState === UPDATE_STATE.CHECKING ? (
              <Spin size="small" />
            ) : (
              <SyncOutlined />
            )
          }
          onClick={() => {
            if (
              updateState === UPDATE_STATE.AVAILABLE ||
              updateState === UPDATE_STATE.DOWNLOADING ||
              updateState === UPDATE_STATE.DOWNLOADED
            ) {
              setShowModal(true);
            } else {
              handleCheckUpdate();
            }
          }}
          title="检查更新"
          style={{
            backgroundColor:
              updateState === UPDATE_STATE.AVAILABLE
                ? "#faad14"
                : updateState === UPDATE_STATE.DOWNLOADED
                ? "#52c41a"
                : "#1890ff",
            borderColor: "transparent",
          }}
        />
      </div>

      {/* 更新详情弹窗 */}
      {renderModal()}
    </>
  );
}
