import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { findMax } from '../../assets/util/util'
import { buildGloveHandLayout, HAND_GAP, HAND_HEIGHT, HAND_WIDTH, jetColor } from './gloveHandLayout'

// 触觉手套 2D 数字：左右手按手指/手掌形状展示 256 点原始数据
const SIDE_PANEL_WIDTH = 360
// 右侧缩放/回正工具条占位
const RIGHT_TOOLBAR_WIDTH = 120
const VIEWPORT_WIDTH_RATIO = 0.75
const HORIZONTAL_PADDING = 48
const VERTICAL_PADDING = 160
const TOTAL_WIDTH = HAND_WIDTH * 2 + HAND_GAP
const CANVAS_PADDING = 10

const LAYOUTS = {
  left: buildGloveHandLayout('left'),
  right: buildGloveHandLayout('right'),
}

// defaultValue 兜底：翻译资源未加载到新键时也显示中文，而不是键名
const PART_LABELS = {
  littleFinger: ['bodyParts.littleFinger', '小拇指'],
  ringFinger: ['bodyParts.ringFinger', '无名指'],
  middleFinger: ['bodyParts.middleFinger', '中指'],
  indexFinger: ['bodyParts.indexFinger', '食指'],
  thumb: ['bodyParts.thumb', '大拇指'],
  palm: ['bodyParts.handPalm', '手掌'],
}

function computeCellSize() {
  const ww = typeof window !== 'undefined' ? window.innerWidth : 1920
  const wh = typeof window !== 'undefined' ? window.innerHeight : 1080
  const maxW = Math.min(ww * VIEWPORT_WIDTH_RATIO, ww - SIDE_PANEL_WIDTH - RIGHT_TOOLBAR_WIDTH - HORIZONTAL_PADDING)
  const maxH = wh - VERTICAL_PADDING
  return Math.max(12, Math.floor(Math.min(maxW / TOTAL_WIDTH, maxH / HAND_HEIGHT)))
}

function normalizeFrame(data) {
  const frame = new Array(256).fill(0)
  if (!Array.isArray(data)) return frame
  for (let i = 0; i < 256; i++) {
    const value = Number(data[i])
    frame[i] = Number.isFinite(value) ? value : 0
  }
  return frame
}

function drawHand(ctx, layout, frame, originX, cs, maxValue, labels) {
  const px = (x) => CANVAS_PADDING + originX + x * cs
  const py = (y) => CANVAS_PADDING + y * cs

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  layout.parts.forEach((part) => {
    ctx.fillStyle = '#1f2d4d'
    ctx.font = `bold ${Math.max(10, cs * 0.4)}px sans-serif`
    ctx.fillText(labels.parts[part.key], px(part.labelX), py(part.labelY + 0.4))

    const sum = part.indices.reduce((total, index) => total + frame[index], 0)
    const box = part.sumBox
    ctx.fillStyle = '#e8ecf5'
    ctx.fillRect(px(box.x), py(box.y), box.w * cs, box.h * cs)
    ctx.strokeStyle = '#9aa7c7'
    ctx.lineWidth = 1
    ctx.strokeRect(px(box.x) + 0.5, py(box.y) + 0.5, box.w * cs - 1, box.h * cs - 1)
    ctx.fillStyle = '#1f2d4d'
    ctx.font = `bold ${Math.max(9, cs * 0.36)}px monospace`
    ctx.fillText(`Σ${Math.round(sum)}`, px(box.x + box.w / 2), py(box.y + box.h / 2))

    if (part.pulpLabel) {
      ctx.fillStyle = '#7a86a8'
      ctx.font = `${Math.max(8, cs * 0.28)}px sans-serif`
      ctx.fillText(labels.pulp, px(part.pulpLabel.x), py(part.pulpLabel.y + 0.3))
    }
  })

  layout.cells.forEach((cell) => {
    const value = frame[cell.index]
    const x = px(cell.x)
    const y = py(cell.y)
    ctx.fillStyle = jetColor(value, maxValue)
    ctx.fillRect(x, y, cs, cs)

    if (cell.pulp) {
      ctx.save()
      ctx.setLineDash([3, 2])
      ctx.strokeStyle = '#1f2d4d'
      ctx.lineWidth = 1.5
      ctx.strokeRect(x + 0.75, y + 0.75, cs - 1.5, cs - 1.5)
      ctx.restore()
    } else {
      ctx.strokeStyle = 'rgba(0, 0, 40, 0.6)'
      ctx.lineWidth = 1
      ctx.strokeRect(x + 0.5, y + 0.5, cs - 1, cs - 1)
    }

    ctx.fillStyle = '#fff'
    ctx.font = `bold ${Math.max(9, cs * 0.4)}px monospace`
    ctx.fillText(String(Math.round(value)), x + cs / 2, y + cs / 2)
  })

  ctx.fillStyle = '#1f2d4d'
  ctx.font = `${Math.max(10, cs * 0.38)}px sans-serif`
  ctx.fillText(labels.title, px(layout.width / 2), py(layout.titleY + 0.4))
}

