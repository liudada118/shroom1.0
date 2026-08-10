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
import {
  HUMAN_BODY_SENSOR_PARTS,
  HUMAN_BODY_UV_CANVAS_SIZE,
} from "./humanBody";

const MODEL_URL = "./model/human3.glb";
const MAX_SHADER_SENSORS = 512;
const UV_BUCKET_COUNT = 64;
const DEFAULT_OPTIONS = { max: 1555, size: 31, filter: 6 };

const BG_PRESETS = ["#0a0a0f", "#10152b", "#0f2027", "#000000"];
const MODEL_PRESETS = ["#6a7a8a", "#4a5568", "#718096", "#4fd1c5"];
const ACCENT_PRESETS = ["#00ffaa", "#00d9ff", "#ff6b6b", "#ffd93d"];

const REGION_VIEWS = {
  overview: { label: "全身", position: [0, 4, 12], target: [0, 4, 0] },
  chest: { label: "前胸", position: [0, 5.5, 6], target: [0, 5.5, 0] },
  back: { label: "后背", position: [0, 5.5, -6], target: [0, 5.5, 0] },
  leftArm: { label: "左臂", position: [-5, 5.5, 4], target: [-2.5, 5.5, 0] },
  rightArm: { label: "右臂", position: [5, 5.5, 4], target: [2.5, 5.5, 0] },
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
    vec3 baseColor = vec3(0.12, 0.13, 0.16);
    vec3 color = heat > 0.005 ? heatColor(heat) : baseColor;

    if (uCrystal == 1) {
      float fresnel = pow(1.0 - max(dot(normalize(vWorldNormal), normalize(vViewDirection)), 0.0), 3.0);
      color = mix(vec3(0.52, 0.72, 0.9), color, heat * 0.9) + vec3(0.65, 0.85, 1.0) * fresnel * 0.35;
      gl_FragColor = vec4(color, clamp(uOpacity + heat * 0.75 + fresnel * 0.15, 0.05, 0.95));
      return;
    }

    gl_FragColor = vec4(color, 1.0);
  }
