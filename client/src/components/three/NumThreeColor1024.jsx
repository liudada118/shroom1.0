import React, { useContext, useEffect, useImperativeHandle, useRef } from 'react'
import Stats from "three/examples/jsm/libs/stats.module.js";
import * as THREE from "three";
import './canvas.scss'
import { findMax, jet } from '../../assets/util/util';
import { press, press256 } from '../../assets/util/line';
import { buildCoordinateWorldLayout } from '../displaySystem/coordinatePointLayout';
import { isClassicColormap, sampleColormapRgb } from '../displaySystem/colormaps';
import { DUAL_CHANNEL_DEFAULTS, createThresholdState } from '../../runtime/displayThresholds';

var { valuej1, valueg1, value1, valuel1, valuef1, valuej2, valueg2, value2, valuel2, valuef2,
  valuelInit1, valuelInit2 } = createThresholdState(DUAL_CHANNEL_DEFAULTS);
var valuep = 0, valueprop = 1
const getTextureRange = (textureValueMax) => {
  const max = textureValueMax && textureValueMax > 255 ? Math.round(textureValueMax) : 255;
  return max > 255
    ? { max, cols: 32, rows: Math.ceil((max + 1) / 32) }
    : { max: 255, cols: 16, rows: 16 };
}
const clampTextureValue = (value, textureValueMax) => {
  const { max } = getTextureRange(textureValueMax);
  return Math.max(0, Math.min(max, Math.round(Number(value) || 0)));
}
const getDecimalScale = (matrixName) => (matrixName === 'smallBed12B' ? 10 : 1);
const formatDisplayValue = (value, decimalScale) => (
  decimalScale > 1 ? (Number(value) / decimalScale).toFixed(1) : String(value)
);
const getPressureChartPadding = (matrixName) => (matrixName === 'smallBed12B' ? 5 : 1000);
// 主界面的画布配置器可以换配色。`classic` 和不传 colormap 都必须走
// 原来的 jet + 逐实例 (r, 0.2, 1-r) 染色，让 smallBed / hand / MINZHEN 这些
// 老展示系统的观感一个像素都不变；只有显式选了别的配色才换成色标采样。
// 判定规则从 colormaps.js 取，和 hand.jsx 那条链共用一份。

/**
 * 算一格精灵图的背景色。
 *
 * @param {{id: string, reverse: boolean}} colormap 当前配色，缺省即 classic。
 * @param {number} displayValue 这一格代表的实际数值。
 * @param {number} colorMax 映射到色标顶端的数值。
 * @returns {number[]} 0-255 的 rgb 三元组。
 */
function sampleCellRgb(colormap, displayValue, colorMax) {
  if (isClassicColormap(colormap)) return jet(0, colorMax, displayValue);
  return sampleColormapRgb(colormap.id, colorMax > 0 ? displayValue / colorMax : 0, colormap);
}

