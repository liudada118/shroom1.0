import React from "react";
import { useTranslation } from "react-i18next";
import "../aside/aside.scss";

const splitSensorValues = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (value == null) {
    return [];
  }
  return String(value)
    .split(/[\t,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
};

const getSensorValue = (sensorInfo, ...keys) => {
  for (const key of keys) {
    const value = sensorInfo[key];
    if (value !== undefined && value !== null && value !== "") {
      return Array.isArray(value) ? value.join(",") : String(value);
    }
  }
  return "";
};

const formatSensorValues = (values, expectedCount) => {
  const nextValues = values.filter((value) => value !== undefined && value !== null && value !== "");
  if (!nextValues.length) {
    return "";
  }
  if (expectedCount) {
    while (nextValues.length < expectedCount) {
      nextValues.push("--");
    }
  }
  return nextValues.join(",");
};

const MinzhenSensorPanel = ({ sensorInfo = {} }) => {
  const { i18n } = useTranslation();
  const isEnglish = String(i18n.language || "").startsWith("en");
  const gyroscopeValues = splitSensorValues(sensorInfo.gyroscope);
  const thermistorValues = splitSensorValues(sensorInfo.thermistor);

  const sensorPanelItems = [
    { zh: "加速度计", en: "Acceleration", value: formatSensorValues(gyroscopeValues.slice(0, 3), 3) },
    { zh: "陀螺仪", en: "Gyroscope", value: formatSensorValues(gyroscopeValues.slice(3, 6), 3) },
    { zh: "温度0", en: "Temperature 0", value: getSensorValue(sensorInfo, "thermistor0", "temperature0", "temp0") || (thermistorValues[0] || "") },
    { zh: "温度1", en: "Temperature 1", value: getSensorValue(sensorInfo, "thermistor1", "temperature1", "temp1") || (thermistorValues[1] || "") },
    { zh: "温度2", en: "Temperature 2", value: getSensorValue(sensorInfo, "thermistor2", "temperature2", "temp2") || (thermistorValues[2] || "") },
    { zh: "湿度", en: "Humidity", value: getSensorValue(sensorInfo, "humidity") },
    { zh: "脊柱前后角度", en: "Front/Back Angle", value: getSensorValue(sensorInfo, "angle_fb") },
    { zh: "脊柱左右角度", en: "Left/Right Angle", value: getSensorValue(sensorInfo, "angle_lr") },
  ];

  const renderSensorItem = ({ zh, en, value, unit }) => {
    const label = isEnglish ? en : zh;
    return (
      <div className="dataItem" key={en} style={{ alignItems: "center", gap: 8 }}>
        <div style={{ flex: "0 0 48%", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {label}
        </div>
        <div className="dataIteminfo" style={{ flex: "1 1 52%", justifyContent: "flex-end", minWidth: 0 }}>
          <div style={{ minWidth: 0, maxWidth: "100%", textAlign: "right" }}>
            <div style={{ overflowWrap: "anywhere" }}>{value} {unit ? <span style={{ color: "#999" }}>{unit}</span> : null}</div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        position: "fixed",
        width: "15%",
        top: "8%",
        right: "3%",
        color: "#fff",
        zIndex: 10,
        pointerEvents: "none",
      }}
    >
      <div className="asideContent firstAside">
        <h2 className="asideTitle">{isEnglish ? "Other Data" : "其他数据"}</h2>
        {sensorPanelItems.map((item) => renderSensorItem(item))}
      </div>
    </div>
  );
};

export default MinzhenSensorPanel;
