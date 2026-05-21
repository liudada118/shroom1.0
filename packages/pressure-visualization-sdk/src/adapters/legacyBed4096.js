export function createLegacyBed4096Handle({
  setValues,
  setOptions,
  renderAndGetCanvas,
}) {
  return {
    sitData(prop) {
      const { wsPointData } = prop || {}
      if (wsPointData && wsPointData.length >= 4096) {
        setValues(wsPointData)
      }
    },
    sitValue(obj = {}) {
      setOptions({
        max: obj.valuej,
        filter: obj.valuef,
      })
    },
    changeColor(obj = {}) {
      setOptions({
        max: obj.max,
        filter: obj.filter,
        size: obj.size,
      })
    },
    bthClickHandle(wsPointData) {
      if (wsPointData && wsPointData.length >= 4096) {
        setValues(wsPointData)
      }
      return renderAndGetCanvas(wsPointData)
    },
  }
}
