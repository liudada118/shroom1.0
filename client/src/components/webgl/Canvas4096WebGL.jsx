import React from 'react'
import { Bed4096WebGLCanvas } from '@shroom/pressure-visualization'
import { genWebglHeatmap } from './WebGL.HeatMap copy 2'

/**
 * Canvas4096WebGL
 * 64×64 高速 WebGL 热力图组件，替换 bed4096 的 normal 渲染。
 * 对外暴露与 Bed4096 相同的 sitData / sitValue / changeColor 接口。
 */
const Canvas4096WebGL = React.forwardRef((props, refs) => {
  return (
    <Bed4096WebGLCanvas
      {...props}
      ref={refs}
      createHeatmapCanvas={genWebglHeatmap}
    />
  )
})

export default Canvas4096WebGL