export const GloveHandNum2D = React.forwardRef((props, refs) => {
  const { t } = useTranslation()
  const canvasRef = useRef(null)
  const framesRef = useRef({ left: new Array(256).fill(0), right: new Array(256).fill(0) })
  const rafIdRef = useRef(null)
  const totalArrRef = useRef([])
  const totalPointArrRef = useRef([])
  const [cellSize, setCellSize] = useState(computeCellSize)
  const cellSizeRef = useRef(cellSize)
  cellSizeRef.current = cellSize

  const labelsRef = useRef(null)
  labelsRef.current = {
    parts: Object.fromEntries(Object.entries(PART_LABELS).map(([key, [i18nKey, zh]]) => [key, t(i18nKey, { defaultValue: zh })])),
    pulp: t('bodyParts.fingerPulp', { defaultValue: '指腹' }),
    left: t('leftHand', { defaultValue: '左手' }),
    right: t('rightHand', { defaultValue: '右手' }),
  }

  const render = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const cs = cellSizeRef.current
    const dpr = window.devicePixelRatio || 1
    const cssW = TOTAL_WIDTH * cs + CANVAS_PADDING * 2
    const cssH = HAND_HEIGHT * cs + CANVAS_PADDING * 2
    if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
      canvas.width = Math.round(cssW * dpr)
      canvas.height = Math.round(cssH * dpr)
      canvas.style.width = `${cssW}px`
      canvas.style.height = `${cssH}px`
    }
    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, cssW, cssH)

    const { left, right } = framesRef.current
    // 左右手共用一个色阶，便于比较两手压力
    let maxValue = 1
    for (const side of ['left', 'right']) {
      const frame = framesRef.current[side]
      LAYOUTS[side].cells.forEach((cell) => {
        if (frame[cell.index] > maxValue) maxValue = frame[cell.index]
      })
    }

    const labels = labelsRef.current
    drawHand(ctx, LAYOUTS.left, left, 0, cs, maxValue, { parts: labels.parts, pulp: labels.pulp, title: labels.left })
    drawHand(ctx, LAYOUTS.right, right, (HAND_WIDTH + HAND_GAP) * cs, cs, maxValue, { parts: labels.parts, pulp: labels.pulp, title: labels.right })
  }, [])

  const scheduleRender = useCallback(() => {
    if (rafIdRef.current) return
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null
      render()
    })
  }, [render])

  // 侧栏统计：左右手 256 点合并，口径与原 16x16 视图一致
  const layoutData = (dataArr) => {
    const max = findMax(dataArr)
    const point = dataArr.filter((a) => a > 0).length
    const press = dataArr.reduce((a, b) => a + b, 0)
    const mean = press / (point == 0 ? 1 : point)
    props.data.current?.changeData({
      meanPres: mean.toFixed(2),
      maxPres: max,
      point: point,
      totalPres: `${press}`,
    })

    const totalArr = totalArrRef.current
    const totalPointArr = totalPointArrRef.current
    if (totalArr.length >= 60) totalArr.shift()
    totalArr.push(press)
    if (totalPointArr.length >= 60) totalPointArr.shift()
    totalPointArr.push(point)

    if (!props.local) {
      props.data.current?.handleCharts(totalArr, findMax(totalArr) + 20)
      props.data.current?.handleChartsArea(totalPointArr, findMax(totalPointArr) + 20)
    }
  }

  const changeWsData256 = (wsPointData, side = 'left') => {
    const key = side === 'right' ? 'right' : 'left'
    framesRef.current[key] = normalizeFrame(wsPointData)
    layoutData([...framesRef.current.left, ...framesRef.current.right])
    scheduleRender()
  }

  // 手形布局只能基于原始 256 点；映射后的短数组无法还原点位，忽略
  const changeWsData147 = () => { }

  useImperativeHandle(refs, () => ({
    changeWsData256,
    changeWsData147,
    changeWsData147R: changeWsData147,
    changeWsData: () => { },
    drawContent: () => { },
    sitValue: () => { },
  }))

  useEffect(() => {
    render()
  }, [cellSize, t, render])

  useEffect(() => {
    let resizeTimer = null
    const handleResize = () => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => setCellSize(computeCellSize()), 200)
    }
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      clearTimeout(resizeTimer)
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current)
    }
  }, [])

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
        paddingLeft: SIDE_PANEL_WIDTH,
        paddingRight: RIGHT_TOOLBAR_WIDTH,
        boxSizing: 'border-box',
      }}
    >
      <canvas ref={canvasRef} style={{ display: 'block', marginTop: 40 }} />
    </div>
  )
})

export default GloveHandNum2D
