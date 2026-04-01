import React, { useContext, useEffect, useImperativeHandle, useRef } from 'react'
import Stats from "three/examples/jsm/libs/stats.module.js";
import * as THREE from "three";
import './canvas.scss'
import { findMax } from '../../assets/util/util';
import { press, press256 } from '../../assets/util/line';

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
var valuep = 0, valueprop = 1
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
  var rgb = new Array();
  rgb[0] = parseInt(255 * red + '');
  rgb[1] = parseInt(255 * g + '');
  rgb[2] = parseInt(255 * blue + '');
  return rgb;
}

let ndata1 = new Array(1024).fill(0)
var animationRequestId
var materialRef = null // 用于 sitValue 更新纹理
export default React.forwardRef((props, refs) => {
  const { size = 2 } = props
  const stats = new Stats();
  stats.showPanel(0); // 0: FPS, 1: ms, 2: memory
  // document.body.appendChild(stats.dom);
  let totalArr = [],
    totalPointArr = [];
  // const pageInfo = useContext(pageContext);

  // const pageRef = useRef(pageInfo)

  // useEffect(() => {0
  //   pageRef.current = pageInfo
  // }, [pageInfo])

  // function generateDigitSpriteSheetNew() {
  //     const canvas = document.createElement('canvas');
  //     // document.body.appendChild(canvas)
  //     canvas.width = canvas.height = 512;
  //     const ctx = canvas.getContext('2d');
  //     ctx.fillStyle = 'black';
  //     ctx.fillRect(0, 0, 512, 512);
  //     ctx.fillStyle = 'white';
  //     ctx.font = 'bold 20px monospace';
  //     ctx.textAlign = 'center';
  //     ctx.textBaseline = 'middle';
  //     for (let i = 0; i < 256; i++) {
  //         const x = i % 16;
  //         const y = Math.floor(i / 16);
  //         ctx.fillText(i.toString(), x * 32 + 16, y * 32 + 16);
  //     }

  //     return new THREE.CanvasTexture(canvas);
  // }

  function sitData(prop, local) {

    // if (i < 50) {
    //   i++;
    // } else {
    //   i = 0;
    // }
    // local = local
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

    // console.log(ndata1)
    // ndata1Num = ndata1.reduce((a, b) => a + b, 0);

    // if (ndata1Num < valuelInit) {
    //   ndata1 = new Array(sitnum1 * sitnum2).fill(0);
    // }
    // console.log(ndata1)

    let dataArr = ndata1
    //  if (!sitIndexArr.length || sitIndexArr.every((a) => a == 0)) {
    //   dataArr = ndata1
    // }




    // dataArr = dataArr.filter((a) => a > valuej1 * 0.025)
    const max = findMax(dataArr)
    const point = dataArr.filter((a) => a > 0).length

    // function pressTommhg(press, area) {
    //   let res
    //   if (press <= 1712) {
    //     res = 0.027 * press
    //   } else {
    //     res = 0.45 * press - 761.70
    //   }
    //   return (res / (area * (0.2 / 5) * (0.516 / 9)) / 133).toFixed(3)
    // }
    let press = dataArr.reduce((a, b) => a + b, 0)
    // press = pressTommhg(press, point)
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


  }

  function sitValue(props) {
    const { valuej, valueg, value, valuel, valuef, valuelInit, press, prop } = props;
    if (valuej) {
      valuej1 = valuej;
      // 颜色变化时重新生成精灵图纹理并更新材质
      if (materialRef) {
        const newTex = createDigitSpriteSheetWithJet(valuej1);
        materialRef.uniforms.map.value = newTex;
        materialRef.uniforms.map.value.needsUpdate = true;
      }
    }
    if (valueg) valueg1 = valueg;
    if (value) value1 = value;
    if (valuel) valuel1 = valuel;
    if (valuef) valuef1 = valuef;
    if (typeof press == 'number') valuep = press
    if (typeof prop == 'number') valueprop = prop
    if (valuelInit) valuelInit1 = valuelInit;
  }

  useImperativeHandle(refs, () => ({

    sitData: sitData,
    sitValue
    // actionAll: actionAll,
    // actionSit: actionSit,
    // actionBack: actionBack,
  }));


  function createDigitSpriteSheetWithJet(maxVal) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 512;
    const ctx = canvas.getContext("2d");

    const gridSize = 16;
    const cellSize = 32;
    const colorMax = (maxVal && maxVal > 0) ? maxVal : 30;

    ctx.font = "bold 18px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (let i = 0; i < 256; i++) {
      const x = i % gridSize;
      const y = Math.floor(i / gridSize);
      const cx = x * cellSize;
      const cy = y * cellSize;

      // 计算背景颜色（使用 colorMax 作为映射最大值）
      const [r, g, b] = jet(0, colorMax, i);
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.fillRect(cx, cy, cellSize, cellSize);

      // 黑色边框
      ctx.strokeStyle = "black";
      ctx.lineWidth = 1;
      ctx.strokeRect(cx, cy, cellSize, cellSize);

      // 白色数字
      ctx.fillStyle = "white";
      ctx.fillText(i.toString(), cx + cellSize / 2, cy + cellSize / 2);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.flipY = false;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.NearestFilter;
    return tex;
  }



  useEffect(() => {
    // 初始化 Three.js
    const renderer = new THREE.WebGLRenderer({ antialias: true });

    let height
    if (window.innerHeight < 750) {
      height = window.innerHeight * 0.6
    } else {
      height = window.innerHeight * 0.8
    }

    renderer.setSize(height, height);

    const canvasNum = document.querySelector('.canvasNum')
    canvasNum.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10000);
    camera.position.z = 1000;

    const canvas = renderer.domElement;
    canvas.style.touchAction = 'none';
    const minZoom = 0.5;
    const maxZoom = 8;
    const zoomStep = 1.1;
    const raycaster = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const mouse = new THREE.Vector2();
    const beforeZoom = new THREE.Vector3();
    const afterZoom = new THREE.Vector3();
    const lastDrag = new THREE.Vector2();
    let isDragging = false;

    const getWorldPoint = (event, target) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      return raycaster.ray.intersectPlane(plane, target);
    };

    const onWheel = (event) => {
      event.preventDefault();
      if (!getWorldPoint(event, beforeZoom)) return;
      const scale = event.deltaY < 0 ? zoomStep : 1 / zoomStep;
      const nextZoom = THREE.MathUtils.clamp(camera.zoom * scale, minZoom, maxZoom);
      if (nextZoom === camera.zoom) return;
      camera.zoom = nextZoom;
      camera.updateProjectionMatrix();
      if (!getWorldPoint(event, afterZoom)) return;
      camera.position.add(beforeZoom.sub(afterZoom));
    };

    const onPointerDown = (event) => {
      if (event.button !== 0) return;
      isDragging = true;
      lastDrag.set(event.clientX, event.clientY);
      canvas.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event) => {
      if (!isDragging) return;
      const dx = event.clientX - lastDrag.x;
      const dy = event.clientY - lastDrag.y;
      lastDrag.set(event.clientX, event.clientY);
      const rect = canvas.getBoundingClientRect();
      const worldPerPixelX = (camera.right - camera.left) / (rect.width * camera.zoom);
      const worldPerPixelY = (camera.top - camera.bottom) / (rect.height * camera.zoom);
      camera.position.x -= dx * worldPerPixelX;
      camera.position.y += dy * worldPerPixelY;
    };

    const onPointerUp = (event) => {
      if (!isDragging) return;
      isDragging = false;
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);

    const texture = createDigitSpriteSheetWithJet(valuej1);

    const material = new THREE.ShaderMaterial({

      uniforms: {
        map: { value: texture },
        tileSize: { value: 1.0 / 16.0 }
      },
      vertexShader: `
        attribute vec3 instanceColor;
        varying vec3 vColor;
        attribute vec2 uvOffset;
        uniform float tileSize;
        varying vec2 vUv;
        void main() {
          vUv = uv * tileSize + uvOffset;
          vColor = instanceColor;
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D map;
        varying vec2 vUv;
        varying vec3 vColor;

        vec3 linearToSRGB(vec3 color) {
  return pow(color*1.5, vec3(1.0 / 2.2));  // Gamma 矫正
}

        void main() {
          vec4 texColor = texture2D(map, vUv);
          if (texColor.a < 0.1) discard;

           vec3 rgb = texColor.rgb * vColor; // 染色
            rgb = linearToSRGB(rgb);   

            // 乘以格子颜色
          gl_FragColor = vec4(rgb, texColor.a);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: true,
      depthTest: true,

    });

    material.toneMapped = false;
    materialRef = material; // 暴露给 sitValue 使用
    // const size = 4
    const gridSize = 64 / size;
    const count = gridSize * gridSize;
    const geometry = new THREE.PlaneGeometry(0.032 * size, 0.032 * size);

    // const geometry = new THREE.PlaneGeometry(0.1, 0.1);
    const uvOffsets = new Float32Array(count * 2);
    const colorArray = new Float32Array(count * 3);
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    const dummy = new THREE.Object3D();
    // mesh.rotation.x = Math.PI
    for (let i = 0; i < count; i++) {
      const x = i % gridSize;
      const y = Math.floor(i / gridSize);
      // dummy.position.set((x - 31.5) / 32, (y - 31.5) / 32, 0); // 居中

      dummy.position.set((x) / 32 * size, (y) / 32 * size, 0); // 居中
      // dummy.rotation.set(0, Math.PI, 0,)
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      const d = 20//Math.floor(Math.random() * 256);
      uvOffsets[i * 2] = (d % 16) / 16;
      uvOffsets[i * 2 + 1] = Math.floor(d / 16) / 16;
    }
    let oldTime = new Date().getTime()


    mesh.rotation.x = Math.PI

    const maxnum = document.querySelector('.maxNum')
    function animate() {

      // let data = pageRef.current.equipStatus.data

      // const {
      //   gauss, color, filter, height, coherent,
      // } = pageRef.current.settingValue
      // const { wsLocalData } = pageRef.current
      // if (wsLocalData) {
      //   data = data.map((a, index) => {
      //     if (a - wsLocalData[index] < 0) {
      //       return 0
      //     } else {
      //       return a - wsLocalData[index]
      //     }
      //   })
      // }

      // if (filter) {
      //   data = data.map((a) => {
      //     if (a < filter) {
      //       return 0
      //     } else {
      //       return a
      //     }
      //   })
      // }
    let res = [...ndata1]
      // if (valuep != 0) {
      //   if (valueprop != 0) {
    
      //     res = press(ndata1, 32, 32, valuep, valueprop, 'col')
      //   }
      //   console.log('分压')
      // }


      //   ndata1 = press(ndata1, 16, 16, valuep,valueprop, 'col')
      //   console.log('分压')
      // }


      res = res.map((a, index) => (a - valuef1 < 0 ? 0 : parseInt(a)));
      let data = res

      const max = Math.max(...res)
      const index = res.indexOf(max)
      maxnum.innerHTML = index + 1

      // console.log(new Date().getTime() - oldTime,)
      // controls.update();
      animationRequestId = requestAnimationFrame(animate);
      //  = rangeValue/Math.PI/2
      for (let i = 0; i < count; i++) {
        const x = i % gridSize;
        const y = Math.floor(i / gridSize);
        dummy.position.set((x - (32 / size - 0.5)) / 32 * size, (y - (32 / size - 0.5)) / 32 * size, 0); // 居中

        // dummy.position.set((x ) / 32, (y ) / 32, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);

        const d = data[i]//Math.floor(Math.random() * 256);
        uvOffsets[i * 2] = (d % 16) / 16;
        uvOffsets[i * 2 + 1] = Math.floor(d / 16) / 16;

        // const d = Math.floor(Math.random() * 256);
        const r = d / 255;
        const g = 0.2;
        const b = 1.0 - r;

        colorArray[i * 3 + 0] = r;
        colorArray[i * 3 + 1] = g;
        colorArray[i * 3 + 2] = b;

        // const rgb = jet(0 , 30 , d)

        // colorArray[i * 3 + 0] = rgb[0];
        // colorArray[i * 3 + 1] = rgb[1];
        // colorArray[i * 3 + 2] = rgb[2];

        geometry.setAttribute("instanceColor", new THREE.InstancedBufferAttribute(colorArray, 3));
        geometry.attributes.instanceColor.needsUpdate = true;
        geometry.setAttribute('uvOffset', new THREE.InstancedBufferAttribute(uvOffsets, 2));
        geometry.attributes.uvOffset.needsUpdate = true;

      }
      stats.begin();
      renderer.render(scene, camera);
      stats.end();
      oldTime = new Date().getTime()

    }

    geometry.setAttribute('uvOffset', new THREE.InstancedBufferAttribute(uvOffsets, 2));
    animate()
    scene.add(mesh);
    renderer.toneMapping = THREE.NoToneMapping;
    // renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.render(scene, camera);

     return () => {
      if (animationRequestId) cancelAnimationFrame(animationRequestId);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
    }

  }, [])




  return (
    <>
      <div className='canvasNum'>

      </div>
      <div className='maxNum' style={{ position: 'fixed', left: '5%', bottom: '5%', color: '#fff' }}>

      </div>
    </>
  )
})
