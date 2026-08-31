const fs = require('fs');
const path = require('path');
const multer = require('multer');
const HttpResult = require('./HttpResult');
const { callPy, warmFootAnalysis } = require('../../algorithm-channel/pythonWorker');

// 两个 Python 调用的超时，都远大于 pythonWorker 的 10 秒默认值 —— 它们不是逐帧算法，
// 而是一次性跑完整段历史：找峰值帧要遍历几千帧，生成 PDF 还要画图排版。
// 用默认超时会让「报告生成中」在两分钟的活儿上必然失败。
const PY_HEATMAP_TIMEOUT_MS = 60000;
const PY_REPORT_TIMEOUT_MS = 120000;

/**
 * 把外部传来的字符串洗成安全的文件名片段。
 *
 * 三步各挡一类：去 `/` `\` 挡目录穿越（`..` 会被下面那步清成空串，两种写法都堵住）；去控制字符与
 * `<>:"|?*`（Windows 非法字符，带上去的现象是写文件时抛看不懂的 EINVAL）；去**尾部**点号与空白
 * （Windows 静默忽略它们，会让「写进去的名字」和「实际的名字」不一致，之后按原名找不到文件）。
 *
 * ⚠️ **这是一道安全边界**：返回值会进 `path.join(imgPath, ...)` 和 PDF 输出路径，而输入来自 HTTP
 * 请求体。没有它，一个 `../../..` 就能把文件写到任意位置。
 *
 * ⚠️ 洗完可能是空串，**这里不兜底** —— 调用方必须自己判空并拒绝（见 `/uploadCanvas`）。在这里编个
 * 默认名会让不同用户的报告互相覆盖。
 *
 * @param {*} name 原始文件名片段。
 * @returns {string} 安全片段；不是字符串或洗完为空时返回 `''`。
 */
