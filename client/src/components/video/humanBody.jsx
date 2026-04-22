import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { TrackballControls } from "three/examples/jsm/controls/TrackballControls";
import React, { useEffect, useImperativeHandle, useRef } from "react";
import TWEEN from "@tweenjs/tween.js";
import { HeatmapCanvas } from "../../assets/util/heatmap";

/**
 * 人体全身 skin 3D 渲染组件
 * 完全参考 hand.jsx skin 模式
 * 使用 human.glb + GLTFLoader + CanvasTexture
 */

// ─── 各部位传感器索引矩阵（1-based，取值时 -1 转为 0-based）─────────────────────

const BACK_IDX = [
  [5,4,3,2,1,15,14,13,12,11],
  [37,36,35,34,33,47,46,45,44,43],
  [69,68,67,66,65,79,78,77,76,75],
  [677,676,675,674,673,687,686,685,684,683],
  [645,644,643,642,641,655,654,653,652,651],
  [613,612,611,610,609,623,622,621,620,619],
];

const CHEST_IDX = [
  [692,691,690,689,688,682,681,680,679,678],
  [660,659,658,657,656,650,649,648,647,646],
  [628,627,626,625,624,618,617,616,615,614],
  [20,19,18,17,16,10,9,8,7,6],
  [52,51,50,49,48,42,41,40,39,38],
  [84,83,82,81,80,74,73,72,71,70],
];

const RIGHT_ARM_IDX = [
  [736,768,800,832,864,1024,992],
  [735,767,799,831,863,1023,991],
  [734,766,798,830,862,1022,990],
  [733,765,797,829,861,1021,989],
  [732,764,796,828,860,1020,988],
  [731,763,795,827,859,1019,987],
];

const RIGHT_SHOULDER_IDX = [
  [960,928,896],
  [959,927,895],
  [958,926,894],
  [957,925,893],
  [956,924,892],
  [955,923,891],
];

const LEFT_ARM_IDX = [
  [832,864,1024,992,960,928,896],
  [831,863,1023,991,959,927,895],
  [830,862,1022,990,958,926,894],
  [829,861,1021,989,957,925,893],
  [828,860,1020,988,956,924,892],
  [827,859,1019,987,955,923,891],
];

const LEFT_SHOULDER_IDX = [
  [885,917,949],
  [886,918,950],
  [887,919,951],
  [888,920,952],
  [889,921,953],
  [890,922,954],
];

const BACK_PANTS_LEFT_IDX = [
  [197,196,195,194,193],
  [165,164,163,162,161],
  [133,132,131,130,129],
  [101,100,99,98,97],
  [229,228,227,226,225],
  [261,260,259,258,257],
  [293,292,291,290,289],
  [325,324,323,322,321],
];

const BACK_PANTS_RIGHT_IDX = [
  [495,494,493,492,491],
  [527,526,525,524,523],
  [559,558,557,556,555],
  [591,590,589,588,587],
  [463,462,461,460,459],
  [431,430,429,428,427],
  [399,398,397,396,395],
  [367,366,365,364,363],
];

const FRONT_PANTS_LEFT_IDX = [
  [468,467,466,465,464],
  [500,499,498,497,496],
  [532,531,530,529,528],
  [564,563,562,561,560],
  [596,595,594,593,592],
  [436,435,434,433,432],
  [404,403,402,401,400],
  [372,371,370,369,368],
];

const FRONT_PANTS_RIGHT_IDX = [
  [202,201,200,199,198],
  [170,169,168,167,166],
  [138,137,136,135,134],
  [106,105,104,103,102],
  [234,233,232,231,230],
  [266,265,264,263,262],
  [298,297,296,295,294],
  [330,329,328,327,326],
];

// ─── UV Canvas 各部位坐标（1024×1024，基于 64×64 网格，每格 16px）─────────────
const UV_REGIONS = {
  back:            { x: 448, y: 368, w: 96,  h: 112 },
  chest:           { x: 448, y: 528, w: 96,  h: 160 },
  rightArm:        { x: 256, y: 480, w: 80,  h: 48  },
  rightShoulder:   { x: 368, y: 496, w: 16,  h: 32  },
  leftArm:         { x: 640, y: 480, w: 96,  h: 48  },
  leftShoulder:    { x: 608, y: 496, w: 16,  h: 32  },
  backPantsLeft:   { x: 416, y: 32,  w: 48,  h: 272 },
  backPantsRight:  { x: 544, y: 32,  w: 64,  h: 272 },
  frontPantsLeft:  { x: 416, y: 736, w: 64,  h: 272 },
  frontPantsRight: { x: 528, y: 736, w: 64,  h: 272 },
};

