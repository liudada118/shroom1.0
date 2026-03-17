import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { TrackballControls } from "three/examples/jsm/controls/TrackballControls";
import React, { useEffect, useImperativeHandle } from "react";
import { TextureLoader } from "three";
import TWEEN from "@tweenjs/tween.js";
import {
  addSide,
  findMax,
  gaussBlur_1,
  // interp,
  jet,
  jetWhite3,
  jetgGrey,
  rotate90,
} from "../../assets/util/util";
import { SelectionHelper } from "./SelectionHelper";
import { checkRectIndex, checkRectangleIntersection, getPointCoordinate, getPointCoordinateWowback, getPointCoordinateWowhead, getPointCoordinateback } from "./threeUtil1";

let timer

function debounce(fn, time) {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    fn()
  }, time);
}
let angleFlag = false
let inverseQuaternion, receivedQuaternion;

function interp(smallMat, width, height, interp1, interp2) {

  const bigMat = new Array((width * interp1) * (height * interp2)).fill(0)
  // return bigMat
  for (let i = 0; i < height; i++) {
    for (let j = 0; j < width; j++) {
      const realValue = smallMat[i * width + j] * 10
      const rowValue = smallMat[i * width + j + 1] * 10 ? smallMat[i * width + j + 1] * 10 : 0
      const colValue = smallMat[(i + 1) * width + j] * 10 ? smallMat[(i + 1) * width + j] * 10 : 0
      bigMat[(width * interp1) * i * interp2 + (j * interp1)
      ] = smallMat[i * width + j] * 10
      // for (let k = 0; k < interp1; k++) {
      //   // for (let z = 0; z < interp2; z++) {
      //   //   bigMat[(width * interp1) * (i * interp2 + k) + ((j * interp1) + z)
      //   //   ] = smallMat[i * width + j] * 10
      //   // }
      // }

      // for (let k = 0; k < interp2; k++) {
      //   bigMat[(width * interp1) * (i * interp2 + k) + ((j * interp1))] = realValue + (colValue - realValue) * (k) / interp2
      // }
      for (let k = 0; k < interp1; k++) {
        bigMat[(width * interp1) * (i * interp2) + ((j * interp1 + k))] = realValue + (rowValue - realValue) * (k) / interp1
      }
    }
  }

  const newWidth = width * interp1

  for (let i = 0; i < height; i++) {
    for (let j = 0; j < newWidth; j++) {
      const realValue = bigMat[i * interp2 * newWidth + j]
      // const rowValue = bigMat[i * width + j + 1] * 10 ? bigMat[i * width + j + 1] * 10 : 0
      // const colValue = bigMat[(i + 1) * width + j] * 10 ? bigMat[(i + 1) * width + j] * 10 : 0
      const colValue = bigMat[((i + 1) * interp2) * newWidth + j] ? bigMat[(((i + 1) * interp2) + 1) * newWidth + j] : 0
      for (let k = 0; k < interp2; k++) {
        bigMat[newWidth * (i * interp2 + k) + ((j))] = realValue + (colValue - realValue) * (k) / interp2
      }
    }
  }
  // for(let i = 0 ; i < width * interp1 ; i ++){
  //   for(let j = 0 ; j < width * interp1 ; j ++){

  //   }
  // }
  return bigMat
}

let baseQuaternion = null;
let baseQuaternionInv = null; // 存储第一个四元数的逆
/**
 * 1.0
 */
// function transformQuaternion(a) {
//   let q = new THREE.Quaternion(...a)
//   if (!baseQuaternion) {
//       // 第一次收到四元数，将其作为基准，并映射到 (1,0,0,0)
//       baseQuaternion = q.clone();
//       return new THREE.Quaternion(0, 0, 0, 1); // 归一化到单位四元数
//   }

//   // 计算新的全局四元数：q'_n = q_0⁻¹ * q_n
//   const qTransformed = new THREE.Quaternion();
//   qTransformed.multiplyQuaternions(baseQuaternion.clone().invert(), q);

//   return qTransformed;
// }

/**
 * 2.0
 */

function transformQuaternion(a) {
  [a[0], a[1]] = [a[1], a[0]]

  let q = new THREE.Quaternion(...a)
  if (!q) {
    console.warn("Received invalid quaternion.");
    return new THREE.Quaternion(0, 0, 0, 1);
  }

  if (!baseQuaternion) {
    // 第一次收到四元数，设为基准
    baseQuaternion = q.clone();
    baseQuaternionInv = baseQuaternion.clone().invert();

    // **关键步骤**：将 `q_0` 重新映射到 `(1,0,0,0)`
    return new THREE.Quaternion(0, 0, 0, 1);
  }

  if (baseQuaternion.lengthSq() === 0) {
    console.warn("Base quaternion is zero, cannot invert.");
    return new THREE.Quaternion(0, 0, 0, 1);
  }

  // **计算 q_n'**
  const qTransformed = new THREE.Quaternion();
  qTransformed.multiplyQuaternions(baseQuaternionInv, q);
  qTransformed.x = -qTransformed.x
  return qTransformed;
}

