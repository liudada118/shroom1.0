import React, { useCallback, useEffect, useImperativeHandle, useRef } from 'react'
import { createLegacyBed4096Handle } from '../adapters/legacyBed4096.js'
import { bed4096Preset } from '../sensors/bed4096.js'
import { renderBed4096HeatmapToCanvas } from '../renderers/webgl/bed4096Heatmap.js'

export const Bed4096WebGLCanvas = React.forwardRef(
  (
    {
      createHeatmapCanvas,
      className,
      style,
      canvasStyle,
      width = bed4096Preset.canvasWidth,
      height = bed4096Preset.canvasHeight,
      background = '#000',
    },
    ref
  ) => {
    const canvasRef = useRef(null)
    const valuesRef = useRef(new Array(4096).fill(0))
    const optionsRef = useRef({ ...bed4096Preset.defaultOptions })
    const rafRef = useRef(null)

    const renderFrame = useCallback(
      (overrideValues) =>
        renderBed4096HeatmapToCanvas({
          canvas: canvasRef.current,
          values: overrideValues || valuesRef.current,
          options: optionsRef.current,
          createHeatmapCanvas,
        }),
      [createHeatmapCanvas]
    )

    const setValues = useCallback((values) => {
      valuesRef.current = values
    }, [])

    const setOptions = useCallback((nextOptions) => {
      Object.entries(nextOptions).forEach(([key, value]) => {
        if (value !== undefined) {
          optionsRef.current[key] = value
        }
      })
    }, [])

    useEffect(() => {
      function loop() {
        renderFrame()
        rafRef.current = requestAnimationFrame(loop)
      }

      rafRef.current = requestAnimationFrame(loop)

      return () => {
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current)
        }
      }
    }, [renderFrame])

    useImperativeHandle(
      ref,
      () =>
        createLegacyBed4096Handle({
          setValues,
          setOptions,
          renderAndGetCanvas: renderFrame,
        }),
      [renderFrame, setOptions, setValues]
    )

    return (
      <div
        className={className}
        style={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background,
          ...style,
        }}
      >
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          style={{ width: '80vh', height: '80vh', ...canvasStyle }}
        />
      </div>
    )
  }
)

Bed4096WebGLCanvas.displayName = 'Bed4096WebGLCanvas'
