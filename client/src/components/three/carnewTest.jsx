import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { TrackballControls } from "three/examples/jsm/controls/TrackballControls";
import React, { useEffect, useImperativeHandle } from "react";
import { TextureLoader } from "three";
import TWEEN from "@tweenjs/tween.js";
import {
  addSide,
  gaussBlur_1,
  interp,
  jetWhite3,
  jetgGrey,
} from "../../assets/util/util";
import { SelectionHelper } from "./SelectionHelper";
import { checkRectIndex, checkRectangleIntersection, getPointCoordinate, getPointCoordinateback } from "./threeUtil1";

const Canvas = React.forwardRef((props, refs) => {

  const backX = 1+4, backY = 100, backZ = 118, sitX = -3, sitY = 70, sitZ = 148, backRotationX = -Math.PI * 7 / 12

  console.log('canvas')
  var newDiv, newDiv1, selectStartArr = [], selectEndArr = [], sitArr, backArr, sitMatrix = [], backMatrix = [], selectMatrix = [], selectHelper
  let sitIndexArr = [], backIndexArr = []
  var animationRequestId
  const sitnum1 = 32;
  const sitnum2 = 32;
  const sitInterp = 2;
  const sitOrder = 4;
  const backnum1 = 32;
  const backnum2 = 32;
  const backInterp = 2;
  const backOrder = 4;
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
    material,
    backGeometry,
    sitGeometry
  let cube, chair, mixer, clips;
  let camera, scene, renderer;
  var ndata1 = new Array(sitnum1 * sitnum2).fill(0), ndata = new Array(backnum1 * backnum2).fill(0), newData1 = new Array(sitnum1 * sitnum2).fill(0), newData = new Array(backnum1 * backnum2).fill(0);
  let dataFlag = false;
  const changeDataFlag = () => {
    dataFlag = true;
    // console.log("first", dataFlag);
  };


  let bigArr1 = new Array(backnum1 * backInterp * backnum2 * backInterp).fill(1),
    bigArrg1 = new Array(
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
  const AMOUNTX1 = backnum1 * backInterp + backOrder * 2;
  const AMOUNTY1 = backnum2 * backInterp + backOrder * 2;
  const SEPARATION = 100;
  let group = new THREE.Group();

  let positions1;
  let colors1, scales1;
  let positions;
  let colors, scales;

  const positionY = 120,
    positionX = -10;

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


    camera.position.z = 300;
    camera.position.y = 200;


    // scene

    scene = new THREE.Scene();

    // model
    const loader = new GLTFLoader();

    loader.load("./model/chair3.glb", function (gltf) {
      chair = gltf.scene;
      if (props.body) {
        chair.rotation.y = -Math.PI / 2;
        chair.position.x = 135 - positionX;
        chair.position.y = 20 - positionY;

        chair.position.z = 150;
      }
      // scene.add(chair);
      group.add(chair);
      scene.add(group);
      group.position.x = -10;
      group.position.y = -20;
    });

    // points  座椅

    initSet();
    initBack();

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

    renderer.setSize(window.innerWidth, window.innerHeight);

    renderer.outputEncoding = THREE.sRGBEncoding;
    container.replaceChildren(renderer.domElement);

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

      sitArr = getPointCoordinate({ particles, camera, position: { x: -10, y: -20, z: 0 } })
      backArr = getPointCoordinateback({ particles: particles1, camera, position: { x: -18, y: -20, z: 0 }, width: AMOUNTX1 })

      sitMatrix = [sitArr[0].x, sitArr[0].y, sitArr[1].x, sitArr[1].y]
      backMatrix = [backArr[1].x, backArr[1].y, backArr[0].x, backArr[0].y]
    }
  }

  function pointMove(event) {
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
        if (backInterArr) backIndexArr = checkRectIndex(backMatrix, backInterArr, AMOUNTX1, AMOUNTY1)

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

  function changeSelectFlag(value) {
    controlsFlag = value
    selectHelper.isShiftPressed = !value
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
      size: 2,
    });
    sitGeometry.setAttribute("scale", new THREE.BufferAttribute(scales, 1));
    sitGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    particles = new THREE.Points(sitGeometry, material);

    particles.scale.x = 0.005;
    particles.scale.y = 0.005;
    particles.scale.z = 0.005;

    particles.position.z = sitZ;
    particles.position.y = sitY;
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
        positions1[k] = ix * SEPARATION - (AMOUNTX1 * SEPARATION) / 2 - ix * 20; // x
        positions1[k + 1] = 0; // y
        positions1[k + 2] = iy * SEPARATION - (AMOUNTY1 * SEPARATION) / 2 + iy*10; // z

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
      size: 1.6,
    });

    particles1 = new THREE.Points(backGeometry, material1);
    particles1.geometry.attributes.position.needsUpdate = true;
    particles1.geometry.attributes.color.needsUpdate = true;
    particles1.geometry.attributes.scale.needsUpdate = true;
    particles1.scale.x = 0.006;
    particles1.scale.y = 0.006;
    particles1.scale.z = 0.006;

    particles1.position.z = backZ;
    particles1.position.y = backY;
    particles1.position.x = backX;
    particles1.rotation.x = backRotationX;
    // particles1.rotation.z = Math.PI;
    particles1.rotation.y = 0; //Math.PI ;
    // scene.add(particles1);
    group.add(particles1);
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
    // console.log(delta)
    // if(dataFlag){
    //   console.log(111)
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
    });

    return tween1;
  }

  function actionSit() {

    console.log('sit')

    particles.visible = true;
    controls.reset()
    const tweena = move(
      {
        x: 0,
        y: 170,
        z: 220,
        rotationx: Math.PI / 3,
      },
      1000,
      particles
    );

    tweena.start();
    // controlsFlag = false;
    particles1.visible = false;
    chair.visible = false;
  }

  function actionBack() {
    particles1.visible = true;
    controls.reset()
    const tweena = move(
      {
        x: 2,
        y: 165,
        z: 225,
        rotationx: -Math.PI / 2 - (Math.PI * 4) / 24,
      },
      1000,
      particles1
    );

    tweena.start();

    // controlsFlag = false; 
    particles.visible = false;
    chair.visible = false;
  }

  function actionAll() {
    particles1.visible = true;
    particles.visible = true;
    chair.visible = true;
    // controlsFlag = true;

    controls.reset()


    if (particles.position.z == 220) {
      const tweena = move(
        {
          x: sitX,
          y: sitY,
          z: sitZ,
          rotationx: -Math.PI / 48,
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
        },
        1000,
        particles1
      );

      tweena.start();
    }
    console.log('actionAll')
  }

  //  更新靠背数据
  function backRenew() {
    // const newData = [...ndata]
    // const date = Date.now()

    // console.log(wsPointData)
    // wsPointData = new Array(1024).fill(0)
    // wsPointData[1023] = 100

    ndata = [...newData].map((a, index) => (a - valuef2 < 0 ? 0 : a));
    ndataNum = ndata.reduce((a, b) => a + b, 0);
    if (ndataNum < valuelInit2) {
      ndata = new Array(backnum1 * backnum2).fill(1);
    }
    interp(ndata, bigArr1, backnum1, backInterp);
    //高斯滤波

    let bigarr1 = [];

    bigarr1 = addSide(
      bigArr1,
      backnum2 * backInterp,
      backnum1 * backInterp,
      backOrder,
      backOrder
    );

    gaussBlur_1(
      bigarr1,
      bigArrg1,
      backnum2 * backInterp + 2 * backOrder,
      backnum1 * backInterp + 2 * backOrder,
      valueg2
    );
    // console.log(backGeometry,scales1)
    // const nowDate = Date.now() - date
    // console.log(nowDate)
    let k = 0,
      l = 0;

    for (let ix = 0; ix < AMOUNTX1; ix++) {
      for (let iy = 0; iy < AMOUNTY1; iy++) {
        const value = bigArrg1[l] * 10;

        //柔化处理smooth
        smoothBig1[l] = smoothBig1[l] + (value - smoothBig1[l] + 0.5) / valuel2;

        positions1[k + 1] = -smoothBig1[l] * value2; // y
        let rgb

        if (backIndexArr && !backIndexArr.every((a) => a == 0)) {

          if (ix >= backIndexArr[0] && ix < backIndexArr[1] && iy < AMOUNTY1 - backIndexArr[2] && iy >= AMOUNTY1 - backIndexArr[3]) {
            // rgb = [255, 0, 0];
            rgb = jetWhite3(0, valuej2, smoothBig1[l] + 50);
            scales1[l] = 2;
            // positions1[k + 1] = smoothBig1[l] / value2 - 1000
          } else {
            rgb = jetgGrey(0, valuej2, smoothBig1[l]);
            scales1[l] = 1;
          }
        } else {
          rgb = jetWhite3(0, valuej2, smoothBig1[l]);
          scales1[l] = 1;
        }


        colors1[k] = rgb[0] / 255;
        colors1[k + 1] = rgb[1] / 255;
        colors1[k + 2] = rgb[2] / 255;
        k += 3;
        l++;
      }
    }

    particles1.geometry.attributes.position.needsUpdate = true;
    particles1.geometry.attributes.color.needsUpdate = true;
    particles1.geometry.attributes.scale.needsUpdate = true;
    backGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(positions1, 3)
    );
    backGeometry.setAttribute("scale", new THREE.BufferAttribute(scales1, 1));
    backGeometry.setAttribute("color", new THREE.BufferAttribute(colors1, 3));
  }

  //  更新座椅数据
  function sitRenew() {
    // const newData = [...ndata1]
    ndata1 = [...newData1].map((a, index) => (a - valuef1 < 0 ? 0 : a));
    ndata1Num = ndata1.reduce((a, b) => a + b, 0);
    if (ndata1Num < valuelInit1) {
      ndata1 = new Array(sitnum1 * sitnum2).fill(1);
    }


    interp(ndata1, bigArr, sitnum1, sitInterp);
    // console.log(bigArr.filter((a) => a > 1).length)
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
    // console.log(big  Arrg)
    let k = 0,
      l = 0;

    for (let ix = 0; ix < AMOUNTX; ix++) {
      for (let iy = 0; iy < AMOUNTY; iy++) {
        const value = bigArrg[l] * 10;

        //柔化处理smooth
        smoothBig[l] = smoothBig[l] + (value - smoothBig[l] + 0.5) / valuel1;

        positions[k] = ix * SEPARATION - (AMOUNTX * SEPARATION) / 2 + ix * 20; // x
        positions[k + 1] = smoothBig[l] * value1; // y
        positions[k + 2] = iy * SEPARATION - (AMOUNTY * SEPARATION) / 2; // z

        let rgb
        if (sitIndexArr && !sitIndexArr.every((a) => a == 0)) {

          if (ix >= sitIndexArr[0] && ix < sitIndexArr[1] && iy >= sitIndexArr[2] && iy < sitIndexArr[3]) {
            rgb = jetWhite3(0, valuej1, smoothBig[l]);
          } else {
            rgb = jetgGrey(0, valuej1, smoothBig[l]);
          }
        } else {
          rgb = jetWhite3(0, valuej1, smoothBig[l]);
        }

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

  function render() {
    backRenew();
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
    } = prop;

    //处理空数组
    newData = wsPointData
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
    newData1 = wsPointData;
  }

  function addEvent() {
    document.addEventListener('pointerdown', function (event) {

      if (selectHelper.isShiftPressed) {
        sitIndexArr = []
        backIndexArr = []
        props.changeSelect({ sit: sitIndexArr, back: backIndexArr })
        selectStartArr = [(event.clientX), event.clientY]

        sitArr = getPointCoordinate({ particles, camera, position: { x: -10, y: -20, z: 0 } })
        backArr = getPointCoordinateback({ particles: particles1, camera, position: { x: -10, y: -20, z: 0 }, width: AMOUNTX1 })

        sitMatrix = [sitArr[0].x, sitArr[0].y, sitArr[1].x, sitArr[1].y]
        backMatrix = [backArr[1].x, backArr[1].y, backArr[0].x, backArr[0].y]
      }
    });

    document.addEventListener('pointermove', function (event) {

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
          if (backInterArr) backIndexArr = checkRectIndex(backMatrix, backInterArr, AMOUNTX1, AMOUNTY1)

          props.changeSelect({ sit: sitIndexArr, back: backIndexArr })
        }

      }
    });

    document.addEventListener('pointerup', function (event) {
      if (selectHelper.isShiftPressed) {
        selectStartArr = []
        selectEndArr = []
      }
    });
  }

  function removeEvent() {
    document.removeEventListener('pointerdown', function (event) {

      if (selectHelper.isShiftPressed) {
        sitIndexArr = []
        backIndexArr = []
        props.changeSelect({ sit: sitIndexArr, back: backIndexArr })
        selectStartArr = [(event.clientX), event.clientY]

        sitArr = getPointCoordinate({ particles, camera, position: { x: -10, y: -20, z: 0 } })
        backArr = getPointCoordinateback({ particles: particles1, camera, position: { x: -10, y: -20, z: 0 }, width: AMOUNTX1 })

        sitMatrix = [sitArr[0].x, sitArr[0].y, sitArr[1].x, sitArr[1].y]
        backMatrix = [backArr[1].x, backArr[1].y, backArr[0].x, backArr[0].y]
      }
    });

    document.removeEventListener('pointermove', function (event) {

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
          if (backInterArr) backIndexArr = checkRectIndex(backMatrix, backInterArr, AMOUNTX1, AMOUNTY1)

          props.changeSelect({ sit: sitIndexArr, back: backIndexArr })
        }

      }
    });

    document.removeEventListener('pointerup', function (event) {
      if (selectHelper.isShiftPressed) {
        selectStartArr = []
        selectEndArr = []
      }
    });
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
    }
  }

  useImperativeHandle(refs, () => ({
    backData: backData,
    sitData: sitData,
    changeDataFlag: changeDataFlag,
    sitValue,
    backValue,
    changeSelectFlag,
    actionAll: actionAll,
    actionSit: actionSit,
    actionBack: actionBack,
    changePointRotation
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
      document.removeEventListener('pointerdown', pointDown)
      document.removeEventListener('pointermove', pointMove)
      document.removeEventListener('pointup', pointUp)
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
