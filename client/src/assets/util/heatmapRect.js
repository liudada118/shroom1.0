
// 获取 Canvas 上下文
const canvas = document.getElementById("heatmapCanvas");


// 设置 Canvas 尺寸
const width = 500;
const height = 500;
canvas.width = width;
canvas.height = height;

// 生成 10x10 网格
const rows = 10;
const cols = 10;
const cellWidth = width / cols;
const cellHeight = height / rows;

// 生成随机数据（0-100）
const data = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => Math.random() * 100)
);

// 颜色映射（热力图渐变）
function getColor(value) {
    const r = Math.floor(255 * (value / 100));
    const g = Math.floor(255 * (1 - value / 100));
    return `rgb(${r}, ${g}, 100)`;
}

// 绘制热力图
function drawHeatmap(canvas , data) {
    const ctx = canvas.getContext("2d");
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const value = data[y][x]; // 获取数据值
            ctx.fillStyle = getColor(value);
            ctx.fillRect(x * cellWidth, y * cellHeight, cellWidth, cellHeight);
        }
    }
}

class HeatmapRect{
    constructor(width, height, canvasWProp, canvasHProp, canvasName) {
        this.width = 32
        this.height = 32
        this.canvas = document.createElement('canvas');
        document.body.appendChild(this.canvas)

        const dpr = window.devicePixelRatio || 1;
        // // console.log(contentWidth,dpr)
        // this.canvas = canvas
        const contentWidth = 256
        this.options = {
            min: 0,
            max: 11000,
            size: contentWidth * canvasWProp / 4

        }
        if (canvasName === 'body') {
            this.options.size = contentWidth * canvasWProp / 12
            this.canvas.width = contentWidth * canvasWProp
            this.canvas.height = contentWidth * canvasHProp
        } else if (canvasName === 'left') {
            this.canvas.width = contentWidth * canvasWProp
            this.canvas.height = contentWidth * canvasHProp
        } else {
            this.canvas.width = contentWidth * canvasWProp
            this.canvas.height = contentWidth * canvasHProp
        }



    }

}

