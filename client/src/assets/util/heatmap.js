

const options = {
    min: 0,
    max: 13000,
    size: 10
}
let isShadow = true




function getRandomIntInclusive(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function addSide(arr, width, height, wnum, hnum, sideNum) {
    const narr = new Array(height);
    const res = [];
    for (let i = 0; i < height; i++) {
        narr[i] = [];

        for (let j = 0; j < width; j++) {
            if (j == 0) {
                narr[i].push(
                    ...new Array(wnum).fill(sideNum >= 0 ? sideNum : 1),
                    arr[i * width + j]
                );
            } else if (j == width - 1) {
                narr[i].push(
                    arr[i * width + j],
                    ...new Array(wnum).fill(sideNum >= 0 ? sideNum : 1)
                );
            } else {
                narr[i].push(arr[i * width + j]);
            }
        }
    }
    for (let i = 0; i < height; i++) {
        res.push(...narr[i]);
    }

    return [
        ...new Array(hnum * (width + 2 * wnum)).fill(sideNum >= 0 ? sideNum : 1),
        ...res,
        ...new Array(hnum * (width + 2 * wnum)).fill(sideNum >= 0 ? sideNum : 1),
    ];
}


function interpSmall(smallMat, width, height, interp1, interp2) {

    const bigMat = new Array((width * interp1) * (height * interp2)).fill(0)
    for (let i = 0; i < height; i++) {
        for (let j = 0; j < width; j++) {
            bigMat[(width * interp1) * i * interp2 + (j * interp1)] = smallMat[i * width + j] * 10
            bigMat[(width * interp1) * (i * interp2 + 1) + (j * interp1)] = smallMat[i * width + j] * 10
        }
    }

    // console.log(bigMat.length)
    return bigMat
}




function generateData(arr, canvas, width, height, interp1, interp2, order) {
    // const resData = [0, 0, 1, 21, 9, 1, 0, 0, 0, 0, 0, 0, 0, 6, 5, 0, 0, 0, 0, 0, 0, 3, 28, 27, 37, 50, 56, 43, 34, 11, 1, 21, 45, 39, 37, 37, 9, 1, 0, 0, 3, 37, 6, 40, 48, 33, 3, 0, 0, 0, 2, 1, 1, 21, 33, 24, 2, 0, 0, 0, 0, 0, 1, 13, 26, 18, 4, 0, 0, 0, 0, 2, 16, 37, 34, 69, 51, 4, 1, 0, 1, 2, 15, 35, 52, 56, 39, 5, 0, 0, 0, 1, 14, 23, 4, 6, 30, 31, 1, 0, 0, 1, 1, 14, 1, 0, 5, 20, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 4, 0, 0, 0, 1, 34, 4, 0, 0, 2, 30, 3, 1, 0, 1, 19, 29, 0, 0, 1, 14, 0, 0, 0, 0, 3, 32, 1, 2, 3, 5, 1, 1, 1, 1, 2, 6]
    let resData
    let resArr = arr
    resArr = addSide(
        resArr,
        height,
        width,
        order,
        order,
        0
    );
    const interpArr = interpSmall(resArr, height + order * 2, width + order * 2, interp1, interp2)

    resData = interpArr
    const count = 32
    const data = []
    // const width = 36, height = 36 * 2
    const dataWidth = (width + order * 2) * interp1, dataHeight = (height + + order * 2) * interp2
    for (let i = 0; i < dataHeight; i++) {
        for (let j = 0; j < dataWidth; j++) {
            let obj = {}
            obj.y = i * canvas.width / dataWidth
            obj.x = j * canvas.height / dataHeight
            obj.value = resData[i * dataWidth + j]
            data.push(obj)
        }

    }
    return data
}



// 构造一个离屏canvas
function Canvas(width, height) {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    return canvas
}

// 画圆
function createCircle(size) {
    const shadowBlur = size / 2
    const r2 = size + shadowBlur
    // let offsetDistance = 10000
    const offsetDistance = 10000
    // let newCanvas:UserConstructor = Canvas

    const circle = new (Canvas)(r2 * 2, r2 * 2)
    const context = circle.getContext('2d')




    // if (isShadow) context.shadowBlur = shadowBlur;
    if (isShadow) context.shadowBlur = shadowBlur;
    context.shadowColor = 'black'
    context.shadowOffsetX = context.shadowOffsetY = offsetDistance

    context.beginPath()
    context.arc(r2 - offsetDistance, r2 - offsetDistance, size, 0, Math.PI * 2, true)
    context.closePath()
    context.fill()
    return circle
}

function draw(context, data, canvas, options) {
    let circle = createCircle(options.size, data.value)
    let circleHalfWidth = circle.width / 2
    let circleHalfHeight = circle.height / 2

    // 按透明度分类
    let dataOrderByAlpha = {}
    data.forEach((item, index) => {
        let alpha = Math.min(1, item.value / options.max).toFixed(2)
        dataOrderByAlpha[alpha] = dataOrderByAlpha[alpha] || []
        dataOrderByAlpha[alpha].push(item)
    })


    // 绘制不同透明度的圆形
    let inheritsAlpha = false
    for (let i in dataOrderByAlpha) {
        if (isNaN(i)) continue;
        // 负的透明度是非法值，赋值会被画布忽略，这一档沿用之前留下的透明度（可能来自上一次绘制）。
        if (!(Number(i) >= 0)) inheritsAlpha = true
        let _data = dataOrderByAlpha[i]
        context.beginPath()
        context.globalAlpha = i
        // 透明度为 0 的圆画了也不改变像素；一帧里绝大多数点都是 0，跳过能省掉上千次贴图。
        // ⚠️ 判的是赋值后的实际透明度：非法值（负数）会沿用上一档，不能按键名判断。
        if (context.globalAlpha === 0) continue
        _data.forEach(item => {
            // 把所有的圆都画再画布上
            context.drawImage(circle, item.x - circleHalfWidth, item.y - circleHalfHeight)
        })
    }
    // 圆形着色
    let intensity = new Intensity(options)
    // 返回整张画布的像素信息 rgba组个成的点像素 
    let colored = context.getImageData(0, 0, context.canvas.width, context.canvas.height)

    // 形参 画布的像素数组   , 渐变的像素数组 
    colorize(colored.data, intensity.getImageData(), options)


    // 旧流程在这里把画布填成 #666 再清掉，只留下 fillStyle 这个状态；保留它，省掉两次整幅重绘。
    context.fillStyle = '#666'

    applySharpen(context, colored, canvas.width, canvas.height);
    return !inheritsAlpha
}


const sharpenOutputs = new WeakMap();

/**
 * 3×3 锐化核 `[0,-1,0, -1,5,-1, 0,-1,0]`，越界的邻点不计，透明度原样带过。
 * 全是整数运算，结果与逐核循环的旧写法逐位相同（由 heatmap.test.js 对拍）。
 *
 * @param {Uint8ClampedArray} source RGBA 源像素，长度 `width * height * 4`，不被修改。
 * @param {Uint8ClampedArray} target RGBA 出参，同样长度，每个分量都会被写到。
 * @param {number} width 像素列数。
 * @param {number} height 像素行数。
 * @returns {void}
 */
export function sharpenPixels(source, target, width, height) {
    const stride = width * 4;
    const lastColumn = width - 1;
    for (let y = 0; y < height; y++) {
        const hasUp = y > 0;
        const hasDown = y < height - 1;
        let offset = y * stride;
        for (let x = 0; x < width; x++, offset += 4) {
            let r = 5 * source[offset];
            let g = 5 * source[offset + 1];
            let b = 5 * source[offset + 2];
            if (hasUp) {
                r -= source[offset - stride]; g -= source[offset - stride + 1]; b -= source[offset - stride + 2];
            }
            if (x > 0) {
                r -= source[offset - 4]; g -= source[offset - 3]; b -= source[offset - 2];
            }
            if (x < lastColumn) {
                r -= source[offset + 4]; g -= source[offset + 5]; b -= source[offset + 6];
            }
            if (hasDown) {
                r -= source[offset + stride]; g -= source[offset + stride + 1]; b -= source[offset + stride + 2];
            }
            target[offset] = r;
            target[offset + 1] = g;
            target[offset + 2] = b;
            target[offset + 3] = source[offset + 3];
        }
    }
}

/**
 * 把上色后的像素锐化并写回画布。
 * ⚠️ 旧流程是先写回画布再读出来锐化；画布按预乘透明度存，全透明像素读回来 RGB 是 0。
 * 这里直接在内存里做同一件事；遇到半透明像素（上色不会产生）就退回旧流程，不猜取整。
 *
 * @param {CanvasRenderingContext2D} context 目标画布的上下文。
 * @param {ImageData} colored 上色后的整幅像素，会被就地规整。
 * @param {number} width 画布宽。
 * @param {number} height 画布高。
 * @returns {void}
 */
function applySharpen(context, colored, width, height) {
    let originalPixels = colored.data;
    let roundTrip = colored.width !== width || colored.height !== height;
    for (let i = 3, len = originalPixels.length; i < len && !roundTrip; i += 4) {
        const alpha = originalPixels[i];
        if (alpha === 0) {
            originalPixels[i - 3] = 0; originalPixels[i - 2] = 0; originalPixels[i - 1] = 0;
        } else if (alpha !== 255) roundTrip = true;
    }
    if (roundTrip) {
        context.clearRect(0, 0, context.canvas.width, context.canvas.height)
        context.putImageData(colored, 0, 0)
        originalPixels = context.getImageData(0, 0, width, height).data;
    }

    // 整幅输出每次都被写满，可以一直复用同一块内存，不必每帧申请几兆。
    let outputImageData = sharpenOutputs.get(context.canvas);
    if (!outputImageData || outputImageData.width !== width || outputImageData.height !== height) {
        outputImageData = context.createImageData(width, height);
        sharpenOutputs.set(context.canvas, outputImageData);
    }
    sharpenPixels(originalPixels, outputImageData.data, width, height);

    // 将处理后的图像数据绘制回画布
    context.putImageData(outputImageData, 0, 0);
}


function colorize(pixels, gradient, options) {

    // console.log(gradient)

    const max = options.max;
    const min = options.min;
    const diff = max - min;
    var range = options.range || null;

    var jMin = options.fliter ? options.fliter : 100;
    var jMax = 1024;
    if (range && range.length === 2) {
        jMin = (range[0] - min) / diff * 1024;
    }

    if (range && range.length === 2) {
        jMax = (range[1] - min) / diff * 1024;
    }

    const maxOpacity = options.maxOpacity || 1;
    var range = options.range;
    // console.log(pixels.length)
    for (var i = 3, len = pixels.length, j; i < len; i += 4) {
        j = pixels[i] * 4; // get gradient color from opacity value

        // if (pixels[i] / 256 > maxOpacity) {
        //     pixels[i] = 256 * maxOpacity;
        // }
        if (pixels[i] / 256 < 1) {
            pixels[i] = 256 * 1;
        }
        // const value = jet()
        if (j && j >= jMin && j <= jMax) {
            pixels[i - 3] = gradient[j];
            pixels[i - 2] = gradient[j + 1];
            pixels[i - 1] = gradient[j + 2];
        } else {
            pixels[i] = 0;
        }
        // pixels[i] = 256 *0
    }
}


/**
 * 清空画布并按数据重画一遍热力图。
 *
 * @returns {boolean} 画面是否只由本次入参决定；false 表示用到了画布上遗留的透明度，同样的入参再画一次可能不同。
 */
export function bthClickHandle(arr, canvas, width, height, interp1, interp2, order, options) {

    const data = generateData(arr, canvas, width, height, interp1, interp2, order, options)

    let context = canvas.getContext('2d')
    // let context2 = canvas2.getContext('2d')
    context.clearRect(0, 0, canvas.width, canvas.height)
    // context2.clearRect(0, 0, canvas2.width, canvas2.height)
    isShadow = true
    context.globalCompositeOperation = 'lighter';
    // context2.drawImage(img, 0, 0, canvas2.width, canvas2.height);
    const repeatable = draw(context, data, canvas, options)
    isShadow = false
    return repeatable

    // draw(context2, data)
}

function Intensity(options) {


    options = options || {};
    this.gradient = options.gradient || {


        // // 士凯
        0.00: '#ffffff',
        0.01: "#4192fe",
        0.08: "#49aaff",
        0.17: "#51c6ff",
        0.25: "#4ddff5",
        0.33: "#34f6db",
        0.42: "#6cffb9",
        0.50: "#c5ff8b",
        0.58: "#fdf655",
        0.67: "#ffda41",
        0.75: "#ffb54a",
        0.83: "#ff9555",
        0.92: "#ff7665",
        1.00: "#ff0000"

        // 0.00: "#ffffff",
       
        // 1.00: "#ffffff"


    };
    this.maxSize = options.maxSize || 35;
    this.minSize = options.minSize || 0;
    this.max = options.max || 100;
    this.min = options.min || 0;
    this.initPalette();
}

Intensity.prototype.setMax = function (value) {
    this.max = value || 100;
}

Intensity.prototype.setMin = function (value) {
    this.min = value || 0;
}

Intensity.prototype.setMaxSize = function (maxSize) {
    this.maxSize = maxSize || 35;
}

Intensity.prototype.setMinSize = function (minSize) {
    this.minSize = minSize || 0;
}

// Intensity.prototype.initPalette = function () {

//     var gradient = this.gradient;

//     var canvas = new (Canvas)(256, 1);

//     var paletteCtx = this.paletteCtx = canvasRef.current.getContext('2d', { willReadFrequently: true });

//     var lineGradient = paletteCtx.createLinearGradient(0, 0, 256, 1);

//     for (var key in gradient) {
//         lineGradient.addColorStop(parseFloat(key), gradient[key]);
//     }

//     paletteCtx.fillStyle = lineGradient;
//     paletteCtx.fillRect(0, 0, 256, 1);

// }

Intensity.prototype.initPalette = function () {

    const gradient = this.gradient;

    var canvas = new Canvas(256, 1);

    var paletteCtx = this.paletteCtx = canvas.getContext('2d');

    // 创建一个线性渐变 返回一个线性CanvasGradient
    var lineGradient = paletteCtx.createLinearGradient(0, 0, 256, 1);


    // 添加一个由偏移（offset）和颜色（color）定义的断点到渐变中。
    for (var key in gradient) {
        lineGradient.addColorStop(parseFloat(key), gradient[key]);
    }

    paletteCtx.fillStyle = lineGradient;
    paletteCtx.fillRect(0, 0, 256, 1);

}



Intensity.prototype.getImageData = function (value) {

    const imageData = this.paletteCtx.getImageData(0, 0, 256, 1).data;

    if (value === undefined) {
        return imageData;
    }

    const max = this.max;
    const min = this.min;

    if (value > max) {
        value = max;
    }

    if (value < min) {
        value = min;
    }

    const index = Math.floor((value - min) / (max - min) * (256 - 1));

    return [imageData[index], imageData[index + 1], imageData[index + 2], imageData[index + 3]];
}

/**
 * @param Number value
 * @param Number max of value
 * @param Number max of size
 * @param Object other options
 */
Intensity.prototype.getSize = function (value) {

    let size = 0;
    const max = this.max;
    const min = this.min;
    const maxSize = this.maxSize;
    const minSize = this.minSize;

    if (value > max) {
        value = max;
    }

    if (value < min) {
        value = min;
    }

    size = minSize + (value - min) / (max - min) * (maxSize - minSize);

    return size;

}

Intensity.prototype.getLegend = function (options, canvas1) {
    const gradient = this.gradient;


    const width = options.width || 20;
    const height = options.height || 180;

    const canvas = new (Canvas)(width, height);

    const paletteCtx = canvas1.current.getContext('2d');

    const lineGradient = paletteCtx.createLinearGradient(0, height, 0, 0);

    for (const key in gradient) {
        lineGradient.addColorStop(parseFloat(key), gradient[key]);
    }

    paletteCtx.fillStyle = lineGradient;
    paletteCtx.fillRect(0, 0, width, height);

    return canvas;
}

const changeOptions = (value) => {
    options.size = value
}



/** 把绘制参数序列化成可比较的文本；NaN、无穷和 undefined 在 JSON 里会被抹平，这里单独标出。 */
function describeOptions(options) {
    return JSON.stringify(options, (key, value) => (
        (typeof value === 'number' && !Number.isFinite(value)) || value === undefined ? `<${String(value)}>` : value
    ))
}

let i = 0
export class HeatmapCanvas {
    constructor(width, height, canvasWProp, canvasHProp, canvasName, options) {
        this.width = 32
        this.height = 32

        this.canvas = document.createElement('canvas');


        // document.body.appendChild(this.canvas)


        const dpr = window.devicePixelRatio || 1;
        // // console.log(contentWidth,dpr)
        // this.canvas = canvas
        const contentWidth = 1024
        this.options = {
            min: 0,
            max: 2000,
            size: contentWidth * canvasWProp / 4

        }


        if (canvasName === 'body') {
            this.options.size = contentWidth * canvasWProp / 40
            this.canvas.width = contentWidth * canvasWProp
            this.canvas.height = contentWidth * canvasHProp
        } else if (canvasName === 'left') {
            this.canvas.width = contentWidth * canvasWProp
            this.canvas.height = contentWidth * canvasHProp
        }
        else {
            this.canvas.width = contentWidth * canvasWProp
            this.canvas.height = contentWidth * canvasHProp
        }
        if (options) this.options = options


    }

    /**
     * 按当前数据重画热力图。输入、参数和画布尺寸都与上次相同时不重画，画布保持原样。
     * ⚠️ 只有本方法往 `this.canvas` 上画；外部若直接改这张画布，要先调 `invalidate()`。
     *
     * @returns {boolean} 本次是否真的重画了；false 时调用方可以跳过后续拷贝和纹理上传。
     */
    changeHeatmap(resArr, interp1, interp2, order) {
        const signature = `${interp1}|${interp2}|${order}|${this.width}x${this.height}|${this.canvas.width}x${this.canvas.height}|${describeOptions(this.options)}`
        const length = resArr ? resArr.length : -1
        let unchanged = this.drawnSignature === signature && this.drawnValues && this.drawnValues.length === length
        for (let index = 0; unchanged && index < length; index++) {
            if (this.drawnValues[index] !== resArr[index]) unchanged = false
        }
        if (unchanged) return false
        this.drawnSignature = null
        const repeatable = bthClickHandle(resArr, this.canvas, this.width, this.height, interp1, interp2, order, this.options)
        this.drawnValues = length >= 0 ? Array.from(resArr) : null
        // ⚠️ 画面依赖遗留透明度时不登记：同样的数据下次必须照旧重画，才能与跳过前的行为一致。
        this.drawnSignature = repeatable ? signature : null
        const ctx = this.canvas.getContext('2d');
        // canvas.width = 1024;
        // canvas.height = 1024;

        // 填充 Canvas 颜色
        // ctx.fillStyle = 'rgb(255, 0, 0)'; // 纯红色
        // ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        return true
    }

    /** 让下一次 changeHeatmap 无条件重画。 */
    invalidate() {
        this.drawnSignature = null
    }
}

function changeArrValue(arr, arrMax, backMax, name) {
    const props = name ? 1 : 0.8
    return arr.map((a) => Math.floor(a * backMax / arrMax * props))
}



