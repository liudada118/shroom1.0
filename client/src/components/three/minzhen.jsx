import Stats from "three/examples/jsm/libs/stats.module.js";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
// import { FlyControls } from 'three/examples/jsm/controls/FlyControls.js';
import { TrackballControls } from "three/examples/jsm/controls/TrackballControls";
// import { SelectionBox } from 'three/addons/interactive/SelectionBox.js';
// import { SelectionHelper } from 'three/addons/interactive/SelectionHelper.js';
import { SelectionHelper } from "./SelectionHelper";
import React, { useEffect, useImperativeHandle, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { TextureLoader } from "three";
import TWEEN from "@tweenjs/tween.js";
import { checkRectIndex, checkRectangleIntersection, getPointCoordinate, getPointCoordinateback } from "./threeUtil1";
import {
  addSide,
  findMax,
  gaussBlur_1,
  interp,
  interp1016,
  jet,
  jetgGrey,
} from "../../assets/util/util";
// import { withData } from "./WithData";

import { obj } from "../../assets/util/config";
import { DUAL_CHANNEL_DEFAULTS, createThresholdState } from '../../runtime/displayThresholds';
let group = new THREE.Group();
const sitInit = 0;
const backInit = 0;
var animationRequestId
const sitnum1 = 32;
const sitnum2 = 32;
const sitInterp = 2;
const sitOrder = 4;
const backnum1 = 16;
const backnum2 = 32;
const backInterp = 2;
const backOrder = 4;
let controlsFlag = true;
var ndata = new Array(backnum1 * backnum2).fill(0), ndata1 = new Array(sitnum1 * sitnum2).fill(0);

var { valuej1, valueg1, value1, valuel1, valuef1, valuej2, valueg2, value2, valuel2, valuef2,
  valuelInit1, valuelInit2 } = createThresholdState(DUAL_CHANNEL_DEFAULTS);
let enableControls = true;
let isShiftPressed = false;

let timer

function debounce(fn, time) {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    fn()
  }, time);
}

var FPS = 10;
var timeS = 0;
var renderT = 1 / FPS;
let totalArr = [],
  totalPointArr = [];
let local
let camera
let particles,
  particles1,
  material,
  backGeometry,
  sitGeometry
let controls;
const MINZHEN_POINT_TRANSFORM_STORAGE_KEY = "minzhenPointTransformV4";
const MINZHEN_POINT_TRANSFORM_DEFAULT = {
  groupX: 3,
  groupY: 97,
  groupZ: 92,
  pointX: -1,
  pointY: -38,
  pointZ: 12,
  scaleX: 0.0054,
  scaleY: 0.0029,
  scaleZ: 0.0054,
  pointSize: 0.77,
};
const MINZHEN_POINT_TRANSFORM_RANGES = {
  groupX: { min: -300, max: 300, step: 1 },
  groupY: { min: -100, max: 400, step: 1 },
  groupZ: { min: -100, max: 500, step: 1 },
  pointX: { min: -200, max: 200, step: 1 },
  pointY: { min: -200, max: 200, step: 1 },
  pointZ: { min: -200, max: 200, step: 1 },
  scaleX: { min: 0.0001, max: 0.02, step: 0.0001 },
  scaleY: { min: 0.0001, max: 0.02, step: 0.0001 },
  scaleZ: { min: 0.0001, max: 0.02, step: 0.0001 },
  pointSize: { min: 0.01, max: 2, step: 0.01 },
};
const MINZHEN_ZERO_POINT_INDEXES = [384, 416];

const normalizeMinzhenPointTransform = (value) => {
  const next = { ...MINZHEN_POINT_TRANSFORM_DEFAULT };
  Object.keys(next).forEach((key) => {
    const numberValue = Number(value?.[key]);
    if (Number.isFinite(numberValue)) {
      next[key] = numberValue;
    }
  });
  return next;
};

const readMinzhenPointTransform = () => {
  try {
    const cachedValue = localStorage.getItem(MINZHEN_POINT_TRANSFORM_STORAGE_KEY);
    return normalizeMinzhenPointTransform(cachedValue ? JSON.parse(cachedValue) : {});
  } catch (error) {
    return { ...MINZHEN_POINT_TRANSFORM_DEFAULT };
  }
};

const normalizeMinzhenFrame = (data) => {
  let source = data;
  if (!Array.isArray(source)) {
    try {
      source = JSON.parse(source || "[]");
    } catch (error) {
      source = [];
    }
  }

  const frame = source.slice(0, sitnum1 * sitnum2).map((value) => {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : 0;
  });

  while (frame.length < sitnum1 * sitnum2) {
    frame.push(0);
  }

  MINZHEN_ZERO_POINT_INDEXES.forEach((index) => {
    frame[index] = 0;
  });

  return frame;
};

