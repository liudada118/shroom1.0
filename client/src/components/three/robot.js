import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { TrackballControls } from "three/examples/jsm/controls/TrackballControls";
import React, { useEffect, useImperativeHandle, useRef } from "react";
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
import { HeatmapCanvas } from "../../assets/util/heatmap";
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

  const bodyCanvasRef = useRef()
  const bodyCanvas = useRef()
  const handHeatmap1Ref = useRef()
  const handHeatmapRef = useRef()

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
    camera.position.y = 100;
    camera.position.x = 0;

    camera.lookAt(0, 0, 0)
    // scene

    scene = new THREE.Scene();

    // model
    scene.add(group);
    scene.add(pointGroup);

    const loader = new GLTFLoader();

    handHeatmapRef.current = new HeatmapCanvas(30, 30, 1, 1, 'body', {
      min: 0,
      max: 1000,
      size: 10

    })
    const arr = new Array(1024).fill(1)

    const handPointArr = [
      [4, 5], [4, 6], [2, 8], [2, 9], [1, 12], [1, 13], [2, 16], [2, 17], [14, 25], [14, 26],
      [8, 5], [8, 6], [6, 9], [6, 10], [6, 12], [6, 13], [6, 16], [6, 17], [18, 24], [18, 25],
      [11, 6], [11, 7], [10, 9], [10, 10], [10, 12], [10, 13], [10, 15], [10, 16], [22, 23], [22, 24],
      [17, 8], [17, 9], [17, 10], [17, 11], [17, 12], [17, 13], [17, 14], [17, 15],
      [18, 8], [18, 9], [18, 10], [18, 11], [18, 12], [18, 13], [18, 14], [18, 15],
      [21, 8], [21, 9], [21, 10], [21, 11], [21, 12], [21, 13], [21, 14], [21, 15],
      [24, 8], [24, 9], [24, 10], [24, 11], [24, 12], [24, 13], [24, 14], [24, 15]
    ]

    handPointArr.forEach((a) => {
      arr[(31 - a[0]) * 32 + a[1]] = 50
      arr[((31 - a[0] - 1) * 32) + a[1]] = 50
      arr[((31 - a[0] - 2) * 32) + a[1]] = 50
    })
    handHeatmapRef.current.changeHeatmap(arr, 1, 1, 0)

    handHeatmap1Ref.current = new HeatmapCanvas(30, 30, 1, 1, 'body', {
      min: 0,
      max: 2000,
      size: 20

    })

    const ctx = handHeatmap1Ref.current.canvas.getContext('2d');

    // 填充 Canvas 颜色
    ctx.fillStyle = 'rgb(0, 0, 0)'; // 纯红色
    // ctx.fillRect(0, 0,bodyCanvasRef.current.canvas.width,bodyCanvasRef.current.canvas.height);
    ctx.drawImage(handHeatmapRef.current.canvas, 0, 0, 256, 256, 0 + 20, 16 * 8 + 28, 5 * 8 * 0.5, 7 * 8 * 0.5);



    const handHeatmap2 = new HeatmapCanvas(30, 30, 1, 1, 'body', {
      min: 0,
      max: 2000,
      size: 20
    })

    const ctx1 = handHeatmap2.canvas.getContext('2d');

    // 填充 Canvas 颜色
    ctx1.fillStyle = 'rgb(255, 255, 255)'; // 纯红色
    ctx1.fillRect(0, 0, handHeatmap2.canvas.width, handHeatmap2.canvas.height);


    // const handHeatmap = new HeatmapCanvas(30, 30, 1, 1, 'body', {
    //   min: 0,
    //   max: 2000,
    //   size: 20

    // })

    loader.load("./model/man.glb", function (gltf) {
      chair = gltf.scene;


      group.add(chair);
      chair.position.z = 20
      chair.rotation.x = -Math.PI / 3
      chair.rotation.z = 0//Math.PI
      // chair.rotation.y = Math.PI
      chair.scale.x = 20
      chair.scale.y = 20
      chair.scale.z = 20

      bodyCanvasRef.current = new HeatmapCanvas(30, 30, 1, 1, 'body')

      // console.log(bodyCanvasRef.current.canvas)
      addCanvas(chair, bodyCanvasRef.current.canvas)

      const ctx = bodyCanvasRef.current.canvas.getContext('2d');

      // 填充 Canvas 颜色
      ctx.fillStyle = 'rgb(255, 0, 0)'; // 纯红色
      // ctx.fillRect(0, 0,bodyCanvasRef.current.canvas.width,bodyCanvasRef.current.canvas.height);
      // ctx.drawImage(handHeatmap2.canvas, 0, 0, 256, 256, 0, 0, 256, 256);
      ctx.drawImage(handHeatmap1Ref.current.canvas, 0, 0, 256, 256, 0, 0, 256, 256);
      // canvasRenew(bodyCanvasRef.current, bodyCanvasRef.current.canvas)
    });


    const helper = new THREE.GridHelper(2000, 100);
    helper.position.y = -199;
    helper.material.opacity = 0.25;
    helper.material.transparent = true;
    scene.add(helper);

    // lights
    // const hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff);
    // hemiLight.position.set(0, 1000, 0);
    // scene.add(hemiLight);

    // const hemiLight1 = new THREE.HemisphereLight(0xffffff, 0xffffff);
    // hemiLight1.position.set(2000, 0, 0);
    // scene.add(hemiLight1);

    // // const hemiLight1 = new THREE.HemisphereLight(0xffffff, 0xffffff);
    // // hemiLight.position.set(100, 200, 0);
    // // scene.add(hemiLight1);


    // const dirLight = new THREE.DirectionalLight(0xffffff);
    // dirLight.position.set(0, 2000, 10);
    // scene.add(dirLight);
    // const dirLight1 = new THREE.DirectionalLight(0xffffff);
    // dirLight1.position.set(0, 10, 2000);
    // scene.add(dirLight1);
    // const dirLight2 = new THREE.DirectionalLight(0xffffff);
    // dirLight2.position.set(1000, 1000, 0);
    // scene.add(dirLight2);
    // const dirLight3 = new THREE.DirectionalLight(0xffffff);
    // dirLight3.position.set(-1000, 1000, 0);
    // scene.add(dirLight3);
    // renderer

    const light = new THREE.AmbientLight(0xffffff, 2); // 强度设大一点
    scene.add(light);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);

    renderer.setSize(window.innerWidth, window.innerHeight);

    renderer.outputEncoding = THREE.sRGBEncoding;
    // renderer.outputColorSpace = THREE.SRGBColorSpace;  
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




  }

  function addCanvas(model, canvas) {
    //  canvas = document.createElement('canvas');
    // canvas.width = 128;
    // canvas.height = 256;
    // const ctx = canvas.getContext('2d');

    // 示例：填充红色背景，可以替换成你需要的绘制内容
    // ctx.fillStyle = 'red';
    // ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 3. 创建 CanvasTexture
    bodyCanvas.current = new THREE.CanvasTexture(canvas);
    bodyCanvas.current.needsUpdate = true;
    bodyCanvas.current.repeat.set(1, 1);
    bodyCanvas.current.premultiplyAlpha = false;

    // bodyCanvas.current.colorSpace = THREE.SRGBColorSpace;
    // bodyCanvas.current.wrapS = THREE.ClampToEdgeWrapping;
    // bodyCanvas.current.wrapT = THREE.ClampToEdgeWrapping;

    bodyCanvas.current.wrapS = THREE.RepeatWrapping;
    bodyCanvas.current.wrapT = THREE.RepeatWrapping;
    // 4. 遍历模型，给每个 Mesh 的材质添加 Canvas 纹理
    model.traverse((child) => {
      if (child.isMesh) {
        // 处理材质数组的情况
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

  function canvasRenew(CanvasTexture,canvas) {
    
    // const canvas = CanvasTexture.canvas
    // console.log(CanvasTexture)
    if (canvas) {
      
      handHeatmapRef.current.changeHeatmap(ndata1, 1, 1, 0)
      console.log(ndata1)
      // handHeatmap1Ref.current = new HeatmapCanvas(30, 30, 1, 1, 'body', {
      //   min: 0,
      //   max: 2000,
      //   size: 20

      // })

      const ctx1 = handHeatmap1Ref.current.canvas.getContext('2d');

      // 填充 Canvas 颜色
      ctx1.fillStyle = 'rgb(0, 0, 0)'; // 纯红色
      // ctx1.fillRect(0, 0,bodyCanvasRef.current.canvas.width,bodyCanvasRef.current.canvas.height);
      ctx1.clearRect(0, 0, handHeatmap1Ref.current.canvas.width, handHeatmap1Ref.current.canvas.height);
      ctx1.drawImage(handHeatmapRef.current.canvas, 0, 0, 256, 256, 0 + 20, 16 * 8 + 28, 5 * 8 * 0.5, 7 * 8 * 0.5);

      const ctx = canvas.getContext('2d');

      // 填充 Canvas 颜色
      ctx.fillStyle = 'rgb(255, 0, 0)'; // 纯红色
      // ctx2.clearRect(0, 0, canvas2.width, canvas2.height);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(handHeatmap1Ref.current.canvas, 0, 0, 256, 256, 0, 0, 256, 256);

      // ctx.fillRect(0, 0,bodyCanvasRef.current.canvas.width,bodyCanvasRef.current.canvas.height);
      // ctx.drawImage(handHeatmap2.canvas, 0, 0, 256, 256, 0, 0, 256, 256);
      // canvasRenew(bodyCanvasRef.current)
    }



    if (CanvasTexture) {
      CanvasTexture.needsUpdate = true;
    }
  }

  const canvas = new HeatmapCanvas()


  pointGroup.position.x = -3.5
  //   初始化座椅



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





  function render() {
    const body = new Array(32 * 32).fill(0)
    // const body = new Array(32 * 32).fill(100 * Math.random())
    const bodyPoint = [
      // 胸部
      // [8, 2], [8, 3], [8, 4], [8, 5], [9, 2], [9, 3], [9, 4], [9, 5], [10, 2], [10, 3], [10, 4], [10, 5], [11, 2], [11, 3], [11, 4], [11, 5],

      // //  背部
      // [9, 9], [9, 10], [9, 11], [9, 12],[10, 9], [10, 10], [10, 11], [10, 12],

      // // 肚子
      // [17,2],[17,3], [18,2],[18,3],

      // 肚子背侧
      //  [22,2],[22,3], [23,2],[23,3],

      [8, 1], [8, 2], [8, 3], [8, 4], [8, 5],
      [9, 1], [9, 2], [9, 3], [9, 4], [9, 5],
      [10, 1], [10, 2], [10, 3], [10, 4], [10, 5],
      [11, 1], [11, 2], [11, 3], [11, 4], [11, 5],
      [12, 1], [12, 2], [12, 3], [12, 4], [12, 5],
      [13, 1], [13, 2], [13, 3], [13, 4], [13, 5],
      [14, 1], [14, 2], [14, 3], [14, 4], [14, 5]

    ]

    let dataArr = ndata1
    //  if (!sitIndexArr.length || sitIndexArr.every((a) => a == 0)) {
    //   dataArr = ndata1
    // }


    var T = clock.getDelta();
    timeS = timeS + T;
    if (timeS > renderT) {
      bodyPoint.forEach((a) => {
        body[(31 - a[0]) * 32 + a[1]] = 100 * Math.random()
      })


      // if (bodyCanvasRef.current) bodyCanvasRef.current.changeHeatmap(body, 1, 1, 0)
      canvasRenew(bodyCanvas.current , bodyCanvasRef.current.canvas )
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
