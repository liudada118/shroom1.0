import Stats from "three/examples/jsm/libs/stats.module.js";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { TrackballControls } from "three/examples/jsm/controls/TrackballControls";
import React, { useEffect, useImperativeHandle, useRef, useState } from "react";
import { TextureLoader } from "three";
import TWEEN from "@tweenjs/tween.js";
import {
  addSide,
  gaussBlur_1,
  interp1016,
  jetWhite2,
} from "../../assets/util/util";


import { obj } from "../../assets/util/config";
import { SelectionBox } from "./SelectionBox";
import { SelectionHelper } from "./SelectionHelper";
import { checkRectIndex, checkRectangleIntersection, getPointCoordinate, getPointCoordinateback } from "./threeUtil1";
import { getPointCoordinate1 } from "./threeUtil2";
var newDiv, newDiv1, selectStartArr = [], selectEndArr = [], sitArr, backArr, sitMatrix = [], backMatrix = [], selectMatrix = []
let sitindexArr, backIndexArr
const group = new THREE.Group();
const sitInit = 0;
const backInit = 0;
var animationRequestId
const sitnum1 = 10;
const sitnum2 = 16;
const sitInterp = 4;
const sitOrder = 4;
const backnum1 = 10;
const backnum2 = 12;
const backInterp = 4;
const backOrder = 4;
let controlsFlag = true;
const Canvas = React.forwardRef((props, refs) => {
  let dataFlag = false;
  const changeDataFlag = () => {
    dataFlag = true;
    // console.log("first", dataFlag);
  };
  let particles,
    particles1,
    material,
    backGeometry,
    sitGeometry,
    ndata = new Array(backnum1 * backnum2).fill(0),
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
  let bigArrg = new Array((sitnum1 * sitInterp + sitOrder*2) * (sitnum2 * sitInterp + sitOrder*2)).fill(1),
    bigArrgnew = new Array((sitnum1 * sitInterp + sitOrder*2) * (sitnum2 * sitInterp + sitOrder*2)).fill(1),
    smoothBig = new Array((sitnum1 * sitInterp + sitOrder*2) * (sitnum2 * sitInterp + sitOrder*2)).fill(1);
  let i = 0;
  let ws,
    wsPointData,
    ws1,
    ndata1 = new Array(160).fill(1);

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

    

  let valuej1 = 200,
    valueg1 = 2,
    value1 = 5,
    valuel1 = 5,
    valuef1 = 5,
    valuej2 = 200,
    valueg2 = 2,
    value2 = 5,
    valuel2 = 5,
    valuef2 = 5,
    valuelInit1 = 1,
    valuelInit2 = 2;
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
    container = document.getElementById(`canvas${props.index}`);
    // camera

    camera = new THREE.PerspectiveCamera(
      40,
      window.innerWidth / window.innerHeight,
      1,
      150000
    );

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

    loader.load("./model/chair3.glb", function (gltf) {
      chair = gltf.scene;
      if (props.body) {
        chair.rotation.y = -Math.PI / 2;
        chair.position.x = 135 - positionX;
        chair.position.y = 20 - positionY;
        // chair.position.x = 0
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

    renderer.outputColorSpace = THREE.SRGBColorSpace;
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
    controls.keys = [
      ALT_KEY, // orbit
      CTRL_KEY, // zoom
      CMD_KEY, // pan
    ];

    window.addEventListener("resize", onWindowResize);

    // const selectionBox = new SelectionBox(camera, scene);
    const selectHelper = new SelectionHelper(renderer, controls, 'selectBox', changeFlag);

    document.addEventListener('pointerdown', function (event) {


      selectStartArr = [(event.clientX), event.clientY]

      sitArr = getPointCoordinate({ particles, camera, position: { x: -10, y: -20, z: 0 } })
      backArr = getPointCoordinateback({ particles: particles1, camera, position: { x: -10, y: -20, z: 0 }, width: AMOUNTX1 })

      // newDiv = document.createElement('div');

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
      // newDiv.style.left = `${backArr[0].x}px`
      // newDiv.style.top = `${backArr[0].y}px`

      // // 将 <div> 元素添加到页面中的某个元素中
      // document.body?.appendChild(newDiv);

      sitMatrix = [sitArr[0].x, sitArr[0].y, sitArr[1].x, sitArr[1].y]
      backMatrix = [backArr[1].x, backArr[1].y, backArr[0].x, backArr[0].y]
    });

    document.addEventListener('pointermove', function (event) {
      selectEndArr = [(event.clientX), event.clientY,]

      selectMatrix = [...selectStartArr, ...selectEndArr]


      const sitInterArr = checkRectangleIntersection(selectMatrix, sitMatrix)
      const backInterArr = checkRectangleIntersection(selectMatrix, backMatrix)

      if (sitInterArr) sitindexArr = checkRectIndex(sitMatrix, sitInterArr, AMOUNTX, AMOUNTY)
      if (backInterArr) backIndexArr = checkRectIndex(backMatrix, backInterArr, AMOUNTX1, AMOUNTY1)
      // console.log(sitMatrix ,backMatrix ,selectMatrix)
      console.log(sitindexArr, backIndexArr)
    });

    document.addEventListener('pointerup', function (event) {
      selectStartArr = []
      selectEndArr = []

    });

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

    particles.scale.x = 0.006;
    particles.scale.y = 0.006;
    particles.scale.z = 0.007;

    particles.position.z = 148;
    particles.position.y = 70;
    particles.position.x = -2;
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
        positions1[k] = ix * SEPARATION - (AMOUNTX1 * SEPARATION) / 2; // x
        positions1[k + 1] = 0; // y
        positions1[k + 2] = iy * SEPARATION - (AMOUNTY1 * SEPARATION) / 2 + iy * 30; // z

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

    particles1.scale.x = 0.0062;
    particles1.scale.y = 0.0062;
    particles1.scale.z = 0.0062;

    particles1.position.z = 108 + 15;
    particles1.position.y = 90 + 15;
    particles1.position.x = 1;
    particles1.rotation.x = -Math.PI / 2 - (Math.PI * 3) / 24;
    // particles1.rotation.z = Math.PI;
    particles1.rotation.y = 0; //Math.PI ;
    // scene.add(particles1);
    group.add(particles1);
  }
  //
  function changeSitData(data) {
    ndata = data;
  }
  function changeBackData(data) {
    ndata1 = data;
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
      particles.rotation.x = p1.rotationx;
    });

    return tween1;
  }

  function actionSit() {
    particles.visible = true;
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

    controlsFlag = false;
    particles1.visible = false;
    chair.visible = false;
    setTimeout(() => {
      // const vector = new THREE.Vector3();

      // // 将物体的世界坐标系位置转换为屏幕空间中的位置
      // particles1.getWorldPosition(vector);
      // vector.project(camera);

      // // 将坐标系范围从 -1 到 1 转换为屏幕范围内的值
      // const x = ((vector.x + 1) * window.innerWidth) / 2;
      // const y = (-(vector.y - 1) * window.innerHeight) / 2;

      // const box = particles1.getBoundingClientRect();
      // const meshWidth = box.right - box.left;
      // const meshHeight = box.bottom - box.top;
      // const meshLeft = box.left;
      // const meshTop = box.top;

      // console.log(meshWidth, meshHeight, meshLeft, meshTop)

      // console.log("The object is at position: ", x, y);
      console.log(particles1)
    }, 1000);
  }

  function actionBack() {
    particles1.visible = true;
    const tweena = move(
      {
        x: 2,
        y: 175,
        z: 225,
        rotationx: -Math.PI / 2 - (Math.PI * 4) / 24,
      },
      1000,
      particles1
    );

    tweena.start();
    // camera.position.z = 300;
    // camera.position.y = 200;
    // camera.position.x = 0;
    // camera.rotation.x = -0.5
    // camera.rotation.y = 0
    // camera.rotation.z = 0
    // camera.lookAt(0,0,0)
    controlsFlag = false;
    particles.visible = false;
    chair.visible = false;
  }

  function actionAll() {
    particles1.visible = true;
    particles.visible = true;
    chair.visible = true;
    controlsFlag = true;
    // camera.position.z = 300;
    // camera.position.y = 200;
    // camera.position.x = 0;
    // camera.lookAt(0,0,0)
    // 初始sit
    // particles.position.z = 148;
    // particles.position.y = 70;
    // particles.position.x = -2;

    // 动画后sit
    // y: 170,
    // z: 220,

    // 初始化back
    // particles1.position.z = 108 + 15;
    // particles1.position.y = 90 + 15;
    // particles1.position.x = 1;
    // particles1.rotation.x = -Math.PI / 2 - (Math.PI * 3) / 24;
    // particles1.rotation.z = 0; //Math.PI;
    // particles1.rotation.y = 0; //Math.PI ;

    // 动画后back

    if (particles.position.z == 220) {
      const tweena = move(
        {
          x: -2,
          y: 70,
          z: 148,
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
          x: 1,
          y: 105,
          z: 123,
          rotationx: -Math.PI / 2 - (Math.PI * 3) / 24,
        },
        1000,
        particles1
      );

      tweena.start();
    }
  }

  //  更新靠背数据
  function backRenew() {
    interp1016(ndata, bigArr1, backnum1, backnum2, backInterp);
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

    let k = 0,
      l = 0;

    for (let ix = 0; ix < AMOUNTX1; ix++) {
      for (let iy = 0; iy < AMOUNTY1; iy++) {
        const value = bigArrg1[l] * 10;

        //柔化处理smooth
        smoothBig1[l] = smoothBig1[l] + (value - smoothBig1[l] + 0.5) / valuel2;

        positions1[k + 1] = smoothBig1[l] / value2; // y
        let rgb
        if (backIndexArr && !backIndexArr.every((a) => a == 0)) {

          if (ix >= backIndexArr[0] && ix < backIndexArr[1] && iy < AMOUNTY1 - backIndexArr[2] && iy >= AMOUNTY1 - backIndexArr[3]) {
            rgb = [255, 0, 0];
          } else {
            rgb = jetWhite2(0, valuej2, smoothBig1[l]);
          }
        } else {
          rgb = jetWhite2(0, valuej2, smoothBig1[l]);
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

    backGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(positions1, 3)
    );
    backGeometry.setAttribute("color", new THREE.BufferAttribute(colors1, 3));
  }

  //  更新座椅数据
  function sitRenew() {
    interp1016(ndata1, bigArr, sitnum1, sitnum2, sitInterp);
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

        positions[k] = ix * SEPARATION - (AMOUNTX * SEPARATION) / 2 + ix * 20; // x
        positions[k + 1] = smoothBig[l] * value1; // y
        positions[k + 2] = iy * SEPARATION - (AMOUNTY * SEPARATION) / 2; // z
        const rgb = jetWhite2(0, valuej1, smoothBig[l]);

        // if (rgb[0] == 255 && rgb[1] == 255 && rgb[0] == 255) {
        //   // console.log(123)
        //   // positions[k] = 1000
        //   positions[k + 1] = -10000;
        //   positions[k + 2] = 0;
        //   positions[k] = -10000;
        // }

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
    valuej2 = valuej;
    valueg2 = valueg;
    value2 = value;
    valuel2 = valuel;
    valuef2 = valuef;
    valuelInit2 = valuelInit;
    //处理空数组
    // console.log(ndata)
    ndata = wsPointData.splice(40, 160);
    console.log(ndata);
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
      ndata1 = new Array(160).fill(1);
    }
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
    valuej1 = valuej;
    valueg1 = valueg;
    value1 = value;
    valuel1 = valuel;
    valuef1 = valuef;
    // ndata1 = [];
    ndata1 = wsPointData;
    valuelInit1 = valuelInit;
    // 修改线序 坐垫
    ndata1 = ndata1.map((a, index) => (a - valuef1 < 0 ? 0 : a - valuef1));

    ndata1Num = ndata1.reduce((a, b) => a + b, 0);
    if (ndata1Num < valuelInit) {
      ndata1 = new Array(160).fill(1);
    }
  }

  useImperativeHandle(refs, () => ({
    backData: backData,
    sitData: sitData,
    changeDataFlag: changeDataFlag,
    sitValue,
    backValue,
    actionAll: actionAll,
    actionSit: actionSit,
    actionBack: actionBack,
  }));
  //   视图数据

  const changeValue = (obj) => { };
  useEffect(() => {
    // 靠垫数据

    init();
    // window.addEventListener("mousemove", onDocumentMouseMove, false);
    animate();
    return () => {
      cancelAnimationFrame(animationRequestId);
      document.removeEventListener('pointerdown', function () { })
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
