/**
 * 床垫压强标定公式（V2.7.54）
 * 
 * 传感器：矩侨床垫 jq-bed-32x32
 * 矩阵规格：32×32 = 1024 点
 * ADC 位数：12 bit（0~4095）
 * 过滤阈值：30（低于此值视为噪声）
 * 
 * ============================================================
 * 核心压强公式（单一 Sigmoid S 型饱和函数）
 * ============================================================
 * 
 *   P_base = pMax / (1 + exp(-k × (ADC_avg − mid)))
 * 
 * 参数：
 *   pMax = 25.0      压强上限（kPa），ADC增大时趋近该值
 *   k    = 0.010637  曲线陡度系数
 *   mid  = 438.05    S曲线中点（ADC=438.05 时 P_base=12.5 kPa）
 * 
 * ============================================================
 * 人体段标定（本软件唯一使用的标定模式）
 * ============================================================
 * 
 * ADC均值取法：去噪后全部有效点均值（阈值=30）
 * 平均压强：P_avg = P_base × 2 = pMax / (1 + exp(-k × (ADC_avg − mid))) × 2
 * 人体修正系数：2（补偿大面积与小面积接触的响应差异）
 * 
 * ============================================================
 * 最大压强公式
 * ============================================================
 * 
 *   P_max = P_avg × (ADC_max / ADC_avg)
 * 
 * ============================================================
 * 每点压强公式
 * ============================================================
 * 
 *   P_点 = P_avg × (ADC_该点 / ADC_avg)
 * 
 * ============================================================
 * 公式特性
 * ============================================================
 * - 采用S型饱和函数，仅两个参数(k、mid)，曲线天然平滑、单调递增，无分段振荡
 * - 压强随ADC增大而增长，增速先快后缓，最终趋近上限 25 kPa
 * - 适用于12bit宽量程(ADC 0~4095)，无需大量分段锚点即可覆盖全量程
 * - 人体大面积加载时压强结果乘以2，补偿大面积与小面积接触的响应差异
 */

// ============================================================
// 参数定义
// ============================================================

/** 压强上限 (kPa) */
const P_MAX = 25.0;

/** 曲线陡度系数 */
const K = 0.010637;

/** S曲线中点 (ADC=438.05 时 P_base=12.5 kPa) */
const MID = 438.05;

/** 人体段修正系数（大面积加载补偿） */
const HUMAN_FACTOR = 2;

/** ADC过滤阈值（低于此值视为噪声） */
const FILTER_THRESHOLD = 30;

// ============================================================
// 核心标定函数
// ============================================================

/**
 * Sigmoid 基础函数：ADC → 压强(kPa)
 * P_base = pMax / (1 + exp(-k × (ADC - mid)))
 */
function sigmoidBase(adc) {
  return P_MAX / (1 + Math.exp(-K * (adc - MID)));
}

/**
 * 人体段平均压强计算
 * P_avg = Sigmoid(ADC_avg) × 人体修正系数
 * 
 * @param {number} adcAvg - 去噪后全部有效点的ADC均值
 * @returns {number} 平均压强 (kPa)
 */
function estimateAvgPressure(adcAvg) {
  if (adcAvg <= 0) return 0;
  return sigmoidBase(adcAvg) * HUMAN_FACTOR;
}

/**
 * 最大压强计算
 * P_max = P_avg × (ADC_max / ADC_avg)
 * 
 * @param {number} adcAvg - 去噪后全部有效点的ADC均值
 * @param {number} adcMax - 当前帧最大ADC值
 * @returns {number} 最大压强 (kPa)
 */
function estimateMaxPressure(adcAvg, adcMax) {
  if (adcAvg <= 0 || adcMax <= 0) return 0;
  const pAvg = estimateAvgPressure(adcAvg);
  return pAvg * (adcMax / adcAvg);
}

/**
 * 每点压强计算
 * P_点 = P_avg × (ADC_该点 / ADC_avg)
 * 
 * @param {number} adcAvg - 去噪后全部有效点的ADC均值
 * @param {number} adcPoint - 该点的ADC值
 * @returns {number} 该点压强 (kPa)
 */
