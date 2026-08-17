import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { HUMAN_BODY_SENSOR_PARTS } from "./humanBody";
import { HUMAN_BODY_NUMBER_PART_LABELS } from "./humanBodyNumberLabels";
import { getHumanBodyNumberViewSlots } from "./humanBodyNumberViews";
import {
  getSourceGridPosition,
  orientPartMatrix,
  resolveSensorPartKey,
} from "./humanBodyOrientation";
import {
  buildHumanBodySensorNeighborhood,
  clampHumanBodyHoverPosition,
  findNearestHumanBodySensor,
} from "./humanBodyHoverData";
import {
  clampHumanBodyRadius,
  getHumanBodyAutoRotate,
  readHumanBodyRenderSettings,
  writeHumanBodyRenderSettings,
} from "./humanBodyRenderSettings";
import {
  getHumanBodyRenderPixelRatio,
  getHumanBodyViewOffsetX,
  getHumanBodyVisualCenter,
  shouldRenderHumanBodyFrame,
  updateHumanBodyQualityState,
} from "./humanBodyRenderPerformance";

const MODEL_URL = "./model/human3.glb";
const SENSOR_LAYOUT_URL = "./model/sensor_canvas_positions.json";
const MAX_SHADER_SENSORS = 1200;
const DEFAULT_OPTIONS = { max: 1555, size: 31, filter: 6 };
const HOVER_DELAY_MS = 150;
const HOVER_POINTER_OFFSET = 18;
const HOVER_PANEL_SIZE = { width: 168, height: 144 };

const getBrowserStorage = () => {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
};

const BG_PRESETS = ["#afacac", "#10152b", "#0f2027", "#000000"];
const MODEL_PRESETS = ["#718096", "#4a5568", "#d2d6dc", "#4fd1c5"];
const VISIBLE_RENDER_MODES = [
  ["heatmap", "热力"],
  ["crystal", "水晶"],
];

const REGION_VIEWS = {
  overview: { label: "全身", position: [0, 4, 12], target: [0, 4, 0] },
  chest: { label: "前胸", position: [0, 5.5, 6], target: [0, 5.5, 0] },
  back: { label: "后背", position: [0, 5.5, -6], target: [0, 5.5, 0] },
  leftArm: { label: "左臂", position: [5, 5.5, 4], target: [2.5, 5.5, 0] },
  rightArm: { label: "右臂", position: [-5, 5.5, 4], target: [-2.5, 5.5, 0] },
  frontLegs: { label: "前腿", position: [0, 2, 6], target: [0, 2.5, 0] },
  backLegs: { label: "后腿", position: [0, 2, -6], target: [0, 2.5, 0] },
};

const vertexShader = `
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  varying vec3 vViewDirection;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPosition.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vViewDirection = normalize(cameraPosition - worldPosition.xyz);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const fragmentShader = `
  uniform sampler2D uSensorData;
  uniform float uSensorCount;
  uniform float uRadius;
  uniform float uIntensity;
  uniform float uOpacity;
  uniform int uColorScheme;
  uniform int uCrystal;
  uniform vec3 uModelColor;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  varying vec3 vViewDirection;

  vec3 heatColor(float t) {
    t = clamp(t, 0.0, 1.0);
    if (uColorScheme == 1) {
      return mix(mix(vec3(0.02, 0.02, 0.15), vec3(0.0, 0.55, 0.9), t), vec3(0.75, 0.98, 1.0), t * t);
    }
    if (uColorScheme == 2) {
      if (t < 0.5) return mix(vec3(0.15, 0.0, 0.2), vec3(0.85, 0.18, 0.0), t * 2.0);
      return mix(vec3(0.85, 0.18, 0.0), vec3(1.0, 0.92, 0.3), (t - 0.5) * 2.0);
    }
    if (uColorScheme == 3) {
      if (t < 0.33) return mix(vec3(0.0), vec3(0.5, 0.0, 0.1), t * 3.0);
      if (t < 0.66) return mix(vec3(0.5, 0.0, 0.1), vec3(0.95, 0.42, 0.0), (t - 0.33) * 3.0);
      return mix(vec3(0.95, 0.42, 0.0), vec3(1.0, 1.0, 0.4), (t - 0.66) * 3.0);
    }
    if (t < 0.2) return mix(vec3(0.04, 0.04, 0.28), vec3(0.0, 0.28, 0.85), t / 0.2);
    if (t < 0.4) return mix(vec3(0.0, 0.28, 0.85), vec3(0.0, 0.75, 0.55), (t - 0.2) / 0.2);
    if (t < 0.6) return mix(vec3(0.0, 0.75, 0.55), vec3(0.55, 0.85, 0.0), (t - 0.4) / 0.2);
    if (t < 0.8) return mix(vec3(0.55, 0.85, 0.0), vec3(1.0, 0.62, 0.0), (t - 0.6) / 0.2);
    return mix(vec3(1.0, 0.62, 0.0), vec3(0.95, 0.04, 0.0), (t - 0.8) / 0.2);
  }

  void main() {
    float heat = 0.0;
    for (int i = 0; i < ${MAX_SHADER_SENSORS}; i++) {
      if (float(i) >= uSensorCount) break;
      float u = (float(i) + 0.5) / uSensorCount;
      vec4 sensor = texture2D(uSensorData, vec2(u, 0.5));
      float distanceToSensor = distance(vWorldPos, sensor.xyz);
      heat += exp(-(distanceToSensor * distanceToSensor) / (2.0 * uRadius * uRadius)) * sensor.w * uIntensity;
    }
    heat = clamp(heat, 0.0, 1.0);
    vec3 baseColor = uModelColor;
    vec3 color = heat > 0.005 ? heatColor(heat) : baseColor;

    if (uCrystal == 1) {
      float fresnel = pow(1.0 - max(dot(normalize(vWorldNormal), normalize(vViewDirection)), 0.0), 3.0);
      color = mix(uModelColor, color, heat * 0.9) + vec3(0.65, 0.85, 1.0) * fresnel * 0.35;
      gl_FragColor = vec4(color, clamp(uOpacity + heat * 0.75 + fresnel * 0.15, 0.05, 0.95));
      return;
    }

    gl_FragColor = vec4(color, 1.0);
  }
