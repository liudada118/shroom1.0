/**
 * BrushManager — 框选区域单例管理器
 *
 * 功能：
 *   - 拖拽创建框选（mousedown → mousemove → mouseup）
 *   - 拖动整个框（Move）
 *   - 8 方向缩放手柄（nw/n/ne/e/se/s/sw/w）
 *   - 右上角删除按钮
 *   - 键盘方向键微调（每次 1px）
 *   - 订阅/取消订阅通知机制
 *
 * 使用方式：
 *   import brushManager from './BrushManager';
 *   brushManager.subscribe(cb);          // 订阅框选变化
 *   brushManager.startBrush(container);  // 开始框选（传入挂载容器 DOM）
 *   brushManager.stopBrush();            // 停止框选，清除所有框和事件
 *   brushManager.unsubscribe(cb);        // 取消订阅
 *
 * 通知格式：cb(rangeArr)
 *   rangeArr = [] 表示无框选
 *   rangeArr = [{ x1, y1, x2, y2 }] 表示当前框选区域（页面坐标）
 */

import { jet } from '../../assets/util/util';

class BrushManager {
  constructor() {
    this._subscribers = [];
    this._container = null;   // 挂载容器
    this._box = null;         // 当前框选 div
    this.rangeArr = [];       // 当前框选范围 [{ x1, y1, x2, y2 }]

    // 创建阶段临时状态
    this._creating = false;
    this._createStart = { x: 0, y: 0 };

    // 拖动整体
    this._dragging = false;
    this._dragStart = { x: 0, y: 0 };
    this._boxStart = { x: 0, y: 0 };

    // 缩放
    this._resizing = false;
    this._resizeDir = '';
    this._resizeStart = { x: 0, y: 0 };
    this._resizeBoxStart = { x: 0, y: 0, w: 0, h: 0 };

    // 绑定全局事件（只绑定一次）
    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);