function estimatePointPressure(adcAvg, adcPoint) {
  if (adcAvg <= 0 || adcPoint <= FILTER_THRESHOLD) return 0;
  const pAvg = estimateAvgPressure(adcAvg);
  return pAvg * (adcPoint / adcAvg);
}

/**
 * 计算去噪后全部有效点的平均ADC值
 * 
 * @param {number[][]} matrix - ADC矩阵（32×32 或 16×16）
 * @returns {number} 有效点ADC均值
 */
function computeFilteredAvg(matrix) {
  let sum = 0;
  let count = 0;

  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix[r].length; c++) {
      const v = matrix[r][c];
      if (v > FILTER_THRESHOLD) {
        sum += v;
        count++;
      }
    }
  }

  return count > 0 ? sum / count : 0;
}

// ============================================================
// ADC → 压强对照表（验证用）
// ============================================================

const ADC_PRESSURE_TABLE = [
  { adc: 50,   pBase: sigmoidBase(50),   pHuman: estimateAvgPressure(50)   },
  { adc: 100,  pBase: sigmoidBase(100),  pHuman: estimateAvgPressure(100)  },
  { adc: 150,  pBase: sigmoidBase(150),  pHuman: estimateAvgPressure(150)  },
  { adc: 200,  pBase: sigmoidBase(200),  pHuman: estimateAvgPressure(200)  },
  { adc: 250,  pBase: sigmoidBase(250),  pHuman: estimateAvgPressure(250)  },
  { adc: 300,  pBase: sigmoidBase(300),  pHuman: estimateAvgPressure(300)  },
  { adc: 350,  pBase: sigmoidBase(350),  pHuman: estimateAvgPressure(350)  },
  { adc: 438,  pBase: sigmoidBase(438),  pHuman: estimateAvgPressure(438)  },
  { adc: 500,  pBase: sigmoidBase(500),  pHuman: estimateAvgPressure(500)  },
  { adc: 600,  pBase: sigmoidBase(600),  pHuman: estimateAvgPressure(600)  },
  { adc: 700,  pBase: sigmoidBase(700),  pHuman: estimateAvgPressure(700)  },
  { adc: 1000, pBase: sigmoidBase(1000), pHuman: estimateAvgPressure(1000) },
  { adc: 2000, pBase: sigmoidBase(2000), pHuman: estimateAvgPressure(2000) },
  { adc: 4095, pBase: sigmoidBase(4095), pHuman: estimateAvgPressure(4095) },
];

// 打印对照表
if (typeof require !== 'undefined' && require.main === module) {
  console.log("============================================================");
  console.log("床垫压强标定公式 V2.7.54 — ADC → 压强对照表");
  console.log("============================================================");
  console.log(`参数: pMax=${P_MAX}, k=${K}, mid=${MID}, 人体修正系数=${HUMAN_FACTOR}`);
  console.log(`公式: P_avg = ${P_MAX} / (1 + exp(-${K} × (ADC_avg − ${MID}))) × ${HUMAN_FACTOR}`);
  console.log(`最大压强: P_max = P_avg × (ADC_max / ADC_avg)`);
  console.log(`过滤阈值: ${FILTER_THRESHOLD}`);
  console.log("------------------------------------------------------------");
  console.log("ADC均值\t\tP_base(kPa)\tP_human(kPa)");
  console.log("------------------------------------------------------------");
  for (const row of ADC_PRESSURE_TABLE) {
    console.log(`${row.adc}\t\t${row.pBase.toFixed(4)}\t\t${row.pHuman.toFixed(4)}`);
  }
  console.log("------------------------------------------------------------");
}

// 导出（Node.js / ES Module 兼容）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    P_MAX, K, MID, HUMAN_FACTOR, FILTER_THRESHOLD,
    sigmoidBase, estimateAvgPressure, estimateMaxPressure,
    estimatePointPressure, computeFilteredAvg,
    ADC_PRESSURE_TABLE,
  };
}
