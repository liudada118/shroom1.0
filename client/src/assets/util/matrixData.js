export function calArr(arr) {
    let press = arr.reduce((a, b) => a + b, 0)
    let point = arr.filter((a) => a > 10).length
    let mean = parseInt(press / (point ? point : 1))
    let max = findMax(arr)
    let area = point * 4
    const pressure = max * 1000 / (area ? area : 1)

    return {
        press,
        point,
        mean,
        max,
        area,
        pressure
    }
}