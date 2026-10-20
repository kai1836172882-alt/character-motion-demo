const test = require('node:test');
const assert = require('node:assert/strict');
const { durations, sample } = require('../motion.js');

test('每种动作都有可见变化，并在开始和结束时回到中性姿态', () => {
  for (const [name, duration] of Object.entries(durations)) {
    for (const t of [-1, 0, duration, duration + 1]) {
      assert(Object.values(sample(name, t)).every(v => Math.abs(v) < 1e-7), name + ' 回位失败');
    }
    const frames = Array.from({ length: 201 }, (_, i) => sample(name, i / 200 * duration));
    assert(frames.some(p => Object.values(p).some(v => Math.abs(v) > .5)), name + ' 没有有效动作');
    for (const frame of frames) for (const [key, value] of Object.entries(frame)) {
      assert(Number.isFinite(value) && Math.abs(value) <= 1.5, name + '/' + key + ' 越界');
      if (key === 'blink' || key === 'mouth') assert(value >= 0 && value <= 1);
    }
  }
});
test('双眨眼有两个闭眼峰值且中间睁开', () => {
  assert(sample('doubleBlink', .23).blink > .9);
  assert(sample('doubleBlink', .46).blink < .1);
  assert(sample('doubleBlink', .64).blink > .9);
});
test('摇头经过左右两个方向，点头不改变嘴形', () => {
  const sequence = Array.from({ length: 100 }, (_, i) => sample('shake', i / 100 * durations.shake).lookX);
  assert(Math.min(...sequence) < -.5 && Math.max(...sequence) > .5);
  assert.equal(sample('nod', .7).mouth, 0);
});