`;

const easeInOutCubic = (value) => (
  value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2
);

const PART_BY_KEY = new Map(HUMAN_BODY_SENSOR_PARTS.map((part) => [part.key, part]));

function buildSample(sensor, targetRows, targetCols, part) {
  const { sourceRow, sourceCol } = getSourceGridPosition(
    part.key,
    sensor.row,
    sensor.col,
    targetRows,
    targetCols,
    part.height,
    part.width,
  );
  const row0 = Math.floor(sourceRow);
  const row1 = Math.min(part.height - 1, row0 + 1);
  const col0 = Math.floor(sourceCol);
  const col1 = Math.min(part.width - 1, col0 + 1);
  const rowWeight = sourceRow - row0;
  const colWeight = sourceCol - col0;
  const weightedCells = [
    [row0, col0, (1 - rowWeight) * (1 - colWeight)],
    [row0, col1, (1 - rowWeight) * colWeight],
    [row1, col0, rowWeight * (1 - colWeight)],
    [row1, col1, rowWeight * colWeight],
  ];
  const merged = new Map();
  weightedCells.forEach(([row, col, weight]) => {
    if (weight <= 0) return;
    const rawIndex = part.positions[row * part.width + col] - 1;
    merged.set(rawIndex, (merged.get(rawIndex) || 0) + weight);
  });
  return Array.from(merged, ([index, weight]) => ({ index, weight }));
}

function buildSensorLayout(archive) {
  if (Number(archive?.version) !== 7 || !Array.isArray(archive?.flat)) {
    throw new Error("传感器点位文件格式无效，需要 v7 flat 数据");
  }
  const physicalSensors = archive.flat;
  if (physicalSensors.length !== Number(archive.totalPhysicalSensors || archive.totalSensors)) {
    throw new Error("传感器点位数量与文件声明不一致");
  }
  if (physicalSensors.length > MAX_SHADER_SENSORS) {
    throw new Error(`物理点位 ${physicalSensors.length} 超过渲染上限 ${MAX_SHADER_SENSORS}`);
  }

  const dimensions = new Map();
  physicalSensors.forEach((sensor) => {
    const groupKey = `${sensor.region}::${sensor.placementSide || "single"}`;
    const current = dimensions.get(groupKey) || { rows: 0, cols: 0 };
    current.rows = Math.max(current.rows, Number(sensor.row));
    current.cols = Math.max(current.cols, Number(sensor.col));
    dimensions.set(groupKey, current);
  });

  const seenIndices = new Set();
  const sensors = physicalSensors.map((sensor) => {
    const physicalIndex = Number(sensor.index);
    const coordinates = [sensor.x, sensor.y, sensor.z].map(Number);
    if (!Number.isInteger(physicalIndex) || seenIndices.has(physicalIndex)) {
      throw new Error(`物理点位索引重复或无效：${sensor.index}`);
    }
    if (!coordinates.every(Number.isFinite)) {
      throw new Error(`物理点位 ${physicalIndex} 缺少有效三维坐标`);
    }
    seenIndices.add(physicalIndex);
    const partKey = resolveSensorPartKey(sensor.region, sensor.placementSide);
    const part = PART_BY_KEY.get(partKey);
    if (!part) throw new Error(`未识别的身体区域：${sensor.region}`);
    const groupKey = `${sensor.region}::${sensor.placementSide || "single"}`;
    const { rows, cols } = dimensions.get(groupKey);
    return {
      index: physicalIndex,
      logicalIndex: Number(sensor.logicalIndex),
      row: Number(sensor.row) - 1,
      col: Number(sensor.col) - 1,
      part: sensor.region,
      partKey,
      placementSide: sensor.placementSide || "single",
      position: new THREE.Vector3(...coordinates),
      sample: buildSample(sensor, rows, cols, part),
    };
  }).sort((left, right) => left.index - right.index);

  return sensors;
}

const panelStyle = {
  position: "absolute",
  zIndex: 4,
  padding: "12px",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: "10px",
  background: "rgba(5, 10, 20, 0.82)",
  color: "#dce8f5",
  backdropFilter: "blur(10px)",
};

const buttonStyle = (active) => ({
  border: `1px solid ${active ? "#00ffaa" : "rgba(255,255,255,0.14)"}`,
  borderRadius: "5px",
  background: active ? "rgba(0,255,170,0.18)" : "rgba(255,255,255,0.05)",
  color: active ? "#7dffd3" : "#aebdca",
  padding: "4px 7px",
  cursor: "pointer",
  fontSize: "11px",
});

const ColorRow = ({ label, value, presets, onChange }) => (
  <div style={{ marginTop: "9px" }}>
    <div style={{ fontSize: "11px", color: "#8193a5", marginBottom: "5px" }}>{label}</div>
    <div style={{ display: "flex", gap: "5px", alignItems: "center" }}>
      {presets.map((color) => (
        <button
          aria-label={`${label} ${color}`}
          key={color}
          onClick={() => onChange(color)}
          style={{ width: "18px", height: "18px", borderRadius: "50%", border: value === color ? "2px solid white" : "1px solid #667", background: color, cursor: "pointer" }}
        />
      ))}
      <input type="color" value={value} onChange={(event) => onChange(event.target.value)} style={{ width: "24px", height: "20px", border: 0, padding: 0, background: "transparent" }} />
    </div>
  </div>
);

const NUMBER_HORIZONTAL_FLIP_PARTS = new Set([
  "back",
  "chest",
]);

function getOrientedPartValues(frame, part) {
  let rows = Array.from({ length: part.height }, (_, row) => (
    part.positions
      .slice(row * part.width, (row + 1) * part.width)
      .map((position) => Number(frame[position - 1]) || 0)
  ));
  rows = orientPartMatrix(part.key, rows);
  if (NUMBER_HORIZONTAL_FLIP_PARTS.has(part.key)) rows = rows.map((row) => [...row].reverse());
  return rows;
}

function drawNumberCell(ctx, value, x, y, size) {
  ctx.fillStyle = value > 0 ? "rgba(0, 255, 170, 0.16)" : "rgba(255,255,255,0.025)";
  ctx.fillRect(x, y, size, size);
  ctx.strokeStyle = "rgba(140, 170, 195, 0.18)";
  ctx.strokeRect(x, y, size, size);
  ctx.fillStyle = value > 0 ? "#78ffd2" : "#607181";
  ctx.font = `${size >= 16 ? 9 : 6}px Consolas, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(Math.round(value)), x + size / 2, y + size / 2);
}

