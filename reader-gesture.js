/* reader-gesture.js — 阅读器移动端触控状态机
 * 分两层：GestureMachine 是与 DOM 无关的纯状态机（可在 Node 里单测），attach() 是把触摸事件接到状态机上的薄适配层。
 * 状态互斥：IDLE / SWIPING / SELECTING / DRAGGING_ROCKER / MENU_ACTIVE
 * 关键原则：
 *   1. touchstart 永远不 preventDefault，不干扰系统长按选区与放大镜；
 *   2. 只有进入 SWIPING 之后，才在 touchmove 里 preventDefault；
 *   3. 一旦进入 SELECTING / MENU_ACTIVE，翻页手势整体让出，直到选区消失。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ReaderGesture = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var S = Object.freeze({ IDLE: 'IDLE', SWIPING: 'SWIPING', SELECTING: 'SELECTING', DRAGGING_ROCKER: 'DRAGGING_ROCKER', MENU_ACTIVE: 'MENU_ACTIVE' });

  var DEFAULTS = {
    longPressMs: 350,      // 按住超过该时长且位移不超过 slopPx，判定为长按选区
    slopPx: 8,             // 手指位移超过该值，取消长按判定
    swipeLockX: 10,        // 水平位移超过该值才可能锁定滑页
    swipeMaxY: 8,          // 垂直位移小于该值，锁定滑页
    swipeRatio: 2.5,       // 斜着滑的拇指弧线兜底：水平位移超过垂直位移的 2.5 倍也锁定
    tapMaxMs: 350,         // 点按的最长时长
    zoneRatio: 0.25,       // 左右各 25% 为翻页区，中间 50% 为菜单区
    selectSettleMs: 120,   // 选区变化稳定多久后，认为可以弹出气泡菜单
    selectGiveUpMs: 700,   // 长按抬手后，原生选区迟迟不出现，放弃 SELECTING
    rockerSelector: 'input[type=range], .reader-slider, .floating-companion-fab',
    menuSelector: '.reader-highlight-fab, .reader-selection-menu',
    ignoreSelector: 'button, a, input, select, textarea, dialog, .reader-topbar, .reader-bottombar, .reader-drawer'
  };

  class GestureMachine {
    constructor(cfg, timers) {
      this.cfg = Object.assign({}, DEFAULTS, cfg || {});
      this.timers = timers || {
        now: function () { return Date.now(); },
        set: function (fn, ms) { return setTimeout(fn, ms); },
        clear: function (id) { clearTimeout(id); }
      };
      this.state = S.IDLE;
      this.touch = null;
      this.longPressTimer = null;
      this.settleTimer = null;
      this.giveUpTimer = null;
    }

    _emit(name, a, b) {
      var fn = this.cfg[name];
      if (typeof fn === 'function') fn(a, b);
    }

    _set(next) {
      if (next === this.state) return;
      var prev = this.state;
      this.state = next;
      this._emit('onStateChange', next, prev);
    }

    _clear(name) {
      if (this[name] != null) {
        this.timers.clear(this[name]);
        this[name] = null;
      }
    }

    _enabled() {
      return typeof this.cfg.isEnabled === 'function' ? !!this.cfg.isEnabled() : true;
    }

    _zone(x, width) {
      if (!width) return 'menu';
      var r = x / width;
      if (r < this.cfg.zoneRatio) return 'prev';
      if (r > 1 - this.cfg.zoneRatio) return 'next';
      return 'menu';
    }

    // 多指、模式切换等异常情形：安全回到 IDLE（选区相关状态由选区自己决定何时结束）
    reset() {
      this._clear('longPressTimer');
      if (this.state === S.SWIPING) {
        var dx = this.touch ? this.touch.dx : 0;
        this.touch = null;
        this._set(S.IDLE);
        this._emit('onSwipeEnd', dx, true);
        return;
      }
      this.touch = null;
      if (this.state !== S.SELECTING && this.state !== S.MENU_ACTIVE) this._set(S.IDLE);
    }

    touchStart(p) {
      if (p.touches !== 1 || !this._enabled()) {
        this.reset();
        return;
      }
      this._clear('longPressTimer');
      this._clear('giveUpTimer');

      if (p.kind === 'rocker') {
        // 进度条、悬浮工具拖动：整段手势都归它们自己，翻页引擎完全不介入
        this.touch = null;
        this._set(S.DRAGGING_ROCKER);
        return;
      }

      var owned = this.state === S.SELECTING || this.state === S.MENU_ACTIVE;
      this.touch = { x0: p.x, y0: p.y, t0: this.timers.now(), width: p.width || 0, kind: p.kind, moved: false, abandoned: false, longPressed: false, dx: 0 };
      if (owned || p.kind !== 'content') return;

      var self = this;
      this.longPressTimer = this.timers.set(function () {
        self.longPressTimer = null;
        var tc = self.touch;
        if (self.state === S.IDLE && tc && !tc.moved && !tc.abandoned) {
          tc.longPressed = true;
          self._set(S.SELECTING);
          self._emit('onSelectStart');
        }
      }, this.cfg.longPressMs);
    }

    // 返回 true 表示调用方应当 preventDefault（仅在 SWIPING 时）
    touchMove(p) {
      var c = this.cfg, tc = this.touch;
      if (this.state === S.DRAGGING_ROCKER || !tc) return false;

      var dx = p.x - tc.x0, dy = p.y - tc.y0;
      tc.dx = dx;
      if (this.state === S.SWIPING) {
        this._emit('onSwipeMove', dx);
        return true;
      }

      var adx = Math.abs(dx), ady = Math.abs(dy);
      if (adx > c.slopPx || ady > c.slopPx) {
        tc.moved = true;
        this._clear('longPressTimer');
      }

      if (this.state !== S.IDLE || tc.abandoned || tc.kind !== 'content') return false;

      if (adx > c.swipeLockX && (ady < c.swipeMaxY || adx > ady * c.swipeRatio)) {
        this._clear('longPressTimer');
        this._set(S.SWIPING);
        this._emit('onSwipeStart');
        this._emit('onSwipeMove', dx);
        return true;
      }
      // 明确是竖向或斜向的操作：本次手势不再参与翻页
      if (ady >= c.swipeMaxY && ady >= adx) tc.abandoned = true;
      return false;
    }

    touchEnd() {
      var tc = this.touch, st = this.state;
      this.touch = null;
      this._clear('longPressTimer');

      if (st === S.DRAGGING_ROCKER) {
        this._set(S.IDLE);
        return;
      }
      if (st === S.SWIPING) {
        this._set(S.IDLE);
        this._emit('onSwipeEnd', tc ? tc.dx : 0, false);
        return;
      }
      if (!tc) return;

      var isTap = !tc.moved && !tc.abandoned && (this.timers.now() - tc.t0) < this.cfg.tapMaxMs;

      if (st === S.SELECTING) {
        if (tc.longPressed) this._armGiveUp();
        else if (isTap && tc.kind !== 'menu') this._dismissSelection();
        return;
      }
      if (st === S.MENU_ACTIVE) {
        // 菜单打开时点别处：只收起选区，这一下不翻页、不切换控制栏
        if (isTap && tc.kind !== 'menu') this._dismissSelection();
        return;
      }
      if (isTap && tc.kind === 'content') this._emit('onTap', this._zone(tc.x0, tc.width));
    }

    // Android Chrome 在原生选区出现时常会发 touchcancel，不能当成手势结束
    touchCancel() {
      var st = this.state, tc = this.touch;
      this._clear('longPressTimer');
      this.touch = null;
      if (st === S.SWIPING) {
        this._set(S.IDLE);
        this._emit('onSwipeEnd', tc ? tc.dx : 0, true);
      } else if (st === S.SELECTING) {
        if (tc && tc.longPressed) this._armGiveUp();
      } else if (st === S.DRAGGING_ROCKER) {
        this._set(S.IDLE);
      }
    }

    selectionChanged(has) {
      var self = this, st = this.state;
      if (has) {
        if (st === S.SWIPING || st === S.DRAGGING_ROCKER || st === S.MENU_ACTIVE) return;
        this._clear('settleTimer');
        this.settleTimer = this.timers.set(function () {
          self.settleTimer = null;
          if (self.state === S.SWIPING || self.state === S.DRAGGING_ROCKER) return;
          self._clear('giveUpTimer');
          self._set(S.MENU_ACTIVE);
          self._emit('onMenuShow');
        }, this.cfg.selectSettleMs);
      } else {
        this._clear('settleTimer');
        if (st === S.MENU_ACTIVE) {
          this._set(S.IDLE);
          this._emit('onMenuHide');
        }
      }
    }

    _armGiveUp() {
      var self = this;
      this._clear('giveUpTimer');
      this.giveUpTimer = this.timers.set(function () {
        self.giveUpTimer = null;
        if (self.state === S.SELECTING) self._set(S.IDLE);
      }, this.cfg.selectGiveUpMs);
    }

    _dismissSelection() {
      var wasMenu = this.state === S.MENU_ACTIVE;
      this._clear('settleTimer');
      this._clear('giveUpTimer');
      this._emit('onDismissSelection');
      this._set(S.IDLE);
      if (wasMenu) this._emit('onMenuHide');
    }
  }

  // DOM 适配层：把触摸事件翻译成状态机输入
  function attach(stage, machine, opts) {
    opts = opts || {};
    var doc = stage.ownerDocument;
    var cfg = machine.cfg;
    var contentEl = opts.contentEl || stage;

    var prevStateCb = cfg.onStateChange;
    cfg.onStateChange = function (next, prev) {
      stage.setAttribute('data-gesture', next);
      if (typeof prevStateCb === 'function') prevStateCb(next, prev);
    };
    stage.setAttribute('data-gesture', machine.state);

    function kindOf(target) {
      if (!target || !target.closest) return 'content';
      if (target.closest(cfg.rockerSelector)) return 'rocker';
      if (target.closest(cfg.menuSelector)) return 'menu';
      if (target.closest(cfg.ignoreSelector)) return 'ignore';
      return 'content';
    }

    function onStart(e) {
      var t = e.touches[0];
      var rect = stage.getBoundingClientRect();
      machine.touchStart({ x: t.clientX - rect.left, y: t.clientY, touches: e.touches.length, kind: kindOf(e.target), width: rect.width });
    }
    function onMove(e) {
      if (e.touches.length !== 1) {
        machine.reset();
        return;
      }
      var t = e.touches[0];
      var rect = stage.getBoundingClientRect();
      if (machine.touchMove({ x: t.clientX - rect.left, y: t.clientY }) && e.cancelable) e.preventDefault();
    }
    function onEnd() { machine.touchEnd(); }
    function onCancel() { machine.touchCancel(); }
    function onSel() {
      var sel = doc.getSelection ? doc.getSelection() : null;
      var has = !!(sel && sel.rangeCount > 0 && !sel.isCollapsed && sel.getRangeAt(0).intersectsNode(contentEl));
      machine.selectionChanged(has);
    }
    // 正文区域的 contextmenu 不拦截（Android 长按选区依赖它）；滑页中与拖动控件时才拦截
    function onCtx(e) {
      if (machine.state === S.SWIPING || machine.state === S.DRAGGING_ROCKER) e.preventDefault();
    }

    stage.addEventListener('touchstart', onStart, { passive: true });
    stage.addEventListener('touchmove', onMove, { passive: false });
    stage.addEventListener('touchend', onEnd, { passive: true });
    stage.addEventListener('touchcancel', onCancel, { passive: true });
    stage.addEventListener('contextmenu', onCtx);
    doc.addEventListener('selectionchange', onSel);

    return function detach() {
      stage.removeEventListener('touchstart', onStart);
      stage.removeEventListener('touchmove', onMove);
      stage.removeEventListener('touchend', onEnd);
      stage.removeEventListener('touchcancel', onCancel);
      stage.removeEventListener('contextmenu', onCtx);
      doc.removeEventListener('selectionchange', onSel);
      cfg.onStateChange = prevStateCb;
    };
  }

  return { STATE: S, DEFAULTS: DEFAULTS, GestureMachine: GestureMachine, attach: attach };
});
