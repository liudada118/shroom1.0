import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { TrackballControls } from "three/examples/jsm/controls/TrackballControls";
import React, { useEffect, useImperativeHandle } from "react";
import { TextureLoader } from "three";
import TWEEN from "@tweenjs/tween.js";
import {
  addSide,
  gaussBlur_1,
  gaussBlur_return,
  interp,
  interpSmall,
  jetWhite3,
  jetgGrey,
} from "../../assets/util/util";
import { SelectionHelper } from "./SelectionHelper";
import { checkRectIndex, checkRectangleIntersection, getPointCoordinate, getPointCoordinateWowback, getPointCoordinateWowhead, getPointCoordinateback } from "./threeUtil1";
import { lineInterp } from "../../assets/util/line";

let timer

function debounce(fn, time) {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    fn()
  }, time);
}

const Canvas = React.forwardRef((props, refs) => {

  const backX = 1 - 15, backY = 100 + 5, backZ = -15, sitX = -3, sitY = 50, sitZ = 50, backRotationX = -Math.PI * 7 / 12


  var newDiv, newDiv1, selectStartArr = [], selectEndArr = [], sitArr, backArr, headArr, sitMatrix = [], backMatrix = [], headMatrix = [], selectMatrix = [], selectHelper
  let sitIndexArr = [], sitIndexEndArr = [], backIndexArr = [], headIndexArr = [], backIndexEndArr = [], headIndexEndArr = []
  var animationRequestId, colSelectFlag = false
  const sitnum1 = 16;
  const sitnum2 = 16;
  const sitInterp = 2;
  const sitOrder = 4;
  const backnum1 = 16;
  const backnum2 = 16;
  const backInterp = 2;
  const backInterp1 = 4;
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
  let cube, chair, mixer, clips ,  key, fill,fill1, rim;
  let camera, scene, renderer;
  var ndata1 = new Array(sitnum1 * sitnum2).fill(0), ndata = new Array(backnum1 * backnum2).fill(0),
    ndatahead = new Array(headnum1 * headnum2).fill(0), newData1 = new Array(sitnum1 * sitnum2).fill(0),
    newData = new Array(backnum1 * backnum2).fill(0), newDatahead = new Array(backnum1 * backnum2).fill(0);
  var back = new Array(backnum1 * backnum2).fill(0), sit = new Array(sitnum1 * sitnum2).fill(0), neck = new Array(headnum1 * headnum2).fill(0);
  let dataFlag = false;
  const changeDataFlag = () => {
    dataFlag = true;

  };


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

  const positionY = 120,
    positionX = -10;


  const groupX = -10
  const groupY = -20

  function changeFlag(value) {
    controlsFlag = value
  }

  function initLight() {
    // new RGBELoader()
    //     .load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@master/examples/textures/equirectangular/royal_esplanade_1k.hdr', (texture) => {
    //         texture.mapping = THREE.EquirectangularReflectionMapping;
    //         scene.environment = texture;
    //         scene.background = texture;
    //     });

    // —————————— Lights ——————————

    // 环境光（基础亮度）
    // key = new THREE.AmbientLight(0xffffff, 0.8)
    key = new THREE.AmbientLight(0xffffff,2)
    scene.add(key);

    // 平行光（像 Blender Sun）
    // const sun = new THREE.DirectionalLight(0xffffff, 1);
    const sun = new THREE.DirectionalLight(0xffffff, 2.22);
    sun.position.set(5, 8, 2);
    sun.castShadow = true;
    sun.shadow.radius = 8;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 20;
    sun.shadow.camera.left = -10;
    sun.shadow.camera.right = 10;
    sun.shadow.camera.top = 10;
    sun.shadow.camera.bottom = -10;
    fill = sun
    scene.add(fill);

    // 平行光（像 Blender Sun）
    const sun1 = new THREE.DirectionalLight(0xffffff, 1);
    sun1.position.set(-5, 8, 2);
    sun1.castShadow = true;
    sun1.shadow.radius = 8;
    sun1.shadow.mapSize.set(2048, 2048);
    sun1.shadow.camera.near = 1;
    sun1.shadow.camera.far = 20;
    sun1.shadow.camera.left = -10;
    sun1.shadow.camera.right = 10;
    sun1.shadow.camera.top = 10;
    sun1.shadow.camera.bottom = -10;
    fill1 = sun1
    scene.add(fill1);

    // 聚光灯（加强重点光照）
    const spot = new THREE.SpotLight(0xffffff, 2);
    spot.position.set(-2, 705, -3764);
    spot.angle = Math.PI / 6;
    spot.penumbra = 0.4;
    spot.castShadow = true;
    spot.shadow.mapSize.set(2048, 2048);
    // rim = spot
    scene.add(spot);

    const spot1 = new THREE.SpotLight(0xffffff, 2);
    spot1.position.set(-2, 705, -3764);
    spot1.angle = Math.PI / 6;
    spot1.penumbra = 0.4;
    spot1.castShadow = true;
    spot1.shadow.mapSize.set(2048, 2048);
    rim = spot1
    scene.add(rim);


  }

  function init() {
    container = document.getElementById(`canvas${props.index}`);
    // camera

    camera = new THREE.PerspectiveCamera(
      35,
      window.innerWidth / window.innerHeight,
      0.01,
      10000
    );


    camera.position.z = 300;
    camera.position.y = 200;


    // scene

    scene = new THREE.Scene();

    // model
    initLight()
    // const loader = new OBJLoader();
    // loader.load(
    //   './model/0-00_1.obj', // 替换为你的 .obj 文件路径
    //   (object) => {
    //     object.position.set(0, 0, 0);
    //     object.scale.set(0.1, 0.1, 0.1);
    //     // object.rotation.x = -Math.PI / 2
    //     scene.add(object);
    //     scene.add(group);


    //     // bodyCanvasRef.current = new HeatmapCanvas(30, 30, 1, 1, 'body')

    //     // // // console.log(bodyCanvasRef.current.canvas)
    //     // addCanvas(object, bodyCanvasRef.current.canvas)

    //     // const ctx = bodyCanvasRef.current.canvas.getContext('2d');

    //     // // // 填充 Canvas 颜色
    //     // // ctx.fillStyle = 'rgb(255, 0, 0)'; // 纯红色
    //     // // ctx.fillRect(0, 0, bodyCanvasRef.current.canvas.width, bodyCanvasRef.current.canvas.height);
    //     // ctx.drawImage(handHeatmap2.canvas, 0, 0, 256, 256, 0, 0, 256, 256);
    //     // ctx.drawImage(handHeatmap1Ref.current.canvas, 0, 0, 256, 256, 0, 0, 256, 256);
    //     // canvasRenew(bodyCanvasRef.current, bodyCanvasRef.current.canvas)
    //   },
    //   (xhr) => {
    //     console.log(`加载进度: ${(xhr.loaded / xhr.total) * 100}%`);
    //   },
    //   (error) => {
    //     console.error('加载 .obj 失败', error);
    //   }
    // );


    const loader = new GLTFLoader();

    loader.load("./model/sofa1.glb", function (gltf) {
      chair = gltf.scene;
      if (props.body) {
        chair.rotation.y = -Math.PI / 2;
        chair.position.x = 58//135 - positionX;
        chair.position.y = -46//20 - positionY;

        chair.position.z = 35//150;

      }
      // scene.add(chair);
      group.add(chair);
      scene.add(group);
      // group.position.x = groupX;
      // group.position.y = groupY;
       chair.position.x = 58//135 - positionX;
        chair.position.y = -46//20 - positionY;

        chair.position.z = 35//150;
      chair.scale.set(100, 100, 100)
    });

    // points  座椅

    // initSet();
    // initBack();
    // initHead();
    scene.add(pointGroup);
    pointGroup.rotation.x = Math.PI / 2

    initPoints()
    const helper = new THREE.GridHelper(2000, 100);
    helper.position.y = -199;
    helper.material.opacity = 0.25;
    helper.material.transparent = true;
    scene.add(helper);

    // lights
    // const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444);
    // hemiLight.position.set(0, 200, 0);
    // scene.add(hemiLight);
    // const dirLight = new THREE.DirectionalLight(0xffffff);
    // dirLight.position.set(0, 200, 10);
    // scene.add(dirLight);
    // const dirLight1 = new THREE.DirectionalLight(0xffffff);
    // dirLight1.position.set(0, 10, 200);
    // scene.add(dirLight1);

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
    controls.dynamicDampingFactor = 0.1;
    controls.domElement = container;
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.PAN, // make pan the default instead of rotate
      MIDDLE: THREE.MOUSE.ZOOM,
      RIGHT: THREE.MOUSE.ROTATE,
    };
    // controls.keys = [
    //   ALT_KEY, // orbit
    //   CTRL_KEY, // zoom
    //   CMD_KEY, // pan
    // ];

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

  // height , width , heightInterp , widthInterp
  // const neckConfig = { sitnum1: 10, sitnum2: 10, sitInterp: 2, sitInterp1: 4, sitOrder: 3, }
  const backConfig = { sitnum1: 16, sitnum2: 16, sitInterp: 2, sitInterp1: 4, sitOrder: 3 }
  const sitConfig = { sitnum1: 16, sitnum2: 16, sitInterp: 2, sitInterp1: 4, sitOrder: 3 }
  // const handLeftConfig = { sitnum1: 4, sitnum2: 4, sitInterp: 4, sitInterp1: 2, sitOrder: 1 }
  // const handRightConfig = { sitnum1: 4, sitnum2: 4, sitInterp: 4, sitInterp1: 2, sitOrder: 1 }

  function addTotal(objArr) {
    objArr.forEach((obj) => {
      const { sitnum1, sitnum2, sitInterp, sitInterp1, sitOrder } = obj
      const AMOUNTX = sitnum1 * sitInterp + sitOrder * 2;
      const AMOUNTY = sitnum2 * sitInterp1 + sitOrder * 2;
      const numParticles = AMOUNTX * AMOUNTY;
      obj.total = numParticles
    })
  }

  addTotal([backConfig, sitConfig,])
  const xValue = 0.3
  const yValue = 0.1
  const zValue = -3
  let allConfig = {
    // neck: {
    //   dataConfig: neckConfig,
    //   name: 'neck',
    //   pointConfig: { position: [xValue -2.5, yValue - 5.5, -103 + zValue], rotation: [-Math.PI / 12, 0, 0], scale: [0.006, 0.006, 0.006] },
    // },
    back: {
      dataConfig: backConfig,
      name: 'back',
      pointConfig: { position: [-2.5, -42, -5], rotation: [-Math.PI / 12, 0, 0], scale: [0.009, 0.009, 0.009] },
    },
    sit: {
      dataConfig: sitConfig,
      name: 'sit',
      pointConfig: { position: [-2, -10, -1], rotation: [-Math.PI / 2, 0, 0], scale: [0.009, 0.009, 0.009] },
    },
    // handLeft: {
    //   dataConfig: handLeftConfig,
    //   name: 'handLeft',
    //   pointConfig: { position: [-6, yValue, -5 + zValue], rotation: [0, -Math.PI * 2 / 12, 0] },
    // },
    // handRight: {
    //   dataConfig: handRightConfig,
    //   name: 'handRight',
    //   pointConfig: { position: [13, yValue, -5 + zValue], rotation: [0, Math.PI * 2 / 12, 0] },
    // }
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
    const { position, rotation, scale } = pointConfig
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
      size: scale[0] * 250,
    });
    sitGeometry.setAttribute("scale", new THREE.BufferAttribute(scales, 1));
    sitGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const particles = new THREE.Points(sitGeometry, material);

    particles.scale.x = scale[0];
    particles.scale.y = scale[1];
    particles.scale.z = scale[2];

    // particles.position.z = 0
    // particles.position.y = 0
    // particles.position.x = 0
    if (position.length) particles.position.set(...position)
    if (rotation.length) particles.rotation.set(...rotation)
    particles.name = name
    group.add(particles);
  }

  function pointDown(event) {
    if (selectHelper.isShiftPressed) {
      sitIndexArr = []
      backIndexArr = []
      // props.changeSelect({ sit: sitIndexArr, back: backIndexArr })
      selectStartArr = [(event.clientX), event.clientY]

      sitArr = getPointCoordinate({ particles, camera, position: { x: groupX, y: groupY, z: 0 } })
      backArr = getPointCoordinateWowback({ particles: particles1, camera, position: { x: groupX, y: groupY, z: 0 }, width: AMOUNTX1 })
      headArr = getPointCoordinateWowhead({ particles: particlesHead, camera, position: { x: groupX, y: groupY, z: 0 }, width: AMOUNTXhead })

      sitMatrix = [sitArr[0].x, sitArr[0].y, sitArr[1].x, sitArr[1].y]

      // console.log(222)

      // let varcreateDiv = document.createElement("div");
      // varcreateDiv.style.width = '50px'
      // varcreateDiv.style.height = '50px'
      // varcreateDiv.style.backgroundColor = 'red'
      // varcreateDiv.style.position = 'fixed'
      // varcreateDiv.style.left = `${headArr[1].x}px`
      // varcreateDiv.style.top = `${headArr[1].y}px`
      // document.body.appendChild(varcreateDiv);

      backMatrix = [backArr[1].x, backArr[1].y, backArr[0].x, backArr[0].y]

      headMatrix = [headArr[1].x, headArr[1].y, headArr[0].x, headArr[0].y,]
      console.log(headMatrix)
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
        const headInterArr = checkRectangleIntersection(selectMatrix, headMatrix)

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

        if (headInterArr) {
          headIndexArr = checkRectIndex(headMatrix, headInterArr, AMOUNTXhead, 30)

          headIndexEndArr = [...headIndexArr]

        }
        console.log(headIndexArr)

        props.changeStateData({ width: width, height: height })

      }

    }
  }



  function pointUp(event) {
    // console.log(sitIndexEndArr , backIndexEndArr , backIndexArr)



    if (selectHelper.isShiftPressed) {
      props.changeSelect({ sit: sitIndexEndArr, back: backIndexEndArr, head: headIndexEndArr })
      selectStartArr = []
      selectEndArr = []
      colSelectFlag = false
    }
  }

  function changeSelectFlag(value, flag) {
    controlsFlag = value
    selectHelper.isShiftPressed = !value
    if (value) {
      selectHelper.onSelectOver()
      // if (flag)
      //   props.changeSelect({ sit: [0, 72, 0, 72], back: [0, 72, 0, 144] })
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
        positions[i] = ix * SEPARATION - (AMOUNTX * SEPARATION) / 2// + ix * 5; // x
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

    const spite = new THREE.TextureLoader().load("./circle.png");
    material = new THREE.PointsMaterial({
      vertexColors: true,
      transparent: true,
      //   color: 0xffffff,
      map: spite,
      size: 2.5,
    });
    sitGeometry.setAttribute("scale", new THREE.BufferAttribute(scales, 1));
    sitGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    particles = new THREE.Points(sitGeometry, material);

    particles.scale.x = 0.008;
    particles.scale.y = 0.008;
    particles.scale.z = 0.008;

    particles.position.z = sitZ - 30;
    particles.position.y = sitY - 3;
    particles.position.x = sitX;
    particles.rotation.x = -Math.PI / 48;
    particles.rotation.y = 0; //-Math.PI / 2;
    group.add(particles);

  }
  // 初始化靠背
  function initBack() {
    // points 靠背
    const numParticles1 = AMOUNTX1 * AMOUNTY1;
    positions1 = new Float32Array(numParticles1 * 3);
    scales1 = new Float32Array(numParticles1);
    colors1 = new Float32Array(numParticles1 * 3);
    let k = 0,
      l = 0;

    for (let ix = 0; ix < AMOUNTX1; ix++) {
      for (let iy = 0; iy < AMOUNTY1; iy++) {
        positions1[k] = ix * SEPARATION - (AMOUNTX1 * SEPARATION) / 2 + ix * 80; // x
        positions1[k + 1] = 0; // y
        positions1[k + 2] = iy * SEPARATION - (AMOUNTY1 * SEPARATION) / 2 + iy * 80 - 3000; // z

        scales1[l] = 1;
        colors1[k] = 0 / 255;
        colors1[k + 1] = 0 / 255;
        colors1[k + 2] = 255 / 255;
        k += 3;
        l++;
      }
    }

    backGeometry = new THREE.BufferGeometry();
    backGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(positions1, 3)
    );
    backGeometry.setAttribute("scale", new THREE.BufferAttribute(scales1, 1));
    backGeometry.setAttribute("color", new THREE.BufferAttribute(colors1, 3));
    const spite = new THREE.TextureLoader().load("./circle.png");
    const material1 = new THREE.PointsMaterial({
      vertexColors: true,
      transparent: true,
      map: spite,
      size: 2,
    });

    particles1 = new THREE.Points(backGeometry, material1);
    particles1.geometry.attributes.position.needsUpdate = true;
    particles1.geometry.attributes.color.needsUpdate = true;
    particles1.geometry.attributes.scale.needsUpdate = true;
    particles1.scale.x = 0.0048;
    particles1.scale.y = 0.0048;
    particles1.scale.z = 0.0048;

    particles1.position.z = backZ;
    particles1.position.y = backY;
    particles1.position.x = backX;
    particles1.rotation.x = backRotationX;
    // particles1.rotation.z = Math.PI;
    // particles1.rotation.y = Math.PI / 2; //Math.PI ;
    // scene.add(particles1);
    group.add(particles1);
  }
  // 初始化头
  function initHead() {
    // points 靠背  
    // const backnum1 = 10;
    // const backnum2 = 10;
    // const backInterp = 4;
    // const backOrder = 2;
    // const AMOUNTX1 = (backnum1 * backInterp + backOrder * 2);
    // const AMOUNTY1 = (backnum2 * backInterp + backOrder * 2);
    const numParticles1 = AMOUNTXhead * AMOUNTYhead;
    positionsHead = new Float32Array(numParticles1 * 3);
    scalesHead = new Float32Array(numParticles1);
    colorsHead = new Float32Array(numParticles1 * 3);
    let k = 0,
      l = 0;

    for (let ix = 0; ix < AMOUNTXhead; ix++) {
      for (let iy = 0; iy < AMOUNTYhead; iy++) {

        if (iy < 30) {
          positionsHead[k] = ix * (SEPARATION) - (AMOUNTXhead * SEPARATION) / 2; // x
          positionsHead[k + 1] = 0
          positionsHead[k + 2] = iy * (SEPARATION) - (AMOUNTYhead * SEPARATION) / 2; // z
          positionsHead[k + 2] = iy * (SEPARATION) - (AMOUNTYhead * SEPARATION) / 2; // z
        } else {
          positionsHead[k] = ix * 0; // x
          positionsHead[k + 1] = 100000; // y
          positionsHead[k + 2] = 0; // z
          // positionsHead[k + 2] = iy * (SEPARATION) - (AMOUNTYhead * SEPARATION) / 2; // z
        }



        scalesHead[l] = 1;
        colorsHead[k] = 0 / 255;
        colorsHead[k + 1] = 0 / 255;
        colorsHead[k + 2] = 255 / 255;
        k += 3;
        l++;
      }
    }

    headGeometry = new THREE.BufferGeometry();
    headGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(positionsHead, 3)
    );
    headGeometry.setAttribute("scale", new THREE.BufferAttribute(scalesHead, 1));
    headGeometry.setAttribute("color", new THREE.BufferAttribute(colorsHead, 3));
    const spite = new THREE.TextureLoader().load("./circle.png");
    const material1 = new THREE.PointsMaterial({
      vertexColors: true,
      transparent: true,
      map: spite,
      size: 2,
    });

    particlesHead = new THREE.Points(headGeometry, material1);
    particlesHead.geometry.attributes.position.needsUpdate = true;
    particlesHead.geometry.attributes.color.needsUpdate = true;
    particlesHead.geometry.attributes.scale.needsUpdate = true;
    particlesHead.scale.x = 0.0060;
    particlesHead.scale.y = 0.0060;
    particlesHead.scale.z = 0.0060;

    particlesHead.position.z = backZ;
    particlesHead.position.y = backY + 52;
    particlesHead.position.x = backX + 15;
    particlesHead.rotation.x = backRotationX;
    // particlesHead.rotation.z = Math.PI;
    // particlesHead.rotation.y = Math.PI / 2; //Math.PI ;
    // scene.add(particlesHead);
    group.add(particlesHead);
  }
  //

  function onWindowResize() {
    renderer.setSize(window.innerWidth, window.innerHeight);

    camera.aspect = window.innerWidth / window.innerHeight;

    // camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
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

  function move(position, time, particles) {
    const p1 = {
      x: particles.position.x,
      y: particles.position.y,
      z: particles.position.z,
      rotationx: particles.rotation.x,
      rotationy: particles.rotation.y,
      rotationz: particles.rotation.z,
    };

    const tween1 = new TWEEN.Tween(p1)
      .to(position, time)
      .easing(TWEEN.Easing.Quadratic.InOut);

    tween1.onUpdate(() => {
      particles.position.set(p1.x, p1.y, p1.z);
      if (p1.rotationx) particles.rotation.x = p1.rotationx;
      if (p1.rotationz) particles.rotation.z = p1.rotationz;
    });

    return tween1;
  }

  function actionSit() {

    console.log('sit')
    controls.dynamicDampingFactor = 1;
    particles.visible = true;
    controls.reset()
    const tweena = move(
      {
        x: 0,
        y: 170,
        z: 220,
        rotationx: Math.PI / 3,
        rotationz: 0
      },
      1000,
      particles
    );

    tweena.start();
    // controlsFlag = false;
    particles1.visible = false;
    chair.visible = false;
    particlesHead.visible = false
  }

  function actionBack() {
    controls.dynamicDampingFactor = 1;
    particles1.visible = true;
    controls.reset()
    const tweena = move(
      {
        x: 2,
        y: 165,
        z: 225,
        rotationx: -Math.PI / 2 - (Math.PI * 4.5) / 24,
        rotationz: 0
      },
      1000,
      particles1
    );

    tweena.start();

    // controlsFlag = false; 
    particles.visible = false;
    chair.visible = false;
    particlesHead.visible = false
  }

  function actionHead() {
    controls.dynamicDampingFactor = 1;
    particlesHead.visible = true;
    controls.reset()
    const tweena = move(
      {
        x: 18,
        y: 190,
        z: 250,
        rotationx: -Math.PI / 2 - (Math.PI * 4.5) / 24,
        rotationz: 0
      },
      1000,
      particlesHead
    );

    tweena.start();

    // controlsFlag = false; 
    particles.visible = false;
    chair.visible = false;
    particles1.visible = false
  }


  function actionAll() {
    controls.dynamicDampingFactor = 0.1;
    particles1.visible = true;
    particles.visible = true;
    chair.visible = true;
    particlesHead.visible = true
    // controlsFlag = true;

    controls.reset()


    if (particles.position.z == 220) {
      const tweena = move(
        {
          x: sitX,
          y: sitY,
          z: sitZ,
          rotationx: -Math.PI / 48,
          rotationz: 0
        },
        1000,
        particles
      );

      tweena.start();
    }

    if (particles1.position.z == 225) {
      const tweena = move(
        {
          x: backX,
          y: backY,
          z: backZ,
          rotationx: backRotationX,
          rotationz: 0
        },
        1000,
        particles1
      );

      tweena.start();
    }

    // particlesHead.position.z = backZ;
    // particlesHead.position.y = backY + 52;
    // particlesHead.position.x = backX+15;
    // particlesHead.rotation.x = backRotationX;

    if (particlesHead.position.z == 250) {
      const tweena = move(
        {
          x: backX + 15,
          y: backY + 52,
          z: backZ,
          rotationx: backRotationX,
          rotationz: 0
        },
        1000,
        particlesHead
      );

      tweena.start();
    }
    console.log('actionAll')
  }



  function backRenew() {
    // const newData = [...ndata1]
    ndata = [...newData].map((a, index) => (a - valuef1 < 0 ? 0 : a));
    ndataNum = ndata.reduce((a, b) => a + b, 0);
    if (ndataNum < valuelInit1) {
      ndata = new Array(sitnum1 * sitnum2).fill(1);
    }


    interp(ndata, bigArr1, sitnum1, sitInterp);

    let bigArrs = addSide(
      bigArr1,
      sitnum2 * sitInterp,
      sitnum1 * sitInterp,
      sitOrder,
      sitOrder
    );

    gaussBlur_1(
      bigArrs,
      bigArrg1,
      sitnum2 * sitInterp + sitOrder * 2,
      sitnum1 * sitInterp + sitOrder * 2,
      valueg1
    );
    // console.log(big  Arrg)
    let k = 0,
      l = 0;
    for (let ix = 0; ix < 72; ix++) {
      for (let iy = 0; iy < 72; iy++) {
        const value = bigArrg1[l] * 10;

        //柔化处理smooth
        smoothBig1[l] = smoothBig1[l] + (value - smoothBig1[l] + 0.5) / valuel1;

        // positions1[k] = ix * SEPARATION - (AMOUNTX * SEPARATION) / 2 + ix * 20; // x
        positions1[k + 1] = -smoothBig1[l] * value2; // y
        // positions1[k + 2] = iy * SEPARATION - (AMOUNTY * SEPARATION) / 2; // z

        let rgb
        // if (backIndexArr && !backIndexArr.every((a) => a == 0)) {

        //   if (ix >= backIndexArr[0] && ix < backIndexArr[1] && iy >= backIndexArr[2] && iy < backIndexArr[3]) {
        //     rgb = jetWhite3(0, valuej1, smoothBig[l]);
        //   } else {
        //     // rgb = jetgGrey(0, valuej1, smoothBig[l]);
        //     // rgb = [172 ,197 ,235]
        //     rgb = [255 ,0 ,0]
        //   }
        // } else {
        //   rgb = jetWhite3(0, valuej1, smoothBig[l]);
        // }
        rgb = jetWhite3(0, valuej1, smoothBig1[l]);

        // if (backIndexArr && !backIndexArr.every((a) => a == 0)) {

        //   if (ix >= backIndexArr[0] && ix < backIndexArr[1] && iy < AMOUNTY1 - backIndexArr[2] && iy >= AMOUNTY1 - backIndexArr[3]) {
        //     // rgb = [255, 0, 0];
        //     rgb = jetWhite3(0, valuej2, smoothBig1[l] + 50);
        //     scales1[l] = 2;
        //     // positions1[k + 1] = smoothBig1[l] / value2 - 1000
        //   } else {
        //     rgb = jetgGrey(0, valuej2, smoothBig1[l]);
        //     scales1[l] = 1;
        //   }
        // } else {
        //   rgb = jetWhite3(0, valuej2, smoothBig1[l]);
        //   scales1[l] = 1;
        // }


        colors1[k] = rgb[0] / 255;
        colors1[k + 1] = rgb[1] / 255;
        colors1[k + 2] = rgb[2] / 255;

        k += 3;
        l++;
      }
    }

    particles1.geometry.attributes.position.needsUpdate = true;
    particles1.geometry.attributes.color.needsUpdate = true;

    backGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(positions1, 3)
    );
    backGeometry.setAttribute("color", new THREE.BufferAttribute(colors1, 3));
  }

  function headRenew() {

    // console.log(newDatahead)
    ndatahead = [...newDatahead].map((a, index) => (a - valuef2 < 0 ? 0 : a));
    ndataheadNum = ndatahead.reduce((a, b) => a + b, 0);
    if (ndataheadNum < valuelInit2) {
      ndatahead = new Array(headnum1 * headnum2).fill(1);
    }
    interp(ndatahead, bigArrhead, headnum1, headInterp);
    //高斯滤波

    let bigarr1 = [];

    bigarr1 = addSide(
      bigArrhead,
      headnum2 * headInterp,
      headnum1 * headInterp,
      headOrder,
      headOrder
    );

    gaussBlur_1(
      bigarr1,
      bigArrghead,
      headnum2 * headInterp + 2 * headOrder,
      headnum1 * headInterp + 2 * headOrder,
      valueg2
    );

    // for (let i = 0; i < 72; i++) {
    //   for (let j = 0; j < 72; j++) {
    //     bigArrg1New[(i * 2) * 72 + j * 2] = bigArrg1[i * 72 + j]
    //     bigArrg1New[(i * 2) * 72 + (j * 2 + 1)] = bigArrg1[i * 72 + j]
    //     // bigArrg1New[(i * 2 + 1) * 72 + j] = bigArrg1[i * 72 + j]
    //   }
    // }



    let k = 0,
      l = 0;

    for (let ix = 0; ix < AMOUNTXhead; ix++) {
      for (let iy = 0; iy < AMOUNTYhead; iy++) {
        const value = bigArrghead[l] * 10;

        //柔化处理smooth
        smoothBighead[l] = smoothBighead[l] + (value - smoothBighead[l] + 0.5) / valuel2;

        positionsHead[k + 1] = -smoothBighead[l] * value2; // y
        let rgb


        if (iy >= 30) {
          positionsHead[k + 1] = 0
        }

        rgb = jetWhite3(0, valuej2, smoothBighead[l]);

        colorsHead[k] = rgb[0] / 255;
        colorsHead[k + 1] = rgb[1] / 255;
        colorsHead[k + 2] = rgb[2] / 255;
        k += 3;
        l++;
      }
    }

    particlesHead.geometry.attributes.position.needsUpdate = true;
    particlesHead.geometry.attributes.color.needsUpdate = true;
    particlesHead.geometry.attributes.scale.needsUpdate = true;
    headGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(positionsHead, 3)
    );
    headGeometry.setAttribute("scale", new THREE.BufferAttribute(scalesHead, 1));
    headGeometry.setAttribute("color", new THREE.BufferAttribute(colorsHead, 3));
  }

  //  更新座椅数据
  // function sitRenew() {
  //   // const newData = [...ndata1]
  //   ndata1 = [...newData1].map((a, index) => (a - valuef1 < 0 ? 0 : a));
  //   ndata1Num = ndata1.reduce((a, b) => a + b, 0);
  //   if (ndata1Num < valuelInit1) {
  //     ndata1 = new Array(sitnum1 * sitnum2).fill(1);
  //   }


  //   interp(ndata1, bigArr, sitnum1, sitInterp);

  //   let bigArrs = addSide(
  //     bigArr,
  //     sitnum2 * sitInterp,
  //     sitnum1 * sitInterp,
  //     sitOrder,
  //     sitOrder
  //   );

  //   gaussBlur_1(
  //     bigArrs,
  //     bigArrg,
  //     sitnum2 * sitInterp + sitOrder * 2,
  //     sitnum1 * sitInterp + sitOrder * 2,
  //     valueg1
  //   );
  //   // console.log(big  Arrg)
  //   let k = 0,
  //     l = 0;

  //   for (let ix = 0; ix < AMOUNTX; ix++) {
  //     for (let iy = 0; iy < AMOUNTY; iy++) {
  //       const value = bigArrg[l] * 10;

  //       //柔化处理smooth
  //       smoothBig[l] = smoothBig[l] + (value - smoothBig[l] + 0.5) / valuel1;

  //       positions[k] = ix * SEPARATION - (AMOUNTX * SEPARATION) / 2 + ix * 20; // x
  //       positions[k + 1] = smoothBig[l] * value1; // y
  //       positions[k + 2] = iy * SEPARATION - (AMOUNTY * SEPARATION) / 2; // z

  //       let rgb
  //       // if (sitIndexArr && !sitIndexArr.every((a) => a == 0)) {

  //       //   if (ix >= sitIndexArr[0] && ix < sitIndexArr[1] && iy >= sitIndexArr[2] && iy < sitIndexArr[3]) {
  //       //     rgb = jetWhite3(0, valuej1, smoothBig[l]);
  //       //   } else {
  //       //     // rgb = jetgGrey(0, valuej1, smoothBig[l]);
  //       //     rgb = [172 ,197 ,235]
  //       //   }
  //       // } else {
  //       //   rgb = jetWhite3(0, valuej1, smoothBig[l]);
  //       // }
  //       rgb = jetWhite3(0, valuej1, smoothBig[l]);

  //       colors[k] = rgb[0] / 255;
  //       colors[k + 1] = rgb[1] / 255;
  //       colors[k + 2] = rgb[2] / 255;

  //       k += 3;
  //       l++;
  //     }
  //   }

  //   particles.geometry.attributes.position.needsUpdate = true;
  //   particles.geometry.attributes.color.needsUpdate = true;

  //   sitGeometry.setAttribute(
  //     "position",
  //     new THREE.BufferAttribute(positions, 3)
  //   );
  //   sitGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  // }

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

    let bigArr = lineInterp(ndata1, sitnum2, sitnum1, sitInterp1, sitInterp)
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
    // backRenew();
    // sitRenew();
    // headRenew()

    //  neck = new Array(100).fill(20)
    //  back = new Array(256).fill(20)
    //  sit = new Array(256).fill(20)

    const data = {
       back, sit,
    }
    const smoothBig = {
      // neck: new Array(neckConfig.total).fill(1),
      back: new Array(backConfig.total).fill(1),
      sit: new Array(sitConfig.total).fill(1),
    }
    Object.keys(allConfig).forEach((key) => {
      const obj = allConfig[key]
      sitRenew(obj.dataConfig, obj.name, data[obj.name], smoothBig[obj.name]);
    })


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


  function backValue(prop) {
    const { valuej, valueg, value, valuel, valuef, valuelInit } = prop;
    if (valuej) valuej2 = valuej;
    if (valueg) valueg2 = valueg;
    if (value) value2 = value;
    if (valuel) valuel2 = valuel;
    if (valuef) valuef2 = valuef;
    if (valuelInit) valuelInit2 = valuelInit;

  }
  // 座椅数据
  function sitValue(prop) {
    const { valuej, valueg, value, valuel, valuef, valuelInit } = prop;
    if (valuej) valuej1 = valuej;
    if (valueg) valueg1 = valueg;
    if (value) value1 = value;
    if (valuel) valuel1 = valuel;
    if (valuef) valuef1 = valuef;
    if (valuelInit) valuelInit1 = valuelInit;
  }

  function sitData(prop) {
    const {
      wsPointData: wsPointData,
    } = prop;
    sit = wsPointData;
  }

  function headData(prop) {
    // console.log(prop)
    const {
      wsPointData: wsPointData,
    } = prop;
    neck = wsPointData;
  }

  //   靠背数据
  function backData(prop) {
    const {
      wsPointData: wsPointData,
    } = prop;

    //处理空数组
    back = wsPointData
    console.log(back)
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

  function changaCamera(obj){
    console.log(obj)
    const light = pointGroup.children.find((a) => a.name == 'back')
    const {x ,y,z} = obj
    if(x) light.position.x = x
    if(y) light.position.y = y
    if(z) light.position.z = z
    console.log(light)
  }

  useImperativeHandle(refs, () => ({
    backData: backData,
    sitData: sitData,
    headData,
    changeDataFlag: changeDataFlag,
    sitValue,
    backValue,
    changeSelectFlag,
    actionAll: actionAll,
    actionSit: actionSit,
    actionBack: actionBack,
    actionHead,
    changePointRotation,
    changeBox,
    cancelSelect,
    reset,
    changaCamera
  }));

  const reset = (carState) => {
    controls.reset()
    controls.dynamicDampingFactor = 0.1;
    // particles1.visible = true;
    // particles.visible = true;
    // particlesHead.visible = true;
    // chair.visible = true;
    // controlsFlag = true;

    // controls.reset()


    // if (particles.position.z) {
    //   const tweena = move(
    //     {
    //       x: sitX,
    //       y: sitY,
    //       z: sitZ,
    //       rotationx: -Math.PI / 48,
    //       rotationz: 0
    //     },
    //     1000,
    //     particles
    //   );

    //   tweena.start();
    // }

    // if (particles1.position.z) {
    //   const tweena = move(
    //     {
    //       x: backX,
    //       y: backY,
    //       z: backZ,
    //       rotationx: backRotationX,
    //       rotationz: 0
    //     },
    //     1000,
    //     particles1
    //   );

    //   tweena.start();
    // }

    if (carState == 'back') {
      actionBack()
    } else if (carState == 'sit') {
      actionSit()
    } else if (carState == 'head') {
      actionHead()
    }

    console.log('actionAll')
  }
  //   视图数据

  useEffect(() => {
    // 靠垫数据

    window.removeEventListener('keydown', function () { })
    window.removeEventListener('keyup', function () { })
    init();
    animate();
    return () => {
      if (animationRequestId) cancelAnimationFrame(animationRequestId);
      document.removeEventListener('pointerdown', pointDown)
      document.removeEventListener('pointermove', pointMove)
      document.removeEventListener('pointerup', pointUp)
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