const RegionNumberPanel = React.forwardRef(({ activeRegion }, ref) => {
  const canvasRef = useRef(null);
  const frameRef = useRef(new Array(1024).fill(0));

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const isOverview = activeRegion === "overview";
    const slots = getHumanBodyNumberViewSlots(activeRegion);
    const cellSize = isOverview ? 9 : 18;
    const titleHeight = 25;
    const padding = 10;
    const gap = 10;
    const layouts = [];
    let contentWidth;
    let contentHeight;

    if (isOverview) {
      contentWidth = 32 * cellSize;
      contentHeight = 32 * cellSize;
    } else {
      let offsetX = 0;
      slots.forEach(({ displayPartKey, dataPartKey }) => {
        const displayPart = PART_BY_KEY.get(displayPartKey);
        const dataPart = PART_BY_KEY.get(dataPartKey);
        if (!displayPart) return;
        const width = displayPart.width * cellSize;
        const height = displayPart.height * cellSize + titleHeight;
        layouts.push({
          displayPart,
          dataPart,
          x: offsetX,
          width,
          height,
          compatible: dataPart
            && displayPart.width === dataPart.width
            && displayPart.height === dataPart.height,
        });
        offsetX += width + gap;
      });
      contentWidth = Math.max(1, offsetX - gap);
      contentHeight = Math.max(1, ...layouts.map((layout) => layout.height));
    }

    const width = contentWidth + padding * 2;
    const height = contentHeight + padding * 2;
    canvas.width = Math.ceil(width * ratio);
    canvas.height = Math.ceil(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);

    if (isOverview) {
      for (let row = 0; row < 32; row += 1) {
        for (let col = 0; col < 32; col += 1) {
          drawNumberCell(ctx, Number(frameRef.current[row * 32 + col]) || 0, padding + col * cellSize, padding + row * cellSize, cellSize);
        }
      }
      return;
    }

    layouts.forEach(({ displayPart, dataPart, compatible, x, width: gridWidth }) => {
      if (!compatible) return;
      const part = displayPart;
      ctx.fillStyle = "#9eb1c4";
      ctx.font = "11px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${HUMAN_BODY_NUMBER_PART_LABELS[part.key]} ${part.width}×${part.height}`, padding + x + gridWidth / 2, padding + titleHeight / 2);
      const values = getOrientedPartValues(frameRef.current, dataPart);
      values.forEach((rowValues, row) => {
        rowValues.forEach((value, col) => {
          drawNumberCell(ctx, value, padding + x + col * cellSize, padding + titleHeight + row * cellSize, cellSize);
        });
      });
    });
  }, [activeRegion]);

  useImperativeHandle(ref, () => ({
    updateData(nextFrame) {
      frameRef.current = nextFrame;
      draw();
    },
  }), [draw]);

  useEffect(() => {
    draw();
  }, [draw]);

  return (
    <div style={{ ...panelStyle, right: 78, bottom: 14, padding: 9, maxWidth: "calc(100vw - 500px)", overflow: "auto" }}>
      <div style={{ fontSize: "11px", color: "#8193a5", margin: "0 2px 6px" }}>
        2D 数字 · {REGION_VIEWS[activeRegion]?.label || "全身"}
      </div>
      <canvas ref={canvasRef} style={{ display: "block" }} />
    </div>
  );
});

RegionNumberPanel.displayName = "RegionNumberPanel";

const HoverDataPanel = React.forwardRef(({ sensorsRef }, ref) => {
  const [panel, setPanel] = useState({
    visible: false,
    sensor: null,
    cells: [],
    left: 0,
    top: 0,
  });

  useImperativeHandle(ref, () => ({
    show({ sensor, cells, left, top }) {
      setPanel({ visible: true, sensor, cells, left, top });
    },
    refresh(frame) {
      setPanel((current) => (
        current.sensor
          ? {
            ...current,
            cells: buildHumanBodySensorNeighborhood(
              current.sensor,
              sensorsRef.current,
              frame,
            ),
          }
          : current
      ));
    },
    hide() {
      setPanel((current) => (
        current.visible ? { ...current, visible: false } : current
      ));
    },
  }), [sensorsRef]);

  const sensor = panel.sensor;

  return (
    <div
      style={{
        position: "fixed",
        zIndex: 6,
        pointerEvents: "none",
        boxSizing: "border-box",
        width: HOVER_PANEL_SIZE.width,
        height: HOVER_PANEL_SIZE.height,
        left: panel.left,
        top: panel.top,
        padding: "10px",
        border: "1px solid rgba(125, 255, 211, 0.24)",
        borderRadius: "9px",
        background: "rgba(5, 10, 20, 0.88)",
        color: "#dce8f5",
        boxShadow: "0 8px 22px rgba(0, 0, 0, 0.28)",
        backdropFilter: "blur(8px)",
        opacity: panel.visible ? 1 : 0,
        transform: panel.visible ? "translateY(0)" : "translateY(4px)",
        transition: "opacity 150ms ease, transform 150ms ease",
      }}
      aria-hidden={!panel.visible}
    >
      <div style={{ fontSize: "11px", fontWeight: 700, lineHeight: "16px", color: "#b9fbe4", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {sensor?.part || "局部数据"}
        {sensor ? ` · R${sensor.row + 1} C${sensor.col + 1}` : ""}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "4px", marginTop: "8px" }}>
        {Array.from({ length: 9 }, (_, index) => {
          const cell = panel.cells[index];
          const isCenter = index === 4;
          return (
            <div
              key={index}
              style={{
                height: "30px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: `1px solid ${isCenter ? "rgba(0, 255, 170, 0.72)" : "rgba(140, 170, 195, 0.16)"}`,
                borderRadius: "4px",
                background: isCenter ? "rgba(0, 255, 170, 0.18)" : "rgba(255, 255, 255, 0.035)",
                color: isCenter ? "#7dffd3" : "#b5c4d2",
                font: "11px Consolas, monospace",
              }}
            >
              {cell?.value === null || cell?.value === undefined ? "—" : Math.round(cell.value)}
            </div>
          );
        })}
      </div>
    </div>
  );
});

