// 使用真正可见的视口，而非被软键盘遮住的布局视口。
export function viewportMetrics(visual, fallback = {}) {
    const positive = (value, other) => Number.isFinite(value) && value > 0 ? value : other;
    return {
        width: positive(visual?.width, positive(fallback.innerWidth, 360)),
        height: positive(visual?.height, positive(fallback.innerHeight, 640)),
        top: Number.isFinite(visual?.offsetTop) ? Math.max(0, visual.offsetTop) : 0,
        left: Number.isFinite(visual?.offsetLeft) ? Math.max(0, visual.offsetLeft) : 0,
    };
}

const mounted = new WeakMap();
export function installViewport({root = document.documentElement, doc = document, win = window} = {}) {
    if (mounted.has(root)) return mounted.get(root);
    let frame = 0;
    const syncDialog = () => doc.body.classList.toggle('mobile-dialog-open', Boolean(doc.querySelector('dialog[open]')));
    const sync = () => {
        frame = 0;
        const size = viewportMetrics(win.visualViewport, win);
        for (const [name, value] of Object.entries(size)) root.style.setProperty(`--ui-${name}`, `${value}px`);
        syncDialog();
    };
    const queue = () => { if (!frame) frame = win.requestAnimationFrame(sync); };
    const listeners = [];
    const listen = (target, name, handler, options) => {
        target?.addEventListener(name, handler, options);
        listeners.push(() => target?.removeEventListener(name, handler, options));
    };
    listen(win.visualViewport, 'resize', queue);
    listen(win.visualViewport, 'scroll', queue);
    listen(win, 'resize', queue);
    listen(win, 'pageshow', queue);
    listen(doc, 'close', syncDialog, true);
    listen(doc, 'cancel', queue, true);
    listen(doc, 'click', queue);
    const observer = win.MutationObserver ? new win.MutationObserver(queue) : null;
    observer?.observe(doc.body, {subtree: true, attributes: true, attributeFilter: ['open']});
    sync();
    const dispose = () => {
        if (frame) win.cancelAnimationFrame(frame);
        listeners.forEach(remove => remove());
        observer?.disconnect();
        mounted.delete(root);
    };
    mounted.set(root, dispose);
    return dispose;
}
