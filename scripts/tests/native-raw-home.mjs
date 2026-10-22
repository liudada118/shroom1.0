import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const requireClient = createRequire(new URL('../../client/package.json', import.meta.url));
const { createServer } = requireClient('vite');

/** 核对缩放后的真实点中心、数字和行列号共用同一坐标变换。 */
async function assertRawProjection(page) {
  const state = await page.evaluate(() => {
    const canvases = [...document.querySelectorAll('.canvasNum canvas')];
    const canvas = canvases[0], overlay = canvases[1];
    return { grid:canvas.getBoundingClientRect().toJSON(), overlay:overlay.getBoundingClientRect().toJSON(),
      width:overlay.width, height:overlay.height, records:overlay.paintRecords,
      points:window.nativeRawHome.com.current.getSelectionTools().getSensorPoints() };
  });
  const {grid, overlay, records, points} = state;
  const columns=32, rows=32;
  assert.equal(points.length, columns*rows);
  for (const index of [0, 1, 16*columns+13, columns*rows-1]) {
    const point=points[index], record=records[index];
    const x=overlay.x+(record.x+record.offsetX)*overlay.width/state.width;
    const y=overlay.y+(record.y+record.offsetY)*overlay.height/state.height;
    assert.ok(Math.abs(point.x-x)<.15 && Math.abs(point.y-y)<.15, '传感点中心与显示数字重合');
    assert.ok(Math.abs(point.x-(grid.x+(index%columns+.5)*grid.width/columns))<.15);
    assert.ok(Math.abs(point.y-(grid.y+(Math.floor(index/columns)+.5)*grid.height/rows))<.15);
  }
  for (const index of [0, 15, 31]) {
    const row=records[columns*rows+index], column=records[columns*rows+rows+index];
    assert.equal(row.text, String(index+1));
    assert.equal(column.text, String(index+1));
    assert.ok(Math.abs(overlay.y+(row.y+row.offsetY)*overlay.height/state.height
      -(grid.y+(index+.5)*grid.height/rows))<.15, '左侧行号随真实格子缩放');
    assert.ok(Math.abs(overlay.x+(column.x+column.offsetX)*overlay.width/state.width
      -(grid.x+(index+.5)*grid.width/columns))<.15, '底部列号随真实格子缩放');
  }
  return state;
}

