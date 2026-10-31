// Shared progressive enhancement: no content depends on an animation finishing.
(() => {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)');
    const fine = matchMedia('(hover: hover) and (pointer: fine)');
    const active = new Set();
    function enter(el, delay = 0) {
        if (reduce.matches || !el.animate) return;
        const animation = el.animate([
            { opacity: 0, transform: 'translateY(22px) scale(.985)' },
            { opacity: 1, transform: 'translateY(0) scale(1)' }
        ], { duration: 620, delay, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' });
        active.add(animation);
        animation.onfinish = animation.oncancel = () => active.delete(animation);
    }
    let observer;
    if ('IntersectionObserver' in window) {
        observer = new IntersectionObserver(entries => {
            let order = 0;
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                enter(entry.target, Math.min(order++ * 65, 260));
                observer.unobserve(entry.target);
            });
        }, { threshold: .08 });
        document.querySelectorAll('.catalog-heading,.shop-guide,.guide-grid article').forEach(el => observer.observe(el));
    }
    document.querySelectorAll('.shop-hero > *').forEach((el, i) => enter(el, i * 90));
    const grid = document.querySelector('.shop-grid');
    function registerCards() {
        grid.querySelectorAll('.product').forEach((el, i) => {
            if (observer) observer.observe(el);
            else enter(el, Math.min(i * 65, 260));
        });
    }
    if (grid) {
        registerCards();
        new MutationObserver(records => {
            records.forEach(record => record.removedNodes.forEach(node => {
                if (node.nodeType === 1) observer?.unobserve(node);
            }));
            registerCards();
        }).observe(grid, { childList: true });
    }
    const progress = document.createElement('div');
    progress.className = 'reading-progress';
    progress.setAttribute('aria-hidden', 'true');
    document.body.append(progress);
    let scrollFrame = 0;
    function updateProgress() {
        const length = document.documentElement.scrollHeight - innerHeight;
        progress.style.transform = `scaleX(${length > 0 ? Math.min(1, Math.max(0, scrollY / length)) : 0})`;
        scrollFrame = 0;
    }
    addEventListener('scroll', () => {
        if (!scrollFrame) scrollFrame = requestAnimationFrame(updateProgress);
    }, { passive: true });
    addEventListener('resize', updateProgress);
    updateProgress();
    // Only desktop pointer movement gets a subtle tilt; never interferes with touch scrolling.
    let pointerFrame = 0, hovered = null;
    function resetCard() {
        cancelAnimationFrame(pointerFrame);
        pointerFrame = 0;
        if (hovered) hovered.style.removeProperty('rotate');
        hovered = null;
    }
    document.addEventListener('pointermove', event => {
        if (reduce.matches || !fine.matches) return;
        const card = event.target.closest('.product');
        if (card !== hovered) resetCard();
        if (!card) return;
        hovered = card;
        cancelAnimationFrame(pointerFrame);
        pointerFrame = requestAnimationFrame(() => {
            const box = card.getBoundingClientRect();
            const x = (event.clientX - box.left) / box.width;
            card.style.setProperty('--light-x', `${event.clientX - box.left}px`);
            card.style.setProperty('--light-y', `${event.clientY - box.top}px`);
            card.style.rotate = `${(x - .5) * 1.4}deg`;
        });
    }, { passive: true });
    document.addEventListener('pointerout', event => { if (!event.relatedTarget) resetCard(); });
    fine.addEventListener('change', resetCard);
    reduce.addEventListener('change', () => {
        resetCard();
        if (reduce.matches) active.forEach(animation => animation.cancel());
    });
})();