let baseEulerX = null

const sitnum1 = 32;
const sitnum2 = 32;
const sitInterp = 4;
const sitOrder = 6;
var ndata1 = new Array(sitnum1 * sitnum2).fill(0)
var rotate1 = [0, 0, 0, 1]
let quaternion = new THREE.Quaternion(0, 0, 0, 1)
let local
const Canvas = React.forwardRef((props, refs) => {
  local = props.local
  let showFlag = false
  var FPS = 10;
  var timeS = 0;
  var renderT = 1 / FPS;
  let totalArr = [],
    totalPointArr = [];

  var timeS = 0; var renderT = 1 / FPS;
  const clock = new THREE.Clock();
  const backX = 1 - 15, backY = 100 + 5, backZ = 118, sitX = -3, sitY = 70, sitZ = 148, backRotationX = -Math.PI * 7 / 12


  var newDiv, newDiv1, selectStartArr = [], selectEndArr = [], sitArr, backArr, headArr, sitMatrix = [], backMatrix = [], headMatrix = [], selectMatrix = [], selectHelper
  let sitIndexArr = [], sitIndexEndArr = [], backIndexArr = [], headIndexArr = [], backIndexEndArr = [], headIndexEndArr = []
  var animationRequestId, colSelectFlag = false

  const backnum1 = 32;
  const backnum2 = 32;
  const backInterp = 2;
  const backOrder = 4;
  const headnum1 = 10;
  const headnum2 = 10;
  const headInterp = 4;
  const headOrder = 2;
  const AMOUNTXhead = (headnum1 * headInterp + headOrder * 2);
  const AMOUNTYhead = (headnum2 * headInterp + headOrder * 2);
  let controlsFlag = true;
  var valuej1 = localStorage.getItem('carValuej') ? JSON.parse(localStorage.getItem('carValuej')) : 200,
    valueg1 = localStorage.getItem('carValueg') ? JSON.parse(localStorage.getItem('carValueg')) : 2,
    value1 = localStorage.getItem('carValue') ? JSON.parse(localStorage.getItem('carValue')) : 2,
    valuel1 = localStorage.getItem('carValuel') ? JSON.parse(localStorage.getItem('carValuel')) : 2,
    valuef1 = localStorage.getItem('carValuef') ? JSON.parse(localStorage.getItem('carValuef')) : 2,
    valuej2 = localStorage.getItem('carValuej') ? JSON.parse(localStorage.getItem('carValuej')) : 200,
    valueg2 = localStorage.getItem('carValueg') ? JSON.parse(localStorage.getItem('carValueg')) : 2,
    value2 = localStorage.getItem('carValue') ? JSON.parse(localStorage.getItem('carValue')) : 2,
    valuel2 = localStorage.getItem('carValuel') ? JSON.parse(localStorage.getItem('carValuel')) : 2,
    valuef2 = localStorage.getItem('carValuef') ? JSON.parse(localStorage.getItem('carValuef')) : 2,
    valuelInit1 = localStorage.getItem('carValueInit') ? JSON.parse(localStorage.getItem('carValueInit')) : 2,
    valuelInit2 = localStorage.getItem('carValueInit') ? JSON.parse(localStorage.getItem('carValueInit')) : 2;
  let particles,
    particles1,
    particlesHead,
    material,
    backGeometry,
    sitGeometry,
    headGeometry
  let cube, chair, mixer, clips;
  let camera, scene, renderer;
  var ndatahead = new Array(headnum1 * headnum2).fill(0), newData1 = new Array(sitnum1 * sitnum2).fill(0),
    newData = new Array(backnum1 * backnum2).fill(0), newDatahead = new Array(backnum1 * backnum2).fill(0);
  let dataFlag = false;
  const changeDataFlag = () => {
    dataFlag = true;

  };

  let bigArrhand = new Array(sitnum1 * sitInterp * sitnum2 * sitInterp).fill(1);
  let bigArr1 = new Array(backnum1 * backInterp * backnum2 * backInterp).fill(1),
    bigArrhead = new Array(headnum1 * headInterp * headnum2 * headInterp).fill(1),
    bigArrghead = new Array(
      (backnum1 * backInterp + 2 * backOrder) *
      (backnum2 * backInterp + 2 * backOrder)
    ).fill(1),
    bigArrg1 = new Array(
      (backnum1 * backInterp + 2 * backOrder) *
      (backnum2 * backInterp + 2 * backOrder)
    ).fill(1),
    bigArrg1New = new Array(
      (backnum1 * backInterp + 2 * backOrder) *
      (backnum2 * backInterp + 2 * backOrder) * 2
    ).fill(1),
    smoothBig1 = new Array(
      (backnum1 * backInterp + 2 * backOrder) *
      (backnum2 * backInterp + 2 * backOrder)
    ).fill(1),
    smoothBighead = new Array(
      (headnum1 * headInterp + 2 * headOrder) *
      (headnum2 * headInterp + 2 * headOrder) * 2
    ).fill(1),
    ndata1Num,
    ndataNum,
    ndataheadNum
    ;

  let bigArr = new Array(sitnum1 * sitInterp * sitnum2 * sitInterp).fill(1);
  let bigArrg = new Array((sitnum1 * sitInterp + sitOrder * 2) * (sitnum2 * sitInterp + sitOrder * 2)).fill(1),
    bigArrshand = new Array(
      (sitnum1 * sitInterp + sitOrder * 2) *
      (sitnum2 * sitInterp + sitOrder * 2)
    ).fill(1),
    smoothBig = new Array((sitnum1 * sitInterp + sitOrder * 2) * (sitnum2 * sitInterp + sitOrder * 2)).fill(1);
  let i = 0;

  let container;


  let controls, lastRender = 0;
  const ALT_KEY = 18;
  const CTRL_KEY = 17;
  const CMD_KEY = 91;
  const AMOUNTX = sitnum1 * sitInterp + sitOrder * 2;
  const AMOUNTY = sitnum2 * sitInterp + sitOrder * 2;
  const AMOUNTX1 = (backnum1 * backInterp + backOrder * 2);
  const AMOUNTY1 = (backnum2 * backInterp + backOrder * 2);
  const SEPARATION = 100;
  let group = new THREE.Group();

  let positions1;
  let colors1, scales1;
  let positions;
  let colors, scales;
  let positionsHead;
  let colorsHead, scalesHead;

  const positionY = 120,
    positionX = -10;


  const groupX = -10
  const groupY = -23
  const groupZ = -380
  function changeFlag(value) {
    controlsFlag = value
  }

  function init() {
    // 清空 group 中的旧粒子，防止重复 add 导致双层
    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }
    container = document.getElementById(`canvas${props.index}`);
    // camera

    camera = new THREE.PerspectiveCamera(
      40,
      window.innerWidth / window.innerHeight,
      1,
      150000
    );

    // 初版
    camera.position.z = -10;
    camera.position.y = 30;
    camera.position.x = 0;



    camera.lookAt(0, 0, 0)
    // scene

    scene = new THREE.Scene();
    scene.add(group);

    const loader = new GLTFLoader();

    loader.load("./model/hand1.glb", function (gltf) {
      chair = gltf.scene;
      chair.rotation.x = 0






      chair.rotation.z = Math.PI
      group.add(chair)
    });

    const helper = new THREE.GridHelper(2000, 100);
    helper.position.y = -199;
    helper.material.opacity = 0.25;
    helper.material.transparent = true;
    scene.add(helper);

    // lights
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff);
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

    renderer.setSize(window.innerWidth, window.innerHeight);

    renderer.outputEncoding = THREE.sRGBEncoding;
    container.replaceChildren(renderer.domElement);

    renderer.setClearColor(0x10152b);

    //FlyControls
    controls = new TrackballControls(camera, renderer.domElement);
    controls.dynamicDampingFactor = 1;
    controls.domElement = container;
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.PAN, // make pan the default instead of rotate
      MIDDLE: THREE.MOUSE.ZOOM,
      RIGHT: THREE.MOUSE.ROTATE,
    };
    initSet();

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
        positions[i] = ix * SEPARATION - (AMOUNTX * SEPARATION) / 2 + ix * 20; // x
        positions[i + 1] = 0; // y
        positions[i + 2] = iy * SEPARATION - (AMOUNTY * SEPARATION) / 2; // z

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
    const hand = new THREE.TextureLoader().load("./hand.jpg");
    material = new THREE.PointsMaterial({
      vertexColors: true,
      transparent: true,
      //   color: 0xffffff,
      map: spite,
      size: 2 / 16,
    });
    sitGeometry.setAttribute("scale", new THREE.BufferAttribute(scales, 1));
    sitGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    particles = new THREE.Points(sitGeometry, material);

    particles.scale.x = 0.0005;
    particles.scale.y = 0.001;
    particles.scale.z = 0.0006;


    // particles.rotation.x = Math.PI ;
    // particles.rotation.y = Math.PI 
    // particles.rotation.z = Math.PI
    particles.position.x = 1.5
    particles.position.y = 1.1
    particles.position.z = 3
    particles.rotation.z = Math.PI
    particles.rotation.x = Math.PI-0.02
    // if (particles) particles.quaternion.set(0, 0, 0, 1)
    group.add(particles);
    if (group) group.quaternion.set(0, 0, 0, 1)
  }


  function rotateFingers(arr) {
    if (chair) {
      chair.traverse((obj) => {
        if (obj.isSkinnedMesh) {
          // console.log("找到 SkinnedMesh:", obj);

          // // **获取骨骼系统**
          // console.log("Skeleton:", obj.skeleton);

          // // **获取所有骨骼**
          // console.log("Bones:", obj.skeleton.bones);

          // **查看骨骼层级**

          // const 
          const Finger_01 = obj.skeleton.getBoneByName("Finger_01");
          const Finger_02 = obj.skeleton.getBoneByName("Finger_02");

          const Finger_10 = obj.skeleton.getBoneByName("Finger_10");
          const Finger_11 = obj.skeleton.getBoneByName("Finger_11");
          const Finger_12 = obj.skeleton.getBoneByName("Finger_12");

          const Finger_20 = obj.skeleton.getBoneByName("Finger_20");
          const Finger_21 = obj.skeleton.getBoneByName("Finger_21");
          const Finger_22 = obj.skeleton.getBoneByName("Finger_22");

          const Finger_30 = obj.skeleton.getBoneByName("Finger_30");
          const Finger_31 = obj.skeleton.getBoneByName("Finger_31");
          const Finger_32 = obj.skeleton.getBoneByName("Finger_32");

          const Finger_40 = obj.skeleton.getBoneByName("Finger_40");
          const Finger_41 = obj.skeleton.getBoneByName("Finger_41");
          const Finger_42 = obj.skeleton.getBoneByName("Finger_42");


          rotateFinger([Finger_01, Finger_02], arr[0])
          rotateFinger([Finger_10, Finger_11, Finger_12], arr[1])
          rotateFinger([Finger_20, Finger_21, Finger_22], arr[2])
          rotateFinger([Finger_30, Finger_31, Finger_32], arr[3])
          rotateFinger([Finger_40, Finger_41, Finger_42], arr[4])

        }
      });
    }

  }

  function rotateFinger(fingerArr, value) {
    fingerArr.forEach((a) => {
      if (a) {
        a.rotation.z = (-Math.PI / 2) * value
      }
    })
  }

  //模型动画

  function animate(timestamp) {

    const delta = timestamp - lastRender;

    if (delta >= 1000 / 40) {
      render();
      lastRender = timestamp;
    }

    // dataFlag = false
    // }
    animationRequestId = requestAnimationFrame(animate);
  }


  // for(let i = 0  )

  var ndata2
  function initndata1Data() {
    // const handPointArr = [
    //   [4, 5], [4, 6], [2, 8], [2, 9], [1, 12], [1, 13], [2, 16], [2, 17], [14, 25], [14, 26],
    //   [8, 5], [8, 6], [6, 9], [6, 10], [6, 12], [6, 13], [6, 16], [6, 17], [18, 24], [18, 25],
    //   [11, 6], [11, 7], [10, 9], [10, 10], [10, 12], [10, 13], [10, 15], [10, 16], [22, 23], [22, 24],
    //   [17, 8], [17, 9], [17, 10], [17, 11], [17, 12], [17, 13], [17, 14], [17, 15],
    //   [18, 8], [18, 9], [18, 10], [18, 11], [18, 12], [18, 13], [18, 14], [18, 15],
    //   [21, 8], [21, 9], [21, 10], [21, 11], [21, 12], [21, 13], [21, 14], [21, 15],
    //   [24, 8], [24, 9], [24, 10], [24, 11], [24, 12], [24, 13], [24, 14], [24, 15]
    // ]


    // let newZeroArr = new Array(1024).fill(0)
    // // for(let i = 0 ; i < )
    // handPointArr.forEach((a, index) => {

    //   newZeroArr[a[0] * 32 + a[1]] = 5
    //   newZeroArr[(a[0] + 1) * 32 + a[1]] = 5
    //   newZeroArr[(a[0] + 2) * 32 + a[1]] = 5
    // })
    // newZeroArr = rotate90(newZeroArr, 32, 32)
    // ndata2 = newZeroArr

    // const handPointArr = [
    //   [16, 3], [16, 4], [16, 5], [3, 14], [3, 15], [3, 16], [3, 18], [3, 19], [3, 20], [3, 22], [3, 23], [3, 24], [5, 26], [5, 27], [5, 28],
    //   [17, 3], [17, 4], [17, 5], [4, 14], [4, 15], [4, 16], [4, 18], [4, 19], [4, 20], [4, 22], [4, 23], [4, 24], [6, 26], [6, 27], [6, 28],
    //   [18, 4], [18, 5], [18, 6], [5, 14], [5, 15], [5, 16], [5, 18], [5, 19], [5, 20], [5, 22], [5, 23], [5, 24], [7, 26], [7, 27], [7, 28],
    //   [19, 4], [19, 5], [19, 6], [6, 14], [6, 15], [6, 16], [6, 18], [6, 19], [6, 20], [6, 22], [6, 23], [6, 24], [8, 26], [8, 27], [8, 28],
    //   // [23, 6], [23, 7], [23, 8], [12, 14], [12, 15], [12, 16], [12, 18], [12, 19], [12, 20], [12, 22], [12, 23], [12, 24], [12, 26], [12, 27], [12, 28],
    //   [20, 16], [20, 17], [20, 18], [20, 19], [20, 20], [20, 21], [20, 22], [20, 23], [20, 24], [20, 25], [20, 26], [20, 27],
    //   [22, 13], [22, 14], [22, 15], [22, 16], [22, 17], [22, 18], [22, 19], [22, 20], [22, 21], [22, 22], [22, 23], [22, 24], [22, 25], [22, 26], [22, 27],
    //   [24, 13], [24, 14], [24, 15], [24, 16], [24, 17], [24, 18], [24, 19], [24, 20], [24, 21], [24, 22], [24, 23], [24, 24], [24, 25], [24, 26], [24, 27],
    //   [26, 13], [26, 14], [26, 15], [26, 16], [26, 17], [26, 18], [26, 19], [26, 20], [26, 21], [26, 22], [26, 23], [26, 24], [26, 25], [26, 26], [26, 27],
    //   [28, 13], [28, 14], [28, 15], [28, 16], [28, 17], [28, 18], [28, 19], [28, 20], [28, 21], [28, 22], [28, 23], [28, 24], [28, 25], [28, 26], [28, 27],
    //   [30, 13], [30, 14], [30, 15], [30, 16], [30, 17], [30, 18], [30, 19], [30, 20], [30, 21], [30, 22], [30, 23], [30, 24], [30, 25], [30, 26], [30, 27]
    // ]

    let handPointArr = [
      [21, 3], [20, 3], [19, 3], [3, 10], [3, 11], [3, 12], [0, 15], [0, 16], [0, 17], [2, 23], [2, 24], [2, 25], [7, 27], [7, 28], [7, 29],
      [21, 4], [20, 4], [19, 4], [4, 10], [4, 11], [4, 12], [1, 15], [1, 16], [1, 17], [3, 23], [3, 24], [3, 25], [8, 27], [8, 28], [8, 29],
      [22, 5], [21, 5], [20, 5], [5, 10], [5, 11], [5, 12], [2, 16], [2, 17], [2, 18], [4, 23], [4, 24], [4, 25], [9, 27], [9, 28], [9, 29],
      [22, 6], [21, 6], [20, 6], [6, 11], [6, 12], [6, 13], [3, 16], [3, 17], [3, 18], [5, 23], [5, 24], [5, 25], [10, 27], [10, 28], [10, 29],
      [23, 8], [22, 8], [21, 8], [10, 12], [10, 13], [10, 14], [9, 17], [9, 18], [9, 19], [9, 22], [9, 23], [9, 24], [12, 26], [12, 27], [12, 28],
      [15, 18], [15, 18], [15, 19], [15, 20], [15, 21], [15, 22], [15, 23], [15, 24], [15, 25], [15, 26], [15, 27], [15, 28],
      [17, 15], [17, 15], [17, 16], [17, 17], [17, 18], [17, 19], [17, 20], [17, 21], [17, 22], [17, 23], [17, 24], [17, 25], [17, 26], [17, 27], [17, 28],
      [19, 15], [19, 15], [19, 16], [19, 17], [19, 18], [19, 19], [19, 20], [19, 21], [19, 22], [19, 23], [19, 24], [19, 25], [19, 26], [19, 27], [19, 28],
      [21, 15], [21, 15], [21, 16], [21, 17], [21, 18], [21, 19], [21, 20], [21, 21], [21, 22], [21, 23], [21, 24], [21, 25], [21, 26], [21, 27], [21, 28],
      [23, 15], [23, 15], [23, 16], [23, 17], [23, 18], [23, 19], [23, 20], [23, 21], [23, 22], [23, 23], [23, 24], [23, 25], [23, 26], [23, 27], [23, 28]]
      handPointArr = handPointArr.map((a) => [a[0] + 1 , a[1]])
    // for (let i = 0; i < 4; i++) {
    //   for (let j = 0; j < 5; j++) {
    //     for (let k = 0; k < 3; k++) {
    //       if (j == 0) {
    //         // handPointArr[i*15 + j*3 + k][0] = handPointArr[i*15 + j*3 + k][0] - 2
    //         handPointArr[i * 15 + j * 3 + k][1] = handPointArr[i * 15 + j * 3 + k][1] - 3
    //       }

    //       if (j == 1) {
    //         // handPointArr[i*15 + j*3 + k][0] = handPointArr[i*15 + j*3 + k][0] - 2
    //         handPointArr[i * 15 + j * 3 + k][1] = handPointArr[i * 15 + j * 3 + k][1] - 2
    //       }

    //       // if(j == 2){
    //       //   // handPointArr[i*15 + j*3 + k][0] = handPointArr[i*15 + j*3 + k][0] - 2
    //       //   handPointArr[i*15 + j*3 + k][1] = handPointArr[i*15 + j*3 + k][1] - 2
    //       // }

    //       if (j == 3) {
    //         // handPointArr[i*15 + j*3 + k][0] = handPointArr[i*15 + j*3 + k][0] - 2
    //         handPointArr[i * 15 + j * 3 + k][1] = handPointArr[i * 15 + j * 3 + k][1] + 2
    //       }

    //       if (j == 4) {
    //         // handPointArr[i*15 + j*3 + k][0] = handPointArr[i*15 + j*3 + k][0] - 2
    //         handPointArr[i * 15 + j * 3 + k][1] = handPointArr[i * 15 + j * 3 + k][1] + 3
    //       }
    //     }
    //   }
    // }

    let newZeroArr = new Array(1024).fill(0)
    // for(let i = 0 ; i < )
    handPointArr.forEach((a, index) => {
      newZeroArr[a[0] * 32 + 31-a[1]] = 5
      newZeroArr[(a[0] + 1) * 32 + 31-a[1]] = 5
      // newZeroArr[(a[0] + 2) * 32 + a[1]] = handArr[index]
    })

    // newZeroArr = rotate90(newZeroArr, 32, 32)
    // console.log(newZeroArr)
    ndata2 = newZeroArr
  }

  //  更新座椅数据
  function sitRenew() {
    // console.log(props)
    // valueg1 = 2
    // valuej1 = 500 
    // value1 =2
    if (baseQuaternion) {
      if (group) group.quaternion.copy(quaternion);
    }

    initndata1Data()

    // interp(ndata1, bigArr, sitnum1, sitInterp);
    const bigArr = interp(ndata1, sitnum2, sitnum1, sitInterp, sitInterp)
    // const bigArr = new Array(sitnum2*sitnum1*sitInterp*sitInterp).fill(0)
    // console.log(first)
    let bigArrs = addSide(
      bigArr,
      sitnum2 * sitInterp,
      sitnum1 * sitInterp,
      sitOrder,
      sitOrder
    );


    // interp(ndata2, bigArrhand, sitnum1, sitInterp);
    const bigArrhand = interp(ndata2, sitnum2, sitnum1, sitInterp, sitInterp)
    let bigArrshand1 = addSide(
      bigArrhand,
      sitnum2 * sitInterp,
      sitnum1 * sitInterp,
      sitOrder,
      sitOrder
    );
    gaussBlur_1(
      bigArrshand1,
      bigArrshand,
      sitnum2 * sitInterp + sitOrder * 2,
      sitnum1 * sitInterp + sitOrder * 2,
      1.5
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
        const valuehand = bigArrshand[l] * 10
        //柔化处理smooth
        smoothBig[l] = smoothBig[l] + (value - smoothBig[l] + 0.5) / valuel1;



        positions[k] = ix * SEPARATION - (AMOUNTX * SEPARATION) / 2; // x
        positions[k + 1] = smoothBig[l] * value1; // y
        positions[k + 2] = iy * SEPARATION - (AMOUNTY * SEPARATION) / 2; // z

        if (value < 50) {
          positions[k + 1] = -1000
          positions[k] = 0
          positions[k + 2] = 0
        }
        let rgb

        if (sitIndexArr && !sitIndexArr.every((a) => a == 0)) {

          if (ix >= sitIndexArr[0] && ix < sitIndexArr[1] && iy >= sitIndexArr[2] && iy < sitIndexArr[3]) {
            // rgb = [255, 0, 0];
            rgb = jetWhite3(0, valuej1, smoothBig[l]);
            // scales1[l] = 2;
            // positions1[k + 1] = smoothBig[l] / value2 - 1000
            dataArr.push(bigArrg[l])
          } else {
            rgb = jetgGrey(0, valuej1, smoothBig[l]);
            // scales1[l] = 1;
          }
        } else {
          rgb = jetWhite3(0, valuej1, smoothBig[l]);
          // scales1[l] = 1;
        }

        colors[k] = rgb[0] / 255;
        colors[k + 1] = rgb[1] / 255;
        colors[k + 2] = rgb[2] / 255;

        // if(valuehand < 50){
        //   colors[k] = 255 / 255;
        //   colors[k + 1] = 0 / 255;
        //   colors[k + 2] = 0 / 255;
        // }

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
      console.log(local, props.local)
      dataArr = dataArr.filter((a) => a > valuej1 * 0.025)
      const max = findMax(dataArr)
      const point = dataArr.filter((a) => a > 0).length
      const press = dataArr.reduce((a, b) => a + b, 0)
      const mean = press / (point == 0 ? 1 : point)
      props.data.current?.changeData({
        meanPres: mean.toFixed(2),
        maxPres: max,
        point: point,
        // area: areaSmooth.toFixed(0),
        totalPres: press,
        // pressure: pressureSmooth.toFixed(2),
      });

      if (totalArr.length < 20) {
        totalArr.push(press);
      } else {
        totalArr.shift();
        totalArr.push(press);
      }

      const maxTotal = findMax(totalArr);

      if (!local)
        props.data.current?.handleCharts(totalArr, maxTotal + 1000);

      if (totalPointArr.length < 20) {
        totalPointArr.push(point);
      } else {
        totalPointArr.shift();
        totalPointArr.push(point);
      }

      const max1 = findMax(totalPointArr);
      if (!local)
        props.data.current?.handleChartsArea(totalPointArr, max1 + 100);
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
    // console.log(renderer)
    renderer.render(scene, camera);
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
      rotate,
      valuelInit,
    } = prop;
    // console.log(wsPointData )
    //   valueg,
    //   value,
    //   valuel,
    //   valuef,
    //   valuelInit,)
    // valuej1 = valuej;
    // valueg1 = valueg;
    // value1 = value;
    // valuel1 = valuel;
    // valuef1 = valuef;
    // ndata1 = [];
    ndata1 = wsPointData;
    rotate1 = rotate
    // valuelInit1 = valuelInit;
    // 修改线序 坐垫
    ndata1 = ndata1.map((a, index) => (a - valuef1 < 0 ? 0 : a - valuef1));

    ndata1Num = ndata1.reduce((a, b) => a + b, 0);
    console.log(ndata1Num)
    if (ndata1Num < valuelInit) {
      ndata1 = new Array(sitnum1 * sitnum2).fill(0);
    }
    // console.log(ndata1)
  }



  function changePointRotation({ direction, value, type }) {
    if (type === 'back') {
      if (direction == 'x') {
        particles1.rotation[direction] = -Math.PI / 2 - (Math.PI * 4) / 24 - (value * 6) / 12
      } else {
        particles1.rotation[direction] = - (value * 6) / 12
      }
    } else if (type === 'sit') {
      if (direction == 'x') {
        particles.rotation[direction] = Math.PI / 3 - (value * 6) / 12
      } else {
        particles.rotation[direction] = (value * 6) / 12
      }
    } else if (type === 'head') {
      if (direction == 'x') {
        particlesHead.rotation[direction] = backRotationX - (value * 6) / 12
      } else {
        particlesHead.rotation[direction] = (value * 6) / 12
      }
    }
    // actionAll()
  }

  function changeBox({ width, height }) {
    const left = selectHelper.pointTopLeft.x ? selectHelper.pointTopLeft.x : window.innerWidth / 2
    const top = selectHelper.pointTopLeft.y ? selectHelper.pointTopLeft.y : window.innerHeight / 2
    selectHelper.element.style.left = left + 'px';
    selectHelper.element.style.top = top + 'px';
    if (width) {
      selectHelper.element.style.width = width + 'px';
    }
    if (height) {
      selectHelper.element.style.height = height + 'px';
    }

    selectEndArr = [left + Number(width), top + Number(height)]
    selectStartArr = [left, top]


    selectMatrix = [...selectStartArr, ...selectEndArr]

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
      console.log(selectMatrix, backMatrix)
      if (sitInterArr) {
        sitIndexArr = checkRectIndex(sitMatrix, sitInterArr, AMOUNTX, AMOUNTY)
      }
      if (backInterArr) {
        backIndexArr = checkRectIndex(backMatrix, backInterArr, AMOUNTX1, AMOUNTY1)
      }

      props.changeSelect({ sit: sitIndexArr, back: backIndexArr })
      // props.changeStateData({ width: width, height: height })

    }

    // props.changeSelect({ sit: sitIndexArr, back: backIndexArr })

  }

  function cancelSelect() {
    selectHelper.onSelectOver()
  }

  function changeShow() {
    showFlag = !showFlag
    particles.material.opacity = showFlag ? 1 : 0
  }

  // function changeHandAngle(arr) {
  //   console.log(arr , 'arr')
  //   /**
  //    * chatgpt
  //    */
  //   // arr = [111]
  //   quaternion = transformQuaternion(arr)
  //   // if (arr && arr.every((a) => a != undefined) && baseQuaternion) {
  //   //   if (group) group.quaternion.copy(quaternion);
  //   // }

  // }
  function changeHandAngle(arr) {
    if (arr && !arr.includes(undefined)) {
      quaternion = transformQuaternion(arr)
    }

  }

  function calibration(arr) {
    rotateFingers(arr)
  }

  function handZero() {

    // if (group) group.quaternion.set(0, 0, 0, 1)
    // chair.rotation.z = Math.PI
    // chair.rotation.x = -Math.PI / 3
    // chair.rotation.z = Math.PI
    // chair.rotation.y = 0
    // chair.matrixAutoUpdate = true;
    // chair.updateMatrixWorld(true);
    // chair.rotation.set(-Math.PI / 3, 0, Math.PI)
    // chair.quaternion.identity();
    // chair.matrix.identity();
    // // 确保矩阵更新
    // chair.updateMatrix();

    // 禁用自动更新
    // chair.matrixAutoUpdate = false;
    // setTimeout(() => {
    //   calibration([0,0,0])
    // }, 1000);
    // // 重置矩阵为单位矩阵
    // chair.matrix.identity();

    // // 如果需要同步更新 position、quaternion 和 scale
    // chair.matrix.decompose(chair.position, chair.quaternion, chair.scale);
    // calibration(new Array(5).fill(0))
    // rotateFingers([0,0,0,0,0])
    chair.rotation.set(0, 0, -Math.PI)
    // group.quaternion.set(0, 0, 0, 1)
    quaternion = new THREE.Quaternion(0, 0, 0, 1)
  }

  function resetHand() {

    baseQuaternion = null
    // chair.rotation.z = Math.PI
    // if (group) group.quaternion.set(0, 0, 0, 1)
  }

  function changaCamera(obj) {
    let { x, y, z } = obj
    if (x) {
      camera.position.x = x;
    }

    if (y) {
      camera.position.y = y;
    }

    if (z) {
      camera.position.z = z;
    }
  }

  function sitValue(prop) {
    const { valuej, valueg, value, valuel, valuef, valuelInit } = prop;
    if (valuej) valuej1 = valuej;
    if (valueg) valueg1 = valueg;
    if (value) value1 = value;
    if (valuel) valuel1 = valuel;
    if (valuef) valuef1 = valuef;
    if (valuelInit) valuelInit1 = valuelInit;
  }

  useImperativeHandle(refs, () => ({
    changeHandAngle,
    // changeShow,
    sitValue,
    sitData,
    changeDataFlag: changeDataFlag,
    changePointRotation,
    changeBox,
    cancelSelect,
    calibration,
    handZero,
    resetHand,
    changaCamera
  }));


  //   视图数据

  useEffect(() => {
    // 靠垫数据

    window.removeEventListener('keydown', function () { })
    window.removeEventListener('keyup', function () { })
    init();
    animate();
    return () => {
      if (animationRequestId) cancelAnimationFrame(animationRequestId);
      selectHelper?.dispose()
    };
  }, []);
  return (
    <div>
      <div
        style={{ width: "100%", height: "100%" }}
        id={`canvas${props.index}`}
      ></div>
    </div>
  );
});
export default Canvas;
