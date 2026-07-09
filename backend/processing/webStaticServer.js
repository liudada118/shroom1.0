const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const logger = require('../common/logger');

const PROJECT_ROOT = path.resolve(__dirname, '../..');

/**
 * 根据静态资源后缀返回响应 Content-Type。
 *
 * @param {string} filePath 静态资源路径。
 * @returns {string} HTTP Content-Type。
 */
function getContentType(filePath) {
  const extname = path.extname(filePath);
  switch (extname) {
    case '.html':
      return 'text/html';
    case '.css':
      return 'text/css';
    case '.js':
      return 'text/javascript';
    case '.png':
      return 'image/png';
    case '.jpg':
      return 'image/jpg';
    default:
      return 'text/plain';
  }
}

/**
 * 打开打包后的前端静态页面。
 *
 * 该函数从旧 openWeb.js 迁出，保持原有行为：监听指定 host/port，根路径返回
 * build/index.html，其它路径从 build 目录读取静态资源，并在启动后尝试打开 Chrome。
 *
 * @param {object} options 启动参数。
 * @param {string} options.hostname 监听主机名。
 * @param {number} options.port 监听端口。
 */
function openWeb({ hostname, port }) {
  const server = http.createServer((req, res) => {
    if (req.url === '/') {
      const filePath = path.join(PROJECT_ROOT, 'build', 'index.html');
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'text/plain');
          res.end('Internal Server Error');
          return;
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html');
        res.end(data);
      });
      return;
    }

    const filePath = path.join(PROJECT_ROOT, 'build', req.url);
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/plain');
        res.end('Not Found');
        return;
      }

      res.statusCode = 200;
      res.setHeader('Content-Type', getContentType(filePath));
      res.end(data);
    });
  });

  server.listen(port, hostname, () => {
    const url = `http://${hostname}:${port}`;
    logger.debug(`Server running at http://${hostname}:${port}/`);
    exec(`start chrome "${url}"`, (err, stdout, stderr) => {
      if (err) {
        logger.error(`exec error: ${err}`);
        return;
      }
      logger.debug(`stdout: ${stdout}`);
      logger.error(`stderr: ${stderr}`);
    });
  });
}

module.exports = {
  getContentType,
  openWeb,
};
