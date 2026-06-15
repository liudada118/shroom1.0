import Stats from "three/examples/jsm/libs/stats.module.js";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
// import { FlyControls } from 'three/examples/jsm/controls/FlyControls.js';
import { TrackballControls } from "three/examples/jsm/controls/TrackballControls";
// import { SelectionBox } from 'three/addons/interactive/SelectionBox.js';
// import { SelectionHelper } from 'three/addons/interactive/SelectionHelper.js';
import React, { useEffect, useImperativeHandle, useRef, useState } from "react";
import { TextureLoader } from "three";
import {
  addSide,
  gaussBlur_1,
  interp,
  interp1016,
  jet,
} from "../../assets/util/util";
import { checkRectIndex, checkRectangleIntersection, getPointCoordinate, getPointCoordinateback } from "./threeUtil1";
// import { withData } from "./WithData";

import { obj } from "../../assets/util/config";
import { SelectionHelper } from "./SelectionHelper";
const group = new THREE.Group();


var newDiv, newDiv1, selectStartArr = [], selectEndArr = [], sitArr, backArr, sitMatrix = [], backMatrix = [], selectMatrix = [], selectHelper
let sitIndexArr = [], backIndexArr = []
const sitInit = 0;
const backInit = 0;
var animationRequestId
const sitnum1 = 10;
const sitnum2 = 10;
const sitInterp = 4;
const sitOrder = 2;
const backnum1 = 16;
const backnum2 = 32;
const backInterp = 2;
const backOrder = 2;
let controlsFlag = true;
var ndata = new Array(backnum1 * backnum2).fill(0), ndata1 = new Array(sitnum1 * sitnum2).fill(0),selectHelper;

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
let enableControls = true;
let isShiftPressed = false;

const groupX = -10
const groupY = -20

