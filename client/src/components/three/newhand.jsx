import Stats from "three/examples/jsm/libs/stats.module.js";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
// import { FlyControls } from 'three/examples/jsm/controls/FlyControls.js';
import { TrackballControls } from "three/examples/jsm/controls/TrackballControls";
// import { SelectionBox } from 'three/addons/interactive/SelectionBox.js';
// import { SelectionHelper } from 'three/addons/interactive/SelectionHelper.js';
import { SelectionHelper } from "./SelectionHelper";
import React, { useEffect, useImperativeHandle, useRef, useState } from "react";
import { TextureLoader } from "three";
import { checkRectIndex, checkRectangleIntersection, getPointCoordinate, getPointCoordinateback } from "./threeUtil1";
import {
  addSide,
  findMax,
  gaussBlur_1,
  interp,
  interp1016,
  jet,
  jetgGrey,
  rotate90,
} from "../../assets/util/util";
// import { withData } from "./WithData";

import { obj } from "../../assets/util/config";
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
    initHand()
    // initBack();
    // scene.add(group);
    // group.rotation.x = -(Math.PI * 2) / 12
    group.position.x = groupX
    group.position.y = groupY
    group.position.z = groupZ
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
      size: 1,
    });
    sitGeometry.setAttribute("scale", new THREE.BufferAttribute(scales, 1));
    sitGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    particles = new THREE.Points(sitGeometry, material);

    particles.scale.x = 0.0062;
    particles.scale.y = 0.0062;
    particles.scale.z = 0.0062;


    particles.rotation.x = Math.PI / 3;
    // particles.rotation.y = 0; //-Math.PI / 2;
    // particles.rotation.y = Math.PI 
    // particles.rotation.z = Math.PI
    // scene.add(particles);
    group.add(particles);

  }

  // 初始化手图片
  function initHand() {
    // handGeometry = new THREE.PlaneGeometry(10,10)
    const hand = new THREE.TextureLoader().load("./hand.png");
    // console.log('inithand')
    // handMaterial = new THREE.MeshBasicMaterial({
    //   // vertexColors: true,
    //   // transparent: true,
    //   //   color: 0xffffff,
    //   map: hand,
    //   // size: 10000,
    // });
    const geometry = new THREE.PlaneGeometry(35, 48);
    const material = new THREE.MeshBasicMaterial({ color: 0x666, map: hand, transparent: true,});
    // const geometry = new THREE.PlaneGeometry(35, 35*1.9);
    // const material = new THREE.MeshBasicMaterial({  map: hand, transparent: true,});
    const plane = new THREE.Mesh(geometry, material);
    plane.rotation.x = - Math.PI * 1 / 6;
    plane.position.y = -3;
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

  //  更新座椅数据
  function sitRenew() {
    // console.log(props)
    // valueg1 = 2
    // valuej1 = 500 
    // value1 =2
    
    initndata1Data()

    interp(ndata1, bigArr, sitnum1, sitInterp);
    
    // console.log(first)
    let bigArrs = addSide(
      bigArr,
      sitnum2 * sitInterp,
      sitnum1 * sitInterp,
      sitOrder,
      sitOrder
    );


    interp(ndata2, bigArrhand, sitnum1, sitInterp);
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
      1.2
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
        const valuehand = bigArrshand[l]*10
        //柔化处理smooth
        smoothBig[l] = smoothBig[l] + (value - smoothBig[l] + 0.5) / valuel1;

        positions[k] = ix * SEPARATION - (AMOUNTX * SEPARATION) / 2; // x
        positions[k + 1] = smoothBig[l] * value1; // y
        positions[k + 2] = iy * SEPARATION - (AMOUNTY * SEPARATION) / 2; // z
        // console.log(value)
        if(valuehand < 50){
          positions[k + 1] = -100000
          positions[k] = 0 
          positions[k + 2] = 0
        }
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
