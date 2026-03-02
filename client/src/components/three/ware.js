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
  gaussBlur_return,
  interp,
  interpSmall,
  interpSquare,
  jet,
  jetWhite3,
  jetgGrey,
  rotate90,
} from "../../assets/util/util";
import { SelectionHelper } from "./SelectionHelper";
import { checkRectIndex, checkRectangleIntersection, getPointCoordinate, getPointCoordinateWowback, getPointCoordinateWowhead, getPointCoordinateback } from "./threeUtil1";
import { cleanupThree } from "./disposeThree";

let timer

function debounce(fn, time) {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    fn()
  }, time);
}
let angleFlag = false
let inverseQuaternion, receivedQuaternion;

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
    return new THREE.Quaternion(1, 0, 0, 0);
  }

  if (!baseQuaternion) {
    // 第一次收到四元数，设为基准
    baseQuaternion = q.clone();
    baseQuaternionInv = baseQuaternion.clone().invert();

    // **关键步骤**：将 `q_0` 重新映射到 `(1,0,0,0)`
    return new THREE.Quaternion(1, 0, 0, 0);
  }

  if (baseQuaternion.lengthSq() === 0) {
    console.warn("Base quaternion is zero, cannot invert.");
    return new THREE.Quaternion(1, 0, 0, 0);
  }

  // **计算 q_n'**
  const qTransformed = new THREE.Quaternion();
  qTransformed.multiplyQuaternions(baseQuaternionInv, q);
  qTransformed.x = -qTransformed.x
  return qTransformed;
}