    this._active = false;
  }

  // ─── 订阅 / 取消订阅 ────────────────────────────────────────────────────────
  subscribe(cb) {
    if (!this._subscribers.includes(cb)) {
      this._subscribers.push(cb);
    }
  }

  unsubscribe(cb) {
    this._subscribers = this._subscribers.filter(fn => fn !== cb);
  }

  notify(rangeArr) {
    this._subscribers.forEach(fn => fn(rangeArr));
  }

  // ─── 启动 / 停止 ─────────────────────────────────────────────────────────────
  startBrush(container) {
    if (this._active) this.stopBrush();
    this._container = container || document.body;
    this._active = true;
    document.addEventListener('mousedown', this._onMouseDown);
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('mouseup', this._onMouseUp);
    document.addEventListener('keydown', this._onKeyDown);
  }

  stopBrush() {
    this._active = false;
    document.removeEventListener('mousedown', this._onMouseDown);
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('mouseup', this._onMouseUp);
    document.removeEventListener('keydown', this._onKeyDown);
    this._removeBox();
    this.rangeArr = [];
    this.notify([]);
  }

  // ─── 删除框选 ────────────────────────────────────────────────────────────────
  deleteSelect() {
    this._removeBox();
    this.rangeArr = [];
    this.notify([]);
  }

  _removeBox() {
    if (this._box && this._box.parentElement) {
      this._box.parentElement.removeChild(this._box);
    }
    this._box = null;
  }

  // ─── 鼠标按下 ────────────────────────────────────────────────────────────────
  _onMouseDown(e) {
    if (!this._active) return;
    // 如果点击的是框选内部的子控件（手柄/删除按钮），由各自处理
    if (this._box && this._box.contains(e.target)) return;

    // 在空白区域按下 → 开始创建新框
    if (this._container && !this._container.contains(e.target)) return;
    this._creating = true;
    this._createStart = { x: e.clientX, y: e.clientY };
    // 先删除旧框
    this._removeBox();
    this.rangeArr = [];
  }

  // ─── 鼠标移动 ────────────────────────────────────────────────────────────────
  _onMouseMove(e) {
    if (!this._active) return;

    if (this._creating) {
      const x1 = Math.min(this._createStart.x, e.clientX);
      const y1 = Math.min(this._createStart.y, e.clientY);
      const x2 = Math.max(this._createStart.x, e.clientX);
      const y2 = Math.max(this._createStart.y, e.clientY);
      const w = x2 - x1;
      const h = y2 - y1;

      if (!this._box && (w > 2 || h > 2)) {
        this._box = this._createBoxEl();
        this._container.appendChild(this._box);
      }
      if (this._box) {
        this._applyBoxStyle(x1, y1, w, h);
        // 用 jet 颜色函数设置背景色（半透明 0.6），以宽度为参数示例
        const rgb = jet(0, 600, w + h);
        this._box.style.background = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.25)`;
        this._box.style.borderColor = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.9)`;
      }
      return;
    }

    if (this._dragging && this._box) {
      const dx = e.clientX - this._dragStart.x;
      const dy = e.clientY - this._dragStart.y;
      const newX = this._boxStart.x + dx;
      const newY = this._boxStart.y + dy;
      this._box.style.left = newX + 'px';
      this._box.style.top = newY + 'px';
      this._updateRange();
      return;
    }

    if (this._resizing && this._box) {
      this._doResize(e.clientX, e.clientY);
      return;
    }
  }

  // ─── 鼠标松开 ────────────────────────────────────────────────────────────────
  _onMouseUp(e) {
    if (!this._active) return;

    if (this._creating) {
      this._creating = false;
      if (this._box) {
        const w = parseInt(this._box.style.width);
        const h = parseInt(this._box.style.height);
        if (w > 5 && h > 5) {
          this._makeInteractive();
          this._updateRange();
          this.notify(this.rangeArr);
        } else {
          this._removeBox();
          this.rangeArr = [];
          this.notify([]);
        }
      }
      return;
    }

    if (this._dragging) {
      this._dragging = false;
      this._updateRange();
      this.notify(this.rangeArr);
      return;
    }

    if (this._resizing) {
      this._resizing = false;
      this._updateRange();
      this.notify(this.rangeArr);
      return;
    }
  }

  // ─── 键盘微调 ────────────────────────────────────────────────────────────────
  _onKeyDown(e) {
    if (!this._box || !this._active) return;
    const DIRS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    const delta = DIRS[e.key];
    if (!delta) return;
    e.preventDefault();
    const x = parseInt(this._box.style.left) + delta[0];
    const y = parseInt(this._box.style.top) + delta[1];
    this._box.style.left = x + 'px';
    this._box.style.top = y + 'px';
    this._updateRange();
    this.notify(this.rangeArr);
  }

  // ─── 创建框元素 ──────────────────────────────────────────────────────────────
  _createBoxEl() {
    const box = document.createElement('div');
    box.className = 'brushSelectBox';
    box.style.cssText = `
      position: fixed;
      border: 2px solid rgba(100,180,255,0.9);
      background: rgba(100,180,255,0.15);
      pointer-events: auto;
      box-sizing: border-box;
      z-index: 9999;
      cursor: move;
    `;
    return box;
  }

  _applyBoxStyle(x, y, w, h) {
    this._box.style.left = x + 'px';
    this._box.style.top = y + 'px';
    this._box.style.width = w + 'px';
    this._box.style.height = h + 'px';
  }

  // ─── 添加交互控件（拖动 + 8 个手柄 + 删除按钮）────────────────────────────
  _makeInteractive() {
    const box = this._box;

    // 拖动整体
    box.addEventListener('mousedown', (e) => {
      if (e.target !== box) return; // 只响应框本身，不响应子控件
      e.stopPropagation();
      this._dragging = true;
      this._dragStart = { x: e.clientX, y: e.clientY };
      this._boxStart = { x: parseInt(box.style.left), y: parseInt(box.style.top) };
    });

    // 8 个缩放手柄
    const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
    HANDLES.forEach(dir => {
      const h = document.createElement('div');
      h.dataset.dir = dir;
      h.style.cssText = this._handleStyle(dir);
      h.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        this._resizing = true;
        this._resizeDir = dir;
        this._resizeStart = { x: e.clientX, y: e.clientY };
        this._resizeBoxStart = {
          x: parseInt(box.style.left),
          y: parseInt(box.style.top),
          w: parseInt(box.style.width),
          h: parseInt(box.style.height),
        };
      });
      box.appendChild(h);
    });

    // 删除按钮
    const del = document.createElement('div');
    del.innerHTML = '×';
    del.style.cssText = `
      position: absolute;
      top: -10px;
      right: -10px;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #e74c3c;
      color: #fff;
      font-size: 14px;
      line-height: 20px;
      text-align: center;
      cursor: pointer;
      z-index: 10001;
      user-select: none;
    `;
    del.addEventListener('mousedown', (e) => { e.stopPropagation(); });
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      this.deleteSelect();
    });
    box.appendChild(del);
  }

  // ─── 手柄样式 ────────────────────────────────────────────────────────────────
  _handleStyle(dir) {
    const SIZE = 8;
    const HALF = SIZE / 2;
    const base = `
      position: absolute;
      width: ${SIZE}px;
      height: ${SIZE}px;
      background: #fff;
      border: 1.5px solid #e74c3c;
      box-sizing: border-box;
      z-index: 10000;
    `;
    const cursors = {
      nw: 'nw-resize', n: 'n-resize', ne: 'ne-resize',
      e: 'e-resize', se: 'se-resize', s: 's-resize',
      sw: 'sw-resize', w: 'w-resize',
    };
    const positions = {
      nw: `top:-${HALF}px;left:-${HALF}px;`,
      n:  `top:-${HALF}px;left:calc(50% - ${HALF}px);`,
      ne: `top:-${HALF}px;right:-${HALF}px;`,
      e:  `top:calc(50% - ${HALF}px);right:-${HALF}px;`,
      se: `bottom:-${HALF}px;right:-${HALF}px;`,
      s:  `bottom:-${HALF}px;left:calc(50% - ${HALF}px);`,
      sw: `bottom:-${HALF}px;left:-${HALF}px;`,
      w:  `top:calc(50% - ${HALF}px);left:-${HALF}px;`,
    };
    return base + `cursor:${cursors[dir]};` + positions[dir];
  }

  // ─── 缩放逻辑 ────────────────────────────────────────────────────────────────
  _doResize(mx, my) {
    const MIN = 10;
    const { x: bx, y: by, w: bw, h: bh } = this._resizeBoxStart;
    const dx = mx - this._resizeStart.x;
    const dy = my - this._resizeStart.y;
    let nx = bx, ny = by, nw = bw, nh = bh;

    const dir = this._resizeDir;
    if (dir.includes('e')) nw = Math.max(MIN, bw + dx);
    if (dir.includes('s')) nh = Math.max(MIN, bh + dy);
    if (dir.includes('w')) { nw = Math.max(MIN, bw - dx); nx = bx + bw - nw; }
    if (dir.includes('n')) { nh = Math.max(MIN, bh - dy); ny = by + bh - nh; }

    this._box.style.left = nx + 'px';
    this._box.style.top = ny + 'px';
    this._box.style.width = nw + 'px';
    this._box.style.height = nh + 'px';
    this._updateRange();
  }

  // ─── 更新 rangeArr ───────────────────────────────────────────────────────────
  _updateRange() {
    if (!this._box) { this.rangeArr = []; return; }
    const rect = this._box.getBoundingClientRect();
    this.rangeArr = [{ x1: rect.left, y1: rect.top, x2: rect.right, y2: rect.bottom }];
  }

  // ─── 获取当前框的 DOM 矩形（供外部计算传感器索引使用）────────────────────
  getBoxRect() {
    if (!this._box) return null;
    return this._box.getBoundingClientRect();
  }
}

// 单例导出
const brushManager = new BrushManager();
export default brushManager;
