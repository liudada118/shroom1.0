import Stats from "three/examples/jsm/libs/stats.module.js";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
// import { FlyControls } from 'three/examples/jsm/controls/FlyControls.js';
import { TrackballControls } from "three/examples/jsm/controls/TrackballControls";
// import { SelectionBox } from 'three/addons/interactive/SelectionBox.js';

import React, { useEffect, useImperativeHandle, useRef, useState } from "react";
import { TextureLoader } from "three";
import {
  addSide,
  findMax,
  gaussBlur_1,
  gaussBlur_return,
  interp,
  interp1016,
  interpSmall,
  jet,
  jetgGrey,
  jetWhite3,
  rotate90,
} from "../../assets/util/util";
// import { withData } from "./WithData";

import { obj } from "../../assets/util/config";
import { pressData } from "../../assets/util/matrixToPress";
const group = new THREE.Group();
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

const Canvas = React.forwardRef((props, refs) => {
  console.log('render')
  local = props.local

  var newDiv, newDiv1, selectStartArr = [], selectEndArr = [], sitArr, backArr, sitMatrix = [], backMatrix = [], selectMatrix = [], selectHelper = {}//new SelectionHelper(renderer, controls, 'selectBox');
  let sitIndexArr = [], sitIndexEndArr = [], backIndexArr = [], backIndexEndArr = []
  var animationRequestId, colSelectFlag = false
  let dataFlag = false;
  const changeDataFlag = () => {
    dataFlag = true;

  };
  let particles,
    particles1,
    material,
    backGeometry,
    sitGeometry,
    handGeometry,
    handParticles,
    handMaterial,

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
  let bigArrhand = new Array(sitnum1 * sitInterp * sitnum2 * sitInterp).fill(1);
  let bigArrg = new Array(
    (sitnum1 * sitInterp + sitOrder * 2) *
    (sitnum2 * sitInterp + sitOrder * 2)
  ).fill(1),

    bigArrshand = new Array(
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
  let pointGroup = new THREE.Group();

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
  const groupX = 5, groupY = 150, groupZ = 230
  let positions1;
  let colors1, scales1;
  let positions;
  let colors, scales;
  let helper
  function init() {
    container = document.getElementById(`canvas`);
    // camera

    camera = new THREE.PerspectiveCamera(
      40,
      window.innerWidth / window.innerHeight,
      1,
      150000
    );


    camera.position.z = 70;
    camera.position.y = 1;
    //   camera.position.x = 200;

    // scene

    scene = new THREE.Scene();

    // model
    const loader = new GLTFLoader();

    // points  座椅

    // initSet();
    initPoints()
    initHand('left', './footleft.png')
    initHand('right', './foot.png')
    // initBack();
    // scene.add(group);
    // group.rotation.x = -(Math.PI * 2) / 12
    // group.position.x = groupX
    // group.position.y = groupY
    // group.position.z = groupZ
    scene.add(group);
    scene.add(pointGroup);
    pointGroup.position.y = 8
    pointGroup.position.x = 2
    helper = new THREE.GridHelper(3000, 1000);
    helper.position.z = -10;
    helper.rotation.x = Math.PI / 2;
    helper.material.opacity = 0.15;

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

    renderer.outputColorSpace = THREE.SRGBColorSpace;
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







  }

  const leftConfig = { sitnum1: 64, sitnum2: 32, sitInterp: 1, sitInterp1: 1, sitOrder: 3, }
  const rightConfig = { sitnum1: 64, sitnum2: 32, sitInterp: 1, sitInterp1: 1, sitOrder: 3 }

  function addTotal(objArr) {
    objArr.forEach((obj) => {
      const { sitnum1, sitnum2, sitInterp, sitInterp1, sitOrder } = obj
      const AMOUNTX = sitnum1 * sitInterp + sitOrder * 2;
      const AMOUNTY = sitnum2 * sitInterp1 + sitOrder * 2;
      const numParticles = AMOUNTX * AMOUNTY;
      obj.total = numParticles
    })
  }

  addTotal([leftConfig, rightConfig])


  let allConfig = {
    left: {
      dataConfig: leftConfig,
      name: 'left',
      pointConfig: { position: [-5, 0, 0], rotation: [Math.PI / 2, 0, 0] },
    },
    right: {
      dataConfig: rightConfig,
      name: 'right',
      pointConfig: { position: [20, 0, 0], rotation: [Math.PI / 2, 0, 0] },
    },
  }

  function initPoints() {
    Object.keys(allConfig).forEach((key) => {
      const obj = allConfig[key]
      initPoint(obj.dataConfig, obj.pointConfig, obj.name, pointGroup)
    })
  }



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

    particles.scale.x = 0.007 / 1.2;
    particles.scale.y = 0.005 / 1.2;
    particles.scale.z = 0.007 / 1.2;

    // particles.position.z = 0
    // particles.position.y = 0
    // particles.position.x = 0
    if (position.length) particles.position.set(...position)
    if (rotation.length) particles.rotation.set(...rotation)
    particles.name = name
    group.add(particles);
  }

  // 初始化手图片
  function initHand(name, imgsrc) {
    // handGeometry = new THREE.PlaneGeometry(10,10)
    const hand = new THREE.TextureLoader().load(imgsrc);
    // console.log('inithand')
    // handMaterial = new THREE.MeshBasicMaterial({
    //   // vertexColors: true,
    //   // transparent: true,
    //   //   color: 0xffffff,
    //   map: hand,
    //   // size: 10000,
    // });
    const geometry = new THREE.PlaneGeometry(35, 35);
    const material = new THREE.MeshBasicMaterial({ color: 0x666, map: hand, transparent: true, });
    // const geometry = new THREE.PlaneGeometry(35, 35*1.9);
    // const material = new THREE.MeshBasicMaterial({  map: hand, transparent: true,});
    const plane = new THREE.Mesh(geometry, material);
    // plane.rotation.x = - Math.PI * 1 / 6;
    plane.position.y = 0;
    // plane.position.z = 100;

    if (name == 'left') {
      plane.position.x = -10;
    } else {
      plane.position.x = 10;
    }
    // handParticles = new THREE.Points(handGeometry, handMaterial);
    group.add(plane);
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
  var ndata2
  function initndata1Data() {
    const handPointArr = [
      [4, 5], [4, 6], [2, 8], [2, 9], [1, 12], [1, 13], [2, 16], [2, 17], [14, 25], [14, 26],
      [8, 5], [8, 6], [6, 9], [6, 10], [6, 12], [6, 13], [6, 16], [6, 17], [18, 24], [18, 25],
      [11, 6], [11, 7], [10, 9], [10, 10], [10, 12], [10, 13], [10, 15], [10, 16], [22, 23], [22, 24],
      [17, 8], [17, 9], [17, 10], [17, 11], [17, 12], [17, 13], [17, 14], [17, 15],
      [18, 8], [18, 9], [18, 10], [18, 11], [18, 12], [18, 13], [18, 14], [18, 15],
      [21, 8], [21, 9], [21, 10], [21, 11], [21, 12], [21, 13], [21, 14], [21, 15],
      [24, 8], [24, 9], [24, 10], [24, 11], [24, 12], [24, 13], [24, 14], [24, 15]
    ]


    let newZeroArr = new Array(1024).fill(0)
    // for(let i = 0 ; i < )
    handPointArr.forEach((a, index) => {

      newZeroArr[a[0] * 32 + a[1]] = 5
      newZeroArr[(a[0] + 1) * 32 + a[1]] = 5
      newZeroArr[(a[0] + 2) * 32 + a[1]] = 5
    })
    newZeroArr = rotate90(newZeroArr, 32, 32)
    ndata2 = newZeroArr
  }

  function sitRenew(config, name, ndata1, smoothBig) {
    // console.log(ndata1)
    const { sitnum1, sitnum2, sitInterp, sitInterp1, sitOrder } = config
    const AMOUNTX = sitnum1 * sitInterp + sitOrder * 2;
    const AMOUNTY = sitnum2 * sitInterp1 + sitOrder * 2;
    const numParticles = AMOUNTX * AMOUNTY;
    const particles = pointGroup.children.find((a) => a.name == name)
    const { geometry } = particles
    const position = new Float32Array(numParticles * 3);
    const color = new Float32Array(numParticles * 3);


    let bigArr = interpSmall(ndata1, sitnum1, sitnum2, sitInterp, sitInterp1)
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

        // if (sitIndexArr && !sitIndexArr.every((a) => a == 0)) {
        //   if (ix >= sitIndexArr[0] && ix < sitIndexArr[1] && iy >= sitIndexArr[2] && iy < sitIndexArr[3]) {
        //     rgb = jetWhite3(0, valuej1, smoothBig[l]);
        //     dataArr.push(bigArrg[l])
        //   } else {
        //     rgb = jetgGrey(0, valuej1, smoothBig[l]);
        //   }
        // } else {
        rgb = jetWhite3(0, valuej1, smoothBig[l]);
        // }

        if (value < 100) {
          position[k + 1] = -10000
          position[k] = 0
          position[k + 2] = 0
        }

        color[k] = rgb[0] / 255;
        color[k + 1] = rgb[1] / 255;
        color[k + 2] = rgb[2] / 255;

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

  const layoutData = (dataArrObj) => {

    const { left, right } = dataArrObj
    const footPointArr = [
      [8, 10], [8, 13], [8, 16], [8, 19], [8, 21], [8, 24],
      [13, 8], [13, 11], [13, 15], [13, 18], [13, 22], [13, 25],
      [18, 7], [18, 11], [18, 14], [18, 18], [18, 22], [18, 25],
      [23, 7], [23, 10], [23, 14], [23, 17], [23, 20], [23, 23],
      [28, 7], [28, 10], [28, 13], [28, 16], [28, 18], [28, 21],
      [33, 8], [33, 11], [33, 13], [33, 15], [33, 18], [33, 20],
      [38, 9], [38, 11], [38, 13], [38, 16], [38, 19], [38, 21],
      [43, 9], [43, 11], [43, 14], [43, 17], [43, 19], [43, 22],
      [48, 10], [48, 12], [48, 14], [48, 17], [48, 19], [48, 22],
      [53, 11], [53, 13], [53, 15], [53, 17], [53, 19], [53, 21]]

    const newArr = []
    footPointArr.forEach((a, index) => {
      const newIndex = a[0] * 32 + a[1]
      const leftValue = left[newIndex] ? left[newIndex] : 0
      const rightValue = right[newIndex] ? right[newIndex] : 0
      newArr.push(leftValue, rightValue)
    })
    console.log(newArr)
    const dataArr = [...newArr]

    // dataArr = dataArr.filter((a) => a > valuej1 * 0.025)
    const max = findMax(dataArr)
    const point = dataArr.filter((a) => a > 0).length
    let press = dataArr.reduce((a, b) => a + b, 0)
    // press = Math.floor(press) * 3
    press = press > 724 ? parseInt((pressData[724] * (press / 724)).toFixed(2)) : pressData[press]
    const mean = press / (point == 0 ? 1 : point)
    props.data.current?.changeData({
      meanPres: mean.toFixed(2),
      maxPres: max,
      point: point,
      // area: areaSmooth.toFixed(0),
      totalPres: `${press} N`,
      // pressure: pressureSmooth.toFixed(2),
    });

    if (totalArr.length < 60) {
      totalArr.push(press);
    } else {
      totalArr.shift();
      totalArr.push(press);
    }

    const maxTotal = findMax(totalArr);

    if (!local) {
      props.data.current?.handleCharts(totalArr, maxTotal + 20);

    }
    if (totalPointArr.length < 60) {
      totalPointArr.push(point);
    } else {
      totalPointArr.shift();
      totalPointArr.push(point);
    }

    const max1 = findMax(totalPointArr);
    if (!local)
      props.data.current?.handleChartsArea(totalPointArr, max1 + 20);
    // timeS = 0;


  }

  function render() {

    // sitRenew();

    const data = {
      left: ndata1,
      right: ndata
    }
    var T = clock.getDelta();
    timeS = timeS + T;
    if (timeS > renderT) {
      layoutData(data)
      timeS = 0;
    }



    const smoothBig = {
      left: new Array(leftConfig.total).fill(1),
      right: new Array(rightConfig.total).fill(1),

    }
    Object.keys(allConfig).forEach((key) => {
      const obj = allConfig[key]
      sitRenew(obj.dataConfig, obj.name, data[obj.name], smoothBig[obj.name]);
    })

    helper.position.y -= 0.01
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
    if (wsPointData) {
      ndata = wsPointData
      // 修改线序 坐垫
      ndataNum = ndata.reduce((a, b) => a + b, 0);
      ndata = ndata.map((a, index) => (a - valuef2 < 0 ? 0 : a - valuef2));
    }


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

  function changeGroupRotate(obj) {

    if (typeof obj.x === 'number') {
      group.rotation.x = -((obj.x) * 6) / 12
    }
    if (typeof obj.z === 'number') {
      particles.rotation.z = (obj.z) * 6 / 12
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

    // group.rotation.x = -(Math.PI * 2) / 12
    group.rotation.y = 0
    // group.position.x = -15
    // group.position.y = 150
    // group.position.z = 230
  }

  useImperativeHandle(refs, () => ({
    backData: backData,
    sitData: sitData,
    changeDataFlag: changeDataFlag,
    sitValue,
    backValue,
    changeSelectFlag,
    // backRenew,
    sitRenew,
    changeGroupRotate,
    reset
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