/** 通过真实鼠标验证滚轮缩放和分析工具互斥，保存的坐标仍是原始格点。 */
async function verifyRawMouseZoom({page, name, stats, screenshots}) {
  const grid=page.locator('.canvasNum canvas').first();
  const before=await grid.boundingBox();
  const calls=await page.evaluate(() => window.nativeRawState().calls);
  await page.mouse.move(before.x+before.width/2, before.y+before.height/2);
  await page.mouse.wheel(0,-180);
  await page.waitForTimeout(100);
  const enlarged=await grid.boundingBox();
  console.log('NATIVE_RAW_WHEEL',name,{before:before.width,after:enlarged.width});
  assert.ok(enlarged.width>before.width*1.05, `${name}鼠标滚轮放大原始数字矩阵`);
  assert.ok(Math.abs(enlarged.width/before.width-1.1)<.001,'一次滚轮只执行一次缩放，不重复注册监听');
  assert.deepEqual((await page.evaluate(() => window.nativeRawState())).stats,stats,'缩放不更改侧栏原始统计');
  assert.deepEqual(await page.evaluate(() => window.nativeRawState().calls),calls,'缩放不重新计算或改写数字');
  await assertRawProjection(page);
  await page.getByRole('button',{name:'工具',exact:true}).click();
  const utility=page.locator('.portal-utility-panel');
  await utility.getByRole('tab',{name:'数据分析',exact:true}).click();
  await utility.getByRole('button',{name:'框选分析',exact:true}).click();
  const x=enlarged.x+10*enlarged.width/32, y=enlarged.y+15*enlarged.height/32;
  await page.mouse.move(x+1,y+1); await page.mouse.down();
  await page.mouse.move(x+2*enlarged.width/32-1,y+3*enlarged.height/32-1,{steps:5}); await page.mouse.up();
  const region=await page.evaluate(() => window.nativeRawHome.com.current.getSelectionTools().getSnapshot().regions[0]);
  assert.ok(region,'缩放后可使用真实鼠标框选');
  assert.deepEqual({x:region.x,y:region.y,width:region.width,height:region.height},{x:10,y:15,width:2,height:3});
  assert.equal(region.stats.selectedPoints,6,'框选不把显示索引当作采样点');
  const selectedBox=await grid.boundingBox();
  await page.mouse.wheel(0,-180); await page.waitForTimeout(80);
  assert.equal((await grid.boundingBox()).width,selectedBox.width,'框选手势期间滚轮不误改视角');
  await utility.getByRole('button',{name:'框选分析',exact:true}).click();
  await utility.getByRole('button',{name:'传感点量尺',exact:true}).click();
  const ruler=page.locator('.portal-screen-ruler');
  await ruler.getByRole('spinbutton',{name:'横向点距（mm）',exact:true}).fill('6');
  await ruler.getByRole('spinbutton',{name:'纵向点距（mm）',exact:true}).fill('8');
  await ruler.getByRole('button',{name:'应用点距',exact:true}).click();
  const a={x:enlarged.x+10.5*enlarged.width/32,y:enlarged.y+16.5*enlarged.height/32};
  const b={x:enlarged.x+13.5*enlarged.width/32,y:enlarged.y+20.5*enlarged.height/32};
  await page.mouse.click(a.x+2,a.y+1); await page.mouse.click(b.x-2,b.y+1);
  await ruler.getByText(`1 · ${Math.hypot(18,32).toFixed(2)} mm`,{exact:true}).waitFor();
  const line=ruler.locator('.portal-ruler-stroke'), origin=await ruler.locator('svg').boundingBox();
  assert.ok(Math.abs(Number(await line.getAttribute('x1'))+origin.x-a.x)<.15);
  assert.ok(Math.abs(Number(await line.getAttribute('y1'))+origin.y-a.y)<.15);
  assert.ok(Math.abs(Number(await line.getAttribute('x2'))+origin.x-b.x)<.15);
  assert.ok(Math.abs(Number(await line.getAttribute('y2'))+origin.y-b.y)<.15);
  await page.mouse.move(b.x,b.y); await page.mouse.wheel(0,-180); await page.waitForTimeout(80);
  assert.equal((await grid.boundingBox()).width,enlarged.width,'测量手势期间滚轮不误改视角');
  await page.screenshot({path:join(screenshots,`${name}-zoomed-ruler.png`)});
  await ruler.getByRole('button',{name:'退出量尺',exact:true}).click();
  await page.getByRole('button',{name:'工具',exact:true}).click();
  await page.mouse.move(enlarged.x+enlarged.width/2,enlarged.y+enlarged.height/2);
  await page.mouse.wheel(0,180); await page.waitForTimeout(100);
  const reduced=await grid.boundingBox();
  assert.ok(reduced.width<enlarged.width*.95,`${name}鼠标滚轮缩小原始数字矩阵`);
  assert.ok(Math.abs(reduced.width-before.width)<.15,'相反滚轮恢复相同比例');
  await assertRawProjection(page);
  await page.mouse.move(reduced.x+reduced.width/2,reduced.y+reduced.height/2);
  await page.mouse.down();
  await page.mouse.move(reduced.x+reduced.width/2+31,reduced.y+reduced.height/2+19,{steps:5});
  await page.mouse.up();
  const panned=await grid.boundingBox();
  assert.ok(Math.abs(panned.x-reduced.x-31)<.15 && Math.abs(panned.y-reduced.y-19)<.15,'左键拖动平移完整数字与索引');
  await assertRawProjection(page);
  if (name === 'hand') {
    await page.setViewportSize({width:1440,height:900});
    await page.waitForFunction((width) => {
      const nodes=document.querySelectorAll('.canvasNum canvas');
      return nodes[0].getBoundingClientRect().width<width && nodes[1].paintRecords?.length===1088;
    }, panned.width);
    await assertRawProjection(page);
    assert.deepEqual((await page.evaluate(() => window.nativeRawState())).stats,stats,'窗口重排保留原始数据统计');
    await page.setViewportSize({width:1600,height:1000});
    await page.waitForFunction((width) => Math.abs(document.querySelector('.canvasNum canvas').getBoundingClientRect().width-width)<.15,panned.width);
    await assertRawProjection(page);
  }
  const restored=await grid.boundingBox();
  await page.mouse.move(restored.x+restored.width/2,restored.y+restored.height/2);
  await page.mouse.wheel(0,-180); await page.waitForTimeout(80);
  assert.ok(Math.abs((await grid.boundingBox()).width/before.width-1.1)<.001,'窗口变化后滚轮仍只注册一次');
  // 故意保留缩放和平移，下一系统必须按自己的初始布局挂载。
  return {before:before.width,after:enlarged.width};
}

