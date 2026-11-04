// reader-gesture.js 状态机测试：用假定时器驱动，只验证状态转移逻辑。
// 这里不涉及真实触摸、系统选区与放大镜，那部分仍需在 iOS Safari 与 Android Chrome 真机上验证。
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const G = createRequire(import.meta.url)('../reader-gesture.js');
const S = G.STATE;

function mk() {
  let t = 0;
  let id = 0;
  const q = [];
  const timers = {
    now: () => t,
    set: (fn, ms) => { const i = ++id; q.push({ i, at: t + ms, fn }); return i; },
    clear: (i) => { const k = q.findIndex((x) => x.i === i); if (k >= 0) q.splice(k, 1); }
  };
  const adv = (ms) => {
    const end = t + ms;
    for (;;) {
      q.sort((a, b) => a.at - b.at);
      if (!q.length || q[0].at > end) break;
      const x = q.shift();
      t = x.at;
      x.fn();
    }
    t = end;
  };
  const log = [];
  const m = new G.GestureMachine({
    onTap: (z) => log.push('tap:' + z),
    onSwipeStart: () => log.push('swipeStart'),
    onSwipeEnd: (dx, c) => log.push('swipeEnd:' + dx + ':' + c),
    onSelectStart: () => log.push('selectStart'),
    onMenuShow: () => log.push('menuShow'),
    onMenuHide: () => log.push('menuHide'),
    onDismissSelection: () => log.push('dismiss')
  }, timers);
  return { m, adv, log };
}

const down = (m, x, y, kind) => m.touchStart({ x: x, y: y, touches: 1, kind: kind || 'content', width: 400 });

test('短按左右边缘与中间区域分别得到 prev / next / menu', () => {
  const { m, adv, log } = mk();
  [[40, 'prev'], [360, 'next'], [200, 'menu']].forEach(([x, zone]) => {
    down(m, x, 300);
    adv(80);
    m.touchEnd();
    assert.equal(log.pop(), 'tap:' + zone);
  });
  assert.equal(m.state, S.IDLE);
});

test('水平位移超过 10px 且垂直位移小于 8px 锁定 SWIPING，并要求 preventDefault', () => {
  const { m, log } = mk();
  down(m, 200, 300);
  assert.equal(m.touchMove({ x: 205, y: 301 }), false);
  assert.equal(m.state, S.IDLE);
  assert.equal(m.touchMove({ x: 230, y: 302 }), true);
  assert.equal(m.state, S.SWIPING);
  m.touchEnd();
  assert.equal(m.state, S.IDLE);
  assert.deepEqual(log, ['swipeStart', 'swipeEnd:30:false']);
});

test('竖向滑动不会进入 SWIPING，也不会产生点按', () => {
  const { m, adv, log } = mk();
  down(m, 200, 300);
  assert.equal(m.touchMove({ x: 203, y: 340 }), false);
  assert.equal(m.touchMove({ x: 260, y: 345 }), false);
  assert.equal(m.state, S.IDLE);
  adv(60);
  m.touchEnd();
  assert.deepEqual(log, []);
});

test('按住 350ms 且基本不动 -> SELECTING，之后手指微动不会翻页', () => {
  const { m, adv, log } = mk();
  down(m, 200, 300);
  adv(340);
  assert.equal(m.state, S.IDLE);
  adv(20);
  assert.equal(m.state, S.SELECTING);
  assert.equal(m.touchMove({ x: 260, y: 302 }), false);
  assert.equal(m.state, S.SELECTING);
  assert.deepEqual(log, ['selectStart']);
});

test('长按前的小抖动（不超过 8px）不取消长按', () => {
  const { m, adv } = mk();
  down(m, 200, 300);
  m.touchMove({ x: 205, y: 304 });
  adv(360);
  assert.equal(m.state, S.SELECTING);
});

test('长按前位移超过 8px 取消长按判定', () => {
  const { m, adv } = mk();
  down(m, 200, 300);
  m.touchMove({ x: 200, y: 310 });
  adv(500);
  assert.equal(m.state, S.IDLE);
});

test('选区稳定后进入 MENU_ACTIVE，选区消失后回到 IDLE', () => {
  const { m, adv, log } = mk();
  down(m, 200, 300);
  adv(360);
  m.touchEnd();
  m.selectionChanged(true);
  adv(130);
  assert.equal(m.state, S.MENU_ACTIVE);
  m.selectionChanged(false);
  assert.equal(m.state, S.IDLE);
  assert.deepEqual(log, ['selectStart', 'menuShow', 'menuHide']);
});

