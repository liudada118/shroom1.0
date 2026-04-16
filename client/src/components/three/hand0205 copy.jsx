import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { TrackballControls } from "three/examples/jsm/controls/TrackballControls";
import React, { useEffect, useImperativeHandle } from "react";
import { TextureLoader } from "three";
import TWEEN from "@tweenjs/tween.js";
import {
  addSide,
  findMax,
  gaussBlur_1,
  interp,
  jet,
  jetWhite3,
  jetgGrey,
  rotate90,
} from "../../assets/util/util";
import { SelectionHelper } from "./SelectionHelper";
import { checkRectIndex, checkRectangleIntersection, getPointCoordinate, getPointCoordinateWowback, getPointCoordinateWowhead, getPointCoordinateback } from "./threeUtil1";

let timer

function debounce(fn, time) {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    fn()
  }, time);
}
let angleFlag = false
let inverseQuaternion, receivedQuaternion;

let baseQuaternion = null;
let baseQuaternionInv = null; // 存储第一个四元数的逆
/**
 * 1.0
 */
// function transformQuaternion(a) {
//   let q = new THREE.Quaternion(...a)
//   if (!baseQuaternion) {
//       // 第一次收到四元数，将其作为基准，并映射到 (1,0,0,0)
//       baseQuaternion = q.clone();
//       return new THREE.Quaternion(0, 0, 0, 1); // 归一化到单位四元数
//   }

//   // 计算新的全局四元数：q'_n = q_0⁻¹ * q_n
//   const qTransformed = new THREE.Quaternion();
//   qTransformed.multiplyQuaternions(baseQuaternion.clone().invert(), q);

//   return qTransformed;
// }

/**
 * 2.0
 */

function transformQuaternion(a) {
  [a[0], a[1]] = [a[1], a[0]]

  let q = new THREE.Quaternion(...a)
  if (!q) {
    console.warn("Received invalid quaternion.");
    return new THREE.Quaternion(0, 0, 0, 1);
  }
  if (!baseQuaternion) {
    // 第一次收到四元数，设为基准
    baseQuaternion = q.clone();
    baseQuaternionInv = baseQuaternion.clone().invert();

    // **关键步骤**：将 `q_0` 重新映射到 `(1,0,0,0)`
    return new THREE.Quaternion(0, 0, 0, 1);
  }

  if (baseQuaternion.lengthSq() === 0) {
    console.warn("Base quaternion is zero, cannot invert.");
    return new THREE.Quaternion(0, 0, 0, 1);
  }

  // **计算 q_n'**
  const qTransformed = new THREE.Quaternion();
  qTransformed.multiplyQuaternions(baseQuaternionInv, q);
  qTransformed.x = -qTransformed.x
  return qTransformed;
}

let baseEulerX = null


