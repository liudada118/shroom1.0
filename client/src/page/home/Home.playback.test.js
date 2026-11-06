import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const { parse } = createRequire(import.meta.url)('@babel/parser');
const source = readFileSync(new URL('./Home.jsx', import.meta.url), 'utf8');
const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
const home = ast.program.body.find(node => node.type === 'ClassDeclaration' && node.id.name === 'Home');

/** 执行真实Home状态桥，不为回放按钮加载无关模型。 */
function createHome() {
  const names = ['applyPlaybackStatus', 'syncPlaybackStarted'];
  const methods = home.body.body.filter(node => names.includes(node.key?.name)).map(node => source.slice(node.start, node.end));
  const instance = vm.runInNewContext(`new (class { ${methods.join('\n')} })()`, {});
  instance.state = { local: true, matrixName: 'smallBed', systemId: 'smallBed-copy', dataTime: 'record-a' };
  instance.progress = { current: { setPlaying: vi.fn(), changeIndex: vi.fn() } };
  return instance;
}

/** 当前副本的真实播放回执，序号和记录可用于验证过期消息隔离。 */
function status(updates = {}) {
  return { systemId: 'smallBed-copy', recordKey: 'record-a', sequence: 1, playing: false, index: 3, ...updates };
}

describe('回放结束状态同步', () => {
  it('自然结束显示播放按钮，重新播放回执显示暂停并将进度归到起点', () => {
    const home = createHome();
    home.applyPlaybackStatus(status());
    expect(home.progress.current.setPlaying).toHaveBeenLastCalledWith(false);
    expect(home.progress.current.changeIndex).toHaveBeenLastCalledWith(3);
    home.applyPlaybackStatus(status({ playing: true, index: 0, sequence: 2 }));
    expect(home.progress.current.setPlaying).toHaveBeenLastCalledWith(true);
    expect(home.progress.current.changeIndex).toHaveBeenLastCalledWith(0);
  });

  it('旧记录、旧系统、旧序号及退出回放后的消息不能暂停当前按钮', () => {
    const home = createHome();
    home.applyPlaybackStatus(status({ playing: true, sequence: 4 }));
    home.applyPlaybackStatus(status({ sequence: 3 }));
    home.applyPlaybackStatus(status({ sequence: 5, recordKey: 'record-old' }));
    home.applyPlaybackStatus(status({ sequence: 6, systemId: 'smallBed' }));
    home.state.local = false;
    home.applyPlaybackStatus(status({ sequence: 7 }));
    expect(home.progress.current.setPlaying).toHaveBeenCalledTimes(1);
    expect(home.progress.current.setPlaying).toHaveBeenLastCalledWith(true);
  });

  it('HTTP开始ACK晚于单帧结束时，不重新点亮暂停按钮；旧宿主仍支持开始回执', () => {
    const home = createHome();
    home.syncPlaybackStarted();
    expect(home.progress.current.setPlaying).toHaveBeenLastCalledWith(true);
    home.applyPlaybackStatus(status());
    home.syncPlaybackStarted();
    expect(home.progress.current.setPlaying).toHaveBeenLastCalledWith(false);
    home.state.dataTime = 'record-b';
    home.syncPlaybackStarted();
    expect(home.progress.current.setPlaying).toHaveBeenLastCalledWith(true);
  });
});