test('Android 长按后触发 touchcancel：不退出 SELECTING，选区随后出现仍能弹菜单', () => {
  const { m, adv } = mk();
  down(m, 200, 300);
  adv(360);
  m.touchCancel();
  assert.equal(m.state, S.SELECTING);
  m.selectionChanged(true);
  adv(130);
  assert.equal(m.state, S.MENU_ACTIVE);
});

test('长按抬手后原生选区迟迟不出现，超时放弃 SELECTING', () => {
  const { m, adv } = mk();
  down(m, 200, 300);
  adv(360);
  m.touchEnd();
  assert.equal(m.state, S.SELECTING);
  adv(710);
  assert.equal(m.state, S.IDLE);
});

test('菜单打开时点击别处：只收起选区，不翻页、不切换控制栏', () => {
  const { m, adv, log } = mk();
  down(m, 200, 300);
  adv(360);
  m.touchEnd();
  m.selectionChanged(true);
  adv(130);
  log.length = 0;
  down(m, 40, 300);
  adv(60);
  m.touchEnd();
  assert.equal(m.state, S.IDLE);
  assert.deepEqual(log, ['dismiss', 'menuHide']);
});

test('菜单打开时在菜单上操作不会误收起选区', () => {
  const { m, adv, log } = mk();
  down(m, 200, 300);
  adv(360);
  m.touchEnd();
  m.selectionChanged(true);
  adv(130);
  log.length = 0;
  down(m, 200, 500, 'menu');
  adv(60);
  m.touchEnd();
  assert.equal(m.state, S.MENU_ACTIVE);
  assert.deepEqual(log, []);
});

test('拖动滑块或悬浮工具：整段手势进入 DRAGGING_ROCKER，不翻页不点按', () => {
  const { m, adv, log } = mk();
  down(m, 100, 700, 'rocker');
  assert.equal(m.state, S.DRAGGING_ROCKER);
  assert.equal(m.touchMove({ x: 220, y: 702 }), false);
  adv(500);
  assert.equal(m.state, S.DRAGGING_ROCKER);
  m.touchEnd();
  assert.equal(m.state, S.IDLE);
  assert.deepEqual(log, []);
});

test('顶栏、底栏、抽屉等区域（ignore）不触发长按、滑页与点按', () => {
  const { m, adv, log } = mk();
  down(m, 200, 20, 'ignore');
  adv(500);
  m.touchMove({ x: 260, y: 21 });
  m.touchEnd();
  assert.equal(m.state, S.IDLE);
  assert.deepEqual(log, []);
});

test('滑页过程中来了第二根手指：取消本次滑页并回到 IDLE', () => {
  const { m, log } = mk();
  down(m, 200, 300);
  m.touchMove({ x: 240, y: 301 });
  m.touchStart({ x: 100, y: 300, touches: 2, kind: 'content', width: 400 });
  assert.equal(m.state, S.IDLE);
  assert.equal(log[log.length - 1], 'swipeEnd:40:true');
});

test('isEnabled 返回 false（如 PDF 或卷曲模式）时整个状态机不介入', () => {
  let on = false;
  const m = new G.GestureMachine({ isEnabled: () => on });
  down(m, 200, 300);
  assert.equal(m.touchMove({ x: 260, y: 301 }), false);
  assert.equal(m.state, S.IDLE);
});

test('isSwipeEnabled 返回 false（如长卷连续滚动模式）时不锁定滑页但仍保留轻触点按', () => {
  const log = [];
  const m = new G.GestureMachine({
    isSwipeEnabled: () => false,
    onTap: (z) => log.push('tap:' + z),
    onSwipeStart: () => log.push('swipeStart')
  });

  // 1. 滑动手势被忽略，不进入 SWIPING 也不触发 onSwipeStart
  down(m, 200, 300);
  assert.equal(m.touchMove({ x: 260, y: 301 }), false);
  assert.equal(m.state, S.IDLE);
  assert.deepEqual(log, []);
  m.touchEnd();

  // 2. 纯轻触点按正常触发 onTap，确保连续滚动模式下可唤出控制栏
  down(m, 200, 300);
  m.touchEnd();
  assert.deepEqual(log, ['tap:menu']);
});