let local, quaternion, fingerArr
let cube, chair, mixer, clips;
const Canvas = React.forwardRef((props, refs) => {
  local = props.local
  let showFlag = false
  var FPS = 10;
  var timeS = 0;
  var renderT = 1 / FPS;
  let totalArr = [],
    totalPointArr = [];

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

  let positions1;
  let colors1, scales1;
  let positions;
  let colors, scales;
  let positionsHead;
  let colorsHead, scalesHead;

  const positionY = 120,
    positionX = -10;


  const groupX = -10
  const groupY = -23
  const groupZ = -380
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

    // 初版
    camera.position.z = -10;
    camera.position.y = 30;
    camera.position.x = 0;

    // 更新版
    // camera.position.z = 2000;
    // camera.position.y = -3003;
    // camera.position.x = 0;


    // camera.position.z = 2000;
    // camera.position.y = -3003;
    // camera.position.x = 0;


    // camera.rotation.z = 0;
    // camera.rotation.y = 0;
    // camera.rotation.x = 2.1;


    camera.lookAt(0, 0, 0)
    // scene

    scene = new THREE.Scene();

    // model
    const loader = new GLTFLoader();
    // group.add(chair);
    scene.add(group);
    group.quaternion.set(0, 0, 0, 1)
    loader.load("./model/hand1.glb", function (gltf) {
      chair = gltf.scene;
      // if (props.body) {
      //   chair.rotation.y = -Math.PI / 2;
      //   chair.position.x = 135 - positionX;
      //   chair.position.y = 20 - positionY;

      //   chair.position.z = 150;
      // }
      chair.rotation.x = Math.PI / 6
      chair.rotation.z = -Math.PI;

      // if(!props.hand){
      changeModal(props.hand)
      // }
      // chair.rotation.z = -Math.PI;
      // 初版
      // chair.position.z = 285;
      // chair.position.y = 210;
      // chair.position.x = 10;

      // 更新版
      // chair.position.z = 535;
      // chair.position.y = -810;
      // chair.position.x = 10;

      // chair.scale.set(5, 5, 5)


      // chair.traverse((obj) => {
      //   if (obj.isSkinnedMesh) {
      //     console.log("找到 SkinnedMesh:", obj);

      //     // **获取骨骼系统**
      //     console.log("Skeleton:", obj.skeleton);

      //     // **获取所有骨骼**
      //     console.log("Bones:", obj.skeleton.bones);

      //     // **查看骨骼层级**
      //     obj.skeleton.bones.forEach((bone, index) => {
      //       console.log(`骨骼 ${index}: ${bone.name}`, bone);
      //     });
      //     // const 
      //     const Finger_00 = obj.skeleton.getBoneByName("Finger_00");
      //     const Finger_01 = obj.skeleton.getBoneByName("Finger_01");
      //     const Finger_02 = obj.skeleton.getBoneByName("Finger_02");

      //     const Finger_10 = obj.skeleton.getBoneByName("Finger_10");
      //     const Finger_11 = obj.skeleton.getBoneByName("Finger_11");
      //     const Finger_12 = obj.skeleton.getBoneByName("Finger_12");

      //     const Finger_20 = obj.skeleton.getBoneByName("Finger_20");
      //     const Finger_21 = obj.skeleton.getBoneByName("Finger_21");
      //     const Finger_22 = obj.skeleton.getBoneByName("Finger_22");

      //     const Finger_30 = obj.skeleton.getBoneByName("Finger_30");
      //     const Finger_31 = obj.skeleton.getBoneByName("Finger_31");
      //     const Finger_32 = obj.skeleton.getBoneByName("Finger_32");

      //     const Finger_40 = obj.skeleton.getBoneByName("Finger_40");
      //     const Finger_41 = obj.skeleton.getBoneByName("Finger_41");
      //     const Finger_42 = obj.skeleton.getBoneByName("Finger_42");

      //     if (Finger_00) {
      //       // Finger_00.rotation.z = -Math.PI/5
      //     }
      //     if (Finger_01) {
      //       Finger_01.rotation.z = -Math.PI / 2
      //     }
      //     if (Finger_02) {
      //       Finger_02.rotation.z = -Math.PI / 2
      //     }

      //     if (Finger_10) {
      //       Finger_10.rotation.z = -Math.PI / 2
      //     }
      //     if (Finger_11) {
      //       Finger_11.rotation.z = -Math.PI / 2
      //     }
      //     if (Finger_12) {
      //       Finger_12.rotation.z = -Math.PI / 2
      //     }

      //     if (Finger_20) {
      //       Finger_20.rotation.z = -Math.PI / 2
      //     }
      //     if (Finger_21) {
      //       Finger_21.rotation.z = -Math.PI / 2
      //     }
      //     if (Finger_22) {
      //       Finger_22.rotation.z = -Math.PI / 2
      //     }


      //     if (Finger_30) {
      //       Finger_30.rotation.z = -Math.PI / 2
      //     }
      //     if (Finger_31) {
      //       Finger_31.rotation.z = -Math.PI / 2
      //     }
      //     if (Finger_32) {
      //       Finger_32.rotation.z = -Math.PI / 2
      //     }

      //     if (Finger_40) {
      //       Finger_40.rotation.z = -Math.PI / 2
      //     }
      //     if (Finger_41) {
      //       Finger_41.rotation.z = -Math.PI / 2
      //     }
      //     if (Finger_42) {
      //       Finger_42.rotation.z = -Math.PI / 2
      //     }
      //   }
      // });

      group.add(chair);




      // group.position.x = groupX;
      // group.position.y = groupY;
      // group.position.z = groupZ;
      // const arr = [0.8733426332473755, -0.34111812710762024, -0.2885167896747589, 0.19408577680587769]

      //  if(arr) angleFlag = true
      // chair.rotation.x = Math.PI
      // chair.rotation.z = Math.PI
      // chair.rotation.y = 0
      // // chair.quaternion.set(1, -1, 0, -1);


      // chair.rotation.x = -Math.PI / 3
      // chair.rotation.z = Math.PI
      // chair.rotation.y = 0
      // if (chair) chair.quaternion.set(0, 0, 0, 1)
      // changeHandAngle([0.97,0.10,0.17,0.05])
    });

    const helper = new THREE.GridHelper(2000, 100);
    helper.position.y = -199;
    helper.material.opacity = 0.25;
    helper.material.transparent = true;
    scene.add(helper);

    // lights
    // const hemiLight = new THREE.HemisphereLight(0xcccccc, 0xcccccc);
    // hemiLight.position.set(0, 2000, 0);
    // scene.add(hemiLight);

    const light = new THREE.AmbientLight(0x778592); // 柔和的白光
    scene.add(light);

    // const hemiLight1 = new THREE.HemisphereLight(0xcccccc, 0xcccccc);
    // hemiLight.position.set(100, 2000, 0);
    // scene.add(hemiLigh2t1);


    // const dirLight = new THREE.DirectionalLight(0xcccccc);
    // dirLight.position.set(0, 2000, 10);
    // scene.add(dirLight);
    // const dirLight1 = new THREE.DirectionalLight(0xcccccc);
    // dirLight1.position.set(0, 10, 2000);
    // scene.add(dirLight1);

    const coordinates = [200, 0, 200];

    for (let x of coordinates) {
      for (let y of coordinates) {
        for (let z of coordinates) {
          // points.push([x, y, z]);
          const pointlight5 = new THREE.PointLight(0xffffff, 0.04, 2000);
          pointlight5.position.set(x, y, z);
          scene.add(pointlight5);

          const sphereSize = 1;
          const pointLightHelper = new THREE.PointLightHelper(pointlight5, sphereSize);
          scene.add(pointLightHelper);
        }
      }
    }

    // renderer

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);

    renderer.setSize(window.innerWidth, window.innerHeight);

    renderer.outputEncoding = THREE.sRGBEncoding;
    container.replaceChildren(renderer.domElement);

    renderer.setClearColor(0x778592);

    //FlyControls
    controls = new TrackballControls(camera, renderer.domElement);
    controls.dynamicDampingFactor = 1;
    controls.domElement = container;
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.PAN, // make pan the default instead of rotate
      MIDDLE: THREE.MOUSE.ZOOM,
      RIGHT: THREE.MOUSE.ROTATE,
    };
    initSet();

    window.addEventListener("resize", onWindowResize);

    function onWindowResize() {
      renderer.setSize(window.innerWidth, window.innerHeight);

      camera.aspect = window.innerWidth / window.innerHeight;

      // camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
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
      size: 1 / 6,
    });
    sitGeometry.setAttribute("scale", new THREE.BufferAttribute(scales, 1));
    sitGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    particles = new THREE.Points(sitGeometry, material);

    particles.scale.x = 0.001;
    particles.scale.y = 0.001;
    particles.scale.z = 0.001;


    particles.rotation.x = Math.PI / 2;
    // particles.rotation.y = 0; //-Math.PI / 2;
    // particles.rotation.y = Math.PI 
    // particles.rotation.z = Math.PI
    // scene.add(particles);
    particles.position.z = 286.2
    particles.position.y = 211.5
    particles.position.x = 8.55
    group.add(particles);
    particles.material.opacity = showFlag ? 1 : 0
  }


  function rotateFingers(arr) {
    if (chair) {
      chair.traverse((obj) => {
        if (obj.isSkinnedMesh) {
          // console.log("找到 SkinnedMesh:", obj);

          // // **获取骨骼系统**
          // console.log("Skeleton:", obj.skeleton);

          // // **获取所有骨骼**
          // console.log("Bones:", obj.skeleton.bones);

          // **查看骨骼层级**

          // const 
          const Finger_01 = obj.skeleton.getBoneByName("Finger_01");
          const Finger_02 = obj.skeleton.getBoneByName("Finger_02");

          const Finger_10 = obj.skeleton.getBoneByName("Finger_10");
          const Finger_11 = obj.skeleton.getBoneByName("Finger_11");
          const Finger_12 = obj.skeleton.getBoneByName("Finger_12");

          const Finger_20 = obj.skeleton.getBoneByName("Finger_20");
          const Finger_21 = obj.skeleton.getBoneByName("Finger_21");
          const Finger_22 = obj.skeleton.getBoneByName("Finger_22");

          const Finger_30 = obj.skeleton.getBoneByName("Finger_30");
          const Finger_31 = obj.skeleton.getBoneByName("Finger_31");
          const Finger_32 = obj.skeleton.getBoneByName("Finger_32");

          const Finger_40 = obj.skeleton.getBoneByName("Finger_40");
          const Finger_41 = obj.skeleton.getBoneByName("Finger_41");
          const Finger_42 = obj.skeleton.getBoneByName("Finger_42");


          rotateFinger([Finger_01, Finger_02], arr[0])
          rotateFinger([Finger_10, Finger_11, Finger_12], arr[1])
          rotateFinger([Finger_20, Finger_21, Finger_22], arr[2])
          rotateFinger([Finger_30, Finger_31, Finger_32], arr[3])
          rotateFinger([Finger_40, Finger_41, Finger_42], arr[4])

        }
      });
    }

  }

  function rotateFinger(fingerArr, value) {
    fingerArr.forEach((a) => {
      if (a) {
        a.rotation.z = (-Math.PI / 2) * value
      }
    })
  }

  //模型动画

  function animate(timestamp) {

    const delta = timestamp - lastRender;

    if (delta >= 1000 / 60) {
      render();
      lastRender = timestamp;
    }

    // dataFlag = false
    // }
    animationRequestId = requestAnimationFrame(animate);
  }


  // for(let i = 0  )

  function initndata1Data() {
    let glovesPoints =
      [[8, 3], [8, 4], [10, 3], [10, 4], [12, 3], [12, 4], [3, 7], [3, 8], [7, 7], [7, 8], [11, 7], [11, 8], [1, 14], [1, 15], [6, 13], [6, 14], [11, 12], [11, 13], [4, 20], [4, 21], [8, 18], [8, 19], [12, 17], [12, 18], [20, 27], [20, 28], [21, 24], [21, 25], [22, 21], [22, 22], [15, 6], [15, 7], [15, 8], [15, 9], [15, 10], [15, 11], [15, 12], [15, 13], [17, 6], [17, 7], [17, 8], [17, 9], [17, 10], [17, 11], [17, 12], [17, 13], [19, 6], [19, 7], [19, 8], [19, 9], [19, 10], [19, 11], [19, 12], [19, 13], [19, 14], [19, 15], [20, 6], [20, 7], [20, 8], [20, 9], [20, 10], [20, 11], [20, 12], [20, 13], [20, 14], [20, 15], [21, 6], [21, 7], [21, 8], [21, 9], [21, 10], [21, 11], [21, 12], [21, 13], [21, 14], [21, 15], [22, 6], [22, 7], [22, 8], [22, 9], [22, 10], [22, 11], [22, 12], [22, 13], [22, 14], [22, 15], [23, 6], [23, 7], [23, 8], [23, 9], [23, 10], [23, 11], [23, 12], [23, 13], [23, 14], [23, 15]]


    let glovesPoints1 =
      [[10, 2], [10, 3], [4, 7], [4, 8], [2, 14], [2, 15], [3, 21], [3, 22], [15, 27], [15, 28],
      [12, 4], [12, 5], [8, 9], [8, 10], [7, 14], [7, 15], [7, 20], [7, 21], [17, 26], [17, 27],
      [14, 6], [14, 7], [12, 10], [12, 11], [11, 14], [11, 15], [11, 19], [11, 20], [19, 24], [19, 25],
      [16, 11], [16, 12], [16, 13], [16, 14], [16, 15], [16, 16], [16, 17], [16, 18],
      [19, 11], [19, 12], [19, 13], [19, 14], [19, 15], [19, 16], [19, 17], [19, 18],
      [22, 11], [22, 12], [22, 13], [22, 14], [22, 15], [22, 16], [22, 17], [22, 18], [22, 19], [22, 20],
      [23, 11], [23, 12], [23, 13], [23, 14], [23, 15], [23, 16], [23, 17], [23, 18], [23, 19], [23, 20],
      [24, 11], [24, 12], [24, 13], [24, 14], [24, 15], [24, 16], [24, 17], [24, 18], [24, 19], [24, 20],
      [25, 11], [25, 12], [25, 13], [25, 14], [25, 15], [25, 16], [25, 17], [25, 18], [25, 19], [25, 20],
      [26, 11], [26, 12], [26, 13], [26, 14], [26, 15], [26, 16], [26, 17], [26, 18], [26, 19], [26, 20]]
    // glovesPoints = glovesPoints1

    let newZeroArr = new Array(1024).fill(0)

    for (let i = 0; i < 3 * 10 + 2 * 8; i++) {
      newZeroArr[glovesPoints[i][0] * 32 + glovesPoints[i][1]] = 5
      newZeroArr[(glovesPoints[i][0] + 1) * 32 + glovesPoints[i][1]] = 5
    }
    for (let i = 3 * 10 + 2 * 8; i < 3 * 10 + 2 * 8 + 5 * 10; i++) {
      newZeroArr[glovesPoints[i][0] * 32 + glovesPoints[i][1]] = 5
    }

    newZeroArr = rotate90(newZeroArr, 32, 32)

    // return newZeroArr
    ndata2 = newZeroArr
  }
  var ndata2
  //  更新座椅数据
  function sitRenew() {

    if (group && baseQuaternion && quaternion) group.quaternion.copy(quaternion);
    if (fingerArr) rotateFingers(fingerArr)


    // initndata1Data()

    // interp(ndata1, bigArr, sitnum1, sitInterp);

    // console.log(first)
    // let bigArrs = addSide(
    //   bigArr,
    //   sitnum2 * sitInterp,
    //   sitnum1 * sitInterp,
    //   sitOrder,
    //   sitOrder
    // );


    // interp(ndata2, bigArrhand, sitnum1, sitInterp);
    // let bigArrshand1 = addSide(
    //   bigArrhand,
    //   sitnum2 * sitInterp,
    //   sitnum1 * sitInterp,
    //   sitOrder,
    //   sitOrder
    // );
    // gaussBlur_1(
    //   bigArrshand1,
    //   bigArrshand,
    //   sitnum2 * sitInterp + sitOrder * 2,
    //   sitnum1 * sitInterp + sitOrder * 2,
    //   1.2
    // );
    // gaussBlur_1(
    //   bigArrs,
    //   bigArrg,
    //   sitnum2 * sitInterp + sitOrder * 2,
    //   sitnum1 * sitInterp + sitOrder * 2,
    //   valueg1
    // );



    // let k = 0,
    //   l = 0;
    // let dataArr = []
    // for (let ix = 0; ix < AMOUNTX; ix++) {
    //   for (let iy = 0; iy < AMOUNTY; iy++) {
    //     const value = bigArrg[l] * 10;
    //     const valuehand = bigArrshand[l] * 10
    //     //柔化处理smooth
    //     smoothBig[l] = smoothBig[l] + (value - smoothBig[l] + 0.5) / valuel1;

    //     positions[k] = ix * SEPARATION - (AMOUNTX * SEPARATION) / 2; // x
    //     positions[k + 1] = smoothBig[l] * value1; // y
    //     positions[k + 2] = iy * SEPARATION - (AMOUNTY * SEPARATION) / 2; // z
    //     // console.log(value)
    //     if (valuehand < 50) {
    //       positions[k + 1] = -100000
    //       positions[k] = 0
    //       positions[k + 2] = 0
    //     }
    //     let rgb

    //     if (sitIndexArr && !sitIndexArr.every((a) => a == 0)) {

    //       if (ix >= sitIndexArr[0] && ix < sitIndexArr[1] && iy >= sitIndexArr[2] && iy < sitIndexArr[3]) {
    //         // rgb = [255, 0, 0];
    //         rgb = jet(0, valuej1, smoothBig[l]);
    //         // scales1[l] = 2;
    //         // positions1[k + 1] = smoothBig[l] / value2 - 1000
    //         dataArr.push(bigArrg[l])
    //       } else {
    //         rgb = jetgGrey(0, valuej1, smoothBig[l]);
    //         // scales1[l] = 1;
    //       }
    //     } else {
    //       rgb = jet(0, valuej1, smoothBig[l]);
    //       // scales1[l] = 1;
    //     }

    //     colors[k] = rgb[0] / 255;
    //     colors[k + 1] = rgb[1] / 255;
    //     colors[k + 2] = rgb[2] / 255;

    //     k += 3;
    //     l++;
    //   }
    // }


    // if (!sitIndexArr.length || sitIndexArr.every((a) => a == 0)) {
    // dataArr = bigArrg
    // }


    var T = clock.getDelta();
    timeS = timeS + T;

    let dataArr = ndata1
    if (timeS > renderT) {
      // console.log(renderT)
      dataArr = dataArr.filter((a) => a > valuej1 * 0.025)
      const max = findMax(dataArr)
      const point = ndata1.filter((a) => a > 0).length
      const press = dataArr.reduce((a, b) => a + b, 0)
      const mean = press / (point == 0 ? 1 : point)

      props.data.current?.changeData({
        meanPres: mean.toFixed(2),
        maxPres: max,
        point: point,
        totalPres: press.toFixed(0),
      });
      const fingerR = fingerArr ? Math.floor(fingerArr[1] * 180) : 0
      props.data.current?.changeData({
        indexAngle: fingerR
      })
      // fingerArr
      if (totalArr.length < 20) {
        totalArr.push(fingerR);
      } else {
        totalArr.shift();
        totalArr.push(fingerR);
      }

      const maxTotal = findMax(totalArr);



      if (!local)
        props.data.current?.handleCharts(totalArr, 180);

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
    // sitGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  }

  function render() {
    // backRenew();
    sitRenew();
    // headRenew()
    // camera.position.set(0,-1000,-50)
    // camera.rotation.set(2.5,0,0,)
    // console.log(camera.position, 'position')
    // console.log(camera.rotation, 'rotation')


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
    ndata1 = ndata1.map((a, index) => (a - valuef1 < 0 ? 0 : a));

    ndata1Num = ndata1.reduce((a, b) => a + b, 0);

    if (ndata1Num < valuelInit) {
      ndata1 = new Array(sitnum1 * sitnum2).fill(0);
    }

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

  function changeShow() {
    showFlag = !showFlag
    particles.material.opacity = showFlag ? 1 : 0
  }

  function changeHandAngle(arr) {
    if (arr && !arr.includes(undefined)) {
      quaternion = transformQuaternion(arr)
    }

  }

  function calibration(arr) {
    fingerArr = arr

  }

  function handZero() {
    // chair.rotation.x = -Math.PI / 3
    // chair.rotation.z = Math.PI
    // chair.rotation.y = 0
    calibration(new Array(5).fill(0))
    // rotateFingers([0,0,0,0,0])
    chair.rotation.set(0, 0, -Math.PI)
    // group.quaternion.set(0, 0, 0, 1)
    quaternion = new THREE.Quaternion(0, 0, 0, 1)

    chair.matrixAutoUpdate = true;
    chair.updateMatrixWorld(true);
    group.matrixAutoUpdate = true;
    group.updateMatrixWorld(true);

    // chair.quaternion.identity();
    // chair.matrix.identity();
    // // 确保矩阵更新
    // chair.updateMatrix();

    // 禁用自动更新
    // chair.matrixAutoUpdate = false;
    // setTimeout(() => {
    //   calibration([0,0,0])
    // }, 1000);
    // // 重置矩阵为单位矩阵
    // chair.matrix.identity();

    // // 如果需要同步更新 position、quaternion 和 scale
    // chair.matrix.decompose(chair.position, chair.quaternion, chair.scale);
  }

  function resetHand() {
    baseQuaternion = null
  }

  function changaCamera(obj) {
    let { x, y, z } = obj
    if (x) {
      // camera.position.x = x;
      chair.rotation.x = x
    }

    if (y) {
      // camera.position.y = y;
      chair.rotation.y = y
    }

    if (z) {
      // camera.position.z = z;
      chair.rotation.z = z
    }
  }

  function changeModal(bool) {
    if (bool) {
      if (chair) {
        chair.scale.x = 1
      }
    } else {
      if (chair) {
        chair.scale.x = -1
      }
    }
  }

  useImperativeHandle(refs, () => ({
    changeHandAngle,
    changeShow,
    sitData,
    changeDataFlag: changeDataFlag,
    changePointRotation,
    changeBox,
    cancelSelect,
    calibration,
    handZero,
    resetHand,
    changaCamera,
    changeModal
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