const Canvas = React.forwardRef((props, refs) => {
  let showFlag = false
  var FPS = 10;
  var timeS = 0;
  var renderT = 1 / FPS;
  let totalArr = [],
    totalPointArr = [];
  let local
  var timeS = 0; var renderT = 1 / FPS;
  const clock = new THREE.Clock();
  const backX = 1 - 15, backY = 100 + 5, backZ = 118, sitX = -3, sitY = 70, sitZ = 148, backRotationX = -Math.PI * 7 / 12


  var newDiv, newDiv1, selectStartArr = [], selectEndArr = [], sitArr, backArr, headArr, sitMatrix = [], backMatrix = [], headMatrix = [], selectMatrix = [], selectHelper
  let sitIndexArr = [], sitIndexEndArr = [], backIndexArr = [], headIndexArr = [], backIndexEndArr = [], headIndexEndArr = []
  var animationRequestId, colSelectFlag = false
  const sitnum1 = 32;
  const sitnum2 = 32;
  const sitInterp = 2;
  const sitOrder = 4;
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
  var ndata1 = new Array(sitnum1 * sitnum2).fill(0), ndata = new Array(backnum1 * backnum2).fill(0),
    ndatahead = new Array(headnum1 * headnum2).fill(0), newData1 = new Array(sitnum1 * sitnum2).fill(0),
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
  let pointGroup = new THREE.Group();
  let positions1;
  let colors1, scales1;
  let positions;
  let colors, scales;
  let positionsHead;
  let colorsHead, scalesHead;


  function init() {
    container = document.getElementById(`canvas${props.index}`);
    // camera

    camera = new THREE.PerspectiveCamera(
      40,
      window.innerWidth / window.innerHeight,
      1,
      150000
    );


    camera.position.z = 1;
    camera.position.y = 280;
    camera.position.x = 0;

    camera.lookAt(0, 0, 0)
    // scene

    scene = new THREE.Scene();

    // model
    scene.add(group);
    scene.add(pointGroup);

    const loader = new GLTFLoader();

    // loader.load("./model/hand.glb", function (gltf) {
    //   chair = gltf.scene;


    //   group.add(chair);

    //   console.log(chair)
    //   chair.position.z = 100
    //   chair.rotation.x = 0//-Math.PI / 3
    //   chair.rotation.z = 0//Math.PI
    //   chair.rotation.y = Math.PI

    //   // convertToPoints(chair)

    //   // const frontPoints = getFrontFacePoints(chair, camera);
    //   // console.log("正面点索引:", frontPoints);

    //   // const colors = new Float32Array(geometry.attributes.position.count * 3).fill(1.0);
    //   // frontPoints.forEach((index) => {
    //   //   colors[index * 3] = 1.0;   // R = 1.0 (红色)
    //   //   colors[index * 3 + 1] = 0.0; // G = 0.0
    //   //   colors[index * 3 + 2] = 0.0; // B = 0.0
    //   // });
    //   // geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    //   // geometry.attributes.color.needsUpdate = true;

    //   // red(chair)

    // });
    initHand()
    function initHand() {
      // handGeometry = new THREE.PlaneGeometry(10,10)
      const hand = new THREE.TextureLoader().load("./body.png");
      // console.log('inithand')
      // handMaterial = new THREE.MeshBasicMaterial({
      //   // vertexColors: true,
      //   // transparent: true,
      //   //   color: 0xffffff,
      //   map: hand,
      //   // size: 10000,
      // });
      // const geometry = new THREE.PlaneGeometry(35, 48);
      // const material = new THREE.MeshBasicMaterial({ color: 0x666, map: hand, transparent: true,});
      const geometry = new THREE.PlaneGeometry(35, 35 * 1.9);
      const material = new THREE.MeshBasicMaterial({ map: hand, transparent: true, });
      const plane = new THREE.Mesh(geometry, material);
      plane.rotation.x = - Math.PI / 2;
      // plane.position.y = 150;
      // handParticles = new THREE.Points(handGeometry, handMaterial);
      group.add(plane);
    }
    group.position.y = 150
    pointGroup.position.y = 150

    const helper = new THREE.GridHelper(2000, 100);
    helper.position.y = -199;
    helper.material.opacity = 0.25;
    helper.material.transparent = true;
    scene.add(helper);

    // lights
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff);
    hemiLight.position.set(0, 1000, 0);
    scene.add(hemiLight);

    const hemiLight1 = new THREE.HemisphereLight(0xffffff, 0xffffff);
    hemiLight1.position.set(2000, 0, 0);
    scene.add(hemiLight1);

    // const hemiLight1 = new THREE.HemisphereLight(0xffffff, 0xffffff);
    // hemiLight.position.set(100, 200, 0);
    // scene.add(hemiLight1);


    const dirLight = new THREE.DirectionalLight(0xffffff);
    dirLight.position.set(0, 2000, 10);
    scene.add(dirLight);
    const dirLight1 = new THREE.DirectionalLight(0xffffff);
    dirLight1.position.set(0, 10, 2000);
    scene.add(dirLight1);
    const dirLight2 = new THREE.DirectionalLight(0xffffff);
    dirLight2.position.set(1000, 1000, 0);
    scene.add(dirLight2);
    const dirLight3 = new THREE.DirectionalLight(0xffffff);
    dirLight3.position.set(-1000, 1000, 0);
    scene.add(dirLight3);
    // renderer

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);

    renderer.setSize(window.innerWidth, window.innerHeight);

    renderer.outputEncoding = THREE.sRGBEncoding;
    if (container.childNodes.length == 0) {
      container.appendChild(renderer.domElement);
    }

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
    // initSet();


    initPoints()

  }

  // height , width , heightInterp , widthInterp
  const neckConfig = { sitnum1: 5, sitnum2: 24, sitInterp: 4, sitInterp1: 1, sitOrder: 3, }
  const backConfig = { sitnum1: 9, sitnum2: 24, sitInterp: 4, sitInterp1: 1, sitOrder: 3 }
  const sitConfig = { sitnum1: 10, sitnum2: 24, sitInterp: 4, sitInterp1: 1, sitOrder: 3 }
  const handLeftConfig = { sitnum1: 4, sitnum2: 4, sitInterp: 4, sitInterp1: 2, sitOrder: 1 }
  const handRightConfig = { sitnum1: 4, sitnum2: 4, sitInterp: 4, sitInterp1: 2, sitOrder: 1 }

  function addTotal(objArr) {
    objArr.forEach((obj) => {
      const { sitnum1, sitnum2, sitInterp, sitInterp1, sitOrder } = obj
      const AMOUNTX = sitnum1 * sitInterp + sitOrder * 2;
      const AMOUNTY = sitnum2 * sitInterp1 + sitOrder * 2;
      const numParticles = AMOUNTX * AMOUNTY;
      obj.total = numParticles
    })
  }

  addTotal([neckConfig,backConfig,sitConfig,handLeftConfig,handRightConfig])
  const xValue = 0.3
  const yValue = 0.1
  const zValue = -3
  let allConfig = {
    neck: {
      dataConfig: neckConfig,
      name: 'neck',
      pointConfig: { position: [xValue, yValue, -17 + zValue], rotation: [] },
    },
    back: {
      dataConfig: backConfig,
      name: 'back',
      pointConfig: { position: [2.3 + xValue + 2.8, yValue, -11 + zValue], rotation: [] },
    },
    sit: {
      dataConfig: sitConfig,
      name: 'sit',
      pointConfig: { position: [3 + 2.8 + 0.3, yValue, 2 + zValue], rotation: [] },
    },
    handLeft: {
      dataConfig: handLeftConfig,
      name: 'handLeft',
      pointConfig: { position: [-6, yValue, -5 + zValue], rotation: [0, -Math.PI * 2 / 12, 0] },
    },
    handRight: {
      dataConfig: handRightConfig,
      name: 'handRight',
      pointConfig: { position: [13, yValue, -5 + zValue], rotation: [0,  Math.PI * 2 / 12, 0] },
    }
  }

  function initPoints() {
    Object.keys(allConfig).forEach((key) => {
      const obj = allConfig[key]
      initPoint(obj.dataConfig, obj.pointConfig, obj.name, pointGroup)
    })
  }
  pointGroup.position.x = -3.5
  //   初始化座椅


  const initPoint = (config, pointConfig, name, group) => {
    const { sitnum1, sitnum2, sitInterp, sitInterp1, sitOrder } = config
    const { position, rotation } = pointConfig
    const AMOUNTX = sitnum1 * sitInterp + sitOrder * 2;
    const AMOUNTY = sitnum2 * sitInterp1 + sitOrder * 2;
    const numParticles = AMOUNTX * AMOUNTY;
    const positions = new Float32Array(numParticles * 3);
    const scales = new Float32Array(numParticles);
    const colors = new Float32Array(numParticles * 3);

    let i = 0,
      j = 0;

    for (let ix = 0; ix < AMOUNTX; ix++) {
      for (let iy = 0; iy < AMOUNTY; iy++) {
        positions[i] = iy * SEPARATION - (AMOUNTX * SEPARATION) / 2; // x
        positions[i + 1] = 0; // y
        positions[i + 2] = ix * SEPARATION - (AMOUNTY * SEPARATION) / 2; // z

        scales[j] = 1;
        colors[i] = 0 / 255;
        colors[i + 1] = 0 / 255;
        colors[i + 2] = 255 / 255;
        i += 3;
        j++;
      }
    }

    const sitGeometry = new THREE.BufferGeometry();
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
    const material = new THREE.PointsMaterial({
      vertexColors: true,
      transparent: true,
      map: spite,
      size: 1,
    });
    sitGeometry.setAttribute("scale", new THREE.BufferAttribute(scales, 1));
    sitGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const particles = new THREE.Points(sitGeometry, material);

    particles.scale.x = 0.003;
    particles.scale.y = 0.003;
    particles.scale.z = 0.003;

    // particles.position.z = 0
    // particles.position.y = 0
    // particles.position.x = 0
    if (position.length) particles.position.set(...position)
    if (rotation.length) particles.rotation.set(...rotation)
    particles.name = name
    group.add(particles);
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



  // var ndata2
  //  更新座椅数据
  function sitRenew(config, name, ndata1, smoothBig) {
    // console.log(ndata1)
    const { sitnum1, sitnum2, sitInterp, sitInterp1, sitOrder } = config
    const AMOUNTX = sitnum1 * sitInterp + sitOrder * 2;
    const AMOUNTY = sitnum2 * sitInterp1 + sitOrder * 2;


    // const AMOUNTX = sitnum1 * sitInterp   //height
    // const AMOUNTY = sitnum2 * sitInterp1 //width

    const numParticles = AMOUNTX * AMOUNTY;
    const particles = pointGroup.children.find((a) => a.name == name)
    const { geometry } = particles
    const position = new Float32Array(numParticles * 3);
    const color = new Float32Array(numParticles * 3);


    // height , width , heightInterp , widthInterp
    // export function interpSmall(smallMat, width, height, interp1, interp2)

    let bigArr = interpSmall(ndata1, sitnum2, sitnum1, sitInterp1, sitInterp)
    let bigArrs = addSide(
      bigArr,
      sitnum2 * sitInterp1,
      sitnum1 * sitInterp,
      sitOrder,
      sitOrder
    );
    let bigArrg = gaussBlur_return(
      bigArrs,
      sitnum2 * sitInterp1 + sitOrder * 2,
      sitnum1 * sitInterp + sitOrder * 2,
      valueg1
    );


    let k = 0, l = 0;
    let dataArr = []
    for (let ix = 0; ix < AMOUNTX; ix++) {
      for (let iy = 0; iy < AMOUNTY; iy++) {
        const value = bigArrg[l] * 10;
        //柔化处理smooth
        smoothBig[l] = smoothBig[l] + (value - smoothBig[l] + 0.5) / valuel1;

        position[k] = iy * SEPARATION - (AMOUNTX * SEPARATION) / 2; // x

        position[k + 1] = smoothBig[l] * value1; // y

        position[k + 2] = ix * SEPARATION - (AMOUNTY * SEPARATION) / 2; // z 

        let rgb
        // if (value < 50) {
        //   position[k] = 0;
        //   position[k + 1] = 0; // y
        //   position[k + 2] = 0; // z
        // }


        rgb = jetWhite3(0, valuej1, smoothBig[l]);




        color[k] = rgb[0] / 255;
        color[k + 1] = rgb[1] / 255;
        color[k + 2] = rgb[2] / 255;

        // if (value > 10) {
        //   color[k] = 255 / 255;
        //   color[k + 1] = 0 / 255;
        //   color[k + 2] = 0 / 255;
        // }

        k += 3;
        l++;
      }
    }




    particles.geometry.attributes.position.needsUpdate = true;
    particles.geometry.attributes.color.needsUpdate = true;
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(position, 3)
    );
    geometry.setAttribute("color", new THREE.BufferAttribute(color, 3));
  }

  function render() {
    const handLeft = ndata1.slice(0, 16)
    const handRight = ndata1.slice(16, 32)
    const neck = ndata1.slice(32, 32 + 24 * 5)
    const back = ndata1.slice(32 + 24 * 5, 32 + 24 * 14)
    const sit = ndata1.slice(32 + 24 * 14, 32 + 24 * 24)

    const data = {
      neck, back, sit, handLeft, handRight
    }
    const smoothBig = {
      neck: new Array(neckConfig.total).fill(1),
      back: new Array(backConfig.total).fill(1),
      sit: new Array(sitConfig.total).fill(1),
      handLeft: new Array(handLeftConfig.total).fill(1),
      handRight: new Array(handRightConfig.total).fill(1)
    }
    Object.keys(allConfig).forEach((key) => {
      const obj = allConfig[key]
      sitRenew(obj.dataConfig, obj.name, data[obj.name], smoothBig[obj.name]);
    })

    let dataArr = ndata1
    //  if (!sitIndexArr.length || sitIndexArr.every((a) => a == 0)) {
    //   dataArr = ndata1
    // }


    var T = clock.getDelta();
    timeS = timeS + T;
    if (timeS > renderT) {

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
    console.log(ndata1, 111)
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
    // valuej1 = valuej;
    // valueg1 = valueg;
    // value1 = value;
    // valuel1 = valuel;
    // valuef1 = valuef;
    // ndata1 = [];
    ndata1 = wsPointData;

    // valuelInit1 = valuelInit;
    // 修改线序 坐垫
    ndata1 = ndata1.map((a, index) => (a - valuef1 < 0 ? 0 : a - valuef1));

    ndata1Num = ndata1.reduce((a, b) => a + b, 0);

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




  useImperativeHandle(refs, () => ({
    sitData,
    changeDataFlag: changeDataFlag,
    changePointRotation,
    changeBox,
    cancelSelect,
    sitValue
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
      cleanupThree({ renderer, scene, controls });
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
