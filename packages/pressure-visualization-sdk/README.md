# @shroom/pressure-visualization

Internal pressure sensor visualization SDK for Shroom applications.

## Current Scope

This first version keeps the SDK inside the main repository and exposes a narrow, working boundary:

- Core pressure frame helpers.
- Matrix helpers for edge clearing, mirroring, and thresholding.
- `bed4096` sensor preset and preprocessing.
- WebGL heatmap rendering adapter.
- React `Bed4096WebGLCanvas` wrapper.
- Legacy ref adapter compatible with `sitData`, `sitValue`, `changeColor`, and `bthClickHandle`.

The low-level shader implementation is still provided by the host app through `createHeatmapCanvas`. This avoids copying the large existing WebGL file before the SDK API is stable.

## Host Usage

```jsx
import { Bed4096WebGLCanvas } from '@shroom/pressure-visualization'
import { genWebglHeatmap } from './WebGL.HeatMap copy 2'

export default function Canvas4096WebGL(props, ref) {
  return (
    <Bed4096WebGLCanvas
      {...props}
      ref={ref}
      createHeatmapCanvas={genWebglHeatmap}
    />
  )
}
```

## Boundaries

The SDK should not own:

- WebSocket connections.
- Electron IPC.
- Serial collection or playback commands.
- License logic.
- Page layout or Ant Design controls.
- `localStorage` persistence.

The SDK should own:

- Data normalization.
- Sensor presets.
- Renderer lifecycle.
- Canvas export surfaces.
- Compatibility adapters for existing host APIs.
