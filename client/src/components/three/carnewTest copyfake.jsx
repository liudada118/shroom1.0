import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { TrackballControls } from "three/examples/jsm/controls/TrackballControls";
import React, { useEffect, useImperativeHandle } from "react";
import { TextureLoader } from "three";
import TWEEN from "@tweenjs/tween.js";
import {
  addSide,
  gaussBlur_1,
  gaussBlur_return,
  interp,
  jetWhite3,
  jetgGrey,
  rotate90,
  rotate90CW,
} from "../../assets/util/util";
import { SelectionHelper } from "./SelectionHelper";
import { checkRectIndex, checkRectangleIntersection, getPointCoordinate, getPointCoordinateback } from "./threeUtil1";
import { lineInterp } from "../../assets/util/line";

let timer

function debounce(fn, time) {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    fn()
  }, time);
}

const Canvas = React.forwardRef((props, refs) => {

  const backX = 1, backY = 100, backZ = 118, sitX = -3, sitY = 70, sitZ = 148, backRotationX = -Math.PI * 7 / 12


  var newDiv, newDiv1, selectStartArr = [], selectEndArr = [], sitArr, backArr, sitMatrix = [], backMatrix = [], selectMatrix = [], selectHelper
  let sitIndexArr = [], sitIndexEndArr = [], backIndexArr = [], backIndexEndArr = []
  var animationRequestId, colSelectFlag = false
  const sitnum1 = 32;
  const sitnum2 = 32;
  const sitInterp = 4;
  const sitOrder = 10;
  const backnum1 = 32;
  const backnum2 = 32;
  const backInterp = 4;
  const backOrder = 20;
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

  };


  let bigArr1 = new Array(backnum1 * backInterp * backnum2 * backInterp).fill(1),
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
      (backnum2 * backInterp + 2 * backOrder) * 2
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
  const AMOUNTX1 = (backnum1 * backInterp + backOrder * 2);
  const AMOUNTY1 = (backnum2 * backInterp * 2 + backOrder * 2)
  const SEPARATION = 100;
  let group = new THREE.Group();

  let positions1;
  let colors1, scales1;
  let positions;
  let colors, scales;

  const positionY = 120,
    positionX = -10;


  const groupX = -10
  const groupY = -20

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
      group.position.x = groupX;
      group.position.y = groupY;
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

  function pointDown(event) {
    if (selectHelper.isShiftPressed) {
      sitIndexArr = []
      backIndexArr = []
      // props.changeSelect({ sit: sitIndexArr, back: backIndexArr })
      selectStartArr = [(event.clientX), event.clientY]

      sitArr = getPointCoordinate({ particles, camera, position: { x: groupX, y: groupY, z: 0 } })
      backArr = getPointCoordinateback({ particles: particles1, camera, position: { x: groupX, y: groupY, z: 0 }, width: AMOUNTX1 })

      sitMatrix = [sitArr[0].x, sitArr[0].y, sitArr[1].x, sitArr[1].y]



      backMatrix = [backArr[1].x, backArr[1].y, backArr[0].x, backArr[0].y]
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

  function changeSelectFlag(value, flag) {
    controlsFlag = value
    selectHelper.isShiftPressed = !value
    if (value) {
      selectHelper.onSelectOver()
      if (flag)
        props.changeSelect({ sit: [0, 72, 0, 72], back: [0, 72, 0, 144] })
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
      size: 1,
    });
    sitGeometry.setAttribute("scale", new THREE.BufferAttribute(scales, 1));
    sitGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    particles = new THREE.Points(sitGeometry, material);

    particles.scale.x = 0.0025;
    particles.scale.y = 0.0025;
    particles.scale.z = 0.0025;

    particles.position.z = sitZ;
    particles.position.y = sitY;
    particles.position.x = sitX;
    particles.rotation.x = -Math.PI / 48;
    particles.rotation.y = 0; //-Math.PI / 2;
    group.add(particles);

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
    controls.dynamicDampingFactor = 1;
    particles1.visible = true;
    controls.reset()
    const tweena = move(
      {
        x: 2,
        y: 165,
        z: 225,
        rotationx: -Math.PI / 2 - (Math.PI * 4.5) / 24,
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
    controls.dynamicDampingFactor = 0.1;
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
    console.log('actionAll')
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
      size: 0.8,
    });

    particles1 = new THREE.Points(backGeometry, material1);
    particles1.geometry.attributes.position.needsUpdate = true;
    particles1.geometry.attributes.color.needsUpdate = true;
    particles1.geometry.attributes.scale.needsUpdate = true;
    particles1.scale.x = 0.0028;
    particles1.scale.y = 0.0026;
    particles1.scale.z = 0.0028;

    particles1.position.z = backZ;
    particles1.position.y = backY;
    particles1.position.x = backX;
    particles1.rotation.x = backRotationX;
    // particles1.rotation.z = Math.PI;
    // particles1.rotation.y = Math.PI / 2; //Math.PI ;
    // scene.add(particles1);
    group.add(particles1);
  }

  //  更新靠背数据
  function backRenew() {

    ndata = [...newData].map((a, index) => (a - valuef2 < 0 ? 0 : a));
    ndataNum = ndata.reduce((a, b) => a + b, 0);
    if (ndataNum < valuelInit2) {
      ndata = new Array(backnum1 * backnum2).fill(1);
    }
    // ndata = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 41, 28, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 23, 11, 24, 20, 33, 32, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 19, 34, 44, 20, 42, 10, 38, 44, 32, 87, 46, 54, 21, 24, 33, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 0, 0, 0, 8, 0, 0, 12, 32, 14, 22, 27, 28, 13, 20, 16, 27, 55, 24, 45, 42, 29, 13, 42, 0, 0, 0, 0, 0, 0, 0, 0, 10, 0, 0, 0, 0, 0, 0, 0, 17, 31, 18, 9, 26, 17, 11, 39, 19, 41, 20, 28, 30, 11, 10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0, 39, 21, 44, 26, 34, 32, 26, 29, 48, 26, 33, 23, 16, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 17, 27, 28, 41, 34, 29, 53, 36, 45, 60, 32, 13, 14, 8, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 18, 20, 42, 24, 35, 21, 21, 35, 31, 14, 23, 14, 28, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7, 32, 22, 33, 27, 20, 17, 22, 13, 15, 19, 22, 25, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 22, 14, 27, 14, 8, 21, 13, 33, 30, 17, 13, 23, 22, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 15, 25, 20, 12, 18, 19, 13, 7, 13, 11, 28, 39, 27, 27, 16, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 23, 10, 16, 21, 24, 17, 0, 7, 16, 10, 22, 23, 33, 10, 12, 0, 0, 7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 20, 9, 24, 29, 20, 11, 6, 6, 14, 13, 19, 17, 26, 31, 21, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 15, 7, 18, 24, 11, 12, 9, 9, 19, 9, 22, 14, 20, 19, 20, 38, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 21, 9, 12, 21, 18, 25, 11, 9, 23, 21, 19, 15, 18, 25, 17, 14, 13, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 19, 18, 13, 27, 22, 9, 19, 8, 7, 14, 21, 25, 13, 28, 6, 23, 15, 5, 16, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 14, 13, 17, 21, 24, 11, 23, 21, 27, 24, 20, 30, 24, 32, 27, 29, 23, 12, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6, 18, 20, 22, 29, 25, 22, 9, 10, 14, 22, 15, 27, 16, 26, 21, 20, 29, 12, 9, 24, 0, 0, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 12, 19, 23, 23, 32, 26, 27, 15, 22, 29, 29, 30, 21, 32, 29, 35, 30, 13, 0, 0, 0, 7, 0, 0, 0, 0, 0, 0, 0, 9, 0, 16, 10, 16, 19, 19, 28, 12, 19, 10, 11, 27, 28, 30, 22, 19, 25, 17, 11, 8, 37, 0, 0, 19, 0, 0, 0, 0, 0, 9, 0, 0, 33, 14, 18, 27, 16, 28, 24, 19, 20, 11, 14, 16, 28, 49, 37, 27, 32, 23, 40, 30, 10, 0, 32, 9, 0, 0, 0, 0, 0, 0, 0, 15, 7, 10, 18, 19, 21, 23, 25, 25, 24, 16, 15, 24, 26, 24, 18, 25, 41, 14, 25, 20, 41, 45, 0, 0, 0, 0, 0, 0, 0, 13, 0, 14, 17, 20, 6, 17, 14, 10, 22, 13, 23, 13, 11, 20, 28, 22, 17, 18, 27, 29, 36, 49, 7, 25, 20, 7, 0, 0, 0, 0, 0, 0, 5, 29, 30, 22, 9, 13, 12, 16, 19, 21, 18, 9, 10, 8, 20, 32, 27, 21, 26, 13, 34, 27, 42, 19, 22, 14, 14, 0, 0, 6, 0, 12, 17, 11, 24, 25, 17, 19, 14, 21, 25, 28, 24, 14, 24, 12, 19, 9, 7, 9, 20, 13, 37, 63, 42, 37, 20, 14, 10, 0, 0, 0, 9, 0, 9, 0, 12, 13, 12, 9, 6, 7, 9, 5, 10, 0, 0, 0, 0, 8, 11, 10, 24, 17, 19, 44, 35, 34, 28, 18, 0, 0, 0, 0, 9, 9, 0, 31, 24, 32, 41, 21, 18, 12, 13, 17, 0, 0, 0, 0, 0, 0, 10, 21, 5, 13, 24, 21, 58, 41, 26, 18, 13, 21, 0, 5, 9, 13, 18, 23, 42, 39, 28, 27, 17, 21, 11, 16, 8, 0, 0, 5, 6, 10, 0, 0, 0, 0, 6, 20, 36, 34, 16, 30, 21, 0, 0, 0, 0, 9, 37, 18, 31, 31, 26, 22, 16, 18, 11, 11, 15, 7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 12, 26, 22, 25, 19, 9, 0, 0, 0, 21, 0, 0, 24, 27, 20, 23, 12, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 11, 42, 17, 7, 0, 0, 0, 21, 6, 10, 0, 6, 26, 18, 34, 7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 25, 19, 7, 6, 18, 0, 0]
    ndata = [0,0,8,16,33,27,46,18,12,0,0,0,0,0,0,0,0,0,0,0,0,0,20,24,21,43,32,25,61,13,0,12,0,27,15,52,27,36,28,27,16,19,11,15,6,0,0,0,0,0,0,0,0,33,34,17,38,32,24,35,12,17,0,0,12,27,30,31,53,27,39,34,18,30,16,22,14,8,0,0,0,0,0,6,23,22,28,30,30,39,44,37,11,63,8,0,8,23,26,64,26,36,53,35,34,21,34,13,20,19,9,11,0,0,0,26,33,15,21,27,35,42,34,27,12,12,0,0,0,10,16,33,53,54,35,30,39,24,23,17,21,27,27,21,6,9,35,20,18,33,11,34,25,50,35,36,7,0,0,0,0,0,0,12,28,49,22,27,33,22,41,17,23,39,23,24,8,23,37,17,35,23,16,31,31,22,19,8,35,10,7,0,0,0,0,0,31,27,36,42,32,41,36,22,29,23,28,30,25,22,26,26,20,21,42,25,27,25,15,26,0,0,0,0,0,0,0,0,14,42,27,38,21,21,41,35,22,32,19,31,51,33,21,23,36,24,12,25,31,24,24,41,22,0,0,0,0,0,0,0,0,18,23,22,19,16,27,17,38,30,18,38,32,28,24,20,34,21,24,19,20,20,15,12,0,0,0,0,0,0,0,0,0,9,43,28,33,21,27,30,32,26,33,29,21,29,37,45,21,13,22,30,31,31,22,32,0,0,0,0,0,0,0,0,0,36,21,33,34,33,19,33,38,15,27,26,56,42,29,29,31,33,25,16,18,32,17,0,15,0,0,0,0,0,0,0,29,5,14,28,21,21,40,31,31,34,44,22,35,32,46,47,24,25,20,27,17,17,17,0,0,0,0,0,0,0,0,0,0,0,0,13,7,26,32,21,35,22,18,27,34,34,48,30,30,13,25,18,22,16,8,0,0,0,0,0,0,0,0,0,0,0,0,0,26,25,24,27,37,27,19,20,17,32,42,23,29,39,26,15,15,17,0,0,0,0,0,0,0,0,0,0,0,0,0,24,17,14,17,40,34,42,28,32,24,17,16,23,24,20,29,25,32,25,0,0,0,0,0,0,0,0,0,0,0,0,15,12,21,16,19,17,32,34,28,24,29,26,15,20,27,34,24,27,30,19,5,0,0,0,0,0,0,0,0,0,5,0,6,7,22,18,17,28,18,17,28,14,19,20,15,21,18,21,11,23,8,15,11,0,0,0,0,0,0,0,0,0,0,0,0,5,19,15,8,18,23,19,36,23,26,10,10,24,23,26,20,16,24,15,7,7,0,0,0,0,0,0,0,0,0,0,0,0,5,0,18,24,26,25,16,14,11,12,12,17,19,14,22,14,18,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,28,20,21,31,33,25,31,28,22,12,16,26,21,25,24,11,8,15,30,13,0,0,0,0,0,0,0,0,0,0,0,31,9,17,14,26,22,23,29,22,19,21,15,22,13,12,38,38,16,9,0,0,0,0,0,0,0,0,0,0,0,22,22,0,8,20,19,21,22,23,16,12,17,47,38,36,30,27,24,22,17,9,6,0,0,0,0,0,0,0,0,0,0,0,0,0,9,13,20,16,17,53,45,38,31,19,20,28,28,30,28,19,18,14,13,0,0,0,0,0,0,0,0,8,8,0,7,19,34,26,34,26,24,19,17,12,0,0,7,20,22,20,23,17,21,11,0,0,0,0,0,0,0,0,0,0,0,0,0,10,17,36,28,16,21,12,13,9,0,0,14,19,27,39,42,34,25,5,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,11,8,13,10,8,0,0,0,0,0,10,14,22,13,9,0,9,6,0,0,0,0,0,0,0,0,0,0,0,13,27,19,29,17,27,19,11,14,6,6,7,12,16,13,20,20,34,16,0,0,0,0,0,0,0,0,0,0,0,0,9,0,0,0,15,17,15,13,18,15,16,11,28,18,20,15,16,13,10,0,0,10,0,0,0,0,0,0,0,8,0,0,0,0,0,0,16,21,12,0,0,0,0,0,0,0,0,7,12,0,0,0,7,0,0,0,0,0,6,0,0,0,5,0,0,0,0,0,8,18,35,27,15,0,24,0,0,0,19,26,12,0,0,10,0,0,0,0,0,0,0,0,0,0,0,7,0,0,0,0,0,0,6,7,0,0,22,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,8,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,0,0,0,0,0,0,0,0,0]


    ndata = rotate90CW(ndata, 32, 32)

    // interp(ndata, bigArr1, backnum1, backInterp);
    const bigArr1 = lineInterp(ndata, 32, 32, 2, 4)
    //高斯滤波

    // let bigarr1 = [];

    // bigarr1 = addSide(
    //   bigArr1,
    //   backnum2 * backInterp,
    //   backnum1 * backInterp,
    //   backOrder,
    //   backOrder
    // );

    // gaussBlur_1(
    //   bigarr1,
    //   bigArrg1,
    //   backnum2 * backInterp + 2 * backOrder,
    //   backnum1 * backInterp + 2 * backOrder,
    //   valueg2
    // );

    // ndata = gaussBlur_return(
    //   ndata,
    //   sitnum2,
    //   sitnum1,
    //   valueg1
    // );

    let bigArr = lineInterp(ndata, sitnum2, sitnum1, backInterp * 2, backInterp)
    let bigArrs = addSide(
      bigArr,
      sitnum2 * backInterp * 2,
      sitnum1 * backInterp,
      backOrder,
      backOrder
    );
    // let bigArrg = gaussBlur_return(
    //   bigArrs,
    //   sitnum2 * backInterp * 2 + sitOrder * 2,
    //   sitnum1 * backInterp + sitOrder * 2,
    //   valueg1
    // );
     bigArrs = gaussBlur_return(bigArrs, sitnum2 * backInterp*2 + backOrder * 2, sitnum1 * backInterp + backOrder * 2, valueg1)

    bigArrg1New = bigArrs
    // for (let i = 0; i < 72; i++) {
    //   for (let j = 0; j < 72; j++) {
    //     bigArrg1New[(i * 2) * 72 + j * 2] = bigArrg1[i * 72 + j]
    //     bigArrg1New[(i * 2) * 72 + (j * 2 + 1)] = bigArrg1[i * 72 + j]
    //     // bigArrg1New[(i * 2 + 1) * 72 + j] = bigArrg1[i * 72 + j]
    //   }
    // }
    // bigArrg1New = new Array(72 * 72 * 2).fill(0)
    // bigArrg1New[72*2] = 10000

    // const bigArrg1New = new Array(AMOUNTY1*AMOUNTY1).fill(1)


    let k = 0,
      l = 0;

    for (let ix = 0; ix < AMOUNTX1; ix++) {
      for (let iy = 0; iy < AMOUNTY1; iy++) {
        const value = bigArrg1New[l] * 10;

        //柔化处理smooth
        smoothBig1[l] = smoothBig1[l] + (value - smoothBig1[l] + 0.5) / valuel2;

        positions1[k + 1] = -smoothBig1[l] * value2; // y
        let rgb

        // if (backIndexArr && !backIndexArr.every((a) => a == 0)) {

        //   if (ix >= backIndexArr[0] && ix < backIndexArr[1] && iy < AMOUNTY1 - backIndexArr[2] && iy >= AMOUNTY1 - backIndexArr[3]) {
        //     // rgb = [255, 0, 0];
        //     rgb = jetWhite3(0, valuej2, smoothBig1[l]);
        //     scales1[l] = 2;
        //     // positions1[k + 1] = smoothBig1[l] / value2 - 1000
        //   } else {
        //     // rgb = jetgGrey(0, valuej2, smoothBig1[l]);
        //     // scales1[l] = 1;
        //     // rgb = [172 ,197 ,235]
        //   }
        // } else {
        //   rgb = jetWhite3(0, valuej2, smoothBig1[l]);
        //   scales1[l] = 1;
        // }

        rgb = jetWhite3(0, valuej2, smoothBig1[l]);

        colors1[k] = rgb[0] / 255;
        colors1[k + 1] = rgb[1] / 255;
        colors1[k + 2] = rgb[2] / 255;

        if (value < 800) {
          positions1[k] = 0;
          positions1[k + 1] = 0; // y
          positions1[k + 2] = 0; // z
        }

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
    console.log('new')
    // const newData = [...ndata1]
    ndata1 = [...newData1].map((a, index) => (a - valuef1 < 0 ? 0 : a));
    ndata1Num = ndata1.reduce((a, b) => a + b, 0);
    // if (ndata1Num < valuelInit1) {
    //   ndata1 = new Array(sitnum1 * sitnum2).fill(1);
    // }
    console.log(ndata1)
    ndata1 =[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,5,5,5,0,0,0,0,0,0,0,0,0,8,0,0,0,0,0,0,0,0,0,6,0,21,21,27,23,27,18,20,27,36,17,32,15,7,0,0,0,6,0,0,0,0,0,0,0,0,0,0,0,0,23,26,35,21,20,32,28,39,50,18,29,28,33,24,15,36,21,5,21,0,0,0,0,0,0,0,0,0,0,11,11,19,42,33,23,33,34,19,27,46,40,50,36,24,33,37,36,34,20,29,11,5,0,0,0,0,0,0,0,0,0,8,23,25,24,28,32,40,25,33,33,36,40,39,35,43,30,44,25,36,29,24,26,16,19,0,0,0,0,0,0,0,5,22,27,27,32,15,42,41,38,47,43,38,52,33,40,38,47,39,24,19,29,38,27,22,27,13,13,0,0,0,5,8,32,42,26,27,34,25,38,37,38,49,46,49,50,52,37,45,50,46,57,27,29,36,35,32,30,34,55,0,0,0,0,30,28,33,37,26,42,37,38,49,37,45,40,50,27,41,50,54,61,38,47,33,40,37,25,28,42,39,53,0,0,0,19,25,44,41,25,48,60,52,38,51,47,62,57,41,42,44,49,60,56,62,48,34,44,43,37,28,25,35,32,32,0,0,31,19,32,39,36,22,34,49,47,53,48,40,58,41,36,43,59,77,59,62,59,52,40,34,33,41,38,32,14,6,10,12,37,56,30,25,36,15,44,44,38,36,46,61,37,37,27,33,32,46,53,52,48,50,37,50,47,37,34,32,33,23,10,6,31,34,27,23,29,42,27,49,40,34,36,34,48,50,42,36,30,33,44,50,50,39,51,40,38,25,25,26,27,36,0,0,32,27,30,44,31,66,39,28,34,33,43,34,26,38,31,26,33,27,29,25,35,25,31,37,32,40,47,38,35,17,8,10,30,30,26,21,50,49,36,42,26,33,35,32,42,41,30,36,33,31,40,34,31,32,35,32,29,29,34,38,36,12,6,8,39,37,46,20,32,42,26,32,35,29,35,34,29,13,17,27,28,24,19,21,25,23,32,29,22,45,38,33,29,27,16,32,24,22,24,24,25,23,23,22,26,26,23,28,15,22,32,30,31,21,27,17,32,37,38,29,23,18,24,27,24,29,33,31,17,26,27,31,26,22,31,24,20,26,21,21,13,23,20,16,19,16,20,21,22,27,30,21,24,56,41,31,20,11,31,17,27,26,29,12,27,24,24,24,26,22,34,22,16,13,24,16,21,14,17,27,29,32,31,28,32,20,23,30,21,31,76,12,33,30,28,25,20,15,22,28,22,38,21,15,13,11,22,20,18,11,15,16,21,28,24,25,25,32,22,16,15,18,34,24,14,25,22,26,23,21,14,26,19,18,21,16,6,7,10,17,16,13,12,14,26,18,18,26,26,16,24,25,33,32,8,18,31,37,31,26,25,17,24,14,18,11,22,11,7,5,0,8,0,8,11,15,12,17,19,19,15,26,18,21,27,27,16,19,18,26,17,20,18,21,19,21,19,10,27,8,6,5,0,5,5,6,6,5,11,20,11,18,28,25,17,23,17,27,23,14,14,30,25,37,21,26,19,22,20,16,14,6,0,0,0,0,5,0,0,6,11,17,14,16,15,17,16,23,24,35,33,11,31,28,28,21,35,16,24,20,20,17,12,0,0,0,0,0,0,0,0,0,0,9,20,23,20,30,21,24,20,25,28,7,0,22,27,27,29,27,18,20,17,16,0,0,0,0,0,0,0,0,0,0,0,8,15,17,22,21,20,17,31,38,27,0,0,0,5,9,8,11,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,11,15,18,28,19,26,11,0,0,0,0,0,5,8,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,9,7,5,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
    ndata1 = rotate90(ndata1, 32, 32)
    // interp(ndata1, bigArr, sitnum1, sitInterp);
    // ndata1 = gaussBlur_return(ndata1, 32, 32, valueg1)
    const bigArr = lineInterp(ndata1, 32, 32, sitInterp, sitInterp)

    let bigArrs = addSide(
      bigArr,
      sitnum2 * sitInterp,
      sitnum1 * sitInterp,
      sitOrder,
      sitOrder
    );

    bigArrs = gaussBlur_return(bigArrs, sitnum2 * sitInterp + sitOrder * 2, sitnum1 * sitInterp + sitOrder * 2, valueg1 )

    // gaussBlur_1(
    //   bigArrs,
    //   bigArrg,
    //   sitnum2 * sitInterp + sitOrder * 2,
    //   sitnum1 * sitInterp + sitOrder * 2,
    //   valueg1
    // );
    // console.log(big  Arrg)
    bigArrg = bigArrs
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
        // if (sitIndexArr && !sitIndexArr.every((a) => a == 0)) {

        //   if (ix >= sitIndexArr[0] && ix < sitIndexArr[1] && iy >= sitIndexArr[2] && iy < sitIndexArr[3]) {
        //     rgb = jetWhite3(0, valuej1, smoothBig[l]);
        //   } else {
        //     // rgb = jetgGrey(0, valuej1, smoothBig[l]);
        //     rgb = [172 ,197 ,235]
        //   }
        // } else {
        //   rgb = jetWhite3(0, valuej1, smoothBig[l]);
        // }
        rgb = jetWhite3(0, valuej1, smoothBig[l]);

        colors[k] = rgb[0] / 255;
        colors[k + 1] = rgb[1] / 255;
        colors[k + 2] = rgb[2] / 255;

        if (value < 500) {
          positions[k] = 0;
          positions[k + 1] = 0; // y
          positions[k + 2] = 0; // z
        }

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
    backData: backData,
    sitData: sitData,
    changeDataFlag: changeDataFlag,
    sitValue,
    backValue,
    changeSelectFlag,
    actionAll: actionAll,
    actionSit: actionSit,
    actionBack: actionBack,
    changePointRotation,
    changeBox,
    cancelSelect
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