const server = await createServer({
  root: fileURLToPath(new URL('../../client/', import.meta.url)),
  server: { host: '127.0.0.1', port: 0, open: false, hmr:false },
  plugins: [{
    name: 'native-raw-home-test',
    enforce: 'pre',
    /** 只为夹具暴露真实 Home 类；不替换生产生命周期、路由或帧处理。 */
    transform(code, id) {
      if (id.replaceAll('\\', '/').endsWith('/src/page/home/Home.jsx')) {
        return `${code}\nexport { Home as NativeRawHomeTest };`;
      }
    },
    /** 页面运行真实 Home、RendererHost、共享矩阵与 Aside，不接真实设备。 */
    configureServer(vite) {
      vite.middlewares.use('/__native-raw-home', async (_req, res) => {
        res.setHeader('Content-Type', 'text/html');
        res.end(await vite.transformIndexHtml('/__native-raw-home', `<!doctype html><html><head>
          <meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0}</style>
          </head><body><div id="root"></div><script type="module">
          import React from 'react';
          import { createRoot } from 'react-dom/client';
          import { HashRouter } from 'react-router-dom';
          import '@ant-design/v5-patch-for-react-19';
          import i18next from '/src/i18n';
          import '/src/App.css';
          import '/src/page/licensePortal/FiberPortal.css';
          import '/src/page/licensePortal/PortalMonitoring.css';
          import { NativeRawHomeTest } from '/src/page/home/Home.jsx';
          const fillText = CanvasRenderingContext2D.prototype.fillText;
          const clearRect = CanvasRenderingContext2D.prototype.clearRect;
          CanvasRenderingContext2D.prototype.clearRect = function(...args) {
            this.canvas.paintRecords=[];
            return clearRect.apply(this,args);
          };
          CanvasRenderingContext2D.prototype.fillText = function(...args) {
            (this.canvas.paintCalls ||= []).push(args);
            const transform=this.getTransform();
            (this.canvas.paintRecords ||= []).push({text:String(args[0]),x:args[1],y:args[2],offsetX:transform.e,offsetY:transform.f});
            return fillText.apply(this, args);
          };
          localStorage.setItem('file', 'hand');
          localStorage.setItem('allowedTypes', JSON.stringify(['hand','jqbed','smallBed','smallBedNoAlg','smallBed12B']));
          /** 持有真实工具宿主，使常驻设置走正式 createPortal 分支。 */
          function Fixture() {
            const [host, setHost] = React.useState(null);
            return React.createElement(HashRouter, null, React.createElement('div', {className:'fiber-portal'},
              React.createElement('div', {className:'portal-runtime-monitor'},
                React.createElement('div', {ref:setHost}), host && React.createElement(NativeRawHomeTest,
                  {ref:(instance) => { window.nativeRawHome = instance; }, t:i18next.t.bind(i18next), i18n:i18next,
                    portalEmbedded:true, portalToolsHost:host }))));
          }
          createRoot(document.getElementById('root')).render(React.createElement(Fixture));
          /** 读取实际叠加层文字、采样投影与侧栏最终状态。 */
          window.nativeRawState = () => {
            const canvases = [...document.querySelectorAll('.canvasNum canvas')];
            return { calls:canvases[1]?.paintCalls || [], width:canvases[0]?.width, height:canvases[0]?.height,
              points:window.nativeRawHome?.com.current?.getSelectionTools?.()?.getGridSize?.(),
              stats:window.nativeRawStats, home:window.nativeRawHome && {
                name:window.nativeRawHome.state.matrixName, width:window.nativeRawHome.state.smallBedMatrixWidth,
                height:window.nativeRawHome.state.smallBedMatrixHeight } };
          };
          </script></body></html>`));
      });
    },
  }],
});
const screenshots = await mkdtemp(join(tmpdir(), 'shroom-native-raw-home-'));
let browser;
let page;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  page.setDefaultTimeout(20000);
  const errors = [];
  const sockets = new Set();
  page.on('pageerror', (error) => { errors.push(error.message); console.error('PAGE_ERROR', error.stack); });
  await page.routeWebSocket(/:19999/, (socket) => {
    sockets.add(socket);
    socket.onClose(() => sockets.delete(socket));
    socket.send(JSON.stringify({ selectFlag:'all', licenseKey:'fixture-key', date:Date.now()+86400000*30, nowDate:Date.now() }));
  });
  await page.route('http://127.0.0.1:19245/**', (route) => route.fulfill({
    headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type'},
    json:route.request().url().endsWith('/api/algorithm-market')
      ? {packages:[],instances:[],channels:[],configuredAlgorithms:[],allowed:true,reason:''}
      : {code:0,data:{ok:true,data:{}},displaySystems:{runtimeDefinitions:[]}},
  }));
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__native-raw-home`);
  await page.waitForFunction(() => window.nativeRawHome?.com.current?.sitData && window.nativeRawHome?.data.current);
  for (const name of ['hand', 'jqbed', 'smallBedNoAlg', 'smallBed12B']) {
    console.log('NATIVE_RAW_HOME_CHECK', name);
    await page.evaluate(async (sensorType) => {
      localStorage.setItem('file', sensorType);
      await new Promise((resolve) => window.nativeRawHome.setState({matrixName:sensorType,systemId:sensorType,numMatrixFlag:'numoriginal',local:false}, resolve));
    }, name);
    await page.waitForFunction(() => document.querySelector('.canvasNum canvas') && window.nativeRawHome.com.current?.changeWsDataRaw);
    await page.evaluate(() => {
      const sidebar = window.nativeRawHome.data.current, change = sidebar.changeData;
      sidebar.changeData = function (values) { window.nativeRawStats = {...values}; return change.call(this, values); };
    });
    const frame = new Array(1024).fill(0);
    frame[1] = name === 'smallBed12B' ? 12.3 : 23;
    frame[32 + 2] = name === 'smallBed12B' ? 25.1 : 97;
    for (const socket of sockets) socket.send(JSON.stringify({
      type:'sensor.frame',schemaVersion:1,channelId:name+':sit',displaySystemId:name,sensorId:'sit',
      sensorLabel:'测试压力',outputChannel:'sit',sensorType:name,source:'realtime',sequence:1,timestamp:Date.now(),
      quality:'good',payload:{value:frame,matrix:{rows:32,cols:32,total:1024}},
    }));
    await page.waitForFunction(() => window.nativeRawState().calls.length >= 1088 && window.nativeRawState().stats?.point === 2);
    const state = await page.evaluate(() => window.nativeRawState());
    const transposed = name !== 'hand';
    assert.equal(state.calls[transposed ? 32 : 1][0], name === 'smallBed12B' ? '12.3' : '23', `${name}正确方向和数值`);
    assert.equal(state.calls[transposed ? 2 * 32 + 1 : 32 + 2][0], name === 'smallBed12B' ? '25.1' : '97');
    assert.equal(state.stats.totalPres, name === 'smallBed12B' ? 25.1 : 120, `${name}侧栏原始统计`);
    assert.equal(state.calls.at(-1)[0], '32');
    if (name === 'hand' || name === 'jqbed') {
      await verifyRawMouseZoom({page,name,stats:state.stats,screenshots});
    }
    await page.screenshot({path:join(screenshots, `${name}-raw.png`)});
    if (name === 'jqbed') {
      const settings = page.locator('.portal-bed-settings');
      await settings.waitFor();
      await settings.click();
      await page.getByRole('dialog').filter({hasText:'算法配置'}).waitFor();
      await page.getByRole('button', {name:'Close', exact:true}).click();
    }
  }
  for (const size of [16, 32]) {
    await page.evaluate(() => { window.nativeRawStats = null; });
    const frame = new Array(size * size).fill(0); frame[size + 2] = 12.3;
    for (const socket of sockets) socket.send(JSON.stringify({type:'sensor.frame',schemaVersion:1,
        channelId:'smallBed12B:sit',displaySystemId:'smallBed12B',sensorId:'sit',sensorLabel:'12B测试',
        outputChannel:'sit',sensorType:'smallBed12B',source:'realtime',sequence:size,timestamp:Date.now(),quality:'good',
        payload:{value:frame,matrix:{rows:size,cols:size,total:size*size}},
    }));
    await page.waitForFunction((size) => {
      const state=window.nativeRawState();
      return state.home.width===size && state.calls.length === size*size+size*2
        && state.calls.some(([value]) => value==='12.3') && state.stats?.point===1;
    }, size);
    const state = await page.evaluate(() => window.nativeRawState());
    assert.equal(state.calls[2 * size + 1][0], '12.3', '未标注的canonical帧沿用一次转置');
    assert.equal(state.stats.totalPres, 12.3, '只发送一个变尺寸帧即可恢复正确统计');
    await page.screenshot({path:join(screenshots, `smallBed12B-single-frame-${size}.png`)});
    if (size === 16) {
      await page.evaluate(() => { window.nativeRawCanvas = document.querySelector('.canvasNum canvas'); });
      for (const socket of sockets) socket.send(JSON.stringify({ hz:17 }));
      await page.waitForFunction(() => window.nativeRawHome.state.hz === 17);
      assert.equal((await page.evaluate(() => window.nativeRawState())).home.width, 16, '无尺寸状态包不能重置16行列');
      assert.equal(await page.evaluate(() => window.nativeRawCanvas === document.querySelector('.canvasNum canvas')), true,
        '普通控制包不重建原始矩阵');
    }
  }
  assert.deepEqual(errors, []);
  console.log(`NATIVE_RAW_HOME_PASS screenshots=${screenshots}`);
} catch (error) {
  console.error('NATIVE_RAW_HOME_FAILURE', screenshots, error);
  if (page) {
    await page.screenshot({path:join(screenshots,'failure.png')}).catch(() => {});
    console.error('NATIVE_RAW_HOME_STATE', await page.evaluate(() => window.nativeRawState?.()).catch(() => null));
  }
  throw error;
} finally {
  await browser?.close();
  await server.close();
}
