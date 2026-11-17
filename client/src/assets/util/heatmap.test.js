import { describe, expect, it } from 'vitest';
import { sharpenPixels } from './heatmap.js';

/** 优化前 `applySharpen` 里的逐核循环，逐字保留作对拍基准；不要跟着实现一起改。 */
function legacySharpen(originalPixels, outputPixels, width, height) {
    const kernel = [
        0, -1, 0,
        -1, 5, -1,
        0, -1, 0,
    ];

    const kernelSize = Math.sqrt(kernel.length);
    const halfKernelSize = Math.floor(kernelSize / 2);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let r = 0; let g = 0; let b = 0;

            for (let ky = 0; ky < kernelSize; ky++) {
                for (let kx = 0; kx < kernelSize; kx++) {
                    // 考虑边缘像素
                    const pixelY = y + ky - halfKernelSize;
                    const pixelX = x + kx - halfKernelSize;

                    if (pixelY < 0 || pixelY >= height || pixelX < 0 || pixelX >= width) continue;

                    // 卷积计算
                    const offset = (pixelY * width + pixelX) * 4;
                    const weight = kernel[ky * kernelSize + kx];

                    r += originalPixels[offset] * weight;
                    g += originalPixels[offset + 1] * weight;
                    b += originalPixels[offset + 2] * weight;
                }
            }

            const destOffset = (y * width + x) * 4;
            outputPixels[destOffset] = r;
            outputPixels[destOffset + 1] = g;
            outputPixels[destOffset + 2] = b;
            outputPixels[destOffset + 3] = originalPixels[destOffset + 3]; // 保持相同的 alpha 值
        }
    }
}

/** 固定种子的伪随机数，失败时能按用例复现。 */
function createRandom(seed) {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6D2B79F5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

describe('热力图锐化与旧实现逐位一致', () => {
    it('随机图像，含单行、单列和单像素', () => {
        const random = createRandom(20261116);
        const sizes = [[1, 1], [1, 7], [7, 1], [2, 2], [3, 3], [16, 9], [33, 20], [64, 64]];
        for (const [width, height] of sizes) {
            for (const style of ['noise', 'sparse', 'saturated']) {
                const source = new Uint8ClampedArray(width * height * 4);
                for (let index = 0; index < source.length; index++) {
                    source[index] = style === 'noise' ? Math.floor(random() * 256)
                        : style === 'sparse' ? (random() < 0.1 ? Math.floor(random() * 256) : 0)
                            : (random() < 0.5 ? 255 : 0);
                }
                const before = Array.from(source);
                const expected = new Uint8ClampedArray(source.length).fill(7);
                const actual = new Uint8ClampedArray(source.length).fill(9);
                legacySharpen(source, expected, width, height);
                sharpenPixels(source, actual, width, height);
                expect(Array.from(source), `${width}x${height} ${style}: 源像素不能被改写`).toEqual(before);
                expect(Array.from(actual), `${width}x${height} ${style}`).toEqual(Array.from(expected));
            }
        }
    });

    it('零尺寸不写任何像素', () => {
        const target = new Uint8ClampedArray(8).fill(3);
        sharpenPixels(new Uint8ClampedArray(0), target, 0, 0);
        sharpenPixels(new Uint8ClampedArray(0), target, 0, 5);
        expect(Array.from(target)).toEqual(new Array(8).fill(3));
    });
});