let ndata1 = new Array(1024).fill(0)
var animationRequestId
var materialRef = null // 用于 sitValue 更新纹理
export default React.forwardRef((props, refs) => {
  const { size = 2 } = props
  const matrixWidth = Number(props.matrixWidth) || 0;
  const matrixHeight = Number(props.matrixHeight) || 0;
  const gridWidth = matrixWidth > 0 ? matrixWidth : 64 / size;
  const gridHeight = matrixHeight > 0 ? matrixHeight : 64 / size;
  // 场景构建的 useEffect 依赖是 []，闭包里拿到的是挂载时的 props。配色换了会由
  // CanvasCom 的 variantKey 整场重建，所以挂载时的值就是对的；用 ref 兜一层，
  // 让 sitValue 之类的命令式入口也不会读到旧配色。
  const colormapRef = useRef(props.colormap);
  colormapRef.current = props.colormap;
  const coordinateWorldLayout = buildCoordinateWorldLayout(props.coordinateMap);
  const coordinatePoints = coordinateWorldLayout?.points || null;
  const worldCellSize = coordinateWorldLayout?.worldCellSize || 2 / Math.max(gridWidth, gridHeight);
  const instanceCount = coordinatePoints?.length || gridWidth * gridHeight;
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
    const displayPress = props.matrixName === 'smallBed12B' ? max : press
    if (props.manageSidebar !== false && props.matrixName !== 'minzhen') {
      props.data.current?.changeData({
        meanPres: mean.toFixed(2),
        maxPres: max,
        point: point,
        // area: areaSmooth.toFixed(0),
        totalPres: displayPress,
        // pressure: pressureSmooth.toFixed(2),
      });

      if (totalArr.length < 20) {
        totalArr.push(displayPress);
      } else {
        totalArr.shift();
        totalArr.push(displayPress);
      }

      const maxTotal = findMax(totalArr);

      if (!local)
        props.data.current?.handleCharts(totalArr, maxTotal + getPressureChartPadding(props.matrixName));

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


  }

  function sitValue(config) {
    const { valuej, valueg, value, valuel, valuef, valuelInit, press, prop } = config;
    if (valuej !== undefined) {
      valuej1 = valuej;
      // 颜色变化时重新生成精灵图纹理并更新材质
      if (materialRef) {
        const decimalScale = getDecimalScale(props.matrixName);
        const textureMax = props.textureValueMax || (decimalScale > 1 ? valuej1 * decimalScale : 255);
        const newTex = createDigitSpriteSheetWithJet(valuej1, textureMax, decimalScale);
        materialRef.uniforms.map.value = newTex;
        const { cols, rows } = getTextureRange(textureMax);
        materialRef.uniforms.tileSize.value.set(1.0 / cols, 1.0 / rows);
        materialRef.uniforms.map.value.needsUpdate = true;
      }
    }
    if (valueg !== undefined) valueg1 = valueg;
    if (value !== undefined) value1 = value;
    if (valuel !== undefined) valuel1 = valuel;
    if (valuef !== undefined) valuef1 = valuef;
    if (typeof press == 'number') valuep = press
    if (typeof prop == 'number') valueprop = prop
    if (valuelInit !== undefined) valuelInit1 = valuelInit;
  }

  useImperativeHandle(refs, () => ({

    sitData: sitData,
    changeWsDataRaw: (wsPointData) => sitData({ wsPointData }, props.local),
    changeWsData: (wsPointData) => sitData({ wsPointData }, props.local),
    sitValue
    // actionAll: actionAll,
    // actionSit: actionSit,
    // actionBack: actionBack,
  }));


  function createDigitSpriteSheetWithJet(maxVal, textureValueMax = 255, decimalScale = 1) {
    const { max: textureMax, cols, rows } = getTextureRange(textureValueMax);
    const canvas = document.createElement("canvas");
    const cellSize = 32;
    canvas.width = cols * cellSize;
    canvas.height = rows * cellSize;
    const ctx = canvas.getContext("2d");
    const colorMax = (maxVal && maxVal > 0) ? maxVal : 30;

    ctx.font = `bold ${decimalScale > 1 ? 11 : textureMax > 255 ? 16 : 18}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (let i = 0; i <= textureMax; i++) {
      const x = i % cols;
      const y = Math.floor(i / cols);
      const cx = x * cellSize;
      const cy = y * cellSize;

      // 计算背景颜色（使用 colorMax 作为映射最大值）
      const displayValue = i / decimalScale;
      const [r, g, b] = sampleCellRgb(colormapRef.current, displayValue, colorMax);
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.fillRect(cx, cy, cellSize, cellSize);

      // 黑色边框
      ctx.strokeStyle = "black";
      ctx.lineWidth = 1;
      ctx.strokeRect(cx, cy, cellSize, cellSize);

      // 白色数字
      ctx.fillStyle = "white";
      ctx.fillText(formatDisplayValue(i, decimalScale), cx + cellSize / 2, cy + cellSize / 2);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.flipY = false;
    tex.generateMipmaps = false;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
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

    const decimalScale = getDecimalScale(props.matrixName);
    const textureMax = props.textureValueMax || (decimalScale > 1 ? valuej1 * decimalScale : 255);
    const { max: textureValueMax, cols: textureCols, rows: textureRows } = getTextureRange(textureMax);
    const texture = createDigitSpriteSheetWithJet(valuej1, textureValueMax, decimalScale);

    const material = new THREE.ShaderMaterial({

      uniforms: {
        map: { value: texture },
        tileSize: { value: new THREE.Vector2(1.0 / textureCols, 1.0 / textureRows) }
      },
      vertexShader: `
        attribute vec3 instanceColor;
        varying vec3 vColor;
        attribute vec2 uvOffset;
        uniform vec2 tileSize;
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
    const count = instanceCount;
    const geometry = new THREE.PlaneGeometry(worldCellSize * 1.024, worldCellSize * 1.024);

    // const geometry = new THREE.PlaneGeometry(0.1, 0.1);
    const uvOffsets = new Float32Array(count * 2);
    const colorArray = new Float32Array(count * 3);
    // 非 classic 配色的 tint 恒为白色，填一次即可，animate 里不再逐帧重算。
    const useClassicTint = isClassicColormap(colormapRef.current);
    if (!useClassicTint) colorArray.fill(1);
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    const dummy = new THREE.Object3D();

    /**
     * 把实例放到物理坐标位置；没有坐标文件时保持原来的规则矩阵布局。
     */
    const setInstancePosition = (index) => {
      const coordinatePoint = coordinatePoints?.[index];
      if (coordinatePoint) {
        dummy.position.set(coordinatePoint.worldX, coordinatePoint.worldY, 0);
        return;
      }

      const x = index % gridWidth;
      const y = Math.floor(index / gridWidth);
      dummy.position.set(
        (x - (gridWidth - 1) / 2) * worldCellSize,
        (y - (gridHeight - 1) / 2) * worldCellSize,
        0
      );
    };

    // mesh.rotation.x = Math.PI
    for (let i = 0; i < count; i++) {
      // dummy.position.set((x - 31.5) / 32, (y - 31.5) / 32, 0); // 居中

      setInstancePosition(i);
      // dummy.rotation.set(0, Math.PI, 0,)
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      const d = 20//Math.floor(Math.random() * 256);
      uvOffsets[i * 2] = (d % textureCols) / textureCols;
      uvOffsets[i * 2 + 1] = Math.floor(d / textureCols) / textureRows;
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


      const decimalScale = getDecimalScale(props.matrixName);
      res = res.map((a) => {
        const numberValue = Number(a);
        if (!Number.isFinite(numberValue) || numberValue - valuef1 < 0) return 0;
        return decimalScale > 1 ? Number(numberValue.toFixed(1)) : parseInt(numberValue);
      });
      let data = res

      const max = Math.max(...res)
      const index = res.indexOf(max)
      maxnum.innerHTML = index + 1

      // console.log(new Date().getTime() - oldTime,)
      // controls.update();
      animationRequestId = requestAnimationFrame(animate);
      //  = rangeValue/Math.PI/2
      for (let i = 0; i < count; i++) {
        setInstancePosition(i);

        // dummy.position.set((x ) / 32, (y ) / 32, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);

        const dataIndex = coordinatePoints?.[i]?.index ?? i;
        const d = clampTextureValue(data[dataIndex] * decimalScale, textureValueMax)//Math.floor(Math.random() * 256);
        uvOffsets[i * 2] = (d % textureCols) / textureCols;
        uvOffsets[i * 2 + 1] = Math.floor(d / textureCols) / textureRows;

        // const d = Math.floor(Math.random() * 256);
        // instanceColor 在片元着色器里乘到精灵图上。classic 保留原来的
        // (r, 0.2, 1-r) 渐变叠加；选了别的配色时必须乘 1，否则会把色标压暗、
        // 用户看到的就不是他挑的那条色带了。
        if (useClassicTint) {
          const r = d / textureValueMax;
          colorArray[i * 3 + 0] = r;
          colorArray[i * 3 + 1] = 0.2;
          colorArray[i * 3 + 2] = 1.0 - r;
        }

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

    // CanvasCom 会在系统、模式或 manifest revision 变化时重建整个场景。
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
