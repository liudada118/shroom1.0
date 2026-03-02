const { app, BrowserWindow } = require('electron')
const http = require("http");
const fs = require("fs");
var os = require('os');
const path = require("path");
const { openServer } = require('./server');
const hostname = "127.0.0.1";
const port = 12321;
const onlineHost = 'http://sensor.bodyta.com/xyTest/'
const offlineHost = 'http://127.0.0.1:12321'
const defaultDevServerUrl = 'http://127.0.0.1:3000'
const devServerUrl = process.env.ELECTRON_START_URL || process.env.FRONTEND_DEV_URL

function hasLocalBuild() {
    const buildIndexPath = path.join(__dirname, "build", "index.html");
    return fs.existsSync(buildIndexPath);
}

function shouldUseDevServer() {
    if (app.isPackaged) return false;
    return Boolean(devServerUrl);
}
const createWindow = () => {
    const win = new BrowserWindow({
        show: false,
        // width: 800,
        // height: 600,
        // fullscreen: true, // 设置全屏模式
        icon: path.join(__dirname, 'logo.ico') // 设置ico
    })
    win.maximize()
    // win.loadFile('./index.html')

    openServer()

    if (shouldUseDevServer()) {
        openWebOnline({ hostname: devServerUrl || defaultDevServerUrl, win })
    } else {
        openWeb({ hostname, port, win });
    }

    // openWebOnline({ hostname: onlineHost , win })

}

function openWeb({ hostname, port, win }) {
    const server = http.createServer((req, res) => {

        let pathName = __dirname

        if (app.isPackaged) {
          if (os.platform() == 'darwin') {
           
          } else {
            pathName = 'resources' 
        
          }
        
        }

    

        if (req.url === "/") {
            // 读取打包后的 index.html 文件
            const filePath = path.join(pathName, "build", "index.html");
            fs.readFile(filePath, (err, data) => {
                if (err) {
                    res.statusCode = 500;
                    res.setHeader("Content-Type", "text/plain");
                    res.end(`Frontend build not found: ${filePath}. Run "npm run dev" for hot reload or build the frontend first.`);
                } else {
                    // 设置响应头和内容，发送网页文件
                    res.statusCode = 200;
                    res.setHeader("Content-Type", "text/html");
                    res.end(data);
                }
            });
        } else {
            // 处理其他请求（如样式表、脚本、图片等）
            const filePath = path.join(pathName, "build", req.url);
            fs.readFile(filePath, (err, data) => {
                if (err) {
                    res.statusCode = 404;
                    res.setHeader("Content-Type", "text/plain");
                    res.end("Not Found");
                } else {
                    res.statusCode = 200;
                    res.setHeader("Content-Type", getContentType(filePath));
                    res.end(data);
                }
            });
        }
    });

    server.listen(port, hostname, () => {
        const url = `http://${hostname}:${port}`;
        console.log(`Server running at http://${hostname}:${port}/`);
        // exec(`start chrome "${url}"`, (err, stdout, stderr) => {
        //     if (err) {
        //         console.error(`exec error: ${err}`);
        //         return;
        //     }
        //     console.log(`stdout: ${stdout}`);
        //     console.error(`stderr: ${stderr}`);
        // });
        win.loadURL(`http://${hostname}:${port}`)
    });

    function getContentType(filePath) {
        const extname = path.extname(filePath);
        switch (extname) {
            case ".html":
                return "text/html";
            case ".css":
                return "text/css";
            case ".js":
                return "text/javascript";
            case ".png":
                return "image/png";
            case ".jpg":
                return "image/jpg";
            default:
                return "text/plain";
        }
    }
}

function openWebOnline({ hostname, port, win }) {
    // win.loadURL(`http://sensor.bodyta.com/jqHzCol/`)
    // win.loadURL('http://sensor.bodyta.com/256press')
    //http://localhost:3000/
    // win.loadURL('http://localhost:3000/')
    win.loadURL(hostname)
}


app.whenReady().then(() => {
    createWindow()

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})
