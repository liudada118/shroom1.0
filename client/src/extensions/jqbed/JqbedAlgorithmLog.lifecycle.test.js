import { describe, expect, it, vi } from 'vitest';
import JqbedAlgorithmLog, { JqbedAlgorithmLogValues, JqbedLogJson } from './JqbedAlgorithmLog.jsx';
import { mergeJqbedAlgorithmLogFrame } from './jqbedAlgorithmLogState';

const hooks = vi.hoisted(() => ({ current: null }));
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useState: (...args) => hooks.current.useState(...args),
    useRef: (...args) => hooks.current.useRef(...args),
    useEffect: (...args) => hooks.current.useEffect(...args),
    useMemo: (...args) => hooks.current.useMemo(...args),
  };
});
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key) => key, i18n: { language: 'en' } }) }));

// Runs the component's own hooks/effect cleanup without adding a browser/renderer dependency.
function createHookHarness(Component, initialProps) {
  const slots = [];
  let props = initialProps;
  let tree;
  let dirty = false;
  const sameDeps = (a, b) => a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
  const render = (next = {}) => {
    props = { ...props, ...next };
    let attempts = 0;
    do {
      dirty = false;
      let cursor = 0;
      const effects = [];
      hooks.current = {
        useState(initial) {
          const index = cursor++;
          if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial };
          return [slots[index].value, (value) => {
            const nextValue = typeof value === 'function' ? value(slots[index].value) : value;
            if (!Object.is(nextValue, slots[index].value)) { slots[index].value = nextValue; dirty = true; }
          }];
        },
        useRef(initial) {
          const index = cursor++;
          if (!slots[index]) slots[index] = { value: { current: initial } };
          return slots[index].value;
        },
        useEffect(callback, dependencies) {
          const index = cursor++;
          const previous = slots[index];
          if (!previous || !sameDeps(previous.dependencies, dependencies)) {
            effects.push(() => {
              previous?.cleanup?.();
              slots[index] = { dependencies, cleanup: callback() };
            });
          }
        },
        useMemo(callback, dependencies) {
          const index = cursor++;
          if (!slots[index] || !sameDeps(slots[index].dependencies, dependencies)) {
            slots[index] = { dependencies, value: callback() };
          }
          return slots[index].value;
        },
      };
      try { tree = Component(props); } finally { hooks.current = null; }
      effects.forEach((effect) => effect());
      if (++attempts > 20) throw new Error('hook harness failed to settle');
    } while (dirty);
    return tree;
  };
  const walk = (node, predicate) => {
    if (!node || typeof node !== 'object') return [];
    const children = Array.isArray(node.props?.children) ? node.props.children.flat(Infinity) : [node.props?.children];
    return [...(predicate(node) ? [node] : []), ...children.flatMap((child) => walk(child, predicate))];
  };
  return {
    render,
    find: (predicate) => walk(tree, predicate),
    frames: () => walk(tree, (node) => Boolean(node.props?.frame)).map((node) => node.props.frame),
    unmount: () => slots.forEach((slot) => slot.cleanup?.()),
  };
}

const frame = (sequence, outputs = { breath_rate: -1, bed_type: 0 }) => ({
  sensorType: 'jqbed', sequence, receivedAt: '2026-10-16T12:34:56.789Z', outputs,
});

