import Stats from "three/examples/jsm/libs/stats.module.js";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
// import { FlyControls } from 'three/examples/jsm/controls/FlyControls.js';
import { TrackballControls } from "three/examples/jsm/controls/TrackballControls";
import React, { useEffect, useImperativeHandle, useRef, useState } from "react";
import { TextureLoader } from "three";
import TWEEN from "@tweenjs/tween.js";
import {
  addSide,
  backLinearOrder,
  findArr,
  gaussBlur_1,
  interp,
  interp1016,
  jet,
  jetWhite,
  jetWhite2,
  numCom,
  press,
  rotate90,
  sitLineOrder,
  Stoke,
} from "../../assets/util/util";
import "./index.scss";
import * as echarts from "echarts";
// import "antd/dist/antd.css";
import { Slider, Button } from "antd";
// import { withData } from "./WithData";

import { obj } from "../../assets/util/config";
const group = new THREE.Group();
const sitInit = 0;
const backInit = 0;

const sitnum1 = 16;
const sitnum2 = 32;
const sitInterp = 2;
const sitOrder = 4;
const backnum1 = 16;
const backnum2 = 32;
const backInterp = 2;
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
    ws1,
    ndata1 = new Array(sitnum1*sitnum2).fill(0);

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

    

    // points  座椅

    initSet();
    initBack();
    // scene.add(group);
    group.rotation.x = -Math.PI/6
    group.position.x = -15  
    group.position.y = 150
    group.position.z = 230
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
  
    renderer.domElement.addEventListener(
      "click",
      () => {
        console.log(111);
      },
      false
    );
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

   
    particles.rotation.x = Math.PI / 2;
    // particles.rotation.y = 0; //-Math.PI / 2;
    // particles.rotation.y = Math.PI 
    // particles.rotation.z = Math.PI
    // scene.add(particles);
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
        positions1[k + 2] = iy * SEPARATION - (AMOUNTY1 * SEPARATION) / 2; // z

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

   
    particles1.position.x = 30;
    particles1.rotation.x = Math.PI / 2 
    // particles1.rotation.y = Math.PI 
    // particles1.rotation.z = Math.PI
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

  function animate() {
    requestAnimationFrame(animate);
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
      const vector = new THREE.Vector3();

      // 将物体的世界坐标系位置转换为屏幕空间中的位置
      particles1.getWorldPosition(vector);
      vector.project(camera);

      // 将坐标系范围从 -1 到 1 转换为屏幕范围内的值
      const x = ((vector.x + 1) * window.innerWidth) / 2;
      const y = (-(vector.y - 1) * window.innerHeight) / 2;

      console.log("The object is at position: ", x, y);
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
   
    controlsFlag = false;
    particles.visible = false;
    chair.visible = false;
  }

  function actionAll() {
    particles1.visible = true;
    particles.visible = true;
    chair.visible = true;
    controlsFlag = true;
    

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
        const rgb = jet(0, valuej2, smoothBig1[l]);
        // console.log(rgb)
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
    // console.log(ndata1)
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

        positions[k] = ix * SEPARATION - (AMOUNTX * SEPARATION) / 2; // x
        positions[k + 1] = smoothBig[l] * value1; // y
        positions[k + 2] = iy * SEPARATION - (AMOUNTY * SEPARATION) / 2; // z
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

  function render() {
    backRenew();
    sitRenew();
    TWEEN.update();
    controls.update();
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
      ndata1 = new Array(sitnum1*sitnum2).fill(0);
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
    ndata1 = ndata1.map((a, index) => (a - valuef1 < 0 ? 0 : a));

    ndata1Num = ndata1.reduce((a, b) => a + b, 0);
    if (ndata1Num < valuelInit) {
      ndata1 = new Array(sitnum1*sitnum2).fill(0);
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

  const changeValue = (obj) => {};
  useEffect(() => {
    // 靠垫数据

    init();
    window.addEventListener("mousemove", () => {}, false);
    animate();
    return () => {};
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