HoverDataPanel.displayName = "HoverDataPanel";

const HumanBodyOptimized = React.forwardRef((props, forwardedRef) => {
  const initialSettingsRef = useRef(null);
  if (initialSettingsRef.current === null) {
    initialSettingsRef.current = readHumanBodyRenderSettings(getBrowserStorage());
  }
  const initialSettings = initialSettingsRef.current;
  const containerRef = useRef(null);
  const settingsPanelRef = useRef(null);
  const regionPanelRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const bodyGroupRef = useRef(null);
  const sensorTextureRef = useRef(null);
  const sensorsRef = useRef([]);
  const rawFrameRef = useRef(new Array(1024).fill(0));
  const materialsRef = useRef([]);
  const ghostMaterialsRef = useRef([]);
  const bodyMeshesRef = useRef([]);
  const pointCloudRef = useRef(null);
  const lineGridRef = useRef(null);
  const numberPanelRef = useRef(null);
  const hoverPanelRef = useRef(null);
  const hoveredSensorRef = useRef(null);
  const optionsRef = useRef({ ...DEFAULT_OPTIONS, ...props.renderOptions });
  const lastExternalSizeRef = useRef(props.renderOptions?.size);
  const activeRegionRef = useRef("overview");
  const overviewAutoRotateRef = useRef(initialSettings.overviewAutoRotate);
  const flightRef = useRef(null);
  const viewAutoRotateRef = useRef(null);
  const invalidateRenderRef = useRef(() => {});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sensorCount, setSensorCount] = useState(0);
  const [mode, setMode] = useState(initialSettings.mode);
  const [radius, setRadius] = useState(initialSettings.radius);
  const [intensity, setIntensity] = useState(initialSettings.intensity);
  const [opacity, setOpacity] = useState(initialSettings.opacity);
  const [colorScheme, setColorScheme] = useState(initialSettings.colorScheme);
  const [bgColor, setBgColor] = useState(initialSettings.bgColor);
  const [modelColor, setModelColor] = useState(initialSettings.modelColor);
  const accentColor = "#00ffaa";
  const [settingsCollapsed, setSettingsCollapsed] = useState(initialSettings.settingsCollapsed);
  const [overviewAutoRotate, setOverviewAutoRotate] = useState(initialSettings.overviewAutoRotate);
  const [activeRegion, setActiveRegion] = useState("overview");

  const updateTextureValues = useCallback(() => {
    const texture = sensorTextureRef.current;
    if (!texture) return;
    const data = texture.image.data;
    const max = Math.max(1, Number(optionsRef.current.max) || DEFAULT_OPTIONS.max);
    const filter = Math.max(0, Number(optionsRef.current.filter) || 0);
    sensorsRef.current.forEach((sensor, index) => {
      const rawValue = sensor.sample.reduce((total, item) => (
        total + (Number(rawFrameRef.current[item.index]) || 0) * item.weight
      ), 0);
      const scaledValue = rawValue * 10;
      data[index * 4 + 3] = scaledValue >= filter ? Math.min(1, scaledValue / max) : 0;
    });
    texture.needsUpdate = true;
    invalidateRenderRef.current();
  }, []);

  useImperativeHandle(forwardedRef, () => ({
    sitData({ wsPointData }) {
      if (!Array.isArray(wsPointData)) return;
      rawFrameRef.current = wsPointData.slice(0, 1024).map((value) => Number(value) || 0);
      numberPanelRef.current?.updateData(rawFrameRef.current);
      updateTextureValues();
      if (hoveredSensorRef.current) {
        hoverPanelRef.current?.refresh(rawFrameRef.current);
      }
    },
    changeColor({ max, size, filter }) {
      if (max !== undefined) optionsRef.current.max = max;
      if (filter !== undefined) optionsRef.current.filter = filter;
      if (size !== undefined) {
        optionsRef.current.size = size;
        setRadius(clampHumanBodyRadius(Number(size) / 100));
      }
      updateTextureValues();
    },
    changeFlag(value) {
      if (controlsRef.current) controlsRef.current.enabled = value;
    },
  }), [updateTextureValues]);

  useEffect(() => {
    optionsRef.current = { ...optionsRef.current, ...props.renderOptions };
    const externalSize = props.renderOptions?.size;
    if (externalSize !== undefined && externalSize !== lastExternalSizeRef.current) {
      lastExternalSizeRef.current = externalSize;
      setRadius(clampHumanBodyRadius(Number(externalSize) / 100));
    }
    updateTextureValues();
  }, [props.renderOptions, updateTextureValues]);

  useEffect(() => {
    writeHumanBodyRenderSettings(getBrowserStorage(), {
      mode,
      radius,
      intensity,
      opacity,
      colorScheme,
      bgColor,
      modelColor,
      settingsCollapsed,
      overviewAutoRotate,
    });
  }, [mode, radius, intensity, opacity, colorScheme, bgColor, modelColor, settingsCollapsed, overviewAutoRotate]);

  useEffect(() => {
    activeRegionRef.current = activeRegion;
  }, [activeRegion]);

  useEffect(() => {
    overviewAutoRotateRef.current = overviewAutoRotate;
    viewAutoRotateRef.current?.sync();
  }, [overviewAutoRotate]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(bgColor);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 100);
    camera.position.set(0, 4, 12);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    let qualityState = { tier: "balanced", slowFrames: 0, stableFrames: 0 };
    let appliedPixelRatio = getHumanBodyRenderPixelRatio(window.devicePixelRatio, qualityState.tier);
    let renderWidth = 0;
    let renderHeight = 0;
    renderer.setPixelRatio(appliedPixelRatio);
    renderer.outputEncoding = THREE.sRGBEncoding;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.target.set(0, 4, 0);
    controls.autoRotate = getHumanBodyAutoRotate({
      activeRegion: activeRegionRef.current,
      overviewAutoRotate: overviewAutoRotateRef.current,
      temporarilySuspended: false,
    });
    controls.autoRotateSpeed = 1.4;
    controlsRef.current = controls;

    scene.add(new THREE.HemisphereLight(0xd8efff, 0x172033, 0.7));
    const keyLight = new THREE.DirectionalLight(0xffffff, 0.75);
    keyLight.position.set(4, 10, 7);
    scene.add(keyLight);

    let disposed = false;
    let dragging = false;
    let pointerAnimationId = 0;
    let hoverTimerId = 0;
    let latestPointer = null;
    let candidateKey = null;
    let candidateSensor = null;
    let candidatePointer = null;
    let temporarilySuspended = false;
    let renderDirty = true;
    let pageVisible = !document.hidden;
    let lastRenderAt = 0;
    let interactionUntil = 0;
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    const canvas = renderer.domElement;

    const invalidateRender = () => {
      renderDirty = true;
    };
    invalidateRenderRef.current = invalidateRender;

    const cancelHoverTimer = () => {
      if (!hoverTimerId) return;
      window.clearTimeout(hoverTimerId);
      hoverTimerId = 0;
    };

    const cancelPointerAnimation = () => {
      if (!pointerAnimationId) return;
      cancelAnimationFrame(pointerAnimationId);
      pointerAnimationId = 0;
    };

    const syncAutoRotate = () => {
      if (disposed) return;
      controls.autoRotate = getHumanBodyAutoRotate({
        activeRegion: activeRegionRef.current,
        overviewAutoRotate: overviewAutoRotateRef.current,
        temporarilySuspended: temporarilySuspended || dragging || Boolean(flightRef.current),
      });
      invalidateRender();
    };

    const pauseAutoRotate = () => {
      temporarilySuspended = true;
      controls.autoRotate = false;
      invalidateRender();
    };

    const restoreAutoRotate = () => {
      temporarilySuspended = false;
      syncAutoRotate();
    };

    const hideHoverPanel = () => {
      hoveredSensorRef.current = null;
      hoverPanelRef.current?.hide();
    };

    const clearHover = ({ cancelPointer = false, restoreRotation = true } = {}) => {
      cancelHoverTimer();
      if (cancelPointer) {
        cancelPointerAnimation();
        latestPointer = null;
      }
      candidateKey = null;
      candidateSensor = null;
      candidatePointer = null;
      hideHoverPanel();
      if (restoreRotation) restoreAutoRotate();
    };

    viewAutoRotateRef.current = {
      beginFlight() {
        clearHover({ cancelPointer: true, restoreRotation: !dragging });
        controls.autoRotate = false;
      },
      finishFlight() {
        syncAutoRotate();
      },
      sync: syncAutoRotate,
    };

    const showStableCandidate = (sensor, pointer) => {
      pauseAutoRotate();
      hoveredSensorRef.current = sensor;
      const position = clampHumanBodyHoverPosition(
        { x: pointer.clientX, y: pointer.clientY },
        HOVER_PANEL_SIZE,
        { width: window.innerWidth, height: window.innerHeight },
        HOVER_POINTER_OFFSET,
      );
      hoverPanelRef.current?.show({
        sensor,
        cells: buildHumanBodySensorNeighborhood(
          sensor,
          sensorsRef.current,
          rawFrameRef.current,
        ),
        ...position,
      });
    };

    const setHoverCandidate = (sensor, pointer) => {
      const nextKey = sensor.index;
      if (candidateKey === nextKey) return;

      cancelHoverTimer();
      candidateKey = nextKey;
      candidateSensor = sensor;
      candidatePointer = { ...pointer };
      hideHoverPanel();

      hoverTimerId = window.setTimeout(() => {
        hoverTimerId = 0;
        if (
          disposed
          || dragging
          || candidateKey !== nextKey
          || candidateSensor !== sensor
          || !candidatePointer
        ) return;
        showStableCandidate(sensor, candidatePointer);
      }, HOVER_DELAY_MS);
    };

    const processLatestPointer = () => {
      pointerAnimationId = 0;
      if (disposed || dragging || !latestPointer) return;

      const rect = canvas.getBoundingClientRect();
      if (!(rect.width > 0) || !(rect.height > 0)) {
        clearHover();
        return;
      }

      pointerNdc.set(
        ((latestPointer.clientX - rect.left) / rect.width) * 2 - 1,
        -((latestPointer.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointerNdc, camera);
      const intersection = raycaster.intersectObjects(bodyMeshesRef.current, false)[0];
      if (!intersection) {
        clearHover();
        return;
      }

      const sensor = findNearestHumanBodySensor(intersection.point, sensorsRef.current);
      if (!sensor) {
        clearHover();
        return;
      }
      setHoverCandidate(sensor, latestPointer);
    };

    const handlePointerMove = (event) => {
      latestPointer = { clientX: event.clientX, clientY: event.clientY };
      if (!pointerAnimationId) {
        pointerAnimationId = requestAnimationFrame(processLatestPointer);
      }
    };

    const handlePointerLeave = () => {
      clearHover({ cancelPointer: true, restoreRotation: !dragging });
    };

    const handleControlsStart = () => {
      dragging = true;
      interactionUntil = performance.now() + 350;
      clearHover({ cancelPointer: true, restoreRotation: false });
      pauseAutoRotate();
    };

    const handleControlsEnd = () => {
      dragging = false;
      interactionUntil = performance.now() + 350;
      clearHover({ cancelPointer: true });
      invalidateRender();
    };

    const handleControlsChange = () => {
      interactionUntil = performance.now() + 350;
      invalidateRender();
    };

    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerleave", handlePointerLeave);
    controls.addEventListener("start", handleControlsStart);
    controls.addEventListener("end", handleControlsEnd);
    controls.addEventListener("change", handleControlsChange);

    let animationId = 0;
    const resize = () => {
      const width = Math.max(1, container.clientWidth);
      const height = Math.max(1, container.clientHeight);
      const nextPixelRatio = getHumanBodyRenderPixelRatio(window.devicePixelRatio, qualityState.tier);
      if (Math.abs(nextPixelRatio - appliedPixelRatio) > 0.001) {
        appliedPixelRatio = nextPixelRatio;
        renderer.setPixelRatio(appliedPixelRatio);
        renderWidth = 0;
        renderHeight = 0;
      }
      if (width !== renderWidth || height !== renderHeight) {
        renderer.setSize(width, height, false);
        renderWidth = width;
        renderHeight = height;
      }
      camera.aspect = width / height;
      camera.clearViewOffset();
      const visualCenter = getHumanBodyVisualCenter({
        width,
        leftPanelRight: settingsPanelRef.current?.getBoundingClientRect?.().right,
        rightPanelLeft: regionPanelRef.current?.getBoundingClientRect?.().left,
      });
      const viewOffsetX = getHumanBodyViewOffsetX(width, visualCenter);
      if (Math.abs(viewOffsetX) > 0.5) {
        camera.setViewOffset(width, height, viewOffsetX, 0, width, height);
      } else {
        camera.updateProjectionMatrix();
      }
      invalidateRender();
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    if (settingsPanelRef.current) resizeObserver.observe(settingsPanelRef.current);
    if (regionPanelRef.current) resizeObserver.observe(regionPanelRef.current);
    window.addEventListener("resize", resize);
    window.visualViewport?.addEventListener("resize", resize);

    const handleVisibilityChange = () => {
      pageVisible = !document.hidden;
      if (pageVisible) {
        lastRenderAt = 0;
        invalidateRender();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const modelPromise = new Promise((resolve, reject) => {
      new GLTFLoader().load(MODEL_URL, resolve, undefined, reject);
    });
    const layoutPromise = fetch(SENSOR_LAYOUT_URL).then((response) => {
      if (!response.ok) throw new Error(`点位文件请求失败：HTTP ${response.status}`);
      return response.json();
    });

    Promise.all([modelPromise, layoutPromise])
      .then(([gltf, sensorArchive]) => {
        if (disposed) return;
        const sourceModel = gltf.scene;
        const originalBox = new THREE.Box3().setFromObject(sourceModel);
        const originalSize = originalBox.getSize(new THREE.Vector3());
        const center = originalBox.getCenter(new THREE.Vector3());
        const scale = 8 / Math.max(originalSize.x, originalSize.y, originalSize.z);
        const normalizedModel = new THREE.Group();
        normalizedModel.add(sourceModel);
        normalizedModel.scale.setScalar(scale);
        normalizedModel.position.set(-center.x * scale, -center.y * scale + originalSize.y * scale * 0.5, -center.z * scale);
        normalizedModel.updateMatrixWorld(true);
        bodyGroupRef.current = normalizedModel;
        scene.add(normalizedModel);

        try {
          const sensors = buildSensorLayout(sensorArchive);
          if (!sensors.length) throw new Error("点位文件中没有可渲染的物理点位");
          sensorsRef.current = sensors;
          setSensorCount(sensors.length);

          const textureData = new Float32Array(sensors.length * 4);
          sensors.forEach((sensor, index) => {
            textureData[index * 4] = sensor.position.x;
            textureData[index * 4 + 1] = sensor.position.y;
            textureData[index * 4 + 2] = sensor.position.z;
          });
          const texture = new THREE.DataTexture(textureData, sensors.length, 1, THREE.RGBAFormat, THREE.FloatType);
          texture.magFilter = THREE.NearestFilter;
          texture.minFilter = THREE.NearestFilter;
          texture.needsUpdate = true;
          sensorTextureRef.current = texture;

          normalizedModel.traverse((child) => {
            if (!child.isMesh || child.geometry?.attributes?.position?.count < 100) return;
            const shaderMaterial = new THREE.ShaderMaterial({
              vertexShader,
              fragmentShader,
              uniforms: {
                uSensorData: { value: texture },
                uSensorCount: { value: sensors.length },
                uRadius: { value: radius },
                uIntensity: { value: intensity },
                uOpacity: { value: opacity },
                uColorScheme: { value: colorScheme },
                uCrystal: { value: 0 },
                uModelColor: { value: new THREE.Color(modelColor) },
              },
              side: THREE.DoubleSide,
            });
            const ghostMaterial = new THREE.MeshPhongMaterial({
              color: modelColor,
              transparent: true,
              opacity: 0.32,
              side: THREE.DoubleSide,
              depthWrite: false,
              shininess: 22,
            });
            materialsRef.current.push(shaderMaterial);
            ghostMaterialsRef.current.push(ghostMaterial);
            bodyMeshesRef.current.push(child);
            child.material = shaderMaterial;
          });

          const pointGeometry = new THREE.SphereGeometry(0.035, 7, 5);
          const pointMaterial = new THREE.MeshBasicMaterial({ color: accentColor });
          const pointCloud = new THREE.InstancedMesh(pointGeometry, pointMaterial, sensors.length);
          const matrix = new THREE.Matrix4();
          sensors.forEach((sensor, index) => {
            matrix.makeTranslation(sensor.position.x, sensor.position.y, sensor.position.z);
            pointCloud.setMatrixAt(index, matrix);
          });
          pointCloud.instanceMatrix.needsUpdate = true;
          pointCloud.visible = false;
          scene.add(pointCloud);
          pointCloudRef.current = pointCloud;

          const lines = [];
          const lineGroups = new Map();
          sensors.forEach((sensor) => {
            const groupKey = `${sensor.part}::${sensor.placementSide}`;
            if (!lineGroups.has(groupKey)) lineGroups.set(groupKey, []);
            lineGroups.get(groupKey).push(sensor);
          });
          lineGroups.forEach((groupSensors) => {
            const byCell = new Map(groupSensors.map((sensor) => [`${sensor.row},${sensor.col}`, sensor]));
            groupSensors.forEach((sensor) => {
              const right = byCell.get(`${sensor.row},${sensor.col + 1}`);
              const below = byCell.get(`${sensor.row + 1},${sensor.col}`);
              [right, below].forEach((neighbor) => {
                if (neighbor) lines.push(...sensor.position.toArray(), ...neighbor.position.toArray());
              });
            });
          });
          const lineGeometry = new THREE.BufferGeometry();
          lineGeometry.setAttribute("position", new THREE.Float32BufferAttribute(lines, 3));
          const lineMaterial = new THREE.LineBasicMaterial({ color: accentColor, transparent: true, opacity: 0.8 });
          const lineGrid = new THREE.LineSegments(lineGeometry, lineMaterial);
          lineGrid.visible = false;
          scene.add(lineGrid);
          lineGridRef.current = lineGrid;

          updateTextureValues();
          setLoading(false);
        } catch (layoutError) {
          setError(layoutError instanceof Error ? layoutError.message : String(layoutError));
          setLoading(false);
        }
      })
      .catch((loadError) => {
        if (disposed) return;
        setError(`人体模型或点位加载失败：${loadError?.message || "未知错误"}`);
        setLoading(false);
      });

    const animate = (now) => {
      animationId = requestAnimationFrame(animate);
      const continuous = Boolean(flightRef.current)
        || controls.autoRotate
        || dragging
        || now < interactionUntil;
      if (!shouldRenderHumanBodyFrame({
        visible: pageVisible,
        dirty: renderDirty,
        continuous,
        now,
        lastRenderAt,
      })) return;

      const previousRenderAt = lastRenderAt;
      const flight = flightRef.current;
      if (flight) {
        const progress = Math.min(1, (now - flight.startedAt) / flight.duration);
        const eased = easeInOutCubic(progress);
        camera.position.lerpVectors(flight.startPosition, flight.endPosition, eased);
        controls.target.lerpVectors(flight.startTarget, flight.endTarget, eased);
        if (progress >= 1) {
          flightRef.current = null;
          viewAutoRotateRef.current?.finishFlight();
        }
      }
      controls.update();
      renderer.render(scene, camera);
      renderDirty = false;
      lastRenderAt = now;

      if (continuous && previousRenderAt > 0) {
        const nextQualityState = updateHumanBodyQualityState(qualityState, now - previousRenderAt);
        const tierChanged = nextQualityState.tier !== qualityState.tier;
        qualityState = nextQualityState;
        if (tierChanged) resize();
      }
    };
    animationId = requestAnimationFrame(animate);

    return () => {
      disposed = true;
      viewAutoRotateRef.current = null;
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerleave", handlePointerLeave);
      controls.removeEventListener("start", handleControlsStart);
      controls.removeEventListener("end", handleControlsEnd);
      controls.removeEventListener("change", handleControlsChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("resize", resize);
      window.visualViewport?.removeEventListener("resize", resize);
      clearHover({ cancelPointer: true });
      cancelAnimationFrame(animationId);
      resizeObserver.disconnect();
      invalidateRenderRef.current = () => {};
      controls.dispose();
      renderer.dispose();
      materialsRef.current.forEach((material) => material.dispose());
      ghostMaterialsRef.current.forEach((material) => material.dispose());
      sensorTextureRef.current?.dispose();
      pointCloudRef.current?.geometry?.dispose();
      pointCloudRef.current?.material?.dispose();
      lineGridRef.current?.geometry?.dispose();
      lineGridRef.current?.material?.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.background?.set(bgColor);
    invalidateRenderRef.current();
  }, [bgColor]);

  useEffect(() => {
    materialsRef.current.forEach((material) => {
      material.uniforms.uRadius.value = radius;
      material.uniforms.uIntensity.value = intensity;
      material.uniforms.uOpacity.value = opacity;
      material.uniforms.uColorScheme.value = colorScheme;
      material.uniforms.uCrystal.value = mode === "crystal" ? 1 : 0;
      material.uniforms.uModelColor.value.set(modelColor);
      material.transparent = mode === "crystal";
      material.depthWrite = mode !== "crystal";
      material.needsUpdate = true;
    });
    invalidateRenderRef.current();
  }, [radius, intensity, opacity, colorScheme, mode, modelColor, loading]);

  useEffect(() => {
    const showPoints = mode === "points" || mode === "both";
    const showLines = mode === "lines";
    if (pointCloudRef.current) pointCloudRef.current.visible = showPoints;
    if (lineGridRef.current) lineGridRef.current.visible = showLines;
    bodyMeshesRef.current.forEach((mesh, index) => {
      mesh.material = (mode === "points" || mode === "lines")
        ? ghostMaterialsRef.current[index]
        : materialsRef.current[index];
    });
    invalidateRenderRef.current();
  }, [mode, loading]);

  useEffect(() => {
    materialsRef.current.forEach((material) => material.uniforms.uModelColor.value.set(modelColor));
    ghostMaterialsRef.current.forEach((material) => material.color.set(modelColor));
    invalidateRenderRef.current();
  }, [modelColor, loading]);

  useEffect(() => {
    pointCloudRef.current?.material?.color?.set(accentColor);
    lineGridRef.current?.material?.color?.set(accentColor);
    invalidateRenderRef.current();
  }, [accentColor]);

  const flyTo = (regionKey) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    const view = REGION_VIEWS[regionKey];
    if (!camera || !controls || !view) return;
    activeRegionRef.current = regionKey;
    setActiveRegion(regionKey);
    viewAutoRotateRef.current?.beginFlight();
    controls.autoRotate = false;
    flightRef.current = {
      startPosition: camera.position.clone(),
      endPosition: new THREE.Vector3(...view.position),
      startTarget: controls.target.clone(),
      endTarget: new THREE.Vector3(...view.target),
      startedAt: performance.now(),
      duration: 1200,
    };
    invalidateRenderRef.current();
  };

  const resetView = () => flyTo("overview");

  const toggleOverviewAutoRotate = () => {
    const nextValue = !overviewAutoRotateRef.current;
    overviewAutoRotateRef.current = nextValue;
    setOverviewAutoRotate(nextValue);
    viewAutoRotateRef.current?.sync();
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 0, width: "100vw", height: "100vh", overflow: "hidden", background: bgColor }}>
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />

      <HoverDataPanel ref={hoverPanelRef} sensorsRef={sensorsRef} />

      {(loading || error) && (
        <div style={{ position: "absolute", inset: 0, zIndex: 8, display: "flex", alignItems: "center", justifyContent: "center", color: error ? "#ff8b8b" : "#b9cbdc", background: "rgba(2,5,12,0.72)" }}>
          {error || "正在加载真实人体模型并计算传感器点位…"}
        </div>
      )}

      <div ref={settingsPanelRef} style={{ ...panelStyle, top: 72, left: "max(250px, 19vw)", width: 222 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ fontSize: "14px", fontWeight: 700, letterSpacing: "0.08em" }}>人体全身优化</div>
          <button
            type="button"
            aria-expanded={!settingsCollapsed}
            aria-label={settingsCollapsed ? "展开渲染设置" : "折叠渲染设置"}
            onClick={() => setSettingsCollapsed((value) => !value)}
            style={{ ...buttonStyle(false), minWidth: 30, padding: "3px 8px" }}
          >
            {settingsCollapsed ? "▾" : "▴"}
          </button>
        </div>
        {!settingsCollapsed && (
          <>
            <div style={{ color: "#5e748a", fontSize: "10px", marginTop: 3 }}>REALISTIC SHADER · {sensorCount} 点位</div>
            <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 5 }}>
              {VISIBLE_RENDER_MODES.map(([value, label]) => (
                <button key={value} onClick={() => setMode(value)} style={buttonStyle(mode === value)}>{label}</button>
              ))}
            </div>

            <label style={{ display: "block", marginTop: 11, fontSize: "11px", color: "#8193a5" }}>扩散半径 {radius.toFixed(2)}</label>
            <input type="range" min="5" max="13" step="1" value={Math.round(radius * 100)} onChange={(event) => setRadius(clampHumanBodyRadius(Number(event.target.value) / 100))} style={{ width: "100%", accentColor: accentColor }} />
            <label style={{ display: "block", marginTop: 8, fontSize: "11px", color: "#8193a5" }}>热力强度 {intensity.toFixed(1)}</label>
            <input type="range" min="5" max="50" value={Math.round(intensity * 10)} onChange={(event) => setIntensity(Number(event.target.value) / 10)} style={{ width: "100%", accentColor: accentColor }} />
            {mode === "crystal" && (
              <>
                <label style={{ display: "block", marginTop: 8, fontSize: "11px", color: "#8193a5" }}>基础透明度 {opacity.toFixed(2)}</label>
                <input type="range" min="5" max="80" value={Math.round(opacity * 100)} onChange={(event) => setOpacity(Number(event.target.value) / 100)} style={{ width: "100%", accentColor: accentColor }} />
              </>
            )}

            <div style={{ marginTop: 9, display: "flex", gap: 5 }}>
              {["经典", "冷色", "暖色", "岩浆"].map((label, index) => (
                <button key={label} onClick={() => setColorScheme(index)} style={buttonStyle(colorScheme === index)}>{label}</button>
              ))}
            </div>

            <ColorRow label="背景" value={bgColor} presets={BG_PRESETS} onChange={setBgColor} />
            <ColorRow label="模型" value={modelColor} presets={MODEL_PRESETS} onChange={setModelColor} />
          </>
        )}
      </div>

      <div ref={regionPanelRef} style={{ ...panelStyle, top: 72, right: 14, width: 126 }}>
        <div style={{ fontSize: "11px", color: "#8193a5", marginBottom: 7 }}>部位视角</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
          {Object.entries(REGION_VIEWS).map(([key, view]) => (
            <button key={key} onClick={() => flyTo(key)} style={buttonStyle(activeRegion === key)}>{view.label}</button>
          ))}
        </div>
        {activeRegion === "overview" && (
          <button onClick={toggleOverviewAutoRotate} style={{ ...buttonStyle(overviewAutoRotate), width: "100%", marginTop: 8 }}>
            {overviewAutoRotate ? "暂停旋转" : "自动旋转"}
          </button>
        )}
        <button onClick={resetView} style={{ ...buttonStyle(false), width: "100%", marginTop: 8 }}>重置视角</button>
      </div>

      <RegionNumberPanel ref={numberPanelRef} activeRegion={activeRegion} />
    </div>
  );
});

HumanBodyOptimized.displayName = "HumanBodyOptimized";

export default HumanBodyOptimized;
