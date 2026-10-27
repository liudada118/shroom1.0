import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readCollectionSummary } from '../../services/collectionStatus';

const { parse } = createRequire(import.meta.url)('@babel/parser');
const source = readFileSync(new URL('./Home.jsx', import.meta.url), 'utf8');
const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
const home = ast.program.body.find(node => node.type === 'ClassDeclaration' && node.id.name === 'Home');

/** 运行真实Home采集方法，避免加载与秒表无关的全部模型与设备依赖。 */
function createHome(finishCollectionBeforeExit = vi.fn().mockResolvedValue(null)) {
  const names = ['setColValueFlag', 'applyCollectionSummary', 'startCollectionTimer', 'stopCollectionTimer', 'preparePortalExit'];
  const methods = home.body.body.filter(node => names.includes(node.key?.name)).map(node => source.slice(node.start, node.end));
  const instance = vm.runInNewContext(`new (class { ${methods.join('\n')} })()`, {
    readCollectionSummary, finishCollectionBeforeExit, Date, setInterval, clearInterval, DOMException, Promise,
  });
  instance.state = { colFlag: true, matrixName: 'humanBodyOptimized', collectionSummary: null };
  instance.title = { current: { changeNum: vi.fn() } };
  instance.setState = (patch, done) => { Object.assign(instance.state, patch); done?.(); };
  return instance;
}

/** 生成带宿主时钟的当前会话回执。 */
function summary(phase, updates = {}) {
  return { id: 'capture-a', phase, result: phase === 'collecting' ? 'pending' : 'saved',
    startedAt: 100000, channels: {}, ...updates };
}

describe('Home采集状态与秒表', () => {
  afterEach(() => vi.useRealTimers());

  it('重进监测页恢复后台已采时长，不与已卸载实例共享开关和定时器', () => {
    vi.useFakeTimers(); vi.setSystemTime(110000);
    const oldHome = createHome();
    oldHome.applyCollectionSummary(summary('collecting'));
    expect(oldHome.title.current.changeNum).toHaveBeenLastCalledWith(10);
    oldHome.stopCollectionTimer();
    const reentered = createHome();
    reentered.applyCollectionSummary(summary('collecting'));
    expect(reentered.title.current.changeNum).toHaveBeenLastCalledWith(10);
    vi.advanceTimersByTime(2000);
    expect(reentered.title.current.changeNum).toHaveBeenLastCalledWith(12);
    expect(oldHome.title.current.changeNum).toHaveBeenLastCalledWith(10);
    reentered.stopCollectionTimer();
  });

  it('串口中断保存回执立即停止并冻结在宿主 stoppedAt，重复广播不继续计时', () => {
    vi.useFakeTimers(); vi.setSystemTime(110000);
    const instance = createHome();
    instance.applyCollectionSummary(summary('collecting'));
    vi.advanceTimersByTime(3000);
    instance.applyCollectionSummary(summary('interrupted', { stoppedAt: 112500, completedAt: 113000 }));
    expect(instance.state.colFlag).toBe(true);
    expect(instance.title.current.changeNum).toHaveBeenLastCalledWith(12);
    vi.advanceTimersByTime(9000);
    instance.applyCollectionSummary(summary('interrupted', { stoppedAt: 112500, completedAt: 113000 }));
    expect(instance.title.current.changeNum).toHaveBeenLastCalledWith(12);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('collecting重复快照不重置秒表，下一条会话使用新的起点', () => {
    vi.useFakeTimers(); vi.setSystemTime(110000);
    const instance = createHome();
    instance.applyCollectionSummary(summary('collecting'));
    vi.advanceTimersByTime(2000);
    const callsBeforeSnapshot = instance.title.current.changeNum.mock.calls.length;
    instance.applyCollectionSummary(summary('collecting'));
    expect(vi.getTimerCount()).toBe(1);
    expect(instance.title.current.changeNum.mock.calls.length).toBe(callsBeforeSnapshot);
    expect(instance.title.current.changeNum).toHaveBeenLastCalledWith(12);
    instance.applyCollectionSummary(summary('collecting', { id: 'capture-b', startedAt: 112000 }));
    expect(instance.title.current.changeNum).toHaveBeenLastCalledWith(0);
    instance.stopCollectionTimer();
  });

  it('退出guard传递取消信号及真实回执更新，localCar只停止本地采集', async () => {
    const finish = vi.fn().mockResolvedValue(null), signal = new AbortController().signal;
    const instance = createHome(finish);
    await instance.preparePortalExit({ signal });
    expect(finish).toHaveBeenCalledWith({ signal, onSummary: instance.applyCollectionSummary });
    instance.state.matrixName = 'localCar'; instance.state.colWebFlag = true;
    await instance.preparePortalExit();
    expect(instance.state.colWebFlag).toBe(false);
    expect(finish).toHaveBeenCalledOnce();
  });

  it('真实WS重连只同步清单与采集状态，不发送关闭串口命令', async () => {
    const mount = home.body.body.find(node => node.key?.name === 'componentDidMount');
    const assignment = mount.body.body.find(node => node.type === 'ExpressionStatement'
      && node.expression.type === 'AssignmentExpression' && node.expression.left.property?.name === 'onopen').expression;
    const instance = createHome(); instance.wsSendObj = vi.fn();
    const open = vm.runInNewContext(`(function() { return ${source.slice(assignment.right.start, assignment.right.end)}; })`, {
      console: { info: () => {} }, AbortController,
      requestJson: vi.fn().mockResolvedValue({ collectionSummary: null }),
    }).call(instance);
    open(); await Promise.resolve();
    expect(instance.wsSendObj).toHaveBeenCalledWith({ getSensorTypes: true });
    expect(instance.wsSendObj.mock.calls.some(([payload]) => ['sitClose', 'backClose', 'headClose', 'sensorClose'].some(key => payload[key]))).toBe(false);
  });
});
