import { isPressureFrame, type FrameSource, type PressureFrame } from './pressureContract.ts';

type Injector = (script: string) => void;

/** 给离线页面生成 JSON 调用；入口只接收已校验消息。 */
function injectionFor(message: unknown): string {
  return `window.ShroomMobile && window.ShroomMobile.receive(${JSON.stringify(message)});true;`;
}

/** 向 WebView 发送最新压力帧，最多一帧在途、一帧待发，避免慢画布积压。 */
export class FrameDispatcher {
  private ready = false;
  private activeSource: FrameSource | null = null;
  private latest: PressureFrame | null = null;
  private waitingSequence: number | null = null;
  private sequence = 0;
  private lastNativeSequence = -1;
  private lastSent: PressureFrame | null = null;
  private readonly inject: Injector;

  /** 注入函数由 RN WebView 宿主提供。 */
  constructor(inject: Injector) { this.inject = inject; }

  /** WebView 开始重载时暂存最近帧；加载完成前不注入脚本。 */
  setNotReady(): void {
    this.ready = false;
    this.waitingSequence = null;
    this.latest = this.latest ?? this.lastSent;
  }

  /** 页面初始化后恢复当前来源并补发最近帧。 */
  setReady(): void {
    if (this.ready) return;
    this.ready = true;
    this.waitingSequence = null;
    this.inject(injectionFor({ type: 'stream.reset', version: 1, source: this.activeSource }));
    this.flush();
  }

  /** 切源或停止时清除上轮待发数据；序号保持全局递增，旧回执不能推进新流。 */
  reset(source: FrameSource | null): void {
    this.activeSource = source;
    this.latest = null;
    this.lastSent = null;
    this.lastNativeSequence = -1;
    this.waitingSequence = null;
    if (this.ready) this.inject(injectionFor({ type: 'stream.reset', version: 1, source }));
  }

  /** 校验来源与原生序号，保留最新帧；拒绝非法帧和上轮迟到事件。 */
  publish(frame: unknown): boolean {
    if (!isPressureFrame(frame) || frame.source !== this.activeSource) return false;
    if (frame.sequence <= this.lastNativeSequence) return false;
    this.lastNativeSequence = frame.sequence;
    this.latest = { ...frame, sequence: ++this.sequence };
    this.flush();
    return true;
  }

  /** 只接受当前在途帧的页面回执，接着发布最新待发帧。 */
  acknowledge(sequence: unknown): boolean {
    if (this.waitingSequence === null || sequence !== this.waitingSequence) return false;
    this.waitingSequence = null;
    this.flush();
    return true;
  }

  /** 未收到回执时保持有界等待；页面 ready 或重载会恢复发送。 */
  private flush(): void {
    if (!this.ready || this.waitingSequence !== null || !this.latest) return;
    const frame = this.latest;
    this.latest = null;
    this.lastSent = frame;
    this.waitingSequence = frame.sequence;
    this.inject(injectionFor(frame));
  }
}