`;

const easeInOutCubic = (value) => (
  value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2
);

const isFiniteVector = (vector) => (
  Number.isFinite(vector.x) && Number.isFinite(vector.y) && Number.isFinite(vector.z)
);

function triangleBarycentric2D(point, a, b, c) {
  const denominator = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
  if (Math.abs(denominator) < 1e-8) return null;
  const wa = ((b.y - c.y) * (point.x - c.x) + (c.x - b.x) * (point.y - c.y)) / denominator;
  const wb = ((c.y - a.y) * (point.x - c.x) + (a.x - c.x) * (point.y - c.y)) / denominator;
  const wc = 1 - wa - wb;
  return wa >= -0.002 && wb >= -0.002 && wc >= -0.002 ? [wa, wb, wc] : null;
}

function createUvSurfaceLookup(model) {
  const buckets = Array.from({ length: UV_BUCKET_COUNT * UV_BUCKET_COUNT }, () => []);
  const vertices = [];

  const bucketIndex = (x, y) => {
    const bx = Math.min(UV_BUCKET_COUNT - 1, Math.max(0, Math.floor(x * UV_BUCKET_COUNT)));
    const by = Math.min(UV_BUCKET_COUNT - 1, Math.max(0, Math.floor(y * UV_BUCKET_COUNT)));
    return by * UV_BUCKET_COUNT + bx;
  };

  model.updateMatrixWorld(true);
  model.traverse((child) => {
    if (!child.isMesh || !child.geometry?.attributes?.position || !child.geometry?.attributes?.uv) return;
    const geometry = child.geometry;
    const position = geometry.attributes.position;
    const normal = geometry.attributes.normal;
    const uv = geometry.attributes.uv;
    const index = geometry.index;
    const triangleCount = index ? index.count / 3 : position.count / 3;

    for (let triangleIndex = 0; triangleIndex < triangleCount; triangleIndex += 1) {
      const ids = [0, 1, 2].map((offset) => (
        index ? index.getX(triangleIndex * 3 + offset) : triangleIndex * 3 + offset
      ));
      const triangle = {
        uv: ids.map((id) => new THREE.Vector2(uv.getX(id), uv.getY(id))),
        position: ids.map((id) => new THREE.Vector3(position.getX(id), position.getY(id), position.getZ(id)).applyMatrix4(child.matrixWorld)),
        normal: ids.map((id) => {
          const value = normal
            ? new THREE.Vector3(normal.getX(id), normal.getY(id), normal.getZ(id))
            : new THREE.Vector3(0, 0, 1);
          return value.transformDirection(child.matrixWorld);
        }),
      };
      if (!triangle.position.every(isFiniteVector)) continue;

      triangle.uv.forEach((uvPoint, vertexIndex) => {
        vertices.push({ uv: uvPoint, position: triangle.position[vertexIndex], normal: triangle.normal[vertexIndex] });
      });

      const minX = Math.max(0, Math.min(...triangle.uv.map((point) => point.x)));
      const maxX = Math.min(1, Math.max(...triangle.uv.map((point) => point.x)));
      const minY = Math.max(0, Math.min(...triangle.uv.map((point) => point.y)));
      const maxY = Math.min(1, Math.max(...triangle.uv.map((point) => point.y)));
      const minBucketX = Math.min(UV_BUCKET_COUNT - 1, Math.floor(minX * UV_BUCKET_COUNT));
      const maxBucketX = Math.min(UV_BUCKET_COUNT - 1, Math.floor(maxX * UV_BUCKET_COUNT));
      const minBucketY = Math.min(UV_BUCKET_COUNT - 1, Math.floor(minY * UV_BUCKET_COUNT));
      const maxBucketY = Math.min(UV_BUCKET_COUNT - 1, Math.floor(maxY * UV_BUCKET_COUNT));
      for (let by = minBucketY; by <= maxBucketY; by += 1) {
        for (let bx = minBucketX; bx <= maxBucketX; bx += 1) {
          buckets[by * UV_BUCKET_COUNT + bx].push(triangle);
        }
      }
    }
  });

  return (uvPoint) => {
    const candidates = buckets[bucketIndex(uvPoint.x, uvPoint.y)];
    for (const triangle of candidates) {
      const weights = triangleBarycentric2D(uvPoint, triangle.uv[0], triangle.uv[1], triangle.uv[2]);
      if (!weights) continue;
      const position = new THREE.Vector3();
      const normal = new THREE.Vector3();
      for (let index = 0; index < 3; index += 1) {
        position.addScaledVector(triangle.position[index], weights[index]);
        normal.addScaledVector(triangle.normal[index], weights[index]);
      }
      normal.normalize();
      return { position: position.addScaledVector(normal, 0.015), normal };
    }

    let nearest = null;
    let nearestDistance = Infinity;
    vertices.forEach((vertex) => {
      const distance = vertex.uv.distanceToSquared(uvPoint);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = vertex;
      }
    });
    return nearest
      ? { position: nearest.position.clone().addScaledVector(nearest.normal, 0.015), normal: nearest.normal.clone() }
      : null;
  };
}

function buildSensorLayout(model) {
  const findSurfacePoint = createUvSurfaceLookup(model);
  const sensors = [];
  const parts = [];

  HUMAN_BODY_SENSOR_PARTS.forEach((part) => {
    const partSensors = [];
    for (let row = 0; row < part.height; row += 1) {
      for (let col = 0; col < part.width; col += 1) {
        const uvPoint = new THREE.Vector2(
          (part.uv.x + ((col + 0.5) / part.width) * part.uv.w) / HUMAN_BODY_UV_CANVAS_SIZE,
          (part.uv.y + ((row + 0.5) / part.height) * part.uv.h) / HUMAN_BODY_UV_CANVAS_SIZE,
        );
        const surface = findSurfacePoint(uvPoint);
        if (!surface) continue;
        const sensor = {
          index: part.positions[row * part.width + col] - 1,
          row,
          col,
          part: part.key,
          position: surface.position,
        };
        sensors.push(sensor);
        partSensors.push(sensor);
      }
    }
    parts.push({ key: part.key, width: part.width, height: part.height, sensors: partSensors });
  });

  return { sensors: sensors.slice(0, MAX_SHADER_SENSORS), parts };
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

const HumanBodyOptimized = React.forwardRef((props, forwardedRef) => {
  const containerRef = useRef(null);
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
  const optionsRef = useRef({ ...DEFAULT_OPTIONS, ...props.renderOptions });
  const flightRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sensorCount, setSensorCount] = useState(0);
  const [mode, setMode] = useState("heatmap");
  const [radius, setRadius] = useState((optionsRef.current.size || 31) / 100);
  const [intensity, setIntensity] = useState(0.8);
  const [opacity, setOpacity] = useState(0.15);
  const [colorScheme, setColorScheme] = useState(0);
  const [bgColor, setBgColor] = useState("#0a0a0f");
  const [modelColor, setModelColor] = useState("#6a7a8a");
  const [accentColor, setAccentColor] = useState("#00ffaa");
  const [activeRegion, setActiveRegion] = useState("overview");

  const updateTextureValues = useCallback(() => {
    const texture = sensorTextureRef.current;
    if (!texture) return;
    const data = texture.image.data;
    const max = Math.max(1, Number(optionsRef.current.max) || DEFAULT_OPTIONS.max);
    const filter = Math.max(0, Number(optionsRef.current.filter) || 0);
    sensorsRef.current.forEach((sensor, index) => {
      const scaledValue = (Number(rawFrameRef.current[sensor.index]) || 0) * 10;
      data[index * 4 + 3] = scaledValue >= filter ? Math.min(1, scaledValue / max) : 0;
    });
    texture.needsUpdate = true;
  }, []);

  useImperativeHandle(forwardedRef, () => ({
    sitData({ wsPointData }) {
      if (!Array.isArray(wsPointData)) return;
      rawFrameRef.current = wsPointData.slice(0, 1024).map((value) => Number(value) || 0);
      updateTextureValues();
    },
    changeColor({ max, size, filter }) {
      if (max !== undefined) optionsRef.current.max = max;
      if (filter !== undefined) optionsRef.current.filter = filter;
      if (size !== undefined) {
        optionsRef.current.size = size;
        setRadius(Math.max(0.05, Number(size) / 100));
      }
      updateTextureValues();
    },
    changeFlag(value) {
      if (controlsRef.current) controlsRef.current.enabled = value;
    },
  }), [updateTextureValues]);

  useEffect(() => {
    optionsRef.current = { ...optionsRef.current, ...props.renderOptions };
    if (props.renderOptions?.size !== undefined) {
      setRadius(Math.max(0.05, Number(props.renderOptions.size) / 100));
    }
    updateTextureValues();
  }, [props.renderOptions, updateTextureValues]);

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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.target.set(0, 4, 0);
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.7;
    controlsRef.current = controls;

    scene.add(new THREE.HemisphereLight(0xd8efff, 0x172033, 0.7));
    const keyLight = new THREE.DirectionalLight(0xffffff, 0.75);
    keyLight.position.set(4, 10, 7);
    scene.add(keyLight);

    let disposed = false;
    let animationId = 0;
    const resize = () => {
      const width = Math.max(1, container.clientWidth);
      const height = Math.max(1, container.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    new GLTFLoader().load(
      MODEL_URL,
      (gltf) => {
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
          const { sensors, parts } = buildSensorLayout(normalizedModel);
          if (!sensors.length) throw new Error("未能从人体模型 UV 生成传感器坐标");
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
          parts.forEach((part) => {
            const byCell = new Map(part.sensors.map((sensor) => [`${sensor.row},${sensor.col}`, sensor]));
            part.sensors.forEach((sensor) => {
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
      },
      undefined,
      (loadError) => {
        if (disposed) return;
        setError(`人体模型加载失败：${loadError?.message || "未知错误"}`);
        setLoading(false);
      },
    );

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      const flight = flightRef.current;
      if (flight) {
        const progress = Math.min(1, (performance.now() - flight.startedAt) / flight.duration);
        const eased = easeInOutCubic(progress);
        camera.position.lerpVectors(flight.startPosition, flight.endPosition, eased);
        controls.target.lerpVectors(flight.startTarget, flight.endTarget, eased);
        if (progress >= 1) flightRef.current = null;
      }
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(animationId);
      resizeObserver.disconnect();
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
  }, [bgColor]);

  useEffect(() => {
    materialsRef.current.forEach((material) => {
      material.uniforms.uRadius.value = radius;
      material.uniforms.uIntensity.value = intensity;
      material.uniforms.uOpacity.value = opacity;
      material.uniforms.uColorScheme.value = colorScheme;
      material.uniforms.uCrystal.value = mode === "crystal" ? 1 : 0;
      material.transparent = mode === "crystal";
      material.depthWrite = mode !== "crystal";
      material.needsUpdate = true;
    });
  }, [radius, intensity, opacity, colorScheme, mode]);

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
  }, [mode, loading]);

  useEffect(() => {
    ghostMaterialsRef.current.forEach((material) => material.color.set(modelColor));
  }, [modelColor]);

  useEffect(() => {
    pointCloudRef.current?.material?.color?.set(accentColor);
    lineGridRef.current?.material?.color?.set(accentColor);
  }, [accentColor]);

  const flyTo = (regionKey) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    const view = REGION_VIEWS[regionKey];
    if (!camera || !controls || !view) return;
    controls.autoRotate = false;
    setActiveRegion(regionKey);
    flightRef.current = {
      startPosition: camera.position.clone(),
      endPosition: new THREE.Vector3(...view.position),
      startTarget: controls.target.clone(),
      endTarget: new THREE.Vector3(...view.target),
      startedAt: performance.now(),
      duration: 1200,
    };
  };

  const resetView = () => {
    flyTo("overview");
    window.setTimeout(() => {
      if (controlsRef.current) controlsRef.current.autoRotate = true;
    }, 1250);
  };

  return (
    <div style={{ width: "100%", height: "100%", minHeight: "520px", position: "relative", overflow: "hidden", background: bgColor }}>
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />

      {(loading || error) && (
        <div style={{ position: "absolute", inset: 0, zIndex: 8, display: "flex", alignItems: "center", justifyContent: "center", color: error ? "#ff8b8b" : "#b9cbdc", background: "rgba(2,5,12,0.72)" }}>
          {error || "正在加载真实人体模型并计算传感器点位…"}
        </div>
      )}

      <div style={{ ...panelStyle, top: 72, left: "max(250px, 19vw)", width: 222 }}>
        <div style={{ fontSize: "14px", fontWeight: 700, letterSpacing: "0.08em" }}>人体全身优化</div>
        <div style={{ color: "#5e748a", fontSize: "10px", marginTop: 3 }}>REALISTIC SHADER · {sensorCount} 点位</div>

        <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 5 }}>
          {[
            ["heatmap", "热力"],
            ["crystal", "水晶"],
            ["lines", "线网"],
            ["points", "点云"],
            ["both", "叠加"],
          ].map(([value, label]) => (
            <button key={value} onClick={() => setMode(value)} style={buttonStyle(mode === value)}>{label}</button>
          ))}
        </div>

        <label style={{ display: "block", marginTop: 11, fontSize: "11px", color: "#8193a5" }}>扩散半径 {radius.toFixed(2)}</label>
        <input type="range" min="5" max="100" value={Math.round(radius * 100)} onChange={(event) => setRadius(Number(event.target.value) / 100)} style={{ width: "100%", accentColor: accentColor }} />
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
        <ColorRow label="线条 / 点云" value={accentColor} presets={ACCENT_PRESETS} onChange={setAccentColor} />
      </div>

      <div style={{ ...panelStyle, top: 72, right: 14, width: 126 }}>
        <div style={{ fontSize: "11px", color: "#8193a5", marginBottom: 7 }}>部位视角</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
          {Object.entries(REGION_VIEWS).map(([key, view]) => (
            <button key={key} onClick={() => flyTo(key)} style={buttonStyle(activeRegion === key)}>{view.label}</button>
          ))}
        </div>
        <button onClick={resetView} style={{ ...buttonStyle(false), width: "100%", marginTop: 8 }}>重置视角</button>
      </div>
    </div>
  );
});

HumanBodyOptimized.displayName = "HumanBodyOptimized";

export default HumanBodyOptimized;
