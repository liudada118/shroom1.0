import Stats from "three/examples/jsm/libs/stats.module.js";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
// import { FlyControls } from 'three/examples/jsm/controls/FlyControls.js';
import { TrackballControls } from "three/examples/jsm/controls/TrackballControls";
// import { SelectionBox } from 'three/addons/interactive/SelectionBox.js';
// import { SelectionHelper } from 'three/addons/interactive/SelectionHelper.js';
import React, { useEffect, useImperativeHandle, useRef, useState } from "react";
import { TextureLoader } from "three";
import { checkRectIndex, checkRectangleIntersection, getPointCoordinate, getPointCoordinateback } from "./threeUtil1";
import { SelectionHelper } from './SelectionHelper.js';
import {
  addSide,
  gaussBlur_1,
  interp1016,
  jet,
  jetWhite2,
  jetgGrey,
  findMax,
  interp,
  interpSmall,
  initValue,
  jetWhite4,
} from "../../assets/util/util";

import './index.scss'
import { calculatePressure, press, pressSmallBed } from "../../assets/util/line";



const Canvas = React.forwardRef((props, refs) => {

  let dataArr
const group = new THREE.Group();
const sitInit = 0;
const backInit = 0;
var newDiv, smoothValue = 0
var animationRequestId
const sitnum1 = 32;
const sitnum2 = 32;
const sitInterp = 2;
const sitOrder = 4;
const sitInterpX = sitInterp * 2;
const sitInterpY = sitInterp;
const sitOrderX = sitOrder * 2;
const sitOrderY = sitOrder;
let totalArr = [],
  totalPointArr = [];
let compen1 = localStorage.getItem('compen') ? JSON.parse(localStorage.getItem('compen')) : 0
let pressValue = localStorage.getItem('press') ? JSON.parse(localStorage.getItem('press')) : 0
let controlsFlag = true;
var newData1 = new Array(sitnum1 * sitnum2).fill(0), ndata1 = new Array(sitnum1 * sitnum2).fill(0), centerFlag = true;

var valuej1 = initValue.valuej1,
  valueg1 = initValue.valueg1,
  value1 = initValue.value1,
  valuel1 = initValue.valuel1,
  valuef1 = initValue.valuef1,
  ymax1 = initValue.ymax1,
  valuelInit1 = initValue.valuelInit1
let enableControls = true;
let isShiftPressed = false;


  const dataArrRef = useRef()
  const totalArrRef = useRef()
  totalArrRef.current = []
  var newDiv, newDiv1, selectStartArr = [], selectEndArr = [], sitArr, backArr, sitMatrix = [], backMatrix = [], selectMatrix = [], selectHelper, cooArr = [0, 0]
  let sitIndexArr = [], backIndexArr = []
  let dataFlag = false;
  const changeDataFlag = () => {
    dataFlag = true;

  };
  let particles,
    particlesPoint,
    material,
    sitGeometry,
    ndata1Num


    let bigArr = new Array(sitnum1 * sitInterpX * sitnum2 * sitInterpY).fill(1);
    let bigArrg = new Array(
      (sitnum1 * sitInterpX + sitOrderX * 2) *
      (sitnum2 * sitInterpY + sitOrderY * 2)
    ).fill(0),
      bigArrg1New = new Array(
        (sitnum1 * sitInterpX + sitOrderX * 2) *
        (sitnum2 * sitInterpY + sitOrderY * 2)
      ).fill(1),
      smoothBig = new Array(
        (sitnum1 * sitInterpX + sitOrderX * 2) *
        (sitnum2 * sitInterpY + sitOrderY * 2)
      ).fill(0);


  let i = 0;
  let ws,
    wsPointData,
    ws1

  let bodyArr
  let container, stats;

  let camera, scene, renderer;
  let controls;
  let cube, chair, mixer, clips;
  const clock = new THREE.Clock();
  var FPS = 10;
  var timeS = 0;
  var renderT = 1 / FPS;
  const ALT_KEY = 18;
  const CTRL_KEY = 17;
  const CMD_KEY = 91;
  const AMOUNTX = (sitnum1 * sitInterpX + sitOrderX * 2);
  const AMOUNTY = (sitnum2 * sitInterpY + sitOrderY * 2);

  const SEPARATION = 100;
  // let group = new THREE.Group();

  let positions1;
  let colors1, scales1;
  let positions;
  let colors, scales;

  function init() {
    container = document.getElementById(`canvas`);
    // camera

    camera = new THREE.PerspectiveCamera(
      40,
      window.innerWidth / window.innerHeight,
      1,
      150000
    );


    camera.position.z = 10;
    camera.position.y = 200;
    // camera.position.z = 1;
    // camera.position.y = 50;
    // camera.position.x = 100;

    // scene



    scene = new THREE.Scene();

    // model
    const loader = new GLTFLoader();
    // points  座椅

    initSet();

    initPoint();
    // scene.add(group);
    // group.rotation.y = Math.PI / 2
    group.position.x = 3
    group.position.y = 110
    group.position.z = 5
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

    const x = localStorage.getItem('bedx')
    if (x) group.rotation.x = -(Number(x) * 6) / 12
    const z = localStorage.getItem('bedz')
    if (z) group.rotation.z = Number(z) * 6 / 12

  }

  function pointDown(event) {
    selectStartArr = []
    selectEndArr = []
    if (selectHelper?.isShiftPressed) {

      sitIndexArr = []
      backIndexArr = []

      selectStartArr = [(event.clientX), event.clientY]


      // group.position.x = -10
      // group.position.y = 110
      // group.position.z =5


      sitArr = getPointCoordinate({
        particles, camera, position: { x: group.position.x, y: group.position.y, z: group.position.z },
        //  axis1 : [0,1,0] ,angle1 : particles.rotation.y
      })
      // backArr = getPointCoordinateback({ particles: particles1, camera, position: { x: -10, y: 110, z: 5 }, width: AMOUNTX1 })

      sitMatrix = [sitArr[0].x, sitArr[0].y, sitArr[1].x, sitArr[1].y]
      // backMatrix = [backArr[1].x, backArr[0].y, backArr[0].x, backArr[1].y]
      console.log(sitMatrix, 'sitMatrix')

      // const newDiv = document.createElement('div');

      // newDiv.classList.add('my-class');
      // // 设置 <div> 的属性、内容或样式
      // newDiv.style.backgroundColor = 'lightblue';
      // // newDiv.style.padding = '10px';
      // newDiv.style.width = `${100}px`
      // newDiv.style.height = `${100}px`
      // // newDiv.style.left = `${viewportPosition.x}px`
      // // newDiv.style.top = `${viewportPosition.y}px`
      // // newDiv.style.left = `${vector.x}px`
      // // newDiv.style.top = `${vector.y}px`
      // newDiv.style.left = `${backMatrix[2]}px`
      // newDiv.style.top = `${backMatrix[3]}px`

      // // 将 <div> 元素添加到页面中的某个元素中
      // document.body?.appendChild(newDiv);

    }
  }

  function pointMove(event) {
    if (selectHelper?.isShiftPressed) {


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


      // if (!controlsFlag && selectHelper.isDown) {
      //   const sitInterArr = checkRectangleIntersection(selectMatrix, sitMatrix)
      //   // const backInterArr = checkRectangleIntersection(selectMatrix, backMatrix)

      //   if (sitInterArr) sitIndexArr = checkRectIndex(sitMatrix, sitInterArr, AMOUNTX, AMOUNTY)
      //   console.log(sitIndexArr)
      //   // if (backInterArr) backIndexArr = checkRectIndex(backMatrix, backInterArr, AMOUNTX1, AMOUNTY1)
      //   props.changeSelect({ sit: sitIndexArr,
      //     //  back: backIndexArr
      //     })
      // }

    }
  }

  function pointUp(event) {
    console.log('up')
    const sitInterArr = checkRectangleIntersection(selectMatrix, sitMatrix)
    // const backInterArr = checkRectangleIntersection(selectMatrix, backMatrix)

    if (sitInterArr) sitIndexArr = checkRectIndex(sitMatrix, sitInterArr, AMOUNTX, AMOUNTY)

    // if (backInterArr) backIndexArr = checkRectIndex(backMatrix, backInterArr, AMOUNTX1, AMOUNTY1)
    props.changeSelect({
      sit: [...sitIndexArr],
      //  back: backIndexArr
    })
    if (selectHelper?.isShiftPressed) {
      selectStartArr = []
      selectEndArr = []
    }
  }

  //   初始化座椅
  function initSet() {
    // const AMOUNTX = 1
    // const AMOUNTY = 1
    const numParticles = AMOUNTX * AMOUNTY;
    positions = new Float32Array(numParticles * 3);
    scales = new Float32Array(numParticles);
    colors = new Float32Array(numParticles * 3);
    let i = 0,
      j = 0;

    for (let ix = 0; ix < AMOUNTX; ix++) {
      for (let iy = 0; iy < AMOUNTY; iy++) {
        positions[i] = ix * SEPARATION - (AMOUNTX * SEPARATION) / 2; // x
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
    material = new THREE.PointsMaterial({
      vertexColors: true,
      transparent: true,
      //   color: 0xffffff,
      map: spite,
      size: 1.2,
    });
    sitGeometry.setAttribute("scale", new THREE.BufferAttribute(scales, 1));
    sitGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    particles = new THREE.Points(sitGeometry, material);

    particles.scale.x = 0.0062;
    particles.scale.y = 0.0062;
    particles.scale.z = 0.0062;
    // particles.rotation.y = Math.PI / 2

    // particles.rotation.x = Math.PI / 4;
    // particles.rotation.y = 0; //-Math.PI / 2;
    // particles.rotation.y = Math.PI
    // particles.rotation.z = Math.PI
    // scene.add(particles);
    group.add(particles);


    //
    // const position = particles.geometry.attributes.position;

    // const screenCoordinates = [];
    // const dataArr = [0, 2879]
    // for (let i = 0; i < dataArr.length; i++) {
    //   const vertex = new THREE.Vector3();
    //   vertex.fromBufferAttribute(position, dataArr[i]); // 获取顶点的世界坐标
    //   const geometry = new THREE.BufferGeometry();
    //   const vertices = new Float32Array([vertex.x, vertex.y, vertex.z])
    //   const colors = new Float32Array([1, 0, 0])
    //   console.log(vertices, 'vertices')
    //   geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    //   geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    //   const point = new THREE.Points(geometry, material);

    //   group.add(point);
    //   point.scale.x = 0.0062;
    //   point.scale.y = 0.0062;
    //   point.scale.z = 0.0062;
    //   point.position.x = -15
    //   point.position.y = -1000
    //   point.position.z = 230

    //   const vector = new THREE.Vector3();
    //   var widthHalf = 0.5 * window.innerWidth;  //此处应使用画布长和宽
    //   var heightHalf = 0.5 * window.innerHeight;

    //   point.updateMatrixWorld(); // 函数updateMatrix()和updateMatrixWorld(force)将根据position，rotation或quaternion，scale参数更新matrix和matrixWorld。updateMatrixWorld还会更新所有后代元素的matrixWorld，如果force值为真则调用者本身的matrixWorldNeedsUpdate值为真。

    //   //getPositionFromMatrix()方法已经删除,使用setFromMatrixPosition()替换, setFromMatrixPosition方法将返回从矩阵中的元素得到的新的向量值的向量
    //   vector.setFromMatrixPosition(point.matrixWorld);

    //   //projectOnVector方法在将当前三维向量(x,y,z)投影一个向量到另一个向量,参数vector(x,y,z).
    //   vector.project(camera);

    //   vector.x = (vector.x * widthHalf) + widthHalf;
    //   vector.y = -(vector.y * heightHalf) + heightHalf;
    //   console.log(vector.x, vector.y,)
    // }
    // console.log(group)
  }
  // 初始化靠背


  function initPoint() {
    const geometry = new THREE.PlaneGeometry(2, 2);
    const spite = new THREE.TextureLoader().load("./circle.png");
    const material = new THREE.MeshBasicMaterial({ color: 0x991BFA, map: spite, transparent: true, });
    particlesPoint = new THREE.Mesh(geometry, material);

    particlesPoint.rotation.x = -Math.PI / 2
    particlesPoint.position.y = 10

    particlesPoint.position.x = -10 + 48
    particlesPoint.position.z = -19 + 38.5
    group.add(particlesPoint);

  }
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


  //  更新座椅数据
  function sitRenew() {

    ndata1 = [...newData1].map((a, index) => (a - valuef1 < 0 ? 0 : a));
    // console.log(ndata1)
    // ndata1 = pressSmallBed({arr : ndata1 , width : 32 , height : 32 , type : 'col' , num : pressValue})

    // for (let i = 0; i < 32; i++) {
    //   for (let j = 0; j < 32; j++) {
    //     ndata1[i * 32 + j] = ndata1[i * 32 + j] * (1 + Math.floor(i / 8)*compen1/100)
    //   }
    // }
    // console.log(ndata1.filter((a) => a> 0) , ndata1.length)


    const realArr = []
    for (let i = 0; i < sitnum1; i++) {
      let num = 0
      for (let j = 0; j < sitnum2; j++) {
        num += ndata1[j * sitnum1 + i]
      }
      smoothValue = smoothValue + (num / sitnum2 - smoothValue) / 3
      realArr.push(smoothValue)
    }

    props.handleChartsBody1(realArr, ymax1 / 2)

    ndata1Num = ndata1.reduce((a, b) => a + b, 0);
    if (ndata1Num < valuelInit1) {
      ndata1 = new Array(sitnum1 * sitnum2).fill(0);
    }

    // ndata1 = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,5,48,25,8,0,1,0,0,0,0,0,0,0,0,2,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,6,7,28,37,6,0,0,0,0,0,0,0,0,0,1,1,6,2,4,0,0,0,0,0,0,0,1,0,1,0,0,1,3,11,22,52,35,2,2,4,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,31,50,14,1,1,0,0,0,0,0,0,0,1,7,19,9,2,0,1,0,0,0,0,0,0,0,0,0,0,1,9,30,48,30,5,3,5,9,7,3,0,0,0,0,1,30,63,35,6,1,0,0,0,0,0,0,0,0,0,0,0,0,5,46,49,10,2,1,1,5,12,8,0,0,0,0,4,72,25,35,7,1,0,0,0,0,0,0,0,0,0,0,0,0,16,24,26,5,1,0,0,2,14,54,0,0,0,0,7,59,52,40,27,4,1,1,0,0,0,0,0,0,0,0,0,1,23,33,12,1,0,0,0,3,27,60,0,0,0,0,20,46,46,35,32,9,1,0,0,0,0,0,0,0,0,0,1,2,22,21,14,2,1,0,2,6,39,83,0,0,0,0,21,41,38,44,52,26,2,0,0,0,0,0,0,0,0,0,0,2,24,19,11,2,0,0,0,9,65,77,0,0,0,0,38,63,44,41,55,38,6,1,0,0,0,0,0,0,0,0,0,0,14,14,17,2,1,0,0,19,36,47,0,0,0,0,20,73,37,39,55,54,26,3,1,0,0,0,0,0,0,0,0,1,40,17,13,10,1,0,0,1,8,23,0,0,0,2,46,66,29,31,54,55,30,14,4,0,0,0,0,0,0,0,0,1,10,48,14,6,4,1,0,1,6,8,0,0,0,1,36,60,40,17,42,54,58,15,4,0,0,0,0,0,0,0,1,4,20,26,29,14,5,11,2,1,3,2,0,0,2,1,83,42,18,17,34,59,48,21,7,1,0,0,1,0,1,2,1,1,13,21,17,17,11,18,4,1,1,0,0,0,0,0,46,45,14,5,22,42,44,36,12,2,1,1,1,0,0,1,0,3,6,32,41,40,18,17,8,1,1,0,0,0,0,0,31,35,6,2,15,52,42,20,14,6,2,3,3,3,3,4,1,3,7,12,34,52,43,41,12,2,1,0,0,0,0,0,52,30,4,1,12,28,27,32,13,6,3,5,7,16,9,33,9,19,6,7,40,28,16,30,33,4,1,0,0,0,0,0,35,29,5,0,14,26,43,18,21,9,4,7,14,13,7,16,13,19,15,6,23,46,23,28,33,3,1,0,0,0,0,0,25,18,2,0,2,17,21,29,20,22,9,10,14,11,20,31,27,22,20,10,18,57,36,40,40,1,0,1,0,0,0,0,23,22,1,0,2,16,22,25,29,48,20,15,26,16,13,16,15,15,9,10,12,37,54,44,14,0,0,1,0,0,0,0,47,12,1,0,2,12,29,40,35,40,25,17,27,14,13,10,16,13,13,17,10,29,32,48,4,0,0,0,0,0,0,0,53,5,0,0,6,6,33,45,37,67,43,31,28,15,7,9,12,10,10,8,4,15,18,7,1,0,0,0,0,0,0,1,29,1,0,0,2,4,19,56,40,45,78,36,42,15,6,6,7,8,2,3,1,2,4,1,0,0,0,0,0,0,1,1,13,1,0,0,0,2,16,52,61,39,52,39,44,13,9,1,1,2,1,2,0,1,1,1,0,0,0,0,0,0,1,0,12,0,0,0,1,4,14,22,51,33,27,29,44,12,3,1,0,1,1,3,1,1,1,0,0,0,0,0,0,1,1,2,4,0,1,0,1,3,12,29,85,56,38,31,11,1,1,0,0,0,0,1,0,0,1,0,0,0,0,0,0,1,1,2,3,0,0,0,1,4,12,29,85,56,37,30,11,1,2,0,1,0,0,1,0,0,0,0,0,0,0,0,0,2,3,21,16,3,7,2,7,3,8,15,30,20,7,4,1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,4,35,44,7,3,1,3,2,7,10,8,3,3,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,4,19,51,2,1,1,1,0,2,2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,9,18,57,32,3,4,8,5,1,3,1,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]

    bigArr = interpSmall(ndata1, sitnum1, sitnum2, sitInterpX, sitInterpY);
    let bigArrs = addSide(
      bigArr,
      sitnum1 * sitInterpX,
      sitnum2 * sitInterpY,
      sitOrderX,
      sitOrderY
    );

    gaussBlur_1(
      bigArrs,
      bigArrg,
      AMOUNTX,
      AMOUNTY,
      valueg1
    );

    bodyArr = []

    for (let i = 0; i < bigArrg.length; i++) {
      bigArrg1New[i] = bigArrg[i]
    }

    for (let ix = 0; ix < AMOUNTX; ix++) {
      let num = 0
      for (let iy = 0; iy < AMOUNTY; iy++) {
        num += bigArrg1New[iy * AMOUNTX + ix]
      }
      bodyArr.push(parseInt(num / AMOUNTY))
    }

    props.handleChartsBody(bodyArr, ymax1)



    dataArrRef.current = []


    let k = 0;

  

    for (let ix = 0; ix < AMOUNTX; ix++) {
      for (let iy = 0; iy < AMOUNTY; iy++) {
        const dataIndex = iy * AMOUNTX + ix;
        const value = bigArrg1New[dataIndex] * 10;

        //柔化处理smooth
        smoothBig[dataIndex] = smoothBig[dataIndex] + (value - smoothBig[dataIndex]) / valuel1;

        positions[k] = ix * SEPARATION - (AMOUNTX * SEPARATION) / 2; // x
        positions[k + 1] = smoothBig[dataIndex] * value1; // y
        positions[k + 2] = iy * SEPARATION - (AMOUNTY * SEPARATION) / 2; // z
        let rgb

        if (sitIndexArr && !sitIndexArr.every((a) => a == 0)) {

          if (ix >= sitIndexArr[0] && ix < sitIndexArr[1] && iy >= sitIndexArr[2] && iy < sitIndexArr[3]) {
          
            rgb = jetWhite4(0, valuej1, smoothBig[dataIndex]);
           
            dataArrRef.current.push(bigArrg1New[dataIndex])
          } else 
          {
            rgb = jetWhite4(0, valuej1, smoothBig[dataIndex]);
            // scales1[l] = 1;
          }
        } else {
          rgb = jetWhite4(0, valuej1, smoothBig[dataIndex]);
          // scales1[l] = 1;
        }

        colors[k] = rgb[0] / 255;
        colors[k + 1] = rgb[1] / 255;
        colors[k + 2] = rgb[2] / 255;

        k += 3;
      }
    }
    if (!sitIndexArr.length || sitIndexArr.every((a) => a == 0)) {
      dataArrRef.current = bigArrg1New
    }


    var T = clock.getDelta();
    timeS = timeS + T;
    
      dataArrRef.current = dataArrRef.current.filter((a) => a > valuej1 * 0.025)
      const max = findMax(dataArrRef.current)
      const point = dataArrRef.current.filter((a) => a > 0).length
      const press = Math.round(dataArrRef.current.reduce((a, b) => a + b, 0) / 10)
      const mean = press / (point == 0 ? 1 : point)
      const realPoint = ndata1.filter((a) => a > 0).length

      props.data.current?.changeData({
        meanPres: mean.toFixed(2),
        maxPres: max,
        point: point,
        area: realPoint * 8,
        totalPres: press,
        // pressure: pressureSmooth.toFixed(2),
        pressure: press / realPoint//calculatePressure(press/realPoint)
      });

      if (totalArrRef.current.length < 20) {
         totalArrRef.current.push(press);
      } else {
         totalArrRef.current.shift();
         totalArrRef.current.push(press);
      }

      const maxTotal = findMax( totalArrRef.current);

      // if (!props.local)
      //   props.data.current?.handleCharts(totalArr, maxTotal + 1000);

      if (totalPointArr.length < 20) {
        totalPointArr.push(point);
      } else {
        totalPointArr.shift();
        totalPointArr.push(point);
      }

      const max1 = findMax(totalPointArr);
      // if (!props.local) { props.data.current?.handleChartsArea(totalPointArr, max1 + 100); }
      timeS = 0;
    // }
    particles.geometry.attributes.position.needsUpdate = true;
    particles.geometry.attributes.color.needsUpdate = true;

    sitGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3)
    );
    sitGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  }

  function render() {
    // particlesPoint.position.x = -10 + 48
    // particlesPoint.position.z = -19 + 38.5
    if (particlesPoint) {
      particlesPoint.position.x = -10 + (48) * cooArr[0] / 32
      particlesPoint.position.z = -19 + (38.5) * cooArr[1] / 32
    }
    if (centerFlag) {
      particlesPoint.visible = false
    } else {
      particlesPoint.visible = true
    }


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

  function logData() {
    // console.log(JSON.stringify(bodyArr))
  }

  //   靠背数据
  // 座椅数据
  function sitValue(prop) {

    const { valuej, valueg, value, valuel, valuef, valuelInit, ymax, compen, press } = prop;
    if (valuej) valuej1 = valuej;
    if (valueg) valueg1 = valueg;
    if (value) value1 = value;
    if (valuel) valuel1 = valuel;
    if (valuef) valuef1 = valuef;
    if (valuelInit) valuelInit1 = valuelInit;
    if (ymax) ymax1 = ymax;
    if (compen) compen1 = compen
    if (press) pressValue = press

  }
  function sitData(prop) {


    const {
      wsPointData: wsPointData,
      arr
    } = prop;
    if (arr) cooArr = arr
    newData1 = wsPointData;



  }

  function changeGroupRotate(obj) {

    if (typeof obj.x === 'number') {
      group.rotation.x = -((obj.x) * 6) / 12
    }
    if (typeof obj.z === 'number') {
      group.rotation.z = (obj.z) * 6 / 12
    }
    // console.log(JSON.stringify(group.rotation))
  }

  function changeCenterFlag(value) {
    centerFlag = value
  }

  function changeSelectFlag(value) {
    controlsFlag = value
    selectHelper.isShiftPressed = !value
    if(!selectHelper.isShiftPressed){
      selectHelper.onSelectOver()
    }
  }

  function reset() {

    camera.position.z = 10;
    camera.position.y = 200;
    camera.position.x = 0;
    camera.rotation.set({x : 0})
    camera.rotation.set({y : 0})
    camera.rotation.set({z : 0})

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

    group.rotation.x = 0
    group.rotation.y = 0
    group.rotation.z = 0
    group.position.x = 3
    group.position.y = 110
    group.position.z = 5
    controls.target = new THREE.Vector3(0, 0, -0)
    console.log(camera.rotation , camera.position, group.rotation, group.position , camera.lookAt(0,0,0))
  }

  function chartReset() {
    console.log(dataArrRef.current)
    const point = dataArrRef.current.filter((a) => a > 0).length
    const press = Math.round(dataArrRef.current.reduce((a, b) => a + b, 0) / 10)
    if ( totalArrRef.current.length < 20) {
       totalArrRef.current.push(press);
    } else {
       totalArrRef.current.shift();
       totalArrRef.current.push(press);
    }
    const maxTotal = findMax( totalArrRef.current);
    props.data.current?.handleCharts( totalArrRef.current, maxTotal + 1000);


    if (totalPointArr.length < 20) {
      totalPointArr.push(point);
    } else {
      totalPointArr.shift();
      totalPointArr.push(point);
    }

    const max1 = findMax(totalPointArr);
    props.data.current?.handleChartsArea(totalPointArr, max1 + 100);
  }

  useImperativeHandle(refs, () => ({

    sitData: sitData,
    changeDataFlag: changeDataFlag,
    sitValue,
    logData,
    sitRenew,
    changeGroupRotate,
    reset,
    changeSelectFlag,
    changeCenterFlag,
    chartReset
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
      window.removeEventListener("resize", onWindowResize);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('pointerdown', pointDown);
      document.removeEventListener('pointermove', pointMove);
      document.removeEventListener('pointerup', pointUp);
      controls?.dispose();
      renderer?.dispose();
      selectHelper?.dispose();
    };
  }, []);
  return (
    <div>
      <div

        id={`canvas`}
      ></div>
    </div>
  );
});
export default Canvas;
