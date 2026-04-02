import React, { useEffect, useImperativeHandle, useRef } from 'react'
import { genWebglHeatmap } from './WebGL.HeatMap copy 2'

/**
 * Canvas4096WebGL
 * 64×64 高速 WebGL 热力图组件，替换 bed4096 的 normal 渲染。
 * 对外暴露与 Bed4096 相同的 sitData / sitValue / changeColor 接口。
 */
const Canvas4096WebGL = React.forwardRef((props, refs) => {
  const canvasRef = useRef(null)

  // 运行时参数（通过 sitValue / changeColor 更新）
  const cfgRef = useRef({
    max: 200,    // 对应 valuej1（color 调参）
    filter: 0,   // 对应 valuef1（filter 调参）
    size: 24,    // 热力点半径
  })

  // 当前帧数据
  const dataRef = useRef(new Array(4096).fill(0))

  // requestAnimationFrame id
  const rafRef = useRef(null)

  // 渲染一帧
  function renderFrame() {
    const canvas = canvasRef.current
    if (!canvas) return

    const { max, filter, size } = cfgRef.current
    const rawData = dataRef.current

    // 边缘清零（与原 canvas4096webgl.js 保持一致）
    let resArr = [...rawData]
    for (let i = 0; i < 64; i++) {
      for (let j = 0; j < 64; j++) {
        if ((i < 6 || i > 58) || (j < 6 || j > 58)) {
          resArr[i * 64 + j] = 0
        }
      }
    }

    // 左右镜像翻转
    for (let i = 0; i < 64; i++) {
      for (let j = 0; j < 32; j++) {
        ;[resArr[i * 64 + j], resArr[i * 64 + 63 - j]] = [
          resArr[i * 64 + 63 - j],
          resArr[i * 64 + j],
        ]
      }
    }

    // filter 过滤
    resArr = resArr.map((a) => (a < filter ? 0 : a))

    const canvasWidth = 1024
    const canvasHeight = 1024

    const webglCanvas = genWebglHeatmap(resArr, max, size, canvasWidth, canvasHeight)
    const ctx = canvas.getContext('2d')
    if (ctx && webglCanvas) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(webglCanvas, 0, 0, canvas.width, canvas.height)
    }
  }

  // 循环渲染
  function loop() {
    renderFrame()
    rafRef.current = requestAnimationFrame(loop)
  }

  useEffect(() => {
    rafRef.current = requestAnimationFrame(loop)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  // ---- 对外接口 ----

  /** 接收新帧数据（与 Bed4096 sitData 接口兼容） */
  function sitData(prop) {
    const { wsPointData } = prop || {}
    if (wsPointData && wsPointData.length >= 4096) {
      dataRef.current = wsPointData
    }
  }

  /** 接收调参更新（valuej → max，valuef → filter） */
  function sitValue(obj) {
    if (obj.valuej !== undefined) cfgRef.current.max = obj.valuej
    if (obj.valuef !== undefined) cfgRef.current.filter = obj.valuef
  }

  /** 接收 changeColor 调参（max / filter / size） */
  function changeColor(obj) {
    if (obj.max !== undefined) cfgRef.current.max = obj.max
    if (obj.filter !== undefined) cfgRef.current.filter = obj.filter
    if (obj.size !== undefined) cfgRef.current.size = obj.size
  }

  useImperativeHandle(refs, () => ({
    sitData,
    sitValue,
    changeColor,
  }))

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#000',
      }}
    >
      <canvas
        ref={canvasRef}
        width={1024}
        height={1024}
        style={{ width: '80vh', height: '80vh' }}
      />
    </div>
  )
})

export default Canvas4096WebGL
