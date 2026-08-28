import React, { useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { findMax } from '../../assets/util/util'
import { HUMAN_BODY_RAW_SLOTS, HUMAN_BODY_RAW_VIEWS } from './humanBodyRawLayout'
import './HumanBodyRawData.css'

const normalizeSourceData = (value) => {
  const source = Array.isArray(value) ? value : []
  return new Array(1024).fill(0).map((_, index) => {
    const numberValue = Number(source[index])
    return Number.isFinite(numberValue) ? numberValue : 0
  })
}

const createDefaultSource = () => new Array(1024).fill(0)

export const getHumanBodyRawProjectedValues = (source = [], indexMatrix = []) => (
  indexMatrix.flatMap((row) => row.map((position) => {
    const value = Number(source[position - 1])
    return Number.isFinite(value) ? value : 0
  }))
)

export const getHumanBodyRawPartStats = (values = []) => ({
  total: values.length,
  active: values.filter((value) => value > 0).length,
  peak: findMax(values),
})

const getUniquePositionValues = (source, slots) => {
  const positions = new Set(
    slots.flatMap((slot) => slot.indexMatrix.flat()),
  )
  return [...positions].map((position) => source[position - 1] || 0)
}

const getViewStats = (view, source) => getHumanBodyRawPartStats(
  getUniquePositionValues(source, [...view.upperSlots, ...view.lowerSlots]),
)

export const getHumanBodyRawView = (viewKey) => (
  HUMAN_BODY_RAW_VIEWS.find((view) => view.key === viewKey)
  ?? HUMAN_BODY_RAW_VIEWS[0]
)

const getPartCanvasMetrics = (part) => {
  const cellWidth = 28
  const cellHeight = 28
  return {
    cellWidth,
    cellHeight,
    width: part.width * cellWidth,
    height: part.height * cellHeight,
  }
}

const traceRoundedRect = (ctx, x, y, width, height, radius) => {
  const safeRadius = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + safeRadius, y)
  ctx.lineTo(x + width - safeRadius, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius)
  ctx.lineTo(x + width, y + height - safeRadius)
  ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height)
  ctx.lineTo(x + safeRadius, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius)
  ctx.lineTo(x, y + safeRadius)
  ctx.quadraticCurveTo(x, y, x + safeRadius, y)
  ctx.closePath()
}

const getCellPalette = (value, viewPeak) => {
  if (value <= 0) {
    return { fill: '#12527f', text: '#f2f9ff', channel: '#d9efff' }
  }

  const intensity = Math.min(1, value / Math.max(viewPeak, 1))
  if (intensity >= 0.85) {
    return { fill: '#b7434b', text: '#fff8f4', channel: '#ffe9e6' }
  }
  if (intensity >= 0.62) {
    return { fill: '#e2bf4f', text: '#17202b', channel: '#453b17' }
  }
  if (intensity >= 0.38) {
    return { fill: '#3f796b', text: '#f6fffb', channel: '#f6fffb' }
  }
  return { fill: '#216b95', text: '#f3fbff', channel: '#d9efff' }
}

const drawPart = (canvas, part, values, positions, viewPeak) => {
  if (!canvas) return

  const { cellWidth, cellHeight, width, height } = getPartCanvasMetrics(part)
  const ratio = Math.min(window.devicePixelRatio || 1, 2)

  canvas.width = Math.round(width * ratio)
  canvas.height = Math.round(height * ratio)
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`

  const ctx = canvas.getContext('2d')
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
  ctx.clearRect(0, 0, width, height)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  for (let row = 0; row < part.height; row++) {
    for (let col = 0; col < part.width; col++) {
      const index = row * part.width + col
      const value = Math.round(values[index] || 0)
      const position = positions[index] || 0
      const x = col * cellWidth + 2
      const y = row * cellHeight + 2
      const tileWidth = cellWidth - 4
      const tileHeight = cellHeight - 4
      const palette = getCellPalette(value, viewPeak)
      const isPeak = viewPeak > 0 && value === viewPeak

      traceRoundedRect(ctx, x, y, tileWidth, tileHeight, 7)
      ctx.fillStyle = palette.fill
      ctx.fill()
      ctx.strokeStyle = isPeak ? '#fff0a6' : 'rgba(220, 242, 255, 0.24)'
      ctx.lineWidth = isPeak ? 1.5 : 0.75
      ctx.stroke()

      ctx.fillStyle = palette.channel
      ctx.font = '600 6.5px ui-monospace, SFMono-Regular, Consolas, monospace'
      ctx.fillText(`#${position}`, x + tileWidth / 2, y + 7.5)
      ctx.fillStyle = palette.text
      ctx.font = '700 10px ui-monospace, SFMono-Regular, Consolas, monospace'
      ctx.fillText(String(value), x + tileWidth / 2, y + 17.5)
    }
  }
}