const Canvas = React.forwardRef((props, refs) => {
  let dataFlag = false;
  const changeDataFlag = () => {
    dataFlag = true;

  };
  let particles,
    particles1,
    material,
    backGeometry,
    sitGeometry,

    bigArr1 = new Array(backnum1 * backInterp * backnum2 * backInterp).fill(1),
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

  let camera, scene, renderer;
  let controls;
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
  let group = new THREE.Group();

  let positions1;
  let colors1, scales1;
  let positions;
  let colors, scales;

  function init() {
    // 清空 group 中的旧粒子，防止重复 add 导致双层
    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }
    container = document.getElementById(`canvas`);
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

    initSet();
    // initBack();
    // scene.add(group);
    // group.rotation.x = -(Math.PI * 2) / 12
    // group.position.x = -15
    // group.position.y = 150
    // group.position.z = 230
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
    container.replaceChildren(renderer.domElement);

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

    renderer.domElement.addEventListener(
      "click",
      () => {

      },
      false
    );

    selectHelper = new SelectionHelper(renderer, controls, 'selectBox');

    document.addEventListener('pointerdown', pointDown);

    document.addEventListener('pointermove', pointMove);

    document.addEventListener('pointerup', pointUp);

  }

  function pointDown(event) {
    if (selectHelper.isShiftPressed) {
      sitIndexArr = []
      backIndexArr = []
      props.changeSelect({ sit: sitIndexArr, back: backIndexArr })
      selectStartArr = [(event.clientX), event.clientY]

      sitArr = getPointCoordinate({ particles, camera, position: { x: groupX, y: groupY, z: 0 } })
      // backArr = getPointCoordinateback({ particles: particles1, camera, position: { x: groupX, y: groupY, z: 0 }, width: AMOUNTX1 })

      sitMatrix = [sitArr[0].x, sitArr[0].y, sitArr[1].x, sitArr[1].y]
      // backMatrix = [backArr[1].x, backArr[1].y, backArr[0].x, backArr[0].y]
    }
  }

  function pointMove(event) {
    // console.log(first)
    if (selectHelper.isShiftPressed) {


      selectEndArr = [(event.clientX), event.clientY,]



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

        if (sitInterArr) sitIndexArr = checkRectIndex(sitMatrix, sitInterArr, AMOUNTX, AMOUNTY)
        if (backInterArr) {
          backIndexArr = checkRectIndex(backMatrix, backInterArr, AMOUNTX1, AMOUNTY1)
         
        }
        console.log(sitIndexArr)
        props.changeSelect({ sit: sitIndexArr, back: backIndexArr })
      }

    }
  }

  function pointUp(event) {
    if (selectHelper.isShiftPressed) {
      selectStartArr = []
      selectEndArr = []
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
        positions[i] = ix * SEPARATION - (AMOUNTX * SEPARATION) / 2 ; // x
        positions[i + 1] = 0; // y
        positions[i + 2] = iy * SEPARATION - (AMOUNTY * SEPARATION) / 2 + iy * 30; // z

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
      size: 2,
    });
    sitGeometry.setAttribute("scale", new THREE.BufferAttribute(scales, 1));
    sitGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    particles = new THREE.Points(sitGeometry, material);

    particles.scale.x = 0.0062;
    particles.scale.y = 0.0062;
    particles.scale.z = 0.0062;


    
    group.add(particles);

  }
  // 初始化靠背
  // function initBack() {
  //   // points 靠背
  //   const numParticles1 = AMOUNTX1 * AMOUNTY1;

  //   positions1 = new Float32Array(numParticles1 * 3);
  //   scales1 = new Float32Array(numParticles1);
  //   colors1 = new Float32Array(numParticles1 * 3);
  //   let k = 0,
  //     l = 0;

  //   for (let ix = 0; ix < AMOUNTX1; ix++) {
  //     for (let iy = 0; iy < AMOUNTY1; iy++) {
  //       positions1[k] = ix * SEPARATION - (AMOUNTX1 * SEPARATION) / 2; // x
  //       positions1[k + 1] = 0; // y
  //       positions1[k + 2] = iy * SEPARATION - (AMOUNTY1 * SEPARATION) / 2; // z

  //       scales1[l] = 1;
  //       colors1[k] = 0 / 255;
  //       colors1[k + 1] = 0 / 255;
  //       colors1[k + 2] = 255 / 255;
  //       k += 3;
  //       l++;
  //     }
  //   }

  //   backGeometry = new THREE.BufferGeometry();
  //   backGeometry.setAttribute(
  //     "position",
  //     new THREE.BufferAttribute(positions1, 3)
  //   );
  //   backGeometry.setAttribute("scale", new THREE.BufferAttribute(scales1, 1));
  //   backGeometry.setAttribute("color", new THREE.BufferAttribute(colors1, 3));
  //   const spite = new THREE.TextureLoader().load("./circle.png");
  //   const material1 = new THREE.PointsMaterial({
  //     vertexColors: true,
  //     transparent: true,
  //     map: spite,
  //     size: 2,
  //   });

  //   particles1 = new THREE.Points(backGeometry, material1);
  //   particles1.geometry.attributes.position.needsUpdate = true;
  //   particles1.geometry.attributes.color.needsUpdate = true;

  //   particles1.scale.x = 0.0062;
  //   particles1.scale.y = 0.0062;
  //   particles1.scale.z = 0.0062;


  //   particles1.position.x = 30;
  //   particles1.rotation.x = Math.PI / 2
  //   // particles1.rotation.y = Math.PI 
  //   // particles1.rotation.z = Math.PI
  //   // scene.add(particles1);
  //   group.add(particles1);
  // }
  //

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
    // console.log(valuej1)
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

    for (let ix = 0; ix < AMOUNTX; ix++) {
      for (let iy = 0; iy < AMOUNTY; iy++) {
        const value = bigArrg[l] * 10;

        //柔化处理smooth
        smoothBig[l] = smoothBig[l] + (value - smoothBig[l] + 0.5) / valuel1;

        // positions[k] = ix * SEPARATION - (AMOUNTX * SEPARATION) / 2; // x
        positions[k + 1] = smoothBig[l] * value1; // y
        // positions[k + 2] = iy * SEPARATION - (AMOUNTY * SEPARATION) / 2; // z
        const rgb = jet(0, valuej1, smoothBig[l]);

        colors[k] = rgb[0] / 255;
        colors[k + 1] = rgb[1] / 255;
        colors[k + 2] = rgb[2] / 255;

        k += 3;
        l++;
      }
    }

    particles.geometry.attributes.position.needsUpdate = true;
    particles.geometry.attributes.color.needsUpdate = true;

    sitGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3)
    );
    sitGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  }

  function changeSelectFlag(value) {
    controlsFlag = value
    selectHelper.isShiftPressed = !value
  }

  function render() {
    // console.log(enableControls , !isShiftPressed)
    sitRenew();
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
      // console.log('111')
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
    ndata1 = ndata1.map((a, index) => (a - valuef1 < 0 ? 0 : a));

    ndata1Num = ndata1.reduce((a, b) => a + b, 0);
    if (ndata1Num < valuelInit1) {
      ndata1 = new Array(sitnum1 * sitnum2).fill(0);
    }
    console.log(ndata1, 111)
  }
  function sitData(prop) {

    if (i < 50) {
      i++;
    } else {
      i = 0;
    }
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
    ndata1 = ndata1.map((a, index) => (a - valuef1 < 0 ? 0 : a));

    ndata1Num = ndata1.reduce((a, b) => a + b, 0);

    if (ndata1Num < valuelInit) {
      ndata1 = new Array(sitnum1 * sitnum2).fill(0);
    }
    // console.log(ndata1)
  }

  function changeGroupRotate(obj) {
    console.log(group.rotation)
    if (typeof obj.x === 'number') {
      group.rotation.x = -(Math.PI * 2 + (obj.x) * 4) / 12
    }
    if (typeof obj.y === 'number') {
      group.rotation.y = -(obj.y) * 6 / 12
    }
  }

  function reset() {
    console.log(camera)
    console.log(111111)
    camera.position.z = 300;
    camera.position.y = 200;
    camera.position.x = 0;
    camera.rotation._x = 0;
    camera.rotation._y = 0;
    camera.rotation._z = 0;

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
    group.position.x = -15
    group.position.y = 150
    group.position.z = 230
  }

  useImperativeHandle(refs, () => ({
    backData: backData,
    sitData: sitData,
    changeDataFlag: changeDataFlag,
    sitValue,
    backValue,
    // backRenew,
    sitRenew,
    changeGroupRotate,
    reset,
    changeSelectFlag
    // actionAll: actionAll,
    // actionSit: actionSit,
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

 



  const changeValue = (obj) => { };
  useEffect(() => {
    // 靠垫数据

    init();
    // window.addEventListener("mousemove", () => {}, false);
    animate();


    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    return () => { 
      cancelAnimationFrame(animationRequestId);
    };
  }, []);
  return (
    <div>
      <div
        // style={{ width: "100%", height: "100%" }}
        id={`canvas`}
      ></div>
    </div>
  );
});
export default Canvas;