describe('jqbed live log component lifecycle', () => {
  it('subscribes only for the active connected open tab and releases every exit path', () => {
    const subscribe = vi.fn((enabled) => enabled ? `request-${subscribe.mock.calls.length}` : 'off');
    const harness = createHookHarness(JqbedAlgorithmLog, { active: false, open: true, connected: true, connectionEpoch: 1, onLogSubscription: subscribe });
    expect(harness.render()).toBe(null);
    expect(subscribe).not.toHaveBeenCalled();
    harness.render({ active: true });
    expect(subscribe.mock.calls).toEqual([[true]]);
    harness.render({ algorithmLogFrame: frame(1) });
    expect(subscribe.mock.calls).toEqual([[true]]);
    harness.render({ connectionEpoch: 2 });
    expect(subscribe.mock.calls).toEqual([[true], [false], [true]]);
    harness.render({ connected: false });
    expect(subscribe.mock.calls.at(-1)).toEqual([false]);
    harness.render({ connected: true });
    harness.render({ active: false });
    expect(subscribe.mock.calls.at(-1)).toEqual([false]);
    harness.render({ active: true });
    harness.render({ open: false });
    expect(subscribe.mock.calls.at(-1)).toEqual([false]);
    harness.render({ open: true });
    harness.unmount();
    expect(subscribe.mock.calls.at(-1)).toEqual([false]);
  });

  it('requires a matching ack and skips -1 on each field while keeping valid zero updates', () => {
    const harness = createHookHarness(JqbedAlgorithmLog, { active: true, open: true, connected: true, connectionEpoch: 1, onLogSubscription: () => 'request-1' });
    harness.render();
    harness.render({ logSubscription: { ok: true, subscribed: true, requestId: 'stale' }, algorithmLogFrame: frame(1) });
    expect(harness.frames()).toEqual([]);
    const zero = frame(2, { breath_rate: 0, in_bed: 0, future: null });
    harness.render({ logSubscription: { ok: true, subscribed: true, requestId: 'request-1' }, algorithmLogFrame: zero });
    expect(harness.frames()).toEqual([zero]);
    const missing = frame(3, { breath_rate: -1, in_bed: -1, future: null });
    harness.render({ algorithmLogFrame: missing });
    expect(harness.frames()).toEqual([frame(3, { breath_rate: 0, in_bed: 0, future: null })]);
    const newest = frame(4, { breath_rate: 21, unknown: false });
    harness.render({ algorithmLogFrame: newest });
    expect(harness.frames()).toEqual([frame(4, { breath_rate: 21, in_bed: 0, future: null, unknown: false })]);
    expect(harness.find((node) => node.type === 'input' || node.type === 'button')).toHaveLength(0);
    harness.unmount();
  });

  it.each([
    [{ active: false }, { active: true }],
    [{ open: false }, { open: true }],
    [{ connected: false }, { connected: true }],
    [{ connectionEpoch: 2 }, {}],
  ])('clears on a session boundary and waits for a new frame instead of reusing the old prop', (leave, returnToLog) => {
    const subscribe = vi.fn((enabled) => enabled ? `request-${subscribe.mock.calls.length}` : 'off');
    const harness = createHookHarness(JqbedAlgorithmLog, { active: true, open: true, connected: true, connectionEpoch: 1, onLogSubscription: subscribe });
    harness.render();
    harness.render({ logSubscription: { ok: true, subscribed: true, requestId: 'request-1' }, algorithmLogFrame: frame(1) });
    expect(harness.frames()).toEqual([frame(1)]);
    harness.render(leave);
    expect(harness.frames()).toEqual([]);
    harness.render(returnToLog);
    harness.render({ logSubscription: { ok: true, subscribed: true, requestId: 'request-3' } });
    expect(harness.frames()).toEqual([]);
    harness.render({ algorithmLogFrame: frame(2) });
    expect(harness.frames()).toEqual([frame(2)]);
    harness.unmount();
  });

  it('clears the visible frame on empty or rejected source data without substituting saved settings', () => {
    const harness = createHookHarness(JqbedAlgorithmLog, { active: true, open: true, connected: true, connectionEpoch: 1, onLogSubscription: () => 'request-1' });
    harness.render();
    harness.render({ logSubscription: { ok: true, subscribed: true, requestId: 'request-1' }, algorithmLogFrame: frame(1) });
    harness.render({ algorithmLogFrame: null });
    expect(harness.frames()).toEqual([]);
    harness.render({ algorithmLogFrame: { ...frame(2), sensorType: 'other' } });
    expect(harness.frames()).toEqual([]);
    harness.unmount();
  });

  it('keeps an expanded array open and updates its complete JSON as new values arrive', () => {
    const first = Array.from({ length: 1024 }, (_, index) => index);
    const next = Array.from({ length: 1024 }, (_, index) => index === 1023 ? -1 : 2000 + index);
    const stringify = vi.spyOn(JSON, 'stringify');
    const harness = createHookHarness(JqbedLogJson.type, { label: 'Matrix', value: first });
    harness.render();
    expect(stringify).not.toHaveBeenCalled();
    harness.find((node) => node.type === 'details')[0].props.onToggle({ currentTarget: { open: true } });
    harness.render();
    expect(JSON.parse(harness.find((node) => node.type === 'pre')[0].props.children)).toEqual(first);
    harness.render({ value: next });
    expect(harness.find((node) => node.type === 'details')[0].props.open).toBe(true);
    expect(JSON.parse(harness.find((node) => node.type === 'pre')[0].props.children)).toEqual(next);
    expect(JSON.parse(harness.find((node) => node.type === 'pre')[0].props.children)).toHaveLength(1024);
    harness.render();
    expect(stringify).toHaveBeenCalledTimes(2);
    stringify.mockRestore();
    harness.unmount();
  });

  it('lists all scalar fields directly and keeps disclosure component identities stable across updates', () => {
    const outputs = { breath_rate: 0, state: null, future: false, full_matrix: [0, -1], reserved_bytes: [0, -1, 2, 3, 4, 5, 999999] };
    const harness = createHookHarness(JqbedAlgorithmLogValues.type, { frame: frame(1, outputs) });
    harness.render();
    expect(harness.find((node) => node.props?.className === 'jqbedAlgorithmConfig__logRawKey').map((node) => node.props.children)).toEqual(Object.keys(outputs));
    expect(harness.find((node) => node.props?.className === 'jqbedAlgorithmConfig__logFieldValue').map((node) => node.props.children)).toEqual(['0', 'null', 'false']);
    expect(harness.find((node) => node.type === 'pre')).toHaveLength(0);
    const firstDetails = harness.find((node) => node.type === JqbedLogJson);
    const next = mergeJqbedAlgorithmLogFrame(frame(1, outputs), frame(2, { ...outputs, breath_rate: -1, full_matrix: [9, 8, -1] }));
    harness.render({ frame: next });
    expect(harness.find((node) => node.props?.className === 'jqbedAlgorithmConfig__logFieldValue').map((node) => node.props.children)).toEqual(['0', 'null', 'false']);
    const nextDetails = harness.find((node) => node.type === JqbedLogJson);
    expect(nextDetails.map((node) => node.type)).toEqual(firstDetails.map((node) => node.type));
    expect(nextDetails[0].props.value).toEqual([9, 8, -1]);
    expect(nextDetails[1].props.value).toBe(outputs.reserved_bytes);
    harness.unmount();
  });

  it('keeps protocol JSON keys unchanged when display names and descriptions are added', () => {
    const outputs = { rate: 18, reserved_bytes: [0, 1, 2, 3, 3, 1], future_protocol_value: 0 };
    const harness = createHookHarness(JqbedAlgorithmLogValues.type, { frame: frame(1, outputs) });
    harness.render();
    const jsonValue = harness.find((node) => node.type === JqbedLogJson)
      .find((node) => node.props.label === 'jqbedAlgorithmConfig.log.rawJson').props.value;
    expect(Object.keys(jsonValue)).toEqual(['rate', 'reserved_bytes', 'future_protocol_value']);
    expect(jsonValue).toEqual(outputs);
    expect(jsonValue.reserved_bytes).toBe(outputs.reserved_bytes);
    harness.unmount();
  });
});