const Canvas = React.forwardRef((props, refs) => {
  local = props.local
  const { t } = useTranslation();
  const canvasId = useRef(`minzhen-canvas-${Math.random().toString(36).slice(2)}`);
  const [sensorInfo, setSensorInfo] = useState({});
  const [pointTransform, setPointTransform] = useState(readMinzhenPointTransform);
  const pointTransformRef = useRef(pointTransform);
  const actionAllPointTransformRef = useRef(pointTransform);
  const isSitActionViewRef = useRef(false);
  const chairVisibleRef = useRef(true);
  const pointTweenRef = useRef(null);
  const chairRef = useRef(null);
  var newDiv, newDiv1, selectStartArr = [], selectEndArr = [], sitArr, backArr, sitMatrix = [], backMatrix = [], selectMatrix = [], selectHelper = {}//new SelectionHelper(renderer, controls, 'selectBox');
  let sitIndexArr = [], sitIndexEndArr = [], backIndexArr = [], backIndexEndArr = []
  var animationRequestId, colSelectFlag = false
  let dataFlag = false;
  const changeDataFlag = () => {
    dataFlag = true;

  };

  const persistPointTransform = (nextTransform) => {
    try {
      localStorage.setItem(MINZHEN_POINT_TRANSFORM_STORAGE_KEY, JSON.stringify(nextTransform));
    } catch (error) {
      console.warn("[minzhen] failed to persist point transform", error);
    }
  };

  const applyPointTransform = (nextTransform = pointTransformRef.current) => {
    if (group) {
      group.position.set(nextTransform.groupX, nextTransform.groupY, nextTransform.groupZ);
    }

    if (particles) {
      particles.position.set(nextTransform.pointX, nextTransform.pointY, nextTransform.pointZ);
      particles.scale.set(nextTransform.scaleX, nextTransform.scaleY, nextTransform.scaleZ);
    }

    if (material) {
      material.size = nextTransform.pointSize;
      material.needsUpdate = true;
    }
  };

  const updatePointTransform = (key, rawValue) => {
    const value = Number(rawValue);
    if (!Number.isFinite(value)) return;

    const nextTransform = {
      ...pointTransformRef.current,
      [key]: value,
    };
    pointTransformRef.current = nextTransform;
    if (!isSitActionViewRef.current) {
      actionAllPointTransformRef.current = nextTransform;
    }
    setPointTransform(nextTransform);
    persistPointTransform(nextTransform);
    applyPointTransform(nextTransform);
  };

  const resetPointTransform = () => {
    const nextTransform = { ...MINZHEN_POINT_TRANSFORM_DEFAULT };
    pointTransformRef.current = nextTransform;
    actionAllPointTransformRef.current = nextTransform;
    isSitActionViewRef.current = false;
    setPointTransform(nextTransform);
    persistPointTransform(nextTransform);
    applyPointTransform(nextTransform);
  };

  const stopPanelPointer = (event) => {
    event.stopPropagation();
  };


  let bigArr1 = new Array(backnum1 * backInterp * backnum2 * backInterp).fill(1),
    bigArrg1 = new Array(
      (backnum1 * backInterp + 2 * backOrder) *
      (backnum2 * backInterp + 2 * backOrder)
    ).fill(1),
    bigArrg1new = new Array(
      (backnum1 * backInterp + 2 * backOrder) *
      (backnum2 * backInterp + 2 * backOrder)
    ).fill(1),
    smoothBig1 = new Array(
      (backnum1 * backInterp + 2 * backOrder) *
      (backnum2 * backInterp + 2 * backOrder)
    ).fill(1),
    ndata1Num,
    ndataNum;

  let bigArr = new Array(sitnum1 * sitInterp * sitnum2 * sitInterp).fill(1);
  let bigArrg = new Array(
    (sitnum1 * sitInterp + sitOrder * 2) *
    (sitnum2 * sitInterp + sitOrder * 2)
  ).fill(1),
    bigArrgnew = new Array(
      (sitnum1 * sitInterp + sitOrder * 2) *
      (sitnum2 * sitInterp + sitOrder * 2)
    ).fill(1),
    smoothBig = new Array(
      (sitnum1 * sitInterp + sitOrder * 2) *
      (sitnum2 * sitInterp + sitOrder * 2)
    ).fill(1);
  let i = 0;
  let ws,
    wsPointData,
    ws1


  let container, stats;

  let scene, renderer;

  let cube, chair, mixer, clips;
  const clock = new THREE.Clock();
  const ALT_KEY = 18;
  const CTRL_KEY = 17;
  const CMD_KEY = 91;
  const AMOUNTX = sitnum1 * sitInterp + sitOrder * 2;
  const AMOUNTY = sitnum2 * sitInterp + sitOrder * 2;
  const AMOUNTX1 = backnum1 * backInterp + backOrder * 2;
  const AMOUNTY1 = backnum2 * backInterp + backOrder * 2;
  const SEPARATION = 100;
  const getSitPointPosition = (ix, iy) => {
    const x = ix * SEPARATION - (AMOUNTX * SEPARATION) / 2;
    const z = iy * SEPARATION - (AMOUNTY * SEPARATION) / 2;
    return { x: z, z: x };
  };
  // let group = new THREE.Group();
  const groupX = pointTransformRef.current.groupX, groupY = pointTransformRef.current.groupY, groupZ = pointTransformRef.current.groupZ
  let positions1;
  let colors1, scales1;
  let positions;
  let colors, scales;

  function init() {
    container = document.getElementById(canvasId.current);
    // camera

    camera = new THREE.PerspectiveCamera(
      40,
      window.innerWidth / window.innerHeight,
      1,
      150000
    );


    camera.position.z = 300;
    camera.position.y = 200;
    //   camera.position.x = 200;

    // scene

    scene = new THREE.Scene();

    // model
    const loader = new GLTFLoader();

    // points  座椅

    const addChairModel = (model, sourceName) => {
      chair = model;
      chairRef.current = model;
      const box = new THREE.Box3().setFromObject(chair);
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxAxis = Math.max(size.x, size.y, size.z) || 1;
      const targetSize = sourceName === "minzhen" ? 140 : 120;
      const modelScale = targetSize / maxAxis;

      chair.scale.setScalar(modelScale);
      chair.rotation.y = Math.PI / 2;

      const scaledBox = new THREE.Box3().setFromObject(chair);
      const center = new THREE.Vector3();
      scaledBox.getCenter(center);
      chair.position.sub(center);
      chair.position.y -= 35;
      setChairVisible(chairVisibleRef.current);

      scene.add(group);
    };

    loader.load(
      "./model/minzhen/chair.gltf",
      function (gltf) {
        addChairModel(gltf.scene, "minzhen");
      },
      undefined,
      function (error) {
        console.warn("[minzhen] chair.gltf load failed. Check referenced .bin/textures in model/minzhen.", error);
        loader.load("./model/chair3.glb", function (gltf) {
          addChairModel(gltf.scene, "fallback");
        });
      }
    );

    initSet();
    // initBack();
    // scene.add(group);
    // group.rotation.x = -(Math.PI * 2) / 12
    applyPointTransform(pointTransformRef.current);
    scene.add(group);
    const helper = new THREE.GridHelper(2000, 100);
    helper.position.y = -199;
    helper.material.opacity = 0.25;
    helper.material.transparent = true;
    scene.add(helper);

    // lights
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444);
    hemiLight.position.set(0, 200, 0);
    scene.add(hemiLight);
    const dirLight = new THREE.DirectionalLight(0xffffff);
    dirLight.position.set(0, 200, 10);
    scene.add(dirLight);
    const dirLight1 = new THREE.DirectionalLight(0xffffff);
    dirLight1.position.set(0, 10, 200);
    scene.add(dirLight1);

    // renderer

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    // renderer.setSize(window.innerWidth, window.innerHeight);

    renderer.setSize(window.innerWidth, window.innerHeight);

    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.domElement.style.position = "absolute";
    renderer.domElement.style.inset = "0";
    renderer.domElement.style.zIndex = "0";
    if (container.childNodes.length == 0) {
      container.appendChild(renderer.domElement);
    }

    renderer.setClearColor(0x000000);

    //FlyControls
    controls = new TrackballControls(camera, renderer.domElement);
    controls.dynamicDampingFactor = 0.2;
    controls.domElement = container;
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.PAN, // make pan the default instead of rotate
      MIDDLE: THREE.MOUSE.ZOOM,
      RIGHT: THREE.MOUSE.ROTATE,
    };
    controls.keys = [
      ALT_KEY, // orbit
      CTRL_KEY, // zoom
      CMD_KEY, // pan
    ];

    window.addEventListener("resize", onWindowResize);

    selectHelper = new SelectionHelper(renderer, controls, 'selectBox');

    renderer.domElement.addEventListener('pointerdown', pointDown);

    renderer.domElement.addEventListener('pointermove', pointMove);

    renderer.domElement.addEventListener('pointerup', pointUp);

    document.addEventListener('keydown', (e) => {

      // if (e.key === 'Shift') {
      // 	this.isKey = true
      // 	if (this.element  ) {
      // 		if(this.shiftFlag < 1){
      // 			console.log('element')
      // 		this.shiftFlag ++
      // 		this.element.addEventListener('mousedown', this.elementDown)
      // 		}else{
      // 			this.shiftFlag = 2
      // 		}

      // 	}
      // }

      if (e.key === 'ArrowUp') {

        selectHelper.element.style.top = parseInt(selectHelper.element.style.top) - 1 + 'px'

        const elementLocal = selectHelper.element.getBoundingClientRect()
        const selectMatrix = [elementLocal.left, elementLocal.top, elementLocal.right, elementLocal.bottom]
        if (!controlsFlag) {
          const sitInterArr = checkRectangleIntersection(selectMatrix, sitMatrix)
          const backInterArr = checkRectangleIntersection(selectMatrix, backMatrix)

          if (sitInterArr) {
            sitIndexArr = checkRectIndex(sitMatrix, sitInterArr, AMOUNTX, AMOUNTY)
          }
          if (backInterArr) {
            backIndexArr = checkRectIndex(backMatrix, backInterArr, AMOUNTX1, AMOUNTY1)

          }
          debounce(props.changeSelect.bind(this, { sit: sitIndexArr, back: backIndexArr }), 500)
          // props.changeSelect({ sit: sitIndexArr, back: backIndexArr })

        }
      }

      if (e.key === 'ArrowDown') {
        selectHelper.element.style.top = parseInt(selectHelper.element.style.top) + 1 + 'px'

        const elementLocal = selectHelper.element.getBoundingClientRect()
        const selectMatrix = [elementLocal.left, elementLocal.top, elementLocal.right, elementLocal.bottom]
        if (!controlsFlag) {
          const sitInterArr = checkRectangleIntersection(selectMatrix, sitMatrix)
          const backInterArr = checkRectangleIntersection(selectMatrix, backMatrix)

          if (sitInterArr) {
            sitIndexArr = checkRectIndex(sitMatrix, sitInterArr, AMOUNTX, AMOUNTY)
          }
          if (backInterArr) {
            backIndexArr = checkRectIndex(backMatrix, backInterArr, AMOUNTX1, AMOUNTY1)

          }

          debounce(props.changeSelect.bind(this, { sit: sitIndexArr, back: backIndexArr }), 500)
          // props.changeSelect({ sit: sitIndexArr, back: backIndexArr })
        }
      }

      if (e.key === 'ArrowLeft') {
        selectHelper.element.style.left = parseInt(selectHelper.element.style.left) - 1 + 'px'

        const elementLocal = selectHelper.element.getBoundingClientRect()
        const selectMatrix = [elementLocal.left, elementLocal.top, elementLocal.right, elementLocal.bottom]
        if (!controlsFlag) {
          const sitInterArr = checkRectangleIntersection(selectMatrix, sitMatrix)
          const backInterArr = checkRectangleIntersection(selectMatrix, backMatrix)

          if (sitInterArr) {
            sitIndexArr = checkRectIndex(sitMatrix, sitInterArr, AMOUNTX, AMOUNTY)
          }
          if (backInterArr) {
            backIndexArr = checkRectIndex(backMatrix, backInterArr, AMOUNTX1, AMOUNTY1)

          }

          debounce(props.changeSelect.bind(this, { sit: sitIndexArr, back: backIndexArr }), 500)
          // props.changeSelect({ sit: sitIndexArr, back: backIndexArr })
        }
      }

      if (e.key === 'ArrowRight') {
        selectHelper.element.style.left = parseInt(selectHelper.element.style.left) + 1 + 'px'

        const elementLocal = selectHelper.element.getBoundingClientRect()
        const selectMatrix = [elementLocal.left, elementLocal.top, elementLocal.right, elementLocal.bottom]
        if (!controlsFlag) {
          const sitInterArr = checkRectangleIntersection(selectMatrix, sitMatrix)
          const backInterArr = checkRectangleIntersection(selectMatrix, backMatrix)

          if (sitInterArr) {
            sitIndexArr = checkRectIndex(sitMatrix, sitInterArr, AMOUNTX, AMOUNTY)
          }
          if (backInterArr) {
            backIndexArr = checkRectIndex(backMatrix, backInterArr, AMOUNTX1, AMOUNTY1)

          }

          debounce(props.changeSelect.bind(this, { sit: sitIndexArr, back: backIndexArr }), 500)
          // props.changeSelect({ sit: sitIndexArr, back: backIndexArr })
        }
      }

    })

  }

  function pointDown(event) {
    if (selectHelper.isShiftPressed) {
      sitIndexArr = []

      selectStartArr = [(event.clientX), event.clientY]

      sitArr = getPointCoordinate({ particles, camera, position: { x: groupX, y: groupY, z: groupZ } })


      sitMatrix = [sitArr[0].x, sitArr[0].y, sitArr[1].x, sitArr[1].y]

      colSelectFlag = true
    }
  }

  function pointMove(event) {
    if (selectHelper.isShiftPressed && colSelectFlag) {


      selectEndArr = [(event.clientX), event.clientY,]



      selectMatrix = [...selectStartArr, ...selectEndArr]


      const width = Math.abs(Math.round(selectEndArr[0] - selectStartArr[0]))
      const height = Math.abs(Math.round(selectEndArr[1] - selectStartArr[1]))
      if (selectStartArr[0] > selectEndArr[0]) {
        // selectMatrix = [...selectEndArr , ...selectStartArr]
        selectMatrix[0] = selectEndArr[0]
        selectMatrix[2] = selectStartArr[0]
      } else {
        selectMatrix[0] = selectStartArr[0]
        selectMatrix[2] = selectEndArr[0]
      }

      if (selectStartArr[1] > selectEndArr[1]) {
        selectMatrix[1] = selectEndArr[1]
        selectMatrix[3] = selectStartArr[1]
      } else {
        selectMatrix[1] = selectStartArr[1]
        selectMatrix[3] = selectEndArr[1]
      }


      if (!controlsFlag) {
        const sitInterArr = checkRectangleIntersection(selectMatrix, sitMatrix)
        const backInterArr = checkRectangleIntersection(selectMatrix, backMatrix)

        if (sitInterArr) {
          sitIndexArr = checkRectIndex(sitMatrix, sitInterArr, AMOUNTX, AMOUNTY)
          // if((sitIndexArr[3] - sitIndexArr[1] < 2)&&(sitIndexArr[2] - sitIndexArr[0] < 2) ){
          //   sitIndexArr = new Array(4).fill(0)
          // }
          sitIndexEndArr = [...sitIndexArr]

        }
        if (backInterArr) {
          backIndexArr = checkRectIndex(backMatrix, backInterArr, AMOUNTX1, AMOUNTY1)
          // if((backIndexArr[3] - backIndexArr[1] < 2)&&(backIndexArr[2] - backIndexArr[0] < 2) ){
          //   backIndexArr = new Array(4).fill(0)
          // }
          backIndexEndArr = [...backIndexArr]

        }
        // console.log(backIndexArr)

        props.changeStateData({ width: width, height: height })

      }

    }
  }



  function pointUp(event) {
    // console.log(sitIndexEndArr , backIndexEndArr , backIndexArr)



    if (selectHelper.isShiftPressed) {
      props.changeSelect({ sit: sitIndexEndArr, back: backIndexEndArr })
      selectStartArr = []
      selectEndArr = []
      colSelectFlag = false
    }
  }


  //   初始化座椅
  function initSet() {
    const numParticles = AMOUNTX * AMOUNTY;
    positions = new Float32Array(numParticles * 3);
    scales = new Float32Array(numParticles);
    colors = new Float32Array(numParticles * 3);
    let i = 0,
      j = 0;

    for (let ix = 0; ix < AMOUNTX; ix++) {
      for (let iy = 0; iy < AMOUNTY; iy++) {
        const pointPosition = getSitPointPosition(ix, iy);
        positions[i] = pointPosition.x; // x
        positions[i + 1] = 0; // y
        positions[i + 2] = pointPosition.z; // z

        scales[j] = 1;
        colors[i] = 0 / 255;
        colors[i + 1] = 0 / 255;
        colors[i + 2] = 255 / 255;
        i += 3;
        j++;
      }
    }

    sitGeometry = new THREE.BufferGeometry();
    sitGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3)
    );
    function getTexture() {
      return new TextureLoader().load("");
    }
    // require("../../assets/images/circle.png")
    const spite = new THREE.TextureLoader().load("./circle.png");
    material = new THREE.PointsMaterial({
      vertexColors: true,
      transparent: true,
      //   color: 0xffffff,
      map: spite,
      size: pointTransformRef.current.pointSize,
    });
    sitGeometry.setAttribute("scale", new THREE.BufferAttribute(scales, 1));
    sitGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    particles = new THREE.Points(sitGeometry, material);

    particles.scale.set(
      pointTransformRef.current.scaleX,
      pointTransformRef.current.scaleY,
      pointTransformRef.current.scaleZ
    );

    particles.position.set(
      pointTransformRef.current.pointX,
      pointTransformRef.current.pointY,
      pointTransformRef.current.pointZ
    );
    particles.rotation.x = 0//Math.PI / 3;
    // particles.rotation.y = 0; //-Math.PI / 2;
    // particles.rotation.y = Math.PI 
    // particles.rotation.z = Math.PI
    // scene.add(particles);
    group.add(particles);

  }

  function onWindowResize() {
    renderer.setSize(window.innerWidth, window.innerHeight);

    camera.aspect = window.innerWidth / window.innerHeight;

    // camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }

  //模型动画

  function animate() {
    animationRequestId = requestAnimationFrame(animate);
    const date = new Date().getTime();
    render();
  }

  function movePointCloud(position, time) {
    if (!particles) return { start: () => {} };
    if (pointTweenRef.current) {
      pointTweenRef.current.stop();
      pointTweenRef.current = null;
    }

    const p1 = {
      x: particles.position.x,
      y: particles.position.y,
      z: particles.position.z,
      rotationx: particles.rotation.x,
      rotationy: particles.rotation.y,
      rotationz: particles.rotation.z,
      scalex: particles.scale.x,
      scaley: particles.scale.y,
      scalez: particles.scale.z,
    };

    const tween = new TWEEN.Tween(p1)
      .to(position, time)
      .easing(TWEEN.Easing.Quadratic.InOut);
    pointTweenRef.current = tween;

    tween.onUpdate(() => {
      particles.position.set(p1.x, p1.y, p1.z);
      particles.rotation.x = p1.rotationx;
      particles.rotation.y = p1.rotationy;
      particles.rotation.z = p1.rotationz;
      particles.scale.set(p1.scalex, p1.scaley, p1.scalez);
    });

    return tween;
  }

  function setChairVisible(visible) {
    chairVisibleRef.current = visible;
    const nextChair = chairRef.current;
    if (!nextChair) return;

    if (visible && nextChair.parent !== group) {
      group.add(nextChair);
    } else if (!visible && nextChair.parent) {
      nextChair.parent.remove(nextChair);
    }

    nextChair.visible = visible;
    nextChair.traverse((child) => {
      child.visible = visible;
    });
  }

  function actionSit() {
    if (!particles) return;
    controls?.reset?.();
    controlsFlag = true;
    isSitActionViewRef.current = true;
    particles.visible = true;
    setChairVisible(false);

    if (!actionAllPointTransformRef.current || pointTransformRef.current.pointX !== 2 || pointTransformRef.current.pointY !== 61 || pointTransformRef.current.pointZ !== 147) {
      actionAllPointTransformRef.current = pointTransformRef.current;
    }
    const transform = actionAllPointTransformRef.current;
    const sitTransform = {
      ...transform,
      pointX: 2,
      pointY: 61,
      pointZ: 147,
    };
    const tween = movePointCloud(
      {
        x: sitTransform.pointX,
        y: sitTransform.pointY,
        z: sitTransform.pointZ,
        rotationx: Math.PI / 3,
        rotationy: 0,
        rotationz: 0,
        scalex: transform.scaleX,
        scaley: transform.scaleY,
        scalez: transform.scaleZ,
      },
      1000
    );
    tween.onComplete(() => {
      pointTweenRef.current = null;
      pointTransformRef.current = sitTransform;
      setPointTransform(sitTransform);
    });
    tween.start();
  }

  function actionAll() {
    controls?.reset?.();
    controlsFlag = true;
    isSitActionViewRef.current = false;
    setChairVisible(true);
    if (!particles) return;
    particles.visible = true;

    const transform = actionAllPointTransformRef.current;
    const tween = movePointCloud(
      {
        x: transform.pointX,
        y: transform.pointY,
        z: transform.pointZ,
        rotationx: 0,
        rotationy: 0,
        rotationz: 0,
        scalex: transform.scaleX,
        scaley: transform.scaleY,
        scalez: transform.scaleZ,
      },
      1000
    );
    tween.onComplete(() => {
      pointTweenRef.current = null;
      pointTransformRef.current = transform;
      setChairVisible(true);
      setPointTransform(transform);
    });
    tween.start();
  }


  function changeSelectFlag(value, flag) {
    controlsFlag = value
    selectHelper.isShiftPressed = !value
    if (value) {
      selectHelper.onSelectOver()
      if (flag)
        props.changeSelect({ sit: [0, 72, 0, 72] })
    }
  }


  //  更新靠背数据
  // function backRenew() {

  //   // valueg2 = 2
  //   // valuej2 = 500 
  //   // value2 =2
  //   interp1016(ndata, bigArr1, backnum1, backnum2, backInterp);
  //   //高斯滤波

  //   let bigarr1 = [];

  //   bigarr1 = addSide(
  //     bigArr1,
  //     backnum2 * backInterp,
  //     backnum1 * backInterp,
  //     backOrder,
  //     backOrder
  //   );

  //   gaussBlur_1(
  //     bigarr1,
  //     bigArrg1,
  //     backnum2 * backInterp + 2 * backOrder,
  //     backnum1 * backInterp + 2 * backOrder,
  //     valueg2
  //   );

  //   let k = 0,
  //     l = 0;
  //   // console.log(bigArrg1.filter((a) => a==1).length)
  //   // console.log(positions1,)
  //   for (let ix = 0; ix < AMOUNTX1; ix++) {
  //     for (let iy = 0; iy < AMOUNTY1; iy++) {
  //       const value = bigArrg1[l] * 10;

  //       //柔化处理smooth
  //       smoothBig1[l] = smoothBig1[l] + (value - smoothBig1[l] + 0.5) / valuel2;

  //       positions1[k + 1] = smoothBig1[l] / value2; // y
  //       const rgb = jet(0, valuej2, smoothBig1[l]);
  //       // console.log(rgb)
  //       colors1[k] = rgb[0] / 255;
  //       colors1[k + 1] = rgb[1] / 255;
  //       colors1[k + 2] = rgb[2] / 255;
  //       k += 3;
  //       l++;
  //     }
  //   }

  //   particles1.geometry.attributes.position.needsUpdate = true;
  //   particles1.geometry.attributes.color.needsUpdate = true;

  //   backGeometry.setAttribute(
  //     "position",
  //     new THREE.BufferAttribute(positions1, 3)
  //   );
  //   backGeometry.setAttribute("color", new THREE.BufferAttribute(colors1, 3));
  // }

  //  更新座椅数据
  function sitRenew() {
    // console.log(props)
    // valueg1 = 2
    // valuej1 = 500 
    // value1 =2
    interp(ndata1, bigArr, sitnum1, sitInterp);
    // console.log(first)
    let bigArrs = addSide(
      bigArr,
      sitnum2 * sitInterp,
      sitnum1 * sitInterp,
      sitOrder,
      sitOrder
    );

    gaussBlur_1(
      bigArrs,
      bigArrg,
      sitnum2 * sitInterp + sitOrder * 2,
      sitnum1 * sitInterp + sitOrder * 2,
      valueg1
    );

    let k = 0,
      l = 0;
    let dataArr = []
    for (let ix = 0; ix < AMOUNTX; ix++) {
      for (let iy = 0; iy < AMOUNTY; iy++) {
        const value = bigArrg[l] * 10;
        const pointPosition = getSitPointPosition(ix, iy);

        //柔化处理smooth
        smoothBig[l] = smoothBig[l] + (value - smoothBig[l] + 0.5) / valuel1;

        positions[k] = pointPosition.x; // x
        positions[k + 1] = smoothBig[l] * value1; // y
        positions[k + 2] = pointPosition.z; // z

        let rgb

        if (sitIndexArr && !sitIndexArr.every((a) => a == 0)) {

          if (ix >= sitIndexArr[0] && ix < sitIndexArr[1] && iy >= sitIndexArr[2] && iy < sitIndexArr[3]) {
            // rgb = [255, 0, 0];
            rgb = jet(0, valuej1, smoothBig[l]);
            // scales1[l] = 2;
            // positions1[k + 1] = smoothBig[l] / value2 - 1000
            dataArr.push(bigArrg[l])
          } else {
            rgb = jetgGrey(0, valuej1, smoothBig[l]);
            // scales1[l] = 1;
          }
        } else {
          rgb = jet(0, valuej1, smoothBig[l]);
          // scales1[l] = 1;
        }

        colors[k] = rgb[0] / 255;
        colors[k + 1] = rgb[1] / 255;
        colors[k + 2] = rgb[2] / 255;

        k += 3;
        l++;
      }
    }


    if (!sitIndexArr.length || sitIndexArr.every((a) => a == 0)) {
      dataArr = bigArrg
    }


    var T = clock.getDelta();
    timeS = timeS + T;
    if (timeS > renderT) {
      timeS = 0;
    }

    particles.geometry.attributes.position.needsUpdate = true;
    particles.geometry.attributes.color.needsUpdate = true;

    sitGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3)
    );
    sitGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  }

  function render() {
    
    sitRenew();
    TWEEN.update();
    if (controlsFlag) {
      controls.mouseButtons = {
        LEFT: THREE.MOUSE.PAN, // make pan the default instead of rotate
        MIDDLE: THREE.MOUSE.ZOOM,
        RIGHT: THREE.MOUSE.ROTATE,
      };
      controls.keys = [
        ALT_KEY, // orbit
        CTRL_KEY, // zoom
        CMD_KEY, // pan
      ];
      controls.update();

    } else if (!controlsFlag) {

      controls.keys = [];
      controls.mouseButtons = [];

    }

    renderer.render(scene, camera);
  }

  //   靠背数据
  function backData(prop) {
    const {
      wsPointData: wsPointData,
      valuej,
      valueg,
      value,
      valuel,
      valuef,
      valuelInit,
    } = prop;
    // valuej2 = valuej;
    // valueg2 = valueg;
    // value2 = value;
    // valuel2 = valuel;
    // valuef2 = valuef;
    // valuelInit2 = valuelInit;
    //处理空数组
    // console.log(ndata)
    ndata = wsPointData

    // 修改线序 坐垫
    ndataNum = ndata.reduce((a, b) => a + b, 0);
    ndata = ndata.map((a, index) => (a - valuef2 < 0 ? 0 : a - valuef2));

    // if (ndataNum < valuelInit) {
    //   ndata = new Array(120).fill(1);
    // }
  }
  function backValue(prop) {
    const { valuej, valueg, value, valuel, valuef, valuelInit } = prop;
    if (valuej) valuej2 = valuej;
    if (valueg) valueg2 = valueg;
    if (value) value2 = value;
    if (valuel) valuel2 = valuel;
    if (valuef) valuef2 = valuef;

    if (valuelInit) valuelInit2 = valuelInit;
    ndata = ndata.map((a, index) => (a - valuef2 < 0 ? 0 : a - valuef2));
    ndataNum = ndata.reduce((a, b) => a + b, 0);
    // if (ndataNum < valuelInit2) {
    //   ndata = new Array(120).fill(1);
    // }
  }
  // 座椅数据
  function sitValue(prop) {
    // console.log(prop)
    const { valuej, valueg, value, valuel, valuef, valuelInit } = prop;
    if (valuej) valuej1 = valuej;
    if (valueg) valueg1 = valueg;
    if (value) value1 = value;
    if (valuel) valuel1 = valuel;
    if (valuef) valuef1 = valuef;
    if (valuelInit) valuelInit1 = valuelInit;
    ndata1 = ndata1.map((a, index) => (a - valuef1 < 0 ? 0 : a - valuef1));

    ndata1Num = ndata1.reduce((a, b) => a + b, 0);
    if (ndata1Num < valuelInit1) {
      ndata1 = new Array(sitnum1 * sitnum2).fill(0);
    }
  }
  function sitData(prop, local) {

    if (i < 50) {
      i++;
    } else {
      i = 0;
    }
    local = local
    const {
      wsPointData: wsPointData,
      valuej,
      valueg,
      value,
      valuel,
      valuef,
      valuelInit,
    } = prop;
    // console.log(wsPointData )
    //   valueg,
    //   value,
    //   valuel,
    //   valuef,
    //   valuelInit,)
    if (valuej) valuej1 = valuej;
    if (valueg) valueg1 = valueg;
    if (value) value1 = value;
    if (valuel) valuel1 = valuel;
    if (valuef !== undefined) valuef1 = valuef;
    if (valuelInit !== undefined) valuelInit1 = valuelInit;
    // ndata1 = [];
    ndata1 = normalizeMinzhenFrame(wsPointData);

    // valuelInit1 = valuelInit;
    // 修改线序 坐垫
    const filterValue = Number(valuef1);
    ndata1 = ndata1.map((a) => {
      const nextValue = a - (Number.isFinite(filterValue) ? filterValue : 0);
      return nextValue < 0 ? 0 : nextValue;
    });

    ndata1Num = ndata1.reduce((a, b) => a + b, 0);

    const initThreshold = Number(valuelInit1);
    if (Number.isFinite(initThreshold) && initThreshold > 0 && ndata1Num < initThreshold) {
      ndata1 = new Array(sitnum1 * sitnum2).fill(0);
    }
    // console.log(ndata1)
  }

  function changeGroupRotate(obj) {
    // Minzhen seat animation is controlled by actionSit/actionAll.
  }

  function sensorData(data) {
    const nextInfo = data?.tempObj ? data.tempObj : data;
    if (!nextInfo || typeof nextInfo !== 'object') return;
    setSensorInfo(nextInfo);

    const angleFb = Number(nextInfo.angle_fb);
    const angleLr = Number(nextInfo.angle_lr);
    changeGroupRotate({
      x: Number.isFinite(angleFb) ? angleFb : undefined,
      z: Number.isFinite(angleLr) ? angleLr : undefined,
    });
  }

  function reset() {
    // console.log(camera)
    // console.log(111111)
    controls.reset()
    // camera.position.z = 300;
    // camera.position.y = 200;
    // camera.position.x = 0;
    // camera.rotation._x = 0;
    // camera.rotation._y = 0;
    // camera.rotation._z = 0;

    // camera = new THREE.PerspectiveCamera(
    //   40,
    //   window.innerWidth / window.innerHeight,
    //   1,
    //   150000
    // );


    // camera.position.z = 300;
    // camera.position.y = 200;

    // camera.position.set(0,200,300)

    // renderer.render(scene, camera);

    group.rotation.x = -(Math.PI * 2) / 12
    group.rotation.y = 0
    // group.position.z = groupZ
    if (particles) particles.rotation.z = 0;
    isSitActionViewRef.current = false;
    setChairVisible(true);
    applyPointTransform(pointTransformRef.current);
  }

  useImperativeHandle(refs, () => ({
    backData: backData,
    sitData: sitData,
    changeDataFlag: changeDataFlag,
    sitValue,
    backValue,
    sensorData,
    changeSelectFlag,
    // backRenew,
    sitRenew,
    changeGroupRotate,
    reset,
    actionAll: actionAll,
    actionSit: actionSit,
    // actionBack: actionBack,
  }));
  //   视图数据

  function onKeyDown(event) {
    if (event.key === 'Shift') {
      // enableControls = false;
      // isShiftPressed = true;

      controls.mouseButtons = null
      controls.keys = null
    }
  }

  // 按键放开事件处理函数
  function onKeyUp(event) {
    if (event.key === 'Shift') {
      // enableControls = true;
      // isShiftPressed = false;
      controls.mouseButtons = {
        LEFT: THREE.MOUSE.PAN, // make pan the default instead of rotate
        MIDDLE: THREE.MOUSE.ZOOM,
        RIGHT: THREE.MOUSE.ROTATE,
      };
      controls.keys = [
        ALT_KEY, // orbit
        CTRL_KEY, // zoom
        CMD_KEY, // pan
      ];
    }
  }


  function chartReset() {

  }


  // const changeValue = (obj) => { };
  useEffect(() => {
    // 靠垫数据

    init();
    // window.addEventListener("mousemove", () => {}, false);
    animate();


    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    return () => {
      cancelAnimationFrame(animationRequestId);
      if (pointTweenRef.current) {
        pointTweenRef.current.stop();
        pointTweenRef.current = null;
      }
      chairRef.current = null;
      group = new THREE.Group();
    };
  }, []);

  useEffect(() => {
    pointTransformRef.current = pointTransform;
    applyPointTransform(pointTransform);
  }, [pointTransform]);

  const transformInputStyle = {
    flex: 1,
    accentColor: "#38bdf8",
    cursor: "pointer",
  };

  const transformLabelStyle = {
    width: 42,
    color: "rgba(255, 255, 255, 0.72)",
    fontSize: 12,
  };

  const transformValueStyle = {
    width: 58,
    color: "rgba(255, 255, 255, 0.92)",
    fontSize: 12,
    textAlign: "right",
    fontVariantNumeric: "tabular-nums",
  };

  const formatTransformValue = (key, value) => key.startsWith("scale")
    ? Number(value).toFixed(4)
    : key === "pointSize"
      ? Number(value).toFixed(2)
    : Math.round(Number(value)).toString();

  const renderTransformInput = (label, key) => {
    const range = MINZHEN_POINT_TRANSFORM_RANGES[key];
    return (
    <label key={key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={transformLabelStyle}>{label}</span>
      <input
        type="range"
        min={range.min}
        max={range.max}
        step={range.step}
        value={pointTransform[key]}
        onChange={(event) => updatePointTransform(key, event.target.value)}
        onMouseDown={stopPanelPointer}
        onPointerDown={stopPanelPointer}
        style={transformInputStyle}
      />
      <span style={transformValueStyle}>{formatTransformValue(key, pointTransform[key])}</span>
    </label>
    );
  };

  const splitSensorValues = (value) => {
    if (Array.isArray(value)) {
      return value.map((item) => String(item).trim()).filter(Boolean);
    }
    if (value == null) {
      return [];
    }
    return String(value)
      .split(/[\t,，\s]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  };

  const getSensorValue = (...keys) => {
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
  const parseSensorNumber = (value) => {
    const text = Array.isArray(value) ? value[0] : value;
    const match = String(text ?? "").match(/-?\d+(?:\.\d+)?/);
    if (!match) {
      return null;
    }
    const nextValue = Number(match[0]);
    return Number.isFinite(nextValue) ? nextValue : null;
  };
  const formatAverageTemperature = () => {
    const temp0 = parseSensorNumber(getSensorValue("thermistor0", "temperature0", "temp0") || thermistorValues[0]);
    const temp1 = parseSensorNumber(getSensorValue("thermistor1", "temperature1", "temp1") || thermistorValues[1]);
    if (temp0 === null || temp1 === null) {
      return "";
    }
    return ((temp0 + temp1) / 2).toFixed(2);
  };
  const gyroscopeValues = splitSensorValues(sensorInfo.gyroscope);
  const thermistorValues = splitSensorValues(sensorInfo.thermistor);
  const renderSensorItem = ({ labelKey, value, unit }) => {
    return (
    <div className="dataItem" key={labelKey} style={{ alignItems: "center", gap: 8 }}>
      <div className="dataItemCircle" style={{ flex: "0 0 48%", minWidth: 0 }}>
        <div className="circleItem" style={{ display: "none" }}></div>
        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t(labelKey)}</div>
      </div>
      <div className="dataIteminfo" style={{ flex: "1 1 52%", justifyContent: "flex-end", minWidth: 0 }}>
        <div style={{ minWidth: 0, maxWidth: "100%", textAlign: "right" }}>
          <div style={{ overflowWrap: "anywhere" }}>{value} {unit ? <span style={{ color: "#999" }}>{unit}</span> : null}</div>
        </div>
      </div>
    </div>
    );
  };

  const sensorPanelItems = [
    { labelKey: "minzhen.accelerometer", value: formatSensorValues(gyroscopeValues.slice(0, 3), 3) },
    { labelKey: "minzhen.gyroscope", value: formatSensorValues(gyroscopeValues.slice(3, 6), 3) },
    { labelKey: "minzhen.temperature", value: formatAverageTemperature() },
    { labelKey: "minzhen.humidity", value: getSensorValue("humidity") },
    { labelKey: "minzhen.spineFrontBack", value: getSensorValue("angle_fb") },
    { labelKey: "minzhen.spineLeftRight", value: getSensorValue("angle_lr") },
  ];

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div
        style={{ position: "absolute", inset: 0, zIndex: 0 }}
        id={canvasId.current}
      ></div>
      {false ? (
      <div
        onMouseDown={stopPanelPointer}
        onPointerDown={stopPanelPointer}
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          zIndex: 3,
          width: 270,
          padding: "10px 12px",
          borderRadius: 6,
          background: "rgba(15, 23, 42, 0.78)",
          color: "#fff",
          boxShadow: "0 10px 24px rgba(0, 0, 0, 0.22)",
          pointerEvents: "auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{t("minzhen.pointAdjustment")}</span>
          <button
            type="button"
            onClick={resetPointTransform}
            onMouseDown={stopPanelPointer}
            onPointerDown={stopPanelPointer}
            style={{
              border: "1px solid rgba(148, 163, 184, 0.45)",
              borderRadius: 4,
              background: "rgba(30, 41, 59, 0.82)",
              color: "#fff",
              fontSize: 12,
              height: 24,
              padding: "0 8px",
              cursor: "pointer",
            }}
          >
            {t("reset")}
          </button>
        </div>
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ fontSize: 12, color: "rgba(255, 255, 255, 0.86)" }}>{t('minzhen.group')}</div>
          {renderTransformInput("X", "groupX", 1)}
          {renderTransformInput("Y", "groupY", 1)}
          {renderTransformInput("Z", "groupZ", 1)}
          <div style={{ height: 1, background: "rgba(148, 163, 184, 0.25)", margin: "2px 0" }} />
          <div style={{ fontSize: 12, color: "rgba(255, 255, 255, 0.86)" }}>{t('minzhen.point')}</div>
          {renderTransformInput("X", "pointX", 1)}
          {renderTransformInput("Y", "pointY", 1)}
          {renderTransformInput("Z", "pointZ", 1)}
          <div style={{ height: 1, background: "rgba(148, 163, 184, 0.25)", margin: "2px 0" }} />
          <div style={{ fontSize: 12, color: "rgba(255, 255, 255, 0.86)" }}>{t('minzhen.scale')}</div>
          {renderTransformInput("X", "scaleX", 0.0001)}
          {renderTransformInput("Y", "scaleY", 0.0001)}
          {renderTransformInput("Z", "scaleZ", 0.0001)}
          <div style={{ height: 1, background: "rgba(148, 163, 184, 0.25)", margin: "2px 0" }} />
          <div style={{ fontSize: 12, color: "rgba(255, 255, 255, 0.86)" }}>{t('minzhen.material')}</div>
          {renderTransformInput("Size", "pointSize")}
        </div>
      </div>
      ) : null}
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
          <h2 className="asideTitle">{t("minzhen.otherData")}</h2>
          {sensorPanelItems.map((item) => renderSensorItem(item))}
        </div>
      </div>
    </div>
  );
});
export default Canvas;