// ─── 从 wsPointData 按索引矩阵提取一维数组 ────────────────────────────────────
function extractByIndex(wsPointData, idxMatrix) {
  const rows = idxMatrix.length;
  const cols = idxMatrix[0].length;
  const result = new Array(rows * cols).fill(0);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = idxMatrix[r][c] - 1;
      result[r * cols + c] = (wsPointData && idx >= 0 && idx < wsPointData.length)
        ? wsPointData[idx]
        : 0;
    }
  }
  return result;
}

// ─── 全局传感器数据（参考 hand.jsx 的 ndata1）────────────────────────────────
var ndata1 = new Array(1024).fill(0);

const HumanBodyCanvas = React.forwardRef((props, refs) => {
  // ─── Refs（完全参考 hand.jsx）────────────────────────────────────────────────
  const bodyCanvasRef = useRef();    // UV Canvas（1024×1024，贴到模型）
  const bodyCanvas = useRef();       // THREE.CanvasTexture

  // 各部位 HeatmapCanvas（参考 hand.jsx 的 handHeatmapRef / handHeatmap1Ref）
  const hmBack           = useRef();
  const hmChest          = useRef();
  const hmRightArm       = useRef();
  const hmRightShoulder  = useRef();
  const hmLeftArm        = useRef();
  const hmLeftShoulder   = useRef();
  const hmBackPantsLeft  = useRef();
  const hmBackPantsRight = useRef();
  const hmFrontPantsLeft = useRef();
  const hmFrontPantsRight = useRef();

  // 背景灰色 Canvas（参考 hand.jsx 的 canvasWith）
  const canvasWith = document.createElement('canvas');
  const ctxWith = canvasWith.getContext('2d');
  ctxWith.fillStyle = '#aaaaaa';
  ctxWith.fillRect(0, 0, canvasWith.width, canvasWith.height);

  var FPS = 10;
  var timeS = 0;
  var renderT = 1 / FPS;
  const clock = new THREE.Clock();

  let camera, scene, renderer, controls, animationRequestId;
  let chair;
  const lightGroup = new THREE.Group();
  let controlsFlag = true;
  var valuef1 = 0;

  const ALT_KEY = 18;
  const CTRL_KEY = 17;
  const CMD_KEY = 91;

  // ─── init（完全参考 hand.jsx）────────────────────────────────────────────────
  function init() {
    const container = document.getElementById('canvasHumanBody');

    // Camera
    camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 150000);
    camera.position.z = -10;
    camera.position.y = 30;
    camera.position.x = 0;
    camera.lookAt(0, 0, 0);

    // Scene
    scene = new THREE.Scene();
    scene.add(lightGroup);

    // Lights（完全参考 hand.jsx）
    const coordinates = [80, 0, -80];
    for (let x of coordinates) {
      for (let y of coordinates) {
        for (let z of coordinates) {
          const pointlight = new THREE.PointLight(0xffffff, 1, 600);
          pointlight.position.set(x, y, z);
          lightGroup.add(pointlight);
        }
      }
    }

    // 初始化各部位 HeatmapCanvas（参考 hand.jsx 的 handHeatmapRef = new HeatmapCanvas(30,30,1,1,'body',{...})）
    const hmOpts = { min: 0, max: 3000, size: 40 };
    hmBack.current           = new HeatmapCanvas(30, 30, 1, 1, 'hand', { ...hmOpts });
    hmChest.current          = new HeatmapCanvas(30, 30, 1, 1, 'hand', { ...hmOpts });
    hmRightArm.current       = new HeatmapCanvas(30, 30, 1, 1, 'hand', { ...hmOpts });
    hmRightShoulder.current  = new HeatmapCanvas(30, 30, 1, 1, 'hand', { ...hmOpts });
    hmLeftArm.current        = new HeatmapCanvas(30, 30, 1, 1, 'hand', { ...hmOpts });
    hmLeftShoulder.current   = new HeatmapCanvas(30, 30, 1, 1, 'hand', { ...hmOpts });
    hmBackPantsLeft.current  = new HeatmapCanvas(30, 30, 1, 1, 'hand', { ...hmOpts });
    hmBackPantsRight.current = new HeatmapCanvas(30, 30, 1, 1, 'hand', { ...hmOpts });
    hmFrontPantsLeft.current = new HeatmapCanvas(30, 30, 1, 1, 'hand', { ...hmOpts });
    hmFrontPantsRight.current = new HeatmapCanvas(30, 30, 1, 1, 'hand', { ...hmOpts });

    // 加载 human.glb（参考 hand.jsx 的 GLTFLoader + addCanvas）
    const loader = new GLTFLoader();
    loader.load('./model/human.glb', function (gltf) {
      chair = gltf.scene;
      scene.add(chair);
      chair.rotation.z = -Math.PI;

      // 创建 UV Canvas（1024×1024）并绑定为模型贴图
      bodyCanvasRef.current = new HeatmapCanvas(30, 30, 1, 1, 'hand', { min: 0, max: 3000, size: 40 });
      bodyCanvasRef.current.canvas.width = 1024;
      bodyCanvasRef.current.canvas.height = 1024;

      addCanvas(chair, bodyCanvasRef.current.canvas);
    });

    // Grid helper
    const helper = new THREE.GridHelper(2000, 100);
    helper.position.y = -199;
    helper.material.opacity = 0.25;
    helper.material.transparent = true;
    scene.add(helper);

    // Renderer（完全参考 hand.jsx）
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.setClearColor(0x10152b);
    if (container.childNodes.length === 0) {
      container.appendChild(renderer.domElement);
    }

    // Controls（完全参考 hand.jsx）
    controls = new TrackballControls(camera, renderer.domElement);
    controls.dynamicDampingFactor = 1;
    controls.domElement = container;
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.PAN,
      MIDDLE: THREE.MOUSE.ZOOM,
      RIGHT: THREE.MOUSE.ROTATE,
    };
  }

  // ─── addCanvas（完全参考 hand.jsx）──────────────────────────────────────────
  function addCanvas(model, canvas) {
    bodyCanvas.current = new THREE.CanvasTexture(canvas);
    bodyCanvas.current.needsUpdate = true;
    bodyCanvas.current.repeat.set(1, 1);
    bodyCanvas.current.premultiplyAlpha = false;
    bodyCanvas.current.encoding = THREE.sRGBEncoding;
    bodyCanvas.current.wrapS = THREE.RepeatWrapping;
    bodyCanvas.current.wrapT = THREE.RepeatWrapping;

    model.traverse((child) => {
      if (child.isMesh) {
        if (Array.isArray(child.material)) {
          child.material.forEach((mat) => {
            mat.map = bodyCanvas.current;
            mat.needsUpdate = true;
          });
        } else {
          child.material.map = bodyCanvas.current;
          child.material.needsUpdate = true;
        }
      }
    });
  }

  // ─── canvasRenew（完全参考 hand.jsx，多部位版本）────────────────────────────
  function canvasRenew(CanvasTexture, canvas) {
    if (canvas) {
      const ctx = canvas.getContext('2d');
      const size = 1024;

      // 清除并填充背景（参考 hand.jsx 的 ctx.drawImage(canvasWith, ...)）
      ctx.drawImage(canvasWith, 0, 0, size, size);

      // 各部位：提取数据 → 更新热力图 → drawImage 到 UV Canvas 对应区域
      const parts = [
        { hm: hmBack.current,            idx: BACK_IDX,             region: UV_REGIONS.back },
        { hm: hmChest.current,           idx: CHEST_IDX,            region: UV_REGIONS.chest },
        { hm: hmRightArm.current,        idx: RIGHT_ARM_IDX,        region: UV_REGIONS.rightArm },
        { hm: hmRightShoulder.current,   idx: RIGHT_SHOULDER_IDX,   region: UV_REGIONS.rightShoulder },
        { hm: hmLeftArm.current,         idx: LEFT_ARM_IDX,         region: UV_REGIONS.leftArm },
        { hm: hmLeftShoulder.current,    idx: LEFT_SHOULDER_IDX,    region: UV_REGIONS.leftShoulder },
        { hm: hmBackPantsLeft.current,   idx: BACK_PANTS_LEFT_IDX,  region: UV_REGIONS.backPantsLeft },
        { hm: hmBackPantsRight.current,  idx: BACK_PANTS_RIGHT_IDX, region: UV_REGIONS.backPantsRight },
        { hm: hmFrontPantsLeft.current,  idx: FRONT_PANTS_LEFT_IDX, region: UV_REGIONS.frontPantsLeft },
        { hm: hmFrontPantsRight.current, idx: FRONT_PANTS_RIGHT_IDX,region: UV_REGIONS.frontPantsRight },
      ];

      for (const part of parts) {
        if (!part.hm) continue;
        // 提取该部位数据
        const data = extractByIndex(ndata1, part.idx);
        // 更新热力图（参考 hand.jsx 的 handHeatmapRef.current.changeHeatmap(ndata1, 1, 1, 0)）
        part.hm.changeHeatmap(data, 1, 1, 0);
        // 绘制到 UV Canvas 对应区域（参考 hand.jsx 的 ctx.drawImage(handHeatmapRef.current.canvas, ...)）
        ctx.drawImage(
          part.hm.canvas,
          0, 0, part.hm.canvas.width, part.hm.canvas.height,
          part.region.x, part.region.y, part.region.w, part.region.h
        );
      }
    }

    if (CanvasTexture) {
      CanvasTexture.needsUpdate = true;
    }
  }

  // ─── animate / render（完全参考 hand.jsx）────────────────────────────────────
  function animate() {
    animationRequestId = requestAnimationFrame(animate);
    render();
  }

  function render() {
    const T = clock.getDelta();
    timeS += T;
    if (timeS > renderT) {
      // 参考 hand.jsx: canvasRenew(bodyCanvas.current, bodyCanvasRef.current?.canvas)
      canvasRenew(bodyCanvas.current, bodyCanvasRef.current?.canvas);
      timeS = 0;
    }
    TWEEN.update();
    if (controlsFlag) {
      controls.mouseButtons = {
        LEFT: THREE.MOUSE.PAN,
        MIDDLE: THREE.MOUSE.ZOOM,
        RIGHT: THREE.MOUSE.ROTATE,
      };
      controls.keys = [ALT_KEY, CTRL_KEY, CMD_KEY];
      controls.update();
    } else {
      controls.keys = [];
      controls.mouseButtons = [];
    }
    renderer.render(scene, camera);
  }

  // ─── sitData（完全参考 hand.jsx）────────────────────────────────────────────
  function sitData(prop) {
    const { wsPointData, valuef, valuelInit } = prop;
    if (valuef !== undefined) valuef1 = valuef;
    if (wsPointData) {
      ndata1 = wsPointData;
      // 去除底噪（参考 hand.jsx: ndata1 = ndata1.map((a, index) => (a - valuef1 < 0 ? 0 : a))）
      ndata1 = ndata1.map((a) => (a - valuef1 < 0 ? 0 : a));
    }
  }

  function changeColor({ max, size, light }) {
    const hms = [
      hmBack, hmChest, hmRightArm, hmRightShoulder,
      hmLeftArm, hmLeftShoulder, hmBackPantsLeft,
      hmBackPantsRight, hmFrontPantsLeft, hmFrontPantsRight,
    ];
    hms.forEach((ref) => {
      if (!ref.current) return;
      if (max !== undefined) ref.current.options.max = max;
      if (size !== undefined) ref.current.options.size = size;
    });
    if (light !== undefined) {
      lightGroup.children.forEach((l) => { l.intensity = light; });
    }
  }

  function changeFlag(value) {
    controlsFlag = value;
  }

  // ─── useImperativeHandle（完全参考 hand.jsx）────────────────────────────────
  useImperativeHandle(refs, () => ({
    sitData,
    changeColor,
    changeFlag,
  }));

  // ─── useEffect（完全参考 hand.jsx）──────────────────────────────────────────
  useEffect(() => {
    window.removeEventListener('keydown', function () {});
    window.removeEventListener('keyup', function () {});
    init();
    animate();
    return () => {
      if (animationRequestId) cancelAnimationFrame(animationRequestId);
    };
  }, []);

  return (
    <div>
      <div
        style={{ width: '100%', height: '100%' }}
        id="canvasHumanBody"
      />
    </div>
  );
});

export default HumanBodyCanvas;