function sanitizeFilename(name) {
  if (typeof name !== 'string') return '';
  let safe = name.trim();
  safe = safe.replace(/[\\/]/g, '');
  safe = safe.replace(/[\x00-\x1F<>:"|?*]/g, '');
  safe = safe.replace(/[.\s]+$/g, '');
  return safe;
}

/**
 * 修复 multipart 表单字段的中文乱码（latin1 被当成 utf8 读的那一类）。
 *
 * 起因：浏览器提交 multipart 表单时不声明字段的字符集，multer/busboy 于是按 latin1
 * 逐字节读。中文姓名于是变成「å¼ ä¸‰」这种形状，直接写进 PDF 报告里。
 *
 * **那一行往回验算是这个函数安全的全部原因**：先按 latin1 取回原始字节，
 * 再按 utf8 解释，然后**把结果重新编码回 utf8 并与原字节比对**。只有完全一致才采纳。
 * 这样：
 * - 真乱码（字节确实是 utf8 序列）→ 修复。
 * - 本来就正常的字符串（例如纯 ASCII，或已经解对的中文）→ 重编码后字节对不上，原样返回。
 *
 * 少了这层验算就会把「本来正常的字符串」二次解码成真正的乱码 —— 那种情况不可逆，
 * 而且只在部分浏览器/部分姓名上出现，极难复现。
 *
 * @param {*} value 可能乱码的字段值。
 * @returns {*} 修复后的字符串；非字符串或不需要修复时原样返回。
 */
function fixMojibake(value) {
  if (typeof value !== 'string') return value;
  try {
    const buf = Buffer.from(value, 'latin1');
    const utf = buf.toString('utf8');
    if (Buffer.from(utf, 'utf8').equals(buf)) return utf;
  } catch {}
  return value;
}

/**
 * 尝试 URI 解码，**最多两轮**。
 *
 * 两轮是因为前端存在双重编码的调用点（`encodeURIComponent` 被套了两次，
 * 于是 `%E5` 变成 `%25E5`）。解一轮只会得到 `%E5` 这种半成品字符串。
 *
 * 上限是 2 而不是「解到不变为止」：无上限的循环遇到用户真的输入了 `%25` 字面量时会
 * 一直往下解，把用户的原始内容改掉。两轮覆盖了已知的双重编码，再深就更可能是误伤。
 *
 * `decoded === result` 就提前退出：不需要解码的字符串不多跑一轮。
 *
 * `catch { break }` 吞掉 `URIError`：输入里有孤立的 `%` 是很常见的（用户姓名、备注），
 * 那不是错误，只是「不是 URI 编码」，保留原值即可。**不能抛** ——
 * 一个姓名里的百分号不该让整份报告生成失败。
 *
 * @param {*} value 可能被 URI 编码过的字段值。
 * @returns {*} 解码后的字符串；非字符串或解不动时原样返回。
 */
function decodeMaybeUri(value) {
  if (typeof value !== 'string') return value;
  let result = value;
  for (let index = 0; index < 2; index++) {
    try {
      const decoded = decodeURIComponent(result);
      if (decoded === result) break;
      result = decoded;
    } catch {
      break;
    }
  }
  return result;
}

/**
 * 表单字段的标准清洗入口：先修乱码，再 URI 解码。
 *
 * **顺序不能反。** URI 解码的产物是 utf8 字符串；如果先解码再跑 `fixMojibake`，
 * 那层 latin1↔utf8 的往回验算就会在已经正确的中文上做判断，虽然验算会挡住误伤
 * （见 fixMojibake），但真乱码 + 真编码同时出现时就修不回来了。
 * 先修字节层面的乱码、再处理传输层面的编码，才是两个问题的自然顺序。
 *
 * ⚠️ 这个函数**只管编码，不管安全**。清洗出来的值如果要用作文件名，
 * 必须再过一遍 `sanitizeFilename`（`/uploadCanvas` 里的 `date` 就是这么做的）。
 * 姓名、性别这些只进 PDF 内容、不进路径，所以只需要 `decodeField`。
 *
 * @param {*} value 原始表单字段值。
 * @returns {*} 清洗后的字符串；非字符串原样返回。
 */
function decodeField(value) {
  return decodeMaybeUri(fixMojibake(value));
}

/**
 * 注册 OneStep 报告相关 HTTP 路由。
 *
 * **两个路由是一条有先后依赖的流程，不是两个独立接口**：`POST /getDbHeatmap` 按日期取整段历史、
 * 交 Python 找峰值帧返回给前端画图，**并把这段数据存进闭包的 `pdfArrData`**；`POST /uploadCanvas`
 * 收前端画好的 canvas，拿它 + `pdfArrData` 一起交 Python 生成 PDF。错误一律「记日志 + 回
 * `HttpResult(1, {}, ...)`」不抛，前端只看到笼统原因 —— 刻意的，Python 的报错里带绝对路径和源码。
 *
 * ⚠️ **`pdfArrData` 是跨请求的共享可变状态**：必须先 `/getDbHeatmap` 再 `/uploadCanvas`，否则 PDF
 * 用的是空数据或**上一次查询的数据**；两个用户同时用会串数据。本机单用户桌面应用 + 只听
 * 127.0.0.1 所以目前不是问题，改多用户必须挪进请求作用域。
 *
 * ⚠️ multer 先用**随机临时名**落盘，确认 `date` 合法后才 `renameSync` 成最终名 —— 顺序反了的话，
 * 一个非法 `date` 会在洗之前就被当成路径用掉。
 *
 * @param {object} httpApp Express app。
 * @param {object} options 依赖。
 * @param {Function} options.getSitDb 取坐垫历史库句柄（现调，因为切换型号会换库）。
 * @param {string} options.imgPath 上传图片的落盘目录。
 * @param {string} options.pdfPath PDF 输出目录。
 * @param {object} options.logger 日志器。
 * @returns {{getPdfFrameCount: Function}} 供诊断用的当前缓存帧数。
 */
function registerReportRoutes(httpApp, {
  getSitDb,
  imgPath,
  pdfPath,
  logger,
}) {
  let pdfArrData = [];

  const multerStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, imgPath),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || '');
      const tempName = `${Date.now()}-${Math.floor(Math.random() * 1e9)}${ext}`;
      cb(null, tempName);
    },
  });
  const upload = multer({ storage: multerStorage });

  httpApp.post('/getDbHeatmap', async (req, res) => {
    try {
      const { time } = req.body;
      const selectQuery = 'select * from matrix WHERE date=?';
      const params = [time];
      getSitDb().all(selectQuery, params, async (err, rows) => {
        if (err) {
          logger.error('[getDbHeatmap] db error:', err);
          return res.json(new HttpResult(1, {}, 'db error'));
        }
        if (!rows || rows.length === 0) {
          return res.json(new HttpResult(1, {}, 'no data'));
        }
        const foot = rows.map((row) => JSON.parse(row.data));
        pdfArrData = foot;
        try {
          await warmFootAnalysis();
          const peakFrame = await callPy('get_peak_frame', { sensor_data: foot }, {
            timeoutMs: PY_HEATMAP_TIMEOUT_MS,
          });
          return res.json(new HttpResult(0, peakFrame, 'success'));
        } catch (error) {
          logger.error('[getDbHeatmap] callPy error:', error.message);
          return res.json(new HttpResult(1, {}, 'callPy error'));
        }
      });
    } catch (error) {
      logger.error('[getDbHeatmap] error:', error.message);
      res.json(new HttpResult(1, {}, 'error'));
    }
  });

  httpApp.post('/uploadCanvas', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.json(new HttpResult(1, {}, 'missing file'));
      }
      if (typeof req.body.filename === 'string') req.body.filename = decodeField(req.body.filename);
      if (typeof req.body.collectName === 'string') req.body.collectName = decodeField(req.body.collectName);
      if (typeof req.body.date === 'string') req.body.date = decodeField(req.body.date);
      if (typeof req.body.gender === 'string') req.body.gender = decodeField(req.body.gender);
      logger.info('[uploadCanvas]', { collectName: req.body.collectName, age: req.body.age, gender: req.body.gender });

      const requestedDate =
        (typeof req.body.date === 'string' && req.body.date.trim()) ||
        (typeof req.query.date === 'string' && req.query.date.trim()) ||
        '';
      const sanitizedRequested = sanitizeFilename(requestedDate);
      if (!sanitizedRequested) {
        fs.unlinkSync(req.file.path);
        return res.json(new HttpResult(1, {}, 'missing date'));
      }

      const finalName = `${sanitizedRequested}.png`;
      const newPath = path.join(imgPath, finalName);
      fs.renameSync(req.file.path, newPath);
      req.file.filename = finalName;
      req.file.path = newPath;
      const absolutePath = path.resolve(req.file.path);
      const name = `${pdfPath}/${sanitizedRequested}`;

      logger.info('[uploadCanvas] calling generate_foot_pressure_report1', name);
      await warmFootAnalysis();
      await callPy('generate_foot_pressure_report1', {
        sensor_data: pdfArrData,
        pdf_name: name,
        heatmap_png_path: `${imgPath}/${sanitizedRequested}.png`,
        user_name: req.body.collectName,
        user_age: req.body.age,
        user_gender: req.body.gender,
        user_id: req.body.userId || 9527,
      }, {
        timeoutMs: PY_REPORT_TIMEOUT_MS,
      });

      const pdfFilePath = `${name}.pdf`;
      res.json(new HttpResult(0, { file: req.file, body: req.body, absolutePath, pdfFilePath, pdfDir: pdfPath }, 'success'));
    } catch (error) {
      logger.error('[uploadCanvas] error:', error.message);
      res.json(new HttpResult(1, {}, 'upload failed'));
    }
  });

  return {
    getPdfFrameCount: () => pdfArrData.length,
  };
}

module.exports = {
  registerReportRoutes,
};