const HumanBodyRawData = React.forwardRef((props, refs) => {
  const { t } = useTranslation()
  const instanceId = useId().replace(/:/g, '')
  const canvasRefs = useRef({})
  const [sourceData, setSourceData] = useState(() => createDefaultSource())
  const [activeViewKey, setActiveViewKey] = useState('front')
  const activeView = getHumanBodyRawView(activeViewKey)
  const projectedSlots = useMemo(() => Object.fromEntries(
    HUMAN_BODY_RAW_SLOTS.map((slot) => {
      const positions = slot.indexMatrix.flat()
      return [
        slot.slotKey,
        {
          positions,
          values: getHumanBodyRawProjectedValues(sourceData, slot.indexMatrix),
          sourceValues: getUniquePositionValues(sourceData, [slot]),
        },
      ]
    }),
  ), [sourceData])
  const viewStatsByKey = useMemo(() => Object.fromEntries(
    HUMAN_BODY_RAW_VIEWS.map((view) => [view.key, getViewStats(view, sourceData)]),
  ), [sourceData])

  const updateStats = (nextSourceData) => {
    const point = nextSourceData.filter((value) => value > 0).length
    const totalPres = nextSourceData.reduce((sum, value) => sum + value, 0)
    const maxPres = findMax(nextSourceData)
    const meanPres = totalPres / (point || 1)

    props.data.current?.changeData({
      meanPres: meanPres.toFixed(2),
      maxPres,
      point,
      totalPres: totalPres.toFixed(0),
    })
  }

  const changeHumanBodyData = (nextData = []) => {
    const nextSourceData = normalizeSourceData(nextData)
    updateStats(nextSourceData)
    setSourceData(nextSourceData)
  }

  useImperativeHandle(refs, () => ({
    changeHumanBodyData,
  }))

  useEffect(() => {
    const viewPeak = viewStatsByKey[activeView.key]?.peak || 0
    ;[...activeView.upperSlots, ...activeView.lowerSlots].forEach((slot) => {
      const slotData = projectedSlots[slot.slotKey]
      drawPart(
        canvasRefs.current[slot.slotKey],
        slot,
        slotData?.values || [],
        slotData?.positions || [],
        viewPeak,
      )
    })
  }, [activeView, projectedSlots, viewStatsByKey])

  const renderPart = (slot) => {
    const slotData = projectedSlots[slot.slotKey]
    const stats = getHumanBodyRawPartStats(slotData?.sourceValues || [])
    const { width } = getPartCanvasMetrics(slot)
    const label = t(slot.titleKey, { defaultValue: slot.fallbackLabel })
    const captionId = `${instanceId}-${slot.slotKey}-caption`

    return (
      <figure
        key={slot.slotKey}
        className="human-body-raw__part"
        data-slot-key={slot.slotKey}
        data-display-part-key={slot.displayPartKey}
        data-part-key={slot.sourcePartKey}
        style={{
          '--human-body-part-width': `${width}px`,
          '--human-body-part-columns': slot.width,
        }}
      >
        <figcaption id={captionId} className="human-body-raw__caption">
          <span className="human-body-raw__caption-copy">
            <strong className="human-body-raw__part-name">{label}</strong>
            <span className="human-body-raw__dimensions">
              {slot.width} × {slot.height} · {stats.total}
              {t('humanBodyRaw.points', { defaultValue: '点' })}
            </span>
          </span>
          <span className="human-body-raw__part-peak">
            {t('humanBodyRaw.peak', { defaultValue: '峰值' })} {stats.peak}
          </span>
          <span className="human-body-raw__part-scale" aria-hidden="true" />
        </figcaption>
        <span className="human-body-raw__canvas-frame">
          <canvas
            ref={(canvas) => {
              canvasRefs.current[slot.slotKey] = canvas
            }}
            className="human-body-raw__canvas"
            role="img"
            aria-labelledby={captionId}
          />
        </span>
      </figure>
    )
  }

  const titleId = `${instanceId}-${activeView.key}-title`
  const activeViewLabel = t(activeView.titleKey, {
    defaultValue: activeView.key === 'front' ? '正面' : '背面',
  })
  const lowerTitle = activeView.key === 'front'
    ? t('humanBodyRaw.frontLowerTitle', { defaultValue: '前裤（中线分开）' })
    : t('humanBodyRaw.backLowerTitle', { defaultValue: '后裤（中线分开）' })

  return (
    <div className="human-body-raw">
      <main
        className="human-body-raw__atlas"
        aria-label={t('humanBodyRaw.title', { defaultValue: '人体原始数据' })}
      >
        <div
          className="human-body-raw__view-switch"
          role="group"
          aria-label={t('humanBodyRaw.viewSwitchLabel', { defaultValue: '原始数据视角' })}
        >
          {HUMAN_BODY_RAW_VIEWS.map((view) => {
            const isActive = view.key === activeView.key
            return (
              <button
                key={view.key}
                type="button"
                className={`human-body-raw__view-switch-button${isActive ? ' is-active' : ''}`}
                aria-pressed={isActive}
                data-view-key={view.key}
                onClick={() => setActiveViewKey(view.key)}
              >
                {t(view.titleKey, {
                  defaultValue: view.key === 'front' ? '正面' : '背面',
                })}
              </button>
            )
          })}
        </div>
        <div className="human-body-raw__views">
          <section
            key={activeView.key}
            className={`human-body-raw__view human-body-raw__view--${activeView.key}`}
            aria-labelledby={titleId}
          >
            <h2 id={titleId} className="human-body-raw__view-heading">
              {activeViewLabel}
            </h2>
            <div className="human-body-raw__figure">
              <div className="human-body-raw__upper">
                {activeView.upperSlots.map(renderPart)}
              </div>
              <h3 className="human-body-raw__lower-heading">
                {lowerTitle}
              </h3>
              <div className="human-body-raw__lower" role="group" aria-label={lowerTitle}>
                {activeView.lowerSlots.map(renderPart)}
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
})

export default HumanBodyRawData
