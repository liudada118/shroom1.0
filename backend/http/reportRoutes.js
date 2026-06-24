const fs = require('fs');
const path = require('path');
const multer = require('multer');
const HttpResult = require('../common/HttpResult');
const { callPy, warmFootAnalysis } = require('../python/pyWorker');

const PY_HEATMAP_TIMEOUT_MS = 60000;
const PY_REPORT_TIMEOUT_MS = 120000;

function sanitizeFilename(name) {
  if (typeof name !== 'string') return '';
  let safe = name.trim();
  safe = safe.replace(/[\\/]/g, '');
  safe = safe.replace(/[\x00-\x1F<>:"|?*]/g, '');
  safe = safe.replace(/[.\s]+$/g, '');
  return safe;
}

function fixMojibake(value) {
  if (typeof value !== 'string') return value;
  try {
    const buf = Buffer.from(value, 'latin1');
    const utf = buf.toString('utf8');
    if (Buffer.from(utf, 'utf8').equals(buf)) return utf;
  } catch {}
  return value;
}

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

function decodeField(value) {
  return decodeMaybeUri(fixMojibake(value));
}

/**
 * 注册 OneStep 报告相关 HTTP 路由。
 *
 * 这里集中处理历史热力图查询、canvas 图片上传和 PDF 报告生成，
 * 避免主 server.js 持有 report 业务细节。
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
