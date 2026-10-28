import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { filterHandPressure } from './handPressureFilter';

const { parse } = createRequire(import.meta.url)('@babel/parser');
const source = readFileSync(new URL('./hand.jsx', import.meta.url), 'utf8');
const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
const canvas = ast.program.body.find(node => node.declarations?.some(item => item.id.name === 'Canvas'))
  .declarations.find(item => item.id.name === 'Canvas').init.arguments[0];
const methods = canvas.body.body.filter(node => node.type === 'FunctionDeclaration'
  && ['sitValue', 'sitData', 'refreshPressureDisplay'].includes(node.id.name)).map(node => source.slice(node.start, node.end));

/** 运行真实手部调参与收帧方法，验证跨帧保留阈值和末帧恢复。 */
function hand() {
  return vm.runInNewContext(`(() => {
    let valuej1=200,valueg1=2,value1=2,valuel1=5,valuef1=0,valuelInit1=500,ndata1=[],i=0;
    const rawPressureRef={current:[]},pressureSuppressedRef={current:false},smoothBig=[12,20];
    ${methods.join('\n')}
    return {sitValue,sitData,snapshot:()=>({values:[...ndata1],suppressed:pressureSuppressedRef.current,smooth:[...smoothBig]})};
  })()`, { filterHandPressure });
}

describe('手部ADC总和初始阈值', () => {
  it('小于阈值清空压力，等于或高于阈值展示，输入帧不被改写', () => {
    const frame = [999];
    const hidden = filterHandPressure(frame, { initialThreshold: 1000 });
    expect(hidden.suppressed).toBe(true);
    expect(hidden.values.every(value => value === 0)).toBe(true);
    expect(frame).toEqual([999]);
    for (const value of [1000, 1001]) {
      const shown = filterHandPressure([value], { initialThreshold: 1000 });
      expect(shown.suppressed).toBe(false);
      expect(shown.values[0]).toBe(value);
    }
  });

  it('按原始ADC总和判定，不把插值点或逐点过滤后的值当作总和', () => {
    const shown = filterHandPressure([80, 80], { initialThreshold: 150, pointFilter: 90 });
    expect(shown.total).toBe(160);
    expect(shown.suppressed).toBe(false);
    expect(shown.values.every(value => value === 0)).toBe(true);
  });

  it('真实收帧调用未重复携带valuelInit时仍保留已调节阈值', () => {
    const renderer = hand();
    renderer.sitValue({ valuelInit: 2000 });
    for (let index = 0; index < 20; index++) renderer.sitData({ wsPointData: [1000] });
    expect(renderer.snapshot().suppressed).toBe(true);
    expect(renderer.snapshot().values.every(value => value === 0)).toBe(true);
    expect(renderer.snapshot().smooth).toEqual([0, 0]);
    renderer.sitData({ wsPointData: [2000] });
    expect(renderer.snapshot().values[0]).toBe(2000);
  });

  it('调低阈值或设为0立即恢复末帧，不等待新帧且不累加过滤', () => {
    const renderer = hand();
    renderer.sitData({ wsPointData: [1000] });
    renderer.sitValue({ valuelInit: 2000 });
    expect(renderer.snapshot().suppressed).toBe(true);
    renderer.sitValue({ valuelInit: 0 });
    expect(renderer.snapshot().values[0]).toBe(1000);
    renderer.sitValue({ valuef: 2000 });
    expect(renderer.snapshot().values[0]).toBe(0);
    renderer.sitValue({ valuef: 0 });
    expect(renderer.snapshot().values[0]).toBe(1000);
  });
});
