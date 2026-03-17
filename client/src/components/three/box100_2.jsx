import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
// import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { TrackballControls } from "three/examples/jsm/controls/TrackballControls";
import React, { useEffect, useImperativeHandle } from "react";
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
import { bodydata } from "../../assets/json/body";
import { handL } from "../../assets/json/handL";
import { handR } from "../../assets/json/handR";

let timer
var canvas
const width = 36, height = 36 * 2
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
let bodyValue = 2000

function transformQuaternion(a) {
  [a[0], a[1]] = [a[1], a[0]]

  let q = new THREE.Quaternion(...a)
  if (!q) {
    console.warn("Received invalid quaternion.");
    return new THREE.Quaternion(1, 0, 0, 0);
  }

  if (!baseQuaternion) {
    // 第一次收到四元数，设为基准
    baseQuaternion = q.clone();
    baseQuaternionInv = baseQuaternion.clone().invert();

    // **关键步骤**：将 `q_0` 重新映射到 `(1,0,0,0)`
    return new THREE.Quaternion(1, 0, 0, 0);
  }

  if (baseQuaternion.lengthSq() === 0) {
    console.warn("Base quaternion is zero, cannot invert.");
    return new THREE.Quaternion(1, 0, 0, 0);
  }

  // **计算 q_n'**
  const qTransformed = new THREE.Quaternion();
  qTransformed.multiplyQuaternions(baseQuaternionInv, q);
  qTransformed.x = -qTransformed.x
  return qTransformed;
}


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


    camera.position.z = 1;
    camera.position.y = 280;
    camera.position.x = 0;

    camera.lookAt(0, 0, 0)
    // scene

    scene = new THREE.Scene();

    // model
    scene.add(group);
    scene.add(pointGroup);

    const loader = new GLTFLoader();

    loader.load("./model/man.glb", function (gltf) {
      chair = gltf.scene;


      group.add(chair);

      console.log(chair)
      chair.position.z = 0
      chair.rotation.x = 0//-Math.PI / 3
      chair.rotation.z = 0//Math.PI
      chair.rotation.y = Math.PI
      // chair.rotation.x = Math.PI/2

      chair.scale.set(100,100,100)
      // convertToPoints(chair)

      // const frontPoints = getFrontFacePoints(chair, camera);
      // console.log("正面点索引:", frontPoints);

      // const colors = new Float32Array(geometry.attributes.position.count * 3).fill(1.0);
      // frontPoints.forEach((index) => {
      //   colors[index * 3] = 1.0;   // R = 1.0 (红色)
      //   colors[index * 3 + 1] = 0.0; // G = 0.0
      //   colors[index * 3 + 2] = 0.0; // B = 0.0
      // });
      // geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      // geometry.attributes.color.needsUpdate = true;

      // red(chair)

      addCanvas(chair)

    });

    // const loader = new FBXLoader();
    // loader.load("./model/man.fbx", (fbx) => {
    //   // fbx.scale.set(0.01, 0.01, 0.01); // 可能需要缩小模型
    //   fbx.rotation.z = Math.PI/2
    //   group.add(fbx);
    //   console.log("FBX 模型加载成功", fbx);


    //   // getFrontFacePoints(fbx , camera)

    //   // convertToPoints(fbx)
    //   red(fbx)
      
    // },
    //   (xhr) => {
    //     console.log((xhr.loaded / xhr.total) * 100 + "% 已加载");
    //   },
    //   (error) => {
    //     console.error("FBX 加载失败", error);
    //   });


    function addCanvas(model) {
      //  canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 256;
      // const ctx = canvas.getContext('2d');

      // 示例：填充红色背景，可以替换成你需要的绘制内容
      // ctx.fillStyle = 'red';
      // ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 3. 创建 CanvasTexture
      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      // 4. 遍历模型，给每个 Mesh 的材质添加 Canvas 纹理
      model.traverse((child) => {
        if (child.isMesh) {
          // 处理材质数组的情况
          if (Array.isArray(child.material)) {
            child.material.forEach((mat) => {
              mat.map = texture;
              mat.needsUpdate = true;
            });
          } else {
            child.material.map = texture;
            child.material.needsUpdate = true;
          }
        }
      });
    }


    const bodyArr = ['926', '8B3', '913']

    function convertToPoints(model) {
      model.traverse((child) => {
        console.log(child)
        if (child.isMesh) {
          const geometry = child.geometry;
          let material
          const frontIndices = []
          const positions = geometry.attributes.position.array;
          // const colors = geometry.attributes.color.array;
          const colors = new Float32Array(positions.length);
          if (bodyArr.includes(child.name)) {


            material = new THREE.PointsMaterial({
              color: 0xffffff,   // 颜色
              size: 2,           // 点大小
              sizeAttenuation: true, // 远近衰减
              vertexColors: true,
            });
            // const selectedIndices = [];

            // for (let i = 0; i < positions.length; i += 3) {
            //   const x = positions[i];
            //   const y = positions[i + 1];
            //   const z = positions[i + 2];

            //   colors[i] = 255 / 255;
            //   colors[i + 1] = 255 / 255;
            //   colors[i + 2] = 255 / 255;
            //   if (y > 50) { // 例如，Z 轴大于 1 的点
            //     // selectedIndices.push(i / 3); // 记录点索引

            //     colors[i] = 0 / 255;
            //     colors[i + 1] = 0 / 255;
            //     colors[i + 2] = 255 / 255;

            //   }
            // }


            // // geometry.attributes.color.needsUpdate = true;
            // // geometry.setAttribute(
            // //   "position",
            // //   new THREE.BufferAttribute(positions, 3)
            // // );
            // geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));



            // selectedIndices.forEach((index) => {
            //   positions[index * 3 + 1] += 20; // 让 Y 轴上移 0.5
            // });

            // console.log(child, JSON.stringify(selectedIndices))


            const normals = geometry.attributes.normal.array;
            const cameraPosition = camera.position.clone();

            for (let i = 0; i < positions.length; i += 3) {
              // 获取顶点位置
              const vertex = new THREE.Vector3(positions[i], positions[i + 1], positions[i + 2]);

              // 获取法线方向
              const normal = new THREE.Vector3(normals[i], normals[i + 1], normals[i + 2]);

              // 计算从顶点到摄像机的方向向量
              const toCamera = cameraPosition.clone().sub(vertex).normalize();

              // 计算法线与摄像机方向的夹角（点积）
              const dot = normal.dot(toCamera);

              if (dot > 0) { // dot > 0 说明法线朝向摄像机
                frontIndices.push(i / 3);
              }
            }

            const colors = new Float32Array(geometry.attributes.position.count * 3).fill(1.0);
            frontIndices.forEach((index) => {
              colors[index * 3] = 1.0; // 红色
              colors[index * 3 + 1] = 0.0;
              colors[index * 3 + 2] = 0.0;
            });
            geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
            geometry.attributes.color.needsUpdate = true;

          } else {
            material = new THREE.PointsMaterial({
              color: 0xff0000,   // 颜色
              size: 2,           // 点大小
              sizeAttenuation: true // 远近衰减
            });
          }


          const points = new THREE.Points(geometry, material);




          model.remove(child); // 移除原始 Mesh
          model.add(points);   // 添加点云
        }
      });
    }

    function red(model) {
      // 假设 model 已经加载完成，camera 为当前摄像机
      // 假设 model 已加载，camera 为场景摄像机
      // 假设 model 已加载，camera 为场景摄像机
      const threshold = 100; // 你可以根据实际情况调整这个阈值
      const material = new THREE.PointsMaterial({
        size: 2,           // 点大小
        sizeAttenuation: true, // 远近衰减
        vertexColors: true,
      });

      // 确保模型加载完成后再调用此代码
      model.traverse(child => {
        const frontVertices = [];
        // if (child.isMesh && bodyArr.includes(child.name)) {
        if (child.isMesh) {
          console.log(child , 'child')
          const geometry = child.geometry;
          const posAttr = geometry.attributes.position;

          // 如果几何体没有 color 属性，则添加（默认全白）
          if (!geometry.attributes.color) {
            const count = posAttr.count;
            const colors = new Float32Array(count * 3);
            for (let i = 0; i < count; i++) {
              colors[i * 3] = 1.0;
              colors[i * 3 + 1] = 1.0;
              colors[i * 3 + 2] = 1.0;
            }
            geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
          }
          const colors = geometry.attributes.color.array;

          // 获取摄像机的世界坐标
          const cameraWorldPos = new THREE.Vector3();
          camera.getWorldPosition(cameraWorldPos);

          // 定义辅助变量
          const v0 = new THREE.Vector3(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3();
          const v0World = new THREE.Vector3(), v1World = new THREE.Vector3(), v2World = new THREE.Vector3();
          const center = new THREE.Vector3();
          const edge1 = new THREE.Vector3(), edge2 = new THREE.Vector3();
          const faceNormal = new THREE.Vector3(), toCamera = new THREE.Vector3();

          // 设置阈值，可根据调试输出调整此值
          const threshold = 0.1;

          // 判断是否有索引
          if (geometry.index) {
            const indices = geometry.index.array;
            for (let i = 0; i < indices.length; i += 3) {
              const ia = indices[i], ib = indices[i + 1], ic = indices[i + 2];

              // 从 BufferAttribute 获取局部坐标
              v0.fromBufferAttribute(posAttr, ia);
              v1.fromBufferAttribute(posAttr, ib);
              v2.fromBufferAttribute(posAttr, ic);

              // 转换到世界坐标（考虑子对象的变换）
              v0World.copy(v0).applyMatrix4(child.matrixWorld);
              v1World.copy(v1).applyMatrix4(child.matrixWorld);
              v2World.copy(v2).applyMatrix4(child.matrixWorld);

              // 计算三角形中心
              center.copy(v0World).add(v1World).add(v2World).divideScalar(3);

              // 计算边向量及面法线
              edge1.subVectors(v1World, v0World);
              edge2.subVectors(v2World, v0World);
              faceNormal.crossVectors(edge1, edge2).normalize();

              // 计算从中心到摄像机的方向向量
              toCamera.subVectors(cameraWorldPos, center).normalize();

              // 获取 dot 值，用于调试
              const dot = faceNormal.dot(toCamera);
              // console.log("dot value:", dot);  // 可打开此行查看值

              // 如果 dot 值大于阈值，则认为该三角形正面朝向摄像机
              if (dot > threshold) {
                colors[ia * 3] = 1.0;
                colors[ia * 3 + 1] = 0.0;
                colors[ia * 3 + 2] = 0.0;

                colors[ib * 3] = 1.0;
                colors[ib * 3 + 1] = 0.0;
                colors[ib * 3 + 2] = 0.0;

                colors[ic * 3] = 1.0;
                colors[ic * 3 + 1] = 0.0;
                colors[ic * 3 + 2] = 0.0;

                frontVertices.push(v0World.clone(), v1World.clone(), v2World.clone());
              }
            }
          } else {
            // 没有索引的几何体：每3个连续顶点构成一个三角形
            const count = posAttr.count;
            for (let i = 0; i < count; i += 3) {
              // 注意：i、i+1、i+2 必须在 count 范围内
              if (i + 2 >= count) break;

              v0.fromBufferAttribute(posAttr, i);
              v1.fromBufferAttribute(posAttr, i + 1);
              v2.fromBufferAttribute(posAttr, i + 2);

              v0World.copy(v0).applyMatrix4(child.matrixWorld);
              v1World.copy(v1).applyMatrix4(child.matrixWorld);
              v2World.copy(v2).applyMatrix4(child.matrixWorld);

              center.copy(v0World).add(v1World).add(v2World).divideScalar(3);
              edge1.subVectors(v1World, v0World);
              edge2.subVectors(v2World, v0World);
              faceNormal.crossVectors(edge1, edge2).normalize();

              toCamera.subVectors(cameraWorldPos, center).normalize();
              const dot = faceNormal.dot(toCamera);
              // console.log("dot value:", dot);

              if (dot > threshold) {
                colors[i * 3] = 1.0;
                colors[i * 3 + 1] = 0.0;
                colors[i * 3 + 2] = 0.0;

                colors[(i + 1) * 3] = 1.0;
                colors[(i + 1) * 3 + 1] = 0.0;
                colors[(i + 1) * 3 + 2] = 0.0;

                colors[(i + 2) * 3] = 1.0;
                colors[(i + 2) * 3 + 1] = 0.0;
                colors[(i + 2) * 3 + 2] = 0.0;


                frontVertices.push(v0World.clone(), v1World.clone(), v2World.clone());
              }
            }
          }

          console.log(JSON.stringify(frontVertices))
          // 更新颜色属性
          const points = new THREE.Points(geometry, material);
          model.add(points);
          geometry.attributes.color.needsUpdate = true;
        }
      });




      // const points = new THREE.Points(geometry, material);
      // model.add(points);  
      // geometry.attributes.color.needsUpdate = true;

    }

    function getFrontFacePoints(model, camera) {
      const frontIndices = new Set(); // 用 Set 只存储唯一的正面点索引

      model.traverse((child) => {
        if (child.isMesh) {
          const geometry = child.geometry;
          const positions = geometry.attributes.position.array;
          const normals = geometry.attributes.normal.array;
          const cameraPosition = camera.position.clone();

          for (let i = 0; i < positions.length; i += 9) { // 每 9 个值（3 个顶点）构成一个三角形
            // 获取三角形的 3 个顶点
            const v0 = new THREE.Vector3(positions[i], positions[i + 1], positions[i + 2]);
            const v1 = new THREE.Vector3(positions[i + 3], positions[i + 4], positions[i + 5]);
            const v2 = new THREE.Vector3(positions[i + 6], positions[i + 7], positions[i + 8]);

            // 获取三角形的法线（取第一个顶点的法线）
            const normal = new THREE.Vector3(normals[i], normals[i + 1], normals[i + 2]);

            // 计算三角形中心点
            const center = v0.clone().add(v1).add(v2).divideScalar(3);

            // 计算从中心点到摄像机的方向
            const toCamera = cameraPosition.clone().sub(center).normalize();

            // 计算法线和摄像机方向的点积
            const dot = normal.dot(toCamera);

            if (dot > 0) { // 说明这个三角形是正面朝向摄像机的
              frontIndices.add(i / 3);
              frontIndices.add(i / 3 + 1);
              frontIndices.add(i / 3 + 2);
            }
          }
        }
      });

      return Array.from(frontIndices); // 转换成数组返回
    }


    const helper = new THREE.GridHelper(2000, 100);
    helper.position.y = -199;
    helper.material.opacity = 0.25;
    helper.material.transparent = true;
    scene.add(helper);

    // lights
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff);
    hemiLight.position.set(0, 1000, 0);
    scene.add(hemiLight);

    const hemiLight1 = new THREE.HemisphereLight(0xffffff, 0xffffff);
    hemiLight1.position.set(2000, 0, 0);
    scene.add(hemiLight1);

    // const hemiLight1 = new THREE.HemisphereLight(0xffffff, 0xffffff);
    // hemiLight.position.set(100, 200, 0);
    // scene.add(hemiLight1);


    const dirLight = new THREE.DirectionalLight(0xffffff);
    dirLight.position.set(0, 2000, 10);
    scene.add(dirLight);
    const dirLight1 = new THREE.DirectionalLight(0xffffff);
    dirLight1.position.set(0, 10, 2000);
    scene.add(dirLight1);
    const dirLight2 = new THREE.DirectionalLight(0xffffff);
    dirLight2.position.set(1000, 1000, 0);
    scene.add(dirLight2);
    const dirLight3 = new THREE.DirectionalLight(0xffffff);
    dirLight3.position.set(-1000, 1000, 0);
    scene.add(dirLight3);
    // renderer

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);

    renderer.setSize(window.innerWidth, window.innerHeight);

    renderer.outputEncoding = THREE.sRGBEncoding;
    container.replaceChildren(renderer.domElement);

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


    initPoints()

  }

  const neckConfig = { sitnum1: 3, sitnum2: 2, sitInterp: 2, sitInterp1: 2, sitOrder: 3, }
  const backConfig = { sitnum1: 3, sitnum2: 2, sitInterp: 2, sitInterp1: 2, sitOrder: 3 }
  const sitConfig = { sitnum1: 6, sitnum2: 10, sitInterp: 2, sitInterp1: 2, sitOrder: 3 }
  // const handLeftConfig = { sitnum1: 3, sitnum2: 4, sitInterp: 1, sitInterp1: 2, sitOrder: 3 }
  // const handRightConfig = { sitnum1: 3, sitnum2: 4, sitInterp: 1, sitInterp1: 2, sitOrder: 3 }

  function addTotal(objArr) {
    objArr.forEach((obj) => {
      const { sitnum1, sitnum2, sitInterp, sitInterp1, sitOrder } = obj
      const AMOUNTX = sitnum1 * sitInterp + sitOrder * 2;
      const AMOUNTY = sitnum2 * sitInterp1 + sitOrder * 2;
      const numParticles = AMOUNTX * AMOUNTY;
      obj.total = numParticles
    })
  }

  // addTotal([neckConfig, backConfig, sitConfig, handLeftConfig, handRightConfig])

  let allConfig = {
    neck: {
      dataConfig: neckConfig,
      name: 'neck',
      pointConfig: { position: [-7, 10, -40], rotation: [] },
    },
    back: {
      dataConfig: backConfig,
      name: 'back',
      pointConfig: { position: [7, 10, -25], rotation: [] },
    },
    sit: {
      dataConfig: sitConfig,
      name: 'sit',
      pointConfig: { position: [-3, 10, 20], rotation: [] },
    },
    // handLeft: {
    //   dataConfig: handLeftConfig,
    //   name: 'handLeft',
    //   pointConfig: { position: [-18, 10, -19], rotation: [0, Math.PI * 5 / 12, 0] },
    // },
    // handRight: {
    //   dataConfig: handRightConfig,
    //   name: 'handRight',
    //   pointConfig: { position: [24, 10, -24], rotation: [0, - Math.PI * 5 / 12, 0] },
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
      size: 2,
    });
    sitGeometry.setAttribute("scale", new THREE.BufferAttribute(scales, 1));
    sitGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const particles = new THREE.Points(sitGeometry, material);

    particles.scale.x = 0.01;
    particles.scale.y = 0.01;
    particles.scale.z = 0.01;

    // particles.position.z = 0
    // particles.position.y = 0
    // particles.position.x = 0
    if (position.length) particles.position.set(...position)
    if (rotation.length) particles.rotation.set(...rotation)
    particles.name = name
    group.add(particles);
  }

  const initBodyPoint = (positionArr) => {
    const length = positionArr.length
    const positions = new Float32Array(length * 3);
    const scales = new Float32Array(length);
    const colors = new Float32Array(length * 3);
    // console.log(length)

    let i = 0,
      j = 0;

    // for (let ix = 0; ix < AMOUNTX; ix++) {
    //   for (let iy = 0; iy < AMOUNTY; iy++) {
    //     positions[i] = iy * SEPARATION - (AMOUNTX * SEPARATION) / 2; // x
    //     positions[i + 1] = 0; // y
    //     positions[i + 2] = ix * SEPARATION - (AMOUNTY * SEPARATION) / 2; // z

    //     scales[j] = 1;
    //     colors[i] = 0 / 255;
    //     colors[i + 1] = 0 / 255;
    //     colors[i + 2] = 255 / 255;
    //     i += 3;
    //     j++;
    //   }
    // }

    for (let i = 0, j = 0; i < length; i++) {

      const itemData = positionArr[i]
      positions[j] = itemData.x; // x
      positions[j + 1] = itemData.y; // y
      positions[j + 2] = itemData.z; // z

      if (i < bodyValue) {
        colors[j] = 0 / 255;
        colors[j + 1] = 0 / 255;
        colors[j + 2] = 255 / 255;
      } else {
        colors[j] = 255 / 255;
        colors[j + 1] = 0 / 255;
        colors[j + 2] = 0 / 255;
      }


      j += 3
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
      size: 4,
    });
    sitGeometry.setAttribute("scale", new THREE.BufferAttribute(scales, 1));
    sitGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const particles = new THREE.Points(sitGeometry, material);

    // particles.scale.x = 0.01;
    // particles.scale.y = 0.01;
    // particles.scale.z = 0.01;

    // if (position.length) particles.position.set(...position)
    // if (rotation.length) particles.rotation.set(...rotation)
    // particles.name = name
    group.add(particles);
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



  // var ndata2
  //  更新座椅数据
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

        if (sitIndexArr && !sitIndexArr.every((a) => a == 0)) {
          if (ix >= sitIndexArr[0] && ix < sitIndexArr[1] && iy >= sitIndexArr[2] && iy < sitIndexArr[3]) {
            rgb = jetWhite3(0, valuej1, smoothBig[l]);
            dataArr.push(bigArrg[l])
          } else {
            rgb = jetgGrey(0, valuej1, smoothBig[l]);
          }
        } else {
          rgb = jetWhite3(0, valuej1, smoothBig[l]);
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

  function render() {

    bthClickHandle()
    const handLeft = ndata1.slice(0, 12)
    const handRight = ndata1.slice(12, 24)
    const neck = ndata1.slice(24, 24 + 26 * 2)
    const back = ndata1.slice(24 + 26 * 2, 24 + 26 * 18)
    const sit = ndata1.slice(24 + 26 * 18, 24 + 26 * 24)

    // initBodyPoint(bodydata)
    // initBodyPoint(handL)
    // initBodyPoint(handR)

    const data = {
      neck, back, sit, handLeft, handRight
    }
    const smoothBig = {
      neck: new Array(neckConfig.total).fill(1),
      back: new Array(backConfig.total).fill(1),
      sit: new Array(sitConfig.total).fill(1),
      // handLeft: new Array(handLeftConfig.total).fill(1),
      // handRight: new Array(handRightConfig.total).fill(1)
    }
    Object.keys(allConfig).forEach((key) => {
      const obj = allConfig[key]
      sitRenew(obj.dataConfig, obj.name, data[obj.name], smoothBig[obj.name]);
    })

    let dataArr = ndata1
    //  if (!sitIndexArr.length || sitIndexArr.every((a) => a == 0)) {
    //   dataArr = ndata1
    // }


    var T = clock.getDelta();
    timeS = timeS + T;
    if (timeS > renderT) {

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


  function changaCamera(obj) {
    bodyValue = obj.y
  }

  useImperativeHandle(refs, () => ({
    sitData,
    changeDataFlag: changeDataFlag,
    changePointRotation,
    changeBox,
    cancelSelect,
    changaCamera
  }));



  var options = {
    min: 0,
    max: 4000,
    size: 4
  }

  function addSide(arr, width, height, wnum, hnum, sideNum) {
    let narr = new Array(height);
    let res = [];
    for (let i = 0; i < height; i++) {
      narr[i] = [];

      for (let j = 0; j < width; j++) {
        if (j == 0) {
          narr[i].push(
            ...new Array(wnum).fill(sideNum >= 0 ? sideNum : 1),
            arr[i * width + j]
          );
        } else if (j == width - 1) {
          narr[i].push(
            arr[i * width + j],
            ...new Array(wnum).fill(sideNum >= 0 ? sideNum : 1)
          );
        } else {
          narr[i].push(arr[i * width + j]);
        }
      }
    }
    for (let i = 0; i < height; i++) {
      res.push(...narr[i]);
    }

    return [
      ...new Array(hnum * (width + 2 * wnum)).fill(sideNum >= 0 ? sideNum : 1),
      ...res,
      ...new Array(hnum * (width + 2 * wnum)).fill(sideNum >= 0 ? sideNum : 1),
    ];
  }


  function interpSmall(smallMat, width, height, interp1, interp2) {

    const bigMat = new Array((width * interp1) * (height * interp2)).fill(0)
    for (let i = 0; i < height; i++) {
      for (let j = 0; j < width; j++) {
        bigMat[(width * interp1) * i * interp2 + (j * interp1)] = smallMat[i * width + j] * 10
        bigMat[(width * interp1) * (i * interp2 + 1) + (j * interp1)] = smallMat[i * width + j] * 10
      }
    }

    // console.log(bigMat.length)
    return bigMat
  }
  var isShadow = true

  useEffect(() => {
    canvas = document.getElementById('heatmapcanvas')

    canvas.width = width * 40
    canvas.height = height * 40
  }, [])

  function jet(min, max, x) {
    let red, g, blue;
    let dv;
    red = 1.0;
    g = 1.0;
    blue = 1.0;
    if (x < min) {
      x = min;
    }
    if (x > max) {
      x = max;
    }
    dv = max - min;
    if (x < min + 0.25 * dv) {
      // red = 0;
      // g = 0;
      // blue = 0;

      red = 0;
      g = (4 * (x - min)) / dv;
    } else if (x < min + 0.5 * dv) {
      red = 0;
      blue = 1 + (4 * (min + 0.25 * dv - x)) / dv;
    } else if (x < min + 0.75 * dv) {
      red = (4 * (x - min - 0.5 * dv)) / dv;
      blue = 0;
    } else {
      g = 1 + (4 * (min + 0.75 * dv - x)) / dv;
      blue = 0;
    }
    var rgba = new Array();
    rgba[0] = 255 * red;
    rgba[1] = 255 * g;
    rgba[2] = 255 * blue;
    rgba[3] = 1;
    return rgba;
  }

  // min <= x <= max
  function getRandomIntInclusive(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // 生成随机数据
  function generateData() {
    // const resData = [0, 0, 1, 21, 9, 1, 0, 0, 0, 0, 0, 0, 0, 6, 5, 0, 0, 0, 0, 0, 0, 3, 28, 27, 37, 50, 56, 43, 34, 11, 1, 21, 45, 39, 37, 37, 9, 1, 0, 0, 3, 37, 6, 40, 48, 33, 3, 0, 0, 0, 2, 1, 1, 21, 33, 24, 2, 0, 0, 0, 0, 0, 1, 13, 26, 18, 4, 0, 0, 0, 0, 2, 16, 37, 34, 69, 51, 4, 1, 0, 1, 2, 15, 35, 52, 56, 39, 5, 0, 0, 0, 1, 14, 23, 4, 6, 30, 31, 1, 0, 0, 1, 1, 14, 1, 0, 5, 20, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 4, 0, 0, 0, 1, 34, 4, 0, 0, 2, 30, 3, 1, 0, 1, 19, 29, 0, 0, 1, 14, 0, 0, 0, 0, 3, 32, 1, 2, 3, 5, 1, 1, 1, 1, 2, 6]
    let resData
    let resArr = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 1, 2, 7, 5, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 4, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 0, 2, 9, 6, 26, 4, 13, 12, 7, 4, 1, 1, 0, 2, 1, 1, 1, 0, 0, 0, 0, 2, 0, 0, 0, 0, 10, 9, 6, 12, 25, 36, 13, 16, 38, 32, 37, 14, 20, 29, 26, 17, 14, 23, 36, 27, 5, 3, 0, 0, 0, 0, 0, 0, 0, 0, 3, 3, 32, 43, 21, 47, 37, 46, 74, 32, 38, 38, 44, 20, 33, 39, 63, 37, 30, 57, 36, 63, 35, 24, 18, 1, 0, 0, 0, 0, 0, 2, 1, 12, 21, 56, 10, 36, 34, 36, 69, 34, 48, 47, 71, 40, 56, 55, 56, 88, 93, 101, 86, 66, 11, 62, 37, 13, 3, 0, 0, 0, 0, 0, 1, 11, 22, 11, 6, 18, 25, 46, 56, 24, 72, 59, 34, 45, 78, 60, 38, 68, 92, 52, 81, 14, 2, 29, 59, 89, 54, 0, 0, 0, 0, 1, 9, 62, 28, 8, 2, 4, 41, 45, 27, 29, 77, 56, 61, 47, 55, 64, 50, 50, 59, 50, 7, 2, 0, 4, 35, 50, 47, 0, 0, 0, 0, 2, 51, 68, 44, 3, 1, 2, 7, 32, 40, 27, 54, 57, 38, 49, 59, 58, 50, 38, 36, 7, 1, 1, 0, 1, 6, 43, 58, 0, 0, 1, 1, 20, 84, 115, 10, 1, 1, 1, 3, 19, 55, 44, 44, 39, 45, 48, 31, 47, 61, 30, 15, 3, 1, 0, 0, 1, 1, 4, 32, 0, 0, 0, 4, 147, 71, 32, 3, 0, 1, 1, 3, 52, 38, 31, 38, 26, 27, 34, 45, 44, 58, 17, 3, 1, 0, 0, 0, 0, 0, 1, 18, 0, 1, 2, 48, 29, 2, 0, 0, 0, 1, 3, 1, 9, 22, 41, 39, 15, 27, 59, 34, 24, 25, 10, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 3, 22, 21, 4, 2, 1, 1, 0, 1, 0, 2, 9, 4, 15, 10, 13, 19, 28, 19, 17, 21, 5, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 26, 13, 2, 0, 0, 1, 1, 0, 2, 1, 0, 6, 3, 20, 10, 9, 24, 32, 20, 9, 10, 8, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 1, 5, 3, 31, 19, 116, 33, 44, 48, 63, 62, 45, 38, 15, 3, 3, 1, 0, 0, 0, 0, 0, 0, 0, 4, 0, 0, 0, 3, 1, 2, 1, 7, 23, 17, 12, 19, 33, 55, 97, 98, 60, 54, 60, 53, 39, 17, 7, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 52, 64, 95, 94, 72, 48, 39, 52, 67, 47, 36, 48, 86, 54, 37, 41, 4, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 13, 74, 80, 65, 85, 66, 75, 41, 14, 19, 26, 36, 36, 37, 57, 64, 75, 24, 3, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 24, 43, 40, 23, 32, 13, 2, 5, 5, 4, 5, 4, 3, 15, 26, 31, 20, 49, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 18, 61, 7, 3, 3, 1, 0, 1, 2, 2, 0, 5, 15, 32, 56, 13, 35, 1, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 6, 20, 57, 14, 2, 1, 1, 0, 0, 2, 0, 1, 4, 17, 48, 21, 6, 5, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 16, 13, 11, 1, 0, 0, 0, 0, 0, 0, 2, 0, 0, 2, 12, 14, 16, 8, 4, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6, 2, 5, 13, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 3, 5, 19, 6, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 2, 9, 8, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 38, 2, 1, 0, 1, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 2, 30, 19, 21, 6, 0, 0, 0, 0, 1, 0, 0, 0, 0, 3, 38, 16, 8, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 6, 18, 31, 26, 10, 3, 0, 0, 1, 0, 0, 0, 0, 14, 54, 43, 14, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 17, 69, 33, 59, 17, 0, 0, 1, 0, 0, 0, 0, 18, 34, 18, 16, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 8, 7, 69, 37, 96, 48, 25, 0, 0, 0, 0, 0, 0, 1, 51, 39, 58, 17, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 2, 1, 3, 15, 25, 69, 63, 0, 1, 0, 0, 0, 2, 2, 49, 23, 28, 3, 0, 0, 0, 0, 0, 0, 0, 2, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 6, 12, 46, 0, 0, 1, 0, 0, 2, 15, 30, 26, 9, 3, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 4, 36, 0]
    resArr = addSide(
      resArr,
      32,
      32,
      2,
      2,
      1
    );
    const interpArr = interpSmall(resArr, 32 + 4, 32 + 4, 1, 2)
    const data = []
    resData = interpArr
    const count = 32
    for (let i = 0; i < height; i++) {
      for (let j = 0; j < width; j++) {
        let obj = {}
        obj.y = i * canvas.width / width
        obj.x = j * canvas.height / height
        obj.value = resData[i * width + j]
        data.push(obj)
      }

    }
    return data
  }

  // 构造一个离屏canvas
  function Canvas(width, height) {
    let canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    return canvas
  }

  // 画圆
  function createCircle(size, value) {
    let shadowBlur = size / 2
    let r2 = size + shadowBlur
    let offsetDistance = 10000

    let circle = new Canvas(r2 * 2, r2 * 2)
    let context = circle.getContext('2d')

    if (isShadow) context.shadowBlur = shadowBlur;
    context.shadowColor = 'black'
    context.shadowOffsetX = context.shadowOffsetY = offsetDistance

    context.beginPath()
    context.arc(r2 - offsetDistance, r2 - offsetDistance, size, 0, Math.PI * 2, true)
    context.closePath()
    context.fillStyle = `rgb(${jet(value)})`
    context.fill()
    return circle
  }

  function draw(context, data) {
    let circle = createCircle(options.size, data.value)
    let circleHalfWidth = circle.width / 2
    let circleHalfHeight = circle.height / 2

    // 按透明度分类
    let dataOrderByAlpha = {}
    data.forEach((item, index) => {
      let alpha = Math.min(1, item.value / options.max).toFixed(2)
      dataOrderByAlpha[alpha] = dataOrderByAlpha[alpha] || []
      dataOrderByAlpha[alpha].push(item)
    })



    // 绘制不同透明度的圆形
    for (let i in dataOrderByAlpha) {
      if (isNaN(i)) continue;
      let _data = dataOrderByAlpha[i]
      context.beginPath()
      context.globalAlpha = i
      _data.forEach(item => {
        context.drawImage(circle, item.x - circleHalfWidth, item.y - circleHalfHeight)
      })
    }
    // 圆形着色
    let intensity = new Intensity()
    let colored = context.getImageData(0, 0, context.canvas.width, context.canvas.height)
    colorize(colored.data, intensity.getImageData())


    context.clearRect(0, 0, context.canvas.width, context.canvas.height)
    context.fillStyle = '#666'
    context.fillRect(0, 0, context.canvas.width, context.canvas.height)


    context.clearRect(0, 0, context.canvas.width, context.canvas.height)
    context.putImageData(colored, 0, 0)

    applySharpen(context, canvas.width, canvas.height);
  }

  function applySharpen(context, width, height) {
    // 获取原始图像数据
    let originalImageData = context.getImageData(0, 0, width, height);
    let originalPixels = originalImageData.data;

    // 创建一个用于存放处理后的图像数据的 ImageData 对象
    let outputImageData = context.createImageData(width, height);
    let outputPixels = outputImageData.data;

    const kernel = [
      0, -1, 0,
      -1, 5, -1,
      0, -1, 0,
    ];

    const kernelSize = Math.sqrt(kernel.length);
    const halfKernelSize = Math.floor(kernelSize / 2);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let r = 0, g = 0, b = 0;

        for (let ky = 0; ky < kernelSize; ky++) {
          for (let kx = 0; kx < kernelSize; kx++) {
            // 考虑边缘像素
            let pixelY = y + ky - halfKernelSize;
            let pixelX = x + kx - halfKernelSize;

            if (pixelY < 0 || pixelY >= height || pixelX < 0 || pixelX >= width) continue;

            // 卷积计算
            let offset = (pixelY * width + pixelX) * 4;
            let weight = kernel[ky * kernelSize + kx];

            r += originalPixels[offset] * weight;
            g += originalPixels[offset + 1] * weight;
            b += originalPixels[offset + 2] * weight;
          }
        }

        let destOffset = (y * width + x) * 4;
        outputPixels[destOffset] = r;
        outputPixels[destOffset + 1] = g;
        outputPixels[destOffset + 2] = b;
        outputPixels[destOffset + 3] = originalPixels[destOffset + 3]; // 保持相同的 alpha 值
      }
    }

    // 将处理后的图像数据绘制回画布
    context.putImageData(outputImageData, 0, 0);
  }

  function colorize(pixels, gradient) {
    var max = options.max;
    var min = options.min;
    var diff = max - min;
    var range = options.range || null;

    var jMin = 0;
    var jMax = 1024;
    if (range && range.length === 2) {
      jMin = (range[0] - min) / diff * 1024;
    }

    if (range && range.length === 2) {
      jMax = (range[1] - min) / diff * 1024;
    }

    var maxOpacity = options.maxOpacity || 1;
    var range = options.range;

    for (var i = 3, len = pixels.length, j; i < len; i += 4) {
      j = pixels[i] * 4; // get gradient color from opacity value

      if (pixels[i] / 256 > maxOpacity) {
        pixels[i] = 256 * maxOpacity;
      }

      if (j && j >= jMin && j <= jMax) {
        pixels[i - 3] = gradient[j];
        pixels[i - 2] = gradient[j + 1];
        pixels[i - 1] = gradient[j + 2];
      } else {
        pixels[i] = 0;
      }
      pixels[i] = 256
      // console.log(pixels[i])
    }
  }

  function bthClickHandle() {
    // data = []
    const data = generateData()
    let context = canvas.getContext('2d')

    context.clearRect(0, 0, canvas.width, canvas.height)

    isShadow = true

    draw(context, data)

  }

  window.onload = function () {
    bthClickHandle()
  }

  function Intensity(options) {

    options = options || {};
    this.gradient = options.gradient || {
      0: "#000000",
      0.14: "#0000FF",
      0.28: " #0066FF",
      0.42: "#00FF00",
      0.56: "#FFFF00",
      0.70: "#FF6600",
      0.84: "#FF0000",
      1: "#FF1E42",
    };
    this.maxSize = options.maxSize || 35;
    this.minSize = options.minSize || 0;
    this.max = options.max || 100;
    this.min = options.min || 0;
    this.initPalette();
  }

  Intensity.prototype.setMax = function (value) {
    this.max = value || 100;
  }

  Intensity.prototype.setMin = function (value) {
    this.min = value || 0;
  }

  Intensity.prototype.setMaxSize = function (maxSize) {
    this.maxSize = maxSize || 35;
  }

  Intensity.prototype.setMinSize = function (minSize) {
    this.minSize = minSize || 0;
  }

  Intensity.prototype.initPalette = function () {

    var gradient = this.gradient;

    var canvas = new Canvas(256, 1);

    var paletteCtx = this.paletteCtx = canvas.getContext('2d');

    var lineGradient = paletteCtx.createLinearGradient(0, 0, 256, 1);

    for (var key in gradient) {
      lineGradient.addColorStop(parseFloat(key), gradient[key]);
    }

    paletteCtx.fillStyle = lineGradient;
    paletteCtx.fillRect(0, 0, 256, 1);

  }

  Intensity.prototype.getColor = function (value) {

    var imageData = this.getImageData(value);

    return "rgba(" + imageData[0] + ", " + imageData[1] + ", " + imageData[2] + ", " + imageData[3] / 256 + ")";

  }

  Intensity.prototype.getImageData = function (value) {

    var imageData = this.paletteCtx.getImageData(0, 0, 256, 1).data;

    if (value === undefined) {
      return imageData;
    }

    var max = this.max;
    var min = this.min;

    if (value > max) {
      value = max;
    }

    if (value < min) {
      value = min;
    }

    var index = Math.floor((value - min) / (max - min) * (256 - 1));

    return [imageData[index], imageData[index + 1], imageData[index + 2], imageData[index + 3]];
  }

  /**
   * @param Number value 
   * @param Number max of value
   * @param Number max of size
   * @param Object other options
   */
  Intensity.prototype.getSize = function (value) {

    var size = 0;
    var max = this.max;
    var min = this.min;
    var maxSize = this.maxSize;
    var minSize = this.minSize;

    if (value > max) {
      value = max;
    }

    if (value < min) {
      value = min;
    }

    size = minSize + (value - min) / (max - min) * (maxSize - minSize);

    return size;

  }

  Intensity.prototype.getLegend = function (options) {
    var gradient = this.gradient;


    var width = options.width || 20;
    var height = options.height || 180;

    var canvas = new Canvas(width, height);

    var paletteCtx = canvas.getContext('2d');

    var lineGradient = paletteCtx.createLinearGradient(0, height, 0, 0);

    for (var key in gradient) {
      lineGradient.addColorStop(parseFloat(key), gradient[key]);
    }

    paletteCtx.fillStyle = lineGradient;
    paletteCtx.fillRect(0, 0, width, height);

    return canvas;
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
      selectHelper?.dispose()
    };
  }, []);
  return (
    <div>
      <div
        style={{ width: "100%", height: "100%" }}
        id={`canvas${props.index}`}
      ></div>
      <canvas id="heatmapcanvas"></canvas>
    </div>
  );
});
export default Canvas;
